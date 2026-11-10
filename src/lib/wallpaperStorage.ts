interface WallpaperConfig {
  type: 'predefined' | 'custom';
  value: string; // predefined ID or custom image base64
}

const STORAGE_KEY = 'wfh-ai-chat-wallpaper';

export const wallpaperStorage = {
  saveWallpaper(config: WallpaperConfig): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save wallpaper:', error);
    }
  },

  loadWallpaper(): WallpaperConfig | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error('Failed to load wallpaper:', error);
      return null;
    }
  },

  clearWallpaper(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear wallpaper:', error);
    }
  }
};
