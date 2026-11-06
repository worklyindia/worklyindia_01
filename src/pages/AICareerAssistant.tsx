import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import AISupportProfile from '@/components/AISupportProfile';
import AIChatLanding from './AIChatLanding';
import { ArrowLeft, ArrowUp, Send, Paperclip, X, Check, Trash2, Smile, Camera, Phone, Copy, Star, Mic, Volume2, Loader2, FileText, File, Youtube, Plus, Image as ImageIcon, AudioLines, Brain, ChevronDown, Sparkles, Zap, MoreVertical, Link2, Crown } from 'lucide-react';
import { ChatFilePreview } from '@/components/ai-chat/ChatFilePreview';
import { forceDownloadFile } from '@/utils/forceDownload';

import { AssistantMessageActions } from '@/components/ai-chat/AssistantMessageActions';
import { MessageStatusIcon } from '@/components/whatsapp/MessageStatusIcon';
import TranslateIcon from '@/components/icons/TranslateIcon';
import { useLocation, useNavigate, useSearchParams, Link, Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { autoCollectDeviceInfo } from '@/utils/autoDeviceInfoCollector';
import { cleanupAiChatTempFiles } from '@/utils/storageCleanup';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';
import { chatStorage } from '@/lib/chatStorage';
import { aiResponseCache } from '@/lib/aiResponseCache';
import { wallpaperStorage } from '@/lib/wallpaperStorage';
import MessageContextMenu from '@/components/MessageContextMenu';
import { useAnimatedPlaceholder } from '@/hooks/useAnimatedPlaceholder';
import { renderTextWithLinks } from '@/utils/linkUtils';
import { ChatOptionChips, extractOptions, stripOptionsFromContent } from '@/components/ai-chat/ChatOptionChips';
import { RevealText } from '@/components/ai-chat/RevealText';
import { extractYtUpdate, extractYtUpdateLoose, stripYtUpdateBlock, findVideoId, type YtSeoUpdatePayload } from '@/components/ai-chat/YouTubeSeoUpdateCard';
import { applyYtSeoUpdate, isYtUpdateApproval } from '@/utils/applyYtSeoUpdate';

import ChatActionButtons, { extractChatButtons, stripChatButtonsBlock } from '@/components/ai-chat/ChatActionButtons';
import VerificationBadge from '@/components/VerificationBadge';
import { useAIChatSettings } from '@/hooks/useAIChatSettings';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import TranslateDialog from '@/components/chat/TranslateDialog';
import { ComposerWaveform } from "@/components/ai-chat/ComposerWaveform";
import { LoginRequiredSheet } from "@/components/ai-chat/LoginRequiredSheet";
import { useNativeHaptics } from '@/hooks/useNativeHaptics';
import { useNativeFeel } from '@/hooks/useNativeFeel';
import { getCachedAudio, setCachedAudio, clearExpiredCache } from '@/lib/ttsVoiceCache';
import { useAIChatSubscription } from '@/hooks/useAIChatSubscription';
import { Badge } from '@/components/ui/badge';
import { UsageAlertBanner } from '@/components/ai-chat/UsageAlertBanner';
import type { AITaskPhase } from '@/components/ai-chat/AIGenerationIndicator';
import { AIGenerationIndicator } from '@/components/ai-chat/AIGenerationIndicator';
import { SafeImg } from '@/components/ui/safe-image';
import { detectGenerationIntent, type GenerationIntent } from '@/utils/contentIntentDetector';
import { getPhaseStatus, getElapsedStatus, getElapsedPhase, getWritingStatus, type StatusPhase, type StatusLang as StatusPhaseLang } from '@/lib/instantStatus';
import {
  buildRequestStatus,
  localizeStatusText,
  classifyIntent,
  detectRequestLang,
  generateStatus,
  getFollowUpStatuses,
  getWorkingStatus,
  stripStatusEmojis,
  type StatusLangCode,
} from '@/lib/requestStatus';
import { callAICareerChat } from '@/lib/aiChatTransport';
import { SubscriptionExpiryBanner } from '@/components/ai-chat/SubscriptionExpiryBanner';
import YouTubeOAuthBridge from '@/components/youtube/YouTubeOAuthBridge';

import supportAvatar from '@/assets/support-avatar.webp';
import aiChatWallpaper from '@/assets/ai-chat-wallpaper.webp';
import whatsappDoodle from '@/assets/wallpapers/whatsapp-doodle.webp';
import abstractPurpleBlue from '@/assets/wallpapers/abstract-purple-blue.webp';
import pastelDreams from '@/assets/wallpapers/pastel-dreams.webp';
import darkLuxury from '@/assets/wallpapers/dark-luxury.webp';
import tropicalSunset from '@/assets/wallpapers/tropical-sunset.webp';
import mintFresh from '@/assets/wallpapers/mint-fresh.webp';
import cosmicNebula from '@/assets/wallpapers/cosmic-nebula.webp';
import autumnWarmth from '@/assets/wallpapers/autumn-warmth.webp';
import neonVibes from '@/assets/wallpapers/neon-vibes.webp';
import cherryBlossom from '@/assets/wallpapers/cherry-blossom.webp';
import mountainMajesty from '@/assets/wallpapers/mountain-majesty.webp';
import oceanWaves from '@/assets/wallpapers/ocean-waves.webp';
import desertDunes from '@/assets/wallpapers/desert-dunes.webp';
import northernLights from '@/assets/wallpapers/northern-lights.webp';
import liquidGold from '@/assets/wallpapers/liquid-gold.webp';
import geometricDreams from '@/assets/wallpapers/geometric-dreams.webp';
import marbleElegance from '@/assets/wallpapers/marble-elegance.webp';
import watercolorSplash from '@/assets/wallpapers/watercolor-splash.webp';
import smokeArt from '@/assets/wallpapers/smoke-art.webp';
import galaxySpiral from '@/assets/wallpapers/galaxy-spiral.webp';
import planetRise from '@/assets/wallpapers/planet-rise.webp';
import starryNight from '@/assets/wallpapers/starry-night.webp';
import nebulaCloud from '@/assets/wallpapers/nebula-cloud.webp';
import cityLights from '@/assets/wallpapers/city-lights.webp';
import neonStreets from '@/assets/wallpapers/neon-streets.webp';
import glassReflection from '@/assets/wallpapers/glass-reflection.webp';
import skylineSunset from '@/assets/wallpapers/skyline-sunset.webp';
import roseGoldTexture from '@/assets/wallpapers/rose-gold-texture.webp';
import woodGrain from '@/assets/wallpapers/wood-grain.webp';
import fabricTexture from '@/assets/wallpapers/fabric-texture.webp';
import paperWaves from '@/assets/wallpapers/paper-waves.webp';
import lavenderField from '@/assets/wallpapers/lavender-field.webp';
import tropicalBeach from '@/assets/wallpapers/tropical-beach.webp';
import enchantedForest from '@/assets/wallpapers/enchanted-forest.webp';
import autumnLeaves from '@/assets/wallpapers/autumn-leaves.webp';
import waterfall from '@/assets/wallpapers/waterfall.webp';
import paintSplash from '@/assets/wallpapers/paint-splash.webp';
import holographic from '@/assets/wallpapers/holographic.webp';
import crystalGeode from '@/assets/wallpapers/crystal-geode.webp';
import zenGarden from '@/assets/wallpapers/zen-garden.webp';
import comet from '@/assets/wallpapers/comet.webp';
import astronautSpace from '@/assets/wallpapers/astronaut-space.webp';
import futureCity from '@/assets/wallpapers/future-city.webp';
import hotAirBalloons from '@/assets/wallpapers/hot-air-balloons.webp';
import japaneseTemple from '@/assets/wallpapers/japanese-temple.webp';
import bioluminescentWaves from '@/assets/wallpapers/bioluminescent-waves.webp';
import vipTealLuxury from '@/assets/wallpapers/vip-teal-luxury.webp';
import { cn } from "@/lib/utils";
import { formatChatStamp } from "@/utils/chatTimestamp";
import LottieProfileIcon from "@/components/LottieProfileIcon";
import LottieCameraIcon from "@/components/LottieCameraIcon";
import LottieIcon from "@/components/LottieIcon";
import callAnimation from "@/assets/lottie/call.json";
import defaultSeekerAvatar from "@/assets/default-job-seeker-avatar.png.asset.json";
import defaultCompanyLogo from "@/assets/default-company-logo.jpeg.asset.json";

interface AttachedFile {
  name: string;
  type: string;
  size: number;
  textContent?: string; // Extracted text from PDF/DOC/TXT
  dataUrl?: string; // For preview
}

const CHAT_HEADER_GREEN = '#075E54';
// ChatGPT-style surface colors
const CHAT_SURFACE = '#FFFFFF';
const CHAT_USER_BUBBLE = '#F0F0F0';

const cleanAvatarUrl = (url?: string | null) => {
  const trimmed = url?.trim();
  if (!trimmed || ['null', 'undefined', 'none'].includes(trimmed.toLowerCase())) return null;
  return trimmed;
};

const getAuthAvatarUrl = (user?: User | null) => {
  const meta = (user?.user_metadata || {}) as Record<string, any>;
  const directAvatar = cleanAvatarUrl(
    meta.avatar_url ||
    meta.picture ||
    meta.picture_url ||
    meta.avatar ||
    meta.profile_picture ||
    meta.profile_image_url
  );
  if (directAvatar) return directAvatar;

  const identities = ((user as any)?.identities || []) as Array<{ identity_data?: Record<string, any> }>;
  for (const identity of identities) {
    const data = identity.identity_data || {};
    const identityAvatar = cleanAvatarUrl(data.avatar_url || data.picture || data.picture_url || data.avatar);
    if (identityAvatar) return identityAvatar;
  }

  return null;
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  imageUrls?: string[];
  attachedFiles?: AttachedFile[];
  voiceUrl?: string;
  voiceDuration?: number;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  starred?: boolean;
  feedback?: 'like' | 'dislike';
  /** True for transient "thinking out loud" progress bubbles emitted mid-turn */
  isProgress?: boolean;
  /** True for error bubbles shown inline in the chat (red styling, not saved to AI history) */
  isError?: boolean;
  /** True for messages sent to the AI but NOT rendered in the chat (e.g. option-chip answers) */
  hidden?: boolean;
}

export default function AICareerAssistant() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedAudience = searchParams.get('audience');
  const explicitAudience = requestedAudience === 'employer' || requestedAudience === 'job_seeker' || requestedAudience === 'developer'
    ? requestedAudience
    : null;
  const isDeveloper = explicitAudience === 'developer';
  const { data: chatSettings, isLoading: settingsLoading } = useAIChatSettings();
  const { lightImpact, successHaptic } = useNativeHaptics();
  const { messageSentFeedback, messageReceivedFeedback } = useNativeFeel();
  const { status: subscriptionStatus, getRemainingUsage, getUsagePercentage } = useAIChatSubscription();

  // Header usage pill: show "Usage" normally, "Upgrade Plan" once any limit is exhausted
  const usageHeader = useMemo(() => {
    if (!subscriptionStatus) return null;
    const { plan, usage } = subscriptionStatus;
    const pairs: Array<[number, number]> = [
      [usage.messages_count, plan.messages_per_month],
      [usage.voice_playback_count, plan.voice_playback_per_month],
      [usage.voice_input_count, plan.voice_input_per_month],
      [usage.image_analysis_count, plan.image_analysis_per_month],
    ];
    const limitReached = pairs.some(([used, total]) => total < 999999 && used >= total);
    const msgUnlimited = plan.messages_per_month >= 999999;
    const msgLeft = Math.max(0, plan.messages_per_month - usage.messages_count);
    return { limitReached, label: msgUnlimited ? 'Usage' : `${msgLeft} left` };
  }, [subscriptionStatus]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generationIntent, setGenerationIntent] = useState<GenerationIntent>('text');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [streamingStatus, setStreamingStatus] = useState<string>('');
  // True while the backend is actually creating an image — drives the live
  // ChatGPT-style "Creating image" card.
  const [imageGenerating, setImageGenerating] = useState(false);
  // Public URLs of images generated during the current run. They are appended
  // to the reply so the picture always renders, even if the model forgets to
  // embed the markdown link.
  const generatedImagesRef = useRef<string[]>([]);
  const appendGeneratedImages = useCallback((text: string) => {
    const urls = generatedImagesRef.current;
    if (!urls.length) return text;
    // Strip the model's broken placeholders ("Image link: ``", empty code
    // blocks / empty markdown links) before appending the real image.
    let out = (text || '')
      .replace(/^\s*(image link|image url)\s*:?\s*`{0,3}\s*`{0,3}\s*$/gim, '')
      .replace(/!?\[[^\]]*\]\(\s*\)/g, '')
      .trim();
    for (const url of urls) {
      if (!out.includes(url)) out += `\n\n![Generated Image](${url})`;
    }
    return out.trim();
  }, []);
  // The live status is set ONCE per run and then stays exactly as it is.
  // Passing '' clears it and unlocks it for the next run.
  const statusLockedRef = useRef(false);
  const setStatusOnce = useCallback((text: string) => {
    const next = (text || '').trim();
    if (!next) {
      statusLockedRef.current = false;
      setStreamingStatus('');
      return;
    }
    if (statusLockedRef.current) return;
    statusLockedRef.current = true;
    setStreamingStatus(next);
  }, []);
  // Kept only for debug payloads — no longer rendered in the chat.
  const [statusSteps, setStatusSteps] = useState<string[]>([]);

  // Live task status metadata (real work phase + progress + run id).
  const [taskStatus, setTaskStatus] = useState<{
    runId?: string;
    phase?: AITaskPhase;
    progress?: number;
  }>({});
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  // True as soon as the AI's real reply text starts arriving — used to hide the
  // status/typing indicator so the header status never sits next to the answer.
  const [replyStarted, setReplyStarted] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<AttachedFile[]>([]);

  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showProfile, setShowProfile] = useState(false);
  const [wallpaper, setWallpaper] = useState(() => {
    const saved = wallpaperStorage.loadWallpaper();
    return saved?.type === 'predefined' ? saved.value : (saved?.type === 'custom' ? 'custom' : 'default');
  });
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string | null>(() => {
    const saved = wallpaperStorage.loadWallpaper();
    return saved?.type === 'custom' ? saved.value : null;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const clickTimer = useRef<NodeJS.Timeout | null>(null);
  const clickCount = useRef(0);
  const wasTouchMoved = useRef(false);
  const touchStartPos = useRef<{x: number, y: number} | null>(null);
  const longPressTriggered = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceCancelledRef = useRef(false);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [showTranslateDialog, setShowTranslateDialog] = useState(false);
  const [showLoginSheet, setShowLoginSheet] = useState(false);
  const [loginSheetFeature, setLoginSheetFeature] = useState<string>('');
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  // True once the initial session check finishes — prevents flashing the chat
  // page (or the login redirect) before we know whether the user is signed in.
  const [authChecked, setAuthChecked] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [userAvatarUrl, setUserAvatarUrl] = useState<string | null>(null);
  const [isEmployer, setIsEmployer] = useState<boolean>(explicitAudience === 'employer');
  const chatAudience = isDeveloper ? 'developer' : isEmployer ? 'employer' : 'job_seeker';
  const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'listening' | 'processing' | 'complete'>('listening');
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [voiceStream, setVoiceStream] = useState<MediaStream | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  // ChatGPT-style composer: "+" options menu and "Think harder" mode
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [thinkHarder, setThinkHarder] = useState(false);
  // Composer switches from a single row to a stacked layout once text wraps
  const [composerExpanded, setComposerExpanded] = useState(false);
  const mirrorRef = useRef<HTMLTextAreaElement>(null);
  // Keep the composer pinned above the on-screen keyboard (visual viewport aware)
  const [viewport, setViewport] = useState<{
    height: number;
    offsetTop: number;
  }>(() => {
    if (typeof window === 'undefined') return { height: 0, offsetTop: 0 };
    const vv = window.visualViewport;
    return {
      height: vv ? vv.height : window.innerHeight,
      offsetTop: vv ? vv.offsetTop : 0,
    };
  });
  // Housekeeping: anything this chat stored more than 24 hours ago is removed,
  // so yesterday's files never linger in storage.
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem('ai-chat-storage-sweep') === today) return;
    localStorage.setItem('ai-chat-storage-sweep', today);
    void cleanupAiChatTempFiles(24);
  }, []);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!vv) return;
    const update = () =>
      setViewport({ height: vv.height, offsetTop: vv.offsetTop });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);


  const stripMetaStatusLeak = (text: string) => {
    let cleaned = text
      // Internal mailbox/tool routing codes are never user-facing. Keep this
      // client-side guard as well as the Edge Function sanitizer so cached or
      // previously saved replies cannot show them after an app update.
      .replace(/(?:^|\n)\s*(?:❌\s*)?(?:wrong_tool_use[a-z_]*|invalid_tool_use[a-z_]*|retry_now|suggested_tool|suggested_args|tool_error)\b[^\n]*(?=\n|$)/gi, '')
      // Legacy/raw mailbox argument validation from older saved replies.
      .replace(/(?:^|\n)\s*(?:❌\s*)?message_id\s*(?=\n|$)/gi, '')
      .replace(/(?:^|\n)\s*(?:message_id\s*,?\s*)?(?:list_index|subject_hint\/from_hint)[^\n]*chahiye[^\n]*(?=\n|$)/gi, '')
      // Raw SSE / tool JSON that sometimes leaks into the reply text, e.g.
      // {"type":"status","text":"👀 Profile check kar rahi hoon..."}
      .replace(/\{\s*"type"\s*:\s*"(?:status|progress_message)"[\s\S]*?\}/gi, '')
      .replace(/\{\s*"status(?:_text)?"\s*:\s*"[^"]*"\s*\}/gi, '')
      .replace(/(?:^|\n)\s*(?:send_progress_message|set_status)\s*:\s*.*(?=\n|$)/gi, '')

      // Provider narration variants such as:
      // get_youtube_trending called\nwith kind="video", language="hi"
      .replace(/(?:^|\n)\s*[`*_]*[a-z_][a-z0-9_]*[`*_]*\s+(?:called|call|invoked|invoking|executed|running)(?:\s+with)?[^\n]*(?:\n\s*[`*_]*with[`*_]*\s+[^\n]*)?/gi, '')
      .replace(/(?:^|\n)\s*with\s+[a-z_][a-z0-9_]*\s*=\s*[^\n]*(?=\n|$)/gi, '')
      .replace(/(?:^|\n)\s*(?:parameters|params|arguments|args)\s*:\s*[^\n]*(?=\n|$)/gi, '');

    // 🚨 Strip hallucinated tool-call code blocks the model sometimes leaks as plain text.
    // Examples seen in production:
    //   chaarana_tool_code
    //   print(default_api.get_user_management_data(user_id=access_token_user_id))
    //   ```tool_code\nprint(...)\n```
    //   default_api.search_jobs({...})
    //   tools.get_wallet_balance(...)
    //   <function_call>...</function_call>
    cleaned = cleaned
      // Fenced ```tool_code / ```chaarana_tool_code / ```python blocks
      .replace(/```\s*[a-z_]*tool_code[\s\S]*?```/gi, '')
      .replace(/```\s*python\s*\n?[\s\S]*?print\s*\([\s\S]*?\)[\s\S]*?```/gi, '')
      // Bare "tool_code" / "chaarana_tool_code" header line + following print(...) call
      .replace(/(?:^|\n)[ \t]*[a-z_]*tool_code[ \t]*\n+[ \t]*print\s*\([\s\S]*?\)[ \t]*(?=\n|$)/gi, '')
      .replace(/(?:^|\n)[ \t]*[a-z_]*tool_code[ \t]*(?=\n|$)/gi, '')
      // print(default_api.xxx(...)) / default_api.xxx(...)
      .replace(/(?:^|\n)[ \t]*(?:print\s*\(\s*)?default_api\.[a-z_]+\s*\([\s\S]*?\)\s*\)?[ \t]*(?=\n|$)/gi, '')
      // tools.xxx(...) / print(tools.xxx(...))
      .replace(/(?:^|\n)[ \t]*(?:print\s*\(\s*)?tools?\.[a-z_]+\s*\([\s\S]*?\)\s*\)?[ \t]*(?=\n|$)/gi, '')
      // <function_call> / <tool_call> XML hallucinations
      .replace(/<function_call>[\s\S]*?<\/function_call>/gi, '')
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
      // ── Mid-line leaks with no newline anchor, e.g.
      //   ')tool_code_1 = search_youtube(query='...', order='date')print(tool_code_1)
      .replace(/['"`)\]]*\s*\b[a-z_]*tool_code[a-z0-9_]*\b\s*=\s*[a-z_][a-z0-9_.]*\s*\([\s\S]*?\)\s*(?:print\s*\(\s*[a-z_][a-z0-9_]*\s*\))?/gi, '')
      .replace(/['"`)\]]*\s*[a-z_][a-z0-9_]*\s*=\s*(?:search_youtube|get_youtube_[a-z_]+|search_jobs|search_companies|web_search|smart_job_match|get_market_insights)\s*\([\s\S]*?\)/gi, '')
      .replace(/(?:search_youtube|get_youtube_video_details|get_youtube_channel_videos|get_youtube_trending|web_search|search_jobs|search_companies)\s*\([\s\S]*?\)/gi, '')
      .replace(/print\s*\(\s*[a-z_][a-z0-9_]*\s*\)/gi, '')
      .replace(/\b[a-z_]*tool_code[a-z0-9_]*\b/gi, '')
      // Empty / "undefined" code fences
      .replace(/```[a-z_]*\s*\n?\s*(?:undefined|null)?\s*\n?```/gi, '')
      .replace(/(?:^|\n)[ \t]*undefined[ \t]*(?=\n|$)/g, '')
      // ── Fake "searching / wait karo" claims anywhere in the reply
      .replace(/[^.!?\n]*\b(?:dhundh|dhoondh|dhund|search\s+kar|khoj|ढूंढ|ढूँढ|खोज)[^.!?\n]*?\b(?:rahi\s*hoon|rahi\s*hu|raha\s*hoon|raha\s*hu|रही\s*हूँ|रही\s*हूं|रहा\s*हूँ|रहा\s*हूं)[^.!?\n]*[.!?]*/gi, '')
      .replace(/[^.!?\n]*\b(?:thoda\s*sa?\s*wait|thodi\s*der\s*wait|wait\s*karo|wait\s*kijiye|ek\s*minute\s*ruko|zara\s*ruko|थोड़ा\s*रुक|इंतज़ार\s*कर)[^.!?\n]*[.!?]*/gi, '');

    // Strip leading "thinking out loud" progress sentences the model wrote
    // as plain text instead of using the set_status / send_progress_message tools.
    // These belong in the typing indicator, never in the final reply bubble.
    const LEADING_PROGRESS = /^\s*(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}\u2600-\u27BF]\s*)?[^\n.!?]*?(?:rahi hoon|rahi hu|raha hoon|raha hu|kar rahi|kar raha|dhundh|soch rahi|soch raha|likh rahi|likh raha|bhej rahi|bhej raha|bana rahi|bana raha|taiyaar kar|tayar kar|check kar rahi|check kar raha|confirm kar rahi|confirm kar raha|रही हूँ|रहा हूँ|रही हूं|रहा हूं|कर रही|कर रहा|ढूंढ रही|ढूंढ रहा|सोच रही|सोच रहा|लिख रही|लिख रहा|भेज रही|भेज रहा|बना रही|बना रहा|thinking|searching|generating|creating|drafting|checking|sending|preparing|looking up|fetching|analyzing|analysing|loading|processing|working on|hold on|one sec|one second|hang on|just a moment|moment please|let me)[^\n.!?]*?\.{2,}\s*(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}\u2600-\u27BF]\s*)?(?:\n|(?=\S))/iu;
    for (let i = 0; i < 5; i++) {
      const next = cleaned.replace(LEADING_PROGRESS, '');
      if (next === cleaned) break;
      cleaned = next;
    }
    return cleaned
      .replace(/^[\s'"`)\];,]+(?=[\p{L}\p{N}])/u, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\s+/, '')
      .trim();

  };

  const chatPlaceholders = [
    "Ask about remote jobs...",
    "Need career advice?",
    "Search for companies...",
    "Ask about Workly India...",
    "Type your question..."
  ];
  const animatedPlaceholder = useAnimatedPlaceholder(chatPlaceholders, 80);

  // Check feature locks based on subscription limits
  const remaining = getRemainingUsage();
  const isMessagesLocked = remaining ? remaining.messages <= 0 : false;
  const isVoiceInputLocked = remaining ? remaining.voiceInput <= 0 : false;
  const isImageLocked = remaining ? remaining.imageAnalysis <= 0 : false;
  const isVoicePlaybackLocked = remaining ? remaining.voicePlayback <= 0 : false;

  // Handle locked feature clicks
  const handleMessagesLocked = () => {
    toast.error("💬 Message Limit Reached", {
      description: "Your message limit is exhausted. Upgrade your plan for more messages.",
      action: {
        label: "🚀 Upgrade Plan",
        onClick: () => navigate('/ai-assistant/subscription')
      },
      duration: 5000
    });
  };

  const handleVoiceLocked = () => {
    toast.error("🎤 Voice Input Limit Reached", {
      description: "Your voice input limit is exhausted. Upgrade your plan for more.",
      action: {
        label: "🚀 Upgrade Plan",
        onClick: () => navigate('/ai-assistant/subscription')
      },
      duration: 5000
    });
  };

  const handleImageLocked = () => {
    toast.error("📷 Image Analysis Limit Reached", {
      description: "Your image analysis limit is exhausted. Upgrade your plan for more.",
      action: {
        label: "🚀 Upgrade Plan",
        onClick: () => navigate('/ai-assistant/subscription')
      },
      duration: 5000
    });
  };

  const handleVoicePlaybackLocked = () => {
    toast.error("🔊 Voice Playback Limit Reached", {
      description: "Your voice playback limit is exhausted. Upgrade your plan for more.",
      action: {
        label: "🚀 Upgrade Plan",
        onClick: () => navigate('/ai-assistant/subscription')
      },
      duration: 5000
    });
  };

  // Handle login required — opens a bottom sheet with login/signup options
  const handleLoginRequired = (feature: string) => {
    setLoginSheetFeature(feature);
    setShowLoginSheet(true);
  };


  // Check authentication status & set per-user storage
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      chatStorage.setCurrentUserId(user?.id ?? null);
      chatStorage.setAudience(isDeveloper ? 'developer' : 'default');
      aiResponseCache.setCurrentUserId(user?.id ?? null);
      // Load messages for this user
      setMessages(chatStorage.loadMessages());
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      setCurrentUser(user);
      chatStorage.setCurrentUserId(user?.id ?? null);
      chatStorage.setAudience(isDeveloper ? 'developer' : 'default');
      aiResponseCache.setCurrentUserId(user?.id ?? null);
      // Reload messages for the new user (or clear if logged out)
      setMessages(user ? chatStorage.loadMessages() : []);
    });

    return () => subscription.unsubscribe();
  }, [isDeveloper]);

  // Check if the logged-in user has the owner role (admin_users.role = 'owner')
  useEffect(() => {
    let cancelled = false;
    if (!currentUser?.id) { setIsOwner(false); return; }
    supabase
      .from('admin_users')
      .select('role')
      .eq('user_id', currentUser.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsOwner(data?.role === 'owner');
      });
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // Collect device information every time the AI chat page is opened
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session?.access_token) return;
      autoCollectDeviceInfo(session.access_token, 'job_seeker').catch(console.error);
    })();
    return () => { cancelled = true; };
  }, []);


  // Fetch user's avatar (job seeker profile picture or employer company logo).
  // Detect employer by checking if a `companies` row exists for this user_id —
  // more reliable than `user_metadata.user_type`, which is often missing.
  useEffect(() => {
    if (!currentUser?.id) {
      setUserAvatarUrl(null);
      setIsEmployer(explicitAudience === 'employer');
      return;
    }

    (async () => {
      try {
        if (isDeveloper) {
          const { data: developerProfile } = await (supabase as any).from('developer_profiles').select('avatar_url').eq('user_id', currentUser.id).maybeSingle();
          setIsEmployer(false);
          setUserAvatarUrl(cleanAvatarUrl(developerProfile?.avatar_url) || getAuthAvatarUrl(currentUser) || defaultSeekerAvatar.url);
          return;
        }
        // An explicit entry-point audience wins for dual-profile users. Direct
        // links retain the existing company-row fallback detection.
        if (explicitAudience !== 'job_seeker') {
          const { data: companyRows } = await supabase
            .from('companies')
            .select('logo_url')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })
            .order('updated_at', { ascending: false })
            .limit(1);

          const companyRow = companyRows?.[0];
          if (companyRow) {
            setIsEmployer(true);
            const fallback = getAuthAvatarUrl(currentUser) || defaultCompanyLogo.url;
            setUserAvatarUrl(cleanAvatarUrl(companyRow.logo_url) || fallback);
            return;
          }
        }

        // Otherwise use job-seeker mode. An employer entry link remains in
        // employer mode even while company details are still being completed.
        setIsEmployer(explicitAudience === 'employer');
        const { data: profile } = await supabase
          .from('profiles')
          .select('profile_image_url')
          .eq('user_id', currentUser.id)
          .maybeSingle();
        const fallback = getAuthAvatarUrl(currentUser) || (explicitAudience === 'employer' ? defaultCompanyLogo.url : defaultSeekerAvatar.url);
        setUserAvatarUrl(cleanAvatarUrl(profile?.profile_image_url) || fallback);
      } catch {
        const employerMode = explicitAudience === 'employer';
        setIsEmployer(employerMode);
        setUserAvatarUrl(getAuthAvatarUrl(currentUser) || (employerMode ? defaultCompanyLogo.url : defaultSeekerAvatar.url));
      }
    })();
  }, [currentUser?.id, explicitAudience, isDeveloper]);

  // Clear expired TTS cache on mount
  useEffect(() => {
    clearExpiredCache();
  }, []);

  // Re-send unanswered user message on page reload/reopen
  // IMPORTANT: only run ONCE on initial mount against the stored history.
  // Without this guard, sending a new message (which appends a 'user' msg with
  // status 'pending') re-triggers this effect and fires a SECOND parallel
  // AI call, causing duplicate assistant replies in the chat.
  const pendingRetryDone = useRef(false);
  useEffect(() => {
    if (pendingRetryDone.current || !currentUser) return;
    // Mark as done immediately so any subsequent message changes don't re-trigger
    pendingRetryDone.current = true;

    if (messages.length === 0) return;

    const lastMsg = messages[messages.length - 1];
    // Only retry messages loaded from storage (status 'sent'/'delivered'/undefined),
    // never a freshly created 'pending' message from the active send flow.
    if (
      lastMsg.role === 'user' &&
      lastMsg.status !== 'failed' &&
      lastMsg.status !== 'pending'
    ) {
      console.log('🔄 Found unanswered user message on reload, re-sending to AI...');
      
      const retryAICall = async () => {
        setIsLoading(true);
        const abortController = new AbortController();
        // No timeout — the AI gets unlimited time to finish this retry.
        try {
          const userMessage = lastMsg.content || '';
          const imageUrls = lastMsg.imageUrls || [];
          
          let aiContent: any;
          if (imageUrls.length > 0) {
            aiContent = [
              { type: 'text', text: userMessage || 'Please analyze these images' },
              ...imageUrls.map(url => ({ type: 'image_url', image_url: { url } }))
            ];
          } else {
            aiContent = userMessage;
          }

          // Build messages array from stored history
          const aiMessages = messages
            .filter(m => !m.isProgress && !m.isError)
            .map(m => ({
              role: m.role,
              content: m.content,
            }));

          let assistantMessage = '';
          let firstChunk = true;
          let cachedHandled = false;

          await callAICareerChat(
            {
              messages: aiMessages,
              user_id: currentUser.id,
              hasImages: imageUrls.length > 0,
              currentPage: window.location.pathname,
               audience: chatAudience,
               pageContext: { path: window.location.pathname, page: 'AI Chat', audience: chatAudience }
            },
            {
              onCached: (text) => {
                cachedHandled = true;
                const cleanedText = stripMetaStatusLeak(text);
                const assistantMsg: Message = {
                  id: Date.now().toString(),
                  role: 'assistant',
                  content: cleanedText,
                  timestamp: formatChatStamp()
                };
                setMessages(prev => {
                  const updated = prev.map(m => m.id === lastMsg.id ? { ...m, status: 'read' as const } : m);
                  const withReply = [...updated, assistantMsg];
                  chatStorage.saveMessages(withReply);
                  return withReply;
                });
                messageReceivedFeedback();
              },
              onDelta: (_delta, full) => {
                assistantMessage = stripMetaStatusLeak(full);
                setMessages(prev => {
                  const newMsgs = [...prev];
                  if (newMsgs[newMsgs.length - 1]?.role === 'assistant') {
                    newMsgs[newMsgs.length - 1].content = assistantMessage;
                  } else {
                    newMsgs.push({
                      id: Date.now().toString(),
                      role: 'assistant',
                      content: assistantMessage,
                      timestamp: formatChatStamp()
                    });
                    if (firstChunk) {
                      firstChunk = false;
                      messageReceivedFeedback();
                    }
                  }
                  chatStorage.saveMessages(newMsgs);
                  return newMsgs;
                });
              },
              onDone: () => {
                if (cachedHandled) return;
                setMessages(prev => {
                  const updated = prev.map(m => m.id === lastMsg.id ? { ...m, status: 'read' as const } : m);
                  chatStorage.saveMessages(updated);
                  return updated;
                });
              }
            },
            abortController.signal
          );
        } catch (err) {
          console.error('Retry AI call failed:', err);
          const friendly = describeChatError(err, (lastMsg.imageUrls || []).length > 0);
          setMessages(prev => {
            const updated = prev.map(m => m.id === lastMsg.id ? { ...m, status: 'failed' as const } : m);
            updated.push({
              id: `error-${lastMsg.id}-${Date.now()}`,
              role: 'assistant',
              content: `⚠️ **${friendly}**\n\nApna message tap karke retry karein.`,
              timestamp: formatChatStamp(),
              isError: true,
            });
            chatStorage.saveMessages(updated);
            return updated;
          });
        } finally {
          setStatusOnce('');
          setIsLoading(false);
        }
      };
      
      // Small delay to let UI render first
      setTimeout(retryAICall, 500);
    }
  }, [currentUser, chatAudience]);

  // Wallpaper is fixed — no dynamic loading.


  // Handle scroll to message from search/starred pages
  useEffect(() => {
    const scrollTo = searchParams.get('scrollTo');
    if (scrollTo) {
      setTimeout(() => scrollToMessage(scrollTo), 300);
    }
  }, [searchParams]);

  // Prompt forwarded from the YouTube Studio page
  const routerLocation = useLocation();
  const prefillHandled = useRef(false);
  useEffect(() => {
    const prompt = (routerLocation.state as { prefillPrompt?: string } | null)?.prefillPrompt;
    if (prompt && !prefillHandled.current) {
      prefillHandled.current = true;
      setInput(prompt);
      window.history.replaceState({}, '', routerLocation.pathname + routerLocation.search);
    }
  }, [routerLocation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Compress image before sending to AI
  const compressImage = async (dataUrl: string, maxWidth = 800, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        
        // Calculate new dimensions maintaining aspect ratio
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress to JPEG with quality setting
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = dataUrl;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Allow re-picking the same file later (works for all hidden inputs)
    const pickerEl = e.target;
    setTimeout(() => { pickerEl.value = ''; }, 0);
    if (files.length === 0) return;

    // Separate images vs documents
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const docFiles = files.filter(f => !f.type.startsWith('image/'));

    // Handle image files (existing logic)
    if (imageFiles.length > 0) {
      const remaining = getRemainingUsage();
      const remainingAnalysis = remaining?.imageAnalysis ?? 0;
      
      if (remainingAnalysis <= 0) {
        handleImageLocked();
        // Still process doc files below
      } else {
        const maxAllowed = Math.min(remainingAnalysis, 5);
        const currentImageCount = selectedImages.length;
        const availableSlots = maxAllowed - currentImageCount;
        const imagesToProcess = imageFiles.slice(0, Math.max(0, availableSlots));

        if (imagesToProcess.length > 0) {
          setIsProcessingImages(true);
          toast.info(`Processing ${imagesToProcess.length} image${imagesToProcess.length > 1 ? 's' : ''}...`);
          
          for (let i = 0; i < imagesToProcess.length; i++) {
            const file = imagesToProcess[i];
            const reader = new FileReader();
            reader.onloadend = async () => {
              try {
                const original = reader.result as string;
                const compressed = await compressImage(original, 800, 0.75);
                setSelectedImages(prev => [...prev, compressed]);
              } catch (error) {
                console.error('Image compression error:', error);
                toast.error('Failed to process image');
              }
            };
            reader.readAsDataURL(file);
          }
          setTimeout(() => setIsProcessingImages(false), 1000);
        }
      }
    }

    // Handle document files (PDF, TXT, DOC, CSV, JSON, etc.)
    if (docFiles.length > 0) {
      const maxDocs = 3 - selectedFiles.length;
      const docsToProcess = docFiles.slice(0, Math.max(0, maxDocs));
      
      if (docsToProcess.length === 0) {
        toast.error('Maximum 3 documents allowed per message');
        return;
      }

      setIsProcessingImages(true);
      toast.info(`Processing ${docsToProcess.length} document${docsToProcess.length > 1 ? 's' : ''}...`);

      for (const file of docsToProcess) {
        try {
          const textContent = await extractTextFromFile(file);
          const attached: AttachedFile = {
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            textContent
          };
          setSelectedFiles(prev => [...prev, attached]);
          console.log(`📄 Document processed: ${file.name} (${(file.size / 1024).toFixed(1)}KB, ${textContent.length} chars extracted)`);
        } catch (err) {
          console.error('Document processing error:', err);
          toast.error(`Failed to process ${file.name}`);
        }
      }
      setIsProcessingImages(false);
    }
  };

  // Extract text content from various file types
  const extractTextFromFile = async (file: File): Promise<string> => {
    const name = file.name.toLowerCase();
    
    // Plain text files
    if (file.type.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.md') || 
        name.endsWith('.csv') || name.endsWith('.json') || name.endsWith('.xml') ||
        name.endsWith('.html') || name.endsWith('.css') || name.endsWith('.js') ||
        name.endsWith('.ts') || name.endsWith('.py') || name.endsWith('.java') ||
        name.endsWith('.log') || name.endsWith('.yaml') || name.endsWith('.yml')) {
      return await file.text();
    }
    
    // PDF files - extract text from PDF using canvas-based approach
    if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
      return await extractPDFText(file);
    }

    // For DOC/DOCX/other binary - read as base64 and let AI know the type
    const buffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer).slice(0, 50000)));
    return `[Binary file: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(1)}KB). Content preview not available - file attached for reference.]`;
  };

  // PDF text extraction — done fully in the browser, nothing is stored.
  const extractPDFText = async (file: File): Promise<string> => {
    try {


      // Try raw text extraction from PDF bytes
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);

      // Extract text between stream markers (common in PDFs)
      const textParts: string[] = [];
      const streamRegex = /stream\s*([\s\S]*?)\s*endstream/g;
      let match;
      while ((match = streamRegex.exec(rawText)) !== null) {
        const cleaned = match[1].replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
        if (cleaned.length > 20) textParts.push(cleaned);
      }

      // Also try extracting text objects
      const textObjRegex = /\(([^)]+)\)/g;
      while ((match = textObjRegex.exec(rawText)) !== null) {
        if (match[1].length > 3 && /[a-zA-Z]/.test(match[1])) {
          textParts.push(match[1]);
        }
      }

      const extracted = textParts.join(' ').slice(0, 30000);
      if (extracted.length > 100) {
        return `[PDF: ${file.name}]\n\n${extracted}`;
      }

      return `[PDF file: ${file.name} (${(file.size / 1024).toFixed(1)}KB, ${(file.size / 1024 / 1024 * 3).toFixed(0)} estimated pages). Text extraction limited - the PDF may contain scanned images. User uploaded this PDF for analysis. Please ask the user what specific information they need from this document.]`;
    } catch (err) {
      console.error('PDF extraction error:', err);
      return `[PDF file: ${file.name} (${(file.size / 1024).toFixed(1)}KB) - Processing error. Please describe what you need from this PDF.]`;
    }
  };

  const removeSelectedImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    if (selectedImages.length === 1 && fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Map a raw transport/server error into a friendly user-facing message.
  // Transport errors come prefixed (NETWORK/TIMEOUT/AUTH_REQUIRED/USAGE_LIMIT/
  // AI_UNAVAILABLE/EMPTY_STREAM/VISION_FAILED) — match those first, then fall
  // back to substring matching for anything else.
  const describeChatError = (err: any, hadImages: boolean): string => {
    const rawMsg = err?.message || String(err || '');
    const raw = rawMsg.toLowerCase();

    // Offline takes priority — clearer than a generic network error
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return "I couldn't reach the server because your device seems to be offline right now. Please check your internet connection, and once you're back online just tap your message to send it again — I'll pick up exactly where we left off.";
    }

    if (rawMsg.startsWith('AUTH_REQUIRED') || raw.includes('login') || raw.includes('auth') || raw.includes('401') || raw.includes('403')) {
      return "I couldn't continue because your login session has expired for security reasons. Please sign in again, and then resend your message — your chat history is safe and I'll answer right away.";
    }
    if (rawMsg.startsWith('USAGE_LIMIT') || raw.includes('plan limit') || raw.includes('usage limit') || raw.includes('quota reached') || raw.includes('upgrade your plan')) {
      return "You've used up all the messages included in your current plan, so I can't send this one through. Upgrade your plan to keep chatting with me, and everything will continue from here without losing this conversation.";
    }
    if (rawMsg.startsWith('AI_BUSY') || raw.includes('rate_limited') || raw.includes('too many requests') || raw.includes('ai busy') || raw.includes('temporarily busy')) {
      return "I'm handling a very high number of requests at this moment, so your message couldn't get through. Please wait a few seconds and tap your message to retry — it usually works on the second attempt.";
    }
    if (rawMsg.startsWith('TIMEOUT') || raw.includes('timeout') || raw.includes('timed out')) {
      return "I was still working on your answer but it took longer than the maximum time allowed, so the request stopped. This usually happens with heavy research or a slow connection. Please tap your message to retry — you can also split it into a smaller question for a faster reply.";
    }
    if (rawMsg.startsWith('NETWORK') || raw.includes('network') || raw.includes('fetch') || raw.includes('failed to fetch')) {
      return "Your message couldn't reach me because the connection dropped on the way. Please check your internet and tap the message to send it again — nothing you typed has been lost.";
    }
    if (rawMsg.startsWith('VISION_FAILED') || raw.includes('vision') || (hadImages && raw.includes('failed'))) {
      return "I received your message, but the image analysis service isn't responding at the moment, so I couldn't read the picture you shared. Please try again shortly, or describe what's in the image and I'll help you with a text-only answer right now.";
    }
    if (rawMsg.startsWith('EMPTY_STREAM') || raw.includes('empty') || raw.includes('no response')) {
      return "Something went wrong while I was writing my reply and it came through empty. Please tap your message to ask me again — rephrasing it slightly also helps me answer properly.";
    }
    if (rawMsg.startsWith('AI_UNAVAILABLE') || raw.includes('all models') || raw.includes('model')) {
      return "My AI engine is temporarily unavailable, so I couldn't process your request. This is a short-lived issue on our side. Please tap your message to retry in a moment and I'll answer in full.";
    }

    return "I couldn't complete your request because of an unexpected technical issue on our side. Nothing is wrong with your message — please tap it to retry, and if it keeps failing, try again in a few minutes.";
  };


  // One active in-flight send at a time (guards rapid double-submit + retries during stream)
  /**
   * Ids of assistant messages that arrived live in this session. Only these get
   * the typing reveal — reloaded/stored history renders instantly.
   */
  const liveReplyIdsRef = useRef<Set<string>>(new Set());
  const sendInFlightRef = useRef(false);
  // Abort handle for the in-flight AI response, so the user can stop it (ChatGPT-style)
  const activeAbortRef = useRef<AbortController | null>(null);
  // Latest status text pushed by the server (`set_status` / progress events).
  // The client heartbeat re-uses it so the header shows real work + elapsed time.
  const serverStatusRef = useRef<string>('');
  // Language the user is writing in — every status line is shown in it.
  const statusLangRef = useRef<StatusLangCode>('en');
  // Subject-aware status built from the user's own message. Used whenever the
  // backend only sends generic transport filler.
  const localStatusRef = useRef<string>('');
  // True when the current turn is a greeting / chit-chat: the status must stay
  // "writing your reply" and never claim lookup work.
  const smallTalkTurnRef = useRef<boolean>(false);
  // Follow-up stage statuses for this turn (shown only when the real work
  // actually reaches those stages).
  const followUpStatusesRef = useRef<string[]>([]);
  // Move to the next real stage of this turn (e.g. "check" -> "analyze").
  const advanceFollowUpStatus = useCallback(() => {
    const next = followUpStatusesRef.current.shift();
    if (!next) return;
    localStatusRef.current = next;
    setStatusSteps(prev => (prev[prev.length - 1] === next ? prev : [...prev, next].slice(-6)));
    setStatusOnce(next);
  }, []);
  // Localize a backend status line and record it as a step of this run.
  const applyServerStatus = useCallback((text: string) => {
    const raw = stripStatusEmojis(text || '');
    // Generic transport filler must never replace a message-specific status.
    const GENERIC =
      /(request\s*(bhej|send)|sending your request|shuru kar rahi|starting|please wait|processing|working on it|kaam kar rahi hoon|भेज रही|शुरू कर रही)/i;
    if (!raw || GENERIC.test(raw)) {
      if (localStatusRef.current) setStatusOnce(localStatusRef.current);
      return '';
    }
    // On a greeting / identity / instant-answer turn the AI sometimes invents a
    // lookup status built from stray words of the user's sentence ("Kese check
    // kar rahi hoon..."). Keep the truthful line instead.
    if (smallTalkTurnRef.current) {
      if (localStatusRef.current) setStatusOnce(localStatusRef.current);
      return '';
    }
    const localized = stripStatusEmojis(localizeStatusText(raw, statusLangRef.current));
    if (!localized) return '';
    serverStatusRef.current = localized;
    setStatusSteps(prev =>
      prev[prev.length - 1] === localized ? prev : [...prev, localized].slice(-6),
    );
    setStatusOnce(localized);
    return localized;
  }, []);
  // Latest REAL work phase reported by the backend, used for the truthful
  // fallback label while no explicit `set_status` text has arrived yet.
  const serverPhaseRef = useRef<StatusPhase>('analyzing');
  // Id of the AI run currently being watched over Supabase Realtime.
  const activeRunIdRef = useRef<string | null>(null);


  const cancelledRef = useRef(false);

  // ── Supabase Realtime mirror of the live task status ──────────────────
  // The SSE stream is the primary channel; Realtime keeps the status chip
  // correct even if the stream stalls (mobile network, proxy buffering).
  useEffect(() => {
    const runId = taskStatus.runId;
    if (!runId) return;
    const channel = supabase
      .channel(`ai-task-status-${runId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ai_task_status', filter: `run_id=eq.${runId}` },
        (payload) => {
          const row = payload.new as {
            phase?: AITaskPhase; message?: string; progress?: number;
          } | null;
          if (!row || activeRunIdRef.current !== runId) return;
          if (row.phase === 'completed') {
            serverStatusRef.current = '';
            setStatusOnce('');
            setTaskStatus(prev => ({ ...prev, phase: 'completed', progress: 100 }));
            return;
          }
          if (row.phase) serverPhaseRef.current = row.phase as StatusPhase;
          if (row.message) {
            applyServerStatus(row.message);
          }
          setTaskStatus(prev => ({
            ...prev,
            phase: row.phase ?? prev.phase,
            progress: row.progress ?? prev.progress,
          }));

        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskStatus.runId, applyServerStatus]);

  const cancelGeneration = () => {
    cancelledRef.current = true;
    activeAbortRef.current?.abort();
    activeAbortRef.current = null;
    sendInFlightRef.current = false;
    setIsLoading(false);
    setStatusOnce('');
    setStatusSteps([]);
    setMessages(prev => {
      const updated = [
        ...prev.filter(m => !m.isProgress),
        {
          id: `stopped-${Date.now()}`,
          role: 'assistant' as const,
          content: '⏹️ Response stopped by you.',
          timestamp: formatChatStamp(),
        },
      ];
      chatStorage.saveMessages(updated);
      return updated;
    });
  };

  interface SendPayload {
    text: string;
    imageUrls: string[];
    attachedFiles: AttachedFile[];
    retryOfMessageId?: string;
    /** Send to AI without showing a user bubble in the chat */
    hidden?: boolean;
  }

  /**
   * SEO pack the AI has asked permission for. No card is shown any more — the
   * AI asks "kya main update kar du?" and a simple "haan" fires the YouTube
   * update instantly from here.
   */
  const pendingYtUpdateRef = useRef<YtSeoUpdatePayload | null>(null);

  /** User said yes → update YouTube right away, no AI round-trip. */
  const runPendingYtUpdate = async (approvalText: string) => {
    const data = pendingYtUpdateRef.current;
    if (!data) return false;
    pendingYtUpdateRef.current = null;

    const userMsg: Message = {
      id: `yt-ok-${Date.now()}`,
      role: 'user',
      content: approvalText,
      timestamp: formatChatStamp(),
    };
    const workingMsg: Message = {
      id: `yt-working-${Date.now()}`,
      role: 'assistant',
      content: '⏳ YouTube par update kar rahi hoon...',
      timestamp: formatChatStamp(),
    };
    setMessages(prev => {
      const updated = [...prev, userMsg, workingMsg];
      chatStorage.saveMessages(updated);
      return updated;
    });

    const res = await applyYtSeoUpdate(data);
    setMessages(prev => {
      const updated = prev.map(m =>
        m.id === workingMsg.id
          ? { ...m, content: res.message, timestamp: formatChatStamp() }
          : m,
      );
      chatStorage.saveMessages(updated);
      return updated;
    });
    return true;
  };

  const sendMessage = async (payload?: SendPayload) => {

    // If no payload provided, build from current input state (normal Send button path)
    const fromInput = !payload;
    const rawMessage = (payload?.text ?? input).trim();
    // "Think harder" mode: ask the model for deeper step-by-step reasoning
    const userMessage = fromInput && thinkHarder && rawMessage
      ? `${rawMessage}\n\n(Think harder: step-by-step deeply analyse karke detailed, well-reasoned answer do.)`
      : rawMessage;
    const imageUrls = payload?.imageUrls ?? [...selectedImages];
    const attachedFiles = payload?.attachedFiles ?? [...selectedFiles];
    const retryOfMessageId = payload?.retryOfMessageId;
    const hiddenMessage = payload?.hidden === true;

    if ((!userMessage && imageUrls.length === 0 && attachedFiles.length === 0)) return;
    if (sendInFlightRef.current) {
      toast.info('Please wait — a message is still sending.');
      return;
    }

    // Check if user is logged in
    if (!currentUser) {
      handleLoginRequired('send messages');
      return;
    }

    // "Haan" par YouTube SEO turant live — AI ko dobara pucha nahi jata.
    if (
      !retryOfMessageId &&
      imageUrls.length === 0 &&
      attachedFiles.length === 0 &&
      pendingYtUpdateRef.current &&
      isYtUpdateApproval(rawMessage)
    ) {
      if (fromInput) {
        setInput('');
        setSelectedImages([]);
        setSelectedFiles([]);
      }
      void runPendingYtUpdate(rawMessage);
      return;
    }


    // Slow-network heads-up: warn the user once per send when their connection
    // is genuinely slow (2g / slow-2g / saveData enabled). Doesn't block the
    // request — just sets expectations so a long wait doesn't feel like a bug.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const conn: any = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      if (conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g' || conn.saveData === true)) {
        toast.info('Network slow lag raha hai — reply aane me extra time lag sakta hai.', { duration: 4000 });
      }
    } catch { /* ignore — connection API not supported */ }

    sendInFlightRef.current = true;
    // NOTE: local cached replies are intentionally NOT used any more — the same
    // question asked twice must always hit the AI again for a fresh answer.


    if (fromInput) {
      setInput('');
      setSelectedImages([]);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
    
    // Build display content for user message
    let displayContent = userMessage;
    if (!displayContent && imageUrls.length > 0) {
      displayContent = imageUrls.length > 1 ? `${imageUrls.length} images sent` : 'Image sent';
    }
    if (attachedFiles.length > 0) {
      const fileNames = attachedFiles.map(f => `📄 ${f.name}`).join('\n');
      displayContent = displayContent ? `${displayContent}\n\n${fileNames}` : fileNames;
    }

    // If retrying, reuse the existing failed bubble; otherwise create a new one
    const messageId = retryOfMessageId || Date.now().toString();
    if (retryOfMessageId) {
      // Flip failed → pending in place (preserves position + content + attachments)
      setMessages(prev => {
        const updated = prev.map(m =>
          m.id === retryOfMessageId
            ? { ...m, status: 'pending' as const, content: displayContent || m.content }
            : m
        );
        chatStorage.saveMessages(updated);
        return updated;
      });
    } else {
      const newUserMessage: Message = {
        id: messageId,
        role: 'user',
        content: displayContent || 'File sent',
        timestamp: formatChatStamp(),
        imageUrls,
        attachedFiles: attachedFiles.length > 0 ? attachedFiles : undefined,
        status: 'pending',
        hidden: hiddenMessage || undefined,
      };
      setMessages(prev => {
        const updated = [...prev, newUserMessage];
        chatStorage.saveMessages(updated);
        return updated;
      });
    }

    // Play message sent sound
    messageSentFeedback();

    setGenerationIntent(detectGenerationIntent(userMessage));
    setIsLoading(true);
    setReplyStarted(false);


    // Truthful opener status in the user's own language/style, produced by the
    // central generator. Greetings get no lookup status, identity questions get
    // "Apna naam bata rahi hoon...", real tasks get their real subject.
    const statusLang = detectRequestLang(userMessage);
    const phaseLang = (statusLang === 'gujlish' ? 'gu' : statusLang) as StatusPhaseLang;
    statusLangRef.current = statusLang;
    setStatusSteps([]);
    statusLockedRef.current = false;
    serverPhaseRef.current = 'sending';

    const intentResult = classifyIntent(userMessage, statusLang);
    const localSubjectStatus = buildRequestStatus(userMessage, statusLang);
    // Stages that may follow once the real work reaches them.
    followUpStatusesRef.current = getFollowUpStatuses(userMessage, statusLang);
    // Greeting / identity / instant-answer turns must never be overwritten by
    // an invented "checking ..." status from the model.
    smallTalkTurnRef.current =
      intentResult.intent === 'greeting' ||
      intentResult.intent === 'identity' ||
      intentResult.intent === 'calculation';
    localStatusRef.current = localSubjectStatus;
    const openingStatus = localSubjectStatus || getPhaseStatus(phaseLang, 'analyzing');
    setStatusSteps(openingStatus ? [openingStatus] : []);
    setStatusOnce(openingStatus);




    // Friendly "still working" bubbles posted while the AI is thinking, so the
    // user waits instead of assuming the chat froze. They are removed as soon
    // as the request finishes (success or error).
    const waitTimers: number[] = [];
    const waitMessageIds: string[] = [];
    const pushWaitMessage = (text: string, suffix: string) => {
      const waitId = `wait-${messageId}-${suffix}`;
      waitMessageIds.push(waitId);
      setMessages(prev => {
        if (prev.some(m => m.id === waitId)) return prev;
        return [
          ...prev,
          {
            id: waitId,
            role: 'assistant' as const,
            content: text,
            timestamp: formatChatStamp(),
            isProgress: true,
          },
        ];
      });
    };
    const removeWaitMessages = () => {
      setMessages(prev => {
        const updated = prev.filter(
          m => !waitMessageIds.includes(m.id) && !m.id.startsWith(`wait-${messageId}`),
        );
        if (updated.length === prev.length) return prev;
        chatStorage.saveMessages(updated);
        return updated;
      });
      waitMessageIds.length = 0;
    };
    const clearRotation = () => {
      waitTimers.forEach(t => clearTimeout(t));
      waitTimers.length = 0;
      removeWaitMessages();
    };

    // Abort controller so the in-flight fetch actually stops on timeout / unmount.
    // Without this, the request keeps running and `sendInFlightRef` stays true,
    // which causes the "Please wait — a message is still sending" message on retry.
    const abortController = new AbortController();
    let didTimeout = false;
    activeAbortRef.current = abortController;
    cancelledRef.current = false;
    generatedImagesRef.current = [];
    setImageGenerating(false);

    // NO hard timeout any more — the AI gets unlimited time to finish.
    // Instead we keep a live "what am I doing right now" status ticking so the
    // user can see the work is still in progress and does not leave the page.
    const workStartedAt = Date.now();
    // Status text pacing: a status line must stay on screen for at least
    // MIN_STATUS_DWELL_MS before it can be replaced, and a line that was
    // already shown in this run is never shown again — so the chip changes
    // calmly and never loops back to a status the user already saw.
    const MIN_STATUS_DWELL_MS = 6000;
    let shownStatusText = '';
    let shownStatusAt = 0;
    const usedStatusTexts = new Set<string>();
    const applyStatusText = (text: string, force = false) => {
      const next = (text || '').trim();
      if (!next || next === shownStatusText) return;
      const now = Date.now();
      if (!force) {
        if (shownStatusText && now - shownStatusAt < MIN_STATUS_DWELL_MS) return;
        if (usedStatusTexts.has(next)) return;
      }
      usedStatusTexts.add(next);
      shownStatusText = next;
      shownStatusAt = now;
      // Every status the user actually saw is kept as a ticked step, so the
      // full history of this turn (built from their own message) stays visible.
      setStatusSteps(prev => (prev[prev.length - 1] === next ? prev : [...prev, next].slice(-6)));
      setStatusOnce(next);
    };

    const statusHeartbeat = window.setInterval(() => {
      const elapsed = Date.now() - workStartedAt;
      // The AI's own `set_status` text always wins. Until it arrives we walk
      // through the truthful phase labels, and on a long run we switch to
      // gentle "still working" lines so the user knows nothing is stuck.
      const serverPhaseLabel = serverPhaseRef.current
        ? getPhaseStatus(phaseLang, serverPhaseRef.current as StatusPhase)
        : '';
      const serverText = serverStatusRef.current;
      const base =
        serverText ||
        // The subject-aware opener is only truthful for the first seconds.
        (elapsed < 9000 ? localSubjectStatus : '') ||
        (elapsed < 55000 ? serverPhaseLabel : '') ||
        getElapsedStatus(phaseLang, elapsed) ||
        getWorkingStatus(statusLang);
      // Single-line status only — no elapsed-seconds suffix. Real server
      // statuses bypass the dwell/no-repeat gate so they are never dropped.
      applyStatusText(base || '', !!serverText);
      // Keep the progress bar creeping forward while we wait (caps at 90%).
      setTaskStatus(prev => {
        if (prev.phase === 'completed' || prev.phase === 'failed') return prev;
        const timed = Math.min(90, 10 + Math.round(elapsed / 1200));
        const rawPhase = serverPhaseRef.current === 'finalizing'
          ? 'finalizing'
          : getElapsedPhase(elapsed);
        const phase: AITaskPhase = rawPhase === 'working' || rawPhase === 'sending'
          ? 'analyzing'
          : (rawPhase as AITaskPhase);
        const next = Math.max(prev.progress ?? 0, timed);
        if (next === prev.progress && phase === prev.phase) return prev;
        return { ...prev, progress: next, phase };
      });
    }, 1500);






    
    // Mark as sent when API call starts
    setMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, status: 'sent' as const } : msg
    ));

    try {
      // Detect YouTube URLs in user message and extract video IDs
      const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})(?:[^\s]*)/g;
      const youtubeMatches = [...(userMessage.matchAll(youtubeRegex))];
      const youtubeVideoIds = [...new Set(youtubeMatches.map(m => m[1]))];
      
      // Fetch YouTube video details from backend API if links detected
      let youtubeVideoDetails: Array<{
        id: string; title: string; description: string; channelTitle: string;
        tags: string[]; duration: string; statistics: { viewCount: number; likeCount: number; commentCount: number };
        topComments?: Array<{ author: string; text: string; likeCount: number }>;
      }> = [];
      
      if (youtubeVideoIds.length > 0) {
        try {
          const detailsPromises = youtubeVideoIds.map(async (videoId) => {
            try {
              const [videoRes, commentsRes] = await Promise.all([
                supabase.functions.invoke('unified-youtube-api', { body: { action: 'video', videoId } }),
                supabase.functions.invoke('unified-youtube-api', { body: { action: 'comments', videoId, maxResults: 15 } }),
              ]);
              const { data, error } = videoRes;
              if (!error && data?.success && data?.video) {
                const topComments = commentsRes?.data?.success ? (commentsRes.data.comments || []) : [];
                return { ...data.video, topComments };
              }
              return null;
            } catch {
              return null;
            }
          });
          const results = await Promise.all(detailsPromises);
          youtubeVideoDetails = results.filter(Boolean);
        } catch (ytErr) {
          console.warn('YouTube API fetch failed, falling back to thumbnail:', ytErr);
        }
      }
      
      // Build document context if files are attached
      let documentContext = '';
      if (attachedFiles.length > 0) {
        const docParts = attachedFiles.map((f, i) => {
          const header = `\n--- Attached Document ${i + 1}: ${f.name} (${f.type}, ${(f.size / 1024).toFixed(1)}KB) ---`;
          return f.textContent ? `${header}\n${f.textContent.slice(0, 25000)}` : `${header}\n[Binary file - content not extractable]`;
        }).join('\n\n');
        documentContext = `\n\n[User has attached ${attachedFiles.length} document(s). Here is the extracted content:\n${docParts}\n\nPlease analyze these documents thoroughly. Answer questions about them, summarize, translate, extract data, or do whatever the user asks. If you cannot read the content, inform the user.]`;
      }

      // Build content for AI with vision support
      let aiContent: any;
      const textWithDocs = (userMessage || '') + documentContext;
      
      if (imageUrls.length > 0) {
        // Multi-modal format for vision models
        aiContent = [
          { type: 'text', text: textWithDocs || 'Please analyze these images' },
          ...imageUrls.map(url => ({
            type: 'image_url',
            image_url: { url: url }
          }))
        ];
      } else if (youtubeVideoDetails.length > 0) {
        // Rich YouTube context from API - send full video data to AI
        const videoContextParts = youtubeVideoDetails.map((v, i) => {
          return `--- YouTube Video ${i + 1} ---
Title: ${v.title}
Channel: ${v.channelTitle}
Duration: ${v.duration || 'N/A'}
Views: ${v.statistics?.viewCount?.toLocaleString() || 'N/A'}
Likes: ${v.statistics?.likeCount?.toLocaleString() || 'N/A'}
Comments: ${v.statistics?.commentCount?.toLocaleString() || 'N/A'}
Tags: ${(v.tags || []).slice(0, 15).join(', ') || 'None'}
Description: ${(v.description || '').slice(0, 800)}
Top Comments:
${(v.topComments || []).slice(0, 12).map((c) => `- ${c.author}: ${String(c.text || '').replace(/\s+/g, ' ').slice(0, 200)} (${c.likeCount} likes)`).join('\n') || '- (no comments available)'}`;
        }).join('\n\n');
        
        const ytText = `${textWithDocs}\n\n[User shared YouTube video(s). Here is the complete video data fetched from YouTube API:\n\n${videoContextParts}\n\nUser ko simple Hinglish me batao: video ka title kya hai, description me kya bataya gaya hai, aur comments me log kya keh rahe hain (overall sentiment + 2-3 common points). Do NOT say you cannot watch videos - you have full video metadata above.]`;
        
        aiContent = [
          { type: 'text', text: ytText },
          ...youtubeVideoIds.map(id => ({
            type: 'image_url',
            image_url: { url: `https://img.youtube.com/vi/${id}/maxresdefault.jpg` }
          }))
        ];
      } else if (youtubeVideoIds.length > 0) {
        const ytText = textWithDocs + '\n\n[User shared YouTube video(s). API data unavailable - analyze thumbnail only.]';
        aiContent = [
          { type: 'text', text: ytText },
          ...youtubeVideoIds.map(id => ({
            type: 'image_url',
            image_url: { url: `https://img.youtube.com/vi/${id}/maxresdefault.jpg` }
          }))
        ];
      } else {
        aiContent = textWithDocs || userMessage;
      }

      // Get page context for AI awareness
      const getPageContext = () => {
        const path = window.location.pathname;
        const context: any = { path, audience: chatAudience };
        
        // Add relevant page-specific data
        if (path.includes('/jobs')) context.page = 'Jobs Search';
        else if (path.includes('/applications')) context.page = 'My Applications';
        else if (path.includes('/profile')) context.page = 'User Profile';
        else if (path.includes('/companies')) context.page = 'Companies Directory';
        else if (path.includes('/wallet')) context.page = 'Wallet & Points';
        else if (path === '/ai-assistant') context.page = 'AI Career Chat';
        else context.page = 'Home';
        
        return context;
      };

      const markMessageDelivered = () => {
        setMessages(prev => {
          let changed = false;
          const updated = prev.map(msg => {
            if (msg.id === messageId && msg.status !== 'delivered' && msg.status !== 'read') {
              changed = true;
              return { ...msg, status: 'delivered' as const };
            }
            return msg;
          });

          if (changed) {
            chatStorage.saveMessages(updated);
            return updated;
          }

          return prev;
        });
      };

      let assistantMessage = '';
      let isFirstChunk = true;
      let cachedHandled = false;

      const result = await callAICareerChat(
        {
          // Exclude transient progress + error bubbles from the AI history
          // so the model never sees its own error toasts as context.
          messages: [...messages.filter(m => !m.isProgress && !m.isError), { role: 'user', content: aiContent }],
          user_id: currentUser?.id,
          audience: chatAudience,
          hasImages: imageUrls.length > 0,
          currentPage: window.location.pathname,
          pageContext: getPageContext()
        },
        {
          onRunId: (runId) => {
            activeRunIdRef.current = runId;
            serverPhaseRef.current = 'started';
            setTaskStatus(prev => ({ ...prev, runId, phase: 'started', progress: 10 }));
          },
          // Real request milestones. Until the server pushes its own
          // `set_status` text, these keep the header truthful instead of
          // freezing on the very first label.
          onLifecycle: (stage) => {
            if (serverStatusRef.current) return; // server text always wins
            // Transport milestones ("Request bhej rahi hoon...") are never
            // shown — the status must always describe the user's own message.
            if (stage !== 'reply_writing') return;
            serverPhaseRef.current = 'finalizing';
            setStatusOnce(localSubjectStatus || getPhaseStatus(phaseLang, 'finalizing'));
          },
          onStatus: (text, meta) => {
            clearRotation();
            markMessageDelivered();
            // A completed run must not keep the working chip on screen.
            if (meta?.phase === 'completed') {
              serverStatusRef.current = '';
              setStatusOnce('');
              setTaskStatus(prev => ({ ...prev, phase: 'completed', progress: 100 }));
              return;
            }
            if (meta?.phase) serverPhaseRef.current = meta.phase as StatusPhase;
            const applied = applyServerStatus(text);
            // Real work reached the next stage but the server had nothing
            // specific to say — advance to this turn's own next stage.
            if (!applied && (meta?.phase === 'analyzing' || meta?.phase === 'verifying')) {
              advanceFollowUpStatus();
            }
            setTaskStatus(prev => ({
              runId: meta?.runId ?? prev.runId,
              phase: (meta?.phase as AITaskPhase) ?? prev.phase,
              progress: meta?.progress ?? prev.progress,
            }));
          },

          onProgressMessage: (text) => {
            clearRotation();
            markMessageDelivered();
            // Progress events should drive the live header status only.
            // Do not render them as separate assistant bubbles before the
            // final AI reply is ready.
            applyServerStatus(text);
          },
          onImageStart: () => {
            markMessageDelivered();
            setImageGenerating(true);
          },
          onImage: (url) => {
            setImageGenerating(false);
            if (!generatedImagesRef.current.includes(url)) {
              generatedImagesRef.current.push(url);
            }
            // Render the image immediately — do not wait for the model text.
            setMessages(prev => {
              const base = prev.filter(m => !m.isProgress);
              const last = base[base.length - 1];
              const markdown = `![Generated Image](${url})`;
              let updated: Message[];
              if (last?.role === 'assistant' && !last.content.includes(url)) {
                updated = base.map((m, i) =>
                  i === base.length - 1
                    ? { ...m, content: `${m.content}\n\n${markdown}`.trim() }
                    : m
                );
              } else if (last?.role === 'assistant') {
                updated = base;
              } else {
                const id = `assistant-image-${Date.now()}`;
                liveReplyIdsRef.current.add(id);
                updated = [...base, {
                  id,
                  role: 'assistant' as const,
                  content: markdown,
                  timestamp: formatChatStamp(),
                }];
              }
              chatStorage.saveMessages(updated);
              return updated;
            });
          },
          onCached: (text) => {
            clearRotation();
            cachedHandled = true;
            serverStatusRef.current = '';
            setStatusOnce('');
            setReplyStarted(true);

            console.log('💰 Server cache HIT!');
            setMessages(prev => prev.map(msg =>
              msg.id === messageId ? { ...msg, status: 'read' as const } : msg
            ));
            const cleanedText = stripMetaStatusLeak(text);
            const cachedAssistantMessage: Message = {
              id: Date.now().toString(),
              role: 'assistant',
              content: cleanedText,
              timestamp: formatChatStamp()
            };
            liveReplyIdsRef.current.add(cachedAssistantMessage.id);
            setMessages(prev => {
              const updated = [...prev.filter(m => !m.isProgress), cachedAssistantMessage];
              chatStorage.saveMessages(updated);
              return updated;
            });
            messageReceivedFeedback();
          },
          onDelta: (_delta, full) => {
            assistantMessage = appendGeneratedImages(stripMetaStatusLeak(full));
            if (isFirstChunk) {
              setImageGenerating(false);
              clearRotation();
              serverStatusRef.current = '';
              window.clearInterval(statusHeartbeat);
              // The answer is streaming in — tell the user we're writing it.
              serverPhaseRef.current = 'finalizing';
              setStatusOnce(getWritingStatus(phaseLang));
              setTaskStatus(prev => ({ ...prev, phase: 'finalizing', progress: Math.max(prev.progress ?? 0, 92) }));
              setMessages(prev => prev.map(msg =>
                msg.id === messageId ? { ...msg, status: 'delivered' as const } : msg
              ));
              isFirstChunk = false;
            }
            setMessages(prev => {
              const baseMessages = prev.filter(m => !m.isProgress);
              const newMessages = [...baseMessages];
              const last = newMessages[newMessages.length - 1];
              if (last?.role === 'assistant') {
                last.content = assistantMessage;
              } else {
                liveReplyIdsRef.current.add(`assistant-${messageId}`);
                newMessages.push({
                  id: `assistant-${messageId}`,
                  role: 'assistant',
                  content: assistantMessage,
                  timestamp: formatChatStamp()
                });
                messageReceivedFeedback();
              }
              chatStorage.saveMessages(newMessages);
              return newMessages;
            });
          }
        },
        abortController.signal
      );

      // Save to local cache for both cached and streamed responses
      if (userMessage && imageUrls.length === 0 && result.fullText) {
        await aiResponseCache.saveToLocalCache(userMessage, result.fullText);
      }

      if (!cachedHandled) {
        // Mark user message as read when AI reply is complete
        setMessages(prev => {
          const updated = prev.map(msg =>
            msg.id === messageId ? { ...msg, status: 'read' as const } : msg
          );
          chatStorage.saveMessages(updated);
          return updated;
        });

        if (assistantMessage && assistantMessage.includes('AI_GENERATION_LIMIT_REACHED')) {
          toast.error("🚫 AI Generation Limit Reached", {
            description: "Your AI Generation limit is exhausted. Upgrade your plan to generate more.",
            action: {
              label: "🚀 Upgrade Plan",
              onClick: () => navigate('/ai-assistant/subscription')
            },
            duration: 8000
          });
        }
      }
    } catch (error: any) {
      console.error('Error:', error);
      if (didTimeout) return;
      // User pressed Stop — the cancel handler already posted the stopped note.
      if (cancelledRef.current || error?.name === 'AbortError') return;

      // Kill the live status IMMEDIATELY so a "still working..." chip can never
      // sit under an error bubble.
      window.clearInterval(statusHeartbeat);
      serverStatusRef.current = '';
      serverPhaseRef.current = 'failed';
      setStatusOnce('');
      setStatusSteps([]);
      setTaskStatus({});

      const friendly = describeChatError(error, imageUrls.length > 0);
      toast.error(friendly);


      // Mark message as failed instead of removing it (so retry button stays visible)
      setMessages(prev => {
        const updated = prev.map(msg =>
          msg.id === messageId ? { ...msg, status: 'failed' as const } : msg
        );
        // Inline error bubble in chat — user can see what went wrong without
        // needing to catch the toast.
        const rawMsg = (error?.message || String(error || 'Unknown error')).slice(0, 300);
        updated.push({
          id: `error-${messageId}-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ **${friendly}**\n\n\`${rawMsg}\`\n\nApna message tap karke retry karein.`,
          timestamp: formatChatStamp(),
          isError: true,
        });
        chatStorage.saveMessages(updated);
        return updated;
      });
    } finally {
      window.clearInterval(statusHeartbeat);
      serverStatusRef.current = '';
      activeRunIdRef.current = null;
      setTaskStatus({});
      clearRotation();
      setIsLoading(false);
      setImageGenerating(false);
      activeAbortRef.current = null;
      // Slight delay avoids flicker where status arrives but is cleared in the
      // same render tick on slower mobile browsers.
      window.setTimeout(() => { setStatusOnce(''); setStatusSteps([]); }, 120);
      sendInFlightRef.current = false;
    }
  };

  // Retry a failed message — reuse exact original payload, no async state dance
  const handleRetryMessage = (failedMsg: Message) => {
    if (sendInFlightRef.current) {
      toast.info('Please wait — a message is still sending.');
      return;
    }
    sendMessage({
      text: failedMsg.content || '',
      imageUrls: failedMsg.imageUrls || [],
      attachedFiles: failedMsg.attachedFiles || [],
      retryOfMessageId: failedMsg.id,
    });
  };

  // Asking to delete only opens the confirm dialog — nothing is removed yet.
  const handleClearAll = () => setShowClearConfirm(true);

  // Actual delete: wipes chat from screen AND from local device storage.
  const confirmClearAll = () => {
    chatStorage.clearMessages();
    aiResponseCache.clearCache();
    setMessages([]);
    setSelectedMessages(new Set());
    setIsSelectionMode(false);
    setShowClearConfirm(false);
    toast.success('Chat deleted from this device');
  };


  const handleExportChat = () => {
    const chatText = messages
      .map(msg => `[${msg.timestamp}] ${msg.role === 'user' ? 'You' : 'AI Assistant'}: ${msg.content}`)
      .join('\n\n');
    
    const blob = new Blob([chatText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wfh-chat-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Chat exported successfully');
  };

  const scrollToMessage = (messageId: string) => {
    const element = document.getElementById(`message-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('ring-2', 'ring-primary');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-primary');
      }, 2000);
    }
  };

  const getWallpaperStyle = () => {
    // ChatGPT-style clean light surface
    return {
      backgroundColor: CHAT_SURFACE,
    };
  };


  const handleSelectMode = () => {
    setIsSelectionMode(true);
    setSelectedMessages(new Set());
  };

  const handleCancelSelection = () => {
    setIsSelectionMode(false);
    setSelectedMessages(new Set());
  };

  const handleToggleMessage = (messageId: string) => {
    setSelectedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  // Auto-close selection mode when 0 messages selected
  useEffect(() => {
    if (isSelectionMode && selectedMessages.size === 0) {
      setIsSelectionMode(false);
    }
  }, [selectedMessages.size, isSelectionMode]);

  const handleDeleteSelected = () => {
    if (selectedMessages.size === 0) return;
    
    const messageIds = Array.from(selectedMessages);
    setMessages(prev => {
      const filtered = prev.filter(msg => !messageIds.includes(msg.id));
      chatStorage.saveMessages(filtered);
      return filtered;
    });
    
    toast.success(`Deleted ${selectedMessages.size} message(s)`);
    setIsSelectionMode(false);
    setSelectedMessages(new Set());
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // WhatsApp-style: Enter always inserts a new line, never sends.
    // Users must tap the Send button to send a message.
  };

  const COMPOSER_SINGLE_LINE_HEIGHT = 24;
  const COMPOSER_MAX_HEIGHT = 144; // ~6 lines at 24px line-height

  // ChatGPT-style auto-grow. Measurements are taken on a hidden mirror textarea
  // so the layout switch (inline row -> stacked) can never feed back into the
  // measurement and oscillate.
  // - inline width (text next to + / mic / send): decides when to expand
  // - full width (text on its own line above the icons): drives the height
  const COMPOSER_INLINE_CONTROLS_WIDTH = 104;
  const autoGrowInput = () => {
    const el = inputRef.current;
    const mirror = mirrorRef.current;
    if (!el) return;

    if (!input) {
      el.style.height = `${COMPOSER_SINGLE_LINE_HEIGHT}px`;
      el.style.overflowY = 'hidden';
      setComposerExpanded(false);
      return;
    }

    // Always trust the REAL textarea for the height it needs right now. Using a
    // mirror for this caused the height to stay at one line while the live text
    // had already wrapped, which hid the earlier characters.
    el.style.height = 'auto';
    const actualHeight = Math.max(el.scrollHeight, COMPOSER_SINGLE_LINE_HEIGHT);

    // The mirror is used only to decide the inline <-> stacked layout, i.e.
    // would the text still fit on one line if squeezed next to the icons?
    let fitsInline = actualHeight <= COMPOSER_SINGLE_LINE_HEIGHT + 6;
    if (mirror && composerExpanded) {
      mirror.value = input;
      mirror.style.width = `${Math.max(40, el.clientWidth - COMPOSER_INLINE_CONTROLS_WIDTH)}px`;
      mirror.style.height = 'auto';
      fitsInline = mirror.scrollHeight <= COMPOSER_SINGLE_LINE_HEIGHT + 6;
    }

    setComposerExpanded(!fitsInline);

    const contentHeight = Math.min(actualHeight, COMPOSER_MAX_HEIGHT);
    el.style.height = `${contentHeight}px`;
    if (actualHeight > COMPOSER_MAX_HEIGHT) {
      el.style.overflowY = 'auto';
      // Keep the latest typed line / cursor visible
      el.scrollTop = el.scrollHeight;
    } else {
      el.style.overflowY = 'hidden';
      el.scrollTop = 0;
    }
  };

  // Re-measure after the layout switches to full width. Without this second
  // pass, the textarea can remain one-line tall while its text has wrapped,
  // briefly hiding the previously typed characters.
  useLayoutEffect(() => {
    autoGrowInput();
  }, [input, composerExpanded]);

  const handleEmojiSelect = (emoji: string) => {
    setInput(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const handleCameraClick = () => {
    // The browser's native file chooser offers camera capture on supported phones.
    // This keeps the website build independent from the retired Capacitor runtime.
    photoInputRef.current?.click();
  };

  const startVoiceInput = async () => {
    // Check if user is logged in
    if (!currentUser) {
      handleLoginRequired('use voice input');
      return;
    }

    // Check voice input limit (double-check even though button is disabled)
    if (isVoiceInputLocked) {
      handleVoiceLocked();
      return;
    }

    try {
      voiceCancelledRef.current = false;
      setIsRecording(true);
      setShowVoiceOverlay(true);
      setVoiceStatus('listening');
      setVoiceTranscript('');

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setVoiceStream(stream); // Store for visualization
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        setVoiceStream(null); // Clear visualization stream
        mediaRecorderRef.current = null;

        if (voiceCancelledRef.current) {
          voiceCancelledRef.current = false;
          setIsRecording(false);
          setShowVoiceOverlay(false);
          return;
        }


        // Convert audio to base64
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          try {
            setVoiceStatus('processing');
            const base64Audio = (reader.result as string).split(',')[1];
            
            // Get current session for authentication
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              throw new Error('Please login to use voice input');
            }
            
            // Send to AI voice transcribe edge function (TRACKED for AI Chat only)
            // Supabase client automatically includes auth header
            const { data, error } = await supabase.functions.invoke('ai-voice-transcribe', {
              body: { audio: base64Audio }
            });

            if (error) throw error;

            if (data?.text) {
              console.log('Transcribed text:', data.text);
              console.log('Detected language:', data.detected_language);
              
              setVoiceTranscript(data.text);
              setVoiceStatus('complete');

              // Insert transcript into the composer instead of auto-sending.
              // Existing typed text is preserved — transcript is appended.
              const transcribed: string = String(data.text).trim();
              setInput(prev => {
                const base = prev.trimEnd();
                return base ? `${base} ${transcribed}` : transcribed;
              });
              setShowVoiceOverlay(false);
              setTimeout(() => inputRef.current?.focus(), 50);
            } else {
              throw new Error('No transcription received');
            }
          } catch (error) {
            console.error('Transcription error:', error);
            toast.error('Failed to transcribe. Please try again.');
            setShowVoiceOverlay(false);
          } finally {
            setIsRecording(false);
          }
        };

        reader.readAsDataURL(audioBlob);
      };

      // Start recording
      mediaRecorder.start();

      // Safety auto-stop (user can stop manually anytime)
      setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      }, 60000);

    } catch (error) {
      console.error('Voice input error:', error);
      setIsRecording(false);
      setShowVoiceOverlay(false);
      toast.error('Failed to access microphone');
    }
  };

  // Stop recording and transcribe (ChatGPT-style stop button)
  const stopVoiceInput = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === 'recording') rec.stop();
  };

  // Cancel recording without transcribing (X button)
  const cancelVoiceInput = () => {
    voiceCancelledRef.current = true;
    const rec = mediaRecorderRef.current;
    if (rec && rec.state === 'recording') {
      rec.stop();
    } else {
      if (voiceStream) {
        voiceStream.getTracks().forEach(t => t.stop());
        setVoiceStream(null);
      }
      setIsRecording(false);
      setShowVoiceOverlay(false);
    }
  };



  // Message selection is disabled — long press no longer selects messages.
  const handleMessageLongPress = (_messageId: string) => {
    longPressTriggered.current = true;
  };

  const isScrollingRef = useRef(false);

  // Listen for scroll events on the messages container to detect active scrolling
  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;
    let scrollTimeout: NodeJS.Timeout;
    const onScroll = () => {
      isScrollingRef.current = true;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => { isScrollingRef.current = false; }, 150);
      // Cancel any active long press during scroll
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => { container.removeEventListener('scroll', onScroll); clearTimeout(scrollTimeout); };
  }, []);

  const handleMessageTouchStart = (messageId: string, e?: React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
      // Ignore multi-finger gestures (e.g. 3-finger screenshot) — never enter selection
      if (e.touches.length > 1) {
        wasTouchMoved.current = true;
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        return;
      }
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    }
    wasTouchMoved.current = false;
    
    longPressTimer.current = setTimeout(() => {
      // Don't trigger if user is scrolling
      if (isScrollingRef.current || wasTouchMoved.current) return;
      // Vibrate if supported (mobile)
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      lightImpact();
      handleMessageLongPress(messageId);
    }, 600); // Slightly longer than WhatsApp to avoid scroll false positives
  };

  const handleMessageTouchMove = (e: React.TouchEvent) => {
    // Multi-touch gesture — cancel any pending long press
    if (e.touches.length > 1) {
      wasTouchMoved.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      return;
    }
    if (touchStartPos.current) {
      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartPos.current.x);
      const deltaY = Math.abs(touch.clientY - touchStartPos.current.y);
      // Cancel long press on even slight movement (5px threshold)
      if (deltaX > 5 || deltaY > 5) {
        wasTouchMoved.current = true;
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      }
    }
  };

  const handleMessageTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  };

  // Copy/share/speak should never leak the internal action blocks
  // (```ai-buttons``` / ```yt-update```) — only the text the user can read.
  const visibleText = (raw?: string) =>
    stripChatButtonsBlock(stripYtUpdateBlock(raw || '')).trim();

  // Last YouTube video id seen anywhere in this chat (list output, meta, link).
  // The SEO card needs it when the AI forgets the ```yt-update``` block.
  const chatVideoId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const id = findVideoId(messages[i]?.content || '');
      if (id) return id;
    }
    try {
      return localStorage.getItem('yt:lastVideoId') || '';
    } catch {
      return '';
    }
  }, [messages]);

  useEffect(() => {
    if (!chatVideoId) return;
    try {
      localStorage.setItem('yt:lastVideoId', chatVideoId);
    } catch {
      /* storage optional */
    }
  }, [chatVideoId]);

  // Latest SEO pack the AI proposed → "haan" bolte hi yahi YouTube par jayega.
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== 'assistant') continue;
      const raw = m.content || '';
      let pack = extractYtUpdate(raw);
      if (!pack) {
        const withoutBlock = stripYtUpdateBlock(raw);
        let fallbackId = '';
        for (let j = i; j >= 0 && !fallbackId; j--) {
          fallbackId = findVideoId(messages[j]?.content || '');
        }
        pack = extractYtUpdateLoose(withoutBlock, fallbackId || chatVideoId);
      }
      pendingYtUpdateRef.current = pack || null;
      return;
    }
    pendingYtUpdateRef.current = null;
  }, [messages, chatVideoId]);


  const handleCopySelected = () => {
    const selectedContent = Array.from(selectedMessages)
      .map(msgId => {
        const msg = messages.find(m => m.id === msgId);
        if (!msg) return '';
        return visibleText(msg.content);
      })
      .filter(text => text)
      .join('\n\n');
    
    navigator.clipboard.writeText(selectedContent);
    toast.success(`Copied ${selectedMessages.size} message${selectedMessages.size > 1 ? 's' : ''}`);
    setIsSelectionMode(false);
    setSelectedMessages(new Set());
  };


  const handleMessageDoubleClick = (messageId: string) => {
    if (isSelectionMode) return;
    
    chatStorage.toggleStarMessage(messageId);
    setMessages(prev => {
      const updated = prev.map(msg => 
        msg.id === messageId ? { ...msg, starred: !msg.starred } : msg
      );
      return updated;
    });
    
    const message = messages.find(m => m.id === messageId);
    if (message?.starred === false || !message?.starred) {
      toast.success('Message starred');
    } else {
      toast.success('Message unstarred');
    }
  };

  const handleCopyMessage = (message: Message) => {
    const text = visibleText(message.content);
    if (!text) {
      toast.error('Nothing to copy');
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Message copied');
    }).catch(() => {
      toast.error('Could not copy message');
    });
  };

  const handleShareMessage = async (message: Message) => {
    const text = visibleText(message.content);
    if (!text) {
      toast.error('Nothing to share');
      return;
    }


    const shareData = {
      title: 'Workly India AI Assistant',
      text: text.length > 500 ? text.slice(0, 500) + '...' : text,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('Message copied to share');
      }
    } catch (err) {
      // User cancelled or share failed — fallback to clipboard
      try {
        await navigator.clipboard.writeText(text);
        toast.success('Message copied to share');
      } catch {
        toast.error('Could not share message');
      }
    }
  };

  const handleMessageFeedback = (messageId: string, type: 'like' | 'dislike') => {
    setMessages(prev => {
      const updated = prev.map(msg => {
        if (msg.id !== messageId) return msg;
        // Toggle off if same feedback is tapped again
        const newFeedback = msg.feedback === type ? undefined : type;
        return { ...msg, feedback: newFeedback };
      });
      chatStorage.saveMessages(updated);
      return updated;
    });
    toast.success(type === 'like' ? 'Thanks for the feedback!' : 'Thanks, we\'ll improve.');
  };

  const handleReportMessage = (message: Message) => {
    toast.success('Report submitted', {
      description: 'Thanks for helping us improve responses.'
    });
  };

  const handleRegenerateMessage = async (message: Message) => {
    // Find the last user message before this assistant message to regenerate the response
    const messageIndex = messages.findIndex(m => m.id === message.id);
    if (messageIndex === -1) return;

    let targetUserMessage: Message | null = null;
    for (let i = messageIndex - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && !messages[i].isProgress && !messages[i].isError) {
        targetUserMessage = messages[i];
        break;
      }
    }

    if (!targetUserMessage) {
      toast.error('No user message found to regenerate response');
      return;
    }

    // Remove the assistant message being regenerated and any later assistant messages
    const trimmedMessages = messages.slice(0, messageIndex);
    setMessages(trimmedMessages);
    chatStorage.saveMessages(trimmedMessages);

    // Re-send the user message
    sendMessage({
      text: targetUserMessage.content,
      imageUrls: targetUserMessage.imageUrls || [],
      attachedFiles: targetUserMessage.attachedFiles || [],
    });
  };

  const handleMessageClick = (messageId: string) => {
    // Ignore the click that immediately follows a long press so the message
    // isn't accidentally deselected or starred.
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }

    // Normal click never selects/deselects messages — only long press does.
    // Double-click for star (only when not in selection mode)
    if (isSelectionMode) return;

    clickCount.current += 1;

    if (clickCount.current === 1) {
      clickTimer.current = setTimeout(() => {
        clickCount.current = 0;
      }, 300);
    } else if (clickCount.current === 2) {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
      clickCount.current = 0;
      handleMessageDoubleClick(messageId);
    }
  };

  const handlePlayMessage = async (message: Message) => {
    // Check if user is logged in
    if (!currentUser) {
      handleLoginRequired('use voice playback');
      return;
    }

    // Check voice playback limit before playing
    if (subscriptionStatus && getRemainingUsage) {
      const remaining = getRemainingUsage();
      if (remaining.voicePlayback <= 0) {
        toast.error('🔊 Voice Playback Limit Reached', {
          description: 'Your voice playback limit has been exhausted. Please upgrade your plan to continue.',
          duration: 3000,
        });
        setTimeout(() => {
          navigate('/ai-assistant/subscription');
        }, 2000);
        return;
      }
    }

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // If clicking the same message that's playing, stop it
    if (playingMessageId === message.id) {
      setPlayingMessageId(null);
      setLoadingVoiceId(null);
      return;
    }

    lightImpact();
    setLoadingVoiceId(message.id);
    
    try {
      // Check cache first
      const cachedAudio = getCachedAudio(message.content);
      
      let audioContent: string;
      
      if (cachedAudio) {
        // Use cached audio
        audioContent = cachedAudio;
        console.log('🎵 Using cached TTS audio');
      } else {
        // Try Cartesia first
        try {
          const { data, error } = await supabase.functions.invoke('unified-voice', {
            body: { action: 'text-to-speech', text: message.content, provider: 'cartesia' }
          });

          if (error) {
            // Handle specific error types
            if (error.message?.includes('login') || error.message?.includes('session expired') || error.message?.includes('Authentication required')) {
              setLoadingVoiceId(null);
              toast.error('Session Expired - Please login again', {
                duration: 5000,
                action: {
                  label: 'Login',
                  onClick: () => navigate('/auth?redirect=/ai-assistant')
                }
              });
              return;
            }
            
            // Handle limit errors with redirect
            if (error.message?.includes('limit') || error.message?.includes('exhausted')) {
              setLoadingVoiceId(null);
              toast.error('🔊 Voice Playback Limit Reached', {
                description: 'Your voice playback limit has been exhausted. Redirecting to subscription page...',
                duration: 2000,
              });
              setTimeout(() => {
                navigate('/ai-assistant/subscription');
              }, 2000);
              return;
            }
            
            throw error;
          }

          audioContent = data.audioContent;
          console.log('✅ Cartesia voice generated');
        } catch (cartesiaError) {
          console.warn('⚠️ Cartesia failed, falling back to ElevenLabs:', cartesiaError);
          
          // Fallback to ElevenLabs (MiniMax)
          const { data, error } = await supabase.functions.invoke('unified-voice', {
            body: { action: 'text-to-speech', text: message.content, provider: 'minimax' }
          });

          if (error) throw error;

          audioContent = data.audioContent;
          console.log('✅ ElevenLabs fallback voice generated');
        }
        
        // Save to cache for future use
        setCachedAudio(message.content, audioContent);
      }

      // Create and play audio
      const audio = new Audio(`data:audio/mp3;base64,${audioContent}`);
      audioRef.current = audio;
      
      setLoadingVoiceId(null);
      setPlayingMessageId(message.id);
      
      audio.onended = () => {
        setPlayingMessageId(null);
        audioRef.current = null;
      };
      
      audio.onerror = () => {
        setPlayingMessageId(null);
        setLoadingVoiceId(null);
        audioRef.current = null;
        toast.error('Audio playback failed', {
          description: 'Browser audio decode nahi kar paya. Dobara try karein.',
          duration: 5000,
          action: {
            label: 'Retry',
            onClick: () => handlePlayMessage(message),
          },
        });
      };
      
      await audio.play();
      successHaptic();
    } catch (error: any) {
      console.error('Error playing message:', error);
      const errorMsg = error?.message || 'Voice playback failed';

      // Show real reason from the server + a Retry action so the user isn't
      // stuck on a generic "Voice playback failed" message.
      const lower = errorMsg.toLowerCase();
      let title = 'Voice playback failed';
      let description = errorMsg;

      if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
        title = 'Network error';
        description = 'Internet connection check karke dobara try karein.';
      } else if (lower.includes('cartesia') || lower.includes('minimax') || lower.includes('elevenlabs')) {
        title = 'Voice service busy';
        description = 'Voice provider abhi respond nahi kar raha. Thodi der me try karein.';
      } else if (lower.includes('api key') || lower.includes('not configured')) {
        title = 'Voice service unavailable';
        description = 'Admin ko voice API key configure karni hai.';
      } else if (lower.includes('limit') || lower.includes('exhausted')) {
        title = '🔊 Voice limit reached';
        description = 'Aapka voice playback limit khatam ho gaya hai.';
      }

      toast.error(title, {
        description,
        duration: 6000,
        action: {
          label: 'Retry',
          onClick: () => handlePlayMessage(message),
        },
      });

      setPlayingMessageId(null);
      setLoadingVoiceId(null);
      audioRef.current = null;
    }
  };

  const commonEmojis = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '✨', '💯', '🙏', '👏', '😍', '🤔', '😅', '💪', '🎊', '🌟'];

  // While the session check is in progress, show a blank screen so the chat
  // never flashes before the login redirect.
  if (!authChecked) {
    return <div className="min-h-screen bg-white dark:bg-background" aria-hidden="true" />;
  }

  // Guests see the introduction; the actual chat remains session-only.
  if (!currentUser) {
    return <AIChatLanding />;
  }

  return (
    <div
      className="fixed left-0 right-0 overflow-hidden"
      style={{
        top: viewport.offsetTop,
        height: viewport.height ? `${viewport.height}px` : '100%',
      }}
    >
      {searchParams.has('code') && <YouTubeOAuthBridge />}
      <div 
        className="flex flex-col h-full safe-top relative"
        style={{
          ...getWallpaperStyle(),
          backgroundAttachment: 'fixed'
        }}
      >
      {/* ChatGPT-style Header — transparent, only floating icon buttons */}
      <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
        <div className="flex items-center gap-0 px-3 py-1.5 safe-top [&>*]:pointer-events-auto">

          <Button variant="ghost" size="icon" aria-label="Go back" title="Go back" className="h-9 w-9 shrink-0 rounded-full bg-background/85 text-foreground backdrop-blur-xl" onClick={() => navigate(isDeveloper ? '/developers' : isEmployer ? '/employer-portal' : '/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <>
              <></>
              <div className="flex-1 min-w-0 flex items-center gap-2 pl-1">
                {!currentUser && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => navigate('/auth?redirect=/ai-assistant')}
                      className="inline-flex items-center h-8 rounded-full px-4 text-[13px] font-semibold bg-[#0A84FF] text-white hover:bg-[#0a76e0] shadow-sm transition-colors"
                    >
                      Log in
                    </button>
                  </div>
                )}

                {currentUser && usageHeader && (

                  <button
                    type="button"
                    onClick={() => navigate('/ai-assistant/subscription')}
                    className={cn(
                      "inline-flex items-center gap-1.5 h-8 rounded-full px-3 text-[13px] font-medium transition-colors",
                      usageHeader.limitReached
                        ? "bg-[#0A84FF] text-white hover:bg-[#0a76e0] shadow-sm"
                        : "bg-black/5 text-gray-700 hover:bg-black/10"
                    )}
                  >
                    {usageHeader.limitReached ? (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Upgrade Plan
                      </>
                    ) : (
                      <>
                        <Zap className="h-3.5 w-3.5 text-[#0A84FF]" />
                        {usageHeader.label}
                      </>
                    )}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-0.5 shrink-0 rounded-full bg-white/85 backdrop-blur-xl shadow-sm px-1 py-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    if (!currentUser) { handleLoginRequired('use AI Connect'); return; }
                    navigate('/ai-assistant/connect');
                  }}
                  aria-label="AI Connect"
                  className="shrink-0 hover:bg-black/5 h-9 w-9"
                >
                  <Link2 className="h-5 w-5 text-[#0A84FF]" />
                </Button>
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/owner-portal')}
                    aria-label="Owner Portal"
                    className="shrink-0 hover:bg-black/5 h-9 w-9"
                  >
                    <Crown className="h-5 w-5 text-amber-500" />
                  </Button>
                )}
                {!currentUser ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleLoginRequired('use chat options')}
                    aria-label="More options"
                    className="shrink-0 text-gray-700 hover:bg-black/5 h-8 w-8"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </Button>
                ) : (
                  <MessageContextMenu
                    onProfile={() => navigate('/ai-assistant/profile')}

                    onClearAll={handleClearAll}
                    onSearch={() => navigate('/ai-assistant/search')}
                    onViewMedia={() => navigate('/ai-assistant/media')}
                    onStarred={() => navigate('/ai-assistant/starred')}
                    onExport={handleExportChat}
                    onInfo={() => navigate('/ai-assistant/info')}
                    triggerClassName="shrink-0 text-gray-700 hover:bg-black/5 h-8 w-8"
                    messageCount={messages.length}
                  />
                )}

              </div>
            </>
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 min-h-0 px-3 pt-14 space-y-4 pb-28 relative overflow-y-auto overscroll-contain"
        style={getWallpaperStyle()}
      >
        <div className="relative z-10 max-w-4xl mx-auto">
          <UsageAlertBanner />
          <SubscriptionExpiryBanner />
        </div>
        {messages.length === 0 && (
          <div className="text-center mt-6 pt-2 relative z-10">
            <div className="mb-4 flex justify-center">
              <LottieProfileIcon size={72} />
            </div>
            <p className="text-2xl font-semibold mb-2 text-gray-900 chatgpt-prose">Welcome To ChatWork!</p>
          </div>
        )}

        
        {messages.filter((m) => !m.hidden).map((message) => (
          <div
            key={message.id}
            id={`message-${message.id}`}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-200 group relative z-10 transition-all`}
            onClick={() => handleMessageClick(message.id)}
            onTouchStart={(e) => handleMessageTouchStart(message.id, e)}
            onTouchMove={handleMessageTouchMove}
            onTouchEnd={handleMessageTouchEnd}
            style={{
              WebkitUserSelect: 'text',
              userSelect: 'text',
              WebkitTouchCallout: 'default',
            } as React.CSSProperties}
          >
            {(() => {
              const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{11})/g;
              const textYtIds = [...(message.content.matchAll(ytRegex))].map(m => m[1]);
              const shortsIds = new Set(
                [...(message.content.matchAll(/youtube\.com\/shorts\/([\w-]{11})/g))].map(m => m[1])
              );
              const imgYtIds = (message.imageUrls || [])
                .map(url => url.match(/img\.youtube\.com\/vi\/([\w-]{11})/))
                .filter(Boolean)
                .map(m => m![1]);
              const textIdSet = new Set(textYtIds);
              // Videos that appear ONLY as thumbnails (no link in the text) render below the bubble.
              // Links inside the text stay in place and are embedded inline right after their line,
              // so each numbered item shows its own player.
              const allYtIds = [...new Set(imgYtIds.filter((id) => !textIdSet.has(id)))];
              const cleanedContent = stripMetaStatusLeak(message.content);
              
              return (
            <div className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'} w-full max-w-full`}>
              <div
                className={`relative transition-all ${
                  message.role === 'user'
                    ? 'inline-block w-auto max-w-[85%] sm:max-w-[70%] rounded-3xl bg-[#F0F0F0] text-gray-900 px-4 py-2.5'
                    : 'block w-full max-w-full chatgpt-prose text-gray-900'
                } ${message.isProgress ? 'italic opacity-70 text-gray-500 text-sm' : ''} ${
                  ''
                }`}
              
              >
              {/* Non-YouTube images */}
              {message.imageUrls && message.imageUrls.length > 0 && (() => {
                const nonYtImages = message.imageUrls.filter(url => !url.match(/img\.youtube\.com\/vi\//));
                if (nonYtImages.length === 0) return null;
                return (
                  <div className={`${nonYtImages.length === 1 ? '' : 'grid grid-cols-2 gap-1'} mb-2`}>
                    {nonYtImages.map((url, i) => (
                      <img loading="lazy" decoding="async" 
                        key={i}
                        src={url} 
                        alt={`Uploaded ${i + 1}`} 
                        className="rounded-lg w-full h-auto max-h-60 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewingImage(url);
                        }}
                      />
                    ))}
                  </div>
                );
              })()}
              {/* Attached documents */}
              {message.attachedFiles && message.attachedFiles.length > 0 && (
                <div className="mb-2 space-y-1">
                  {message.attachedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-black/10 rounded-lg px-3 py-2">
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Extract & render AI-generated images and files (robust parser) */}
              {(() => {
                const IMG_EXT = ['png','jpg','jpeg','webp','gif','svg','bmp','avif'];
                const FILE_EXT = ['pdf','html','htm','csv','json','txt','md','py','js','ts','java','css','xml','yaml','yml','sql','sh','docx','doc','xlsx','xls','pptx','ppt','zip'];

                const getExt = (rawUrl: string): string => {
                  try {
                    const u = new URL(rawUrl, window.location.origin);
                    const path = u.pathname;
                    const m = path.match(/\.([a-zA-Z0-9]{2,5})$/);
                    return (m?.[1] || '').toLowerCase();
                  } catch {
                    const m = rawUrl.split('?')[0].match(/\.([a-zA-Z0-9]{2,5})$/);
                    return (m?.[1] || '').toLowerCase();
                  }
                };

                const seen = new Set<string>();
                const images: { url: string; label: string }[] = [];
                const files: { url: string; label: string; ext: string }[] = [];
                let stripped = cleanedContent;

                // YouTube SEO action block (```yt-update {...}```) — sirf hataya
                // jata hai, koi card nahi (update chat approval se hota hai).
                if (message.role === 'assistant') {
                  stripped = stripYtUpdateBlock(stripped);
                }



                // AI-authored custom buttons (```ai-buttons [...]```)
                const aiButtons = message.role === 'assistant' ? extractChatButtons(stripped) : null;
                // Always strip the marker block — even if the JSON was broken —
                // so a raw "ai-buttons" code block never shows up in chat.
                if (message.role === 'assistant') stripped = stripChatButtonsBlock(stripped);


                // 1) Markdown image: ![alt](url)
                const mdImg = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
                stripped = stripped.replace(mdImg, (full, alt, url) => {
                  const ext = getExt(url);
                  if (IMG_EXT.includes(ext) || /\/(image|images|img|photo)\//i.test(url)) {
                    if (!seen.has(url)) { seen.add(url); images.push({ url, label: alt || 'Image' }); }
                    return '';
                  }
                  return full;
                });

                // 2) Markdown link: [label](url) — classify by extension.
                // Signed / proxied URLs often have no extension, so the label
                // filename ("📄 Paytm_Statement.pdf") is used as a fallback.
                const labelExt = (raw: string): string => {
                  const m = raw.trim().match(/([\w\-. ]+)\.([a-zA-Z0-9]{2,5})\b\s*$/) ||
                    raw.trim().match(/\.([a-zA-Z0-9]{2,5})\b/);
                  return (m?.[2] || m?.[1] || '').toLowerCase();
                };
                const mdLink = /\[([^\]]+?)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
                stripped = stripped.replace(mdLink, (full, label, url) => {
                  const cleanLabel = String(label).replace(/^[📥📄📎🖼️]\s*/u, '').replace(/^(?:Download\s*)?/i, '').trim();
                  // A label that is just a domain/URL (e.g. "worklyindia.devs.surf")
                  // must never be read as a filename — job links are plain links.
                  const labelIsDomainOrUrl =
                    /^(https?:\/\/|www\.)/i.test(cleanLabel) ||
                    /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(cleanLabel);
                  const rawLabelExt = labelIsDomainOrUrl ? '' : labelExt(cleanLabel);
                  const knownLabelExt =
                    FILE_EXT.includes(rawLabelExt) || IMG_EXT.includes(rawLabelExt) ? rawLabelExt : '';
                  const ext = getExt(url) || knownLabelExt;
                  if (IMG_EXT.includes(ext)) {
                    if (!seen.has(url)) { seen.add(url); images.push({ url, label: cleanLabel }); }
                    return '';
                  }
                  // Only a known file extension becomes a download card.
                  if (FILE_EXT.includes(ext)) {
                    const nameMatch = labelIsDomainOrUrl ? null : cleanLabel.match(/[\w\-. ()]+\.[a-zA-Z0-9]{2,5}/);
                    const fname = nameMatch ? nameMatch[0].trim() : `${cleanLabel || 'file'}.${ext}`;
                    if (!seen.has(url)) { seen.add(url); files.push({ url, label: fname, ext }); }
                    return '';
                  }
                  return full;

                });


                // 3) Bare URLs (http/https) ending in known extension
                const bareUrl = /(https?:\/\/[^\s<>"')]+)/g;
                stripped = stripped.replace(bareUrl, (full, url) => {
                  if (seen.has(url)) return '';
                  const ext = getExt(url);
                  if (IMG_EXT.includes(ext)) {
                    seen.add(url); images.push({ url, label: 'Image' });
                    return '';
                  }
                  if (FILE_EXT.includes(ext)) {
                    seen.add(url);
                    const nameFromUrl = url.split('/').pop()?.split('?')[0] || `file.${ext}`;
                    files.push({ url, label: nameFromUrl, ext });
                    return '';
                  }
                  return full;
                });

                // Removing a file/image link can leave an empty list item ("1.")
                // or an empty quote line — drop those so the text stays clean.
                stripped = stripped
                  .split('\n')
                  .filter((line) => !/^\s*(?:[-*+]|\d+[.)])\s*$/.test(line))
                  .filter((line) => !/^\s*>\s*$/.test(line))
                  .join('\n');
                stripped = stripped.replace(/\n{3,}/g, '\n\n').trim();


                return (
                  <>
                    {images.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {images.map((img, i) => (
                          <div key={`img-${i}`} className="relative group w-fit max-w-full rounded-lg overflow-hidden bg-transparent">
                            <img
                              src={img.url}
                              alt={img.label}
                              loading="lazy"
                              className="block w-auto max-w-full max-h-[70vh] object-contain cursor-pointer bg-transparent"
                              onClick={(e) => { e.stopPropagation(); setViewingImage(img.url); }}
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                            />

                            <div className="absolute bottom-2 right-2 flex items-center gap-2">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    const resp = await fetch(img.url);
                                    const blob = await resp.blob();
                                    const dataUrl = await new Promise<string>((resolve, reject) => {
                                      const reader = new FileReader();
                                      reader.onloadend = () => resolve(reader.result as string);
                                      reader.onerror = reject;
                                      reader.readAsDataURL(blob);
                                    });
                                    const compressed = await compressImage(dataUrl, 800, 0.75);
                                    setSelectedImages(prev => prev.includes(compressed) ? prev : [...prev, compressed]);
                                    toast.success('Image edit ke liye ready hai — kya change karna hai likho');
                                    setTimeout(() => inputRef.current?.focus(), 100);
                                  } catch {
                                    toast.error('Image load nahi ho payi, dobara try karo');
                                  }
                                }}
                                className="h-10 w-10 rounded-full bg-primary flex items-center justify-center opacity-100 hover:opacity-90 active:scale-95 transition-all shadow-xl ring-2 ring-white"
                                title="Edit this image"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
                              </button>

                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const ext = getExt(img.url) || 'png';
                                  const ok = await forceDownloadFile(img.url, `ai-image-${Date.now()}.${ext}`);
                                  if (!ok) {
                                    toast.error('Image download nahi ho paya', {
                                      description: 'AI se image dobara maangiye aur phir retry karein.',
                                    });
                                  }
                                }}

                                className="h-10 w-10 rounded-full bg-[#25D366] flex items-center justify-center opacity-100 hover:bg-[#1ebe5d] active:scale-95 transition-all shadow-xl ring-2 ring-white"
                                title="Download image"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" className="text-white"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              </button>
                            </div>

                          </div>
                        ))}
                      </div>
                    )}
                    {files.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {files.map((f, i) => (
                          <ChatFilePreview
                            key={`file-${i}`}
                            fileName={f.label}
                            url={f.url}
                            isOutgoing={message.role === 'user'}
                          />
                        ))}
                      </div>
                    )}
                    {stripped && (
                      <div className="text-sm leading-relaxed mb-1">
                        {(() => {
                          if (message.role !== 'assistant') {
                            // User ka bheja hua YouTube link plain link hi rahega —
                            // sirf AI ke reply me player banta hai.
                            return renderTextWithLinks(stripped, { embedVideos: false });
                          }
                          const opts = extractOptions(stripped);
                          const textOnly = stripOptionsFromContent(stripped, opts);
                          return (
                            <>
                              {textOnly && (
                                <RevealText
                                  text={textOnly}
                                  messageId={String(message.id)}
                                  animate={liveReplyIdsRef.current.has(String(message.id))}
                                  render={(partial) => renderTextWithLinks(partial)}
                                />
                              )}

                              {opts.length > 0 && (
                                <ChatOptionChips
                                  content={stripped}
                                  disabled={sendInFlightRef.current}
                                  onSelect={(label) => {
                                    setInput('');
                                    sendMessage({
                                      text: label,
                                      imageUrls: [],
                                      attachedFiles: [],
                                      hidden: true,
                                    });
                                  }}
                                />
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                    {/* YouTube SEO update card hidden by design — AI chat me
                        permission maangti hai aur "haan" par turant update. */}

                    {aiButtons && (
                      <ChatActionButtons
                        buttons={aiButtons}
                        onSend={(text) =>
                          sendMessage({ text, imageUrls: [], attachedFiles: [], hidden: false })
                        }
                      />
                    )}
                  </>
                );
              })()}
              <div className={`flex items-center gap-1 text-[10px] text-gray-400 ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                {message.starred && (
                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-1" />
                )}
                {message.role === 'assistant' && <span>{message.timestamp}</span>}

                {message.role === 'user' && message.status === 'failed' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRetryMessage(message);
                    }}
                    className="ml-1 flex items-center gap-0.5 text-[10px] text-red-500 hover:text-red-700 active:scale-95 transition-all"
                    title="Tap to retry"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
                    <span>Retry</span>
                  </button>
                )}
              </div>

              {/* Assistant message actions */}
              {message.role === 'assistant' && !message.isProgress && !message.isError && (
                <AssistantMessageActions
                  messageId={message.id}
                  content={message.content}
                  feedback={message.feedback}
                  isPlaying={playingMessageId === message.id}
                  isLoadingVoice={loadingVoiceId === message.id}
                  voiceRemaining={subscriptionStatus && getRemainingUsage ? getRemainingUsage().voicePlayback : undefined}
                  onCopy={() => handleCopyMessage(message)}
                  onShare={() => handleShareMessage(message)}
                  onTranslate={() => {
                    if (!currentUser) { handleLoginRequired('translate messages'); return; }
                    setSelectedMessages(new Set([message.id]));
                    setShowTranslateDialog(true);
                  }}
                  onSpeak={() => {
                    const remaining = subscriptionStatus && getRemainingUsage ? getRemainingUsage().voicePlayback : 1;
                    if (remaining <= 0) {
                      handleVoicePlaybackLocked();
                    } else {
                      handlePlayMessage(message);
                    }
                  }}
                  onFeedback={(type) => handleMessageFeedback(message.id, type)}
                  onRegenerate={() => handleRegenerateMessage(message)}
                  onReport={() => handleReportMessage(message)}
                />
              )}
            </div>
              {/* YouTube embed - below the message bubble */}
              {message.role === 'assistant' && allYtIds.length > 0 && (
                <div className="w-full mt-1 space-y-2">
                  {allYtIds.map((id, i) => {
                    const isShort = shortsIds.has(id);
                    return (
                      <div
                        key={i}
                        className="relative overflow-hidden rounded-lg shadow-sm bg-black"
                        style={isShort
                          ? { aspectRatio: '9/16', width: '100%', maxWidth: 240 }
                          : { aspectRatio: '16/9', width: '100%' }}
                      >
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${id}?modestbranding=1&rel=0&playsinline=1`}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                          title="YouTube video"
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
              );
            })()}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex items-start">
            <div className="flex-1">
              <AIGenerationIndicator 
                type={imageGenerating ? 'image' : generationIntent} 
                assistantName={settingsLoading ? 'Assistant' : chatSettings.name}
                statusText={imageGenerating ? 'Creating image' : 'Working on your request...'}
                steps={statusSteps}
                fallbackText={getWorkingStatus(statusLangRef.current)}
                phase={taskStatus.phase}
                progress={taskStatus.progress}
                debugPayload={{ run_id: taskStatus.runId }}
              />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Full Screen Image Viewer */}
      {viewingImage && (
        <div 
          className="fixed inset-0 bg-black/95 z-[200] flex items-center justify-center p-4"
          onClick={() => setViewingImage(null)}
        >
          <Button
            onClick={() => setViewingImage(null)}
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4 text-white hover:bg-white/10"
          >
            <X className="h-6 w-6" />
          </Button>
          <img loading="lazy" decoding="async" 
            src={viewingImage} 
            alt="Full screen view"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* ChatGPT-style floating composer — transparent, chat scrolls behind it */}
      <div className="absolute bottom-0 left-0 right-0 shrink-0 px-3 pt-3 pb-0 z-20 bg-transparent pointer-events-none [&_*]:pointer-events-auto">
        {(selectedImages.length > 0 || selectedFiles.length > 0) && (
          <>
            <div className="flex justify-between items-center mb-1 px-1">
              <span className="text-xs text-gray-600 font-medium">
                {selectedImages.length > 0 && `${selectedImages.length}/5 images`}
                {selectedImages.length > 0 && selectedFiles.length > 0 && ' · '}
                {selectedFiles.length > 0 && `${selectedFiles.length}/3 docs`}
              </span>
              {isProcessingImages && (
                <span className="text-xs text-gray-500">Processing...</span>
              )}
            </div>
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1 pt-3 pr-3">
            {selectedImages.map((img, index) => (
              <div key={`img-${index}`} className="relative shrink-0">
                <img loading="lazy" decoding="async" 
                  src={img} 
                  alt={`Selected ${index + 1}`} 
                  className="rounded-lg h-20 w-20 object-cover shadow-md cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setViewingImage(img)}
                />
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSelectedImage(index);
                  }}
                  size="icon"
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full shadow-lg p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {selectedFiles.map((file, index) => (
              <div key={`doc-${index}`} className="relative shrink-0 w-20 h-20 rounded-lg bg-muted flex flex-col items-center justify-center shadow-md p-1">
                <FileText className="h-6 w-6 text-primary mb-1" />
                <span className="text-[10px] text-foreground text-center leading-tight line-clamp-2 px-0.5">{file.name}</span>
                <span className="text-[8px] text-muted-foreground">{(file.size / 1024).toFixed(0)}KB</span>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeSelectedFile(index);
                  }}
                  size="icon"
                  variant="destructive"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full shadow-lg p-0"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {isProcessingImages && (
              <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center shadow-md">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                </div>
              </div>
            )}
          </div>
          </>
        )}
        <div className="flex items-end gap-2 pb-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.txt,.csv,.json,.xml,.md,.doc,.docx,.html,.css,.js,.ts,.py,.java,.log,.yaml,.yml,.xls,.xlsx"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          {/* Photos only */}
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          {/* Documents only */}
          <input
            ref={docInputRef}
            type="file"
            accept=".pdf,.txt,.csv,.json,.xml,.md,.doc,.docx,.html,.css,.js,.ts,.py,.java,.log,.yaml,.yml,.xls,.xlsx"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* ChatGPT-style composer: single row when short, text-on-top once it wraps */}
          <div
            className={cn(
              "relative flex flex-1 flex-wrap items-center gap-0.5 bg-white rounded-[28px] px-2 py-1.5 border border-gray-300 shadow-[0_2px_10px_rgba(0,0,0,0.08)] transition-all duration-150",
              (composerExpanded || thinkHarder) && "rounded-[24px] px-3 py-2.5"
            )}
            onClick={(e) => {
              if (e.target !== e.currentTarget) return;
              if (!currentUser) {
                handleLoginRequired('send messages');
                return;
              }
              if (isMessagesLocked) {
                handleMessagesLocked();
                return;
              }
              inputRef.current?.focus();
            }}
          >
            {/* Emoji panel floats above the composer */}
            {showEmojiPicker && (
              <div className="absolute bottom-full left-0 mb-2 w-64 rounded-2xl border border-black/10 bg-white p-2 shadow-xl z-30">
                <div className="grid grid-cols-8 gap-1">
                  {commonEmojis.map((emoji, i) => (
                    <button
                      key={i}
                      onClick={() => handleEmojiSelect(emoji)}
                      className="text-2xl hover:bg-muted rounded p-1 transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Think harder chip */}
            {thinkHarder && (
              <div className="order-0 basis-full mb-1.5 flex">
                <button
                  type="button"
                  onClick={() => setThinkHarder(false)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                >
                  <Brain className="h-3.5 w-3.5" />
                  Think harder
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Hidden mirror used only for measuring text height */}
            <textarea
              ref={mirrorRef}
              aria-hidden
              tabIndex={-1}
              readOnly
              rows={1}
              className="pointer-events-none absolute left-0 top-0 -z-10 block h-6 resize-none overflow-hidden border-0 bg-transparent px-0 py-0 text-[15px] leading-6 opacity-0"
            />

            {/* While dictating, the text area is replaced by a rolling waveform */}
            {isRecording ? (
              <div className="order-2 flex flex-1 min-w-0 items-center">
                <ComposerWaveform stream={voiceStream} active={voiceStatus === 'listening'} />
              </div>
            ) : (
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              onClick={!currentUser ? () => handleLoginRequired('send messages') : (isMessagesLocked ? handleMessagesLocked : undefined)}
              placeholder={isMessagesLocked ? "Message limit reached - Tap to upgrade" : "Message..."}
              disabled={isLoading || isMessagesLocked}
              rows={1}
              className={cn(
                "block resize-none border-0 bg-transparent px-0 py-0 text-[15px] leading-6 placeholder:text-gray-400 focus:outline-none focus-visible:ring-0 shadow-none max-h-[144px] overflow-hidden overscroll-contain",
                (composerExpanded || thinkHarder)
                  ? "order-1 basis-full w-full mb-1"
                  : "order-2 flex-1 min-w-0"
              )}
            />
            )}

            {/* "+" menu (turns into Close while recording, ChatGPT-style) */}
            <div className={cn(
              "flex items-center gap-1",
              (composerExpanded || thinkHarder) ? "order-2" : "order-1"
            )}>
                {isRecording ? (
                  <button
                    type="button"
                    onClick={cancelVoiceInput}
                    aria-label="Cancel recording"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-gray-800 hover:bg-gray-100 transition-colors"
                  >
                    <X className="h-6 w-6" strokeWidth={2.2} />
                  </button>
                ) : (
                <Sheet open={showPlusMenu} onOpenChange={setShowPlusMenu}>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      aria-label="More options"
                      disabled={isLoading}
                      className="flex h-9 w-7 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 disabled:opacity-40 transition-colors"
                    >
                      <Plus className="h-6 w-6" strokeWidth={2} />
                    </button>
                  </SheetTrigger>
                  {/* Bottom sheet: opens upward from the bottom, unmounts fully on close */}
                  <SheetContent
                    side="bottom"
                    className="rounded-t-3xl border-0 bg-background px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 [&>button]:hidden"
                  >
                    <SheetTitle className="sr-only">Attach</SheetTitle>
                    <div className="flex items-center justify-center pb-1 pt-0">
                      <button
                        type="button"
                        onClick={() => setShowPlusMenu(false)}
                        aria-label="Close"
                        className="flex h-9 w-14 items-center justify-center rounded-full text-muted-foreground hover:bg-muted active:scale-95 transition-all"
                      >
                        <ChevronDown className="h-6 w-6" strokeWidth={2.4} />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3 px-2 pb-2">
                      {[
                        {
                          key: 'camera',
                          label: 'Camera',
                          icon: <Camera className="h-8 w-8 text-white drop-shadow" strokeWidth={1.9} />,
                          tile: 'bg-gradient-to-br from-pink-500 via-rose-500 to-orange-400',
                          onClick: () => {
                            if (!currentUser) { handleLoginRequired('use camera'); return; }
                            if (isImageLocked) { handleImageLocked(); return; }
                            handleCameraClick();
                          },
                        },
                        {
                          key: 'photos',
                          label: 'Photos',
                          icon: <ImageIcon className="h-8 w-8 text-white drop-shadow" strokeWidth={1.9} />,
                          tile: 'bg-gradient-to-br from-violet-500 via-purple-500 to-fuchsia-500',
                          onClick: () => {
                            if (!currentUser) { handleLoginRequired('upload photos'); return; }
                            if (isImageLocked) { handleImageLocked(); return; }
                            photoInputRef.current?.click();
                          },
                        },
                        {
                          key: 'files',
                          label: 'Files',
                          icon: <FileText className="h-8 w-8 text-white drop-shadow" strokeWidth={1.9} />,
                          tile: 'bg-gradient-to-br from-sky-500 via-blue-500 to-indigo-500',
                          onClick: () => {
                            if (!currentUser) { handleLoginRequired('upload files'); return; }
                            docInputRef.current?.click();
                          },
                        },
                      ].map(item => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => {
                            setShowPlusMenu(false);
                            item.onClick();
                          }}
                          className="flex flex-col items-center gap-2 rounded-2xl px-2 py-4 active:scale-95 transition-all"
                        >
                          <span className={`flex h-16 w-16 items-center justify-center rounded-[1.35rem] shadow-lg ring-1 ring-white/25 ${item.tile}`}>
                            {item.icon}
                          </span>
                          <span className="text-sm font-medium text-foreground">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </SheetContent>
                </Sheet>
                )}
              </div>

            <div className="order-3 ml-auto flex items-center gap-1">
                {isLoading ? (
                  /* ChatGPT-style stop button while the AI is replying */
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    aria-label="Stop response"
                    className="flex h-9 w-9 items-center justify-center rounded-full shadow-md bg-[#0A84FF] hover:bg-[#0a76e0] text-white transition-colors"
                  >
                    <span className="h-3.5 w-3.5 rounded-[3px] bg-white" />
                  </button>
                ) : (
                <>
                {/* Voice dictation / stop while recording */}
                {isRecording ? (
                  <button
                    type="button"
                    onClick={stopVoiceInput}
                    aria-label="Stop recording"
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 shadow-md transition-colors"
                  >
                    <span className="h-3.5 w-3.5 rounded-[3px] bg-white" />
                  </button>
                ) : (
                <button
                  type="button"
                  onClick={isVoiceInputLocked ? handleVoiceLocked : startVoiceInput}
                  disabled={isLoading}
                  aria-label="Voice input"
                  className="flex h-9 w-8 items-center justify-center rounded-full bg-transparent p-0 border-0 text-gray-800 disabled:opacity-50 hover:bg-gray-100 transition-colors"
                >
                  <Mic className="h-[22px] w-[22px]" strokeWidth={2} />
                </button>
                )}


                {/* Send when there is content or recording, else live voice mode */}
                {isRecording || input.trim() || selectedImages.length > 0 || selectedFiles.length > 0 ? (

                  <button
                    type="button"
                    onClick={() => (isRecording ? stopVoiceInput() : sendMessage())}
                    disabled={isLoading}
                    aria-label={isRecording ? 'Send voice message' : 'Send message'}

                    className="flex h-9 w-9 items-center justify-center rounded-full shadow-md bg-[#0A84FF] hover:bg-[#0a76e0] text-white disabled:opacity-40 transition-colors"
                  >
                    <ArrowUp className="h-[22px] w-[22px]" strokeWidth={2.5} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentUser) { handleLoginRequired('use voice mode'); return; }
                      navigate('/ai-voice-call');
                    }}
                    aria-label="Voice mode"
                    className="flex h-9 w-9 items-center justify-center rounded-full shadow-md bg-[#0A84FF] hover:bg-[#0a76e0] text-white transition-colors"
                  >
                    <AudioLines className="h-[22px] w-[22px]" strokeWidth={2.5} />
                  </button>

                )}
                </>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Support Profile Dialog */}
      <AISupportProfile open={showProfile} onOpenChange={setShowProfile} />

      {/* Confirm before stopping the AI response — prevents accidental taps */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent className="max-w-[340px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Stop this response?</AlertDialogTitle>
            <AlertDialogDescription>
              The assistant is still writing your answer. If you stop now, the reply
              will stay incomplete. You can send your message again anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="mt-0">Keep waiting</AlertDialogCancel>
            <AlertDialogAction
              onClick={cancelGeneration}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Yes, stop
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete chat confirmation */}
      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="max-w-[340px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>
              Saare messages is device se permanently delete ho jayenge. Ye action undo nahi ho sakta.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-2">
            <AlertDialogCancel className="mt-0">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <LoginRequiredSheet
        open={showLoginSheet}
        onOpenChange={setShowLoginSheet}
        feature={loginSheetFeature}
      />

      {/* Translation Dialog */}
      <TranslateDialog
        open={showTranslateDialog}
        onOpenChange={setShowTranslateDialog}
        messages={messages}
        selectedMessageIds={Array.from(selectedMessages)}
      />

      </div>
    </div>
  );
}
