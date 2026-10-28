import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  description: string;
  secret?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event: string;
  payload: any;
  status: string;
  response_status: number | null;
  error_message: string | null;
  delivered_at: string | null;
  created_at: string;
}

export const useWebhookManager = () => {
  const queryClient = useQueryClient();

  const getApiKey = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { data: apiKeys } = await supabase
      .from("api_keys")
      .select("api_key")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1);

    if (!apiKeys || apiKeys.length === 0) {
      throw new Error("No active API key found. Please generate an API key first.");
    }

    return apiKeys[0].api_key;
  };

  const fetchWebhooks = useQuery({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const apiKey = await getApiKey();
      const { data, error } = await supabase.functions.invoke("webhook-register", {
        method: "GET",
        headers: {
          "X-Api-Key": apiKey,
        },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.message || "Failed to fetch webhooks");
      return data.data as WebhookEndpoint[];
    },
  });

  const registerWebhook = useMutation({
    mutationFn: async (webhookData: { url: string; events: string[]; description: string }) => {
      const apiKey = await getApiKey();
      const { data, error } = await supabase.functions.invoke("webhook-register", {
        method: "POST",
        headers: {
          "X-Api-Key": apiKey,
        },
        body: webhookData,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Failed to register webhook");
      return data.data as WebhookEndpoint;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook registered successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to register webhook");
    },
  });

  const deleteWebhook = useMutation({
    mutationFn: async (webhookId: string) => {
      const apiKey = await getApiKey();
      
      // Get the function URL with query parameter
      const { data: { session } } = await supabase.auth.getSession();
      const SUPABASE_URL = "https://jubwzelupbntbetpajqb.supabase.co";
      const functionUrl = `${SUPABASE_URL}/functions/v1/webhook-register?id=${webhookId}`;
      
      const response = await fetch(functionUrl, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session?.access_token}`,
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Failed to delete webhook");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success("Webhook deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete webhook");
    },
  });

  const testWebhook = useMutation({
    mutationFn: async (webhookId: string) => {
      const apiKey = await getApiKey();
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke("trigger-webhook", {
        headers: {
          "X-Api-Key": apiKey,
        },
        body: {
          event: "test.webhook",
          payload: {
            message: "This is a test webhook",
            timestamp: new Date().toISOString(),
            test: true,
          },
          user_id: user?.id,
          webhook_id: webhookId,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Failed to send test webhook");
      const result = data.results?.[0];
      if (!result) throw new Error("Webhook not found or inactive");
      if (!result.success) {
        throw new Error(result.error || `Delivery failed${result.status ? ` (HTTP ${result.status})` : ""}`);
      }
      return result;
    },
    onSuccess: (result: any) => {
      toast.success(`Test delivered — endpoint responded ${result.status}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send test webhook");
    },
    onSettled: (_d, _e, webhookId) => {
      queryClient.invalidateQueries({ queryKey: ["webhook-deliveries", webhookId] });
    },
  });

  const updateWebhook = useMutation({
    mutationFn: async (patch: { id: string; is_active?: boolean; url?: string; events?: string[]; description?: string }) => {
      const apiKey = await getApiKey();
      const { data, error } = await supabase.functions.invoke("webhook-register", {
        method: "PATCH",
        headers: { "X-Api-Key": apiKey },
        body: patch,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Failed to update webhook");
      return data.data as WebhookEndpoint;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["webhooks"] });
      toast.success(vars.is_active === undefined ? "Webhook updated" : vars.is_active ? "Webhook turned on" : "Webhook turned off");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to update webhook"),
  });

  return {
    webhooks: fetchWebhooks.data,
    isLoading: fetchWebhooks.isLoading,
    error: fetchWebhooks.error,
    registerWebhook,
    updateWebhook,
    deleteWebhook,
    testWebhook,
  };
};

export const useWebhookDeliveries = (webhookId: string | null) => {
  return useQuery({
    queryKey: ["webhook-deliveries", webhookId],
    queryFn: async () => {
      if (!webhookId) return [];
      
      const { data, error } = await supabase
        .from("webhook_deliveries")
        .select("*")
        .eq("webhook_id", webhookId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as WebhookDelivery[];
    },
    enabled: !!webhookId,
  });
};
