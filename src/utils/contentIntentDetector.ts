export type GenerationIntent = 'image' | 'file' | 'text';

// Only explicit, action-oriented multi-word phrases for image generation
const IMAGE_KEYWORDS = [
  'generate image', 'create image', 'make image', 'generate a image', 'generate an image',
  'image generate karo', 'photo generate karo',
  'create a logo', 'make a logo', 'design a logo',
  'create a banner', 'make a poster', 'create a poster',
  'image bana do', 'image bana de', 'photo bana do', 'photo bana de',
  'logo bana do', 'logo bana de', 'banner bana do', 'poster bana do',
  'tasveer bana do', 'chitra bana do', 'pic bana do',
];

// Only explicit, action-oriented document creation phrases
const FILE_KEYWORDS = [
  'resume bana do', 'resume bana de', 'cv bana do', 'cv bana de',
  'pdf bana do', 'pdf bana de', 'biodata bana do', 'bio data bana do',
  'resume create karo', 'resume generate karo',
  'create a resume', 'create a cv', 'create my resume', 'create my cv',
  'make me a resume', 'make me a cv', 'make my resume',
  'generate pdf', 'generate a pdf', 'generate resume', 'generate cv',
  'write my resume', 'write my cv',
];

export function detectGenerationIntent(message: string): GenerationIntent {
  const lower = message.toLowerCase().trim();

  // Require message to have at least 2 words to count as generation intent
  if (lower.split(/\s+/).length < 2) return 'text';

  // Flexible natural-language match (English / Hindi / Hinglish), e.g.
  // "image create facebook like go ki", "ek poster banao", "draw me a picture"
  const IMAGE_NOUN = /(image|images|photo|pic|picture|poster|banner|logo|thumbnail|wallpaper|art|drawing|illustration|tasveer|chitra|foto)/;
  const IMAGE_VERB = /(generate|create|make|design|draw|render|banao|bana|banade|bana do|banadu|nikal|chahiye|kar do|karo)/;
  if (IMAGE_NOUN.test(lower) && IMAGE_VERB.test(lower)) return 'image';

  for (const keyword of IMAGE_KEYWORDS) {
    if (lower.includes(keyword)) return 'image';
  }

  for (const keyword of FILE_KEYWORDS) {
    if (lower.includes(keyword)) return 'file';
  }

  return 'text';
}

export function getStatusText(intent: GenerationIntent): string {
  switch (intent) {
    case 'image': return 'creating image...';
    case 'file': return 'preparing file...';
    default: return 'typing...';
  }
}
