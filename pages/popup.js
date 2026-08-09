// ---------------------------------------------------------------------------
// Purity Lock — popup.js
//
// Message types this file sends to background.js:
//   GET_STATE          (existing)  -> { theme, accentHue, stats:{streak,today,total},
//                                        isLocked, lockEndTime, lockStartedAt, isPaused }
//   TOGGLE_PAUSE        (new)      -> { isPaused }
//   GET_BLOCKLISTS      (new)      -> { lists: [{id,name}, ...] }
//   ADD_BLOCKED_SITE    (new)      -> { ok: true }      payload: { host, listId }
//   SET_BADGE_MODE      (new)      -> { ok: true }      payload: { mode }
//
// If background.js doesn't implement the "new" ones yet, every call below is
// wrapped so the popup still renders correctly with sensible fallbacks —
// nothing throws, it just quietly no-ops until you wire up the handlers.
// ---------------------------------------------------------------------------

function formatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function safeSendMessage(payload, callback) {
  try {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        callback(null);
        return;
      }
      callback(response || null);
    });
  } catch (e) {
    callback(null);
  }
}

// ---------------------------------------------------------------------------
// Status ring / stats
// ---------------------------------------------------------------------------

let lastKnownState = null;

function refresh() {
  safeSendMessage({ type: "GET_STATE" }, (state) => {
    if (!state) return;
    lastKnownState = state;

    document.body.setAttribute('data-theme', state.theme || 'dark');
    if (state.accentHue) {
      document.documentElement.style.setProperty('--accent-hue', state.accentHue);
    }

    document.getElementById('streak-val').textContent = state.stats?.streak || 0;
    document.getElementById('today-val').textContent = state.stats?.today || 0;
    document.getElementById('total-val').textContent = state.stats?.total || 0;

    const circle = document.getElementById('status-fg');
    const circumference = 2 * Math.PI * 60;
    const statusText = document.getElementById('status-text');
    const statusSub = document.getElementById('status-subtext');
    const dot = document.getElementById('status-dot');
    const detail = document.getElementById('status-detail');
    const tagline = document.getElementById('header-tagline');
    const pauseBtn = document.getElementById('toggle-pause');

    dot.classList.remove('dot-paused', 'dot-locked');

    if (state.isLocked && state.lockEndTime > Date.now()) {
      const remaining = state.lockEndTime - Date.now();
      const total = state.lockEndTime - state.lockStartedAt;
      const pct = total > 0 ? Math.min(1, (Date.now() - state.lockStartedAt) / total) : 0;

      statusText.textContent = formatTime(remaining);
      statusSub.textContent = "LOCKED";
      statusText.style.color = "var(--pl-error)";
      circle.style.stroke = "var(--pl-error)";
      circle.style.strokeDashoffset = circumference * pct;
      dot.classList.add('dot-locked');
      detail.textContent = "Focus session in progress";
      tagline.textContent = "Locked";
      pauseBtn.style.display = "none";
    } else if (state.isPaused) {
      statusText.textContent = "Paused";
      statusSub.textContent = "UNPROTECTED";
      statusText.style.color = "var(--pl-warning)";
      circle.style.stroke = "var(--pl-warning)";
      circle.style.strokeDashoffset = 0;
      dot.classList.add('dot-paused');
      detail.textContent = "Filters temporarily off";
      tagline.textContent = "Paused";
      pauseBtn.style.display = "flex";
      pauseBtn.classList.add('is-paused');
    } else {
      statusText.textContent = "Active";
      statusSub.textContent = "PROTECTED";
      statusText.style.color = "var(--pl-electric)";
      circle.style.stroke = "var(--pl-electric)";
      circle.style.strokeDashoffset = 0;
      dot.classList.remove('dot-paused');
      detail.textContent = "All filters running";
      tagline.textContent = "Shielded";
      pauseBtn.style.display = "flex";
      pauseBtn.classList.remove('is-paused');
    }
  });
}

document.getElementById('toggle-pause').addEventListener('click', () => {
  const willPause = !(lastKnownState && lastKnownState.isPaused);
  safeSendMessage({ type: "TOGGLE_PAUSE", paused: willPause }, () => {
    refresh();
  });
});

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

const tabsEl = document.getElementById('pl-tabs');
const panelOverview = document.getElementById('panel-overview');
const panelList = document.getElementById('panel-list');

tabsEl.querySelectorAll('.pl-tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    tabsEl.setAttribute('data-active', tab);
    panelOverview.classList.toggle('is-active', tab === 'overview');
    panelList.classList.toggle('is-active', tab === 'list');
    if (tab === 'list') loadBlockListPanel();
  });
});

// ---------------------------------------------------------------------------
// Block List panel (Cold Turkey style: current site + pick a list + add)
// ---------------------------------------------------------------------------

let blockListPanelLoaded = false;

function loadBlockListPanel() {
  // Current tab's domain
  try {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      const domainEl = document.getElementById('current-domain');
      const inputEl = document.getElementById('site-input');
      if (tab && tab.url) {
        try {
          const host = new URL(tab.url).hostname.replace(/^www\./, '');
          domainEl.textContent = host;
          if (!inputEl.value) inputEl.value = host;
        } catch (e) {
          domainEl.textContent = "This page can't be blocked";
        }
      } else {
        domainEl.textContent = "No active site";
      }
    });
  } catch (e) {
    document.getElementById('current-domain').textContent = "Unavailable";
  }

  if (blockListPanelLoaded) return;
  blockListPanelLoaded = true;

  // Populate custom lists if background provides them; otherwise keep defaults in HTML
  safeSendMessage({ type: "GET_BLOCKLISTS" }, (response) => {
    if (response && Array.isArray(response.lists) && response.lists.length) {
      const select = document.getElementById('list-select');
      select.innerHTML = '';
      response.lists.forEach((list) => {
        const opt = document.createElement('option');
        opt.value = list.id;
        opt.textContent = list.name;
        select.appendChild(opt);
      });
    }
  });

  // Restore saved badge preference
  safeSendMessage({ type: "GET_STATE" }, (state) => {
    if (state && state.badgeMode) {
      document.getElementById('badge-select').value = state.badgeMode;
    }
  });
}

document.getElementById('add-site-btn').addEventListener('click', () => {
  const btn = document.getElementById('add-site-btn');
  const host = document.getElementById('site-input').value.trim();
  const listId = document.getElementById('list-select').value;
  if (!host) return;

  safeSendMessage({ type: "ADD_BLOCKED_SITE", host, listId }, () => {
    const original = btn.textContent;
    btn.textContent = "✓ Added";
    btn.classList.add('is-added');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('is-added');
    }, 1400);
  });
});

document.getElementById('badge-select').addEventListener('change', (e) => {
  safeSendMessage({ type: "SET_BADGE_MODE", mode: e.target.value }, () => {});
});

// ---------------------------------------------------------------------------
// Footer nav
// ---------------------------------------------------------------------------

document.getElementById('open-dashboard').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html') });
});

document.getElementById('open-settings').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html#settings') });
});

refresh();
setInterval(refresh, 1000);
