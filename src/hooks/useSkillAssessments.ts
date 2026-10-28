import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type {
  SkillCategory,
  SkillAssessment,
  AssessmentQuestion,
  UserAssessmentAttempt,
  UserCertificate,
  UserAnswer,
} from "@/types/assessment";

export const useSkillAssessments = () => {
  const queryClient = useQueryClient();

  // Fetch all categories
  const useCategories = () => {
    return useQuery({
      queryKey: ["skill-categories"],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("skill_categories")
          .select("*")
          .eq("is_active", true)
          .order("display_order");

        if (error) throw error;
        return data as SkillCategory[];
      },
    });
  };

  // Fetch assessments by category
  const useAssessmentsByCategory = (categoryId?: string) => {
    return useQuery({
      queryKey: ["skill-assessments", categoryId],
      queryFn: async () => {
        let query = supabase
          .from("skill_assessments")
          .select("*")
          .eq("is_active", true);

        if (categoryId) {
          query = query.eq("category_id", categoryId);
        }

        const { data, error } = await query.order("title");

        if (error) throw error;
        return data as SkillAssessment[];
      },
      enabled: !!categoryId || categoryId === undefined,
    });
  };

  // Fetch questions for an assessment
  const useAssessmentQuestions = (assessmentId?: string) => {
    return useQuery({
      queryKey: ["assessment-questions", assessmentId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("assessment_questions")
          .select("*")
          .eq("assessment_id", assessmentId!)
          .order("display_order");

        if (error) throw error;
        return data as AssessmentQuestion[];
      },
      enabled: !!assessmentId,
    });
  };

  // Fetch user's attempts
  const useUserAttempts = (userId?: string) => {
    return useQuery({
      queryKey: ["user-attempts", userId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("user_assessment_attempts")
          .select(`
            *,
            assessment:skill_assessments(*)
          `)
          .eq("user_id", userId!)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return data;
      },
      enabled: !!userId,
    });
  };

  // Fetch user's certificates
  const useUserCertificates = (userId?: string) => {
    return useQuery({
      queryKey: ["user-certificates", userId],
      queryFn: async () => {
        const { data, error } = await supabase
          .from("user_certificates")
          .select("*")
          .eq("user_id", userId!)
          .order("issued_at", { ascending: false });

        if (error) throw error;
        return data as UserCertificate[];
      },
      enabled: !!userId,
    });
  };

  // Start a new assessment attempt
  const startAssessment = useMutation({
    mutationFn: async ({
      assessmentId,
      userId,
      totalQuestions,
    }: {
      assessmentId: string;
      userId: string;
      totalQuestions: number;
    }) => {
      const { data, error } = await supabase
        .from("user_assessment_attempts")
        .insert({
          user_id: userId,
          assessment_id: assessmentId,
          total_questions: totalQuestions,
          status: "in_progress",
        })
        .select()
        .single();

        if (error) throw error;
        return data as unknown as UserAssessmentAttempt;
    },
    onSuccess: () => {
      toast.success("Assessment started successfully!");
      queryClient.invalidateQueries({ queryKey: ["user-attempts"] });
    },
    onError: () => {
      toast.error("Failed to start assessment");
    },
  });

  // Complete assessment and calculate score
  const completeAssessment = useMutation({
    mutationFn: async ({
      attemptId,
      answers,
      questions,
      timeTaken,
    }: {
      attemptId: string;
      answers: UserAnswer[];
      questions: AssessmentQuestion[];
      timeTaken: number;
    }) => {
      const correctAnswers = answers.filter((a) => a.is_correct).length;
      const score = Math.round((correctAnswers / questions.length) * 100);

      const { data, error } = await supabase
        .from("user_assessment_attempts")
        .update({
          completed_at: new Date().toISOString(),
          status: "completed",
          score,
          correct_answers: correctAnswers,
          time_taken_minutes: Math.round(timeTaken / 60),
          answers: answers as any,
        })
        .eq("id", attemptId)
        .select()
        .single();

        if (error) throw error;
        return data as unknown as UserAssessmentAttempt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-attempts"] });
    },
  });

  // Issue certificate
  const issueCertificate = useMutation({
    mutationFn: async ({
      userId,
      assessmentId,
      attemptId,
      skillName,
      score,
    }: {
      userId: string;
      assessmentId: string;
      attemptId: string;
      skillName: string;
      score: number;
    }) => {
      // Determine level based on score
      let level = "Beginner";
      if (score >= 86) level = "Expert";
      else if (score >= 66) level = "Advanced";
      else if (score >= 41) level = "Intermediate";

      // Generate certificate number
      const certNumber = `WFH-CERT-${new Date().getFullYear()}-${Math.floor(
        Math.random() * 999999
      )
        .toString()
        .padStart(6, "0")}`;

      const { data, error } = await supabase
        .from("user_certificates")
        .insert({
          user_id: userId,
          assessment_id: assessmentId,
          attempt_id: attemptId,
          certificate_number: certNumber,
          skill_name: skillName,
          score,
          level,
          verification_url: `/verify-certificate/${certNumber}`,
        })
        .select()
        .single();

      if (error) throw error;

      // Update attempt to mark certificate as issued
      await supabase
        .from("user_assessment_attempts")
        .update({ certificate_issued: true })
        .eq("id", attemptId);

      return data as UserCertificate;
    },
    onSuccess: () => {
      toast.success("Certificate issued successfully!");
      queryClient.invalidateQueries({ queryKey: ["user-certificates"] });
      queryClient.invalidateQueries({ queryKey: ["user-attempts"] });
    },
  });

  return {
    useCategories,
    useAssessmentsByCategory,
    useAssessmentQuestions,
    useUserAttempts,
    useUserCertificates,
    startAssessment,
    completeAssessment,
    issueCertificate,
  };
};
