/* Purity Lock Category Detection Utility */

export const CategoryDetection = {
  CATEGORIES: null,

  async load() {
    if (this.CATEGORIES) return;
    try {
      const response = await fetch(chrome.runtime.getURL('assets/categories.json'));
      this.CATEGORIES = await response.json();
    } catch (e) {
      console.error('Failed to load categories', e);
      this.CATEGORIES = {};
    }
  },

  getCategory(hostname) {
    if (!this.CATEGORIES) return 'other';
    const domain = hostname.replace(/^(?:www|m|mobile|amp)\./, "").toLowerCase();
    
    for (const [category, domains] of Object.entries(this.CATEGORIES)) {
      if (domains.some(d => domain === d || domain.endsWith('.' + d))) {
        return category;
      }
    }
    return 'other';
  }
};
