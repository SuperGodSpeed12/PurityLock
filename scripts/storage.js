/* Purity Lock Storage Utility */

export const Storage = {
  // Default settings
  DEFAULTS: {
    theme: 'dark',
    accentHue: 217,
    highContrast: false,
    reducedMotion: false,
    fontSize: 100, // percentage
    whitelist: [],
    stats: {
      today: 0,
      total: 0,
      week: 0,
      hoursSaved: 0,
      lastDate: new Date().toDateString(),
      cleanStreakStart: Date.now(),
      longestStreak: 0
    },
    history: [],
    achievements: [],
    schedules: [],
    gracePeriod: 5, // seconds
    pinHash: null,
    customVerses: null,
    recoveryScore: 0,
    focusScore: 0,
    lastBlockedDomain: null,
    lastBlockedTime: null,
    
    // New Features
    defaultAllowedSite: "",
    searchMonitoringEnabled: true,
    searchEscalationLevel: 0,
    lastSearchWarningTime: 0,
    emergencyUnlockEnabled: true,
    emergencyUnlockDailyLimit: 1,
    emergencyUnlocksUsedToday: 0,
    strictMode: false,
    
    // Focus & Pomodoro
    pomodoro: {
      workTime: 25,
      breakTime: 5,
      longBreakTime: 15,
      cyclesBeforeLongBreak: 4,
      currentCycle: 0,
      autoStart: false
    },
    
    analytics: {
      daily: {}, // date -> { blocked: 0, focused: 0, searches: 0 }
      categories: {}, // category -> count
      focusDays: [] // array of dates
    }
  },

  async get(keys) {
    return await chrome.storage.local.get(keys);
  },

  async set(data) {
    await chrome.storage.local.set(data);
  },

  async updateStats(updateFn) {
    const data = await this.get('stats');
    const stats = data.stats || { ...this.DEFAULTS.stats };
    const today = new Date().toDateString();

    if (stats.lastDate !== today) {
      stats.today = 0;
      stats.lastDate = today;
      // Reset daily limits
      await this.set({ emergencyUnlocksUsedToday: 0 });
    }

    updateFn(stats);
    await this.set({ stats });
    return stats;
  },

  async addHistory(event) {
    const data = await this.get('history');
    const history = data.history || [];
    history.unshift({
      id: Date.now(),
      timestamp: Date.now(),
      ...event
    });
    // Keep last 1000 events
    await this.set({ history: history.slice(0, 1000) });
  },

  async init() {
    const data = await this.get(null);
    const updates = {};
    for (const key in this.DEFAULTS) {
      if (data[key] === undefined) {
        updates[key] = this.DEFAULTS[key];
      }
    }
    if (Object.keys(updates).length > 0) {
      await this.set(updates);
    }
  }
};
