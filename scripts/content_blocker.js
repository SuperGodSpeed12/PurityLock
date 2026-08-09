/* Purity Lock Search Suggestion Blocker */

const inappropriateKeywords = [
  "porn", "sex", "naked", "xxx", "nude", "erotic", "hentai", "milf", "bdsm"
];

function blockSuggestions() {
  const suggestions = document.querySelectorAll('li[role="presentation"], .sbct, .autocomplete-suggestion');
  
  suggestions.forEach(suggestion => {
    const text = suggestion.textContent.toLowerCase();
    if (inappropriateKeywords.some(k => text.includes(k))) {
      suggestion.style.display = 'none';
      console.log('[Purity Lock] Blocked inappropriate suggestion');
    }
  });
}

// Observe changes in the search box
const observer = new MutationObserver(blockSuggestions);
observer.observe(document.body, { childList: true, subtree: true });

// Initial run
blockSuggestions();
