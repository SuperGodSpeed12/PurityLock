/* Purity Lock Search Detection Utility */

export const SearchDetection = {
  KEYWORDS: null,

  async loadKeywords() {
    if (this.KEYWORDS) return;
    try {
      const response = await fetch(chrome.runtime.getURL('assets/search_keywords.json'));
      this.KEYWORDS = await response.json();
    } catch (e) {
      console.error('Failed to load search keywords', e);
      this.KEYWORDS = { explicit: [], soft: [] };
    }
  },

  detect(url) {
    try {
      const parsed = new URL(url);
      const queryParams = ['q', 'p', 'query', 'text', 'wd'];
      let query = '';

      for (const param of queryParams) {
        if (parsed.searchParams.has(param)) {
          query = parsed.searchParams.get(param).toLowerCase();
          break;
        }
      }

      if (!query) return null;

      const isExplicit = this.KEYWORDS.explicit.some(k => query.includes(k));
      const isSoft = this.KEYWORDS.soft.some(k => query.includes(k));

      if (isExplicit) return 'explicit';
      if (isSoft) return 'soft';
      
      return null;
    } catch (e) {
      return null;
    }
  }
};
