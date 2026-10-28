// Local Storage Management for Offline-First Features

export interface LocalApplication {
  id: string;
  jobId: string;
  title: string;
  company: string;
  location: string;
  appliedDate: string;
  status: string;
  statusColor: string;
  salary: string;
  notes?: string;
}

export interface LocalStorageData {
  applications: LocalApplication[];
  favorites: string[];
  lastSyncTimestamp: number | null;
  needsSync: boolean;
}

const STORAGE_KEY = 'wfh_india_local_data';
const MAX_APPLICATIONS = 50;
const MAX_FAVORITES = 100;

// Get all local data
export const getLocalData = (): LocalStorageData => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      return {
        applications: [],
        favorites: [],
        lastSyncTimestamp: null,
        needsSync: false
      };
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading local data:', error);
    return {
      applications: [],
      favorites: [],
      lastSyncTimestamp: null,
      needsSync: false
    };
  }
};

// Save data to local storage
const saveLocalData = (data: LocalStorageData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving local data:', error);
  }
};

// Save application to local storage
export const saveApplicationToLocal = (application: LocalApplication): boolean => {
  try {
    const data = getLocalData();
    
    // Check if already exists
    const exists = data.applications.some(app => app.jobId === application.jobId);
    if (exists) {
      return false;
    }
    
    // Check limit
    if (data.applications.length >= MAX_APPLICATIONS) {
      throw new Error(`Maximum limit of ${MAX_APPLICATIONS} applications reached`);
    }
    
    data.applications.unshift(application);
    data.needsSync = true;
    saveLocalData(data);
    return true;
  } catch (error) {
    console.error('Error saving application:', error);
    throw error;
  }
};

// Get all local applications
export const getLocalApplications = (): LocalApplication[] => {
  const data = getLocalData();
  return data.applications;
};

// Save favorite to local storage
export const saveFavoriteToLocal = (jobId: string): boolean => {
  try {
    const data = getLocalData();
    
    // Check if already exists
    if (data.favorites.includes(jobId)) {
      return false;
    }
    
    // Check limit
    if (data.favorites.length >= MAX_FAVORITES) {
      throw new Error(`Maximum limit of ${MAX_FAVORITES} favorites reached`);
    }
    
    data.favorites.unshift(jobId);
    data.needsSync = true;
    saveLocalData(data);
    return true;
  } catch (error) {
    console.error('Error saving favorite:', error);
    throw error;
  }
};

// Remove favorite from local storage
export const removeFavoriteFromLocal = (jobId: string): boolean => {
  try {
    const data = getLocalData();
    const index = data.favorites.indexOf(jobId);
    
    if (index === -1) {
      return false;
    }
    
    data.favorites.splice(index, 1);
    data.needsSync = true;
    saveLocalData(data);
    return true;
  } catch (error) {
    console.error('Error removing favorite:', error);
    throw error;
  }
};

// Get all local favorites
export const getLocalFavorites = (): string[] => {
  const data = getLocalData();
  return data.favorites;
};

// Toggle favorite in local storage
export const toggleFavoriteInLocal = (jobId: string): boolean => {
  const data = getLocalData();
  const isFavorited = data.favorites.includes(jobId);
  
  if (isFavorited) {
    return removeFavoriteFromLocal(jobId);
  } else {
    return saveFavoriteToLocal(jobId);
  }
};

// Check if needs sync
export const needsSync = (): boolean => {
  const data = getLocalData();
  return data.needsSync;
};

// Clear all local data
export const clearLocalData = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing local data:', error);
  }
};

// Mark as synced
export const markAsSynced = () => {
  const data = getLocalData();
  data.lastSyncTimestamp = Date.now();
  data.needsSync = false;
  saveLocalData(data);
};

// Get storage info
export const getStorageInfo = () => {
  const data = getLocalData();
  return {
    applicationsCount: data.applications.length,
    favoritesCount: data.favorites.length,
    maxApplications: MAX_APPLICATIONS,
    maxFavorites: MAX_FAVORITES,
    needsSync: data.needsSync,
    lastSyncTimestamp: data.lastSyncTimestamp
  };
};
