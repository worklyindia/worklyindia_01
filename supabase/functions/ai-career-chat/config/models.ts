// AI Models Configuration for Lovable AI Gateway
// Only models allowed by the gateway:
// openai/gpt-5-mini, openai/gpt-5, openai/gpt-5-nano, openai/gpt-5.2,
// google/gemini-2.5-pro, google/gemini-2.5-flash, google/gemini-2.5-flash-lite,
// google/gemini-2.5-flash-image, google/gemini-3-flash-preview, google/gemini-3-pro-*

export interface ModelConfig {
  name: string;
  provider: 'google' | 'openai' | 'anthropic';
  temperature?: number;
  maxTokens: number;
  useMaxCompletionTokens?: boolean; // For newer OpenAI models (gpt-5 family)
  costTier: 1 | 2 | 3 | 4 | 5;
  description: string;
}

export const AVAILABLE_MODELS: Record<string, ModelConfig> = {
  // TIER 1 - CHEAPEST
  'google/gemini-2.5-flash-lite': {
    name: 'google/gemini-2.5-flash-lite',
    provider: 'google',
    temperature: 0.5,
    maxTokens: 4000,
    costTier: 1,
    description: 'Cheapest! Perfect for greetings, confirmations, simple queries'
  },
  'openai/gpt-5-nano': {
    name: 'openai/gpt-5-nano',
    provider: 'openai',
    maxTokens: 16000,
    useMaxCompletionTokens: true,
    costTier: 1,
    description: 'Fast and efficient for simple tasks'
  },

  // TIER 2 - LOW COST
  'google/gemini-2.5-flash': {
    name: 'google/gemini-2.5-flash',
    provider: 'google',
    temperature: 0.7,
    maxTokens: 8000,
    costTier: 2,
    description: 'Good for job search and general queries'
  },
  'openai/gpt-5-mini': {
    name: 'openai/gpt-5-mini',
    provider: 'openai',
    maxTokens: 16000,
    useMaxCompletionTokens: true,
    costTier: 2,
    description: 'Fast OpenAI model for medium tasks'
  },

  // TIER 3 - MEDIUM
  'openai/gpt-5': {
    name: 'openai/gpt-5',
    provider: 'openai',
    maxTokens: 16000,
    useMaxCompletionTokens: true,
    costTier: 3,
    description: 'Powerful OpenAI model for complex tasks, code and vision'
  },
  'google/gemini-2.5-pro': {
    name: 'google/gemini-2.5-pro',
    provider: 'google',
    temperature: 0.7,
    maxTokens: 8000,
    costTier: 4,
    description: 'Advanced reasoning Gemini model'
  },

  // IMAGE GENERATION MODELS
  'google/gemini-2.5-flash-image': {
    name: 'google/gemini-2.5-flash-image',
    provider: 'google',
    temperature: 0.7,
    maxTokens: 4000,
    costTier: 3,
    description: 'Image generation from text prompts'
  },
  'google/gemini-3-pro-image-preview': {
    name: 'google/gemini-3-pro-image-preview',
    provider: 'google',
    temperature: 0.7,
    maxTokens: 4000,
    costTier: 4,
    description: 'Next-gen image generation (preview)'
  }
};

// Fallback chain for reliability (cheapest first → premium last)
// NOTE: gemini-2.5-flash-lite is REMOVED from the fallback chain because it
// hallucinates tool/function calls (claims "email sent" without invoking the tool).
// It is still used directly by selectBestModel() for greetings/short messages
// where no tools are needed.
export const FALLBACK_CHAIN = [
  'google/gemini-2.5-flash',       // Primary - reliable tool calling, low cost
  'openai/gpt-5-mini',             // Secondary - reliable tool calling
  'openai/gpt-5-nano',             // Tertiary - fast fallback
  'openai/gpt-5'                   // Last resort - vision capable
];

// ACTION fallback chain: used for email/file/image/send requests where reliable
// structured tool_calls are CRITICAL. OpenAI models go first because Gemini has
// been observed hallucinating "tool_code print(send_email_to_user(...))" as text
// instead of emitting a real tool_calls object.
export const ACTION_FALLBACK_CHAIN = [
  'openai/gpt-5-mini',             // Primary - most reliable structured tool calling
  'openai/gpt-5-nano',             // Secondary - fast OpenAI fallback
  'google/gemini-2.5-flash',       // Tertiary - usually works, occasionally hallucinates
  'openai/gpt-5'                   // Last resort - heavyweight
];

// Get model parameters for API call
export function getModelParams(modelName: string) {
  const config = AVAILABLE_MODELS[modelName];
  if (!config) {
    throw new Error(`Unknown model: ${modelName}`);
  }

  const params: any = {
    model: modelName,
  };

  if (config.temperature !== undefined) {
    params.temperature = config.temperature;
  }

  if (config.useMaxCompletionTokens) {
    params.max_completion_tokens = config.maxTokens;
  } else {
    params.max_tokens = config.maxTokens;
  }

  return params;
}
