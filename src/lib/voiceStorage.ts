// Local storage for voice recordings
export interface VoiceRecording {
  id: string;
  blob: string; // base64 encoded
  duration: number;
  timestamp: string;
  sent: boolean;
}

const STORAGE_KEY = 'wfh_voice_recordings';

export const voiceStorage = {
  saveRecording: (recording: VoiceRecording): void => {
    try {
      const recordings = voiceStorage.getAllRecordings();
      recordings.push(recording);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(recordings));
    } catch (error) {
      console.error('Error saving recording:', error);
    }
  },

  getAllRecordings: (): VoiceRecording[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading recordings:', error);
      return [];
    }
  },

  deleteRecording: (id: string): void => {
    try {
      const recordings = voiceStorage.getAllRecordings();
      const filtered = recordings.filter(r => r.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting recording:', error);
    }
  },

  markAsSent: (id: string): void => {
    try {
      const recordings = voiceStorage.getAllRecordings();
      const updated = recordings.map(r => 
        r.id === id ? { ...r, sent: true } : r
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Error marking recording as sent:', error);
    }
  },

  clearAll: (): void => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing recordings:', error);
    }
  }
};
