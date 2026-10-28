export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          created_at: string
          id: string
          processed_at: string | null
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          processed_at?: string | null
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          processed_at?: string | null
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      active_payment_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          order_id: string
          provider_id: string
          session_data: Json
          session_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          order_id: string
          provider_id: string
          session_data?: Json
          session_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          order_id?: string
          provider_id?: string
          session_data?: Json
          session_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_activity_log: {
        Row: {
          action_type: string
          admin_user_id: string
          changes: Json | null
          id: string
          ip_address: string | null
          logged_at: string | null
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          admin_user_id: string
          changes?: Json | null
          id?: string
          ip_address?: string | null
          logged_at?: string | null
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          admin_user_id?: string
          changes?: Json | null
          id?: string
          ip_address?: string | null
          logged_at?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_audit_logs: {
        Row: {
          action: string
          action_type: string | null
          admin_email: string | null
          admin_name: string | null
          admin_user_id: string | null
          changes: Json | null
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          logged_at: string | null
          performed_at: string
          performed_by: string
          target_email: string | null
          target_id: string | null
          target_type: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          action_type?: string | null
          admin_email?: string | null
          admin_name?: string | null
          admin_user_id?: string | null
          changes?: Json | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          logged_at?: string | null
          performed_at?: string
          performed_by: string
          target_email?: string | null
          target_id?: string | null
          target_type?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          action_type?: string | null
          admin_email?: string | null
          admin_name?: string | null
          admin_user_id?: string | null
          changes?: Json | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          logged_at?: string | null
          performed_at?: string
          performed_by?: string
          target_email?: string | null
          target_id?: string | null
          target_type?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_audit_logs_archive: {
        Row: {
          action: string
          action_type: string | null
          admin_email: string | null
          admin_name: string | null
          admin_user_id: string | null
          archived_at: string | null
          changes: Json | null
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          logged_at: string | null
          performed_at: string
          performed_by: string
          target_email: string | null
          target_id: string | null
          target_type: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          action_type?: string | null
          admin_email?: string | null
          admin_name?: string | null
          admin_user_id?: string | null
          archived_at?: string | null
          changes?: Json | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          logged_at?: string | null
          performed_at?: string
          performed_by: string
          target_email?: string | null
          target_id?: string | null
          target_type?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          action_type?: string | null
          admin_email?: string | null
          admin_name?: string | null
          admin_user_id?: string | null
          archived_at?: string | null
          changes?: Json | null
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          logged_at?: string | null
          performed_at?: string
          performed_by?: string
          target_email?: string | null
          target_id?: string | null
          target_type?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_permissions: {
        Row: {
          created_at: string
          id: string
          permissions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permissions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permissions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_rate_limits: {
        Row: {
          action_type: string
          attempt_count: number | null
          created_at: string | null
          id: string
          updated_at: string | null
          user_id: string
          window_start: string | null
        }
        Insert: {
          action_type: string
          attempt_count?: number | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
          window_start?: string | null
        }
        Update: {
          action_type?: string
          attempt_count?: number | null
          created_at?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
          window_start?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          role: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      adzuna_insights_cache: {
        Row: {
          action: string
          cache_key: string
          category: string | null
          data: Json
          expires_at: string
          fetched_at: string
          keywords: string | null
          location: string | null
        }
        Insert: {
          action: string
          cache_key: string
          category?: string | null
          data: Json
          expires_at?: string
          fetched_at?: string
          keywords?: string | null
          location?: string | null
        }
        Update: {
          action?: string
          cache_key?: string
          category?: string | null
          data?: Json
          expires_at?: string
          fetched_at?: string
          keywords?: string | null
          location?: string | null
        }
        Relationships: []
      }
      ai_agent_action_log: {
        Row: {
          action: string
          created_at: string
          id: string
          payload: Json | null
          result: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          payload?: Json | null
          result?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          payload?: Json | null
          result?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_agent_health: {
        Row: {
          created_at: string
          error_category: string
          error_signature: string
          first_seen_at: string
          fix_attempts: number
          fix_strategy: string | null
          fix_successes: number
          id: string
          last_seen_at: string
          notes: string | null
          occurrence_count: number
          resolved: boolean
          resolved_at: string | null
          sample_payload: Json | null
          source: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_category: string
          error_signature: string
          first_seen_at?: string
          fix_attempts?: number
          fix_strategy?: string | null
          fix_successes?: number
          id?: string
          last_seen_at?: string
          notes?: string | null
          occurrence_count?: number
          resolved?: boolean
          resolved_at?: string | null
          sample_payload?: Json | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_category?: string
          error_signature?: string
          first_seen_at?: string
          fix_attempts?: number
          fix_strategy?: string | null
          fix_successes?: number
          id?: string
          last_seen_at?: string
          notes?: string | null
          occurrence_count?: number
          resolved?: boolean
          resolved_at?: string | null
          sample_payload?: Json | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ai_agent_memory: {
        Row: {
          category: string
          confidence: number
          created_at: string
          id: string
          key: string
          notes: string | null
          sample_size: number
          updated_at: string
          value: Json
        }
        Insert: {
          category: string
          confidence?: number
          created_at?: string
          id?: string
          key: string
          notes?: string | null
          sample_size?: number
          updated_at?: string
          value?: Json
        }
        Update: {
          category?: string
          confidence?: number
          created_at?: string
          id?: string
          key?: string
          notes?: string | null
          sample_size?: number
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      ai_agent_plans: {
        Row: {
          audience: string
          channel_mix: Json | null
          created_at: string
          executed_at: string | null
          expected_impact: string | null
          goal: string
          id: string
          message_themes: Json | null
          rationale: string | null
          results: Json | null
          run_id: string | null
          status: string
          target_segments: Json | null
          valid_until: string
        }
        Insert: {
          audience: string
          channel_mix?: Json | null
          created_at?: string
          executed_at?: string | null
          expected_impact?: string | null
          goal: string
          id?: string
          message_themes?: Json | null
          rationale?: string | null
          results?: Json | null
          run_id?: string | null
          status?: string
          target_segments?: Json | null
          valid_until?: string
        }
        Update: {
          audience?: string
          channel_mix?: Json | null
          created_at?: string
          executed_at?: string | null
          expected_impact?: string | null
          goal?: string
          id?: string
          message_themes?: Json | null
          rationale?: string | null
          results?: Json | null
          run_id?: string | null
          status?: string
          target_segments?: Json | null
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_plans_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_runs: {
        Row: {
          actions_taken: Json | null
          ai_model: string | null
          created_at: string
          diagnosis: Json | null
          duration_ms: number | null
          error_message: string | null
          errors_auto_fixed: number
          errors_found: Json | null
          finished_at: string | null
          fixes_applied: Json | null
          id: string
          markdown_report: string | null
          messages_failed: number
          messages_sent: number
          plan: Json | null
          run_type: string
          sense_summary: Json | null
          started_at: string
          status: string
          trigger_source: string | null
          users_targeted: number
        }
        Insert: {
          actions_taken?: Json | null
          ai_model?: string | null
          created_at?: string
          diagnosis?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          errors_auto_fixed?: number
          errors_found?: Json | null
          finished_at?: string | null
          fixes_applied?: Json | null
          id?: string
          markdown_report?: string | null
          messages_failed?: number
          messages_sent?: number
          plan?: Json | null
          run_type?: string
          sense_summary?: Json | null
          started_at?: string
          status?: string
          trigger_source?: string | null
          users_targeted?: number
        }
        Update: {
          actions_taken?: Json | null
          ai_model?: string | null
          created_at?: string
          diagnosis?: Json | null
          duration_ms?: number | null
          error_message?: string | null
          errors_auto_fixed?: number
          errors_found?: Json | null
          finished_at?: string | null
          fixes_applied?: Json | null
          id?: string
          markdown_report?: string | null
          messages_failed?: number
          messages_sent?: number
          plan?: Json | null
          run_type?: string
          sense_summary?: Json | null
          started_at?: string
          status?: string
          trigger_source?: string | null
          users_targeted?: number
        }
        Relationships: []
      }
      ai_business_profiles: {
        Row: {
          about_me: string | null
          avoid_topics: string | null
          business_description: string | null
          business_name: string | null
          business_type: string | null
          contact_info: string | null
          created_at: string
          enabled: boolean
          faqs: string | null
          language: string
          location: string | null
          owner_name: string | null
          owner_role: string | null
          pricing: string | null
          products_services: string | null
          reply_length: string
          reply_rules: string | null
          signature: string | null
          tone: string
          updated_at: string
          user_id: string
          website: string | null
          working_hours: string | null
        }
        Insert: {
          about_me?: string | null
          avoid_topics?: string | null
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          contact_info?: string | null
          created_at?: string
          enabled?: boolean
          faqs?: string | null
          language?: string
          location?: string | null
          owner_name?: string | null
          owner_role?: string | null
          pricing?: string | null
          products_services?: string | null
          reply_length?: string
          reply_rules?: string | null
          signature?: string | null
          tone?: string
          updated_at?: string
          user_id: string
          website?: string | null
          working_hours?: string | null
        }
        Update: {
          about_me?: string | null
          avoid_topics?: string | null
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          contact_info?: string | null
          created_at?: string
          enabled?: boolean
          faqs?: string | null
          language?: string
          location?: string | null
          owner_name?: string | null
          owner_role?: string | null
          pricing?: string | null
          products_services?: string | null
          reply_length?: string
          reply_rules?: string | null
          signature?: string | null
          tone?: string
          updated_at?: string
          user_id?: string
          website?: string | null
          working_hours?: string | null
        }
        Relationships: []
      }
      ai_chat_email_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          recipient_email: string
          status: string
          subject: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_email: string
          status?: string
          subject: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          recipient_email?: string
          status?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_chat_plans: {
        Row: {
          ai_image_generation_per_month: number | null
          ai_model_tier: string
          created_at: string | null
          display_order: number | null
          features: Json | null
          id: string
          image_analysis_per_month: number
          is_active: boolean | null
          messages_per_month: number
          name: string
          price_inr: number
          priority_support: boolean | null
          updated_at: string | null
          voice_input_per_month: number
          voice_playback_per_month: number
        }
        Insert: {
          ai_image_generation_per_month?: number | null
          ai_model_tier?: string
          created_at?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          image_analysis_per_month: number
          is_active?: boolean | null
          messages_per_month: number
          name: string
          price_inr?: number
          priority_support?: boolean | null
          updated_at?: string | null
          voice_input_per_month: number
          voice_playback_per_month: number
        }
        Update: {
          ai_image_generation_per_month?: number | null
          ai_model_tier?: string
          created_at?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          image_analysis_per_month?: number
          is_active?: boolean | null
          messages_per_month?: number
          name?: string
          price_inr?: number
          priority_support?: boolean | null
          updated_at?: string | null
          voice_input_per_month?: number
          voice_playback_per_month?: number
        }
        Relationships: []
      }
      ai_chat_subscriptions: {
        Row: {
          created_at: string | null
          ends_at: string
          id: string
          plan_id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_subscription_id: string | null
          starts_at: string
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          ends_at: string
          id?: string
          plan_id: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          ends_at?: string
          id?: string
          plan_id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          starts_at?: string
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_usage: {
        Row: {
          created_at: string | null
          date: string
          id: string
          image_analysis_count: number | null
          messages_count: number | null
          tokens_used: number | null
          updated_at: string | null
          user_id: string
          voice_input_count: number | null
          voice_playback_count: number | null
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          image_analysis_count?: number | null
          messages_count?: number | null
          tokens_used?: number | null
          updated_at?: string | null
          user_id: string
          voice_input_count?: number | null
          voice_playback_count?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          image_analysis_count?: number | null
          messages_count?: number | null
          tokens_used?: number | null
          updated_at?: string | null
          user_id?: string
          voice_input_count?: number | null
          voice_playback_count?: number | null
        }
        Relationships: []
      }
      ai_data_access_logs: {
        Row: {
          access_type: string
          ai_type: string
          created_at: string | null
          data_accessed: Json | null
          id: string
          matched_user_id: string | null
          matched_user_name: string | null
          matched_user_type: string | null
          request_metadata: Json | null
          response_time_ms: number | null
          user_identifier: string
        }
        Insert: {
          access_type: string
          ai_type: string
          created_at?: string | null
          data_accessed?: Json | null
          id?: string
          matched_user_id?: string | null
          matched_user_name?: string | null
          matched_user_type?: string | null
          request_metadata?: Json | null
          response_time_ms?: number | null
          user_identifier: string
        }
        Update: {
          access_type?: string
          ai_type?: string
          created_at?: string | null
          data_accessed?: Json | null
          id?: string
          matched_user_id?: string | null
          matched_user_name?: string | null
          matched_user_type?: string | null
          request_metadata?: Json | null
          response_time_ms?: number | null
          user_identifier?: string
        }
        Relationships: []
      }
      ai_engagement_experiments: {
        Row: {
          created_at: string
          ended_at: string | null
          hypothesis: string
          id: string
          metric: string
          result: Json | null
          started_at: string
          status: string
          updated_at: string
          variant_a: Json
          variant_b: Json
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          hypothesis: string
          id?: string
          metric: string
          result?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
          variant_a: Json
          variant_b: Json
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          hypothesis?: string
          id?: string
          metric?: string
          result?: Json | null
          started_at?: string
          status?: string
          updated_at?: string
          variant_a?: Json
          variant_b?: Json
        }
        Relationships: []
      }
      ai_generated_images: {
        Row: {
          cache_key: string
          created_at: string
          id: string
          prompt: string | null
          public_url: string
          storage_path: string
          style: string | null
          topic: string
          uses: number
        }
        Insert: {
          cache_key: string
          created_at?: string
          id?: string
          prompt?: string | null
          public_url: string
          storage_path: string
          style?: string | null
          topic: string
          uses?: number
        }
        Update: {
          cache_key?: string
          created_at?: string
          id?: string
          prompt?: string | null
          public_url?: string
          storage_path?: string
          style?: string | null
          topic?: string
          uses?: number
        }
        Relationships: []
      }
      ai_generated_tricks: {
        Row: {
          ai_model: string
          category: string
          content: string
          created_at: string
          generated_by: string | null
          helpful_count: number
          id: string
          language: string
          metadata: Json | null
          not_helpful_count: number
          status: string
          title: string
          updated_at: string
          views_count: number
        }
        Insert: {
          ai_model?: string
          category: string
          content: string
          created_at?: string
          generated_by?: string | null
          helpful_count?: number
          id?: string
          language?: string
          metadata?: Json | null
          not_helpful_count?: number
          status?: string
          title: string
          updated_at?: string
          views_count?: number
        }
        Update: {
          ai_model?: string
          category?: string
          content?: string
          created_at?: string
          generated_by?: string | null
          helpful_count?: number
          id?: string
          language?: string
          metadata?: Json | null
          not_helpful_count?: number
          status?: string
          title?: string
          updated_at?: string
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_tricks_generated_by_fkey"
            columns: ["generated_by"]
            isOneToOne: false
            referencedRelation: "ai_system_users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_growth_kpis: {
        Row: {
          app_opens: number
          channel: string
          clicked: number
          created_at: string
          date: string
          delivered: number
          id: string
          meta: Json | null
          opened: number
          sent: number
          subs_delta: number
          updated_at: string
        }
        Insert: {
          app_opens?: number
          channel: string
          clicked?: number
          created_at?: string
          date: string
          delivered?: number
          id?: string
          meta?: Json | null
          opened?: number
          sent?: number
          subs_delta?: number
          updated_at?: string
        }
        Update: {
          app_opens?: number
          channel?: string
          clicked?: number
          created_at?: string
          date?: string
          delivered?: number
          id?: string
          meta?: Json | null
          opened?: number
          sent?: number
          subs_delta?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_image_usage: {
        Row: {
          created_at: string
          id: string
          images_generated: number
          month_year: string
          monthly_limit: number
          subscription_plan: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          images_generated?: number
          month_year: string
          monthly_limit?: number
          subscription_plan?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          images_generated?: number
          month_year?: string
          monthly_limit?: number
          subscription_plan?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_live_task_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          phase: string
          progress: number | null
          run_id: string
          status: string
          step: string
          tool: string | null
          tool_label: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          phase?: string
          progress?: number | null
          run_id: string
          status?: string
          step?: string
          tool?: string | null
          tool_label?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          phase?: string
          progress?: number | null
          run_id?: string
          status?: string
          step?: string
          tool?: string | null
          tool_label?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_mail_context: {
        Row: {
          list_items: Json
          pending_draft: Json | null
          pool_items: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          list_items?: Json
          pending_draft?: Json | null
          pool_items?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          list_items?: Json
          pending_draft?: Json | null
          pool_items?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_outreach_log: {
        Row: {
          channel: string
          error_message: string | null
          id: string
          message_preview: string | null
          metadata: Json | null
          outreach_type: string
          sent_at: string
          success: boolean
          user_id: string
        }
        Insert: {
          channel: string
          error_message?: string | null
          id?: string
          message_preview?: string | null
          metadata?: Json | null
          outreach_type: string
          sent_at?: string
          success?: boolean
          user_id: string
        }
        Update: {
          channel?: string
          error_message?: string | null
          id?: string
          message_preview?: string | null
          metadata?: Json | null
          outreach_type?: string
          sent_at?: string
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      ai_platform_business_profiles: {
        Row: {
          about_me: string | null
          account_id: string
          avoid_topics: string | null
          business_description: string | null
          business_name: string | null
          business_type: string | null
          contact_info: string | null
          created_at: string
          enabled: boolean
          faqs: string | null
          id: string
          language: string
          location: string | null
          owner_name: string | null
          owner_role: string | null
          platform: string
          pricing: string | null
          products_services: string | null
          reply_length: string
          reply_rules: string | null
          signature: string | null
          tone: string
          updated_at: string
          user_id: string
          website: string | null
          working_hours: string | null
        }
        Insert: {
          about_me?: string | null
          account_id?: string
          avoid_topics?: string | null
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          contact_info?: string | null
          created_at?: string
          enabled?: boolean
          faqs?: string | null
          id?: string
          language?: string
          location?: string | null
          owner_name?: string | null
          owner_role?: string | null
          platform: string
          pricing?: string | null
          products_services?: string | null
          reply_length?: string
          reply_rules?: string | null
          signature?: string | null
          tone?: string
          updated_at?: string
          user_id: string
          website?: string | null
          working_hours?: string | null
        }
        Update: {
          about_me?: string | null
          account_id?: string
          avoid_topics?: string | null
          business_description?: string | null
          business_name?: string | null
          business_type?: string | null
          contact_info?: string | null
          created_at?: string
          enabled?: boolean
          faqs?: string | null
          id?: string
          language?: string
          location?: string | null
          owner_name?: string | null
          owner_role?: string | null
          platform?: string
          pricing?: string | null
          products_services?: string | null
          reply_length?: string
          reply_rules?: string | null
          signature?: string | null
          tone?: string
          updated_at?: string
          user_id?: string
          website?: string | null
          working_hours?: string | null
        }
        Relationships: []
      }
      ai_pricing_audit_log: {
        Row: {
          applied: boolean
          cost_inr: number | null
          created_at: string
          details: Json
          id: string
          item_id: string | null
          item_name: string | null
          margin_percent: number | null
          module: string
          new_price: number | null
          old_price: number | null
          price_kind: string
          profit_inr: number | null
          reason: string | null
          safe: boolean
          source: string
        }
        Insert: {
          applied?: boolean
          cost_inr?: number | null
          created_at?: string
          details?: Json
          id?: string
          item_id?: string | null
          item_name?: string | null
          margin_percent?: number | null
          module: string
          new_price?: number | null
          old_price?: number | null
          price_kind?: string
          profit_inr?: number | null
          reason?: string | null
          safe?: boolean
          source?: string
        }
        Update: {
          applied?: boolean
          cost_inr?: number | null
          created_at?: string
          details?: Json
          id?: string
          item_id?: string | null
          item_name?: string | null
          margin_percent?: number | null
          module?: string
          new_price?: number | null
          old_price?: number | null
          price_kind?: string
          profit_inr?: number | null
          reason?: string | null
          safe?: boolean
          source?: string
        }
        Relationships: []
      }
      ai_pricing_modules: {
        Row: {
          ai_enabled: boolean
          allow_edit_plans: boolean
          allow_new_plans: boolean
          allow_retire_plans: boolean
          anomaly_max_factor: number
          applied_free_cost_inr: number
          applied_free_units: number
          auto_apply: boolean
          cost_model: string
          created_at: string
          fixed_cost_inr: number
          free_offer_reason: string | null
          free_tier_enabled: boolean
          free_tier_max_cost_inr: number
          free_tier_units: number
          id: string
          internal_usage_caps: Json
          label: string
          last_cost_source: string | null
          last_error: string | null
          last_run_at: string | null
          last_source: string | null
          last_status: string | null
          max_change_percent: number
          max_new_plans_per_run: number
          max_plan_edits_per_run: number
          max_plan_retires_per_run: number
          min_margin_percent: number
          min_profit_inr: number
          module: string
          notes: string | null
          payment_fee_percent: number
          points_value_inr: number
          price_ceiling_inr: number
          price_floor_inr: number
          price_kind: string
          review_only: boolean
          tax_percent: number
          unit_cost_inr: number
          updated_at: string
          usage_assumptions: Json
        }
        Insert: {
          ai_enabled?: boolean
          allow_edit_plans?: boolean
          allow_new_plans?: boolean
          allow_retire_plans?: boolean
          anomaly_max_factor?: number
          applied_free_cost_inr?: number
          applied_free_units?: number
          auto_apply?: boolean
          cost_model?: string
          created_at?: string
          fixed_cost_inr?: number
          free_offer_reason?: string | null
          free_tier_enabled?: boolean
          free_tier_max_cost_inr?: number
          free_tier_units?: number
          id?: string
          internal_usage_caps?: Json
          label: string
          last_cost_source?: string | null
          last_error?: string | null
          last_run_at?: string | null
          last_source?: string | null
          last_status?: string | null
          max_change_percent?: number
          max_new_plans_per_run?: number
          max_plan_edits_per_run?: number
          max_plan_retires_per_run?: number
          min_margin_percent?: number
          min_profit_inr?: number
          module: string
          notes?: string | null
          payment_fee_percent?: number
          points_value_inr?: number
          price_ceiling_inr?: number
          price_floor_inr?: number
          price_kind?: string
          review_only?: boolean
          tax_percent?: number
          unit_cost_inr?: number
          updated_at?: string
          usage_assumptions?: Json
        }
        Update: {
          ai_enabled?: boolean
          allow_edit_plans?: boolean
          allow_new_plans?: boolean
          allow_retire_plans?: boolean
          anomaly_max_factor?: number
          applied_free_cost_inr?: number
          applied_free_units?: number
          auto_apply?: boolean
          cost_model?: string
          created_at?: string
          fixed_cost_inr?: number
          free_offer_reason?: string | null
          free_tier_enabled?: boolean
          free_tier_max_cost_inr?: number
          free_tier_units?: number
          id?: string
          internal_usage_caps?: Json
          label?: string
          last_cost_source?: string | null
          last_error?: string | null
          last_run_at?: string | null
          last_source?: string | null
          last_status?: string | null
          max_change_percent?: number
          max_new_plans_per_run?: number
          max_plan_edits_per_run?: number
          max_plan_retires_per_run?: number
          min_margin_percent?: number
          min_profit_inr?: number
          module?: string
          notes?: string | null
          payment_fee_percent?: number
          points_value_inr?: number
          price_ceiling_inr?: number
          price_floor_inr?: number
          price_kind?: string
          review_only?: boolean
          tax_percent?: number
          unit_cost_inr?: number
          updated_at?: string
          usage_assumptions?: Json
        }
        Relationships: []
      }
      ai_pricing_plan_proposals: {
        Row: {
          change_type: string
          cost_inr: number | null
          created_at: string
          created_item_id: string | null
          details: Json
          floor_inr: number | null
          id: string
          margin_percent: number | null
          module: string
          name: string
          payment_fee_percent: number | null
          price: number | null
          price_kind: string
          profit_inr: number | null
          proposal: Json
          reason: string | null
          status: string
          target_item_id: string | null
          tax_percent: number | null
        }
        Insert: {
          change_type?: string
          cost_inr?: number | null
          created_at?: string
          created_item_id?: string | null
          details?: Json
          floor_inr?: number | null
          id?: string
          margin_percent?: number | null
          module: string
          name: string
          payment_fee_percent?: number | null
          price?: number | null
          price_kind?: string
          profit_inr?: number | null
          proposal?: Json
          reason?: string | null
          status?: string
          target_item_id?: string | null
          tax_percent?: number | null
        }
        Update: {
          change_type?: string
          cost_inr?: number | null
          created_at?: string
          created_item_id?: string | null
          details?: Json
          floor_inr?: number | null
          id?: string
          margin_percent?: number | null
          module?: string
          name?: string
          payment_fee_percent?: number | null
          price?: number | null
          price_kind?: string
          profit_inr?: number | null
          proposal?: Json
          reason?: string | null
          status?: string
          target_item_id?: string | null
          tax_percent?: number | null
        }
        Relationships: []
      }
      ai_pricing_provider_rates: {
        Row: {
          created_at: string
          effective_from: string
          id: string
          is_active: boolean
          module: string
          notes: string | null
          provider: string
          rate_key: string
          service: string
          source_doc_date: string
          source_url: string
          unit: string
          unit_price_inr: number | null
          unit_price_usd: number | null
          updated_at: string
          usd_inr: number
        }
        Insert: {
          created_at?: string
          effective_from?: string
          id?: string
          is_active?: boolean
          module: string
          notes?: string | null
          provider: string
          rate_key: string
          service: string
          source_doc_date?: string
          source_url: string
          unit: string
          unit_price_inr?: number | null
          unit_price_usd?: number | null
          updated_at?: string
          usd_inr?: number
        }
        Update: {
          created_at?: string
          effective_from?: string
          id?: string
          is_active?: boolean
          module?: string
          notes?: string | null
          provider?: string
          rate_key?: string
          service?: string
          source_doc_date?: string
          source_url?: string
          unit?: string
          unit_price_inr?: number | null
          unit_price_usd?: number | null
          updated_at?: string
          usd_inr?: number
        }
        Relationships: []
      }
      ai_proactive_send_log: {
        Row: {
          channel: string
          created_at: string
          id: string
          language: string | null
          message_type: string
          metadata: Json | null
          preview: string | null
          reason: string | null
          sent_at: string
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          language?: string | null
          message_type: string
          metadata?: Json | null
          preview?: string | null
          reason?: string | null
          sent_at?: string
          status?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          language?: string | null
          message_type?: string
          metadata?: Json | null
          preview?: string | null
          reason?: string | null
          sent_at?: string
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      ai_proactive_user_state: {
        Row: {
          created_at: string
          detected_language: string | null
          id: string
          is_opted_out: boolean
          last_active_at: string | null
          last_any_message_at: string | null
          last_application_update_at: string | null
          last_birthday_at: string | null
          last_employer_candidates_ready_at: string | null
          last_employer_hot_candidate_at: string | null
          last_employer_job_expiring_at: string | null
          last_employer_low_wallet_at: string | null
          last_employer_new_applications_at: string | null
          last_employer_post_first_job_at: string | null
          last_employer_profile_complete_at: string | null
          last_employer_weekly_insights_at: string | null
          last_festival_greeting_at: string | null
          last_fraud_alert_at: string | null
          last_interview_tips_at: string | null
          last_job_match_at: string | null
          last_jobs_closing_soon_at: string | null
          last_profile_complete_at: string | null
          last_re_engagement_at: string | null
          last_skill_gap_at: string | null
          last_trending_skills_at: string | null
          last_weekly_digest_at: string | null
          opted_out_at: string | null
          preferred_channel: string | null
          tier_calculated_at: string | null
          total_sent_today: number
          total_sent_today_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          detected_language?: string | null
          id?: string
          is_opted_out?: boolean
          last_active_at?: string | null
          last_any_message_at?: string | null
          last_application_update_at?: string | null
          last_birthday_at?: string | null
          last_employer_candidates_ready_at?: string | null
          last_employer_hot_candidate_at?: string | null
          last_employer_job_expiring_at?: string | null
          last_employer_low_wallet_at?: string | null
          last_employer_new_applications_at?: string | null
          last_employer_post_first_job_at?: string | null
          last_employer_profile_complete_at?: string | null
          last_employer_weekly_insights_at?: string | null
          last_festival_greeting_at?: string | null
          last_fraud_alert_at?: string | null
          last_interview_tips_at?: string | null
          last_job_match_at?: string | null
          last_jobs_closing_soon_at?: string | null
          last_profile_complete_at?: string | null
          last_re_engagement_at?: string | null
          last_skill_gap_at?: string | null
          last_trending_skills_at?: string | null
          last_weekly_digest_at?: string | null
          opted_out_at?: string | null
          preferred_channel?: string | null
          tier_calculated_at?: string | null
          total_sent_today?: number
          total_sent_today_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          detected_language?: string | null
          id?: string
          is_opted_out?: boolean
          last_active_at?: string | null
          last_any_message_at?: string | null
          last_application_update_at?: string | null
          last_birthday_at?: string | null
          last_employer_candidates_ready_at?: string | null
          last_employer_hot_candidate_at?: string | null
          last_employer_job_expiring_at?: string | null
          last_employer_low_wallet_at?: string | null
          last_employer_new_applications_at?: string | null
          last_employer_post_first_job_at?: string | null
          last_employer_profile_complete_at?: string | null
          last_employer_weekly_insights_at?: string | null
          last_festival_greeting_at?: string | null
          last_fraud_alert_at?: string | null
          last_interview_tips_at?: string | null
          last_job_match_at?: string | null
          last_jobs_closing_soon_at?: string | null
          last_profile_complete_at?: string | null
          last_re_engagement_at?: string | null
          last_skill_gap_at?: string | null
          last_trending_skills_at?: string | null
          last_weekly_digest_at?: string | null
          opted_out_at?: string | null
          preferred_channel?: string | null
          tier_calculated_at?: string | null
          total_sent_today?: number
          total_sent_today_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_response_cache: {
        Row: {
          ai_response: string
          created_at: string | null
          hit_count: number | null
          id: string
          last_accessed_at: string | null
          message_hash: string
          original_message: string
          similarity_keywords: string[] | null
        }
        Insert: {
          ai_response: string
          created_at?: string | null
          hit_count?: number | null
          id?: string
          last_accessed_at?: string | null
          message_hash: string
          original_message: string
          similarity_keywords?: string[] | null
        }
        Update: {
          ai_response?: string
          created_at?: string | null
          hit_count?: number | null
          id?: string
          last_accessed_at?: string | null
          message_hash?: string
          original_message?: string
          similarity_keywords?: string[] | null
        }
        Relationships: []
      }
      ai_system_users: {
        Row: {
          api_key_hash: string | null
          capabilities: Json
          created_at: string
          email: string
          id: string
          last_active_at: string | null
          metadata: Json | null
          name: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          api_key_hash?: string | null
          capabilities?: Json
          created_at?: string
          email: string
          id?: string
          last_active_at?: string | null
          metadata?: Json | null
          name: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          api_key_hash?: string | null
          capabilities?: Json
          created_at?: string
          email?: string
          id?: string
          last_active_at?: string | null
          metadata?: Json | null
          name?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_task_status: {
        Row: {
          created_at: string
          details: Json
          error: string | null
          id: string
          lang: string | null
          message: string
          phase: string
          progress: number
          run_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          error?: string | null
          id?: string
          lang?: string | null
          message?: string
          phase?: string
          progress?: number
          run_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          error?: string | null
          id?: string
          lang?: string | null
          message?: string
          phase?: string
          progress?: number
          run_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      api_auto_topup_settings: {
        Row: {
          created_at: string
          enabled: boolean
          last_topup_at: string | null
          mandate_status: string
          razorpay_subscription_id: string | null
          razorpay_token_id: string | null
          threshold_calls: number
          topup_calls: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          last_topup_at?: string | null
          mandate_status?: string
          razorpay_subscription_id?: string | null
          razorpay_token_id?: string | null
          threshold_calls?: number
          topup_calls?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          last_topup_at?: string | null
          mandate_status?: string
          razorpay_subscription_id?: string | null
          razorpay_token_id?: string | null
          threshold_calls?: number
          topup_calls?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_call_purchases: {
        Row: {
          amount: number
          calls: number
          created_at: string
          id: string
          order_id: string | null
          payment_id: string
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          calls: number
          created_at?: string
          id?: string
          order_id?: string | null
          payment_id: string
          source?: string
          user_id: string
        }
        Update: {
          amount?: number
          calls?: number
          created_at?: string
          id?: string
          order_id?: string | null
          payment_id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      api_call_quota: {
        Row: {
          created_at: string
          monthly_limit: number
          period_start: string
          updated_at: string
          used: number
          user_id: string
        }
        Insert: {
          created_at?: string
          monthly_limit?: number
          period_start: string
          updated_at?: string
          used?: number
          user_id: string
        }
        Update: {
          created_at?: string
          monthly_limit?: number
          period_start?: string
          updated_at?: string
          used?: number
          user_id?: string
        }
        Relationships: []
      }
      api_health_checks: {
        Row: {
          checked_at: string
          endpoint: string
          error_message: string | null
          id: string
          is_healthy: boolean | null
          response_time_ms: number | null
          status_code: number | null
        }
        Insert: {
          checked_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          is_healthy?: boolean | null
          response_time_ms?: number | null
          status_code?: number | null
        }
        Update: {
          checked_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          is_healthy?: boolean | null
          response_time_ms?: number | null
          status_code?: number | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          api_key: string
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          key_name: string
          key_prefix: string
          last_used_at: string | null
          rate_limit_tier: string
          updated_at: string
          usage_count: number | null
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_name: string
          key_prefix: string
          last_used_at?: string | null
          rate_limit_tier?: string
          updated_at?: string
          usage_count?: number | null
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_name?: string
          key_prefix?: string
          last_used_at?: string | null
          rate_limit_tier?: string
          updated_at?: string
          usage_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          endpoint: string
          error_message: string | null
          id: string
          ip_address: string | null
          method: string
          request_params: Json | null
          response_size_bytes: number | null
          response_time_ms: number
          status_code: number
          sub_account_id: string | null
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          endpoint: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method: string
          request_params?: Json | null
          response_size_bytes?: number | null
          response_time_ms: number
          status_code: number
          sub_account_id?: string | null
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          endpoint?: string
          error_message?: string | null
          id?: string
          ip_address?: string | null
          method?: string
          request_params?: Json | null
          response_size_bytes?: number | null
          response_time_ms?: number
          status_code?: number
          sub_account_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_subscriptions: {
        Row: {
          activated_at: string | null
          amount: number
          created_at: string
          expires_at: string | null
          id: string
          interval: string
          payment_id: string | null
          payment_mode: string
          plan_id: string
          plan_name: string
          requests_per_hour: number
          status: string
          subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activated_at?: string | null
          amount: number
          created_at?: string
          expires_at?: string | null
          id?: string
          interval: string
          payment_id?: string | null
          payment_mode?: string
          plan_id: string
          plan_name: string
          requests_per_hour: number
          status?: string
          subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activated_at?: string | null
          amount?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          interval?: string
          payment_id?: string | null
          payment_mode?: string
          plan_id?: string
          plan_name?: string
          requests_per_hour?: number
          status?: string
          subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_download_tracking: {
        Row: {
          clicked_at: string | null
          clicked_from: string
          id: string
          ip_address: string | null
          platform: string
          user_agent: string | null
          user_id: string | null
          user_type: string
        }
        Insert: {
          clicked_at?: string | null
          clicked_from: string
          id?: string
          ip_address?: string | null
          platform: string
          user_agent?: string | null
          user_id?: string | null
          user_type: string
        }
        Update: {
          clicked_at?: string | null
          clicked_from?: string
          id?: string
          ip_address?: string | null
          platform?: string
          user_agent?: string | null
          user_id?: string | null
          user_type?: string
        }
        Relationships: []
      }
      app_review_helpful: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_review_helpful_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "app_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      app_review_replies: {
        Row: {
          created_at: string
          id: string
          reply_text: string
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reply_text: string
          review_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reply_text?: string
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "app_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      app_reviews: {
        Row: {
          categories: string[] | null
          created_at: string | null
          helpful_count: number | null
          id: string
          rating: number
          review_text: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          categories?: string[] | null
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          rating: number
          review_text?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          categories?: string[] | null
          created_at?: string | null
          helpful_count?: number | null
          id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          setting_key: string
          setting_value: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      app_user_connections: {
        Row: {
          account_email: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assessment_questions: {
        Row: {
          assessment_id: string
          correct_answer_index: number
          created_at: string
          difficulty: string
          display_order: number
          explanation: string | null
          id: string
          options: Json
          points: number
          question_text: string
          question_type: string
        }
        Insert: {
          assessment_id: string
          correct_answer_index: number
          created_at?: string
          difficulty?: string
          display_order?: number
          explanation?: string | null
          id?: string
          options?: Json
          points?: number
          question_text: string
          question_type?: string
        }
        Update: {
          assessment_id?: string
          correct_answer_index?: number
          created_at?: string
          difficulty?: string
          display_order?: number
          explanation?: string | null
          id?: string
          options?: Json
          points?: number
          question_text?: string
          question_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_questions_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "skill_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_cleanup_settings: {
        Row: {
          cleanup_aggressiveness: string | null
          created_at: string | null
          id: string
          is_enabled: boolean | null
          last_run_at: string | null
          metadata: Json | null
          next_run_at: string | null
          retention_days: number | null
          setting_key: string
          threshold_percentage: number | null
          updated_at: string | null
        }
        Insert: {
          cleanup_aggressiveness?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          last_run_at?: string | null
          metadata?: Json | null
          next_run_at?: string | null
          retention_days?: number | null
          setting_key: string
          threshold_percentage?: number | null
          updated_at?: string | null
        }
        Update: {
          cleanup_aggressiveness?: string | null
          created_at?: string | null
          id?: string
          is_enabled?: boolean | null
          last_run_at?: string | null
          metadata?: Json | null
          next_run_at?: string | null
          retention_days?: number | null
          setting_key?: string
          threshold_percentage?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      auto_scale_settings: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          setting_key: string
          setting_value: Json
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      behavioral_tracking: {
        Row: {
          avg_click_interval: number | null
          avg_typing_speed: number | null
          bot_reasons: string[] | null
          created_at: string
          id: string
          is_bot: boolean | null
          mouse_distance: number | null
          mouse_speed: number | null
          rage_clicks: number | null
          scroll_depth: number | null
          scroll_speed: number | null
          session_duration: number | null
          total_clicks: number | null
          total_keystrokes: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_click_interval?: number | null
          avg_typing_speed?: number | null
          bot_reasons?: string[] | null
          created_at?: string
          id?: string
          is_bot?: boolean | null
          mouse_distance?: number | null
          mouse_speed?: number | null
          rage_clicks?: number | null
          scroll_depth?: number | null
          scroll_speed?: number | null
          session_duration?: number | null
          total_clicks?: number | null
          total_keystrokes?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_click_interval?: number | null
          avg_typing_speed?: number | null
          bot_reasons?: string[] | null
          created_at?: string
          id?: string
          is_bot?: boolean | null
          mouse_distance?: number | null
          mouse_speed?: number | null
          rage_clicks?: number | null
          scroll_depth?: number | null
          scroll_speed?: number | null
          session_duration?: number | null
          total_clicks?: number | null
          total_keystrokes?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      bing_indexing_queue: {
        Row: {
          bing_api_response: Json | null
          bing_api_submitted: boolean | null
          bing_api_submitted_at: string | null
          bing_public_at: string | null
          bing_queued_at: string | null
          bing_scheduled_at: string | null
          bing_status: string | null
          bing_submitted_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          indexnow_response: Json | null
          indexnow_submitted: boolean | null
          indexnow_submitted_at: string | null
          is_bing_public: boolean | null
          job_id: string | null
          last_verified_at: string | null
          metadata: Json | null
          page_type: string | null
          priority: number | null
          retry_count: number | null
          source: string | null
          updated_at: string | null
          url: string
          verification_attempts: number | null
        }
        Insert: {
          bing_api_response?: Json | null
          bing_api_submitted?: boolean | null
          bing_api_submitted_at?: string | null
          bing_public_at?: string | null
          bing_queued_at?: string | null
          bing_scheduled_at?: string | null
          bing_status?: string | null
          bing_submitted_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          indexnow_response?: Json | null
          indexnow_submitted?: boolean | null
          indexnow_submitted_at?: string | null
          is_bing_public?: boolean | null
          job_id?: string | null
          last_verified_at?: string | null
          metadata?: Json | null
          page_type?: string | null
          priority?: number | null
          retry_count?: number | null
          source?: string | null
          updated_at?: string | null
          url: string
          verification_attempts?: number | null
        }
        Update: {
          bing_api_response?: Json | null
          bing_api_submitted?: boolean | null
          bing_api_submitted_at?: string | null
          bing_public_at?: string | null
          bing_queued_at?: string | null
          bing_scheduled_at?: string | null
          bing_status?: string | null
          bing_submitted_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          indexnow_response?: Json | null
          indexnow_submitted?: boolean | null
          indexnow_submitted_at?: string | null
          is_bing_public?: boolean | null
          job_id?: string | null
          last_verified_at?: string | null
          metadata?: Json | null
          page_type?: string | null
          priority?: number | null
          retry_count?: number | null
          source?: string | null
          updated_at?: string | null
          url?: string
          verification_attempts?: number | null
        }
        Relationships: []
      }
      blocked_accounts: {
        Row: {
          block_signals: Json | null
          canvas_fingerprint: string | null
          created_at: string | null
          device_id: string | null
          fingerprint_hash: string | null
          id: string
          is_active: boolean | null
          original_user_id: string
          reason: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          block_signals?: Json | null
          canvas_fingerprint?: string | null
          created_at?: string | null
          device_id?: string | null
          fingerprint_hash?: string | null
          id?: string
          is_active?: boolean | null
          original_user_id: string
          reason?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          block_signals?: Json | null
          canvas_fingerprint?: string | null
          created_at?: string | null
          device_id?: string | null
          fingerprint_hash?: string | null
          id?: string
          is_active?: boolean | null
          original_user_id?: string
          reason?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author: string | null
          category: string | null
          content: string | null
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          is_published: boolean
          published_at: string | null
          read_time: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          published_at?: string | null
          read_time?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          category?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean
          published_at?: string | null
          read_time?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      boost_packages: {
        Row: {
          boost_days: number
          boost_level: number
          created_at: string
          id: string
          is_active: boolean
          most_popular: boolean | null
          name: string
          price_inr: number
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          boost_days: number
          boost_level: number
          created_at?: string
          id?: string
          is_active?: boolean
          most_popular?: boolean | null
          name: string
          price_inr: number
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          boost_days?: number
          boost_level?: number
          created_at?: string
          id?: string
          is_active?: boolean
          most_popular?: boolean | null
          name?: string
          price_inr?: number
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      browser_login_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          ip: string | null
          last_used_at: string | null
          revoked_at: string | null
          token_hash: string
          updated_at: string
          user_agent: string | null
          user_id: string
          user_type: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
          user_type: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          ip?: string | null
          last_used_at?: string | null
          revoked_at?: string | null
          token_hash?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      cached_audio: {
        Row: {
          access_count: number | null
          audio_url: string
          created_at: string | null
          id: string
          last_accessed_at: string | null
          original_text: string
          text_hash: string
        }
        Insert: {
          access_count?: number | null
          audio_url: string
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          original_text: string
          text_hash: string
        }
        Update: {
          access_count?: number | null
          audio_url?: string
          created_at?: string | null
          id?: string
          last_accessed_at?: string | null
          original_text?: string
          text_hash?: string
        }
        Relationships: []
      }
      career_paths: {
        Row: {
          avg_salary_max: number
          avg_salary_min: number
          created_at: string
          description: string | null
          display_order: number | null
          growth_rate: string
          icon_name: string | null
          id: string
          is_active: boolean
          job_category: string | null
          key_skills: string[]
          popular_roles: string[]
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          avg_salary_max: number
          avg_salary_min: number
          created_at?: string
          description?: string | null
          display_order?: number | null
          growth_rate?: string
          icon_name?: string | null
          id?: string
          is_active?: boolean
          job_category?: string | null
          key_skills?: string[]
          popular_roles?: string[]
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          avg_salary_max?: number
          avg_salary_min?: number
          created_at?: string
          description?: string | null
          display_order?: number | null
          growth_rate?: string
          icon_name?: string | null
          id?: string
          is_active?: boolean
          job_category?: string | null
          key_skills?: string[]
          popular_roles?: string[]
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      career_planning_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          is_completed: boolean
          notes: string | null
          step_name: string
          step_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          notes?: string | null
          step_name: string
          step_number: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          is_completed?: boolean
          notes?: string | null
          step_name?: string
          step_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      certifications: {
        Row: {
          certification_name: string
          created_at: string
          credential_id: string | null
          credential_url: string | null
          description: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_organization: string
          updated_at: string
          user_id: string
        }
        Insert: {
          certification_name: string
          created_at?: string
          credential_id?: string | null
          credential_url?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization: string
          updated_at?: string
          user_id: string
        }
        Update: {
          certification_name?: string
          created_at?: string
          credential_id?: string | null
          credential_url?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          message_type: string
          metadata: Json | null
          sender_id: string
          sender_type: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          message_type?: string
          metadata?: Json | null
          sender_id: string
          sender_type: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          message_type?: string
          metadata?: Json | null
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_widget_conversations: {
        Row: {
          ai_paused: boolean
          created_at: string
          id: string
          last_message: string | null
          last_message_at: string
          page_url: string | null
          unread_count: number
          user_id: string
          visitor_token: string
          widget_id: string
        }
        Insert: {
          ai_paused?: boolean
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string
          page_url?: string | null
          unread_count?: number
          user_id: string
          visitor_token: string
          widget_id: string
        }
        Update: {
          ai_paused?: boolean
          created_at?: string
          id?: string
          last_message?: string | null
          last_message_at?: string
          page_url?: string | null
          unread_count?: number
          user_id?: string
          visitor_token?: string
          widget_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_widget_conversations_widget_id_fkey"
            columns: ["widget_id"]
            isOneToOne: false
            referencedRelation: "chat_widgets"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_widget_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          sender: string
          text: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          sender: string
          text: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          sender?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_widget_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_widget_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_widgets: {
        Row: {
          ai_enabled: boolean
          business_info: string
          color: string
          created_at: string
          id: string
          is_active: boolean
          position: string
          public_id: string
          title: string
          updated_at: string
          user_id: string
          welcome_message: string
        }
        Insert: {
          ai_enabled?: boolean
          business_info?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          position?: string
          public_id?: string
          title?: string
          updated_at?: string
          user_id: string
          welcome_message?: string
        }
        Update: {
          ai_enabled?: boolean
          business_info?: string
          color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          position?: string
          public_id?: string
          title?: string
          updated_at?: string
          user_id?: string
          welcome_message?: string
        }
        Relationships: []
      }
      cleanup_execution_logs: {
        Row: {
          cleanup_type: string | null
          error_message: string | null
          executed_at: string | null
          executed_by: string | null
          execution_time_ms: number | null
          id: string
          tables_cleaned: Json | null
          total_deleted: number | null
          triggered_by: string | null
        }
        Insert: {
          cleanup_type?: string | null
          error_message?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_time_ms?: number | null
          id?: string
          tables_cleaned?: Json | null
          total_deleted?: number | null
          triggered_by?: string | null
        }
        Update: {
          cleanup_type?: string | null
          error_message?: string | null
          executed_at?: string | null
          executed_by?: string | null
          execution_time_ms?: number | null
          id?: string
          tables_cleaned?: Json | null
          total_deleted?: number | null
          triggered_by?: string | null
        }
        Relationships: []
      }
      cleanup_logs: {
        Row: {
          cleanup_type: string
          executed_at: string | null
          execution_time_ms: number | null
          id: string
          items_deleted: Json
        }
        Insert: {
          cleanup_type: string
          executed_at?: string | null
          execution_time_ms?: number | null
          id?: string
          items_deleted?: Json
        }
        Update: {
          cleanup_type?: string
          executed_at?: string | null
          execution_time_ms?: number | null
          id?: string
          items_deleted?: Json
        }
        Relationships: []
      }
      cleanup_schedule_settings: {
        Row: {
          id: string
          is_enabled: boolean | null
          setting_key: string
          setting_value: Json | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          id?: string
          is_enabled?: boolean | null
          setting_key: string
          setting_value?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          id?: string
          is_enabled?: boolean | null
          setting_key?: string
          setting_value?: Json | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          account_status: string
          account_status_reason: string | null
          badge_color: string | null
          ban_type: string | null
          business_type: string | null
          cin_number: string | null
          city: string | null
          clients_description: string | null
          company_details: string | null
          company_name: string
          company_size: string | null
          core_values: string | null
          country: string | null
          created_at: string
          data_privacy_measures: string | null
          description: string | null
          differentiating_factors: string | null
          dispute_resolution: string | null
          district: string | null
          email: string | null
          facebook_link: string | null
          founder_bio: string | null
          founder_name: string | null
          free_trial_job_id: string | null
          free_trial_used: boolean | null
          gst_certificate: string | null
          gst_number: string | null
          hr_contact_name: string | null
          id: string
          incorporation_certificate: string | null
          incorporation_date: string | null
          industry: string | null
          instagram_link: string | null
          interview_contact_details: string | null
          is_profile_complete: boolean | null
          is_verified: boolean | null
          job_posting_ban_reason: string | null
          job_posting_visibility: boolean
          key_team_members: string | null
          last_interaction_at: string | null
          latitude: number | null
          legal_name: string | null
          linkedin_link: string | null
          location: string | null
          location_last_updated: string | null
          logo_url: string | null
          longitude: number | null
          mission: string | null
          msme_number: string | null
          onesignal_player_id: string | null
          organisation_size: string | null
          pan_number: string | null
          phone: string | null
          postal_code: string | null
          precise_address: string | null
          pricing_plans: string | null
          profile_ban_reason: string | null
          profile_views_count: number | null
          rbi_compliance: string | null
          refund_policy: string | null
          registered_address: string | null
          services_description: string | null
          short_id: string | null
          slug: string | null
          state: string | null
          support_email: string | null
          telegram_chat_id: number | null
          telegram_connect_code: string | null
          telegram_connected_at: string | null
          telegram_id: number | null
          telegram_notifications_enabled: boolean | null
          telegram_username: string | null
          testimonials: string | null
          total_views: number | null
          trending_score: number | null
          updated_at: string
          user_id: string
          verified_plan_end: string | null
          verified_plan_start: string | null
          vision: string | null
          website: string | null
          whatsapp_number: string | null
          whatsapp_verified: boolean | null
          youtube_link: string | null
        }
        Insert: {
          account_status?: string
          account_status_reason?: string | null
          badge_color?: string | null
          ban_type?: string | null
          business_type?: string | null
          cin_number?: string | null
          city?: string | null
          clients_description?: string | null
          company_details?: string | null
          company_name: string
          company_size?: string | null
          core_values?: string | null
          country?: string | null
          created_at?: string
          data_privacy_measures?: string | null
          description?: string | null
          differentiating_factors?: string | null
          dispute_resolution?: string | null
          district?: string | null
          email?: string | null
          facebook_link?: string | null
          founder_bio?: string | null
          founder_name?: string | null
          free_trial_job_id?: string | null
          free_trial_used?: boolean | null
          gst_certificate?: string | null
          gst_number?: string | null
          hr_contact_name?: string | null
          id?: string
          incorporation_certificate?: string | null
          incorporation_date?: string | null
          industry?: string | null
          instagram_link?: string | null
          interview_contact_details?: string | null
          is_profile_complete?: boolean | null
          is_verified?: boolean | null
          job_posting_ban_reason?: string | null
          job_posting_visibility?: boolean
          key_team_members?: string | null
          last_interaction_at?: string | null
          latitude?: number | null
          legal_name?: string | null
          linkedin_link?: string | null
          location?: string | null
          location_last_updated?: string | null
          logo_url?: string | null
          longitude?: number | null
          mission?: string | null
          msme_number?: string | null
          onesignal_player_id?: string | null
          organisation_size?: string | null
          pan_number?: string | null
          phone?: string | null
          postal_code?: string | null
          precise_address?: string | null
          pricing_plans?: string | null
          profile_ban_reason?: string | null
          profile_views_count?: number | null
          rbi_compliance?: string | null
          refund_policy?: string | null
          registered_address?: string | null
          services_description?: string | null
          short_id?: string | null
          slug?: string | null
          state?: string | null
          support_email?: string | null
          telegram_chat_id?: number | null
          telegram_connect_code?: string | null
          telegram_connected_at?: string | null
          telegram_id?: number | null
          telegram_notifications_enabled?: boolean | null
          telegram_username?: string | null
          testimonials?: string | null
          total_views?: number | null
          trending_score?: number | null
          updated_at?: string
          user_id: string
          verified_plan_end?: string | null
          verified_plan_start?: string | null
          vision?: string | null
          website?: string | null
          whatsapp_number?: string | null
          whatsapp_verified?: boolean | null
          youtube_link?: string | null
        }
        Update: {
          account_status?: string
          account_status_reason?: string | null
          badge_color?: string | null
          ban_type?: string | null
          business_type?: string | null
          cin_number?: string | null
          city?: string | null
          clients_description?: string | null
          company_details?: string | null
          company_name?: string
          company_size?: string | null
          core_values?: string | null
          country?: string | null
          created_at?: string
          data_privacy_measures?: string | null
          description?: string | null
          differentiating_factors?: string | null
          dispute_resolution?: string | null
          district?: string | null
          email?: string | null
          facebook_link?: string | null
          founder_bio?: string | null
          founder_name?: string | null
          free_trial_job_id?: string | null
          free_trial_used?: boolean | null
          gst_certificate?: string | null
          gst_number?: string | null
          hr_contact_name?: string | null
          id?: string
          incorporation_certificate?: string | null
          incorporation_date?: string | null
          industry?: string | null
          instagram_link?: string | null
          interview_contact_details?: string | null
          is_profile_complete?: boolean | null
          is_verified?: boolean | null
          job_posting_ban_reason?: string | null
          job_posting_visibility?: boolean
          key_team_members?: string | null
          last_interaction_at?: string | null
          latitude?: number | null
          legal_name?: string | null
          linkedin_link?: string | null
          location?: string | null
          location_last_updated?: string | null
          logo_url?: string | null
          longitude?: number | null
          mission?: string | null
          msme_number?: string | null
          onesignal_player_id?: string | null
          organisation_size?: string | null
          pan_number?: string | null
          phone?: string | null
          postal_code?: string | null
          precise_address?: string | null
          pricing_plans?: string | null
          profile_ban_reason?: string | null
          profile_views_count?: number | null
          rbi_compliance?: string | null
          refund_policy?: string | null
          registered_address?: string | null
          services_description?: string | null
          short_id?: string | null
          slug?: string | null
          state?: string | null
          support_email?: string | null
          telegram_chat_id?: number | null
          telegram_connect_code?: string | null
          telegram_connected_at?: string | null
          telegram_id?: number | null
          telegram_notifications_enabled?: boolean | null
          telegram_username?: string | null
          testimonials?: string | null
          total_views?: number | null
          trending_score?: number | null
          updated_at?: string
          user_id?: string
          verified_plan_end?: string | null
          verified_plan_start?: string | null
          vision?: string | null
          website?: string | null
          whatsapp_number?: string | null
          whatsapp_verified?: boolean | null
          youtube_link?: string | null
        }
        Relationships: []
      }
      company_audit_logs: {
        Row: {
          action: string
          admin_id: string
          company_id: string
          created_at: string
          id: string
          new_status: string | null
          old_status: string | null
          reason: string | null
        }
        Insert: {
          action: string
          admin_id: string
          company_id: string
          created_at?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          reason?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          company_id?: string
          created_at?: string
          id?: string
          new_status?: string | null
          old_status?: string | null
          reason?: string | null
        }
        Relationships: []
      }
      company_favorites: {
        Row: {
          company_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      company_interactions: {
        Row: {
          company_id: string
          created_at: string
          id: string
          interaction_type: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          interaction_type: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          interaction_type?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      company_reviews: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_verified: boolean | null
          rating: number
          review_text: string | null
          reviewer_name: string | null
          reviewer_position: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_verified?: boolean | null
          rating: number
          review_text?: string | null
          reviewer_name?: string | null
          reviewer_position?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_verified?: boolean | null
          rating?: number
          review_text?: string | null
          reviewer_name?: string | null
          reviewer_position?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      company_statistics: {
        Row: {
          client_satisfaction_rating: number | null
          company_id: string
          created_at: string
          id: string
          total_clients_served: number | null
          total_employees: number | null
          total_projects_completed: number | null
          updated_at: string
          years_in_business: number | null
        }
        Insert: {
          client_satisfaction_rating?: number | null
          company_id: string
          created_at?: string
          id?: string
          total_clients_served?: number | null
          total_employees?: number | null
          total_projects_completed?: number | null
          updated_at?: string
          years_in_business?: number | null
        }
        Update: {
          client_satisfaction_rating?: number | null
          company_id?: string
          created_at?: string
          id?: string
          total_clients_served?: number | null
          total_employees?: number | null
          total_projects_completed?: number | null
          updated_at?: string
          years_in_business?: number | null
        }
        Relationships: []
      }
      competition_prize_payments: {
        Row: {
          created_at: string
          credited_at: string | null
          cycle_id: string
          error_message: string | null
          id: string
          metadata: Json | null
          prize_amount: number
          rank: number
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credited_at?: string | null
          cycle_id: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          prize_amount: number
          rank: number
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credited_at?: string | null
          cycle_id?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          prize_amount?: number
          rank?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      contact_information: {
        Row: {
          additional_info: Json | null
          address: string
          created_at: string
          email: string
          id: string
          info_type: string
          is_active: boolean
          phone: string
          updated_at: string
        }
        Insert: {
          additional_info?: Json | null
          address: string
          created_at?: string
          email: string
          id?: string
          info_type: string
          is_active?: boolean
          phone: string
          updated_at?: string
        }
        Update: {
          additional_info?: Json | null
          address?: string
          created_at?: string
          email?: string
          id?: string
          info_type?: string
          is_active?: boolean
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          applicant_id: string
          created_at: string
          employer_id: string
          id: string
          job_id: string
          last_message_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          employer_id: string
          id?: string
          job_id: string
          last_message_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          employer_id?: string
          id?: string
          job_id?: string
          last_message_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      cover_letter_drafts: {
        Row: {
          created_at: string
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      custom_roles: {
        Row: {
          created_at: string
          created_by: string
          id: string
          permissions: Json
          role_description: string | null
          role_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          permissions?: Json
          role_description?: string | null
          role_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          permissions?: Json
          role_description?: string | null
          role_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      daily_unique_visitors: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          first_seen: string | null
          id: string
          last_seen: string | null
          latitude: number | null
          longitude: number | null
          state: string | null
          user_fingerprint: string
          user_id: string | null
          visit_count: number | null
          visit_date: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          latitude?: number | null
          longitude?: number | null
          state?: string | null
          user_fingerprint: string
          user_id?: string | null
          visit_count?: number | null
          visit_date?: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          first_seen?: string | null
          id?: string
          last_seen?: string | null
          latitude?: number | null
          longitude?: number | null
          state?: string | null
          user_fingerprint?: string
          user_id?: string | null
          visit_count?: number | null
          visit_date?: string
        }
        Relationships: []
      }
      developer_chat_widgets: {
        Row: {
          created_at: string
          failed_attempts: number
          id: string
          locked_until: string | null
          pin_hash: string | null
          updated_at: string
          user_id: string
          widget_id: string
        }
        Insert: {
          created_at?: string
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          pin_hash?: string | null
          updated_at?: string
          user_id: string
          widget_id: string
        }
        Update: {
          created_at?: string
          failed_attempts?: number
          id?: string
          locked_until?: string | null
          pin_hash?: string | null
          updated_at?: string
          user_id?: string
          widget_id?: string
        }
        Relationships: []
      }
      developer_connect_sessions: {
        Row: {
          channel: string
          created_at: string
          expires_at: string
          id: string
          return_url: string
          sub_account_id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          channel?: string
          created_at?: string
          expires_at: string
          id?: string
          return_url: string
          sub_account_id: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          expires_at?: string
          id?: string
          return_url?: string
          sub_account_id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "developer_connect_sessions_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "developer_sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_oauth_apps: {
        Row: {
          client_id: string
          client_name: string
          client_type: string
          created_at: string
          id: string
          redirect_uris: string[]
          user_id: string
        }
        Insert: {
          client_id: string
          client_name: string
          client_type?: string
          created_at?: string
          id?: string
          redirect_uris?: string[]
          user_id: string
        }
        Update: {
          client_id?: string
          client_name?: string
          client_type?: string
          created_at?: string
          id?: string
          redirect_uris?: string[]
          user_id?: string
        }
        Relationships: []
      }
      developer_partner_profiles: {
        Row: {
          brand_name: string
          created_at: string
          id: string
          logo_url: string | null
          status: string
          support_email: string | null
          tagline: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          brand_name: string
          created_at?: string
          id?: string
          logo_url?: string | null
          status?: string
          support_email?: string | null
          tagline?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          brand_name?: string
          created_at?: string
          id?: string
          logo_url?: string | null
          status?: string
          support_email?: string | null
          tagline?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      developer_profiles: {
        Row: {
          avatar_url: string
          created_at: string
          description: string
          full_name: string
          id: string
          is_profile_complete: boolean
          organization: string
          phone: string
          updated_at: string
          use_case: string
          user_id: string
          website: string
        }
        Insert: {
          avatar_url?: string
          created_at?: string
          description?: string
          full_name?: string
          id?: string
          is_profile_complete?: boolean
          organization?: string
          phone?: string
          updated_at?: string
          use_case?: string
          user_id: string
          website?: string
        }
        Update: {
          avatar_url?: string
          created_at?: string
          description?: string
          full_name?: string
          id?: string
          is_profile_complete?: boolean
          organization?: string
          phone?: string
          updated_at?: string
          use_case?: string
          user_id?: string
          website?: string
        }
        Relationships: []
      }
      developer_sub_account_numbers: {
        Row: {
          business_name: string | null
          connected_at: string
          developer_user_id: string
          display_phone: string | null
          id: string
          messaging_tier: string | null
          meta_blocked: boolean
          meta_status: string | null
          phone_number_id: string
          quality_rating: string | null
          status: string
          sub_account_id: string
          updated_at: string
          verified_name: string | null
          waba_id: string
        }
        Insert: {
          business_name?: string | null
          connected_at?: string
          developer_user_id: string
          display_phone?: string | null
          id?: string
          messaging_tier?: string | null
          meta_blocked?: boolean
          meta_status?: string | null
          phone_number_id: string
          quality_rating?: string | null
          status?: string
          sub_account_id: string
          updated_at?: string
          verified_name?: string | null
          waba_id: string
        }
        Update: {
          business_name?: string | null
          connected_at?: string
          developer_user_id?: string
          display_phone?: string | null
          id?: string
          messaging_tier?: string | null
          meta_blocked?: boolean
          meta_status?: string | null
          phone_number_id?: string
          quality_rating?: string | null
          status?: string
          sub_account_id?: string
          updated_at?: string
          verified_name?: string | null
          waba_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_sub_account_numbers_sub_account_id_fkey"
            columns: ["sub_account_id"]
            isOneToOne: false
            referencedRelation: "developer_sub_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      developer_sub_account_tokens: {
        Row: {
          access_token: string
          expires_at: string | null
          phone_number_id: string
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          expires_at?: string | null
          phone_number_id: string
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          expires_at?: string | null
          phone_number_id?: string
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "developer_sub_account_tokens_phone_number_id_fkey"
            columns: ["phone_number_id"]
            isOneToOne: true
            referencedRelation: "developer_sub_account_numbers"
            referencedColumns: ["phone_number_id"]
          },
        ]
      }
      developer_sub_accounts: {
        Row: {
          created_at: string
          developer_user_id: string
          external_id: string
          id: string
          name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          developer_user_id: string
          external_id: string
          id?: string
          name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          developer_user_id?: string
          external_id?: string
          id?: string
          name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_info_logs: {
        Row: {
          ad_blocker_detected: boolean | null
          audio_fingerprint: string | null
          battery_charging: boolean | null
          battery_level: number | null
          bot_reasons: string[] | null
          browser_name: string | null
          browser_version: string | null
          canvas_fingerprint: string | null
          city: string | null
          color_depth: number | null
          cookies_enabled: boolean | null
          country: string | null
          created_at: string
          device_id: string | null
          device_memory: string | null
          device_type: string | null
          do_not_track: string | null
          downlink_speed: string | null
          fingerprint_hash: string | null
          focus_blur_count: number | null
          gps_accuracy: number | null
          gps_latitude: number | null
          gps_longitude: number | null
          hardware_concurrency: string | null
          id: string
          incognito_detected: boolean | null
          is_bot: boolean | null
          isp: string | null
          language: string | null
          latency_ms: string | null
          max_touch_points: number | null
          mouse_distance: number | null
          mouse_speed: number | null
          network_type: string | null
          operating_system: string | null
          orientation_changes: number | null
          pixel_ratio: number | null
          platform: string | null
          public_ip: string | null
          rage_clicks: number | null
          screen_resolution: string | null
          scroll_depth: number | null
          session_duration: number | null
          state: string | null
          timezone: string | null
          total_clicks: number | null
          typing_speed: number | null
          updated_at: string
          user_id: string
          user_type: string | null
          viewport_size: string | null
          vpn_detected: boolean | null
          webgl_renderer: string | null
          webgl_vendor: string | null
          webgl_version: string | null
          webrtc_leak_detected: boolean | null
          webrtc_local_ips: string | null
          webrtc_public_ips: string | null
        }
        Insert: {
          ad_blocker_detected?: boolean | null
          audio_fingerprint?: string | null
          battery_charging?: boolean | null
          battery_level?: number | null
          bot_reasons?: string[] | null
          browser_name?: string | null
          browser_version?: string | null
          canvas_fingerprint?: string | null
          city?: string | null
          color_depth?: number | null
          cookies_enabled?: boolean | null
          country?: string | null
          created_at?: string
          device_id?: string | null
          device_memory?: string | null
          device_type?: string | null
          do_not_track?: string | null
          downlink_speed?: string | null
          fingerprint_hash?: string | null
          focus_blur_count?: number | null
          gps_accuracy?: number | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          hardware_concurrency?: string | null
          id?: string
          incognito_detected?: boolean | null
          is_bot?: boolean | null
          isp?: string | null
          language?: string | null
          latency_ms?: string | null
          max_touch_points?: number | null
          mouse_distance?: number | null
          mouse_speed?: number | null
          network_type?: string | null
          operating_system?: string | null
          orientation_changes?: number | null
          pixel_ratio?: number | null
          platform?: string | null
          public_ip?: string | null
          rage_clicks?: number | null
          screen_resolution?: string | null
          scroll_depth?: number | null
          session_duration?: number | null
          state?: string | null
          timezone?: string | null
          total_clicks?: number | null
          typing_speed?: number | null
          updated_at?: string
          user_id: string
          user_type?: string | null
          viewport_size?: string | null
          vpn_detected?: boolean | null
          webgl_renderer?: string | null
          webgl_vendor?: string | null
          webgl_version?: string | null
          webrtc_leak_detected?: boolean | null
          webrtc_local_ips?: string | null
          webrtc_public_ips?: string | null
        }
        Update: {
          ad_blocker_detected?: boolean | null
          audio_fingerprint?: string | null
          battery_charging?: boolean | null
          battery_level?: number | null
          bot_reasons?: string[] | null
          browser_name?: string | null
          browser_version?: string | null
          canvas_fingerprint?: string | null
          city?: string | null
          color_depth?: number | null
          cookies_enabled?: boolean | null
          country?: string | null
          created_at?: string
          device_id?: string | null
          device_memory?: string | null
          device_type?: string | null
          do_not_track?: string | null
          downlink_speed?: string | null
          fingerprint_hash?: string | null
          focus_blur_count?: number | null
          gps_accuracy?: number | null
          gps_latitude?: number | null
          gps_longitude?: number | null
          hardware_concurrency?: string | null
          id?: string
          incognito_detected?: boolean | null
          is_bot?: boolean | null
          isp?: string | null
          language?: string | null
          latency_ms?: string | null
          max_touch_points?: number | null
          mouse_distance?: number | null
          mouse_speed?: number | null
          network_type?: string | null
          operating_system?: string | null
          orientation_changes?: number | null
          pixel_ratio?: number | null
          platform?: string | null
          public_ip?: string | null
          rage_clicks?: number | null
          screen_resolution?: string | null
          scroll_depth?: number | null
          session_duration?: number | null
          state?: string | null
          timezone?: string | null
          total_clicks?: number | null
          typing_speed?: number | null
          updated_at?: string
          user_id?: string
          user_type?: string | null
          viewport_size?: string | null
          vpn_detected?: boolean | null
          webgl_renderer?: string | null
          webgl_vendor?: string | null
          webgl_version?: string | null
          webrtc_leak_detected?: boolean | null
          webrtc_local_ips?: string | null
          webrtc_public_ips?: string | null
        }
        Relationships: []
      }
      domain_cron_auth: {
        Row: {
          created_at: string
          id: boolean
          token: string
        }
        Insert: {
          created_at?: string
          id?: boolean
          token?: string
        }
        Update: {
          created_at?: string
          id?: boolean
          token?: string
        }
        Relationships: []
      }
      domain_fx_rates: {
        Row: {
          base_currency: string
          created_at: string
          id: string
          quote_currency: string
          rate: number
          rate_day: string
          source: string
        }
        Insert: {
          base_currency?: string
          created_at?: string
          id?: string
          quote_currency?: string
          rate: number
          rate_day: string
          source?: string
        }
        Update: {
          base_currency?: string
          created_at?: string
          id?: string
          quote_currency?: string
          rate?: number
          rate_day?: string
          source?: string
        }
        Relationships: []
      }
      domain_job_state: {
        Row: {
          consecutive_failures: number
          created_at: string
          is_paused: boolean
          job_name: string
          last_error: string | null
          last_run_at: string | null
          last_success_at: string | null
          lease_until: string | null
          pause_reason: string | null
          updated_at: string
        }
        Insert: {
          consecutive_failures?: number
          created_at?: string
          is_paused?: boolean
          job_name: string
          last_error?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          lease_until?: string | null
          pause_reason?: string | null
          updated_at?: string
        }
        Update: {
          consecutive_failures?: number
          created_at?: string
          is_paused?: boolean
          job_name?: string
          last_error?: string | null
          last_run_at?: string | null
          last_success_at?: string | null
          lease_until?: string | null
          pause_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      domain_offers: {
        Row: {
          available: boolean
          created_at: string
          currency: string
          customer_price: number
          customer_reference_price: number | null
          customer_renewal_price: number | null
          domain: string
          exchange_rate: number | null
          expires_at: string
          id: string
          is_supplier_promo: boolean
          offer_day: string
          rank_score: number
          source_keyword: string | null
          supplier_cost_usd: number | null
          supplier_list_usd: number | null
          supplier_renewal_usd: number | null
          tld: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          currency?: string
          customer_price: number
          customer_reference_price?: number | null
          customer_renewal_price?: number | null
          domain: string
          exchange_rate?: number | null
          expires_at?: string
          id?: string
          is_supplier_promo?: boolean
          offer_day?: string
          rank_score?: number
          source_keyword?: string | null
          supplier_cost_usd?: number | null
          supplier_list_usd?: number | null
          supplier_renewal_usd?: number | null
          tld: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          currency?: string
          customer_price?: number
          customer_reference_price?: number | null
          customer_renewal_price?: number | null
          domain?: string
          exchange_rate?: number | null
          expires_at?: string
          id?: string
          is_supplier_promo?: boolean
          offer_day?: string
          rank_score?: number
          source_keyword?: string | null
          supplier_cost_usd?: number | null
          supplier_list_usd?: number | null
          supplier_renewal_usd?: number | null
          tld?: string
          updated_at?: string
        }
        Relationships: []
      }
      domain_orders: {
        Row: {
          agreements_accepted: Json | null
          agreements_accepted_at: string | null
          contact: Json | null
          created_at: string
          currency: string
          customer_price: number
          domain: string
          exchange_rate: number | null
          expires_at: string | null
          id: string
          markup_type: string | null
          markup_value: number | null
          payment_amount: number | null
          payment_id: string | null
          payment_order_id: string | null
          payment_provider: string
          period: number
          privacy: boolean
          profit: number | null
          provider: string
          provider_operation_id: string | null
          provider_order_id: string | null
          quote_expires_at: string | null
          quote_token: string | null
          registration_status: string | null
          renewal_price: number | null
          renewal_reminders_enabled: boolean
          status: string
          status_reason: string | null
          supplier_cost: number | null
          supplier_currency: string
          supplier_pricing_mode: string
          tax_amount: number
          tld: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agreements_accepted?: Json | null
          agreements_accepted_at?: string | null
          contact?: Json | null
          created_at?: string
          currency?: string
          customer_price: number
          domain: string
          exchange_rate?: number | null
          expires_at?: string | null
          id?: string
          markup_type?: string | null
          markup_value?: number | null
          payment_amount?: number | null
          payment_id?: string | null
          payment_order_id?: string | null
          payment_provider?: string
          period?: number
          privacy?: boolean
          profit?: number | null
          provider?: string
          provider_operation_id?: string | null
          provider_order_id?: string | null
          quote_expires_at?: string | null
          quote_token?: string | null
          registration_status?: string | null
          renewal_price?: number | null
          renewal_reminders_enabled?: boolean
          status?: string
          status_reason?: string | null
          supplier_cost?: number | null
          supplier_currency?: string
          supplier_pricing_mode?: string
          tax_amount?: number
          tld: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agreements_accepted?: Json | null
          agreements_accepted_at?: string | null
          contact?: Json | null
          created_at?: string
          currency?: string
          customer_price?: number
          domain?: string
          exchange_rate?: number | null
          expires_at?: string | null
          id?: string
          markup_type?: string | null
          markup_value?: number | null
          payment_amount?: number | null
          payment_id?: string | null
          payment_order_id?: string | null
          payment_provider?: string
          period?: number
          privacy?: boolean
          profit?: number | null
          provider?: string
          provider_operation_id?: string | null
          provider_order_id?: string | null
          quote_expires_at?: string | null
          quote_token?: string | null
          registration_status?: string | null
          renewal_price?: number | null
          renewal_reminders_enabled?: boolean
          status?: string
          status_reason?: string | null
          supplier_cost?: number | null
          supplier_currency?: string
          supplier_pricing_mode?: string
          tax_amount?: number
          tld?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      domain_price_audits: {
        Row: {
          ai_enabled: boolean
          ai_model: string | null
          ai_status: string | null
          ai_used: boolean
          changes_applied: number
          checked_count: number
          created_at: string
          details: Json
          error: string | null
          fx_rate: number | null
          fx_source: string | null
          health: string
          id: string
          loss_risk_count: number
          overpriced_count: number
          run_at: string
          trigger: string
        }
        Insert: {
          ai_enabled?: boolean
          ai_model?: string | null
          ai_status?: string | null
          ai_used?: boolean
          changes_applied?: number
          checked_count?: number
          created_at?: string
          details?: Json
          error?: string | null
          fx_rate?: number | null
          fx_source?: string | null
          health?: string
          id?: string
          loss_risk_count?: number
          overpriced_count?: number
          run_at?: string
          trigger?: string
        }
        Update: {
          ai_enabled?: boolean
          ai_model?: string | null
          ai_status?: string | null
          ai_used?: boolean
          changes_applied?: number
          checked_count?: number
          created_at?: string
          details?: Json
          error?: string | null
          fx_rate?: number | null
          fx_source?: string | null
          health?: string
          id?: string
          loss_risk_count?: number
          overpriced_count?: number
          run_at?: string
          trigger?: string
        }
        Relationships: []
      }
      domain_pricing_settings: {
        Row: {
          affiliate_url: string | null
          ai_audit_last_error: string | null
          ai_audit_last_health: string | null
          ai_audit_last_run_at: string | null
          ai_audit_last_status: string | null
          ai_markup_max_percent: number
          ai_markup_min_percent: number
          ai_max_over_market_percent: number
          ai_pricing_auto_apply: boolean
          ai_pricing_enabled: boolean
          created_at: string
          currency: string
          default_markup_fixed: number
          default_markup_percent: number
          fx_manual_rate: number | null
          fx_mode: string
          id: string
          market_cap_enabled: boolean
          min_profit: number
          offer_all_tlds: boolean
          offer_badge_text: string
          offer_discount_type: string
          offer_discount_value: number
          offer_enabled: boolean
          offer_keywords: string[]
          offer_min_price: number
          offer_tlds: string[]
          payment_fee_percent: number
          promo_allow_below_cost: boolean
          promo_max_loss: number
          protection_price_per_year: number
          protection_reference_price: number
          renewal_fallback_uplift_percent: number
          renewal_fx_buffer_percent: number
          renewal_markup_fixed: number
          renewal_markup_percent: number
          renewal_min_profit: number
          reseller_cost_discount_percent: number
          sales_enabled: boolean
          singleton: boolean
          supplier_pricing_mode: string
          tax_inclusive: boolean
          tax_percent: number
          updated_at: string
        }
        Insert: {
          affiliate_url?: string | null
          ai_audit_last_error?: string | null
          ai_audit_last_health?: string | null
          ai_audit_last_run_at?: string | null
          ai_audit_last_status?: string | null
          ai_markup_max_percent?: number
          ai_markup_min_percent?: number
          ai_max_over_market_percent?: number
          ai_pricing_auto_apply?: boolean
          ai_pricing_enabled?: boolean
          created_at?: string
          currency?: string
          default_markup_fixed?: number
          default_markup_percent?: number
          fx_manual_rate?: number | null
          fx_mode?: string
          id?: string
          market_cap_enabled?: boolean
          min_profit?: number
          offer_all_tlds?: boolean
          offer_badge_text?: string
          offer_discount_type?: string
          offer_discount_value?: number
          offer_enabled?: boolean
          offer_keywords?: string[]
          offer_min_price?: number
          offer_tlds?: string[]
          payment_fee_percent?: number
          promo_allow_below_cost?: boolean
          promo_max_loss?: number
          protection_price_per_year?: number
          protection_reference_price?: number
          renewal_fallback_uplift_percent?: number
          renewal_fx_buffer_percent?: number
          renewal_markup_fixed?: number
          renewal_markup_percent?: number
          renewal_min_profit?: number
          reseller_cost_discount_percent?: number
          sales_enabled?: boolean
          singleton?: boolean
          supplier_pricing_mode?: string
          tax_inclusive?: boolean
          tax_percent?: number
          updated_at?: string
        }
        Update: {
          affiliate_url?: string | null
          ai_audit_last_error?: string | null
          ai_audit_last_health?: string | null
          ai_audit_last_run_at?: string | null
          ai_audit_last_status?: string | null
          ai_markup_max_percent?: number
          ai_markup_min_percent?: number
          ai_max_over_market_percent?: number
          ai_pricing_auto_apply?: boolean
          ai_pricing_enabled?: boolean
          created_at?: string
          currency?: string
          default_markup_fixed?: number
          default_markup_percent?: number
          fx_manual_rate?: number | null
          fx_mode?: string
          id?: string
          market_cap_enabled?: boolean
          min_profit?: number
          offer_all_tlds?: boolean
          offer_badge_text?: string
          offer_discount_type?: string
          offer_discount_value?: number
          offer_enabled?: boolean
          offer_keywords?: string[]
          offer_min_price?: number
          offer_tlds?: string[]
          payment_fee_percent?: number
          promo_allow_below_cost?: boolean
          promo_max_loss?: number
          protection_price_per_year?: number
          protection_reference_price?: number
          renewal_fallback_uplift_percent?: number
          renewal_fx_buffer_percent?: number
          renewal_markup_fixed?: number
          renewal_markup_percent?: number
          renewal_min_profit?: number
          reseller_cost_discount_percent?: number
          sales_enabled?: boolean
          singleton?: boolean
          supplier_pricing_mode?: string
          tax_inclusive?: boolean
          tax_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      domain_renewal_orders: {
        Row: {
          created_at: string
          currency: string
          customer_price: number
          domain: string
          exchange_rate: number | null
          expires_after: string | null
          expires_before: string | null
          id: string
          payment_amount: number | null
          payment_id: string | null
          payment_order_id: string | null
          payment_provider: string | null
          period: number
          price_per_year: number
          status: string
          status_reason: string | null
          supplier_cost: number | null
          tld: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_price?: number
          domain: string
          exchange_rate?: number | null
          expires_after?: string | null
          expires_before?: string | null
          id?: string
          payment_amount?: number | null
          payment_id?: string | null
          payment_order_id?: string | null
          payment_provider?: string | null
          period?: number
          price_per_year?: number
          status?: string
          status_reason?: string | null
          supplier_cost?: number | null
          tld: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          customer_price?: number
          domain?: string
          exchange_rate?: number | null
          expires_after?: string | null
          expires_before?: string | null
          id?: string
          payment_amount?: number | null
          payment_id?: string | null
          payment_order_id?: string | null
          payment_provider?: string | null
          period?: number
          price_per_year?: number
          status?: string
          status_reason?: string | null
          supplier_cost?: number | null
          tld?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      domain_renewal_reminders: {
        Row: {
          channel: string
          created_at: string
          days_before: number
          domain: string
          expires_at: string | null
          id: string
          provider: string
          sent_at: string
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          days_before: number
          domain: string
          expires_at?: string | null
          id?: string
          provider?: string
          sent_at?: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          days_before?: number
          domain?: string
          expires_at?: string | null
          id?: string
          provider?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      domain_tld_pricing: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_popular: boolean
          market_reference_price: number | null
          market_renewal_price: number | null
          markup_fixed: number | null
          markup_percent: number | null
          multi_year_promo_ai_managed: boolean
          multi_year_promo_discount_years: number
          multi_year_promo_enabled: boolean
          multi_year_promo_first_year_price: number
          multi_year_promo_min_years: number
          promo_customer_price: number | null
          promo_first_year_only: boolean
          renewal_markup_percent: number | null
          sort_order: number
          supplier_renewal_usd: number | null
          tld: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_popular?: boolean
          market_reference_price?: number | null
          market_renewal_price?: number | null
          markup_fixed?: number | null
          markup_percent?: number | null
          multi_year_promo_ai_managed?: boolean
          multi_year_promo_discount_years?: number
          multi_year_promo_enabled?: boolean
          multi_year_promo_first_year_price?: number
          multi_year_promo_min_years?: number
          promo_customer_price?: number | null
          promo_first_year_only?: boolean
          renewal_markup_percent?: number | null
          sort_order?: number
          supplier_renewal_usd?: number | null
          tld: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_popular?: boolean
          market_reference_price?: number | null
          market_renewal_price?: number | null
          markup_fixed?: number | null
          markup_percent?: number | null
          multi_year_promo_ai_managed?: boolean
          multi_year_promo_discount_years?: number
          multi_year_promo_enabled?: boolean
          multi_year_promo_first_year_price?: number
          multi_year_promo_min_years?: number
          promo_customer_price?: number | null
          promo_first_year_only?: boolean
          renewal_markup_percent?: number | null
          sort_order?: number
          supplier_renewal_usd?: number | null
          tld?: string
          updated_at?: string
        }
        Relationships: []
      }
      donation_campaigns: {
        Row: {
          collected_amount: number
          created_at: string
          created_by: string | null
          display_order: number
          donor_count: number
          id: string
          image_url: string | null
          is_featured: boolean
          long_content: string | null
          min_amount: number
          short_description: string | null
          slug: string
          status: string
          suggested_amounts: number[]
          target_amount: number
          title: string
          updated_at: string
        }
        Insert: {
          collected_amount?: number
          created_at?: string
          created_by?: string | null
          display_order?: number
          donor_count?: number
          id?: string
          image_url?: string | null
          is_featured?: boolean
          long_content?: string | null
          min_amount?: number
          short_description?: string | null
          slug: string
          status?: string
          suggested_amounts?: number[]
          target_amount?: number
          title: string
          updated_at?: string
        }
        Update: {
          collected_amount?: number
          created_at?: string
          created_by?: string | null
          display_order?: number
          donor_count?: number
          id?: string
          image_url?: string | null
          is_featured?: boolean
          long_content?: string | null
          min_amount?: number
          short_description?: string | null
          slug?: string
          status?: string
          suggested_amounts?: number[]
          target_amount?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          campaign_id: string
          created_at: string
          donor_email: string | null
          donor_name: string | null
          donor_phone: string | null
          id: string
          is_anonymous: boolean
          is_manual: boolean
          message: string | null
          paid_at: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          campaign_id: string
          created_at?: string
          donor_email?: string | null
          donor_name?: string | null
          donor_phone?: string | null
          id?: string
          is_anonymous?: boolean
          is_manual?: boolean
          message?: string | null
          paid_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          campaign_id?: string
          created_at?: string
          donor_email?: string | null
          donor_name?: string | null
          donor_phone?: string | null
          id?: string
          is_anonymous?: boolean
          is_manual?: boolean
          message?: string | null
          paid_at?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "donations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "donation_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      edge_functions: {
        Row: {
          code: string | null
          config: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          last_deployed_at: string | null
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_deployed_at?: string | null
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          config?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_deployed_at?: string | null
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      education_entries: {
        Row: {
          created_at: string
          degree: string
          description: string | null
          end_year: number | null
          field_of_study: string | null
          grade: string | null
          id: string
          institution: string | null
          start_year: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          degree: string
          description?: string | null
          end_year?: number | null
          field_of_study?: string | null
          grade?: string | null
          id?: string
          institution?: string | null
          start_year?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          degree?: string
          description?: string | null
          end_year?: number | null
          field_of_study?: string | null
          grade?: string | null
          id?: string
          institution?: string | null
          start_year?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      egress_optimization_logs: {
        Row: {
          created_at: string | null
          egress_saved_bytes: number | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          metadata: Json | null
          optimization_type: string
          rows_deleted: number | null
          status: string | null
          tables_affected: string[] | null
        }
        Insert: {
          created_at?: string | null
          egress_saved_bytes?: number | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json | null
          optimization_type: string
          rows_deleted?: number | null
          status?: string | null
          tables_affected?: string[] | null
        }
        Update: {
          created_at?: string | null
          egress_saved_bytes?: number | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          metadata?: Json | null
          optimization_type?: string
          rows_deleted?: number | null
          status?: string | null
          tables_affected?: string[] | null
        }
        Relationships: []
      }
      email_api_inbox_state: {
        Row: {
          last_seen_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_automation_rules: {
        Row: {
          created_at: string
          created_by: string | null
          delay_minutes: number
          description: string | null
          execution_count: number
          id: string
          is_active: boolean
          last_executed_at: string | null
          name: string
          target_user_type: string | null
          template_id: string | null
          trigger_conditions: Json | null
          trigger_event: string
          updated_at: string
          variable_mapping: Json | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delay_minutes?: number
          description?: string | null
          execution_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          name: string
          target_user_type?: string | null
          template_id?: string | null
          trigger_conditions?: Json | null
          trigger_event: string
          updated_at?: string
          variable_mapping?: Json | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delay_minutes?: number
          description?: string | null
          execution_count?: number
          id?: string
          is_active?: boolean
          last_executed_at?: string | null
          name?: string
          target_user_type?: string | null
          template_id?: string | null
          trigger_conditions?: Json | null
          trigger_event?: string
          updated_at?: string
          variable_mapping?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_automation_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_lifecycle_templates: {
        Row: {
          body: string
          button_text: string | null
          button_url: string | null
          created_at: string
          enabled: boolean
          event_type: string
          image_url: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          body?: string
          button_text?: string | null
          button_url?: string | null
          created_at?: string
          enabled?: boolean
          event_type: string
          image_url?: string | null
          subject?: string
          updated_at?: string
        }
        Update: {
          body?: string
          button_text?: string | null
          button_url?: string | null
          created_at?: string
          enabled?: boolean
          event_type?: string
          image_url?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_outbound_events: {
        Row: {
          bounce_reason: string | null
          clicked_link: string | null
          created_at: string
          event_at: string
          event_type: string
          id: string
          message_id: string | null
          raw_payload: Json | null
          recipient_email: string
          subject: string | null
          user_id: string | null
          user_type: string | null
        }
        Insert: {
          bounce_reason?: string | null
          clicked_link?: string | null
          created_at?: string
          event_at?: string
          event_type: string
          id?: string
          message_id?: string | null
          raw_payload?: Json | null
          recipient_email: string
          subject?: string | null
          user_id?: string | null
          user_type?: string | null
        }
        Update: {
          bounce_reason?: string | null
          clicked_link?: string | null
          created_at?: string
          event_at?: string
          event_type?: string
          id?: string
          message_id?: string | null
          raw_payload?: Json | null
          recipient_email?: string
          subject?: string | null
          user_id?: string | null
          user_type?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          html_content: string
          id: string
          is_active: boolean
          name: string
          subject: string
          text_content: string | null
          updated_at: string
          variables: Json | null
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          html_content: string
          id?: string
          is_active?: boolean
          name: string
          subject: string
          text_content?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          html_content?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          text_content?: string | null
          updated_at?: string
          variables?: Json | null
        }
        Relationships: []
      }
      employer_metrics: {
        Row: {
          active_jobs_count: number
          created_at: string
          current_month: number
          current_year: number
          id: string
          monthly_spent_points: number
          successful_hires: number
          total_applications: number
          total_spent_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_jobs_count?: number
          created_at?: string
          current_month?: number
          current_year?: number
          id?: string
          monthly_spent_points?: number
          successful_hires?: number
          total_applications?: number
          total_spent_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_jobs_count?: number
          created_at?: string
          current_month?: number
          current_year?: number
          id?: string
          monthly_spent_points?: number
          successful_hires?: number
          total_applications?: number
          total_spent_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employer_notifications: {
        Row: {
          action_url: string | null
          created_at: string
          id: string
          is_read: boolean
          message: string
          metadata: Json | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employer_profile_drafts: {
        Row: {
          created_at: string
          current_step: number
          form_data: Json
          id: string
          location_data: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_step?: number
          form_data?: Json
          id?: string
          location_data?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_step?: number
          form_data?: Json
          id?: string
          location_data?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      employer_settings: {
        Row: {
          allow_direct_contact: boolean
          boost_notifications: boolean
          company_visibility: boolean
          contact_visibility: boolean
          created_at: string
          email_notifications: boolean
          email_otp_enabled: boolean | null
          id: string
          interview_reminders: boolean
          job_expiry_alerts: boolean
          job_posting_visibility: boolean
          logo_visibility: boolean
          new_applications: boolean
          passkey_credentials: Json | null
          passkey_enabled: boolean | null
          passkey_verified_at: string | null
          password_changed_at: string | null
          pattern_lock_enabled: boolean | null
          pattern_lock_hash: string | null
          pattern_lock_verified_at: string | null
          push_notifications: boolean
          push_otp_approval_expires_at: string | null
          push_otp_approval_token: string | null
          push_otp_enabled: boolean | null
          quick_login_enabled: boolean | null
          recovery_codes: Json | null
          show_in_directory: boolean
          sms_notifications: boolean
          telegram_2fa_enabled: boolean | null
          totp_enabled: boolean | null
          totp_secret: string | null
          totp_verified_at: string | null
          two_factor_enabled: boolean | null
          two_factor_method: string | null
          updated_at: string
          user_id: string
          weekly_reports: boolean
        }
        Insert: {
          allow_direct_contact?: boolean
          boost_notifications?: boolean
          company_visibility?: boolean
          contact_visibility?: boolean
          created_at?: string
          email_notifications?: boolean
          email_otp_enabled?: boolean | null
          id?: string
          interview_reminders?: boolean
          job_expiry_alerts?: boolean
          job_posting_visibility?: boolean
          logo_visibility?: boolean
          new_applications?: boolean
          passkey_credentials?: Json | null
          passkey_enabled?: boolean | null
          passkey_verified_at?: string | null
          password_changed_at?: string | null
          pattern_lock_enabled?: boolean | null
          pattern_lock_hash?: string | null
          pattern_lock_verified_at?: string | null
          push_notifications?: boolean
          push_otp_approval_expires_at?: string | null
          push_otp_approval_token?: string | null
          push_otp_enabled?: boolean | null
          quick_login_enabled?: boolean | null
          recovery_codes?: Json | null
          show_in_directory?: boolean
          sms_notifications?: boolean
          telegram_2fa_enabled?: boolean | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          totp_verified_at?: string | null
          two_factor_enabled?: boolean | null
          two_factor_method?: string | null
          updated_at?: string
          user_id: string
          weekly_reports?: boolean
        }
        Update: {
          allow_direct_contact?: boolean
          boost_notifications?: boolean
          company_visibility?: boolean
          contact_visibility?: boolean
          created_at?: string
          email_notifications?: boolean
          email_otp_enabled?: boolean | null
          id?: string
          interview_reminders?: boolean
          job_expiry_alerts?: boolean
          job_posting_visibility?: boolean
          logo_visibility?: boolean
          new_applications?: boolean
          passkey_credentials?: Json | null
          passkey_enabled?: boolean | null
          passkey_verified_at?: string | null
          password_changed_at?: string | null
          pattern_lock_enabled?: boolean | null
          pattern_lock_hash?: string | null
          pattern_lock_verified_at?: string | null
          push_notifications?: boolean
          push_otp_approval_expires_at?: string | null
          push_otp_approval_token?: string | null
          push_otp_enabled?: boolean | null
          quick_login_enabled?: boolean | null
          recovery_codes?: Json | null
          show_in_directory?: boolean
          sms_notifications?: boolean
          telegram_2fa_enabled?: boolean | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          totp_verified_at?: string | null
          two_factor_enabled?: boolean | null
          two_factor_method?: string | null
          updated_at?: string
          user_id?: string
          weekly_reports?: boolean
        }
        Relationships: []
      }
      employer_whatsapp_accounts: {
        Row: {
          ai_auto_reply: boolean
          ai_business_info: string
          ai_custom_instructions: string
          ai_language: string
          ai_reply_length: string
          ai_signature: string
          ai_tone: string
          business_name: string | null
          company_id: string
          connected_at: string | null
          connected_via: string | null
          created_at: string
          display_phone: string | null
          id: string
          is_default: boolean
          messaging_tier: string | null
          meta_blocked: boolean
          meta_status: string | null
          phone_number_id: string | null
          quality_rating: string | null
          referred_by_developer: string | null
          status: string
          updated_at: string
          user_id: string
          verified_name: string | null
          waba_id: string | null
        }
        Insert: {
          ai_auto_reply?: boolean
          ai_business_info?: string
          ai_custom_instructions?: string
          ai_language?: string
          ai_reply_length?: string
          ai_signature?: string
          ai_tone?: string
          business_name?: string | null
          company_id: string
          connected_at?: string | null
          connected_via?: string | null
          created_at?: string
          display_phone?: string | null
          id?: string
          is_default?: boolean
          messaging_tier?: string | null
          meta_blocked?: boolean
          meta_status?: string | null
          phone_number_id?: string | null
          quality_rating?: string | null
          referred_by_developer?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verified_name?: string | null
          waba_id?: string | null
        }
        Update: {
          ai_auto_reply?: boolean
          ai_business_info?: string
          ai_custom_instructions?: string
          ai_language?: string
          ai_reply_length?: string
          ai_signature?: string
          ai_tone?: string
          business_name?: string | null
          company_id?: string
          connected_at?: string | null
          connected_via?: string | null
          created_at?: string
          display_phone?: string | null
          id?: string
          is_default?: boolean
          messaging_tier?: string | null
          meta_blocked?: boolean
          meta_status?: string | null
          phone_number_id?: string | null
          quality_rating?: string | null
          referred_by_developer?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verified_name?: string | null
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employer_whatsapp_accounts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      employer_whatsapp_tokens: {
        Row: {
          access_token: string
          company_id: string
          expires_at: string | null
          phone_number_id: string
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          company_id: string
          expires_at?: string | null
          phone_number_id?: string
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          company_id?: string
          expires_at?: string | null
          phone_number_id?: string
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employer_whatsapp_tokens_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      engagement_channel_limits: {
        Row: {
          email_global_24h: number
          email_per_user_7d: number
          email_stagger_hours: number
          enabled: boolean
          id: number
          jitter_seconds: number
          push_per_user_24h: number
          push_stagger_minutes: number
          telegram_per_user_24h: number
          telegram_stagger_minutes: number
          updated_at: string
        }
        Insert: {
          email_global_24h?: number
          email_per_user_7d?: number
          email_stagger_hours?: number
          enabled?: boolean
          id?: number
          jitter_seconds?: number
          push_per_user_24h?: number
          push_stagger_minutes?: number
          telegram_per_user_24h?: number
          telegram_stagger_minutes?: number
          updated_at?: string
        }
        Update: {
          email_global_24h?: number
          email_per_user_7d?: number
          email_stagger_hours?: number
          enabled?: boolean
          id?: number
          jitter_seconds?: number
          push_per_user_24h?: number
          push_stagger_minutes?: number
          telegram_per_user_24h?: number
          telegram_stagger_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      engagement_send_log: {
        Row: {
          ai_message_preview: string | null
          ai_subject: string | null
          channel: string
          id: string
          reason: string | null
          send_date: string
          sent_at: string
          status: string
          user_id: string
        }
        Insert: {
          ai_message_preview?: string | null
          ai_subject?: string | null
          channel: string
          id?: string
          reason?: string | null
          send_date?: string
          sent_at?: string
          status: string
          user_id: string
        }
        Update: {
          ai_message_preview?: string | null
          ai_subject?: string | null
          channel?: string
          id?: string
          reason?: string | null
          send_date?: string
          sent_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      engagement_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      engagement_skip_log: {
        Row: {
          channel: string
          created_at: string
          id: string
          metadata: Json | null
          next_eligible_at: string | null
          reason: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          id?: string
          metadata?: Json | null
          next_eligible_at?: string | null
          reason: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          next_eligible_at?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      expiry_notification_log: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          expires_at: string
          id: string
          sent_at: string
          stage: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          expires_at: string
          id?: string
          sent_at?: string
          stage: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          expires_at?: string
          id?: string
          sent_at?: string
          stage?: string
          user_id?: string
        }
        Relationships: []
      }
      external_job_shortlinks: {
        Row: {
          click_count: number
          created_at: string
          ext_id: string
          payload: Json
          short_id: string
          source: string
        }
        Insert: {
          click_count?: number
          created_at?: string
          ext_id: string
          payload: Json
          short_id: string
          source: string
        }
        Update: {
          click_count?: number
          created_at?: string
          ext_id?: string
          payload?: Json
          short_id?: string
          source?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          category: string
          created_at: string | null
          id: string
          is_active: boolean | null
          keywords: string[] | null
          question: string
          relevance_score: number | null
          search_vector: unknown
          updated_at: string | null
        }
        Insert: {
          answer: string
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          question: string
          relevance_score?: number | null
          search_vector?: unknown
          updated_at?: string | null
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          keywords?: string[] | null
          question?: string
          relevance_score?: number | null
          search_vector?: unknown
          updated_at?: string | null
        }
        Relationships: []
      }
      fingerprint_change_logs: {
        Row: {
          browser_name: string | null
          changed_at: string
          city: string | null
          country: string | null
          created_at: string
          device_id: string | null
          id: string
          ip_address: string | null
          new_fingerprint: string | null
          old_fingerprint: string | null
          operating_system: string | null
          user_id: string
        }
        Insert: {
          browser_name?: string | null
          changed_at?: string
          city?: string | null
          country?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: string | null
          new_fingerprint?: string | null
          old_fingerprint?: string | null
          operating_system?: string | null
          user_id: string
        }
        Update: {
          browser_name?: string | null
          changed_at?: string
          city?: string | null
          country?: string | null
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: string | null
          new_fingerprint?: string | null
          old_fingerprint?: string | null
          operating_system?: string | null
          user_id?: string
        }
        Relationships: []
      }
      "Firestore Collection": {
        Row: {
          attrs: Json | null
          created_at: string | null
          name: string | null
          updated_at: string | null
        }
        Insert: {
          attrs?: Json | null
          created_at?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Update: {
          attrs?: Json | null
          created_at?: string | null
          name?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      function_logs: {
        Row: {
          created_at: string
          error_message: string | null
          execution_id: string | null
          execution_time_ms: number | null
          function_name: string
          id: string
          request_data: Json | null
          response_data: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          execution_id?: string | null
          execution_time_ms?: number | null
          function_name: string
          id?: string
          request_data?: Json | null
          response_data?: Json | null
          status: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          execution_id?: string | null
          execution_time_ms?: number | null
          function_name?: string
          id?: string
          request_data?: Json | null
          response_data?: Json | null
          status?: string
        }
        Relationships: []
      }
      google_calendar_api: {
        Row: {
          created_at: string
          data: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      google_indexing_queue: {
        Row: {
          action: string
          attempt_number: number | null
          calculated_process_datetime: string | null
          created_at: string | null
          daily_position: number | null
          days_pending: number | null
          error_message: string | null
          estimated_index_date: string | null
          estimated_process_date: string | null
          exact_scheduled_time: string | null
          first_attempt_at: string | null
          google_last_verified_at: string | null
          google_public_at: string | null
          google_queued_at: string | null
          google_scheduled_at: string | null
          google_status: string | null
          google_submitted_at: string | null
          google_verification_attempts: number | null
          id: string
          indexnow_submitted: boolean | null
          is_google_public: boolean | null
          job_id: string | null
          last_attempt_at: string | null
          last_processed_at: string | null
          metadata: Json | null
          original_created_at: string | null
          original_posted_at: string | null
          page_type: string | null
          priority: number | null
          processed_at: string | null
          processing_method: string | null
          processing_started_at: string | null
          queue_date: string | null
          queue_position: number | null
          retry_count: number | null
          scheduled_for: string | null
          source: string | null
          status: string
          url: string
        }
        Insert: {
          action?: string
          attempt_number?: number | null
          calculated_process_datetime?: string | null
          created_at?: string | null
          daily_position?: number | null
          days_pending?: number | null
          error_message?: string | null
          estimated_index_date?: string | null
          estimated_process_date?: string | null
          exact_scheduled_time?: string | null
          first_attempt_at?: string | null
          google_last_verified_at?: string | null
          google_public_at?: string | null
          google_queued_at?: string | null
          google_scheduled_at?: string | null
          google_status?: string | null
          google_submitted_at?: string | null
          google_verification_attempts?: number | null
          id?: string
          indexnow_submitted?: boolean | null
          is_google_public?: boolean | null
          job_id?: string | null
          last_attempt_at?: string | null
          last_processed_at?: string | null
          metadata?: Json | null
          original_created_at?: string | null
          original_posted_at?: string | null
          page_type?: string | null
          priority?: number | null
          processed_at?: string | null
          processing_method?: string | null
          processing_started_at?: string | null
          queue_date?: string | null
          queue_position?: number | null
          retry_count?: number | null
          scheduled_for?: string | null
          source?: string | null
          status?: string
          url: string
        }
        Update: {
          action?: string
          attempt_number?: number | null
          calculated_process_datetime?: string | null
          created_at?: string | null
          daily_position?: number | null
          days_pending?: number | null
          error_message?: string | null
          estimated_index_date?: string | null
          estimated_process_date?: string | null
          exact_scheduled_time?: string | null
          first_attempt_at?: string | null
          google_last_verified_at?: string | null
          google_public_at?: string | null
          google_queued_at?: string | null
          google_scheduled_at?: string | null
          google_status?: string | null
          google_submitted_at?: string | null
          google_verification_attempts?: number | null
          id?: string
          indexnow_submitted?: boolean | null
          is_google_public?: boolean | null
          job_id?: string | null
          last_attempt_at?: string | null
          last_processed_at?: string | null
          metadata?: Json | null
          original_created_at?: string | null
          original_posted_at?: string | null
          page_type?: string | null
          priority?: number | null
          processed_at?: string | null
          processing_method?: string | null
          processing_started_at?: string | null
          queue_date?: string | null
          queue_position?: number | null
          retry_count?: number | null
          scheduled_for?: string | null
          source?: string | null
          status?: string
          url?: string
        }
        Relationships: []
      }
      google_oauth_states: {
        Row: {
          created_at: string
          product: string
          redirect_uri: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product: string
          redirect_uri: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          product?: string
          redirect_uri?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      google_user_connections: {
        Row: {
          access_token_ciphertext: string | null
          created_at: string
          google_email: string | null
          google_sub: string | null
          id: string
          last_error: string | null
          product: string
          refresh_token_ciphertext: string | null
          scopes: string[]
          status: string
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_ciphertext?: string | null
          created_at?: string
          google_email?: string | null
          google_sub?: string | null
          id?: string
          last_error?: string | null
          product: string
          refresh_token_ciphertext?: string | null
          scopes?: string[]
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_ciphertext?: string | null
          created_at?: string
          google_email?: string | null
          google_sub?: string | null
          id?: string
          last_error?: string | null
          product?: string
          refresh_token_ciphertext?: string | null
          scopes?: string[]
          status?: string
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      guest_transactions: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          email: string
          id: string
          mobile: string
          package_name: string
          points_amount: number
          razorpay_order_id: string
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          email: string
          id?: string
          mobile: string
          package_name: string
          points_amount?: number
          razorpay_order_id: string
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          email?: string
          id?: string
          mobile?: string
          package_name?: string
          points_amount?: number
          razorpay_order_id?: string
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
        }
        Relationships: []
      }
      hero_banners: {
        Row: {
          created_at: string
          gradient: string
          id: string
          image_url: string | null
          is_active: boolean
          link_url: string | null
          sort_order: number
          subtitle: string
          title: string
          updated_at: string
          youtube_url: string | null
        }
        Insert: {
          created_at?: string
          gradient?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle: string
          title: string
          updated_at?: string
          youtube_url?: string | null
        }
        Update: {
          created_at?: string
          gradient?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          link_url?: string | null
          sort_order?: number
          subtitle?: string
          title?: string
          updated_at?: string
          youtube_url?: string | null
        }
        Relationships: []
      }
      home_trust_badges: {
        Row: {
          created_at: string
          description: string | null
          glow: string
          gradient: string
          id: string
          image_url: string | null
          is_active: boolean
          ring: string
          sort_order: number
          subtitle: string
          tint: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          glow?: string
          gradient?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          ring?: string
          sort_order?: number
          subtitle?: string
          tint?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          glow?: string
          gradient?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          ring?: string
          sort_order?: number
          subtitle?: string
          tint?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      indexing_cron_logs: {
        Row: {
          created_at: string | null
          cron_type: string
          executed_at: string | null
          execution_time_ms: number | null
          failed_count: number | null
          id: string
          metadata: Json | null
          success_count: number | null
          urls_processed: number | null
        }
        Insert: {
          created_at?: string | null
          cron_type: string
          executed_at?: string | null
          execution_time_ms?: number | null
          failed_count?: number | null
          id?: string
          metadata?: Json | null
          success_count?: number | null
          urls_processed?: number | null
        }
        Update: {
          created_at?: string | null
          cron_type?: string
          executed_at?: string | null
          execution_time_ms?: number | null
          failed_count?: number | null
          id?: string
          metadata?: Json | null
          success_count?: number | null
          urls_processed?: number | null
        }
        Relationships: []
      }
      indexing_daily_quota: {
        Row: {
          created_at: string
          date: string
          id: string
          indexnow_fallback_count: number | null
          last_reset_at: string | null
          quota_limit: number
          quota_used: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          date?: string
          id?: string
          indexnow_fallback_count?: number | null
          last_reset_at?: string | null
          quota_limit?: number
          quota_used?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          indexnow_fallback_count?: number | null
          last_reset_at?: string | null
          quota_limit?: number
          quota_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      indexing_daily_slots: {
        Row: {
          created_at: string | null
          date: string
          total_slots: number
          updated_at: string | null
          used_slots: number
        }
        Insert: {
          created_at?: string | null
          date: string
          total_slots?: number
          updated_at?: string | null
          used_slots?: number
        }
        Update: {
          created_at?: string | null
          date?: string
          total_slots?: number
          updated_at?: string | null
          used_slots?: number
        }
        Relationships: []
      }
      indexing_error_logs: {
        Row: {
          created_at: string
          error_code: number | null
          error_message: string | null
          error_type: string | null
          fallback_used: string | null
          id: string
          is_permanent: boolean | null
          url: string
        }
        Insert: {
          created_at?: string
          error_code?: number | null
          error_message?: string | null
          error_type?: string | null
          fallback_used?: string | null
          id?: string
          is_permanent?: boolean | null
          url: string
        }
        Update: {
          created_at?: string
          error_code?: number | null
          error_message?: string | null
          error_type?: string | null
          fallback_used?: string | null
          id?: string
          is_permanent?: boolean | null
          url?: string
        }
        Relationships: []
      }
      interview_cleanup_logs: {
        Row: {
          cancelled_deleted: number
          cleanup_date: string
          created_at: string
          expired_deleted: number
          id: string
          interviews_deleted: number
        }
        Insert: {
          cancelled_deleted?: number
          cleanup_date?: string
          created_at?: string
          expired_deleted?: number
          id?: string
          interviews_deleted?: number
        }
        Update: {
          cancelled_deleted?: number
          cleanup_date?: string
          created_at?: string
          expired_deleted?: number
          id?: string
          interviews_deleted?: number
        }
        Relationships: []
      }
      interview_participants: {
        Row: {
          created_at: string | null
          device_info: Json | null
          display_name: string
          duration_seconds: number | null
          id: string
          interview_id: string
          is_host: boolean | null
          joined_at: string | null
          left_at: string | null
          participant_jitsi_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          display_name: string
          duration_seconds?: number | null
          id?: string
          interview_id: string
          is_host?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          participant_jitsi_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          display_name?: string
          duration_seconds?: number | null
          id?: string
          interview_id?: string
          is_host?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          participant_jitsi_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_participants_interview_id_fkey"
            columns: ["interview_id"]
            isOneToOne: false
            referencedRelation: "interviews"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_pricing_settings: {
        Row: {
          created_at: string
          enable_duration_pricing: boolean | null
          id: string
          is_active: boolean
          minimum_points: number | null
          points_per_interview: number
          points_per_minute: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enable_duration_pricing?: boolean | null
          id?: string
          is_active?: boolean
          minimum_points?: number | null
          points_per_interview?: number
          points_per_minute?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enable_duration_pricing?: boolean | null
          id?: string
          is_active?: boolean
          minimum_points?: number | null
          points_per_interview?: number
          points_per_minute?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          actual_end_time: string | null
          actual_start_time: string | null
          applicant_id: string
          created_at: string
          daily_room_name: string | null
          daily_room_url: string | null
          employer_joined_notified_at: string | null
          hms_host_prebuilt_url: string | null
          hms_host_token: string | null
          hms_participant_prebuilt_urls: Json | null
          hms_participant_tokens: Json | null
          hms_room_id: string | null
          hms_room_url: string | null
          host_meeting_token: string | null
          host_user_id: string | null
          id: string
          is_streaming_to_youtube: boolean | null
          jitsi_meeting_url: string | null
          jitsi_password: string | null
          jitsi_room_name: string | null
          job_id: string
          location_url: string | null
          meeting_duration_seconds: number | null
          mode: string
          notes: string | null
          participant_meeting_tokens: Json | null
          payment_id: string | null
          payment_status: string | null
          points_spent: number | null
          recording_enabled: boolean | null
          recording_url: string | null
          scheduled_at: string
          scheduled_end_at: string | null
          screen_share_enabled: boolean | null
          start_notified_at: string | null
          status: string
          total_participants: number | null
          updated_at: string
          video_platform: string | null
          videosdk_host_token: string | null
          videosdk_meeting_url: string | null
          videosdk_participant_tokens: Json | null
          videosdk_recording_id: string | null
          videosdk_room_id: string | null
          videosdk_session_id: string | null
          youtube_stream_key: string | null
          youtube_stream_url: string | null
        }
        Insert: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          applicant_id: string
          created_at?: string
          daily_room_name?: string | null
          daily_room_url?: string | null
          employer_joined_notified_at?: string | null
          hms_host_prebuilt_url?: string | null
          hms_host_token?: string | null
          hms_participant_prebuilt_urls?: Json | null
          hms_participant_tokens?: Json | null
          hms_room_id?: string | null
          hms_room_url?: string | null
          host_meeting_token?: string | null
          host_user_id?: string | null
          id?: string
          is_streaming_to_youtube?: boolean | null
          jitsi_meeting_url?: string | null
          jitsi_password?: string | null
          jitsi_room_name?: string | null
          job_id: string
          location_url?: string | null
          meeting_duration_seconds?: number | null
          mode: string
          notes?: string | null
          participant_meeting_tokens?: Json | null
          payment_id?: string | null
          payment_status?: string | null
          points_spent?: number | null
          recording_enabled?: boolean | null
          recording_url?: string | null
          scheduled_at: string
          scheduled_end_at?: string | null
          screen_share_enabled?: boolean | null
          start_notified_at?: string | null
          status?: string
          total_participants?: number | null
          updated_at?: string
          video_platform?: string | null
          videosdk_host_token?: string | null
          videosdk_meeting_url?: string | null
          videosdk_participant_tokens?: Json | null
          videosdk_recording_id?: string | null
          videosdk_room_id?: string | null
          videosdk_session_id?: string | null
          youtube_stream_key?: string | null
          youtube_stream_url?: string | null
        }
        Update: {
          actual_end_time?: string | null
          actual_start_time?: string | null
          applicant_id?: string
          created_at?: string
          daily_room_name?: string | null
          daily_room_url?: string | null
          employer_joined_notified_at?: string | null
          hms_host_prebuilt_url?: string | null
          hms_host_token?: string | null
          hms_participant_prebuilt_urls?: Json | null
          hms_participant_tokens?: Json | null
          hms_room_id?: string | null
          hms_room_url?: string | null
          host_meeting_token?: string | null
          host_user_id?: string | null
          id?: string
          is_streaming_to_youtube?: boolean | null
          jitsi_meeting_url?: string | null
          jitsi_password?: string | null
          jitsi_room_name?: string | null
          job_id?: string
          location_url?: string | null
          meeting_duration_seconds?: number | null
          mode?: string
          notes?: string | null
          participant_meeting_tokens?: Json | null
          payment_id?: string | null
          payment_status?: string | null
          points_spent?: number | null
          recording_enabled?: boolean | null
          recording_url?: string | null
          scheduled_at?: string
          scheduled_end_at?: string | null
          screen_share_enabled?: boolean | null
          start_notified_at?: string | null
          status?: string
          total_participants?: number | null
          updated_at?: string
          video_platform?: string | null
          videosdk_host_token?: string | null
          videosdk_meeting_url?: string | null
          videosdk_participant_tokens?: Json | null
          videosdk_recording_id?: string | null
          videosdk_room_id?: string | null
          videosdk_session_id?: string | null
          youtube_stream_key?: string | null
          youtube_stream_url?: string | null
        }
        Relationships: []
      }
      job_alert_daily_digests: {
        Row: {
          channels: string[]
          created_at: string
          ist_date: string
          job_count: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channels?: string[]
          created_at?: string
          ist_date: string
          job_count?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channels?: string[]
          created_at?: string
          ist_date?: string
          job_count?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_alert_preferences: {
        Row: {
          created_at: string
          daily_digest: boolean | null
          email: string
          email_alerts: boolean | null
          experience_levels: string[] | null
          id: string
          instant_alerts: boolean | null
          is_active: boolean | null
          job_categories: string[] | null
          locations: string[] | null
          phone: string | null
          push_notifications: boolean | null
          salary_ranges: string[] | null
          sms_alerts: boolean | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          daily_digest?: boolean | null
          email: string
          email_alerts?: boolean | null
          experience_levels?: string[] | null
          id?: string
          instant_alerts?: boolean | null
          is_active?: boolean | null
          job_categories?: string[] | null
          locations?: string[] | null
          phone?: string | null
          push_notifications?: boolean | null
          salary_ranges?: string[] | null
          sms_alerts?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          daily_digest?: boolean | null
          email?: string
          email_alerts?: boolean | null
          experience_levels?: string[] | null
          id?: string
          instant_alerts?: boolean | null
          is_active?: boolean | null
          job_categories?: string[] | null
          locations?: string[] | null
          phone?: string | null
          push_notifications?: boolean | null
          salary_ranges?: string[] | null
          sms_alerts?: boolean | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      job_alert_sent_jobs: {
        Row: {
          ist_date: string
          job_id: string
          sent_at: string
          user_id: string
        }
        Insert: {
          ist_date: string
          job_id: string
          sent_at?: string
          user_id: string
        }
        Update: {
          ist_date?: string
          job_id?: string
          sent_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_applicant_views: {
        Row: {
          created_at: string
          employer_id: string
          id: string
          job_id: string
          last_applicant_count: number
          last_viewed_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employer_id: string
          id?: string
          job_id: string
          last_applicant_count?: number
          last_viewed_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employer_id?: string
          id?: string
          job_id?: string
          last_applicant_count?: number
          last_viewed_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_applicant_views_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_applications: {
        Row: {
          api_bio: string | null
          api_certifications: Json | null
          api_company: string | null
          api_current_position: string | null
          api_education_entries: Json | null
          api_email: string | null
          api_experience_years: number | null
          api_full_name: string | null
          api_languages: string[] | null
          api_location: string | null
          api_phone: string | null
          api_professional_experiences: Json | null
          api_skills: string[] | null
          api_social_links: Json | null
          api_whatsapp_number: string | null
          applicant_id: string | null
          application_source: string | null
          applied_at: string
          cover_letter: string | null
          created_at: string | null
          employer_id: string
          id: string
          job_id: string
          resume_url: string | null
          reviewed_at: string | null
          status: string | null
        }
        Insert: {
          api_bio?: string | null
          api_certifications?: Json | null
          api_company?: string | null
          api_current_position?: string | null
          api_education_entries?: Json | null
          api_email?: string | null
          api_experience_years?: number | null
          api_full_name?: string | null
          api_languages?: string[] | null
          api_location?: string | null
          api_phone?: string | null
          api_professional_experiences?: Json | null
          api_skills?: string[] | null
          api_social_links?: Json | null
          api_whatsapp_number?: string | null
          applicant_id?: string | null
          application_source?: string | null
          applied_at?: string
          cover_letter?: string | null
          created_at?: string | null
          employer_id: string
          id?: string
          job_id: string
          resume_url?: string | null
          reviewed_at?: string | null
          status?: string | null
        }
        Update: {
          api_bio?: string | null
          api_certifications?: Json | null
          api_company?: string | null
          api_current_position?: string | null
          api_education_entries?: Json | null
          api_email?: string | null
          api_experience_years?: number | null
          api_full_name?: string | null
          api_languages?: string[] | null
          api_location?: string | null
          api_phone?: string | null
          api_professional_experiences?: Json | null
          api_skills?: string[] | null
          api_social_links?: Json | null
          api_whatsapp_number?: string | null
          applicant_id?: string | null
          application_source?: string | null
          applied_at?: string
          cover_letter?: string | null
          created_at?: string | null
          employer_id?: string
          id?: string
          job_id?: string
          resume_url?: string | null
          reviewed_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_boosts: {
        Row: {
          amount_paid: number
          boost_end_date: string | null
          boost_package_id: string
          boost_start_date: string | null
          created_at: string
          id: string
          job_id: string
          payment_id: string | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_paid: number
          boost_end_date?: string | null
          boost_package_id: string
          boost_start_date?: string | null
          created_at?: string
          id?: string
          job_id: string
          payment_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_paid?: number
          boost_end_date?: string | null
          boost_package_id?: string
          boost_start_date?: string | null
          created_at?: string
          id?: string
          job_id?: string
          payment_id?: string | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_boosts_boost_package_id_fkey"
            columns: ["boost_package_id"]
            isOneToOne: false
            referencedRelation: "boost_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_boosts_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          job_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          job_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          job_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      job_favorites: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: []
      }
      job_images: {
        Row: {
          alt_text: string | null
          caption: string | null
          created_at: string
          file_size_bytes: number | null
          height: number | null
          id: string
          image_type: string
          image_url: string
          is_primary: boolean | null
          job_id: string
          seo_title: string | null
          size_category: string
          sort_order: number
          updated_at: string
          user_id: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          image_type?: string
          image_url: string
          is_primary?: boolean | null
          job_id: string
          seo_title?: string | null
          size_category?: string
          sort_order?: number
          updated_at?: string
          user_id: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string
          file_size_bytes?: number | null
          height?: number | null
          id?: string
          image_type?: string
          image_url?: string
          is_primary?: boolean | null
          job_id?: string
          seo_title?: string | null
          size_category?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_images_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_indexing_status: {
        Row: {
          bing_error: string | null
          bing_last_checked_at: string | null
          bing_public_at: string | null
          bing_queued_at: string | null
          bing_scheduled_at: string | null
          bing_status: string | null
          bing_submitted_at: string | null
          content_hash: string | null
          created_at: string | null
          google_error: string | null
          google_last_checked_at: string | null
          google_public_at: string | null
          google_queued_at: string | null
          google_scheduled_at: string | null
          google_status: string | null
          google_submitted_at: string | null
          id: string
          indexing_paid_at: string | null
          indexing_payment_id: string | null
          is_bing_public: boolean | null
          is_google_public: boolean | null
          is_paid_for_indexing: boolean
          job_id: string
          last_content_change_at: string | null
          last_indexed_content_hash: string | null
          max_verification_attempts: number | null
          next_verification_at: string | null
          overall_status: string | null
          reindex_count: number | null
          updated_at: string | null
          url: string
          verification_attempt_count: number | null
        }
        Insert: {
          bing_error?: string | null
          bing_last_checked_at?: string | null
          bing_public_at?: string | null
          bing_queued_at?: string | null
          bing_scheduled_at?: string | null
          bing_status?: string | null
          bing_submitted_at?: string | null
          content_hash?: string | null
          created_at?: string | null
          google_error?: string | null
          google_last_checked_at?: string | null
          google_public_at?: string | null
          google_queued_at?: string | null
          google_scheduled_at?: string | null
          google_status?: string | null
          google_submitted_at?: string | null
          id?: string
          indexing_paid_at?: string | null
          indexing_payment_id?: string | null
          is_bing_public?: boolean | null
          is_google_public?: boolean | null
          is_paid_for_indexing?: boolean
          job_id: string
          last_content_change_at?: string | null
          last_indexed_content_hash?: string | null
          max_verification_attempts?: number | null
          next_verification_at?: string | null
          overall_status?: string | null
          reindex_count?: number | null
          updated_at?: string | null
          url: string
          verification_attempt_count?: number | null
        }
        Update: {
          bing_error?: string | null
          bing_last_checked_at?: string | null
          bing_public_at?: string | null
          bing_queued_at?: string | null
          bing_scheduled_at?: string | null
          bing_status?: string | null
          bing_submitted_at?: string | null
          content_hash?: string | null
          created_at?: string | null
          google_error?: string | null
          google_last_checked_at?: string | null
          google_public_at?: string | null
          google_queued_at?: string | null
          google_scheduled_at?: string | null
          google_status?: string | null
          google_submitted_at?: string | null
          id?: string
          indexing_paid_at?: string | null
          indexing_payment_id?: string | null
          is_bing_public?: boolean | null
          is_google_public?: boolean | null
          is_paid_for_indexing?: boolean
          job_id?: string
          last_content_change_at?: string | null
          last_indexed_content_hash?: string | null
          max_verification_attempts?: number | null
          next_verification_at?: string | null
          overall_status?: string | null
          reindex_count?: number | null
          updated_at?: string | null
          url?: string
          verification_attempt_count?: number | null
        }
        Relationships: []
      }
      job_interactions: {
        Row: {
          created_at: string
          id: string
          interaction_type: string
          job_id: string | null
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          interaction_type: string
          job_id?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          interaction_type?: string
          job_id?: string | null
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      job_payments: {
        Row: {
          created_at: string
          description: string
          id: string
          job_id: string | null
          payment_type: string
          points_spent: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          job_id?: string | null
          payment_type: string
          points_spent: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          job_id?: string | null
          payment_type?: string
          points_spent?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_posting_settings: {
        Row: {
          created_at: string
          duration_packages: Json | null
          id: string
          is_active: boolean
          points_required_per_job: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_packages?: Json | null
          id?: string
          is_active?: boolean
          points_required_per_job?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_packages?: Json | null
          id?: string
          is_active?: boolean
          points_required_per_job?: number
          updated_at?: string
        }
        Relationships: []
      }
      job_seeker_profile_drafts: {
        Row: {
          certifications_data: Json | null
          created_at: string
          current_step: number
          education_data: Json | null
          experiences_data: Json | null
          form_data: Json
          id: string
          location_data: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          certifications_data?: Json | null
          created_at?: string
          current_step?: number
          education_data?: Json | null
          experiences_data?: Json | null
          form_data?: Json
          id?: string
          location_data?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          certifications_data?: Json | null
          created_at?: string
          current_step?: number
          education_data?: Json | null
          experiences_data?: Json | null
          form_data?: Json
          id?: string
          location_data?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          api_company_description: string | null
          api_company_name: string | null
          api_email: string | null
          api_facebook_link: string | null
          api_hr_contact_name: string | null
          api_industry: string | null
          api_instagram_link: string | null
          api_linkedin_link: string | null
          api_organisation_size: string | null
          api_phone: string | null
          api_whatsapp_number: string | null
          api_youtube_link: string | null
          application_deadline: string | null
          applications_count: number | null
          apply_mode: string | null
          auto_email_confirmation: boolean | null
          benefits: string | null
          boost_bonus_applied: number | null
          boost_end_date: string | null
          boost_level: number | null
          boost_start_date: string | null
          calls_count: number | null
          category: string | null
          city: string | null
          comments_count: number | null
          company_id: string
          country: string | null
          cover_letter_required: boolean | null
          created_at: string
          department: string | null
          description: string
          duration_months: number | null
          education_required: string | null
          experience_level: string
          expires_at: string | null
          external_apply_url: string | null
          gender_preference: string | null
          hiring_urgency: string | null
          id: string
          immediate_joining: boolean | null
          is_boosted: boolean | null
          is_featured: boolean | null
          is_premiere: boolean
          job_type: string
          languages: string[] | null
          latitude: number | null
          location: string
          longitude: number | null
          openings: number | null
          organic_rank: number | null
          organic_score: number | null
          points_spent: number | null
          precise_address: string | null
          premiere_start_at: string | null
          public_slug: string | null
          publish_mode: string
          published_at: string | null
          remote_allowed: boolean | null
          requirements: string | null
          responsibilities: string[] | null
          resume_required: boolean | null
          salary_currency: string | null
          salary_max: number | null
          salary_max_numeric: number | null
          salary_min: number | null
          salary_min_numeric: number | null
          salary_period: string | null
          salary_range: string | null
          scheduled_publish_at: string | null
          search_vector: unknown
          shares_count: number | null
          shift_timing: string | null
          short_id: string | null
          skills: string[] | null
          state: string | null
          status: string | null
          telegram_channel_message_id: number | null
          title: string
          trending_rank: number | null
          trending_score: number | null
          updated_at: string
          video_title_1: string | null
          video_title_2: string | null
          video_url: string | null
          video_url_1: string | null
          video_url_2: string | null
          views_count: number | null
          visa_sponsorship: boolean | null
          visibility: string
          work_mode: string | null
        }
        Insert: {
          api_company_description?: string | null
          api_company_name?: string | null
          api_email?: string | null
          api_facebook_link?: string | null
          api_hr_contact_name?: string | null
          api_industry?: string | null
          api_instagram_link?: string | null
          api_linkedin_link?: string | null
          api_organisation_size?: string | null
          api_phone?: string | null
          api_whatsapp_number?: string | null
          api_youtube_link?: string | null
          application_deadline?: string | null
          applications_count?: number | null
          apply_mode?: string | null
          auto_email_confirmation?: boolean | null
          benefits?: string | null
          boost_bonus_applied?: number | null
          boost_end_date?: string | null
          boost_level?: number | null
          boost_start_date?: string | null
          calls_count?: number | null
          category?: string | null
          city?: string | null
          comments_count?: number | null
          company_id: string
          country?: string | null
          cover_letter_required?: boolean | null
          created_at?: string
          department?: string | null
          description: string
          duration_months?: number | null
          education_required?: string | null
          experience_level: string
          expires_at?: string | null
          external_apply_url?: string | null
          gender_preference?: string | null
          hiring_urgency?: string | null
          id?: string
          immediate_joining?: boolean | null
          is_boosted?: boolean | null
          is_featured?: boolean | null
          is_premiere?: boolean
          job_type: string
          languages?: string[] | null
          latitude?: number | null
          location: string
          longitude?: number | null
          openings?: number | null
          organic_rank?: number | null
          organic_score?: number | null
          points_spent?: number | null
          precise_address?: string | null
          premiere_start_at?: string | null
          public_slug?: string | null
          publish_mode?: string
          published_at?: string | null
          remote_allowed?: boolean | null
          requirements?: string | null
          responsibilities?: string[] | null
          resume_required?: boolean | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_max_numeric?: number | null
          salary_min?: number | null
          salary_min_numeric?: number | null
          salary_period?: string | null
          salary_range?: string | null
          scheduled_publish_at?: string | null
          search_vector?: unknown
          shares_count?: number | null
          shift_timing?: string | null
          short_id?: string | null
          skills?: string[] | null
          state?: string | null
          status?: string | null
          telegram_channel_message_id?: number | null
          title: string
          trending_rank?: number | null
          trending_score?: number | null
          updated_at?: string
          video_title_1?: string | null
          video_title_2?: string | null
          video_url?: string | null
          video_url_1?: string | null
          video_url_2?: string | null
          views_count?: number | null
          visa_sponsorship?: boolean | null
          visibility?: string
          work_mode?: string | null
        }
        Update: {
          api_company_description?: string | null
          api_company_name?: string | null
          api_email?: string | null
          api_facebook_link?: string | null
          api_hr_contact_name?: string | null
          api_industry?: string | null
          api_instagram_link?: string | null
          api_linkedin_link?: string | null
          api_organisation_size?: string | null
          api_phone?: string | null
          api_whatsapp_number?: string | null
          api_youtube_link?: string | null
          application_deadline?: string | null
          applications_count?: number | null
          apply_mode?: string | null
          auto_email_confirmation?: boolean | null
          benefits?: string | null
          boost_bonus_applied?: number | null
          boost_end_date?: string | null
          boost_level?: number | null
          boost_start_date?: string | null
          calls_count?: number | null
          category?: string | null
          city?: string | null
          comments_count?: number | null
          company_id?: string
          country?: string | null
          cover_letter_required?: boolean | null
          created_at?: string
          department?: string | null
          description?: string
          duration_months?: number | null
          education_required?: string | null
          experience_level?: string
          expires_at?: string | null
          external_apply_url?: string | null
          gender_preference?: string | null
          hiring_urgency?: string | null
          id?: string
          immediate_joining?: boolean | null
          is_boosted?: boolean | null
          is_featured?: boolean | null
          is_premiere?: boolean
          job_type?: string
          languages?: string[] | null
          latitude?: number | null
          location?: string
          longitude?: number | null
          openings?: number | null
          organic_rank?: number | null
          organic_score?: number | null
          points_spent?: number | null
          precise_address?: string | null
          premiere_start_at?: string | null
          public_slug?: string | null
          publish_mode?: string
          published_at?: string | null
          remote_allowed?: boolean | null
          requirements?: string | null
          responsibilities?: string[] | null
          resume_required?: boolean | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_max_numeric?: number | null
          salary_min?: number | null
          salary_min_numeric?: number | null
          salary_period?: string | null
          salary_range?: string | null
          scheduled_publish_at?: string | null
          search_vector?: unknown
          shares_count?: number | null
          shift_timing?: string | null
          short_id?: string | null
          skills?: string[] | null
          state?: string | null
          status?: string | null
          telegram_channel_message_id?: number | null
          title?: string
          trending_rank?: number | null
          trending_score?: number | null
          updated_at?: string
          video_title_1?: string | null
          video_title_2?: string | null
          video_url?: string | null
          video_url_1?: string | null
          video_url_2?: string | null
          views_count?: number | null
          visa_sponsorship?: boolean | null
          visibility?: string
          work_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_connections: {
        Row: {
          access_token: string | null
          auto_post_jobs: boolean
          can_post: boolean
          created_at: string
          expires_at: string | null
          id: string
          last_post_at: string | null
          linkedin_email: string | null
          linkedin_name: string | null
          linkedin_picture: string | null
          linkedin_sub: string | null
          scopes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          auto_post_jobs?: boolean
          can_post?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          last_post_at?: string | null
          linkedin_email?: string | null
          linkedin_name?: string | null
          linkedin_picture?: string | null
          linkedin_sub?: string | null
          scopes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          auto_post_jobs?: boolean
          can_post?: boolean
          created_at?: string
          expires_at?: string | null
          id?: string
          last_post_at?: string | null
          linkedin_email?: string | null
          linkedin_name?: string | null
          linkedin_picture?: string | null
          linkedin_sub?: string | null
          scopes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      live_sessions: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          created_at: string | null
          device_type: string | null
          entry_page: string | null
          exit_page: string | null
          id: string
          ip_address: string | null
          is_active: boolean | null
          last_seen: string | null
          latitude: number | null
          longitude: number | null
          onesignal_player_id: string | null
          os: string | null
          page_url: string | null
          session_duration: number | null
          session_id: string
          state: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          entry_page?: string | null
          exit_page?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_seen?: string | null
          latitude?: number | null
          longitude?: number | null
          onesignal_player_id?: string | null
          os?: string | null
          page_url?: string | null
          session_duration?: number | null
          session_id: string
          state?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          device_type?: string | null
          entry_page?: string | null
          exit_page?: string | null
          id?: string
          ip_address?: string | null
          is_active?: boolean | null
          last_seen?: string | null
          latitude?: number | null
          longitude?: number | null
          onesignal_player_id?: string | null
          os?: string | null
          page_url?: string | null
          session_duration?: number | null
          session_id?: string
          state?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      mail_attachment_links: {
        Row: {
          created_at: string
          filename: string
          key: string
          mime_type: string | null
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filename: string
          key: string
          mime_type?: string | null
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          filename?: string
          key?: string
          mime_type?: string | null
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      managed_domains: {
        Row: {
          created_at: string
          domain: string
          expires_at: string | null
          id: string
          last_synced_at: string | null
          locked: boolean
          metadata: Json
          nameservers: string[]
          provider: string
          renew_auto: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          locked?: boolean
          metadata?: Json
          nameservers?: string[]
          provider?: string
          renew_auto?: boolean
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          locked?: boolean
          metadata?: Json
          nameservers?: string[]
          provider?: string
          renew_auto?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketing_campaigns: {
        Row: {
          campaign_type: string
          created_at: string | null
          id: string
          message_body: string
          message_title: string
          name: string
          sent_count: number | null
          status: string | null
          target_user_type: string
        }
        Insert: {
          campaign_type: string
          created_at?: string | null
          id?: string
          message_body: string
          message_title: string
          name: string
          sent_count?: number | null
          status?: string | null
          target_user_type: string
        }
        Update: {
          campaign_type?: string
          created_at?: string | null
          id?: string
          message_body?: string
          message_title?: string
          name?: string
          sent_count?: number | null
          status?: string | null
          target_user_type?: string
        }
        Relationships: []
      }
      marketing_content_library: {
        Row: {
          body_template: string
          content_type: string
          created_at: string | null
          email_html: string | null
          email_subject: string | null
          id: string
          is_active: boolean | null
          last_used_at: string | null
          push_body: string | null
          push_title: string | null
          telegram_template: string | null
          title: string
          updated_at: string | null
          use_count: number | null
        }
        Insert: {
          body_template: string
          content_type: string
          created_at?: string | null
          email_html?: string | null
          email_subject?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          push_body?: string | null
          push_title?: string | null
          telegram_template?: string | null
          title: string
          updated_at?: string | null
          use_count?: number | null
        }
        Update: {
          body_template?: string
          content_type?: string
          created_at?: string | null
          email_html?: string | null
          email_subject?: string | null
          id?: string
          is_active?: boolean | null
          last_used_at?: string | null
          push_body?: string | null
          push_title?: string | null
          telegram_template?: string | null
          title?: string
          updated_at?: string | null
          use_count?: number | null
        }
        Relationships: []
      }
      marketing_notification_logs: {
        Row: {
          channels_sent: string[] | null
          content_key: string | null
          id: string
          metadata: Json | null
          notification_type: string
          sent_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          channels_sent?: string[] | null
          content_key?: string | null
          id?: string
          metadata?: Json | null
          notification_type: string
          sent_at?: string
          user_id: string
          user_type?: string
        }
        Update: {
          channels_sent?: string[] | null
          content_key?: string | null
          id?: string
          metadata?: Json | null
          notification_type?: string
          sent_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      meta_integrations: {
        Row: {
          access_token_ciphertext: string | null
          account_id: string | null
          account_name: string | null
          account_username: string | null
          created_at: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          picture_url: string | null
          platform: string
          scopes: string[]
          selected_instagram_id: string | null
          selected_page_id: string | null
          selected_phone_number_id: string | null
          selected_waba_id: string | null
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_ciphertext?: string | null
          account_id?: string | null
          account_name?: string | null
          account_username?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          picture_url?: string | null
          platform: string
          scopes?: string[]
          selected_instagram_id?: string | null
          selected_page_id?: string | null
          selected_phone_number_id?: string | null
          selected_waba_id?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_ciphertext?: string | null
          account_id?: string | null
          account_name?: string | null
          account_username?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          picture_url?: string | null
          platform?: string
          scopes?: string[]
          selected_instagram_id?: string | null
          selected_page_id?: string | null
          selected_phone_number_id?: string | null
          selected_waba_id?: string | null
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_webhook_events: {
        Row: {
          event_type: string
          id: string
          payload: Json | null
          received_at: string
          source: string
          summary: string | null
        }
        Insert: {
          event_type: string
          id?: string
          payload?: Json | null
          received_at?: string
          source: string
          summary?: string | null
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json | null
          received_at?: string
          source?: string
          summary?: string | null
        }
        Relationships: []
      }
      meta_whatsapp_messages: {
        Row: {
          body: string | null
          caption: string | null
          contact_name: string | null
          created_at: string
          direction: string
          error: string | null
          id: string
          media_filename: string | null
          media_id: string | null
          media_mime_type: string | null
          message_type: string
          raw: Json | null
          sent_at: string
          status: string
          template_name: string | null
          wa_id: string
          wamid: string | null
        }
        Insert: {
          body?: string | null
          caption?: string | null
          contact_name?: string | null
          created_at?: string
          direction: string
          error?: string | null
          id?: string
          media_filename?: string | null
          media_id?: string | null
          media_mime_type?: string | null
          message_type?: string
          raw?: Json | null
          sent_at?: string
          status?: string
          template_name?: string | null
          wa_id: string
          wamid?: string | null
        }
        Update: {
          body?: string | null
          caption?: string | null
          contact_name?: string | null
          created_at?: string
          direction?: string
          error?: string | null
          id?: string
          media_filename?: string | null
          media_id?: string | null
          media_mime_type?: string | null
          message_type?: string
          raw?: Json | null
          sent_at?: string
          status?: string
          template_name?: string | null
          wa_id?: string
          wamid?: string | null
        }
        Relationships: []
      }
      notification_ai_budget: {
        Row: {
          calls_made: number
          daily_limit: number
          date: string
          id: string
          provider: string
          updated_at: string
        }
        Insert: {
          calls_made?: number
          daily_limit?: number
          date?: string
          id?: string
          provider?: string
          updated_at?: string
        }
        Update: {
          calls_made?: number
          daily_limit?: number
          date?: string
          id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_ai_variants: {
        Row: {
          audience: string
          channel: string
          created_at: string
          event_type: string
          expires_at: string
          html_content: string | null
          id: string
          language: string
          last_used_at: string | null
          message: string
          title: string | null
          use_count: number
          variables_signature: string
        }
        Insert: {
          audience?: string
          channel: string
          created_at?: string
          event_type: string
          expires_at?: string
          html_content?: string | null
          id?: string
          language?: string
          last_used_at?: string | null
          message: string
          title?: string | null
          use_count?: number
          variables_signature?: string
        }
        Update: {
          audience?: string
          channel?: string
          created_at?: string
          event_type?: string
          expires_at?: string
          html_content?: string | null
          id?: string
          language?: string
          last_used_at?: string | null
          message?: string
          title?: string | null
          use_count?: number
          variables_signature?: string
        }
        Relationships: []
      }
      notification_dedupe: {
        Row: {
          channel: string
          created_at: string
          dedupe_key: string
          template_key: string | null
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          dedupe_key: string
          template_key?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          dedupe_key?: string
          template_key?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notification_engagement_events: {
        Row: {
          action: string
          channel: string
          day_of_week: number | null
          event_type: string
          hour_of_day: number | null
          id: string
          message_log_id: string | null
          metadata: Json | null
          occurred_at: string
          user_agent: string | null
          user_id: string | null
          variant_id: string | null
        }
        Insert: {
          action: string
          channel: string
          day_of_week?: number | null
          event_type: string
          hour_of_day?: number | null
          id?: string
          message_log_id?: string | null
          metadata?: Json | null
          occurred_at?: string
          user_agent?: string | null
          user_id?: string | null
          variant_id?: string | null
        }
        Update: {
          action?: string
          channel?: string
          day_of_week?: number | null
          event_type?: string
          hour_of_day?: number | null
          id?: string
          message_log_id?: string | null
          metadata?: Json | null
          occurred_at?: string
          user_agent?: string | null
          user_id?: string | null
          variant_id?: string | null
        }
        Relationships: []
      }
      notification_trigger_queue: {
        Row: {
          created_at: string | null
          error_message: string | null
          event_type: string
          id: string
          metadata: Json | null
          processed_at: string | null
          status: string | null
          user_id: string
          user_name: string | null
          user_type: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          status?: string | null
          user_id: string
          user_name?: string | null
          user_type?: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          processed_at?: string | null
          status?: string | null
          user_id?: string
          user_name?: string | null
          user_type?: string
        }
        Relationships: []
      }
      notification_variant_performance: {
        Row: {
          audience: string | null
          channel: string
          clicked_count: number
          converted_count: number
          ctr: number | null
          dismissed_count: number
          event_type: string
          language: string | null
          last_scored_at: string
          open_rate: number | null
          opened_count: number
          score: number
          sent_count: number
          variant_id: string
        }
        Insert: {
          audience?: string | null
          channel: string
          clicked_count?: number
          converted_count?: number
          ctr?: number | null
          dismissed_count?: number
          event_type: string
          language?: string | null
          last_scored_at?: string
          open_rate?: number | null
          opened_count?: number
          score?: number
          sent_count?: number
          variant_id: string
        }
        Update: {
          audience?: string | null
          channel?: string
          clicked_count?: number
          converted_count?: number
          ctr?: number | null
          dismissed_count?: number
          event_type?: string
          language?: string | null
          last_scored_at?: string
          open_rate?: number | null
          opened_count?: number
          score?: number
          sent_count?: number
          variant_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          message: string
          metadata: Json | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          metadata?: Json | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      onesignal_automation_rules: {
        Row: {
          action_url_template: string | null
          created_at: string | null
          created_by: string | null
          delay_minutes: number | null
          description: string | null
          execution_count: number | null
          icon_url: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          last_executed_at: string | null
          message_template: string
          name: string
          target_user_type: string | null
          title_template: string
          trigger_conditions: Json | null
          trigger_event: string
          updated_at: string | null
          variable_mapping: Json | null
        }
        Insert: {
          action_url_template?: string | null
          created_at?: string | null
          created_by?: string | null
          delay_minutes?: number | null
          description?: string | null
          execution_count?: number | null
          icon_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          last_executed_at?: string | null
          message_template?: string
          name: string
          target_user_type?: string | null
          title_template?: string
          trigger_conditions?: Json | null
          trigger_event: string
          updated_at?: string | null
          variable_mapping?: Json | null
        }
        Update: {
          action_url_template?: string | null
          created_at?: string | null
          created_by?: string | null
          delay_minutes?: number | null
          description?: string | null
          execution_count?: number | null
          icon_url?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          last_executed_at?: string | null
          message_template?: string
          name?: string
          target_user_type?: string | null
          title_template?: string
          trigger_conditions?: Json | null
          trigger_event?: string
          updated_at?: string | null
          variable_mapping?: Json | null
        }
        Relationships: []
      }
      onesignal_country_stats: {
        Row: {
          country: string
          created_at: string
          date: string
          engagement_rate: number | null
          id: string
          last_updated: string | null
          total_clicked: number | null
          total_delivered: number | null
          total_sent: number | null
        }
        Insert: {
          country: string
          created_at?: string
          date?: string
          engagement_rate?: number | null
          id?: string
          last_updated?: string | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_sent?: number | null
        }
        Update: {
          country?: string
          created_at?: string
          date?: string
          engagement_rate?: number | null
          id?: string
          last_updated?: string | null
          total_clicked?: number | null
          total_delivered?: number | null
          total_sent?: number | null
        }
        Relationships: []
      }
      onesignal_daily_stats: {
        Row: {
          avg_ctr: number | null
          created_at: string
          date: string
          id: string
          total_clicked: number | null
          total_delivered: number | null
          total_sent: number | null
          unique_subscribers: number | null
          updated_at: string
        }
        Insert: {
          avg_ctr?: number | null
          created_at?: string
          date: string
          id?: string
          total_clicked?: number | null
          total_delivered?: number | null
          total_sent?: number | null
          unique_subscribers?: number | null
          updated_at?: string
        }
        Update: {
          avg_ctr?: number | null
          created_at?: string
          date?: string
          id?: string
          total_clicked?: number | null
          total_delivered?: number | null
          total_sent?: number | null
          unique_subscribers?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      onesignal_message_queue: {
        Row: {
          created_at: string | null
          data: Json | null
          error_message: string | null
          id: string
          max_retries: number | null
          message: string
          player_ids: string[]
          priority: number | null
          retry_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          title: string
          updated_at: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          message: string
          player_ids?: string[]
          priority?: number | null
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          message?: string
          player_ids?: string[]
          priority?: number | null
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      onesignal_notification_analytics: {
        Row: {
          clicked_count: number | null
          created_at: string
          ctr_percentage: number | null
          delivered_count: number | null
          id: string
          message: string | null
          notification_id: string
          platform_stats: Json | null
          sent_at: string | null
          sent_count: number | null
          synced_at: string | null
          title: string | null
        }
        Insert: {
          clicked_count?: number | null
          created_at?: string
          ctr_percentage?: number | null
          delivered_count?: number | null
          id?: string
          message?: string | null
          notification_id: string
          platform_stats?: Json | null
          sent_at?: string | null
          sent_count?: number | null
          synced_at?: string | null
          title?: string | null
        }
        Update: {
          clicked_count?: number | null
          created_at?: string
          ctr_percentage?: number | null
          delivered_count?: number | null
          id?: string
          message?: string | null
          notification_id?: string
          platform_stats?: Json | null
          sent_at?: string | null
          sent_count?: number | null
          synced_at?: string | null
          title?: string | null
        }
        Relationships: []
      }
      onesignal_queue_stats: {
        Row: {
          avg_processing_time_ms: number | null
          created_at: string | null
          failed_count: number | null
          id: string
          pending_count: number | null
          processing_count: number | null
          requests_per_second: number | null
          sent_count: number | null
          stat_date: string
          stat_hour: number
          updated_at: string | null
        }
        Insert: {
          avg_processing_time_ms?: number | null
          created_at?: string | null
          failed_count?: number | null
          id?: string
          pending_count?: number | null
          processing_count?: number | null
          requests_per_second?: number | null
          sent_count?: number | null
          stat_date?: string
          stat_hour?: number
          updated_at?: string | null
        }
        Update: {
          avg_processing_time_ms?: number | null
          created_at?: string | null
          failed_count?: number | null
          id?: string
          pending_count?: number | null
          processing_count?: number | null
          requests_per_second?: number | null
          sent_count?: number | null
          stat_date?: string
          stat_hour?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      onesignal_rate_limits: {
        Row: {
          created_at: string | null
          id: string
          last_request_at: string | null
          request_count: number | null
          window_start: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_request_at?: string | null
          request_count?: number | null
          window_start: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_request_at?: string | null
          request_count?: number | null
          window_start?: string
        }
        Relationships: []
      }
      onesignal_sessions: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          last_seen: string | null
          notifications_clicked: number | null
          notifications_sent: number | null
          platform: string | null
          player_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          last_seen?: string | null
          notifications_clicked?: number | null
          notifications_sent?: number | null
          platform?: string | null
          player_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: string
          last_seen?: string | null
          notifications_clicked?: number | null
          notifications_sent?: number | null
          platform?: string | null
          player_id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      otp_codes: {
        Row: {
          code: string
          created_at: string
          expires_at: string
          id: string
          telegram_chat_id: number | null
          telegram_message_id: number | null
          user_id: string
          verified: boolean | null
        }
        Insert: {
          code: string
          created_at?: string
          expires_at: string
          id?: string
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
          user_id: string
          verified?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          telegram_chat_id?: number | null
          telegram_message_id?: number | null
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      outlook_send_usage: {
        Row: {
          sent: number
          user_id: string
          window_kind: string
          window_start: string
        }
        Insert: {
          sent?: number
          user_id: string
          window_kind: string
          window_start: string
        }
        Update: {
          sent?: number
          user_id?: string
          window_kind?: string
          window_start?: string
        }
        Relationships: []
      }
      owner_secrets: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      owner_support_settings: {
        Row: {
          brand_name: string
          business_info: string
          created_at: string
          custom_instructions: string
          enabled: boolean
          language: string
          last_run_at: string | null
          last_run_status: string | null
          max_replies_per_run: number
          only_unread: boolean
          signature: string
          skip_promotions: boolean
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_name?: string
          business_info?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          language?: string
          last_run_at?: string | null
          last_run_status?: string | null
          max_replies_per_run?: number
          only_unread?: boolean
          signature?: string
          skip_promotions?: boolean
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_name?: string
          business_info?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          language?: string
          last_run_at?: string | null
          last_run_status?: string | null
          max_replies_per_run?: number
          only_unread?: boolean
          signature?: string
          skip_promotions?: boolean
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string | null
          id: string
          page_title: string | null
          page_url: string
          session_id: string
          time_spent: number | null
          user_id: string | null
          viewed_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          page_title?: string | null
          page_url: string
          session_id: string
          time_spent?: number | null
          user_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          page_title?: string | null
          page_url?: string
          session_id?: string
          time_spent?: number | null
          user_id?: string | null
          viewed_at?: string | null
        }
        Relationships: []
      }
      passkey_challenges: {
        Row: {
          challenge: string
          challenge_type: string
          created_at: string | null
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          challenge: string
          challenge_type: string
          created_at?: string | null
          expires_at: string
          id?: string
          user_id: string
        }
        Update: {
          challenge?: string
          challenge_type?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token: string
          used: boolean | null
          user_id: string
          user_type: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token: string
          used?: boolean | null
          user_id: string
          user_type: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token?: string
          used?: boolean | null
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          created_at: string
          event_id: string
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
          provider: string
          status: string
        }
        Insert: {
          created_at?: string
          event_id: string
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider: string
          status?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          provider?: string
          status?: string
        }
        Relationships: []
      }
      payment_profiles: {
        Row: {
          address: string | null
          billing_address_2: Json | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          gstin: string | null
          mobile: string | null
          mobile_verified: boolean
          name: string | null
          postal_code: string | null
          shipping_address: Json | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          billing_address_2?: Json | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          mobile?: string | null
          mobile_verified?: boolean
          name?: string | null
          postal_code?: string | null
          shipping_address?: Json | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          billing_address_2?: Json | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          gstin?: string | null
          mobile?: string | null
          mobile_verified?: boolean
          name?: string | null
          postal_code?: string | null
          shipping_address?: Json | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      paypal_payments: {
        Row: {
          amount_inr: number
          amount_usd: number
          capture_id: string | null
          captured_at: string | null
          created_at: string
          currency: string
          error_description: string | null
          id: string
          label: string
          last_event: string | null
          last_event_id: string | null
          payer_email: string | null
          payer_id: string | null
          payer_name: string | null
          paypal_order_id: string
          product: string | null
          refunded_usd: number
          refunds: Json
          rzp_order_id: string
          status: string
          updated_at: string
          user_id: string
          webhook_verified: boolean
        }
        Insert: {
          amount_inr?: number
          amount_usd?: number
          capture_id?: string | null
          captured_at?: string | null
          created_at?: string
          currency?: string
          error_description?: string | null
          id?: string
          label?: string
          last_event?: string | null
          last_event_id?: string | null
          payer_email?: string | null
          payer_id?: string | null
          payer_name?: string | null
          paypal_order_id: string
          product?: string | null
          refunded_usd?: number
          refunds?: Json
          rzp_order_id: string
          status?: string
          updated_at?: string
          user_id: string
          webhook_verified?: boolean
        }
        Update: {
          amount_inr?: number
          amount_usd?: number
          capture_id?: string | null
          captured_at?: string | null
          created_at?: string
          currency?: string
          error_description?: string | null
          id?: string
          label?: string
          last_event?: string | null
          last_event_id?: string | null
          payer_email?: string | null
          payer_id?: string | null
          payer_name?: string | null
          paypal_order_id?: string
          product?: string | null
          refunded_usd?: number
          refunds?: Json
          rzp_order_id?: string
          status?: string
          updated_at?: string
          user_id?: string
          webhook_verified?: boolean
        }
        Relationships: []
      }
      paypal_wallet_balances: {
        Row: {
          balance_cents: number
          credited_cents: number
          currency: string
          debited_cents: number
          last_event_created_at: string | null
          updated_at: string
        }
        Insert: {
          balance_cents?: number
          credited_cents?: number
          currency: string
          debited_cents?: number
          last_event_created_at?: string | null
          updated_at?: string
        }
        Update: {
          balance_cents?: number
          credited_cents?: number
          currency?: string
          debited_cents?: number
          last_event_created_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pending_payments: {
        Row: {
          amount_inr: number
          created_at: string
          id: string
          payload: Json
          purpose: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          result: Json | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_inr: number
          created_at?: string
          id?: string
          payload?: Json
          purpose: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          result?: Json | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_inr?: number
          created_at?: string
          id?: string
          payload?: Json
          purpose?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          result?: Json | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          brand_name: string | null
          brand_tagline: string | null
          created_at: string
          favicon_url: string | null
          id: string
          logo_dark_url: string | null
          logo_url: string | null
          og_description: string | null
          og_image_url: string | null
          og_title: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
        }
        Insert: {
          brand_name?: string | null
          brand_tagline?: string | null
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_dark_url?: string | null
          logo_url?: string | null
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Update: {
          brand_name?: string | null
          brand_tagline?: string | null
          created_at?: string
          favicon_url?: string | null
          id?: string
          logo_dark_url?: string | null
          logo_url?: string | null
          og_description?: string | null
          og_image_url?: string | null
          og_title?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proactive_engagement_schedule: {
        Row: {
          attempts: number
          body: string | null
          channel: string
          created_at: string
          created_run_id: string | null
          day_key: string | null
          id: string
          image_url: string | null
          language: string | null
          last_error: string | null
          message_type: string
          metadata: Json
          scheduled_at: string
          sent_at: string | null
          status: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          body?: string | null
          channel: string
          created_at?: string
          created_run_id?: string | null
          day_key?: string | null
          id?: string
          image_url?: string | null
          language?: string | null
          last_error?: string | null
          message_type: string
          metadata?: Json
          scheduled_at: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          body?: string | null
          channel?: string
          created_at?: string
          created_run_id?: string | null
          day_key?: string | null
          id?: string
          image_url?: string | null
          language?: string | null
          last_error?: string | null
          message_type?: string
          metadata?: Json
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      professional_experiences: {
        Row: {
          company: string | null
          created_at: string
          description: string | null
          end_date: string | null
          experience_years: number | null
          id: string
          is_current: boolean | null
          position: string
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          experience_years?: number | null
          id?: string
          is_current?: boolean | null
          position: string
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          experience_years?: number | null
          id?: string
          is_current?: boolean | null
          position?: string
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profile_reminder_logs: {
        Row: {
          channels_sent: string[] | null
          created_at: string
          id: string
          reminder_month: string
          sent_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          channels_sent?: string[] | null
          created_at?: string
          id?: string
          reminder_month: string
          sent_at?: string
          user_id: string
          user_type?: string
        }
        Update: {
          channels_sent?: string[] | null
          created_at?: string
          id?: string
          reminder_month?: string
          sent_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          account_status_reason: string | null
          bio: string | null
          city: string | null
          company: string | null
          country: string | null
          created_at: string
          current_position: string | null
          date_of_birth: string | null
          education: string | null
          email: string | null
          experience_level: number | null
          experience_years: number | null
          facebook_link: string | null
          fingerprint_change_count: number | null
          fingerprint_changed_at: string | null
          first_ip: string | null
          full_name: string | null
          gender: string | null
          github_link: string | null
          gitlab_link: string | null
          id: string
          industry: string | null
          instagram_link: string | null
          is_profile_complete: boolean | null
          job_type: string | null
          languages: string[] | null
          last_fingerprint_hash: string | null
          last_ip: string | null
          last_login_at: string | null
          last_login_ip: string | null
          latitude: number | null
          linkedin_link: string | null
          location: string | null
          location_last_updated: string | null
          login_count: number | null
          longitude: number | null
          onesignal_player_id: string | null
          phone: string | null
          postal_code: string | null
          precise_address: string | null
          preferred_location: string | null
          previous_fingerprint_hash: string | null
          profile_image_url: string | null
          public_slug: string | null
          short_id: string | null
          skills: string[] | null
          state: string | null
          telegram_chat_id: number | null
          telegram_connect_code: string | null
          telegram_connected_at: string | null
          telegram_id: number | null
          telegram_notifications_enabled: boolean | null
          telegram_username: string | null
          total_unique_ips: number | null
          updated_at: string
          user_id: string
          user_ip_history: Json | null
          whatsapp_number: string | null
          whatsapp_verified: boolean | null
          youtube_link: string | null
        }
        Insert: {
          account_status?: string
          account_status_reason?: string | null
          bio?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          current_position?: string | null
          date_of_birth?: string | null
          education?: string | null
          email?: string | null
          experience_level?: number | null
          experience_years?: number | null
          facebook_link?: string | null
          fingerprint_change_count?: number | null
          fingerprint_changed_at?: string | null
          first_ip?: string | null
          full_name?: string | null
          gender?: string | null
          github_link?: string | null
          gitlab_link?: string | null
          id?: string
          industry?: string | null
          instagram_link?: string | null
          is_profile_complete?: boolean | null
          job_type?: string | null
          languages?: string[] | null
          last_fingerprint_hash?: string | null
          last_ip?: string | null
          last_login_at?: string | null
          last_login_ip?: string | null
          latitude?: number | null
          linkedin_link?: string | null
          location?: string | null
          location_last_updated?: string | null
          login_count?: number | null
          longitude?: number | null
          onesignal_player_id?: string | null
          phone?: string | null
          postal_code?: string | null
          precise_address?: string | null
          preferred_location?: string | null
          previous_fingerprint_hash?: string | null
          profile_image_url?: string | null
          public_slug?: string | null
          short_id?: string | null
          skills?: string[] | null
          state?: string | null
          telegram_chat_id?: number | null
          telegram_connect_code?: string | null
          telegram_connected_at?: string | null
          telegram_id?: number | null
          telegram_notifications_enabled?: boolean | null
          telegram_username?: string | null
          total_unique_ips?: number | null
          updated_at?: string
          user_id: string
          user_ip_history?: Json | null
          whatsapp_number?: string | null
          whatsapp_verified?: boolean | null
          youtube_link?: string | null
        }
        Update: {
          account_status?: string
          account_status_reason?: string | null
          bio?: string | null
          city?: string | null
          company?: string | null
          country?: string | null
          created_at?: string
          current_position?: string | null
          date_of_birth?: string | null
          education?: string | null
          email?: string | null
          experience_level?: number | null
          experience_years?: number | null
          facebook_link?: string | null
          fingerprint_change_count?: number | null
          fingerprint_changed_at?: string | null
          first_ip?: string | null
          full_name?: string | null
          gender?: string | null
          github_link?: string | null
          gitlab_link?: string | null
          id?: string
          industry?: string | null
          instagram_link?: string | null
          is_profile_complete?: boolean | null
          job_type?: string | null
          languages?: string[] | null
          last_fingerprint_hash?: string | null
          last_ip?: string | null
          last_login_at?: string | null
          last_login_ip?: string | null
          latitude?: number | null
          linkedin_link?: string | null
          location?: string | null
          location_last_updated?: string | null
          login_count?: number | null
          longitude?: number | null
          onesignal_player_id?: string | null
          phone?: string | null
          postal_code?: string | null
          precise_address?: string | null
          preferred_location?: string | null
          previous_fingerprint_hash?: string | null
          profile_image_url?: string | null
          public_slug?: string | null
          short_id?: string | null
          skills?: string[] | null
          state?: string | null
          telegram_chat_id?: number | null
          telegram_connect_code?: string | null
          telegram_connected_at?: string | null
          telegram_id?: number | null
          telegram_notifications_enabled?: boolean | null
          telegram_username?: string | null
          total_unique_ips?: number | null
          updated_at?: string
          user_id?: string
          user_ip_history?: Json | null
          whatsapp_number?: string | null
          whatsapp_verified?: boolean | null
          youtube_link?: string | null
        }
        Relationships: []
      }
      push_lifecycle_templates: {
        Row: {
          body: string
          button_text: string | null
          button_url: string | null
          created_at: string
          enabled: boolean
          event_type: string
          icon_url: string | null
          id: string
          image_url: string | null
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: string
          button_text?: string | null
          button_url?: string | null
          created_at?: string
          enabled?: boolean
          event_type: string
          icon_url?: string | null
          id?: string
          image_url?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: string
          button_text?: string | null
          button_url?: string | null
          created_at?: string
          enabled?: boolean
          event_type?: string
          icon_url?: string | null
          id?: string
          image_url?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      push_notification_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          notification_id: string | null
          onesignal_id: string | null
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          onesignal_id?: string | null
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          notification_id?: string | null
          onesignal_id?: string | null
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notification_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "employer_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notification_preferences: {
        Row: {
          created_at: string
          id: string
          interview_reminders: boolean
          job_alerts: boolean
          job_applications: boolean
          system_notifications: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          interview_reminders?: boolean
          job_alerts?: boolean
          job_applications?: boolean
          system_notifications?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          interview_reminders?: boolean
          job_alerts?: boolean
          job_applications?: boolean
          system_notifications?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          device_info: Json
          enabled: boolean
          fcm_token: string
          id: string
          last_seen_at: string
          platform: string
          updated_at: string
          user_id: string
          user_role: string
        }
        Insert: {
          created_at?: string
          device_info?: Json
          enabled?: boolean
          fcm_token: string
          id?: string
          last_seen_at?: string
          platform?: string
          updated_at?: string
          user_id: string
          user_role?: string
        }
        Update: {
          created_at?: string
          device_info?: Json
          enabled?: boolean
          fcm_token?: string
          id?: string
          last_seen_at?: string
          platform?: string
          updated_at?: string
          user_id?: string
          user_role?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          action_type: string
          attempts: number
          created_at: string
          id: string
          last_attempt: string
          user_id: string
          window_start: string
        }
        Insert: {
          action_type: string
          attempts?: number
          created_at?: string
          id?: string
          last_attempt?: string
          user_id: string
          window_start?: string
        }
        Update: {
          action_type?: string
          attempts?: number
          created_at?: string
          id?: string
          last_attempt?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      razorpay_customer_payments: {
        Row: {
          amount: number | null
          captured_at: string | null
          created_at: string
          currency: string
          customer_id: string | null
          error_code: string | null
          error_description: string | null
          id: string
          last_event: string | null
          method: string | null
          order_id: string
          payment_id: string | null
          paypal_capture_id: string | null
          paypal_order_id: string | null
          purpose: string | null
          status: string
          updated_at: string
          user_id: string
          webhook_verified: boolean
        }
        Insert: {
          amount?: number | null
          captured_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          error_code?: string | null
          error_description?: string | null
          id?: string
          last_event?: string | null
          method?: string | null
          order_id: string
          payment_id?: string | null
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          purpose?: string | null
          status?: string
          updated_at?: string
          user_id: string
          webhook_verified?: boolean
        }
        Update: {
          amount?: number | null
          captured_at?: string | null
          created_at?: string
          currency?: string
          customer_id?: string | null
          error_code?: string | null
          error_description?: string | null
          id?: string
          last_event?: string | null
          method?: string | null
          order_id?: string
          payment_id?: string | null
          paypal_capture_id?: string | null
          paypal_order_id?: string | null
          purpose?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          webhook_verified?: boolean
        }
        Relationships: []
      }
      razorpay_customers: {
        Row: {
          attempts: number
          contact: string | null
          created_at: string
          customer_id: string | null
          email: string | null
          id: string
          last_error: string | null
          mode: string
          name: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          contact?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          id?: string
          last_error?: string | null
          mode?: string
          name?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          contact?: string | null
          created_at?: string
          customer_id?: string | null
          email?: string | null
          id?: string
          last_error?: string | null
          mode?: string
          name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      razorpay_events: {
        Row: {
          account_id: string | null
          amount_paise: number | null
          category: string
          contact: string | null
          created_at: string
          currency: string | null
          email: string | null
          entity_id: string | null
          entity_type: string | null
          error_code: string | null
          error_description: string | null
          event_created_at: string | null
          event_id: string | null
          event_type: string
          handled: boolean
          handler_note: string | null
          id: string
          notes: Json | null
          payload: Json
          signature_verified: boolean
          status: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount_paise?: number | null
          category?: string
          contact?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          error_description?: string | null
          event_created_at?: string | null
          event_id?: string | null
          event_type: string
          handled?: boolean
          handler_note?: string | null
          id?: string
          notes?: Json | null
          payload?: Json
          signature_verified?: boolean
          status?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount_paise?: number | null
          category?: string
          contact?: string | null
          created_at?: string
          currency?: string | null
          email?: string | null
          entity_id?: string | null
          entity_type?: string | null
          error_code?: string | null
          error_description?: string | null
          event_created_at?: string | null
          event_id?: string | null
          event_type?: string
          handled?: boolean
          handler_note?: string | null
          id?: string
          notes?: Json | null
          payload?: Json
          signature_verified?: boolean
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      razorpay_invoices: {
        Row: {
          amount: number | null
          created_at: string
          currency: string | null
          customer_email: string | null
          customer_name: string | null
          id: string
          invoice_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          last_error: string | null
          mode: string
          order_id: string | null
          payment_id: string
          payment_status: string | null
          refund_status: string | null
          short_url: string | null
          status: string
          tax_amount: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          invoice_date?: string | null
          invoice_id?: string | null
          invoice_number?: string | null
          last_error?: string | null
          mode?: string
          order_id?: string | null
          payment_id: string
          payment_status?: string | null
          refund_status?: string | null
          short_url?: string | null
          status?: string
          tax_amount?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string | null
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          invoice_date?: string | null
          invoice_id?: string | null
          invoice_number?: string | null
          last_error?: string | null
          mode?: string
          order_id?: string | null
          payment_id?: string
          payment_status?: string | null
          refund_status?: string | null
          short_url?: string | null
          status?: string
          tax_amount?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reactive_resume_config: {
        Row: {
          api_url: string
          created_at: string
          id: string
          is_active: boolean | null
          updated_at: string
        }
        Insert: {
          api_url: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Update: {
          api_url?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      recruitment_inquiries: {
        Row: {
          company_name: string | null
          created_at: string
          email: string
          id: string
          inquiry_type: string
          message: string
          name: string
          phone: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string
          email: string
          id?: string
          inquiry_type: string
          message: string
          name: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string
          email?: string
          id?: string
          inquiry_type?: string
          message?: string
          name?: string
          phone?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      recruitment_packages: {
        Row: {
          created_at: string
          description: string
          display_order: number | null
          features: string[]
          id: string
          is_active: boolean | null
          is_recommended: boolean | null
          name: string
          period: string
          price: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          display_order?: number | null
          features?: string[]
          id?: string
          is_active?: boolean | null
          is_recommended?: boolean | null
          name: string
          period: string
          price: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number | null
          features?: string[]
          id?: string
          is_active?: boolean | null
          is_recommended?: boolean | null
          name?: string
          period?: string
          price?: string
          updated_at?: string
        }
        Relationships: []
      }
      recruitment_solutions: {
        Row: {
          created_at: string
          description: string
          display_order: number | null
          features: string[]
          icon_name: string
          id: string
          is_active: boolean | null
          is_popular: boolean | null
          price: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          display_order?: number | null
          features?: string[]
          icon_name: string
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          price: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          display_order?: number | null
          features?: string[]
          icon_name?: string
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          price?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      recruitment_testimonials: {
        Row: {
          company: string
          created_at: string
          feedback: string
          id: string
          is_active: boolean | null
          is_verified: boolean | null
          name: string
          position: string
          rating: number
          updated_at: string
        }
        Insert: {
          company: string
          created_at?: string
          feedback: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          name: string
          position: string
          rating?: number
          updated_at?: string
        }
        Update: {
          company?: string
          created_at?: string
          feedback?: string
          id?: string
          is_active?: boolean | null
          is_verified?: boolean | null
          name?: string
          position?: string
          rating?: number
          updated_at?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          referral_code: string
          total_commission_earned: number
          total_referrals: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          referral_code: string
          total_commission_earned?: number
          total_referrals?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          referral_code?: string
          total_commission_earned?: number
          total_referrals?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_commissions: {
        Row: {
          commission_amount: number
          created_at: string
          cycle_id: string | null
          id: string
          payment_id: string | null
          referred_user_id: string
          referrer_id: string
          source_payment_amount: number
          source_type: string
          status: string
          updated_at: string
        }
        Insert: {
          commission_amount: number
          created_at?: string
          cycle_id?: string | null
          id?: string
          payment_id?: string | null
          referred_user_id: string
          referrer_id: string
          source_payment_amount: number
          source_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          commission_amount?: number
          created_at?: string
          cycle_id?: string | null
          id?: string
          payment_id?: string | null
          referred_user_id?: string
          referrer_id?: string
          source_payment_amount?: number
          source_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_commissions_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_competition_cycles: {
        Row: {
          created_at: string | null
          cycle_name: string
          end_date: string
          id: string
          prizes_distributed: boolean | null
          start_date: string
          status: string
          total_participants: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cycle_name: string
          end_date: string
          id?: string
          prizes_distributed?: boolean | null
          start_date: string
          status?: string
          total_participants?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cycle_name?: string
          end_date?: string
          id?: string
          prizes_distributed?: boolean | null
          start_date?: string
          status?: string
          total_participants?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      referral_competition_leaderboard: {
        Row: {
          active_referrals_count: number | null
          created_at: string | null
          cycle_id: string | null
          id: string
          is_prize_paid: boolean | null
          prize_won: number | null
          rank: number | null
          referral_count: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_referrals_count?: number | null
          created_at?: string | null
          cycle_id?: string | null
          id?: string
          is_prize_paid?: boolean | null
          prize_won?: number | null
          rank?: number | null
          referral_count?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_referrals_count?: number | null
          created_at?: string | null
          cycle_id?: string | null
          id?: string
          is_prize_paid?: boolean | null
          prize_won?: number | null
          rank?: number | null
          referral_count?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_competition_leaderboard_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "referral_competition_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_competition_prizes: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          prize_amount: number
          rank: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          prize_amount: number
          rank: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          prize_amount?: number
          rank?: number
          updated_at?: string
        }
        Relationships: []
      }
      referral_leaderboard_cycles: {
        Row: {
          created_at: string
          cycle_end: string
          cycle_start: string
          id: string
          status: Database["public"]["Enums"]["referral_cycle_status"]
          updated_at: string
          winners_announced: boolean
        }
        Insert: {
          created_at?: string
          cycle_end: string
          cycle_start: string
          id?: string
          status?: Database["public"]["Enums"]["referral_cycle_status"]
          updated_at?: string
          winners_announced?: boolean
        }
        Update: {
          created_at?: string
          cycle_end?: string
          cycle_start?: string
          id?: string
          status?: Database["public"]["Enums"]["referral_cycle_status"]
          updated_at?: string
          winners_announced?: boolean
        }
        Relationships: []
      }
      referral_leaderboard_entries: {
        Row: {
          active_referrals_count: number
          created_at: string
          cycle_id: string
          id: string
          last_referral_at: string | null
          rank: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_referrals_count?: number
          created_at?: string
          cycle_id: string
          id?: string
          last_referral_at?: string | null
          rank?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_referrals_count?: number
          created_at?: string
          cycle_id?: string
          id?: string
          last_referral_at?: string | null
          rank?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_leaderboard_entries_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_leaderboard_history: {
        Row: {
          active_referrals_count: number
          company_name: string | null
          created_at: string
          cycle_end: string | null
          cycle_id: string
          cycle_start: string | null
          final_rank: number
          id: string
          reward_amount: number
          reward_credited: boolean
          user_id: string
        }
        Insert: {
          active_referrals_count: number
          company_name?: string | null
          created_at?: string
          cycle_end?: string | null
          cycle_id: string
          cycle_start?: string | null
          final_rank: number
          id?: string
          reward_amount?: number
          reward_credited?: boolean
          user_id: string
        }
        Update: {
          active_referrals_count?: number
          company_name?: string | null
          created_at?: string
          cycle_end?: string | null
          cycle_id?: string
          cycle_start?: string | null
          final_rank?: number
          id?: string
          reward_amount?: number
          reward_credited?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_leaderboard_history_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "referral_leaderboard_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_payment_settings: {
        Row: {
          account_number: string | null
          bank_name: string | null
          created_at: string | null
          email: string | null
          id: string
          ifsc_code: string | null
          mobile: string | null
          name: string | null
          updated_at: string | null
          upi_id: string | null
          user_id: string
        }
        Insert: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          ifsc_code?: string | null
          mobile?: string | null
          name?: string | null
          updated_at?: string | null
          upi_id?: string | null
          user_id: string
        }
        Update: {
          account_number?: string | null
          bank_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          ifsc_code?: string | null
          mobile?: string | null
          name?: string | null
          updated_at?: string | null
          upi_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referral_profiles: {
        Row: {
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          display_name: string | null
          id: string
          occupation: string | null
          phone: string | null
          photo_url: string | null
          postal_code: string | null
          precise_address: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          occupation?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          precise_address?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          occupation?: string | null
          phone?: string | null
          photo_url?: string | null
          postal_code?: string | null
          precise_address?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_settings: {
        Row: {
          commission_calculation_method: string
          commission_percentage: number
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          maximum_commission_amount: number | null
          minimum_commission_amount: number | null
          updated_at: string
        }
        Insert: {
          commission_calculation_method?: string
          commission_percentage?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          maximum_commission_amount?: number | null
          minimum_commission_amount?: number | null
          updated_at?: string
        }
        Update: {
          commission_calculation_method?: string
          commission_percentage?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          maximum_commission_amount?: number | null
          minimum_commission_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      referral_wallet_adjustments: {
        Row: {
          adjustment_type: string
          admin_id: string
          amount: number
          balance_after: number | null
          balance_before: number | null
          created_at: string
          id: string
          reason: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustment_type: string
          admin_id: string
          amount: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          id?: string
          reason: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustment_type?: string
          admin_id?: string
          amount?: number
          balance_after?: number | null
          balance_before?: number | null
          created_at?: string
          id?: string
          reason?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_wallets: {
        Row: {
          balance_amount: number
          created_at: string
          id: string
          total_earned: number
          total_withdrawn: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_amount?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_amount?: number
          created_at?: string
          id?: string
          total_earned?: number
          total_withdrawn?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_withdrawal_requests: {
        Row: {
          amount: number
          created_at: string | null
          failure_reason: string | null
          id: string
          payment_settings: Json | null
          processed_at: string | null
          processed_by: string | null
          status: string | null
          updated_at: string | null
          user_id: string
          withdrawal_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          payment_settings?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
          withdrawal_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          payment_settings?: Json | null
          processed_at?: string | null
          processed_by?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          withdrawal_id?: string
        }
        Relationships: []
      }
      resume_drafts: {
        Row: {
          created_at: string
          data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          user_id?: string
        }
        Relationships: []
      }
      search_history: {
        Row: {
          created_at: string | null
          filters: Json | null
          id: string
          results_count: number | null
          search_query: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          results_count?: number | null
          search_query: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          results_count?: number | null
          search_query?: string
          user_id?: string | null
        }
        Relationships: []
      }
      secrets_management: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          last_updated_at: string | null
          secret_key: string
          used_by_functions: string[] | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_updated_at?: string | null
          secret_key: string
          used_by_functions?: string[] | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          last_updated_at?: string | null
          secret_key?: string
          used_by_functions?: string[] | null
        }
        Relationships: []
      }
      service_health_checks: {
        Row: {
          checked_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          response_time_ms: number | null
          service_name: string
          status: string
          status_code: number | null
        }
        Insert: {
          checked_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          response_time_ms?: number | null
          service_name: string
          status: string
          status_code?: number | null
        }
        Update: {
          checked_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          response_time_ms?: number | null
          service_name?: string
          status?: string
          status_code?: number | null
        }
        Relationships: []
      }
      service_health_config: {
        Row: {
          check_method: string | null
          created_at: string | null
          endpoint_url: string
          expected_status_code: number | null
          id: string
          is_active: boolean | null
          is_paused: boolean | null
          keyword_check: string | null
          monitor_type: string | null
          service_name: string
          timeout_ms: number | null
          updated_at: string | null
        }
        Insert: {
          check_method?: string | null
          created_at?: string | null
          endpoint_url: string
          expected_status_code?: number | null
          id?: string
          is_active?: boolean | null
          is_paused?: boolean | null
          keyword_check?: string | null
          monitor_type?: string | null
          service_name: string
          timeout_ms?: number | null
          updated_at?: string | null
        }
        Update: {
          check_method?: string | null
          created_at?: string | null
          endpoint_url?: string
          expected_status_code?: number | null
          id?: string
          is_active?: boolean | null
          is_paused?: boolean | null
          keyword_check?: string | null
          monitor_type?: string | null
          service_name?: string
          timeout_ms?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      service_incidents: {
        Row: {
          created_at: string | null
          duration_seconds: number | null
          ended_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          root_cause: string | null
          service_name: string
          started_at: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          root_cause?: string | null
          service_name: string
          started_at?: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          root_cause?: string | null
          service_name?: string
          started_at?: string
          status?: string | null
        }
        Relationships: []
      }
      signup_email_otps: {
        Row: {
          attempts: number
          audience: string
          code_hash: string
          created_at: string
          email: string
          expires_at: string
          id: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          audience: string
          code_hash: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          audience?: string
          code_hash?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          verified?: boolean
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      sitemap_cache: {
        Row: {
          created_at: string | null
          expires_at: string
          type: string
          updated_at: string | null
          xml_content: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          type: string
          updated_at?: string | null
          xml_content: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          type?: string
          updated_at?: string | null
          xml_content?: string
        }
        Relationships: []
      }
      skill_assessments: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          difficulty: string
          duration_minutes: number
          id: string
          is_active: boolean
          passing_score: number
          slug: string
          title: string
          total_questions: number
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          difficulty: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          passing_score?: number
          slug: string
          title: string
          total_questions?: number
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          difficulty?: string
          duration_minutes?: number
          id?: string
          is_active?: boolean
          passing_score?: number
          slug?: string
          title?: string
          total_questions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_assessments_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "skill_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      skill_categories: {
        Row: {
          created_at: string
          description: string
          difficulty: string
          display_order: number
          duration: string
          icon_name: string
          id: string
          is_active: boolean
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          difficulty: string
          display_order?: number
          duration: string
          icon_name: string
          id?: string
          is_active?: boolean
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          difficulty?: string
          display_order?: number
          duration?: string
          icon_name?: string
          id?: string
          is_active?: boolean
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_autoreply_log: {
        Row: {
          account_id: string
          author_name: string | null
          comment_text: string | null
          created_at: string
          error: string | null
          id: string
          platform: string
          post_id: string | null
          post_text: string | null
          reply_text: string | null
          status: string
          target_id: string
          user_id: string
        }
        Insert: {
          account_id?: string
          author_name?: string | null
          comment_text?: string | null
          created_at?: string
          error?: string | null
          id?: string
          platform: string
          post_id?: string | null
          post_text?: string | null
          reply_text?: string | null
          status?: string
          target_id: string
          user_id: string
        }
        Update: {
          account_id?: string
          author_name?: string | null
          comment_text?: string | null
          created_at?: string
          error?: string | null
          id?: string
          platform?: string
          post_id?: string | null
          post_text?: string | null
          reply_text?: string | null
          status?: string
          target_id?: string
          user_id?: string
        }
        Relationships: []
      }
      social_autoreply_settings: {
        Row: {
          account_id: string
          created_at: string
          custom_instructions: string
          enabled: boolean
          id: string
          language: string
          last_run_at: string | null
          last_run_status: string | null
          max_replies_per_run: number
          platform: string
          reply_length: string
          reply_scope: string
          signature: string
          skip_negative: boolean
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          id?: string
          language?: string
          last_run_at?: string | null
          last_run_status?: string | null
          max_replies_per_run?: number
          platform: string
          reply_length?: string
          reply_scope?: string
          signature?: string
          skip_negative?: boolean
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          id?: string
          language?: string
          last_run_at?: string | null
          last_run_status?: string | null
          max_replies_per_run?: number
          platform?: string
          reply_length?: string
          reply_scope?: string
          signature?: string
          skip_negative?: boolean
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_connections: {
        Row: {
          access_token: string | null
          account_email: string | null
          account_handle: string | null
          account_id: string
          account_name: string | null
          account_picture: string | null
          can_post: boolean
          created_at: string
          followers_count: number | null
          following_count: number | null
          id: string
          is_default: boolean
          last_synced_at: string | null
          platform: string
          posts_count: number | null
          profile_data: Json
          refresh_token: string | null
          scopes: string | null
          token_expires_at: string | null
          token_secret: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_email?: string | null
          account_handle?: string | null
          account_id?: string
          account_name?: string | null
          account_picture?: string | null
          can_post?: boolean
          created_at?: string
          followers_count?: number | null
          following_count?: number | null
          id?: string
          is_default?: boolean
          last_synced_at?: string | null
          platform: string
          posts_count?: number | null
          profile_data?: Json
          refresh_token?: string | null
          scopes?: string | null
          token_expires_at?: string | null
          token_secret?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_email?: string | null
          account_handle?: string | null
          account_id?: string
          account_name?: string | null
          account_picture?: string | null
          can_post?: boolean
          created_at?: string
          followers_count?: number | null
          following_count?: number | null
          id?: string
          is_default?: boolean
          last_synced_at?: string | null
          platform?: string
          posts_count?: number | null
          profile_data?: Json
          refresh_token?: string | null
          scopes?: string | null
          token_expires_at?: string | null
          token_secret?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      social_inbox: {
        Row: {
          author: string | null
          channel_id: string | null
          created_at: string
          id: string
          message_id: string
          platform: string
          text: string | null
          user_id: string
        }
        Insert: {
          author?: string | null
          channel_id?: string | null
          created_at?: string
          id?: string
          message_id: string
          platform: string
          text?: string | null
          user_id: string
        }
        Update: {
          author?: string | null
          channel_id?: string | null
          created_at?: string
          id?: string
          message_id?: string
          platform?: string
          text?: string | null
          user_id?: string
        }
        Relationships: []
      }
      social_meta_accounts: {
        Row: {
          ai_business_info: string | null
          ai_custom_instructions: string | null
          ai_language: string | null
          ai_reply_comments: boolean
          ai_reply_length: string | null
          ai_reply_messages: boolean
          ai_signature: string | null
          ai_tone: string | null
          created_at: string
          id: string
          ig_user_id: string | null
          is_default: boolean
          name: string | null
          page_id: string
          picture_url: string | null
          platform: string
          status: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          ai_business_info?: string | null
          ai_custom_instructions?: string | null
          ai_language?: string | null
          ai_reply_comments?: boolean
          ai_reply_length?: string | null
          ai_reply_messages?: boolean
          ai_signature?: string | null
          ai_tone?: string | null
          created_at?: string
          id?: string
          ig_user_id?: string | null
          is_default?: boolean
          name?: string | null
          page_id: string
          picture_url?: string | null
          platform: string
          status?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          ai_business_info?: string | null
          ai_custom_instructions?: string | null
          ai_language?: string | null
          ai_reply_comments?: boolean
          ai_reply_length?: string | null
          ai_reply_messages?: boolean
          ai_signature?: string | null
          ai_tone?: string | null
          created_at?: string
          id?: string
          ig_user_id?: string | null
          is_default?: boolean
          name?: string | null
          page_id?: string
          picture_url?: string | null
          platform?: string
          status?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      social_meta_message_events: {
        Row: {
          actor_id: string
          attachments: Json | null
          created_at: string
          emoji: string | null
          id: string
          kind: string
          mid: string
          owner_id: string
          platform: string
          reply_to_mid: string | null
        }
        Insert: {
          actor_id?: string
          attachments?: Json | null
          created_at?: string
          emoji?: string | null
          id?: string
          kind: string
          mid: string
          owner_id: string
          platform: string
          reply_to_mid?: string | null
        }
        Update: {
          actor_id?: string
          attachments?: Json | null
          created_at?: string
          emoji?: string | null
          id?: string
          kind?: string
          mid?: string
          owner_id?: string
          platform?: string
          reply_to_mid?: string | null
        }
        Relationships: []
      }
      social_meta_replies: {
        Row: {
          account_id: string
          created_at: string
          error: string | null
          event_id: string
          id: string
          incoming_text: string | null
          kind: string
          platform: string
          reply_text: string | null
          sender_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          account_id: string
          created_at?: string
          error?: string | null
          event_id: string
          id?: string
          incoming_text?: string | null
          kind: string
          platform: string
          reply_text?: string | null
          sender_id?: string | null
          status?: string
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          error?: string | null
          event_id?: string
          id?: string
          incoming_text?: string | null
          kind?: string
          platform?: string
          reply_text?: string | null
          sender_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_meta_replies_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "social_meta_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_meta_tokens: {
        Row: {
          account_id: string
          page_access_token: string
          updated_at: string
        }
        Insert: {
          account_id: string
          page_access_token: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          page_access_token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_meta_tokens_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "social_meta_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_cleanup_log: {
        Row: {
          bucket_id: string
          deleted_at: string
          id: string
          object_name: string
          reason: string
          size_bytes: number | null
        }
        Insert: {
          bucket_id: string
          deleted_at?: string
          id?: string
          object_name: string
          reason?: string
          size_bytes?: number | null
        }
        Update: {
          bucket_id?: string
          deleted_at?: string
          id?: string
          object_name?: string
          reason?: string
          size_bytes?: number | null
        }
        Relationships: []
      }
      storage_protected_paths: {
        Row: {
          bucket_id: string
          created_at: string
          id: string
          note: string | null
          path_prefix: string
        }
        Insert: {
          bucket_id: string
          created_at?: string
          id?: string
          note?: string | null
          path_prefix: string
        }
        Update: {
          bucket_id?: string
          created_at?: string
          id?: string
          note?: string | null
          path_prefix?: string
        }
        Relationships: []
      }
      storage_usage_stats: {
        Row: {
          bucket: string
          file_count: number
          latest_at: string | null
          parent: string | null
          prefix: string
          provider: string
          total_size: number
          updated_at: string
        }
        Insert: {
          bucket: string
          file_count?: number
          latest_at?: string | null
          parent?: string | null
          prefix?: string
          provider: string
          total_size?: number
          updated_at?: string
        }
        Update: {
          bucket?: string
          file_count?: number
          latest_at?: string | null
          parent?: string | null
          prefix?: string
          provider?: string
          total_size?: number
          updated_at?: string
        }
        Relationships: []
      }
      supabase_usage_metrics: {
        Row: {
          created_at: string | null
          id: string
          metadata: Json | null
          metric_date: string
          metric_limit: number | null
          metric_type: string
          metric_value: number
          updated_at: string | null
          usage_percentage: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_date?: string
          metric_limit?: number | null
          metric_type: string
          metric_value?: number
          updated_at?: string | null
          usage_percentage?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_date?: string
          metric_limit?: number | null
          metric_type?: string
          metric_value?: number
          updated_at?: string | null
          usage_percentage?: number | null
        }
        Relationships: []
      }
      supabase_usage_stats: {
        Row: {
          active_sessions: number | null
          cached_egress_bytes: number | null
          created_at: string | null
          database_size_bytes: number | null
          date: string
          edge_function_invocations: number | null
          egress_bytes: number | null
          id: string
          monthly_active_users: number | null
          realtime_messages: number | null
          storage_size_bytes: number | null
        }
        Insert: {
          active_sessions?: number | null
          cached_egress_bytes?: number | null
          created_at?: string | null
          database_size_bytes?: number | null
          date?: string
          edge_function_invocations?: number | null
          egress_bytes?: number | null
          id?: string
          monthly_active_users?: number | null
          realtime_messages?: number | null
          storage_size_bytes?: number | null
        }
        Update: {
          active_sessions?: number | null
          cached_egress_bytes?: number | null
          created_at?: string | null
          database_size_bytes?: number | null
          date?: string
          edge_function_invocations?: number | null
          egress_bytes?: number | null
          id?: string
          monthly_active_users?: number | null
          realtime_messages?: number | null
          storage_size_bytes?: number | null
        }
        Relationships: []
      }
      support_account_reply_settings: {
        Row: {
          account_id: string
          channel: string
          created_at: string
          settings: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string
          channel: string
          created_at?: string
          settings?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          channel?: string
          created_at?: string
          settings?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          ai_attempted_solutions: Json | null
          assigned_to: string | null
          category: string | null
          conversation_context: Json | null
          created_at: string | null
          description: string
          id: string
          priority: string | null
          resolution_notes: string | null
          resolved_at: string | null
          status: string | null
          ticket_number: string
          title: string
          updated_at: string | null
          user_email: string | null
          user_id: string | null
          user_name: string | null
          user_phone: string | null
        }
        Insert: {
          ai_attempted_solutions?: Json | null
          assigned_to?: string | null
          category?: string | null
          conversation_context?: Json | null
          created_at?: string | null
          description: string
          id?: string
          priority?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string | null
          ticket_number: string
          title: string
          updated_at?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_phone?: string | null
        }
        Update: {
          ai_attempted_solutions?: Json | null
          assigned_to?: string | null
          category?: string | null
          conversation_context?: Json | null
          created_at?: string | null
          description?: string
          id?: string
          priority?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          status?: string | null
          ticket_number?: string
          title?: string
          updated_at?: string | null
          user_email?: string | null
          user_id?: string | null
          user_name?: string | null
          user_phone?: string | null
        }
        Relationships: []
      }
      system_roles: {
        Row: {
          base_permissions: Json
          created_at: string
          created_by: string | null
          id: string
          is_custom: boolean
          role_description: string | null
          role_name: string
          updated_at: string
        }
        Insert: {
          base_permissions?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_custom?: boolean
          role_description?: string | null
          role_name: string
          updated_at?: string
        }
        Update: {
          base_permissions?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_custom?: boolean
          role_description?: string | null
          role_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_ai_reply_log: {
        Row: {
          ai_response: string
          chat_id: number
          created_at: string | null
          id: string
          message_id: number | null
          response_time_ms: number | null
          tokens_used: number | null
          user_message: string
          username: string | null
        }
        Insert: {
          ai_response: string
          chat_id: number
          created_at?: string | null
          id?: string
          message_id?: number | null
          response_time_ms?: number | null
          tokens_used?: number | null
          user_message: string
          username?: string | null
        }
        Update: {
          ai_response?: string
          chat_id?: number
          created_at?: string | null
          id?: string
          message_id?: number | null
          response_time_ms?: number | null
          tokens_used?: number | null
          user_message?: string
          username?: string | null
        }
        Relationships: []
      }
      telegram_ai_settings: {
        Row: {
          blacklisted_chat_ids: number[] | null
          business_hours_end: string | null
          business_hours_only: boolean | null
          business_hours_start: string | null
          created_at: string | null
          delay_seconds: number | null
          enabled: boolean | null
          excluded_keywords: string[] | null
          id: string
          max_responses_per_day: number | null
          updated_at: string | null
        }
        Insert: {
          blacklisted_chat_ids?: number[] | null
          business_hours_end?: string | null
          business_hours_only?: boolean | null
          business_hours_start?: string | null
          created_at?: string | null
          delay_seconds?: number | null
          enabled?: boolean | null
          excluded_keywords?: string[] | null
          id?: string
          max_responses_per_day?: number | null
          updated_at?: string | null
        }
        Update: {
          blacklisted_chat_ids?: number[] | null
          business_hours_end?: string | null
          business_hours_only?: boolean | null
          business_hours_start?: string | null
          created_at?: string | null
          delay_seconds?: number | null
          enabled?: boolean | null
          excluded_keywords?: string[] | null
          id?: string
          max_responses_per_day?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      telegram_analytics: {
        Row: {
          active_users: number | null
          campaign_messages: number | null
          created_at: string
          date: string
          id: string
          media_sent: number | null
          messages_received: number | null
          messages_sent: number | null
          new_conversations: number | null
          trigger_messages: number | null
        }
        Insert: {
          active_users?: number | null
          campaign_messages?: number | null
          created_at?: string
          date?: string
          id?: string
          media_sent?: number | null
          messages_received?: number | null
          messages_sent?: number | null
          new_conversations?: number | null
          trigger_messages?: number | null
        }
        Update: {
          active_users?: number | null
          campaign_messages?: number | null
          created_at?: string
          date?: string
          id?: string
          media_sent?: number | null
          messages_received?: number | null
          messages_sent?: number | null
          new_conversations?: number | null
          trigger_messages?: number | null
        }
        Relationships: []
      }
      telegram_audience_bots: {
        Row: {
          audience: string
          bot_token: string | null
          bot_username: string | null
          channel_username: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          audience: string
          bot_token?: string | null
          bot_username?: string | null
          channel_username?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          audience?: string
          bot_token?: string | null
          bot_username?: string | null
          channel_username?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_audience_segments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          filter_criteria: Json | null
          id: string
          is_active: boolean | null
          member_count: number | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter_criteria?: Json | null
          id?: string
          is_active?: boolean | null
          member_count?: number | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          filter_criteria?: Json | null
          id?: string
          is_active?: boolean | null
          member_count?: number | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_automation_rules: {
        Row: {
          created_at: string | null
          created_by: string
          delay_minutes: number | null
          description: string | null
          execution_count: number | null
          id: string
          is_active: boolean | null
          last_executed_at: string | null
          name: string
          target_user_type: string | null
          template_id: string | null
          trigger_conditions: Json | null
          trigger_event: string
          updated_at: string | null
          variable_mapping: Json | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          delay_minutes?: number | null
          description?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name: string
          target_user_type?: string | null
          template_id?: string | null
          trigger_conditions?: Json | null
          trigger_event: string
          updated_at?: string | null
          variable_mapping?: Json | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          delay_minutes?: number | null
          description?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name?: string
          target_user_type?: string | null
          template_id?: string | null
          trigger_conditions?: Json | null
          trigger_event?: string
          updated_at?: string | null
          variable_mapping?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_automation_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "telegram_message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_bot_settings: {
        Row: {
          bot_name: string | null
          bot_username: string | null
          channel_chat_id: number | null
          channel_enabled: boolean | null
          channel_username: string | null
          created_at: string
          growth_agent_enabled: boolean
          growth_daily_target: number
          growth_timezone: string
          growth_website_base_url: string
          id: string
          is_active: boolean | null
          job_channel_template: string | null
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          bot_name?: string | null
          bot_username?: string | null
          channel_chat_id?: number | null
          channel_enabled?: boolean | null
          channel_username?: string | null
          created_at?: string
          growth_agent_enabled?: boolean
          growth_daily_target?: number
          growth_timezone?: string
          growth_website_base_url?: string
          id?: string
          is_active?: boolean | null
          job_channel_template?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          bot_name?: string | null
          bot_username?: string | null
          channel_chat_id?: number | null
          channel_enabled?: boolean | null
          channel_username?: string | null
          created_at?: string
          growth_agent_enabled?: boolean
          growth_daily_target?: number
          growth_timezone?: string
          growth_website_base_url?: string
          id?: string
          is_active?: boolean | null
          job_channel_template?: string | null
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      telegram_campaigns: {
        Row: {
          created_at: string
          created_by: string | null
          delivered_count: number | null
          description: string | null
          failed_count: number | null
          id: string
          media_type: string | null
          media_url: string | null
          message_content: string
          name: string
          scheduled_at: string | null
          sent_at: string | null
          status: string
          total_recipients: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivered_count?: number | null
          description?: string | null
          failed_count?: number | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_content: string
          name: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          total_recipients?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivered_count?: number | null
          description?: string | null
          failed_count?: number | null
          id?: string
          media_type?: string | null
          media_url?: string | null
          message_content?: string
          name?: string
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          total_recipients?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      telegram_channel_external_log: {
        Row: {
          channel_message_id: number | null
          company: string | null
          created_at: string
          ext_id: string
          id: string
          posted_at: string
          source: string
          title: string | null
        }
        Insert: {
          channel_message_id?: number | null
          company?: string | null
          created_at?: string
          ext_id: string
          id?: string
          posted_at?: string
          source: string
          title?: string | null
        }
        Update: {
          channel_message_id?: number | null
          company?: string | null
          created_at?: string
          ext_id?: string
          id?: string
          posted_at?: string
          source?: string
          title?: string | null
        }
        Relationships: []
      }
      telegram_channel_growth_plan: {
        Row: {
          caption: string | null
          content_type: string
          created_at: string
          cta_url: string | null
          error_message: string | null
          id: string
          image_url: string | null
          language: string
          metadata: Json
          plan_date: string
          retry_count: number
          scheduled_at: string | null
          sent_at: string | null
          slot_hour: number
          status: string
          telegram_message_id: number | null
          topic: string
          updated_at: string
          with_image: boolean
        }
        Insert: {
          caption?: string | null
          content_type: string
          created_at?: string
          cta_url?: string | null
          error_message?: string | null
          id?: string
          image_url?: string | null
          language: string
          metadata?: Json
          plan_date: string
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          slot_hour: number
          status?: string
          telegram_message_id?: number | null
          topic: string
          updated_at?: string
          with_image?: boolean
        }
        Update: {
          caption?: string | null
          content_type?: string
          created_at?: string
          cta_url?: string | null
          error_message?: string | null
          id?: string
          image_url?: string | null
          language?: string
          metadata?: Json
          plan_date?: string
          retry_count?: number
          scheduled_at?: string | null
          sent_at?: string | null
          slot_hour?: number
          status?: string
          telegram_message_id?: number | null
          topic?: string
          updated_at?: string
          with_image?: boolean
        }
        Relationships: []
      }
      telegram_conversations: {
        Row: {
          chat_id: number
          chat_type: string | null
          created_at: string
          first_name: string | null
          id: string
          is_active: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          last_name: string | null
          linked_user_id: string | null
          unread_count: number | null
          updated_at: string
          username: string | null
        }
        Insert: {
          chat_id: number
          chat_type?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_name?: string | null
          linked_user_id?: string | null
          unread_count?: number | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          chat_id?: number
          chat_type?: string | null
          created_at?: string
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          last_name?: string | null
          linked_user_id?: string | null
          unread_count?: number | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      telegram_human_handoff: {
        Row: {
          chat_id: number
          created_at: string | null
          expires_at: string
          id: string
          reason: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          username: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string | null
          expires_at: string
          id?: string
          reason?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          username?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string | null
          expires_at?: string
          id?: string
          reason?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          username?: string | null
        }
        Relationships: []
      }
      telegram_lifecycle_templates: {
        Row: {
          body: string
          button_text: string | null
          button_url: string | null
          buttons: Json
          created_at: string
          enabled: boolean
          event_type: string
          image_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          button_text?: string | null
          button_url?: string | null
          buttons?: Json
          created_at?: string
          enabled?: boolean
          event_type: string
          image_url?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          body?: string
          button_text?: string | null
          button_url?: string | null
          buttons?: Json
          created_at?: string
          enabled?: boolean
          event_type?: string
          image_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_message_queue: {
        Row: {
          chat_id: number
          created_at: string | null
          error_message: string | null
          id: string
          max_retries: number | null
          message_content: string
          metadata: Json | null
          next_retry_at: string | null
          parse_mode: string | null
          priority: number | null
          processed_at: string | null
          retry_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          telegram_message_id: number | null
          trigger_log_id: string | null
          trigger_rule_id: string | null
          updated_at: string | null
        }
        Insert: {
          chat_id: number
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          message_content: string
          metadata?: Json | null
          next_retry_at?: string | null
          parse_mode?: string | null
          priority?: number | null
          processed_at?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          telegram_message_id?: number | null
          trigger_log_id?: string | null
          trigger_rule_id?: string | null
          updated_at?: string | null
        }
        Update: {
          chat_id?: number
          created_at?: string | null
          error_message?: string | null
          id?: string
          max_retries?: number | null
          message_content?: string
          metadata?: Json | null
          next_retry_at?: string | null
          parse_mode?: string | null
          priority?: number | null
          processed_at?: string | null
          retry_count?: number | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string | null
          telegram_message_id?: number | null
          trigger_log_id?: string | null
          trigger_rule_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_message_queue_trigger_log_id_fkey"
            columns: ["trigger_log_id"]
            isOneToOne: false
            referencedRelation: "telegram_trigger_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "telegram_message_queue_trigger_rule_id_fkey"
            columns: ["trigger_rule_id"]
            isOneToOne: false
            referencedRelation: "telegram_automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_message_templates: {
        Row: {
          category: string
          content: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean | null
          media_type: string | null
          media_url: string | null
          name: string
          updated_at: string
          use_count: number | null
          variables: Json | null
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          name: string
          updated_at?: string
          use_count?: number | null
          variables?: Json | null
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          media_type?: string | null
          media_url?: string | null
          name?: string
          updated_at?: string
          use_count?: number | null
          variables?: Json | null
        }
        Relationships: []
      }
      telegram_messages: {
        Row: {
          chat_id: number
          conversation_id: string | null
          created_at: string
          direction: string
          id: string
          is_starred: boolean | null
          message_content: string | null
          message_type: string | null
          metadata: Json | null
          reply_to_message_id: string | null
          sent_at: string | null
          status: string | null
          telegram_message_id: number | null
        }
        Insert: {
          chat_id: number
          conversation_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          is_starred?: boolean | null
          message_content?: string | null
          message_type?: string | null
          metadata?: Json | null
          reply_to_message_id?: string | null
          sent_at?: string | null
          status?: string | null
          telegram_message_id?: number | null
        }
        Update: {
          chat_id?: number
          conversation_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          is_starred?: boolean | null
          message_content?: string | null
          message_type?: string | null
          metadata?: Json | null
          reply_to_message_id?: string | null
          sent_at?: string | null
          status?: string | null
          telegram_message_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "telegram_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "telegram_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_queue_stats: {
        Row: {
          avg_delivery_time_ms: number | null
          created_at: string | null
          hour: number
          id: string
          messages_failed: number | null
          messages_queued: number | null
          messages_retried: number | null
          messages_sent: number | null
          peak_queue_size: number | null
          rate_limit_hits: number | null
          stat_date: string
          updated_at: string | null
        }
        Insert: {
          avg_delivery_time_ms?: number | null
          created_at?: string | null
          hour?: number
          id?: string
          messages_failed?: number | null
          messages_queued?: number | null
          messages_retried?: number | null
          messages_sent?: number | null
          peak_queue_size?: number | null
          rate_limit_hits?: number | null
          stat_date?: string
          updated_at?: string | null
        }
        Update: {
          avg_delivery_time_ms?: number | null
          created_at?: string | null
          hour?: number
          id?: string
          messages_failed?: number | null
          messages_queued?: number | null
          messages_retried?: number | null
          messages_sent?: number | null
          peak_queue_size?: number | null
          rate_limit_hits?: number | null
          stat_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      telegram_quick_replies: {
        Row: {
          category: string | null
          created_at: string | null
          enabled: boolean | null
          id: string
          priority: number | null
          response_english: string
          response_hindi: string
          trigger_keywords: string[]
          updated_at: string | null
          use_count: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          priority?: number | null
          response_english: string
          response_hindi: string
          trigger_keywords: string[]
          updated_at?: string | null
          use_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          priority?: number | null
          response_english?: string
          response_hindi?: string
          trigger_keywords?: string[]
          updated_at?: string | null
          use_count?: number | null
        }
        Relationships: []
      }
      telegram_rate_limits: {
        Row: {
          created_at: string | null
          id: string
          is_throttled: boolean | null
          max_messages: number | null
          messages_sent: number | null
          window_end: string
          window_start: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_throttled?: boolean | null
          max_messages?: number | null
          messages_sent?: number | null
          window_end: string
          window_start: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_throttled?: boolean | null
          max_messages?: number | null
          messages_sent?: number | null
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      telegram_response_cache: {
        Row: {
          ai_response: string
          created_at: string | null
          id: string
          last_used_at: string | null
          message_hash: string
          normalized_message: string | null
          use_count: number | null
        }
        Insert: {
          ai_response: string
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          message_hash: string
          normalized_message?: string | null
          use_count?: number | null
        }
        Update: {
          ai_response?: string
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          message_hash?: string
          normalized_message?: string | null
          use_count?: number | null
        }
        Relationships: []
      }
      telegram_templates: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      telegram_trigger_logs: {
        Row: {
          chat_id: string
          created_at: string | null
          delivery_channel: string | null
          error_code: string | null
          error_message: string | null
          executed_at: string
          failed_at: string | null
          id: string
          message_content: string | null
          message_sent: string | null
          metadata: Json | null
          recipient_chat_id: number | null
          recipient_name: string | null
          recipient_user_id: string | null
          rule_name: string | null
          sent_at: string | null
          status: string
          telegram_message_id: number | null
          telegram_response: Json | null
          template_name: string | null
          template_variables: Json | null
          trigger_event: string | null
          trigger_id: string | null
          trigger_source: string | null
          triggered_by: string | null
          user_name: string | null
          user_type: string | null
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          delivery_channel?: string | null
          error_code?: string | null
          error_message?: string | null
          executed_at?: string
          failed_at?: string | null
          id?: string
          message_content?: string | null
          message_sent?: string | null
          metadata?: Json | null
          recipient_chat_id?: number | null
          recipient_name?: string | null
          recipient_user_id?: string | null
          rule_name?: string | null
          sent_at?: string | null
          status?: string
          telegram_message_id?: number | null
          telegram_response?: Json | null
          template_name?: string | null
          template_variables?: Json | null
          trigger_event?: string | null
          trigger_id?: string | null
          trigger_source?: string | null
          triggered_by?: string | null
          user_name?: string | null
          user_type?: string | null
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          delivery_channel?: string | null
          error_code?: string | null
          error_message?: string | null
          executed_at?: string
          failed_at?: string | null
          id?: string
          message_content?: string | null
          message_sent?: string | null
          metadata?: Json | null
          recipient_chat_id?: number | null
          recipient_name?: string | null
          recipient_user_id?: string | null
          rule_name?: string | null
          sent_at?: string | null
          status?: string
          telegram_message_id?: number | null
          telegram_response?: Json | null
          template_name?: string | null
          template_variables?: Json | null
          trigger_event?: string | null
          trigger_id?: string | null
          trigger_source?: string | null
          triggered_by?: string | null
          user_name?: string | null
          user_type?: string | null
        }
        Relationships: []
      }
      telegram_triggers: {
        Row: {
          conditions: Json | null
          created_at: string
          created_by: string | null
          description: string | null
          execution_count: number | null
          id: string
          is_active: boolean | null
          last_executed_at: string | null
          media_url: string | null
          message_template: string
          name: string
          trigger_event: string
          trigger_type: string
          updated_at: string
        }
        Insert: {
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          media_url?: string | null
          message_template: string
          name: string
          trigger_event: string
          trigger_type: string
          updated_at?: string
        }
        Update: {
          conditions?: Json | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          media_url?: string | null
          message_template?: string
          name?: string
          trigger_event?: string
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      ticket_counter: {
        Row: {
          current_number: number
          current_year: number
          id: string
          updated_at: string | null
        }
        Insert: {
          current_number?: number
          current_year: number
          id?: string
          updated_at?: string | null
        }
        Update: {
          current_number?: number
          current_year?: number
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      totp_verification: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          secret: string
          user_id: string
          user_type: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          secret: string
          user_id: string
          user_type: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          secret?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      traffic_stats: {
        Row: {
          created_at: string | null
          egress_estimate_mb: number | null
          id: string
          stat_date: string
          stat_hour: number
          total_requests: number | null
          unique_visitors: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          egress_estimate_mb?: number | null
          id?: string
          stat_date?: string
          stat_hour?: number
          total_requests?: number | null
          unique_visitors?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          egress_estimate_mb?: number | null
          id?: string
          stat_date?: string
          stat_hour?: number
          total_requests?: number | null
          unique_visitors?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_method: string | null
          points: number
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          txn_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_method?: string | null
          points: number
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          txn_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_method?: string | null
          points?: number
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          txn_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trick_feedback: {
        Row: {
          created_at: string
          feedback_text: string | null
          id: string
          is_helpful: boolean
          trick_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_text?: string | null
          id?: string
          is_helpful: boolean
          trick_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_text?: string | null
          id?: string
          is_helpful?: boolean
          trick_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trick_feedback_trick_id_fkey"
            columns: ["trick_id"]
            isOneToOne: false
            referencedRelation: "ai_generated_tricks"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_badges: {
        Row: {
          created_at: string
          gradient: string | null
          id: string
          image_url: string | null
          is_active: boolean
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          gradient?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          gradient?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      unified_notification_logs: {
        Row: {
          channels_requested: string[] | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          recipient_name: string | null
          results: Json | null
          total_failed: number | null
          total_sent: number | null
          trigger_source: string | null
          triggered_by: string | null
          user_id: string | null
          user_type: string | null
        }
        Insert: {
          channels_requested?: string[] | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          recipient_name?: string | null
          results?: Json | null
          total_failed?: number | null
          total_sent?: number | null
          trigger_source?: string | null
          triggered_by?: string | null
          user_id?: string | null
          user_type?: string | null
        }
        Update: {
          channels_requested?: string[] | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          recipient_name?: string | null
          results?: Json | null
          total_failed?: number | null
          total_sent?: number | null
          trigger_source?: string | null
          triggered_by?: string | null
          user_id?: string | null
          user_type?: string | null
        }
        Relationships: []
      }
      url_clicks: {
        Row: {
          clicked_at: string
          created_at: string
          id: string
          ip_address: string | null
          job_id: string | null
          referrer: string | null
          short_id: string
          user_agent: string | null
        }
        Insert: {
          clicked_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          job_id?: string | null
          referrer?: string | null
          short_id: string
          user_agent?: string | null
        }
        Update: {
          clicked_at?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          job_id?: string | null
          referrer?: string | null
          short_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "url_clicks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_alert_config: {
        Row: {
          created_at: string | null
          critical_threshold: number | null
          emergency_threshold: number | null
          id: string
          is_enabled: boolean | null
          last_alert_at: string | null
          metric_type: string
          notify_email: boolean | null
          notify_telegram: boolean | null
          updated_at: string | null
          warning_threshold: number | null
        }
        Insert: {
          created_at?: string | null
          critical_threshold?: number | null
          emergency_threshold?: number | null
          id?: string
          is_enabled?: boolean | null
          last_alert_at?: string | null
          metric_type: string
          notify_email?: boolean | null
          notify_telegram?: boolean | null
          updated_at?: string | null
          warning_threshold?: number | null
        }
        Update: {
          created_at?: string | null
          critical_threshold?: number | null
          emergency_threshold?: number | null
          id?: string
          is_enabled?: boolean | null
          last_alert_at?: string | null
          metric_type?: string
          notify_email?: boolean | null
          notify_telegram?: boolean | null
          updated_at?: string | null
          warning_threshold?: number | null
        }
        Relationships: []
      }
      user_assessment_attempts: {
        Row: {
          answers: Json | null
          assessment_id: string
          certificate_issued: boolean
          completed_at: string | null
          correct_answers: number | null
          created_at: string
          id: string
          score: number | null
          started_at: string
          status: string
          time_taken_minutes: number | null
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json | null
          assessment_id: string
          certificate_issued?: boolean
          completed_at?: string | null
          correct_answers?: number | null
          created_at?: string
          id?: string
          score?: number | null
          started_at?: string
          status?: string
          time_taken_minutes?: number | null
          total_questions: number
          user_id: string
        }
        Update: {
          answers?: Json | null
          assessment_id?: string
          certificate_issued?: boolean
          completed_at?: string | null
          correct_answers?: number | null
          created_at?: string
          id?: string
          score?: number | null
          started_at?: string
          status?: string
          time_taken_minutes?: number | null
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_assessment_attempts_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "skill_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_certificates: {
        Row: {
          assessment_id: string
          attempt_id: string
          certificate_number: string
          created_at: string
          expires_at: string | null
          id: string
          issued_at: string
          level: string
          score: number
          skill_name: string
          user_id: string
          verification_url: string | null
        }
        Insert: {
          assessment_id: string
          attempt_id: string
          certificate_number: string
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          level: string
          score: number
          skill_name: string
          user_id: string
          verification_url?: string | null
        }
        Update: {
          assessment_id?: string
          attempt_id?: string
          certificate_number?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          level?: string
          score?: number
          skill_name?: string
          user_id?: string
          verification_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_certificates_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "skill_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_certificates_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "user_assessment_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_chat_bot_reply_log: {
        Row: {
          ai_reply: string | null
          channel_ref: string | null
          created_at: string
          error: string | null
          from_name: string | null
          id: string
          platform: string
          status: string
          user_id: string
          user_message: string | null
        }
        Insert: {
          ai_reply?: string | null
          channel_ref?: string | null
          created_at?: string
          error?: string | null
          from_name?: string | null
          id?: string
          platform: string
          status?: string
          user_id: string
          user_message?: string | null
        }
        Update: {
          ai_reply?: string | null
          channel_ref?: string | null
          created_at?: string
          error?: string | null
          from_name?: string | null
          id?: string
          platform?: string
          status?: string
          user_id?: string
          user_message?: string | null
        }
        Relationships: []
      }
      user_chat_bot_settings: {
        Row: {
          business_hours_end: string
          business_hours_only: boolean
          business_hours_start: string
          business_info: string
          created_at: string
          custom_instructions: string
          enabled: boolean
          id: string
          language: string
          last_reply_at: string | null
          max_replies_per_day: number
          platform: string
          reply_length: string
          signature: string
          skip_abusive: boolean
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_hours_end?: string
          business_hours_only?: boolean
          business_hours_start?: string
          business_info?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          id?: string
          language?: string
          last_reply_at?: string | null
          max_replies_per_day?: number
          platform: string
          reply_length?: string
          signature?: string
          skip_abusive?: boolean
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_hours_end?: string
          business_hours_only?: boolean
          business_hours_start?: string
          business_info?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          id?: string
          language?: string
          last_reply_at?: string | null
          max_replies_per_day?: number
          platform?: string
          reply_length?: string
          signature?: string
          skip_abusive?: boolean
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_chat_bots: {
        Row: {
          bot_external_id: string | null
          bot_name: string | null
          bot_username: string | null
          created_at: string
          extra_ciphertext: string | null
          id: string
          is_active: boolean
          meta: Json
          platform: string
          token_ciphertext: string
          updated_at: string
          user_id: string
          webhook_secret: string | null
        }
        Insert: {
          bot_external_id?: string | null
          bot_name?: string | null
          bot_username?: string | null
          created_at?: string
          extra_ciphertext?: string | null
          id?: string
          is_active?: boolean
          meta?: Json
          platform: string
          token_ciphertext: string
          updated_at?: string
          user_id: string
          webhook_secret?: string | null
        }
        Update: {
          bot_external_id?: string | null
          bot_name?: string | null
          bot_username?: string | null
          created_at?: string
          extra_ciphertext?: string | null
          id?: string
          is_active?: boolean
          meta?: Json
          platform?: string
          token_ciphertext?: string
          updated_at?: string
          user_id?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      user_custom_email_reply_log: {
        Row: {
          account_id: string
          created_at: string
          error: string | null
          from_email: string | null
          id: string
          message_id: string
          reply_text: string | null
          snippet: string | null
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          error?: string | null
          from_email?: string | null
          id?: string
          message_id: string
          reply_text?: string | null
          snippet?: string | null
          status?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          error?: string | null
          from_email?: string | null
          id?: string
          message_id?: string
          reply_text?: string | null
          snippet?: string | null
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_custom_email_settings: {
        Row: {
          account_email: string | null
          account_id: string
          business_info: string
          created_at: string
          custom_instructions: string
          enabled: boolean
          is_default: boolean
          language: string
          last_run_at: string | null
          last_run_status: string | null
          max_replies_per_run: number
          only_unread: boolean
          signature: string
          skip_promotions: boolean
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          account_id?: string
          business_info?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          is_default?: boolean
          language?: string
          last_run_at?: string | null
          last_run_status?: string | null
          max_replies_per_run?: number
          only_unread?: boolean
          signature?: string
          skip_promotions?: boolean
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          account_id?: string
          business_info?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          is_default?: boolean
          language?: string
          last_run_at?: string | null
          last_run_status?: string | null
          max_replies_per_run?: number
          only_unread?: boolean
          signature?: string
          skip_promotions?: boolean
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_engagement_state: {
        Row: {
          came_back_at: string | null
          created_at: string
          email: string | null
          email_response_count: number
          id: string
          inactivity_stage: number
          is_unsubscribed: boolean
          last_active_at: string | null
          last_channel: string | null
          last_contacted_at: string | null
          preferred_channel: string | null
          telegram_chat_id: number | null
          telegram_response_count: number
          total_emails_sent: number
          total_telegram_sent: number
          updated_at: string
          user_id: string
          user_type: string
        }
        Insert: {
          came_back_at?: string | null
          created_at?: string
          email?: string | null
          email_response_count?: number
          id?: string
          inactivity_stage?: number
          is_unsubscribed?: boolean
          last_active_at?: string | null
          last_channel?: string | null
          last_contacted_at?: string | null
          preferred_channel?: string | null
          telegram_chat_id?: number | null
          telegram_response_count?: number
          total_emails_sent?: number
          total_telegram_sent?: number
          updated_at?: string
          user_id: string
          user_type: string
        }
        Update: {
          came_back_at?: string | null
          created_at?: string
          email?: string | null
          email_response_count?: number
          id?: string
          inactivity_stage?: number
          is_unsubscribed?: boolean
          last_active_at?: string | null
          last_channel?: string | null
          last_contacted_at?: string | null
          preferred_channel?: string | null
          telegram_chat_id?: number | null
          telegram_response_count?: number
          total_emails_sent?: number
          total_telegram_sent?: number
          updated_at?: string
          user_id?: string
          user_type?: string
        }
        Relationships: []
      }
      user_gmail_autoreply_settings: {
        Row: {
          account_email: string | null
          account_id: string
          business_info: string
          created_at: string
          custom_instructions: string
          enabled: boolean
          is_default: boolean
          language: string
          last_run_at: string | null
          last_run_status: string | null
          max_replies_per_run: number
          only_unread: boolean
          reply_scope: string
          signature: string
          skip_promotions: boolean
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          account_id?: string
          business_info?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          is_default?: boolean
          language?: string
          last_run_at?: string | null
          last_run_status?: string | null
          max_replies_per_run?: number
          only_unread?: boolean
          reply_scope?: string
          signature?: string
          skip_promotions?: boolean
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          account_id?: string
          business_info?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          is_default?: boolean
          language?: string
          last_run_at?: string | null
          last_run_status?: string | null
          max_replies_per_run?: number
          only_unread?: boolean
          reply_scope?: string
          signature?: string
          skip_promotions?: boolean
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_gmail_reply_log: {
        Row: {
          account_id: string
          created_at: string
          error: string | null
          from_email: string | null
          id: string
          message_id: string | null
          reply_text: string | null
          snippet: string | null
          status: string
          subject: string | null
          thread_id: string | null
          user_id: string
        }
        Insert: {
          account_id?: string
          created_at?: string
          error?: string | null
          from_email?: string | null
          id?: string
          message_id?: string | null
          reply_text?: string | null
          snippet?: string | null
          status?: string
          subject?: string | null
          thread_id?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          created_at?: string
          error?: string | null
          from_email?: string | null
          id?: string
          message_id?: string | null
          reply_text?: string | null
          snippet?: string | null
          status?: string
          subject?: string | null
          thread_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_integrations: {
        Row: {
          config: Json
          created_at: string
          id: string
          label: string | null
          last_tested_at: string | null
          metadata: Json
          provider: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          label?: string | null
          last_tested_at?: string | null
          metadata?: Json
          provider: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          label?: string | null
          last_tested_at?: string | null
          metadata?: Json
          provider?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notification_intelligence: {
        Row: {
          active_hours: Json | null
          ai_notes: string | null
          best_channel: string | null
          best_language: string | null
          best_send_hour: number | null
          best_tone: string | null
          channel_ctr: Json | null
          confidence: number | null
          fatigue_score: number | null
          last_engagement_at: string | null
          last_learned_at: string
          metadata: Json | null
          overall_ctr: number | null
          recommended_daily_cap: number | null
          sample_size: number
          second_best_hour: number | null
          silent_hours: Json | null
          total_clicked: number
          total_converted: number
          total_opened: number
          total_sent: number
          user_id: string
        }
        Insert: {
          active_hours?: Json | null
          ai_notes?: string | null
          best_channel?: string | null
          best_language?: string | null
          best_send_hour?: number | null
          best_tone?: string | null
          channel_ctr?: Json | null
          confidence?: number | null
          fatigue_score?: number | null
          last_engagement_at?: string | null
          last_learned_at?: string
          metadata?: Json | null
          overall_ctr?: number | null
          recommended_daily_cap?: number | null
          sample_size?: number
          second_best_hour?: number | null
          silent_hours?: Json | null
          total_clicked?: number
          total_converted?: number
          total_opened?: number
          total_sent?: number
          user_id: string
        }
        Update: {
          active_hours?: Json | null
          ai_notes?: string | null
          best_channel?: string | null
          best_language?: string | null
          best_send_hour?: number | null
          best_tone?: string | null
          channel_ctr?: Json | null
          confidence?: number | null
          fatigue_score?: number | null
          last_engagement_at?: string | null
          last_learned_at?: string
          metadata?: Json | null
          overall_ctr?: number | null
          recommended_daily_cap?: number | null
          sample_size?: number
          second_best_hour?: number | null
          silent_hours?: Json | null
          total_clicked?: number
          total_converted?: number
          total_opened?: number
          total_sent?: number
          user_id?: string
        }
        Relationships: []
      }
      user_notification_tokens: {
        Row: {
          created_at: string
          device_type: string
          id: string
          is_active: boolean
          player_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_type?: string
          id?: string
          is_active?: boolean
          player_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_type?: string
          id?: string
          is_active?: boolean
          player_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_outlook_autoreply_settings: {
        Row: {
          account_email: string | null
          account_id: string
          business_info: string
          created_at: string
          custom_instructions: string
          enabled: boolean
          is_default: boolean
          language: string
          last_run_at: string | null
          last_run_status: string | null
          max_replies_per_run: number
          only_unread: boolean
          signature: string
          skip_promotions: boolean
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          account_id?: string
          business_info?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          is_default?: boolean
          language?: string
          last_run_at?: string | null
          last_run_status?: string | null
          max_replies_per_run?: number
          only_unread?: boolean
          signature?: string
          skip_promotions?: boolean
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          account_id?: string
          business_info?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          is_default?: boolean
          language?: string
          last_run_at?: string | null
          last_run_status?: string | null
          max_replies_per_run?: number
          only_unread?: boolean
          signature?: string
          skip_promotions?: boolean
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_outlook_reply_log: {
        Row: {
          account_id: string
          conversation_id: string | null
          created_at: string
          error: string | null
          from_email: string | null
          id: string
          message_id: string
          reply_text: string | null
          snippet: string | null
          status: string
          subject: string | null
          user_id: string
        }
        Insert: {
          account_id?: string
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          from_email?: string | null
          id?: string
          message_id: string
          reply_text?: string | null
          snippet?: string | null
          status?: string
          subject?: string | null
          user_id: string
        }
        Update: {
          account_id?: string
          conversation_id?: string | null
          created_at?: string
          error?: string | null
          from_email?: string | null
          id?: string
          message_id?: string
          reply_text?: string | null
          snippet?: string | null
          status?: string
          subject?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences_tracking: {
        Row: {
          category_interactions: Json | null
          created_at: string | null
          id: string
          job_type_interactions: Json | null
          last_updated: string | null
          location_interactions: Json | null
          salary_range_interactions: Json | null
          user_id: string
        }
        Insert: {
          category_interactions?: Json | null
          created_at?: string | null
          id?: string
          job_type_interactions?: Json | null
          last_updated?: string | null
          location_interactions?: Json | null
          salary_range_interactions?: Json | null
          user_id: string
        }
        Update: {
          category_interactions?: Json | null
          created_at?: string | null
          id?: string
          job_type_interactions?: Json | null
          last_updated?: string | null
          location_interactions?: Json | null
          salary_range_interactions?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_push_quota: {
        Row: {
          activity_tier: string
          created_at: string
          daily_limit: number
          detected_timezone: string | null
          last_push_at: string | null
          last_push_category: string | null
          last_push_status: string | null
          preferred_hours: number[] | null
          push_count_24h: number
          tier_calculated_at: string | null
          total_clicked: number
          total_sent: number
          updated_at: string
          user_id: string
          window_start_at: string | null
        }
        Insert: {
          activity_tier?: string
          created_at?: string
          daily_limit?: number
          detected_timezone?: string | null
          last_push_at?: string | null
          last_push_category?: string | null
          last_push_status?: string | null
          preferred_hours?: number[] | null
          push_count_24h?: number
          tier_calculated_at?: string | null
          total_clicked?: number
          total_sent?: number
          updated_at?: string
          user_id: string
          window_start_at?: string | null
        }
        Update: {
          activity_tier?: string
          created_at?: string
          daily_limit?: number
          detected_timezone?: string | null
          last_push_at?: string | null
          last_push_category?: string | null
          last_push_status?: string | null
          preferred_hours?: number[] | null
          push_count_24h?: number
          tier_calculated_at?: string | null
          total_clicked?: number
          total_sent?: number
          updated_at?: string
          user_id?: string
          window_start_at?: string | null
        }
        Relationships: []
      }
      user_referrals: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          referral_code_used: string
          referred_user_id: string
          referrer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          referral_code_used: string
          referred_user_id: string
          referrer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          referral_code_used?: string
          referred_user_id?: string
          referrer_id?: string
        }
        Relationships: []
      }
      user_resumes: {
        Row: {
          created_at: string
          external_api_url: string | null
          id: string
          last_synced_at: string | null
          name: string
          reactive_resume_id: string | null
          resume_data: Json | null
          template: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_api_url?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          reactive_resume_id?: string | null
          resume_data?: Json | null
          template?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_api_url?: string | null
          id?: string
          last_synced_at?: string | null
          name?: string
          reactive_resume_id?: string | null
          resume_data?: Json | null
          template?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_scheduled_notifications: {
        Row: {
          action_url: string | null
          attachment_name: string | null
          attachment_url: string | null
          attempts: number
          button_text: string | null
          channels: string[]
          created_at: string
          html_body: string | null
          id: string
          image_url: string | null
          last_error: string | null
          mailbox_attachments: Json
          mailbox_bcc: string[] | null
          mailbox_cc: string[] | null
          mailbox_html: string | null
          mailbox_provider: string | null
          mailbox_subject: string | null
          mailbox_to: string[] | null
          message: string
          result: Json | null
          scheduled_for: string
          sent_at: string | null
          source: string | null
          status: string
          timezone: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          attempts?: number
          button_text?: string | null
          channels?: string[]
          created_at?: string
          html_body?: string | null
          id?: string
          image_url?: string | null
          last_error?: string | null
          mailbox_attachments?: Json
          mailbox_bcc?: string[] | null
          mailbox_cc?: string[] | null
          mailbox_html?: string | null
          mailbox_provider?: string | null
          mailbox_subject?: string | null
          mailbox_to?: string[] | null
          message: string
          result?: Json | null
          scheduled_for: string
          sent_at?: string | null
          source?: string | null
          status?: string
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          attachment_name?: string | null
          attachment_url?: string | null
          attempts?: number
          button_text?: string | null
          channels?: string[]
          created_at?: string
          html_body?: string | null
          id?: string
          image_url?: string | null
          last_error?: string | null
          mailbox_attachments?: Json
          mailbox_bcc?: string[] | null
          mailbox_cc?: string[] | null
          mailbox_html?: string | null
          mailbox_provider?: string | null
          mailbox_subject?: string | null
          mailbox_to?: string[] | null
          message?: string
          result?: Json | null
          scheduled_for?: string
          sent_at?: string | null
          source?: string | null
          status?: string
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_secrets: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value?: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          activity_status: boolean
          contact_information: boolean
          created_at: string
          email_notifications: boolean
          email_otp_enabled: boolean | null
          id: string
          job_alerts: boolean
          marketing_communications: boolean
          passkey_credentials: Json | null
          passkey_enabled: boolean | null
          passkey_verified_at: string | null
          password_changed_at: string | null
          pattern_lock_enabled: boolean | null
          pattern_lock_hash: string | null
          pattern_lock_verified_at: string | null
          profile_visibility: boolean
          push_notifications: boolean
          push_otp_approval_expires_at: string | null
          push_otp_approval_token: string | null
          push_otp_enabled: boolean | null
          quick_login_enabled: boolean | null
          recovery_codes: Json | null
          telegram_2fa_enabled: boolean | null
          totp_enabled: boolean | null
          totp_secret: string | null
          totp_verified_at: string | null
          two_factor_enabled: boolean | null
          two_factor_method: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_status?: boolean
          contact_information?: boolean
          created_at?: string
          email_notifications?: boolean
          email_otp_enabled?: boolean | null
          id?: string
          job_alerts?: boolean
          marketing_communications?: boolean
          passkey_credentials?: Json | null
          passkey_enabled?: boolean | null
          passkey_verified_at?: string | null
          password_changed_at?: string | null
          pattern_lock_enabled?: boolean | null
          pattern_lock_hash?: string | null
          pattern_lock_verified_at?: string | null
          profile_visibility?: boolean
          push_notifications?: boolean
          push_otp_approval_expires_at?: string | null
          push_otp_approval_token?: string | null
          push_otp_enabled?: boolean | null
          quick_login_enabled?: boolean | null
          recovery_codes?: Json | null
          telegram_2fa_enabled?: boolean | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          totp_verified_at?: string | null
          two_factor_enabled?: boolean | null
          two_factor_method?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_status?: boolean
          contact_information?: boolean
          created_at?: string
          email_notifications?: boolean
          email_otp_enabled?: boolean | null
          id?: string
          job_alerts?: boolean
          marketing_communications?: boolean
          passkey_credentials?: Json | null
          passkey_enabled?: boolean | null
          passkey_verified_at?: string | null
          password_changed_at?: string | null
          pattern_lock_enabled?: boolean | null
          pattern_lock_hash?: string | null
          pattern_lock_verified_at?: string | null
          profile_visibility?: boolean
          push_notifications?: boolean
          push_otp_approval_expires_at?: string | null
          push_otp_approval_token?: string | null
          push_otp_enabled?: boolean | null
          quick_login_enabled?: boolean | null
          recovery_codes?: Json | null
          telegram_2fa_enabled?: boolean | null
          totp_enabled?: boolean | null
          totp_secret?: string | null
          totp_verified_at?: string | null
          two_factor_enabled?: boolean | null
          two_factor_method?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_shares: {
        Row: {
          content_id: string | null
          created_at: string
          id: string
          platform: string
          share_type: string
          shared_at: string
          user_id: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          id?: string
          platform: string
          share_type: string
          shared_at?: string
          user_id?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string
          id?: string
          platform?: string
          share_type?: string
          shared_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_telegram_ai_reply_log: {
        Row: {
          ai_reply: string | null
          bot_id: number | null
          chat_id: number | null
          created_at: string
          error: string | null
          from_name: string | null
          id: string
          status: string
          user_id: string
          user_message: string | null
        }
        Insert: {
          ai_reply?: string | null
          bot_id?: number | null
          chat_id?: number | null
          created_at?: string
          error?: string | null
          from_name?: string | null
          id?: string
          status?: string
          user_id: string
          user_message?: string | null
        }
        Update: {
          ai_reply?: string | null
          bot_id?: number | null
          chat_id?: number | null
          created_at?: string
          error?: string | null
          from_name?: string | null
          id?: string
          status?: string
          user_id?: string
          user_message?: string | null
        }
        Relationships: []
      }
      user_telegram_ai_settings: {
        Row: {
          bot_id: number
          business_hours_end: string
          business_hours_only: boolean
          business_hours_start: string
          business_info: string
          created_at: string
          custom_instructions: string
          enabled: boolean
          id: string
          language: string
          last_reply_at: string | null
          max_replies_per_day: number
          reply_length: string
          signature: string
          skip_abusive: boolean
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id?: number
          business_hours_end?: string
          business_hours_only?: boolean
          business_hours_start?: string
          business_info?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          id?: string
          language?: string
          last_reply_at?: string | null
          max_replies_per_day?: number
          reply_length?: string
          signature?: string
          skip_abusive?: boolean
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: number
          business_hours_end?: string
          business_hours_only?: boolean
          business_hours_start?: string
          business_info?: string
          created_at?: string
          custom_instructions?: string
          enabled?: boolean
          id?: string
          language?: string
          last_reply_at?: string | null
          max_replies_per_day?: number
          reply_length?: string
          signature?: string
          skip_abusive?: boolean
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_telegram_bots: {
        Row: {
          bot_id: number
          bot_name: string | null
          bot_username: string | null
          created_at: string
          id: string
          is_active: boolean
          is_default: boolean
          token_ciphertext: string
          updated_at: string
          user_id: string
          webhook_secret: string
          webhook_url: string | null
        }
        Insert: {
          bot_id?: number
          bot_name?: string | null
          bot_username?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          token_ciphertext: string
          updated_at?: string
          user_id: string
          webhook_secret: string
          webhook_url?: string | null
        }
        Update: {
          bot_id?: number
          bot_name?: string | null
          bot_username?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_default?: boolean
          token_ciphertext?: string
          updated_at?: string
          user_id?: string
          webhook_secret?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      Users: {
        Row: {
          attrs: Json | null
          created_at: string | null
          email: string | null
          uid: string | null
        }
        Insert: {
          attrs?: Json | null
          created_at?: string | null
          email?: string | null
          uid?: string | null
        }
        Update: {
          attrs?: Json | null
          created_at?: string | null
          email?: string | null
          uid?: string | null
        }
        Relationships: []
      }
      verification_packages: {
        Row: {
          badge_color: string
          created_at: string
          id: string
          is_active: boolean
          most_popular: boolean | null
          name: string
          price_inr: number
          sort_order: number | null
          updated_at: string
          validity_days: number
        }
        Insert: {
          badge_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          most_popular?: boolean | null
          name: string
          price_inr: number
          sort_order?: number | null
          updated_at?: string
          validity_days: number
        }
        Update: {
          badge_color?: string
          created_at?: string
          id?: string
          is_active?: boolean
          most_popular?: boolean | null
          name?: string
          price_inr?: number
          sort_order?: number | null
          updated_at?: string
          validity_days?: number
        }
        Relationships: []
      }
      verification_purchases: {
        Row: {
          amount_paid: number
          created_at: string
          id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_signature: string | null
          status: string
          updated_at: string
          user_id: string
          verification_package_id: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
          user_id: string
          verification_package_id: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_signature?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          verification_package_id?: string
        }
        Relationships: []
      }
      voice_call_logs: {
        Row: {
          applicant_id: string | null
          call_type: string
          caller_id: string | null
          conversation_id: string | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          msg91_call_id: string | null
          recipient_phone: string
          status: string
          updated_at: string | null
        }
        Insert: {
          applicant_id?: string | null
          call_type?: string
          caller_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          msg91_call_id?: string | null
          recipient_phone: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          applicant_id?: string | null
          call_type?: string
          caller_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          msg91_call_id?: string | null
          recipient_phone?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_call_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_deliveries: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          event: string
          id: string
          payload: Json
          response_status: number | null
          status: string
          webhook_id: string
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          event: string
          id?: string
          payload: Json
          response_status?: number | null
          status: string
          webhook_id: string
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          event?: string
          id?: string
          payload?: Json
          response_status?: number | null
          status?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhook_endpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_endpoints: {
        Row: {
          created_at: string | null
          description: string | null
          events: string[]
          id: string
          is_active: boolean | null
          secret: string
          updated_at: string | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          events: string[]
          id?: string
          is_active?: boolean | null
          secret: string
          updated_at?: string | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          events?: string[]
          id?: string
          is_active?: boolean | null
          secret?: string
          updated_at?: string | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_ai_reply_log: {
        Row: {
          ai_response: string | null
          created_at: string
          id: string
          message_id: string | null
          phone_number: string
          response_time_ms: number | null
          tokens_used: number | null
          user_message: string | null
        }
        Insert: {
          ai_response?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          phone_number: string
          response_time_ms?: number | null
          tokens_used?: number | null
          user_message?: string | null
        }
        Update: {
          ai_response?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          phone_number?: string
          response_time_ms?: number | null
          tokens_used?: number | null
          user_message?: string | null
        }
        Relationships: []
      }
      whatsapp_ai_settings: {
        Row: {
          ai_model: string | null
          auto_reply_keywords: string[] | null
          business_hours_end: string | null
          business_hours_only: boolean
          business_hours_start: string | null
          created_at: string
          delay_seconds: number | null
          enabled: boolean
          excluded_keywords: string[] | null
          id: string
          max_responses_per_day: number | null
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          ai_model?: string | null
          auto_reply_keywords?: string[] | null
          business_hours_end?: string | null
          business_hours_only?: boolean
          business_hours_start?: string | null
          created_at?: string
          delay_seconds?: number | null
          enabled?: boolean
          excluded_keywords?: string[] | null
          id?: string
          max_responses_per_day?: number | null
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          ai_model?: string | null
          auto_reply_keywords?: string[] | null
          business_hours_end?: string | null
          business_hours_only?: boolean
          business_hours_start?: string | null
          created_at?: string
          delay_seconds?: number | null
          enabled?: boolean
          excluded_keywords?: string[] | null
          id?: string
          max_responses_per_day?: number | null
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      whatsapp_audience_accounts: {
        Row: {
          audience: string
          business_name: string | null
          connected_at: string | null
          connected_via: string | null
          created_at: string
          display_phone: string | null
          phone_number_id: string | null
          quality_rating: string | null
          status: string
          updated_at: string
          verified_name: string | null
          waba_id: string | null
        }
        Insert: {
          audience: string
          business_name?: string | null
          connected_at?: string | null
          connected_via?: string | null
          created_at?: string
          display_phone?: string | null
          phone_number_id?: string | null
          quality_rating?: string | null
          status?: string
          updated_at?: string
          verified_name?: string | null
          waba_id?: string | null
        }
        Update: {
          audience?: string
          business_name?: string | null
          connected_at?: string | null
          connected_via?: string | null
          created_at?: string
          display_phone?: string | null
          phone_number_id?: string | null
          quality_rating?: string | null
          status?: string
          updated_at?: string
          verified_name?: string | null
          waba_id?: string | null
        }
        Relationships: []
      }
      whatsapp_audience_tokens: {
        Row: {
          access_token: string
          audience: string
          expires_at: string | null
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          audience: string
          expires_at?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          audience?: string
          expires_at?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_audience_tokens_audience_fkey"
            columns: ["audience"]
            isOneToOne: true
            referencedRelation: "whatsapp_audience_accounts"
            referencedColumns: ["audience"]
          },
        ]
      }
      whatsapp_automation_rules: {
        Row: {
          created_at: string | null
          created_by: string
          delay_minutes: number | null
          description: string | null
          execution_count: number | null
          id: string
          is_active: boolean | null
          last_executed_at: string | null
          name: string
          target_user_type: string | null
          template_id: string | null
          trigger_conditions: Json | null
          trigger_event: string
          updated_at: string | null
          variable_mapping: Json | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          delay_minutes?: number | null
          description?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name: string
          target_user_type?: string | null
          template_id?: string | null
          trigger_conditions?: Json | null
          trigger_event: string
          updated_at?: string | null
          variable_mapping?: Json | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          delay_minutes?: number | null
          description?: string | null
          execution_count?: number | null
          id?: string
          is_active?: boolean | null
          last_executed_at?: string | null
          name?: string
          target_user_type?: string | null
          template_id?: string | null
          trigger_conditions?: Json | null
          trigger_event?: string
          updated_at?: string | null
          variable_mapping?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_automation_rules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaign_recipients: {
        Row: {
          campaign_id: string | null
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          message_id: string | null
          read_at: string | null
          recipient_name: string | null
          recipient_phone: string
          sent_at: string | null
          status: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaign_recipients_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_campaign_recipients_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_campaigns: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by: string
          delivered_count: number | null
          description: string | null
          failed_count: number | null
          id: string
          name: string
          read_count: number | null
          scheduled_at: string | null
          segment_filter: Json | null
          sent_count: number | null
          started_at: string | null
          status: string
          target_audience: string
          template_id: string | null
          total_cost: number | null
          total_recipients: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by: string
          delivered_count?: number | null
          description?: string | null
          failed_count?: number | null
          id?: string
          name: string
          read_count?: number | null
          scheduled_at?: string | null
          segment_filter?: Json | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          target_audience: string
          template_id?: string | null
          total_cost?: number | null
          total_recipients?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by?: string
          delivered_count?: number | null
          description?: string | null
          failed_count?: number | null
          id?: string
          name?: string
          read_count?: number | null
          scheduled_at?: string | null
          segment_filter?: Json | null
          sent_count?: number | null
          started_at?: string | null
          status?: string
          target_audience?: string
          template_id?: string | null
          total_cost?: number | null
          total_recipients?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contact_preferences: {
        Row: {
          blacklisted_at: string | null
          blacklisted_reason: string | null
          created_at: string | null
          id: string
          is_blacklisted: boolean | null
          is_opted_in: boolean | null
          opted_out_at: string | null
          phone_number: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          blacklisted_at?: string | null
          blacklisted_reason?: string | null
          created_at?: string | null
          id?: string
          is_blacklisted?: boolean | null
          is_opted_in?: boolean | null
          opted_out_at?: string | null
          phone_number: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          blacklisted_at?: string | null
          blacklisted_reason?: string | null
          created_at?: string | null
          id?: string
          is_blacklisted?: boolean | null
          is_opted_in?: boolean | null
          opted_out_at?: string | null
          phone_number?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_contact_segments: {
        Row: {
          contact_count: number | null
          created_at: string | null
          created_by: string
          description: string | null
          filter_criteria: Json
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          contact_count?: number | null
          created_at?: string | null
          created_by: string
          description?: string | null
          filter_criteria: Json
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          contact_count?: number | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          filter_criteria?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_contacts: {
        Row: {
          name: string
          updated_at: string
          wa_id: string
        }
        Insert: {
          name: string
          updated_at?: string
          wa_id: string
        }
        Update: {
          name?: string
          updated_at?: string
          wa_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          audience: string | null
          company_id: string | null
          contact_name: string | null
          contact_type: string | null
          created_at: string
          id: string
          is_active: boolean | null
          last_message_at: string | null
          last_message_preview: string | null
          linked_user_id: string | null
          metadata: Json | null
          phone_number: string
          session_expires_at: string | null
          unread_count: number | null
          updated_at: string
          whatsapp_phone_number_id: string | null
        }
        Insert: {
          audience?: string | null
          company_id?: string | null
          contact_name?: string | null
          contact_type?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          linked_user_id?: string | null
          metadata?: Json | null
          phone_number: string
          session_expires_at?: string | null
          unread_count?: number | null
          updated_at?: string
          whatsapp_phone_number_id?: string | null
        }
        Update: {
          audience?: string | null
          company_id?: string | null
          contact_name?: string | null
          contact_type?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          last_message_at?: string | null
          last_message_preview?: string | null
          linked_user_id?: string | null
          metadata?: Json | null
          phone_number?: string
          session_expires_at?: string | null
          unread_count?: number | null
          updated_at?: string
          whatsapp_phone_number_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_human_handoff: {
        Row: {
          created_at: string | null
          expires_at: string | null
          handoff_at: string | null
          id: string
          notes: string | null
          phone_number: string
          reason: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          handoff_at?: string | null
          id?: string
          notes?: string | null
          phone_number: string
          reason?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          handoff_at?: string | null
          id?: string
          notes?: string | null
          phone_number?: string
          reason?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: []
      }
      whatsapp_media_library: {
        Row: {
          file_name: string
          file_size_bytes: number | null
          file_type: string
          file_url: string
          folder: string | null
          id: string
          is_approved: boolean | null
          mime_type: string | null
          uploaded_at: string | null
          uploaded_by: string
          usage_count: number | null
        }
        Insert: {
          file_name: string
          file_size_bytes?: number | null
          file_type: string
          file_url: string
          folder?: string | null
          id?: string
          is_approved?: boolean | null
          mime_type?: string | null
          uploaded_at?: string | null
          uploaded_by: string
          usage_count?: number | null
        }
        Update: {
          file_name?: string
          file_size_bytes?: number | null
          file_type?: string
          file_url?: string
          folder?: string | null
          id?: string
          is_approved?: boolean | null
          mime_type?: string | null
          uploaded_at?: string | null
          uploaded_by?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      whatsapp_message_reactions: {
        Row: {
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string | null
          user_name: string | null
          user_phone: string | null
        }
        Insert: {
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id?: string | null
          user_name?: string | null
          user_phone?: string | null
        }
        Update: {
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string | null
          user_name?: string | null
          user_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          audience: string | null
          company_id: string | null
          conversation_id: string | null
          created_at: string
          delivered_at: string | null
          direction: string | null
          error_message: string | null
          id: string
          is_starred: boolean | null
          message_content: string | null
          message_type: string | null
          metadata: Json | null
          msg91_message_id: string | null
          read_at: string | null
          recipient_name: string | null
          recipient_phone: string
          recipient_type: string | null
          recipient_user_id: string | null
          reply_to_message_id: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          template_name: string
          template_variables: Json | null
          updated_at: string
          whatsapp_phone_number_id: string | null
        }
        Insert: {
          audience?: string | null
          company_id?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string | null
          error_message?: string | null
          id?: string
          is_starred?: boolean | null
          message_content?: string | null
          message_type?: string | null
          metadata?: Json | null
          msg91_message_id?: string | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone: string
          recipient_type?: string | null
          recipient_user_id?: string | null
          reply_to_message_id?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          template_name: string
          template_variables?: Json | null
          updated_at?: string
          whatsapp_phone_number_id?: string | null
        }
        Update: {
          audience?: string | null
          company_id?: string | null
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string | null
          error_message?: string | null
          id?: string
          is_starred?: boolean | null
          message_content?: string | null
          message_type?: string | null
          metadata?: Json | null
          msg91_message_id?: string | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          recipient_type?: string | null
          recipient_user_id?: string | null
          reply_to_message_id?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          template_name?: string
          template_variables?: Json | null
          updated_at?: string
          whatsapp_phone_number_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_otp_verifications: {
        Row: {
          attempts: number | null
          created_at: string
          expires_at: string
          id: string
          max_attempts: number | null
          otp_code: string
          phone: string
          purpose: string
          user_id: string | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string
          expires_at: string
          id?: string
          max_attempts?: number | null
          otp_code: string
          phone: string
          purpose?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          max_attempts?: number | null
          otp_code?: string
          phone?: string
          purpose?: string
          user_id?: string | null
          verified_at?: string | null
        }
        Relationships: []
      }
      whatsapp_quick_replies: {
        Row: {
          category: string | null
          created_at: string | null
          enabled: boolean | null
          id: string
          priority: number | null
          response_english: string
          response_hindi: string
          trigger_keywords: string[]
          updated_at: string | null
          use_count: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          priority?: number | null
          response_english: string
          response_hindi: string
          trigger_keywords: string[]
          updated_at?: string | null
          use_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          enabled?: boolean | null
          id?: string
          priority?: number | null
          response_english?: string
          response_hindi?: string
          trigger_keywords?: string[]
          updated_at?: string | null
          use_count?: number | null
        }
        Relationships: []
      }
      whatsapp_response_cache: {
        Row: {
          ai_response: string
          created_at: string | null
          id: string
          last_used_at: string | null
          message_hash: string
          normalized_message: string
          use_count: number | null
        }
        Insert: {
          ai_response: string
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          message_hash: string
          normalized_message: string
          use_count?: number | null
        }
        Update: {
          ai_response?: string
          created_at?: string | null
          id?: string
          last_used_at?: string | null
          message_hash?: string
          normalized_message?: string
          use_count?: number | null
        }
        Relationships: []
      }
      whatsapp_send_windows: {
        Row: {
          burst_count: number
          burst_second: string | null
          created_at: string
          id: string
          scope: string
          scope_id: string
          sent_count: number
          updated_at: string
          window_start: string
        }
        Insert: {
          burst_count?: number
          burst_second?: string | null
          created_at?: string
          id?: string
          scope: string
          scope_id: string
          sent_count?: number
          updated_at?: string
          window_start?: string
        }
        Update: {
          burst_count?: number
          burst_second?: string | null
          created_at?: string
          id?: string
          scope?: string
          scope_id?: string
          sent_count?: number
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          buttons: Json | null
          category: string | null
          content_preview: string | null
          created_at: string
          display_name: string
          footer: string | null
          header_content: string | null
          header_type: string | null
          id: string
          is_active: boolean | null
          language: string | null
          last_synced_at: string | null
          msg91_template_id: string | null
          name: string
          notify_enabled: boolean
          rejection_reason: string | null
          status: string
          total_delivered: number | null
          total_failed: number | null
          total_read: number | null
          total_sent: number | null
          updated_at: string
          variables: string[] | null
        }
        Insert: {
          buttons?: Json | null
          category?: string | null
          content_preview?: string | null
          created_at?: string
          display_name: string
          footer?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          last_synced_at?: string | null
          msg91_template_id?: string | null
          name: string
          notify_enabled?: boolean
          rejection_reason?: string | null
          status?: string
          total_delivered?: number | null
          total_failed?: number | null
          total_read?: number | null
          total_sent?: number | null
          updated_at?: string
          variables?: string[] | null
        }
        Update: {
          buttons?: Json | null
          category?: string | null
          content_preview?: string | null
          created_at?: string
          display_name?: string
          footer?: string | null
          header_content?: string | null
          header_type?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          last_synced_at?: string | null
          msg91_template_id?: string | null
          name?: string
          notify_enabled?: boolean
          rejection_reason?: string | null
          status?: string
          total_delivered?: number | null
          total_failed?: number | null
          total_read?: number | null
          total_sent?: number | null
          updated_at?: string
          variables?: string[] | null
        }
        Relationships: []
      }
      whatsapp_trigger_logs: {
        Row: {
          created_at: string
          delivered_at: string | null
          delivery_channel: string | null
          delivery_status: string | null
          error_code: string | null
          error_message: string | null
          failed_at: string | null
          has_active_session: boolean | null
          id: string
          metadata: Json | null
          msg91_delivery_response: Json | null
          msg91_request_id: string | null
          msg91_response: Json | null
          read_at: string | null
          recipient_name: string | null
          recipient_phone: string
          recipient_user_id: string | null
          sent_at: string | null
          session_check_result: Json | null
          status: string
          template_name: string
          template_variables: Json | null
          trigger_event: string
          trigger_source: string | null
          triggered_by: string | null
          user_type: string
        }
        Insert: {
          created_at?: string
          delivered_at?: string | null
          delivery_channel?: string | null
          delivery_status?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          has_active_session?: boolean | null
          id?: string
          metadata?: Json | null
          msg91_delivery_response?: Json | null
          msg91_request_id?: string | null
          msg91_response?: Json | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone: string
          recipient_user_id?: string | null
          sent_at?: string | null
          session_check_result?: Json | null
          status?: string
          template_name: string
          template_variables?: Json | null
          trigger_event: string
          trigger_source?: string | null
          triggered_by?: string | null
          user_type: string
        }
        Update: {
          created_at?: string
          delivered_at?: string | null
          delivery_channel?: string | null
          delivery_status?: string | null
          error_code?: string | null
          error_message?: string | null
          failed_at?: string | null
          has_active_session?: boolean | null
          id?: string
          metadata?: Json | null
          msg91_delivery_response?: Json | null
          msg91_request_id?: string | null
          msg91_response?: Json | null
          read_at?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          recipient_user_id?: string | null
          sent_at?: string | null
          session_check_result?: Json | null
          status?: string
          template_name?: string
          template_variables?: Json | null
          trigger_event?: string
          trigger_source?: string | null
          triggered_by?: string | null
          user_type?: string
        }
        Relationships: []
      }
      whatsapp_user_sessions: {
        Row: {
          created_at: string
          id: string
          interaction_type: string
          last_interaction_at: string
          metadata: Json | null
          phone_number: string
          session_expires_at: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          interaction_type: string
          last_interaction_at?: string
          metadata?: Json | null
          phone_number: string
          session_expires_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          interaction_type?: string
          last_interaction_at?: string
          metadata?: Json | null
          phone_number?: string
          session_expires_at?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      whatsapp_webhook_logs: {
        Row: {
          event_type: string
          id: string
          message_id: string | null
          msg91_message_id: string | null
          payload: Json
          processed_at: string | null
          status_code: number | null
        }
        Insert: {
          event_type: string
          id?: string
          message_id?: string | null
          msg91_message_id?: string | null
          payload: Json
          processed_at?: string | null
          status_code?: number | null
        }
        Update: {
          event_type?: string
          id?: string
          message_id?: string | null
          msg91_message_id?: string | null
          payload?: Json
          processed_at?: string | null
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_webhook_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_analytics_api: {
        Row: {
          created_at: string
          data: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      youtube_analytics_cache: {
        Row: {
          cache_key: string
          created_at: string
          data: Json
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          data: Json
          expires_at?: string
          id?: string
          user_id: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          data?: Json
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      youtube_autoreply_log: {
        Row: {
          account_id: string
          author_name: string | null
          comment_id: string
          comment_text: string | null
          created_at: string
          error: string | null
          id: string
          is_short: boolean | null
          reply_text: string | null
          status: string
          user_id: string
          video_id: string | null
          video_title: string | null
        }
        Insert: {
          account_id?: string
          author_name?: string | null
          comment_id: string
          comment_text?: string | null
          created_at?: string
          error?: string | null
          id?: string
          is_short?: boolean | null
          reply_text?: string | null
          status?: string
          user_id: string
          video_id?: string | null
          video_title?: string | null
        }
        Update: {
          account_id?: string
          author_name?: string | null
          comment_id?: string
          comment_text?: string | null
          created_at?: string
          error?: string | null
          id?: string
          is_short?: boolean | null
          reply_text?: string | null
          status?: string
          user_id?: string
          video_id?: string | null
          video_title?: string | null
        }
        Relationships: []
      }
      youtube_autoreply_settings: {
        Row: {
          account_email: string | null
          account_id: string
          created_at: string
          custom_instructions: string | null
          enabled: boolean
          is_default: boolean
          language: string
          last_run_at: string | null
          last_run_status: string | null
          max_replies_per_run: number
          reply_length: string
          reply_scope: string
          signature: string | null
          skip_negative: boolean
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_email?: string | null
          account_id?: string
          created_at?: string
          custom_instructions?: string | null
          enabled?: boolean
          is_default?: boolean
          language?: string
          last_run_at?: string | null
          last_run_status?: string | null
          max_replies_per_run?: number
          reply_length?: string
          reply_scope?: string
          signature?: string | null
          skip_negative?: boolean
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_email?: string | null
          account_id?: string
          created_at?: string
          custom_instructions?: string | null
          enabled?: boolean
          is_default?: boolean
          language?: string
          last_run_at?: string | null
          last_run_status?: string | null
          max_replies_per_run?: number
          reply_length?: string
          reply_scope?: string
          signature?: string | null
          skip_negative?: boolean
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      youtube_connections: {
        Row: {
          access_token: string | null
          channel_id: string | null
          channel_thumbnail: string | null
          channel_title: string | null
          connected_at: string
          created_at: string
          id: string
          is_default: boolean
          refresh_token: string | null
          scope: string | null
          subscriber_count: number | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          channel_id?: string | null
          channel_thumbnail?: string | null
          channel_title?: string | null
          connected_at?: string
          created_at?: string
          id?: string
          is_default?: boolean
          refresh_token?: string | null
          scope?: string | null
          subscriber_count?: number | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          channel_id?: string | null
          channel_thumbnail?: string | null
          channel_title?: string | null
          connected_at?: string
          created_at?: string
          id?: string
          is_default?: boolean
          refresh_token?: string | null
          scope?: string | null
          subscriber_count?: number | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      youtube_optimizer_log: {
        Row: {
          action_type: string
          ai_confidence: string | null
          analytics_after: Json | null
          analytics_before: Json | null
          channel_id: string | null
          content_type: string
          cooldown_until: string | null
          created_at: string
          error_message: string | null
          id: string
          new_description: string | null
          new_tags: string[] | null
          new_thumbnail: string | null
          new_title: string | null
          optimization_cycle: number
          previous_description: string | null
          previous_tags: string[] | null
          previous_thumbnail: string | null
          previous_title: string | null
          reason: string | null
          review_id: string | null
          status: string
          user_id: string
          video_id: string
        }
        Insert: {
          action_type: string
          ai_confidence?: string | null
          analytics_after?: Json | null
          analytics_before?: Json | null
          channel_id?: string | null
          content_type?: string
          cooldown_until?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          new_description?: string | null
          new_tags?: string[] | null
          new_thumbnail?: string | null
          new_title?: string | null
          optimization_cycle?: number
          previous_description?: string | null
          previous_tags?: string[] | null
          previous_thumbnail?: string | null
          previous_title?: string | null
          reason?: string | null
          review_id?: string | null
          status?: string
          user_id: string
          video_id: string
        }
        Update: {
          action_type?: string
          ai_confidence?: string | null
          analytics_after?: Json | null
          analytics_before?: Json | null
          channel_id?: string | null
          content_type?: string
          cooldown_until?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          new_description?: string | null
          new_tags?: string[] | null
          new_thumbnail?: string | null
          new_title?: string | null
          optimization_cycle?: number
          previous_description?: string | null
          previous_tags?: string[] | null
          previous_thumbnail?: string | null
          previous_title?: string | null
          reason?: string | null
          review_id?: string | null
          status?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "youtube_optimizer_log_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "youtube_optimizer_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      youtube_optimizer_reviews: {
        Row: {
          analytics_after: Json | null
          analytics_before: Json
          applied_at: string | null
          channel_id: string | null
          classification: string
          confidence: string
          content_recommendation: string | null
          content_type: string
          cooldown_until: string | null
          created_at: string
          decision: string
          error_message: string | null
          evidence: Json
          id: string
          optimization_cycle: number
          problem: string
          proposal: Json
          reason: string | null
          status: string
          target_element: string | null
          updated_at: string
          user_id: string
          video_id: string
          video_title: string | null
        }
        Insert: {
          analytics_after?: Json | null
          analytics_before?: Json
          applied_at?: string | null
          channel_id?: string | null
          classification?: string
          confidence?: string
          content_recommendation?: string | null
          content_type?: string
          cooldown_until?: string | null
          created_at?: string
          decision?: string
          error_message?: string | null
          evidence?: Json
          id?: string
          optimization_cycle?: number
          problem?: string
          proposal?: Json
          reason?: string | null
          status?: string
          target_element?: string | null
          updated_at?: string
          user_id: string
          video_id: string
          video_title?: string | null
        }
        Update: {
          analytics_after?: Json | null
          analytics_before?: Json
          applied_at?: string | null
          channel_id?: string | null
          classification?: string
          confidence?: string
          content_recommendation?: string | null
          content_type?: string
          cooldown_until?: string | null
          created_at?: string
          decision?: string
          error_message?: string | null
          evidence?: Json
          id?: string
          optimization_cycle?: number
          problem?: string
          proposal?: Json
          reason?: string | null
          status?: string
          target_element?: string | null
          updated_at?: string
          user_id?: string
          video_id?: string
          video_title?: string | null
        }
        Relationships: []
      }
      youtube_optimizer_settings: {
        Row: {
          allow_description: boolean
          allow_tags: boolean
          allow_thumbnail: boolean
          allow_title: boolean
          created_at: string
          enabled: boolean
          last_run_at: string | null
          last_run_status: string | null
          max_jobs_per_day: number
          min_confidence: string
          min_hours_between_jobs: number
          mode: string
          paused_until: string | null
          review_after_days: number
          updated_at: string
          user_id: string
          video_cooldown_days: number
        }
        Insert: {
          allow_description?: boolean
          allow_tags?: boolean
          allow_thumbnail?: boolean
          allow_title?: boolean
          created_at?: string
          enabled?: boolean
          last_run_at?: string | null
          last_run_status?: string | null
          max_jobs_per_day?: number
          min_confidence?: string
          min_hours_between_jobs?: number
          mode?: string
          paused_until?: string | null
          review_after_days?: number
          updated_at?: string
          user_id: string
          video_cooldown_days?: number
        }
        Update: {
          allow_description?: boolean
          allow_tags?: boolean
          allow_thumbnail?: boolean
          allow_title?: boolean
          created_at?: string
          enabled?: boolean
          last_run_at?: string | null
          last_run_status?: string | null
          max_jobs_per_day?: number
          min_confidence?: string
          min_hours_between_jobs?: number
          mode?: string
          paused_until?: string | null
          review_after_days?: number
          updated_at?: string
          user_id?: string
          video_cooldown_days?: number
        }
        Relationships: []
      }
      youtube_seo_examples: {
        Row: {
          category_id: string | null
          created_at: string
          description: string
          hashtags: string[]
          id: string
          is_active: boolean
          is_short: boolean
          label: string
          language: string
          notes: string | null
          tags: string[]
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description: string
          hashtags?: string[]
          id?: string
          is_active?: boolean
          is_short?: boolean
          label?: string
          language?: string
          notes?: string | null
          tags?: string[]
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string
          hashtags?: string[]
          id?: string
          is_active?: boolean
          is_short?: boolean
          label?: string
          language?: string
          notes?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      youtube_seo_feedback: {
        Row: {
          added_tags: string[]
          ai_description: string | null
          ai_hashtags: string[]
          ai_tags: string[]
          ai_title: string | null
          category_id: string | null
          created_at: string
          edited_fields: string[]
          final_description: string | null
          final_hashtags: string[]
          final_tags: string[]
          final_title: string | null
          id: string
          removed_tags: string[]
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          added_tags?: string[]
          ai_description?: string | null
          ai_hashtags?: string[]
          ai_tags?: string[]
          ai_title?: string | null
          category_id?: string | null
          created_at?: string
          edited_fields?: string[]
          final_description?: string | null
          final_hashtags?: string[]
          final_tags?: string[]
          final_title?: string | null
          id?: string
          removed_tags?: string[]
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          added_tags?: string[]
          ai_description?: string | null
          ai_hashtags?: string[]
          ai_tags?: string[]
          ai_title?: string | null
          category_id?: string | null
          created_at?: string
          edited_fields?: string[]
          final_description?: string | null
          final_hashtags?: string[]
          final_tags?: string[]
          final_title?: string | null
          id?: string
          removed_tags?: string[]
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: []
      }
      youtube_streaming_settings: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean | null
          rtmp_url: string | null
          stream_key: string | null
          updated_at: string
          user_id: string
          youtube_channel_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          rtmp_url?: string | null
          stream_key?: string | null
          updated_at?: string
          user_id: string
          youtube_channel_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean | null
          rtmp_url?: string | null
          stream_key?: string | null
          updated_at?: string
          user_id?: string
          youtube_channel_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      api_analytics: {
        Row: {
          avg_response_time: number | null
          error_count: number | null
          key_name: string | null
          last_request_at: string | null
          success_count: number | null
          time_bucket: string | null
          total_requests: number | null
          user_id: string | null
        }
        Relationships: []
      }
      indexing_quota_dashboard: {
        Row: {
          date: string | null
          effective_daily_limit: number | null
          estimated_days_to_clear: number | null
          indexed_today: number | null
          last_queue_date: string | null
          next_processing_date: string | null
          pending_today: number | null
          pending_tomorrow: number | null
          remaining_today: number | null
          today_used: number | null
          total_daily_limit: number | null
          total_pending: number | null
          total_public: number | null
        }
        Relationships: []
      }
      indexing_quota_status: {
        Row: {
          effective_daily_limit: number | null
          estimated_days_to_clear: number | null
          last_queue_date: string | null
          next_processing_date: string | null
          today_limit: number | null
          today_used: number | null
          total_pending: number | null
        }
        Relationships: []
      }
      my_domain_orders: {
        Row: {
          created_at: string | null
          currency: string | null
          customer_price: number | null
          domain: string | null
          id: string | null
          payment_amount: number | null
          payment_order_id: string | null
          payment_provider: string | null
          period: number | null
          privacy: boolean | null
          provider: string | null
          quote_expires_at: string | null
          registration_status: string | null
          renewal_price: number | null
          status: string | null
          status_reason: string | null
          tld: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          customer_price?: number | null
          domain?: string | null
          id?: string | null
          payment_amount?: number | null
          payment_order_id?: string | null
          payment_provider?: string | null
          period?: number | null
          privacy?: boolean | null
          provider?: string | null
          quote_expires_at?: string | null
          registration_status?: string | null
          renewal_price?: number | null
          status?: string | null
          status_reason?: string | null
          tld?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          customer_price?: number | null
          domain?: string | null
          id?: string | null
          payment_amount?: number | null
          payment_order_id?: string | null
          payment_provider?: string | null
          period?: number | null
          privacy?: boolean | null
          provider?: string | null
          quote_expires_at?: string | null
          registration_status?: string | null
          renewal_price?: number | null
          status?: string | null
          status_reason?: string | null
          tld?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      team_roles: {
        Row: {
          base_permissions: Json | null
          created_at: string | null
          created_by: string | null
          id: string | null
          is_custom: boolean | null
          role_description: string | null
          role_name: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_user_recent_notification_load: {
        Row: {
          dismissed_24h: number | null
          engaged_24h: number | null
          last_engagement_at: string | null
          sent_24h: number | null
          sent_7d: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_company_verification:
        | {
            Args: {
              p_company_id: string
              p_package_id: string
              p_payment_id?: string
            }
            Returns: Json
          }
        | {
            Args: { p_user_id: string; p_verification_package_id: string }
            Returns: undefined
          }
      activate_job_boost:
        | { Args: { p_job_boost_id: string }; Returns: undefined }
        | {
            Args: {
              p_boost_package_id: string
              p_job_id: string
              p_user_id: string
            }
            Returns: Json
          }
      add_purchased_api_calls:
        | {
            Args: {
              _amount: number
              _calls: number
              _order_id: string
              _payment_id: string
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _amount: number
              _calls: number
              _order_id: string
              _payment_id: string
              _source?: string
              _user_id: string
            }
            Returns: boolean
          }
      add_telegram_to_queue: {
        Args: {
          p_chat_id: number
          p_message: string
          p_metadata?: Json
          p_parse_mode?: string
          p_priority?: number
          p_trigger_log_id?: string
          p_trigger_rule_id?: string
        }
        Returns: string
      }
      admin_delete_company_complete: {
        Args: { target_user_id: string }
        Returns: Json
      }
      admin_delete_user: { Args: { target_user_id: string }; Returns: Json }
      admin_delete_website_user_data:
        | { Args: { target_user_id: string }; Returns: Json }
        | {
            Args: { admin_user_id: string; target_user_id: string }
            Returns: Json
          }
      admin_get_company_id: { Args: { p_user_id: string }; Returns: string }
      admin_set_account_status: {
        Args: { p_reason?: string; p_status: string; p_user_id: string }
        Returns: undefined
      }
      admin_set_job_posting_visibility: {
        Args: { p_user_id: string; p_visible: boolean }
        Returns: undefined
      }
      admin_soft_delete_company: {
        Args: { p_company_id: string; p_reason?: string }
        Returns: undefined
      }
      admin_storage_bucket_stats: {
        Args: never
        Returns: {
          bucket_id: string
          file_count: number
          total_size: number
        }[]
      }
      admin_storage_folder_stats: {
        Args: { p_bucket: string; p_prefix?: string }
        Returns: {
          file_count: number
          folder: string
          latest_at: string
          total_size: number
        }[]
      }
      admin_update_company_ban_status:
        | {
            Args: {
              p_action: string
              p_company_id: string
              p_performed_by?: string
              p_reason?: string
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              ban_reason?: string
              new_status: string
              target_user_id: string
            }
            Returns: undefined
          }
      admin_update_company_profile:
        | {
            Args: {
              business_type?: string
              cin_number?: string
              city?: string
              clients_description?: string
              company_details?: string
              company_id: string
              company_name?: string
              country?: string
              data_privacy_measures?: string
              differentiating_factors?: string
              dispute_resolution?: string
              email?: string
              facebook_link?: string
              gst_number?: string
              hr_contact_name?: string
              incorporation_date?: string
              industry?: string
              instagram_link?: string
              legal_name?: string
              linkedin_link?: string
              logo_url?: string
              msme_number?: string
              organisation_size?: string
              pan_number?: string
              phone?: string
              postal_code?: string
              precise_address?: string
              pricing_plans?: string
              rbi_compliance?: string
              refund_policy?: string
              services_description?: string
              state?: string
              testimonials?: string
              website?: string
              whatsapp_number?: string
              youtube_link?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_city?: string
              p_company_name?: string
              p_country?: string
              p_email?: string
              p_hr_contact_name?: string
              p_legal_name?: string
              p_phone?: string
              p_postal_code?: string
              p_precise_address?: string
              p_state?: string
              p_user_id: string
              p_website?: string
              p_whatsapp_number?: string
            }
            Returns: boolean
          }
        | {
            Args: { profile_data: Json; target_user_id: string }
            Returns: undefined
          }
      admin_update_company_verification: {
        Args: {
          p_badge_color?: string
          p_company_id: string
          p_is_verified: boolean
        }
        Returns: undefined
      }
      admin_update_company_verification_details:
        | {
            Args: {
              p_badge_color?: string
              p_company_id: string
              p_end?: string
              p_is_verified: boolean
              p_start?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              badge_color?: string
              is_verified: boolean
              target_user_id: string
              verified_plan_end?: string
              verified_plan_start?: string
            }
            Returns: undefined
          }
      admin_update_jobseeker_profile:
        | {
            Args: {
              p_bio?: string
              p_city?: string
              p_company?: string
              p_country?: string
              p_current_position?: string
              p_experience_years?: number
              p_facebook_link?: string
              p_full_name?: string
              p_industry?: string
              p_instagram_link?: string
              p_job_type?: string
              p_languages?: string[]
              p_linkedin_link?: string
              p_location?: string
              p_phone?: string
              p_postal_code?: string
              p_precise_address?: string
              p_preferred_location?: string
              p_skills?: string[]
              p_state?: string
              p_user_id: string
              p_whatsapp_number?: string
              p_youtube_link?: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_city: string
              p_country: string
              p_full_name: string
              p_phone: string
              p_postal_code: string
              p_precise_address: string
              p_state: string
              p_user_id: string
              p_whatsapp_number: string
            }
            Returns: undefined
          }
      admin_update_jobseeker_profile_full: {
        Args: {
          p_bio?: string
          p_city?: string
          p_company?: string
          p_country?: string
          p_current_position?: string
          p_experience_years?: number
          p_facebook_link?: string
          p_full_name?: string
          p_industry?: string
          p_instagram_link?: string
          p_job_type?: string
          p_languages?: string[]
          p_linkedin_link?: string
          p_location?: string
          p_phone?: string
          p_postal_code?: string
          p_precise_address?: string
          p_preferred_location?: string
          p_skills?: string[]
          p_state?: string
          p_user_id: string
          p_whatsapp_number?: string
          p_youtube_link?: string
        }
        Returns: Json
      }
      admin_update_user_status: {
        Args: { p_status: string; p_user_id: string }
        Returns: undefined
      }
      ai_send_log_bucket_6h: { Args: { ts: string }; Returns: number }
      api_quota_refresh: {
        Args: { _user_id: string }
        Returns: {
          created_at: string
          monthly_limit: number
          period_start: string
          updated_at: string
          used: number
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "api_call_quota"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      archive_old_audit_logs: { Args: never; Returns: number }
      assign_admin_role: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      assign_job_to_indexing_queue: {
        Args: {
          p_action?: string
          p_job_id?: string
          p_page_type?: string
          p_priority?: number
          p_url: string
        }
        Returns: {
          assigned_date: string
          days_pending: number
          exact_scheduled_time: string
          message: string
          queue_id: string
          queue_position: number
        }[]
      }
      assign_role_to_user: {
        Args: { p_permissions?: Json; p_role: string; p_target_user_id: string }
        Returns: Json
      }
      assign_user_role: {
        Args: { target_user_id: string; user_role: string }
        Returns: undefined
      }
      auth_email_account_info: { Args: { p_email: string }; Returns: Json }
      auth_email_exists: { Args: { p_email: string }; Returns: boolean }
      auth_phone_taken: {
        Args: { _digits: string; _exclude?: string }
        Returns: boolean
      }
      batch_insert_onesignal_notifications: {
        Args: { p_notifications: Json }
        Returns: number
      }
      batch_insert_telegram_messages: {
        Args: { p_messages: Json }
        Returns: number
      }
      before_user_created_hook: { Args: { event: Json }; Returns: Json }
      bulk_update_permissions: {
        Args: { p_permissions: Json; p_user_ids: string[] }
        Returns: number
      }
      calculate_and_award_competition_prizes: {
        Args: { p_cycle_id: string }
        Returns: Json
      }
      calculate_company_trending_score: {
        Args: { company_id: string }
        Returns: number
      }
      calculate_organic_score: {
        Args: { p_applications_count: number; p_views_count: number }
        Returns: number
      }
      calculate_trending_score_v2: {
        Args: { p_job_id: string }
        Returns: number
      }
      calculate_uptime: { Args: { hours?: number }; Returns: number }
      cancel_user_scheduled_messages: {
        Args: { _channel?: string; _user_id: string }
        Returns: number
      }
      change_team_member_role: {
        Args: {
          p_new_role: string
          p_preserve_custom_permissions?: boolean
          p_target_user_id: string
        }
        Returns: Json
      }
      check_admin_rate_limit: {
        Args: {
          p_action_type: string
          p_max_attempts?: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: boolean
      }
      check_admin_role:
        | { Args: never; Returns: boolean }
        | {
            Args: { required_role: string; target_user_id: string }
            Returns: boolean
          }
      check_ai_chat_usage_only: {
        Args: { p_usage_type: string; p_user_id: string }
        Returns: Json
      }
      check_ai_chat_usage_only_base: {
        Args: { p_usage_type: string; p_user_id: string }
        Returns: Json
      }
      check_ai_image_limit: {
        Args: { p_user_id: string }
        Returns: {
          allowed: boolean
          monthly_limit: number
          plan_name: string
          remaining: number
        }[]
      }
      check_email_exists: { Args: { p_email: string }; Returns: boolean }
      check_job_boost_status: { Args: { p_job_id: string }; Returns: Json }
      check_onesignal_rate_limit: {
        Args: { p_max_per_second?: number }
        Returns: boolean
      }
      check_rate_limit:
        | {
            Args: {
              p_action_type: string
              p_max_attempts?: number
              p_window_minutes?: number
            }
            Returns: boolean
          }
        | {
            Args: {
              p_endpoint: string
              p_identifier: string
              p_max_requests?: number
              p_window_minutes?: number
            }
            Returns: boolean
          }
      check_role_hierarchy: {
        Args: { admin_role: string; target_role: string }
        Returns: boolean
      }
      check_telegram_rate_limit_v2: {
        Args: { p_max_per_second?: number }
        Returns: boolean
      }
      check_whatsapp_session: { Args: { p_phone: string }; Returns: boolean }
      claim_due_engagement_messages: {
        Args: { _limit?: number }
        Returns: {
          attempts: number
          body: string | null
          channel: string
          created_at: string
          created_run_id: string | null
          day_key: string | null
          id: string
          image_url: string | null
          language: string | null
          last_error: string | null
          message_type: string
          metadata: Json
          scheduled_at: string
          sent_at: string | null
          status: string
          subject: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "proactive_engagement_schedule"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      clean_cron_job_history: { Args: never; Returns: undefined }
      clean_old_notifications: { Args: never; Returns: number }
      cleanup_analytics_data: { Args: never; Returns: number }
      cleanup_cache_data: { Args: never; Returns: number }
      cleanup_expired_password_reset_tokens: { Args: never; Returns: undefined }
      cleanup_expired_sessions: { Args: never; Returns: number }
      cleanup_expired_totp_verifications: { Args: never; Returns: undefined }
      cleanup_inactive_users: { Args: never; Returns: Json }
      cleanup_interviews_with_logging: { Args: never; Returns: number }
      cleanup_invalid_player_ids: {
        Args: { invalid_player_ids: string[] }
        Returns: undefined
      }
      cleanup_logs_data: { Args: never; Returns: number }
      cleanup_old_cached_audio: { Args: never; Returns: undefined }
      cleanup_old_health_checks: { Args: never; Returns: undefined }
      cleanup_old_indexing_queue: { Args: never; Returns: number }
      cleanup_old_logs: { Args: never; Returns: Json }
      cleanup_old_request_logs: { Args: never; Returns: undefined }
      cleanup_onesignal_queue: { Args: never; Returns: number }
      cleanup_rate_limits: { Args: never; Returns: number }
      cleanup_telegram_queue: { Args: never; Returns: number }
      cleanup_user_data: { Args: never; Returns: number }
      consume_api_call: { Args: { _user_id: string }; Returns: Json }
      consume_whatsapp_send: {
        Args: {
          _burst_limit?: number
          _quality?: string
          _scope: string
          _scope_id: string
          _tier_limit?: number
        }
        Returns: Json
      }
      count_user_active_schedule: {
        Args: { _channel: string; _user_id: string; _window_hours: number }
        Returns: number
      }
      create_custom_role: {
        Args: {
          p_permissions: Json
          p_role_description: string
          p_role_name: string
        }
        Returns: Json
      }
      create_job_recommendation_notification: {
        Args: { p_job_id: string; p_user_id: string }
        Returns: undefined
      }
      create_recommendation_notifications_for_user:
        | { Args: { p_user_id: string }; Returns: undefined }
        | { Args: { p_limit?: number; p_user_id: string }; Returns: number }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      dblink: { Args: { "": string }; Returns: Record<string, unknown>[] }
      dblink_cancel_query: { Args: { "": string }; Returns: string }
      dblink_close: { Args: { "": string }; Returns: string }
      dblink_connect: { Args: { "": string }; Returns: string }
      dblink_connect_u: { Args: { "": string }; Returns: string }
      dblink_current_query: { Args: never; Returns: string }
      dblink_disconnect:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      dblink_error_message: { Args: { "": string }; Returns: string }
      dblink_exec: { Args: { "": string }; Returns: string }
      dblink_fdw_validator: {
        Args: { catalog: unknown; options: string[] }
        Returns: undefined
      }
      dblink_get_connections: { Args: never; Returns: string[] }
      dblink_get_notify:
        | { Args: { conname: string }; Returns: Record<string, unknown>[] }
        | { Args: never; Returns: Record<string, unknown>[] }
      dblink_get_pkey: {
        Args: { "": string }
        Returns: Database["public"]["CompositeTypes"]["dblink_pkey_results"][]
        SetofOptions: {
          from: "*"
          to: "dblink_pkey_results"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dblink_get_result: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      dblink_is_busy: { Args: { "": string }; Returns: number }
      delete_custom_role: { Args: { p_role_id: string }; Returns: undefined }
      delete_expired_jobs_immediately: { Args: never; Returns: number }
      developer_referred_whatsapp_users: {
        Args: never
        Returns: {
          company_email: string
          company_id: string
          company_name: string
          company_phone: string
          email: string
          full_name: string
          phone: string
          website: string
        }[]
      }
      expire_job_boosts: { Args: never; Returns: number }
      export_audit_logs: {
        Args: {
          p_action_type?: string
          p_end_date?: string
          p_start_date?: string
        }
        Returns: {
          action_type: string
          admin_email: string
          admin_name: string
          changes: Json
          id: string
          ip_address: string
          logged_at: string
          target_email: string
        }[]
      }
      finalize_monthly_cycle: {
        Args: { p_cycle_id: string }
        Returns: undefined
      }
      find_next_available_slot_date: {
        Args: { max_days_ahead?: number; start_date?: string }
        Returns: {
          available_date: string
          next_position: number
          remaining_slots: number
        }[]
      }
      fuzzy_search_jobs: {
        Args: {
          category_filter?: string
          experience_filter?: string
          job_location?: string
          job_type_filter?: string
          languages_filter?: string
          page_offset?: number
          page_size?: number
          salary_max?: number
          salary_min?: number
          search_query?: string
          sort_by?: string
        }
        Returns: {
          applications_count: number
          badge_color: string
          benefits: string
          boost_level: number
          calls_count: number
          category: string
          city: string
          company_facebook_link: string
          company_instagram_link: string
          company_linkedin_link: string
          company_name: string
          company_youtube_link: string
          country: string
          created_at: string
          description: string
          education_required: string
          experience_level: string
          id: string
          is_boosted: boolean
          is_verified: boolean
          job_type: string
          languages: string[]
          location: string
          logo_url: string
          match_score: number
          openings: number
          organic_rank: number
          organic_score: number
          public_slug: string
          requirements: string
          salary_range: string
          shares_count: number
          shift_timing: string
          short_id: string
          skills: string[]
          state: string
          status: string
          title: string
          trending_rank: number
          trending_score: number
          verified_plan_end: string
          views_count: number
          work_mode: string
        }[]
      }
      generate_certificate_number: { Args: never; Returns: string }
      generate_job_content_hash: { Args: { job_id: string }; Returns: string }
      generate_job_slug: { Args: never; Returns: string }
      generate_short_id: {
        Args: { length?: number; prefix: string }
        Returns: string
      }
      generate_slug: { Args: { input_text: string }; Returns: string }
      generate_telegram_connect_code: {
        Args: { prefix?: string }
        Returns: string
      }
      generate_ticket_number: { Args: never; Returns: string }
      generate_unique_company_slug: {
        Args: { company_id: string; company_name: string }
        Returns: string
      }
      generate_unique_profile_slug: {
        Args: { city: string; full_name: string; profile_id: string }
        Returns: string
      }
      generate_unique_referral_code: {
        Args: { p_user_id: string }
        Returns: string
      }
      generate_withdrawal_id: { Args: never; Returns: string }
      get_active_hero_banners: {
        Args: never
        Returns: {
          gradient: string
          id: string
          image_url: string
          link_url: string
          subtitle: string
          title: string
          youtube_url: string
        }[]
      }
      get_ai_proactive_scan_users: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          account_status: string
          city: string
          current_position: string
          date_of_birth: string
          email: string
          experience_years: number
          full_name: string
          has_active_push: boolean
          languages: string[]
          last_active_at: string
          last_any_message_at: string
          last_login_at: string
          location: string
          onesignal_player_id: string
          phone: string
          skills: string[]
          telegram_chat_id: number
          updated_at: string
          user_id: string
        }[]
      }
      get_all_active_jobs_v1: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          api_company_name: string
          applications_count: number
          badge_color: string
          base_score: number
          boost_level: number
          category: string
          city: string
          company: string
          country: string
          created_at: string
          description: string
          experience_level: string
          is_boosted: boolean
          is_verified: boolean
          job_id: string
          job_type: string
          languages: string[]
          latitude: number
          location: string
          logo_url: string
          longitude: number
          organic_rank: number
          precise_address: string
          salary_range: string
          skills: string[]
          state: string
          title: string
          trending_rank: number
          trending_score: number
          verified_plan_end: string
          views_count: number
        }[]
      }
      get_all_employers: {
        Args: {
          p_industry?: string
          p_limit?: number
          p_location?: string
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          account_status: string
          active_jobs: number
          badge_color: string
          city: string
          company_name: string
          company_size: string
          country: string
          created_at: string
          description: string
          email: string
          facebook_link: string
          hr_contact_name: string
          industry: string
          instagram_link: string
          is_profile_complete: boolean
          is_verified: boolean
          last_sign_in_at: string
          legal_name: string
          linkedin_link: string
          location: string
          logo_url: string
          phone: string
          postal_code: string
          precise_address: string
          state: string
          total_jobs: number
          user_id: string
          verified_plan_end: string
          website: string
          whatsapp_number: string
          youtube_link: string
        }[]
      }
      get_all_employers_enhanced: {
        Args: {
          p_industry?: string
          p_limit?: number
          p_location?: string
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          account_status: string
          active_jobs: number
          badge_color: string
          company_name: string
          company_size: string
          created_at: string
          email: string
          id: string
          industry: string
          is_verified: boolean
          location: string
          logo_url: string
          phone: string
          total_applications: number
          total_jobs: number
          updated_at: string
          user_id: string
          verified_plan_end: string
          verified_plan_start: string
        }[]
      }
      get_all_jobseekers: {
        Args: {
          p_industry?: string
          p_limit?: number
          p_location?: string
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: {
          account_status: string
          bio: string
          city: string
          company: string
          country: string
          created_at: string
          current_position: string
          education: string
          email: string
          experience_level: number
          experience_years: number
          facebook_link: string
          full_name: string
          industry: string
          instagram_link: string
          is_profile_complete: boolean
          job_type: string
          languages: string[]
          last_sign_in_at: string
          linkedin_link: string
          location: string
          phone: string
          postal_code: string
          precise_address: string
          preferred_location: string
          profile_image_url: string
          skills: string[]
          state: string
          total_applications: number
          user_id: string
          whatsapp_number: string
          youtube_link: string
        }[]
      }
      get_all_website_users:
        | {
            Args: never
            Returns: {
              application_count: number
              company_id: string
              company_name: string
              created_at: string
              email: string
              full_name: string
              has_applied: boolean
              is_banned: boolean
              location: string
              phone: string
              user_id: string
              user_type: string
            }[]
          }
        | {
            Args: {
              p_industry?: string
              p_limit?: number
              p_location?: string
              p_offset?: number
              p_search?: string
              p_status?: string
            }
            Returns: {
              account_status: string
              bio: string
              city: string
              company: string
              country: string
              created_at: string
              current_position: string
              education: string
              email: string
              experience_level: number
              experience_years: number
              facebook_link: string
              full_name: string
              industry: string
              instagram_link: string
              is_profile_complete: boolean
              job_type: string
              languages: string[]
              last_sign_in_at: string
              linkedin_link: string
              location: string
              phone: string
              postal_code: string
              precise_address: string
              preferred_location: string
              profile_image_url: string
              skills: string[]
              state: string
              total_applications: number
              user_id: string
              whatsapp_number: string
              youtube_link: string
            }[]
          }
      get_audit_logs:
        | {
            Args: { p_limit?: number; p_offset?: number }
            Returns: {
              action_type: string
              admin_email: string
              admin_name: string
              admin_user_id: string
              changes: Json
              id: string
              ip_address: string
              logged_at: string
              target_email: string
              target_user_id: string
            }[]
          }
        | {
            Args: { p_action?: string; p_limit?: number; p_table_name?: string }
            Returns: {
              action: string
              id: string
              new_data: Json
              old_data: Json
              performed_at: string
              performed_by: string
              table_name: string
            }[]
          }
      get_available_employer_industries: {
        Args: never
        Returns: {
          count: number
          industry: string
        }[]
      }
      get_available_employer_locations: {
        Args: never
        Returns: {
          count: number
          location: string
        }[]
      }
      get_blocked_accounts_for_admin: {
        Args: never
        Returns: {
          block_signals: Json | null
          canvas_fingerprint: string | null
          created_at: string | null
          device_id: string | null
          fingerprint_hash: string | null
          id: string
          is_active: boolean | null
          original_user_id: string
          reason: string
          updated_at: string | null
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "blocked_accounts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_brand_assets: { Args: never; Returns: Json }
      get_company_applicants_with_emails:
        | {
            Args: { p_company_id: string }
            Returns: {
              application_id: string
              applied_at: string
              bio: string
              city: string
              company: string
              country: string
              cover_letter: string
              current_position: string
              education: string
              email: string
              experience_level: number
              experience_years: number
              facebook_link: string
              full_name: string
              industry: string
              instagram_link: string
              job_id: string
              job_title: string
              job_type: string
              languages: string[]
              linkedin_link: string
              location: string
              phone: string
              postal_code: string
              precise_address: string
              preferred_location: string
              profile_image_url: string
              resume_url: string
              reviewed_at: string
              skills: string[]
              state: string
              status: string
              user_id: string
              whatsapp_number: string
              youtube_link: string
            }[]
          }
        | {
            Args: {
              p_from?: string
              p_job_id?: string
              p_limit?: number
              p_offset?: number
              p_search?: string
              p_status?: string
              p_to?: string
            }
            Returns: {
              application_id: string
              applied_at: string
              bio: string
              city: string
              company: string
              country: string
              cover_letter: string
              current_position: string
              education: string
              email: string
              experience_level: number
              experience_years: number
              facebook_link: string
              full_name: string
              industry: string
              instagram_link: string
              job_id: string
              job_title: string
              job_type: string
              languages: string[]
              linkedin_link: string
              location: string
              phone: string
              postal_code: string
              precise_address: string
              preferred_location: string
              profile_image_url: string
              resume_url: string
              reviewed_at: string
              skills: string[]
              state: string
              status: string
              user_id: string
              whatsapp_number: string
              youtube_link: string
            }[]
          }
      get_company_interviews: {
        Args: { p_from?: string; p_status?: string; p_to?: string }
        Returns: {
          applicant_current_position: string
          applicant_full_name: string
          applicant_id: string
          applicant_location: string
          applicant_phone: string
          applicant_profile_image_url: string
          created_at: string
          daily_room_name: string
          daily_room_url: string
          host_meeting_token: string
          host_user_id: string
          id: string
          jitsi_meeting_url: string
          jitsi_password: string
          jitsi_room_name: string
          job_id: string
          job_title: string
          location_url: string
          mode: string
          notes: string
          participant_meeting_tokens: Json
          scheduled_at: string
          scheduled_end_at: string
          status: string
          updated_at: string
          videosdk_host_token: string
          videosdk_meeting_url: string
          videosdk_participant_tokens: Json
          videosdk_room_id: string
        }[]
      }
      get_company_reviews: {
        Args: { p_company_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          created_at: string
          id: string
          is_verified: boolean
          rating: number
          review_text: string
          reviewer_name: string
          reviewer_position: string
        }[]
      }
      get_company_statistics: {
        Args: { p_company_id: string }
        Returns: {
          average_rating: number
          client_satisfaction_rating: number
          open_positions: number
          total_employees: number
          total_reviews: number
          years_in_business: number
        }[]
      }
      get_country_engagement: {
        Args: { days_back?: number }
        Returns: {
          country: string
          engagement_rate: number
          total_clicked: number
          total_delivered: number
          total_sent: number
        }[]
      }
      get_current_leaderboard: {
        Args: { p_limit?: number }
        Returns: {
          active_referrals_count: number
          company_name: string
          last_referral_at: string
          logo_url: string
          rank: number
          user_id: string
        }[]
      }
      get_database_stats: { Args: never; Returns: Json }
      get_employer_applicant_notification_count: {
        Args: { p_user_id?: string }
        Returns: number
      }
      get_employer_jobs: {
        Args: { p_user_id: string }
        Returns: {
          applications_count: number
          boost_level: number
          category: string
          created_at: string
          expires_at: string
          id: string
          is_boosted: boolean
          job_type: string
          location: string
          salary_range: string
          status: string
          title: string
          views_count: number
        }[]
      }
      get_financial_statistics: {
        Args: never
        Returns: {
          total_referral_balance: number
          total_referral_earned: number
          total_referral_withdrawn: number
          total_users_with_referral: number
          total_users_with_wallet: number
          total_wallet_points: number
          total_wallet_purchased: number
          total_wallet_spent: number
        }[]
      }
      get_financial_statistics_by_period: {
        Args: { p_period: string }
        Returns: {
          total_referral_balance: number
          total_referral_earned: number
          total_referral_withdrawn: number
          total_users_with_referral: number
          total_users_with_wallet: number
          total_wallet_points: number
          total_wallet_purchased: number
          total_wallet_spent: number
        }[]
      }
      get_indexing_stats: {
        Args: never
        Returns: {
          completed_count: number
          failed_count: number
          pending_count: number
          this_week_indexed: number
          today_indexed: number
          total_queued: number
        }[]
      }
      get_job_applicants_with_emails: {
        Args: { p_job_id: string }
        Returns: {
          application_id: string
          applied_at: string
          bio: string
          city: string
          company: string
          country: string
          cover_letter: string
          current_position: string
          education: string
          email: string
          experience_level: number
          experience_years: number
          facebook_link: string
          full_name: string
          industry: string
          instagram_link: string
          job_id: string
          job_type: string
          languages: string[]
          linkedin_link: string
          location: string
          phone: string
          postal_code: string
          precise_address: string
          preferred_location: string
          profile_image_url: string
          resume_url: string
          reviewed_at: string
          skills: string[]
          state: string
          status: string
          user_id: string
          whatsapp_number: string
          youtube_link: string
        }[]
      }
      get_job_application_count: { Args: { p_job_id: string }; Returns: number }
      get_job_categories_stats: {
        Args: never
        Returns: {
          category: string
          growth_percentage: number
          job_count: number
        }[]
      }
      get_job_for_application: {
        Args: { p_job_id: string }
        Returns: {
          company_id: string
          company_name: string
          id: string
          location: string
          status: string
          title: string
        }[]
      }
      get_job_indexing_status_for_user: {
        Args: { p_job_id: string }
        Returns: {
          bing_status: string
          estimated_days_remaining: number
          expected_index_date: string
          google_status: string
          is_bing_public: boolean
          is_google_public: boolean
          job_id: string
          queue_position: number
        }[]
      }
      get_job_location_statistics: {
        Args: never
        Returns: {
          active_jobs: number
          city: string
          country: string
          draft_jobs: number
          public_jobs: number
          state: string
          total_jobs: number
        }[]
      }
      get_job_view_count: { Args: { p_job_id: string }; Returns: number }
      get_jobs_due_for_verification: {
        Args: { p_limit?: number }
        Returns: {
          google_status: string
          google_submitted_at: string
          id: string
          job_id: string
          max_verification_attempts: number
          next_verification_at: string
          url: string
          verification_attempt_count: number
        }[]
      }
      get_jobs_with_organic_ranks: {
        Args: never
        Returns: {
          applications_count: number
          job_id: string
          organic_rank: number
          organic_score: number
          views_count: number
        }[]
      }
      get_latest_company_for_user: {
        Args: { p_user_id: string }
        Returns: {
          account_status: string
          account_status_reason: string | null
          badge_color: string | null
          ban_type: string | null
          business_type: string | null
          cin_number: string | null
          city: string | null
          clients_description: string | null
          company_details: string | null
          company_name: string
          company_size: string | null
          core_values: string | null
          country: string | null
          created_at: string
          data_privacy_measures: string | null
          description: string | null
          differentiating_factors: string | null
          dispute_resolution: string | null
          district: string | null
          email: string | null
          facebook_link: string | null
          founder_bio: string | null
          founder_name: string | null
          free_trial_job_id: string | null
          free_trial_used: boolean | null
          gst_certificate: string | null
          gst_number: string | null
          hr_contact_name: string | null
          id: string
          incorporation_certificate: string | null
          incorporation_date: string | null
          industry: string | null
          instagram_link: string | null
          interview_contact_details: string | null
          is_profile_complete: boolean | null
          is_verified: boolean | null
          job_posting_ban_reason: string | null
          job_posting_visibility: boolean
          key_team_members: string | null
          last_interaction_at: string | null
          latitude: number | null
          legal_name: string | null
          linkedin_link: string | null
          location: string | null
          location_last_updated: string | null
          logo_url: string | null
          longitude: number | null
          mission: string | null
          msme_number: string | null
          onesignal_player_id: string | null
          organisation_size: string | null
          pan_number: string | null
          phone: string | null
          postal_code: string | null
          precise_address: string | null
          pricing_plans: string | null
          profile_ban_reason: string | null
          profile_views_count: number | null
          rbi_compliance: string | null
          refund_policy: string | null
          registered_address: string | null
          services_description: string | null
          short_id: string | null
          slug: string | null
          state: string | null
          support_email: string | null
          telegram_chat_id: number | null
          telegram_connect_code: string | null
          telegram_connected_at: string | null
          telegram_id: number | null
          telegram_notifications_enabled: boolean | null
          telegram_username: string | null
          testimonials: string | null
          total_views: number | null
          trending_score: number | null
          updated_at: string
          user_id: string
          verified_plan_end: string | null
          verified_plan_start: string | null
          vision: string | null
          website: string | null
          whatsapp_number: string | null
          whatsapp_verified: boolean | null
          youtube_link: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "companies"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_latest_jobs_with_priority: {
        Args: { p_limit?: number; p_offset?: number; p_user_id?: string }
        Returns: {
          applications_count: number
          badge_color: string
          boost_level: number
          category: string
          city: string
          company: string
          company_facebook_link: string
          company_instagram_link: string
          company_linkedin_link: string
          company_youtube_link: string
          country: string
          created_at: string
          description: string
          effective_date: string
          experience_level: string
          is_boosted: boolean
          is_verified: boolean
          job_id: string
          job_type: string
          languages: string[]
          location: string
          location_match: string
          logo_url: string
          salary_range: string
          skills: string[]
          state: string
          title: string
          verified_plan_end: string
          views_count: number
        }[]
      }
      get_latest_jobs_with_priority_v2:
        | {
            Args: { p_limit?: number; p_offset?: number }
            Returns: {
              applications_count: number
              badge_color: string
              base_score: number
              boost_level: number
              category: string
              city: string
              company: string
              company_facebook_link: string
              company_instagram_link: string
              company_linkedin_link: string
              company_youtube_link: string
              country: string
              created_at: string
              description: string
              effective_date: string
              experience_level: string
              is_boosted: boolean
              is_new: boolean
              is_verified: boolean
              job_id: string
              job_type: string
              languages: string[]
              latitude: number
              location: string
              location_match: string
              logo_url: string
              longitude: number
              organic_rank: number
              precise_address: string
              salary_range: string
              skills: string[]
              state: string
              title: string
              trending_rank: number
              trending_score: number
              verified_plan_end: string
              views_count: number
            }[]
          }
        | {
            Args: { p_limit?: number; p_offset?: number; p_user_id?: string }
            Returns: {
              api_company_name: string
              applications_count: number
              badge_color: string
              base_score: number
              boost_level: number
              category: string
              city: string
              company: string
              company_facebook_link: string
              company_instagram_link: string
              company_linkedin_link: string
              company_youtube_link: string
              country: string
              created_at: string
              description: string
              education_required: string
              effective_date: string
              experience_level: string
              is_boosted: boolean
              is_new: boolean
              is_verified: boolean
              job_id: string
              job_type: string
              languages: string[]
              latitude: number
              location: string
              location_match: string
              logo_url: string
              longitude: number
              openings: number
              organic_rank: number
              precise_address: string
              public_slug: string
              salary_range: string
              shift_timing: string
              short_id: string
              skills: string[]
              state: string
              title: string
              trending_rank: number
              trending_score: number
              verified_plan_end: string
              views_count: number
              work_mode: string
            }[]
          }
      get_latest_player_id: { Args: { _user_id: string }; Returns: string }
      get_leaderboard_history: {
        Args: { p_user_id?: string }
        Returns: {
          active_referrals_count: number
          company_name: string
          created_at: string
          cycle_end: string
          cycle_id: string
          cycle_start: string
          final_rank: number
          reward_amount: number
          user_id: string
        }[]
      }
      get_login_activity_statistics:
        | { Args: never; Returns: Json }
        | {
            Args: { p_period?: string }
            Returns: {
              period_date: string
              total_logins: number
              unique_users: number
            }[]
          }
      get_login_email_by_phone: { Args: { p_phone: string }; Returns: string }
      get_messaging_queue_stats: { Args: never; Returns: Json }
      get_my_api_quota: { Args: never; Returns: Json }
      get_new_accounts_statistics:
        | { Args: never; Returns: Json }
        | {
            Args: { p_period?: string }
            Returns: {
              employer_accounts: number
              jobseeker_accounts: number
              period_date: string
              total_new_accounts: number
            }[]
          }
      get_next_indexing_job: {
        Args: never
        Returns: {
          action: string
          daily_position: number
          id: string
          page_type: string
          priority: number
          queue_date: string
          retry_count: number
          url: string
        }[]
      }
      get_next_pending_job_for_indexing: {
        Args: never
        Returns: {
          action: string
          calculated_process_datetime: string
          id: string
          job_id: string
          original_created_at: string
          queue_position: number
          retry_count: number
          url: string
        }[]
      }
      get_notification_stats: {
        Args: { days_back?: number }
        Returns: {
          avg_ctr: number
          total_clicked: number
          total_delivered: number
          total_notifications: number
          total_sent: number
        }[]
      }
      get_onesignal_queue_batch: {
        Args: { batch_size?: number }
        Returns: {
          created_at: string | null
          data: Json | null
          error_message: string | null
          id: string
          max_retries: number | null
          message: string
          player_ids: string[]
          priority: number | null
          retry_count: number | null
          scheduled_at: string | null
          sent_at: string | null
          status: string | null
          title: string
          updated_at: string | null
          url: string | null
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "onesignal_message_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_or_create_daily_quota: {
        Args: never
        Returns: {
          created_at: string
          date: string
          id: string
          indexnow_fallback_count: number | null
          last_reset_at: string | null
          quota_limit: number
          quota_used: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "indexing_daily_quota"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_or_create_daily_slots: {
        Args: { target_date: string }
        Returns: {
          created_at: string | null
          date: string
          total_slots: number
          updated_at: string | null
          used_slots: number
        }
        SetofOptions: {
          from: "*"
          to: "indexing_daily_slots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_owner_overview_statistics: {
        Args: never
        Returns: {
          active_companies: number
          active_members: number
          banned_companies: number
          inactive_members: number
          profile_complete_percentage: number
          total_companies: number
          total_members: number
          verified_companies: number
        }[]
      }
      get_partner_branding: {
        Args: { _developer_id: string }
        Returns: {
          brand_name: string
          logo_url: string
          tagline: string
          website: string
        }[]
      }
      get_personalized_jobs: {
        Args: { p_limit?: number; p_offset?: number; u_id?: string }
        Returns: {
          applications_count: number
          badge_color: string
          boost_level: number
          category: string
          company: string
          company_facebook_link: string
          company_instagram_link: string
          company_linkedin_link: string
          company_youtube_link: string
          created_at: string
          description: string
          experience_level: string
          is_boosted: boolean
          is_verified: boolean
          job_id: string
          job_type: string
          location: string
          logo_url: string
          salary_range: string
          score: number
          skills: string[]
          title: string
          verified_plan_end: string
          views_count: number
        }[]
      }
      get_personalized_jobs_by_location:
        | {
            Args: never
            Returns: {
              application_count: number
              benefits: string[]
              company_id: string
              company_logo_url: string
              company_name: string
              description: string
              experience_level: string
              expires_at: string
              id: string
              job_type: string
              location: string
              posted_at: string
              requirements: string
              salary_currency: string
              salary_max: number
              salary_min: number
              skills: string[]
              title: string
            }[]
          }
        | {
            Args: { p_limit?: number; p_location_filter: string }
            Returns: {
              application_count: number
              benefits: string[]
              company_id: string
              company_logo_url: string
              company_name: string
              description: string
              experience_level: string
              expires_at: string
              id: string
              job_type: string
              location: string
              match_score: number
              posted_at: string
              requirements: string
              salary_currency: string
              salary_max: number
              salary_min: number
              skills: string[]
              title: string
            }[]
          }
        | {
            Args: {
              p_limit?: number
              p_location_priority?: string
              p_offset?: number
              p_user_id?: string
            }
            Returns: {
              applications_count: number
              badge_color: string
              boost_level: number
              category: string
              city: string
              company: string
              company_facebook_link: string
              company_instagram_link: string
              company_latitude: number
              company_linkedin_link: string
              company_longitude: number
              company_youtube_link: string
              country: string
              created_at: string
              description: string
              experience_level: string
              is_boosted: boolean
              is_verified: boolean
              job_id: string
              job_type: string
              languages: string[]
              location: string
              location_match_level: string
              logo_url: string
              match_reason: string
              match_score: number
              salary_range: string
              skills: string[]
              state: string
              title: string
              trending_score: number
              verified_plan_end: string
              views_count: number
            }[]
          }
        | {
            Args: {
              p_city?: string
              p_country?: string
              p_limit?: number
              p_location_priority?: string
              p_state?: string
              p_user_id: string
            }
            Returns: {
              applications_count: number
              badge_color: string
              boost_level: number
              category: string
              city: string
              company: string
              company_facebook_link: string
              company_instagram_link: string
              company_linkedin_link: string
              company_youtube_link: string
              country: string
              created_at: string
              description: string
              experience_level: string
              is_boosted: boolean
              is_verified: boolean
              job_id: string
              job_type: string
              latitude: number
              location: string
              location_match_level: string
              logo_url: string
              longitude: number
              salary_range: string
              skills: string[]
              state: string
              title: string
              verified_plan_end: string
              views_count: number
            }[]
          }
        | {
            Args: {
              p_city: string
              p_country?: string
              p_limit?: number
              p_offset?: number
              p_state: string
              p_user_id: string
            }
            Returns: {
              applications_count: number
              badge_color: string
              benefits: string
              boost_level: number
              category: string
              city: string
              company_facebook_link: string
              company_id: string
              company_instagram_link: string
              company_latitude: number
              company_linkedin_link: string
              company_longitude: number
              company_name: string
              company_youtube_link: string
              country: string
              created_at: string
              description: string
              experience_level: string
              expires_at: string
              is_boosted: boolean
              is_verified: boolean
              job_id: string
              job_type: string
              languages: string[]
              location: string
              location_match_level: string
              logo_url: string
              match_reason: string
              match_score: number
              precise_address: string
              requirements: string
              salary_range: string
              skills: string[]
              state: string
              status: string
              title: string
              trending_score: number
              verified_plan_end: string
              views_count: number
            }[]
          }
        | {
            Args: { p_limit?: number; p_user_id: string }
            Returns: {
              applications_count: number
              badge_color: string
              boost_level: number
              category: string
              city: string
              company: string
              company_facebook_link: string
              company_instagram_link: string
              company_latitude: number
              company_linkedin_link: string
              company_longitude: number
              company_youtube_link: string
              country: string
              created_at: string
              description: string
              experience_level: string
              is_boosted: boolean
              is_verified: boolean
              job_id: string
              job_type: string
              languages: string[]
              location: string
              logo_url: string
              match_reason: string
              match_score: number
              salary_range: string
              skills: string[]
              state: string
              title: string
              verified_plan_end: string
              views_count: number
            }[]
          }
        | {
            Args: { p_limit: number; p_offset: number; p_user_id: string }
            Returns: {
              applications_count: number
              badge_color: string
              boost_level: number
              category: string
              city: string
              company: string
              company_facebook_link: string
              company_instagram_link: string
              company_latitude: number
              company_linkedin_link: string
              company_longitude: number
              company_youtube_link: string
              country: string
              created_at: string
              description: string
              experience_level: string
              is_boosted: boolean
              is_verified: boolean
              job_id: string
              job_type: string
              languages: string[]
              location: string
              logo_url: string
              match_reason: string
              match_score: number
              salary_range: string
              skills: string[]
              state: string
              title: string
              verified_plan_end: string
              views_count: number
            }[]
          }
      get_personalized_jobs_v2: {
        Args: { p_limit?: number; p_offset?: number; p_user_id?: string }
        Returns: {
          applications_count: number
          badge_color: string
          boost_level: number
          category: string
          city: string
          company: string
          company_facebook_link: string
          company_instagram_link: string
          company_linkedin_link: string
          company_youtube_link: string
          country: string
          created_at: string
          description: string
          experience_level: string
          is_boosted: boolean
          is_verified: boolean
          job_id: string
          job_type: string
          languages: string[]
          location: string
          logo_url: string
          match_reason: string
          match_score: number
          salary_range: string
          score: number
          skills: string[]
          state: string
          title: string
          verified_plan_end: string
          views_count: number
        }[]
      }
      get_personalized_jobs_v3: {
        Args: { p_limit?: number; p_offset?: number; p_user_id: string }
        Returns: {
          api_company_name: string
          applications_count: number
          benefits: string
          boost_bonus_applied: number
          boost_end_date: string
          boost_level: number
          calls_count: number
          category: string
          city: string
          company_id: string
          country: string
          created_at: string
          description: string
          experience_level: string
          expires_at: string
          id: string
          is_boosted: boolean
          is_featured: boolean
          job_id: string
          job_type: string
          languages: string[]
          latitude: number
          location: string
          longitude: number
          organic_rank: number
          organic_score: number
          relevance_score: number
          requirements: string
          responsibilities: string[]
          salary_currency: string
          salary_max: number
          salary_min: number
          salary_period: string
          salary_range: string
          shares_count: number
          skills: string[]
          state: string
          status: string
          title: string
          trending_rank: number
          trending_score: number
          updated_at: string
          views_count: number
          visibility: string
        }[]
      }
      get_public_jobs: {
        Args: { job_limit?: number }
        Returns: {
          applications_count: number
          badge_color: string
          boost_level: number
          category: string
          company: string
          company_facebook_link: string
          company_instagram_link: string
          company_linkedin_link: string
          company_youtube_link: string
          created_at: string
          description: string
          experience_level: string
          is_boosted: boolean
          is_verified: boolean
          job_id: string
          job_type: string
          location: string
          logo_url: string
          salary_range: string
          skills: string[]
          title: string
          verified_plan_end: string
          views_count: number
        }[]
      }
      get_public_pricing: { Args: never; Returns: Json }
      get_queue_completion_estimate: {
        Args: never
        Returns: {
          days_to_complete: number
          estimated_completion_date: string
          pending_count: number
        }[]
      }
      get_recommended_jobs: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          company: string
          id: string
          job_type: string
          location: string
          match_score: number
          salary_max: number
          salary_min: number
          title: string
        }[]
      }
      get_remaining_quota: { Args: never; Returns: number }
      get_search_suggestions: {
        Args: { limit_count?: number; query_text: string }
        Returns: {
          count: number
          suggestion: string
          type: string
        }[]
      }
      get_server_time: { Args: never; Returns: string }
      get_server_time_ist: { Args: never; Returns: number }
      get_team_members: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          last_sign_in_at: string
          location: string
          permissions: Json
          phone: string
          role: string
          user_id: string
        }[]
      }
      get_telegram_bot_username: {
        Args: { p_audience: string }
        Returns: string
      }
      get_telegram_queue_batch: {
        Args: { p_batch_size?: number }
        Returns: {
          chat_id: number
          created_at: string
          id: string
          max_retries: number
          message_content: string
          metadata: Json
          parse_mode: string
          priority: number
          retry_count: number
          scheduled_at: string
          status: string
          trigger_log_id: string
          trigger_rule_id: string
        }[]
      }
      get_today_indexing_quota: {
        Args: never
        Returns: {
          date: string
          is_quota_available: boolean
          remaining_count: number
          total_limit: number
          used_count: number
        }[]
      }
      get_total_employers_count: {
        Args: {
          p_industry?: string
          p_location?: string
          p_search?: string
          p_status?: string
        }
        Returns: number
      }
      get_total_jobseekers_count: {
        Args: {
          p_industry?: string
          p_location?: string
          p_search?: string
          p_status?: string
        }
        Returns: number
      }
      get_trending_jobs_optimized: {
        Args: { p_limit?: number; p_offset?: number; p_user_id?: string }
        Returns: {
          applications_count: number
          badge_color: string
          boost_level: number
          category: string
          city: string
          company: string
          company_facebook_link: string
          company_instagram_link: string
          company_linkedin_link: string
          company_youtube_link: string
          country: string
          created_at: string
          description: string
          experience_level: string
          is_boosted: boolean
          is_verified: boolean
          job_id: string
          job_type: string
          languages: string[]
          location: string
          location_match: string
          logo_url: string
          salary_range: string
          skills: string[]
          state: string
          title: string
          trending_score: number
          verified_plan_end: string
          views_count: number
        }[]
      }
      get_trending_jobs_optimized_v2:
        | {
            Args: { p_limit?: number }
            Returns: {
              application_count: number
              benefits: string[]
              company_id: string
              company_logo_url: string
              company_name: string
              description: string
              experience_level: string
              expires_at: string
              id: string
              job_type: string
              location: string
              posted_at: string
              requirements: string
              salary_currency: string
              salary_max: number
              salary_min: number
              skills: string[]
              title: string
              trending_score: number
            }[]
          }
        | {
            Args: { p_limit?: number; p_offset?: number }
            Returns: {
              api_company_name: string
              applications_count: number
              benefits: string
              boost_bonus_applied: number
              boost_end_date: string
              boost_level: number
              calls_count: number
              category: string
              city: string
              company_id: string
              country: string
              created_at: string
              description: string
              experience_level: string
              expires_at: string
              id: string
              is_boosted: boolean
              is_featured: boolean
              job_id: string
              job_type: string
              languages: string[]
              latitude: number
              location: string
              longitude: number
              organic_rank: number
              organic_score: number
              requirements: string
              responsibilities: string[]
              salary_currency: string
              salary_max: number
              salary_min: number
              salary_period: string
              salary_range: string
              shares_count: number
              skills: string[]
              state: string
              status: string
              title: string
              trending_rank: number
              trending_score: number
              updated_at: string
              views_count: number
              visibility: string
            }[]
          }
        | {
            Args: { p_limit?: number; p_offset?: number; p_user_id?: string }
            Returns: {
              applications_count: number
              badge_color: string
              boost_level: number
              category: string
              city: string
              company: string
              company_facebook_link: string
              company_instagram_link: string
              company_latitude: number
              company_linkedin_link: string
              company_longitude: number
              company_youtube_link: string
              country: string
              created_at: string
              description: string
              experience_level: string
              is_boosted: boolean
              is_verified: boolean
              job_id: string
              job_type: string
              languages: string[]
              location: string
              location_match: string
              logo_url: string
              salary_range: string
              skills: string[]
              state: string
              title: string
              trending_score: number
              verified_plan_end: string
              views_count: number
            }[]
          }
      get_trending_jobs_with_ranks: {
        Args: { p_limit?: number; p_offset?: number; p_user_id?: string }
        Returns: {
          applications_count: number
          badge_color: string
          boost_level: number
          category: string
          city: string
          company: string
          company_facebook_link: string
          company_instagram_link: string
          company_latitude: number
          company_linkedin_link: string
          company_longitude: number
          company_youtube_link: string
          country: string
          created_at: string
          description: string
          experience_level: string
          is_boosted: boolean
          is_verified: boolean
          job_id: string
          job_type: string
          languages: string[]
          location: string
          location_match: string
          logo_url: string
          salary_range: string
          skills: string[]
          state: string
          title: string
          trending_rank: number
          trending_score: number
          verified_plan_end: string
          views_count: number
        }[]
      }
      get_trust_companies: {
        Args: { _limit?: number }
        Returns: {
          image_url: string
          name: string
          verified: boolean
        }[]
      }
      get_trust_seekers: {
        Args: { _limit?: number }
        Returns: {
          image_url: string
          name: string
        }[]
      }
      get_unique_view_count: { Args: { p_job_id: string }; Returns: number }
      get_unread_applicants_per_job: {
        Args: { p_employer_id?: string }
        Returns: {
          job_id: string
          last_viewed_at: string
          total_applicants: number
          unread_count: number
        }[]
      }
      get_unread_notifications_count: {
        Args: { user_uuid?: string }
        Returns: number
      }
      get_user_ai_chat_status: { Args: { p_user_id: string }; Returns: Json }
      get_user_ai_chat_status_base: {
        Args: { p_user_id: string }
        Returns: Json
      }
      get_user_application_response_rate: {
        Args: { p_user_id: string }
        Returns: number
      }
      get_user_company: {
        Args: { p_user_id?: string }
        Returns: {
          account_status: string
          company_name: string
          id: string
          is_profile_complete: boolean
        }[]
      }
      get_user_email: { Args: { p_user_id: string }; Returns: string }
      get_user_leaderboard_position: {
        Args: { p_user_id: string }
        Returns: {
          active_referrals_count: number
          cycle_end: string
          cycle_id: string
          next_rank_gap: number
          rank: number
        }[]
      }
      get_user_location_statistics: {
        Args: never
        Returns: {
          active_members: number
          city: string
          country: string
          profile_complete_members: number
          state: string
          total_members: number
        }[]
      }
      get_user_permissions: { Args: { p_user_id: string }; Returns: Json }
      get_user_profile_views: { Args: { p_user_id: string }; Returns: number }
      get_user_profile_views_with_period: {
        Args: { p_user_id: string }
        Returns: {
          total_views: number
          views_last_30_days: number
          views_today: number
        }[]
      }
      get_user_push_eligibility: {
        Args: { _user_id: string }
        Returns: {
          can_send: boolean
          daily_limit: number
          hours_since_last: number
          last_category: string
          reason: string
          remaining: number
          tier: string
          used: number
        }[]
      }
      get_user_response_rate: { Args: { p_user_id: string }; Returns: number }
      get_user_role: { Args: { user_uuid?: string }; Returns: string }
      get_whatsapp_send_usage: {
        Args: { _scope: string; _scope_id: string }
        Returns: Json
      }
      grant_admin_access: { Args: never; Returns: string }
      has_job_content_changed: { Args: { p_job_id: string }; Returns: boolean }
      has_permission: {
        Args: { p_permission_path: string; p_user_id: string }
        Returns: boolean
      }
      has_role:
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | { Args: { _role: string; _user_id: string }; Returns: boolean }
      increment_ai_chat_usage: {
        Args: { p_tokens: number; p_usage_type: string; p_user_id: string }
        Returns: Json
      }
      increment_ai_chat_usage_base: {
        Args: { p_tokens?: number; p_usage_type: string; p_user_id: string }
        Returns: Json
      }
      increment_ai_image_usage: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      increment_job_counter: {
        Args: { counter_type: string; job_id: string }
        Returns: undefined
      }
      increment_login_count: { Args: { p_user_id: string }; Returns: undefined }
      increment_quota_usage: {
        Args: { increment_by?: number }
        Returns: undefined
      }
      increment_trick_views: {
        Args: { trick_id_param: string }
        Returns: undefined
      }
      initialize_monthly_cycle: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_owner: { Args: never; Returns: boolean }
      is_admin_user: { Args: { check_user_id?: string }; Returns: boolean }
      is_ai_unlimited_owner: { Args: { p_user_id: string }; Returns: boolean }
      is_company_favorited: {
        Args: { p_company_id: string; p_user_id?: string }
        Returns: boolean
      }
      is_company_message_owner: {
        Args: { _message_id: string }
        Returns: boolean
      }
      is_company_owner: { Args: { _company_id: string }; Returns: boolean }
      is_donation_admin: { Args: { _user_id: string }; Returns: boolean }
      link_signup_verified_phone: {
        Args: { _phone_user_id: string }
        Returns: boolean
      }
      list_oversized_storage_objects: {
        Args: { _bucket: string; _max_rows?: number; _min_bytes: number }
        Returns: {
          mimetype: string
          name: string
          size: number
        }[]
      }
      log_notification_engagement: {
        Args: {
          p_action: string
          p_channel: string
          p_event_type: string
          p_message_log_id?: string
          p_metadata?: Json
          p_user_agent?: string
          p_user_id: string
          p_variant_id?: string
        }
        Returns: string
      }
      log_profile_view: {
        Args: { p_profile_user_id: string; p_viewer_id: string }
        Returns: undefined
      }
      mark_employer_applicant_notifications_read: {
        Args: { p_user_id?: string }
        Returns: boolean
      }
      mark_job_applicants_viewed: {
        Args: { p_employer_id?: string; p_job_id: string }
        Returns: undefined
      }
      mark_onesignal_sent: {
        Args: {
          p_error_message?: string
          p_message_id: string
          p_success: boolean
        }
        Returns: undefined
      }
      mark_telegram_failed: {
        Args: {
          p_error_message: string
          p_is_rate_limited?: boolean
          p_queue_id: string
        }
        Returns: undefined
      }
      mark_telegram_queue_failed: {
        Args: { p_error_message?: string; p_queue_id: string }
        Returns: undefined
      }
      mark_telegram_queue_sent: {
        Args: { queue_ids: string[] }
        Returns: number
      }
      mark_telegram_sent: {
        Args: { p_queue_id: string; p_telegram_message_id?: number }
        Returns: undefined
      }
      master_cleanup: { Args: never; Returns: Json }
      master_cleanup_all_logs: { Args: never; Returns: number }
      owner_notification_delivery_history: {
        Args: { _date: string }
        Returns: {
          email: string
          email_failed: number
          email_sent: number
          full_name: string
          phone: string
          push_failed: number
          push_sent: number
          telegram_failed: number
          telegram_sent: number
          user_id: string
          user_type: string
        }[]
      }
      password_strength_hook: { Args: { event: Json }; Returns: Json }
      populate_current_leaderboard:
        | { Args: never; Returns: undefined }
        | {
            Args: { cycle_end: string; cycle_start: string; v_cycle_id: string }
            Returns: undefined
          }
      process_referral_commission:
        | {
            Args: {
              p_payment_amount: number
              p_payment_id: string
              p_referred_user_id: string
              p_source_type: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_payment_amount: number
              p_payment_id: string
              p_referred_user_id: string
              p_source_type?: string
            }
            Returns: undefined
          }
      process_withdrawal_failure: {
        Args: {
          p_admin_id: string
          p_failure_reason: string
          p_withdrawal_id: string
        }
        Returns: Json
      }
      process_withdrawal_success: {
        Args: { p_admin_id: string; p_withdrawal_id: string }
        Returns: Json
      }
      queue_notification: {
        Args: {
          p_event_type: string
          p_metadata?: Json
          p_user_id: string
          p_user_name?: string
          p_user_type?: string
        }
        Returns: undefined
      }
      recalculate_all_job_scores: { Args: never; Returns: undefined }
      recalculate_all_queue_dates: {
        Args: never
        Returns: {
          updated_count: number
        }[]
      }
      recalculate_push_tier: { Args: { _user_id: string }; Returns: string }
      record_push_send: {
        Args: { _category: string; _status?: string; _user_id: string }
        Returns: undefined
      }
      refresh_current_leaderboard: { Args: never; Returns: undefined }
      release_indexing_slot: { Args: { p_queue_id: string }; Returns: boolean }
      remove_team_member: {
        Args: { p_target_user_id: string }
        Returns: undefined
      }
      reorder_packages: {
        Args: {
          new_orders: number[]
          package_ids: string[]
          package_table_name: string
        }
        Returns: undefined
      }
      reschedule_pending_to_next_day: { Args: never; Returns: number }
      reserve_outlook_send: {
        Args: { _day_limit: number; _hour_limit: number; _user_id: string }
        Returns: boolean
      }
      reset_daily_indexing_quota: { Args: never; Returns: undefined }
      run_all_cleanup: { Args: never; Returns: Json }
      run_expiry_reminders: { Args: never; Returns: Json }
      run_interview_start_notifications: { Args: never; Returns: Json }
      run_weekly_vacuum_analyze: { Args: never; Returns: string }
      schedule_verification_check: {
        Args: { p_job_id: string }
        Returns: undefined
      }
      search_jobs: {
        Args: {
          category_filter?: string
          experience_filter?: string
          job_location?: string
          job_type_filter?: string
          page_offset?: number
          page_size?: number
          salary_max?: number
          salary_min?: number
          search_query?: string
        }
        Returns: {
          applications_count: number
          benefits: string
          boost_level: number
          calls_count: number
          category: string
          company_name: string
          created_at: string
          description: string
          experience_level: string
          id: string
          is_boosted: boolean
          job_type: string
          location: string
          logo_url: string
          requirements: string
          salary_range: string
          shares_count: number
          skills: string[]
          status: string
          title: string
          trending_score: number
          views_count: number
        }[]
      }
      search_jobs_by_id: {
        Args: { search_term: string }
        Returns: {
          applications_count: number
          badge_color: string
          benefits: string
          boost_level: number
          calls_count: number
          category: string
          city: string
          company_facebook_link: string
          company_instagram_link: string
          company_linkedin_link: string
          company_name: string
          company_youtube_link: string
          country: string
          created_at: string
          description: string
          experience_level: string
          id: string
          is_boosted: boolean
          is_verified: boolean
          job_type: string
          latitude: number
          location: string
          logo_url: string
          longitude: number
          precise_address: string
          requirements: string
          salary_range: string
          shares_count: number
          short_id: string
          skills: string[]
          state: string
          status: string
          title: string
          trending_score: number
          verified_plan_end: string
          views_count: number
        }[]
      }
      search_users_by_email: {
        Args: { search_query: string }
        Returns: {
          avatar_url: string
          email: string
          full_name: string
          id: string
        }[]
      }
      send_referral_push: {
        Args: {
          p_action_url: string
          p_data?: Json
          p_message: string
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      setup_admin_access: { Args: never; Returns: string }
      setup_initial_admin_user: { Args: never; Returns: undefined }
      storage_orphan_objects: {
        Args: { grace_hours?: number; max_rows?: number }
        Returns: {
          bucket_id: string
          object_name: string
          size_bytes: number
        }[]
      }
      storage_referenced_keys: {
        Args: never
        Returns: {
          key: string
        }[]
      }
      storage_stats_apply: {
        Args: { p_bucket: string; p_items: Json; p_provider: string }
        Returns: undefined
      }
      submit_job_application: {
        Args: {
          p_api_bio?: string
          p_api_email?: string
          p_api_full_name?: string
          p_api_location?: string
          p_api_phone?: string
          p_api_whatsapp_number?: string
          p_applicant_id?: string
          p_application_source?: string
          p_cover_letter?: string
          p_job_id: string
        }
        Returns: string
      }
      sync_company_profile_completion: { Args: never; Returns: undefined }
      sync_job_indexing_status: { Args: never; Returns: undefined }
      sync_job_metrics: { Args: { p_job_id?: string }; Returns: undefined }
      trigger_notification_cleanup: { Args: never; Returns: undefined }
      trigger_proactive_engagement_now: { Args: never; Returns: Json }
      trigger_trending_update: { Args: never; Returns: undefined }
      update_all_company_trending_scores: { Args: never; Returns: number }
      update_all_trending_scores: { Args: never; Returns: number }
      update_brand_assets: { Args: { p_assets: Json }; Returns: Json }
      update_company_trending_score: {
        Args: { company_id: string }
        Returns: undefined
      }
      update_competition_leaderboard: { Args: never; Returns: undefined }
      update_engagement_cron_interval: {
        Args: { _minutes: number }
        Returns: Json
      }
      update_job_trending_score: {
        Args: { job_id: string }
        Returns: undefined
      }
      update_leaderboard_entry:
        | {
            Args: { p_cycle_id: string; p_user_id: string }
            Returns: undefined
          }
        | { Args: { p_score: number; p_user_id: string }; Returns: undefined }
      update_organic_ranks: { Args: never; Returns: undefined }
      update_organic_scores_and_ranks: { Args: never; Returns: undefined }
      update_team_member_permissions:
        | {
            Args: { p_permissions: Json; p_target_user_id: string }
            Returns: undefined
          }
        | {
            Args: {
              p_ip_address?: string
              p_permissions: Json
              p_target_user_id: string
            }
            Returns: Json
          }
      update_trending_ranks: { Args: never; Returns: undefined }
      update_user_preferences: {
        Args: {
          p_category?: string
          p_job_type?: string
          p_location?: string
          p_salary_range?: string
          p_user_id: string
        }
        Returns: undefined
      }
      update_whatsapp_session: {
        Args: {
          p_interaction_type?: string
          p_phone: string
          p_user_id?: string
        }
        Returns: undefined
      }
      validate_referral_code: { Args: { p_code: string }; Returns: Json }
      verify_super_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role:
        | "owner"
        | "admin"
        | "moderator"
        | "support"
        | "finance_manager"
        | "content_manager"
        | "jobseeker"
        | "employer"
      referral_cycle_status: "active" | "completed" | "processing"
    }
    CompositeTypes: {
      dblink_pkey_results: {
        position: number | null
        colname: string | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "owner",
        "admin",
        "moderator",
        "support",
        "finance_manager",
        "content_manager",
        "jobseeker",
        "employer",
      ],
      referral_cycle_status: ["active", "completed", "processing"],
    },
  },
} as const
