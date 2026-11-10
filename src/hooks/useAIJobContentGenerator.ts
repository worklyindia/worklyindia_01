import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AIErrorType } from "@/components/AIUsageLimitModal";
import { FunctionsHttpError } from "@supabase/supabase-js";

interface JobContext {
  title?: string;
  department?: string;
  category?: string;
  availableCategories?: readonly string[] | string[];
  jobType?: string;
  experienceLevel?: string;
  location?: string;
  companyName?: string;
  industry?: string;
  companyId?: string;
  // Additional company details for better AI context
  companyDescription?: string;
  companySize?: string;
  companyWebsite?: string; // AI will use website for better context
}

interface AIGeneratorResult {
  content: string | string[] | { min: number; max: number; period?: string };
  success: boolean;
  meta?: {
    similarJobsAnalyzed?: number;
    employerPreviousJobs?: number;
    model?: string;
  };
  error?: {
    type: AIErrorType;
    message: string;
    details?: string;
    remainingUsage?: number;
    totalLimit?: number;
  };
}

type EdgeFunctionErrorBody = {
  error?: string;
  errorType?: AIErrorType;
  details?: string;
  remainingUsage?: number;
  totalLimit?: number;
};

async function tryParseEdgeFunctionError(error: unknown): Promise<EdgeFunctionErrorBody | null> {
  if (!(error instanceof FunctionsHttpError)) return null;

  const res = error.context as Response | undefined;
  if (!res) return null;

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) return null;

  try {
    // clone() so we don't consume the original body (safer if something else reads it)
    return (await res.clone().json()) as EdgeFunctionErrorBody;
  } catch {
    return null;
  }
}

// Preflight check - verify user has remaining AI credits BEFORE calling edge function
async function checkAIUsagePreflight(): Promise<{
  allowed: boolean;
  remaining?: number;
  limit?: number;
  error?: { type: AIErrorType; message: string; details?: string; remainingUsage?: number; totalLimit?: number };
}> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      return {
        allowed: false,
        error: {
          type: "no_subscription",
          message: "Please log in to use AI features.",
          details: "Your session appears to be missing. Please sign in again.",
        },
      };
    }

    // Call RPC to check AI usage limits (read-only, doesn't increment)
    const { data: status, error: rpcError } = await supabase.rpc('get_user_ai_chat_status', {
      p_user_id: userId
    });

    if (rpcError) {
      console.error('Preflight check RPC error:', rpcError);
      // Don't block on RPC error - let edge function handle it
      return { allowed: true };
    }

    // Type-cast status to expected shape
    const statusObj = status as { plan?: { messages_per_month?: number }; usage?: { messages_count?: number } } | null;
    
    const plan = statusObj?.plan;
    const usage = statusObj?.usage;

    if (!plan) {
      return {
        allowed: false,
        error: {
          type: "no_subscription",
          message: "No active AI subscription found.",
          details: "Subscribe to an AI plan to use AI-powered content generation.",
        },
      };
    }

    const messagesLimit = plan.messages_per_month || 0;
    const messagesUsed = usage?.messages_count || 0;
    const remaining = Math.max(0, messagesLimit - messagesUsed);

    // Check if limit exceeded (unless unlimited - 999999)
    if (messagesLimit < 999999 && messagesUsed >= messagesLimit) {
      return {
        allowed: false,
        remaining: 0,
        limit: messagesLimit,
        error: {
          type: "limit_exceeded",
          message: "You've reached your monthly AI usage limit.",
          details: "Upgrade your plan for more AI generations.",
          remainingUsage: 0,
          totalLimit: messagesLimit,
        },
      };
    }

    return { allowed: true, remaining, limit: messagesLimit };
  } catch (err) {
    console.error('Preflight check error:', err);
    // On error, allow request to proceed - edge function will do final check
    return { allowed: true };
  }
}

