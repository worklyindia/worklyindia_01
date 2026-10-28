/**
 * Global Audio Manager
 * Controls all audio sources in the application to prevent conflicts
 * during YouTube video playback
 */

class GlobalAudioManager {
  private static instance: GlobalAudioManager;
  private isVideoPlaying = false;
  private activePlayerKey: string | null = null;
  private originalTidioSettings: any = null;
  private audioContext: AudioContext | null = null;

  private constructor() {
    this.initializeAudioContext();
  }

  static getInstance(): GlobalAudioManager {
    if (!GlobalAudioManager.instance) {
      GlobalAudioManager.instance = new GlobalAudioManager();
    }
    return GlobalAudioManager.instance;
  }

  private initializeAudioContext() {
    try {
      if (typeof window !== 'undefined' && 'AudioContext' in window) {
        this.audioContext = new AudioContext();
      }
    } catch (error) {
      console.warn('AudioContext not supported:', error);
    }
  }

  async requestAudioPermission(): Promise<boolean> {
    try {
      // Resume audio context on user interaction
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      return true;
    } catch (error) {
      console.error('Audio permission failed:', error);
      return false;
    }
  }

  onVideoPlay(playerKey = "legacy") {
    this.activePlayerKey = playerKey;
    if (this.isVideoPlaying) return;
    this.isVideoPlaying = true;
    this.muteExternalSounds();
  }

  onVideoStop(playerKey = "legacy") {
    // Stale iframe cleanup must not release the new player.
    if (this.activePlayerKey !== playerKey) return;
    this.activePlayerKey = null;
    this.isVideoPlaying = false;
    this.unmuteExternalSounds();
  }

  private muteExternalSounds() {
    // Mute Tidio chat notifications
    this.muteTidio();
    
    // Mute OneSignal notifications
    this.muteOneSignal();
    
    // Mute any playing audio elements
    this.muteAllAudioElements();
  }

  private unmuteExternalSounds() {
    // Unmute Tidio
    this.unmuteTidio();
    
    // Unmute OneSignal
    this.unmuteOneSignal();
  }

  private muteTidio() {
    try {
      if (typeof window !== 'undefined' && (window as any).tidioChatApi) {
        const tidio = (window as any).tidioChatApi;
        // Store original settings
        this.originalTidioSettings = {
          soundEnabled: tidio.soundEnabled
        };
        // Disable sounds
        if (tidio.setSoundEnabled) {
          tidio.setSoundEnabled(false);
        }
      }
      
      // Also mute Tidio audio elements directly
      const tidioAudios = document.querySelectorAll('audio[src*="tidio"], audio[src*="notification"]');
      tidioAudios.forEach((audio: any) => {
        audio.muted = true;
        audio.pause();
      });
    } catch (error) {
      console.warn('Failed to mute Tidio:', error);
    }
  }

  private unmuteTidio() {
    try {
      if (typeof window !== 'undefined' && (window as any).tidioChatApi) {
        const tidio = (window as any).tidioChatApi;
        if (tidio.setSoundEnabled && this.originalTidioSettings) {
          tidio.setSoundEnabled(this.originalTidioSettings.soundEnabled);
        }
      }
      
      // Unmute Tidio audio elements
      const tidioAudios = document.querySelectorAll('audio[src*="tidio"], audio[src*="notification"]');
      tidioAudios.forEach((audio: any) => {
        audio.muted = false;
      });
    } catch (error) {
      console.warn('Failed to unmute Tidio:', error);
    }
  }

  private muteOneSignal() {
    try {
      if (typeof window !== 'undefined' && (window as any).OneSignal) {
        // Temporarily disable notification sounds
        (window as any).OneSignal.Notifications?.setDefaultNotificationUrl?.(null);
      }
    } catch (error) {
      console.warn('Failed to mute OneSignal:', error);
    }
  }

  private unmuteOneSignal() {
    try {
      // OneSignal will resume normal operation
    } catch (error) {
      console.warn('Failed to unmute OneSignal:', error);
    }
  }

  private muteAllAudioElements() {
    try {
      // Mute all audio elements except those in YouTube iframes
      const audioElements = document.querySelectorAll('audio');
      audioElements.forEach((audio) => {
        // Skip if it's part of a YouTube player
        const parent = audio.closest('iframe');
        if (!parent || !parent.src.includes('youtube')) {
          audio.muted = true;
          audio.pause();
        }
      });
    } catch (error) {
      console.warn('Failed to mute audio elements:', error);
    }
  }

  isPlayingVideo(): boolean {
    return this.isVideoPlaying;
  }
}

export const audioManager = GlobalAudioManager.getInstance();
