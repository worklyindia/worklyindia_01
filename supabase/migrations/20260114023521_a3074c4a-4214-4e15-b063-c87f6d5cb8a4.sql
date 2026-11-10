-- Add AI Image Generation limit column to ai_chat_plans table
ALTER TABLE public.ai_chat_plans 
ADD COLUMN IF NOT EXISTS ai_image_generation_per_month INTEGER DEFAULT 5;

-- Update existing plans with default values based on plan type
UPDATE public.ai_chat_plans 
SET ai_image_generation_per_month = 
  CASE 
    WHEN price_inr = 0 THEN 5        -- Free plan: 5 images
    WHEN price_inr <= 199 THEN 20    -- Basic plan: 20 images
    ELSE 100                          -- Pro/Enterprise: 100 images
  END
WHERE ai_image_generation_per_month IS NULL OR ai_image_generation_per_month = 5;

-- Add comment for documentation
COMMENT ON COLUMN public.ai_chat_plans.ai_image_generation_per_month IS 'Monthly limit for AI image generation for job ads';