export const useAIJobContentGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const generatingRef = useRef(false); // Prevent parallel calls

  const generateContent = async (
    fieldType: "description" | "requirements" | "benefits" | "skills" | "salary" | "category",
    context: JobContext
  ): Promise<AIGeneratorResult> => {
    // Guard: Prevent parallel invocations
    if (generatingRef.current) {
      return {
        content: "",
        success: false,
        error: {
          type: "api_error",
          message: "AI is already generating content.",
          details: "Please wait for the current generation to complete.",
        },
      };
    }

    generatingRef.current = true;
    setIsGenerating(true);

    try {
      // ✅ STEP 1: Ensure session exists with retry logic
      let sessionData = await supabase.auth.getSession();
      let userId = sessionData.data.session?.user?.id;
      let accessToken = sessionData.data.session?.access_token;

      // If no session, try refreshing once
      if (!userId || !accessToken) {
        console.log('[AI Generator] Session missing, attempting refresh...');
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError || !refreshed.session?.user?.id) {
          console.error('[AI Generator] Session refresh failed:', refreshError);
          return {
            content: "",
            success: false,
            error: {
              type: "no_subscription",
              message: "Please log in to use AI features.",
              details: "Your session has expired. Please refresh the page and sign in again.",
            },
          };
        }
        
        userId = refreshed.session.user.id;
        accessToken = refreshed.session.access_token;
        console.log('[AI Generator] Session refreshed successfully for user:', userId);
      }

      // ✅ STEP 2: Preflight check - verify limits BEFORE calling edge function
      const preflight = await checkAIUsagePreflight();
      
      if (!preflight.allowed && preflight.error) {
        return {
          content: "",
          success: false,
          error: preflight.error,
        };
      }

      console.log('[AI Generator] Calling edge function for:', fieldType, 'user:', userId);

      // ✅ STEP 3: Call edge function with verified user_id
      const { data, error } = await supabase.functions.invoke("ai-career-chat", {
        body: {
          action: 'generate_job_content',
          fieldType,
          context,
          user_id: userId,
        },
        headers: { 
          Authorization: `Bearer ${accessToken}` 
        },
      });

      // If function returned non-2xx, Supabase gives FunctionsHttpError (generic message).
      // We parse the JSON body to show the REAL reason (no_subscription / limit_exceeded / etc.).
      if (error) {
        console.error("AI content generation error:", error);

        const parsed = await tryParseEdgeFunctionError(error);
        if (parsed?.error) {
          const errorType = (parsed.errorType as AIErrorType) || "unknown";
          return {
            content: "",
            success: false,
            error: {
              type: errorType,
              message: parsed.error,
              details: parsed.details,
              remainingUsage: parsed.remainingUsage,
              totalLimit: parsed.totalLimit,
            },
          };
        }

        const errorMessage = (error as any)?.message || "AI content generation failed";

        if (errorMessage.toLowerCase().includes("auth") || errorMessage.toLowerCase().includes("login")) {
          return {
            content: "",
            success: false,
            error: {
              type: "no_subscription",
              message: "Please log in to use AI features.",
              details: "Your session appears to be missing. Please sign in again and retry.",
            },
          };
        }

        if (errorMessage.includes("subscription") || errorMessage.includes("No active")) {
          return {
            content: "",
            success: false,
            error: {
              type: "no_subscription",
              message: "You need an active AI subscription to use this feature.",
              details: "Subscribe to unlock AI-powered job content generation.",
            },
          };
        }

        if (
          errorMessage.includes("limit") ||
          errorMessage.includes("exceeded") ||
          errorMessage.includes("quota")
        ) {
          return {
            content: "",
            success: false,
            error: {
              type: "limit_exceeded",
              message: "You've reached your monthly AI usage limit.",
              details: "Upgrade your plan for more AI generations.",
              totalLimit: 50, // updated when edge returns JSON, fallback only
            },
          };
        }

        return {
          content: "",
          success: false,
          error: {
            type: "api_error",
            message: "AI service temporarily unavailable.",
            details: "Please try again in a few moments.",
          },
        };
      }

      // Check for error in response data (some functions return 200 with {error})
      if (data?.error) {
        const errorType = (data.errorType as AIErrorType) || "unknown";
        return {
          content: "",
          success: false,
          error: {
            type: errorType,
            message: data.error,
            details: data.details,
            remainingUsage: data.remainingUsage,
            totalLimit: data.totalLimit,
          },
        };
      }

      if (data?.content) {
        const jobsAnalyzed = data.meta?.similarJobsAnalyzed || 0;
        const prevJobs = data.meta?.employerPreviousJobs || 0;

        let successMessage = `${fieldType.charAt(0).toUpperCase() + fieldType.slice(1)} generated!`;
        if (jobsAnalyzed > 0 || prevJobs > 0) {
          successMessage += ` (Based on ${jobsAnalyzed} similar jobs${prevJobs > 0 ? ` & ${prevJobs} your posts` : ""})`;
        }

        toast.success(successMessage);
        return {
          content: data.content,
          success: true,
          meta: data.meta,
        };
      }

      return {
        content: "",
        success: false,
        error: {
          type: "unknown",
          message: "Failed to generate content.",
          details: "Please try again.",
        },
      };
    } catch (err) {
      console.error("Unexpected error:", err);
      return {
        content: "",
        success: false,
        error: {
          type: "api_error",
          message: "Something went wrong.",
          details: "Please check your connection and try again.",
        },
      };
    } finally {
      generatingRef.current = false;
      setIsGenerating(false);
    }
  };

  const generateDescription = (context: JobContext) => generateContent("description", context);
  const generateRequirements = (context: JobContext) => generateContent("requirements", context);
  const generateBenefits = (context: JobContext) => generateContent("benefits", context);
  const generateSkills = (context: JobContext) => generateContent("skills", context);
  const generateSalary = (context: JobContext) => generateContent("salary", context);
  const generateCategory = (context: JobContext) => generateContent("category", context);

  return {
    isGenerating,
    generateDescription,
    generateRequirements,
    generateBenefits,
    generateSkills,
    generateSalary,
    generateCategory,
  };
};
