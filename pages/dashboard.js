// Purity Lock · Premium Dashboard v3.0
// Fully wired to chrome.storage + background messaging

const Storage = {
  async get(keys) {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(keys, resolve);
      } else {
        try {
          const data = localStorage.getItem('purity_lock_state');
          resolve(data ? JSON.parse(data) : {});
        } catch { resolve({}); }
      }
    });
  },
  async set(data) {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.set(data, resolve);
      } else {
        try {
          const existing = JSON.parse(localStorage.getItem('purity_lock_state') || '{}');
          localStorage.setItem('purity_lock_state', JSON.stringify({ ...existing, ...data }));
          resolve();
        } catch { resolve(); }
      }
    });
  },
  async clear() {
    return new Promise(resolve => {
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.clear(resolve);
      } else {
        localStorage.removeItem('purity_lock_state');
        resolve();
      }
    });
  }
};

function safeSend(payload, cb) {
  try {
    chrome.runtime.sendMessage(payload, (resp) => {
      if (chrome.runtime.lastError) { cb?.(null); return; }
      cb?.(resp || null);
    });
  } catch { cb?.(null); }
}

const DEFAULT_VERSES = [
  { book: 'Philippians', chapter: 4, verse: 13, text: 'I can do all things through Him who strengthens me.', ref: 'Philippians 4:13' },
  { book: 'Proverbs', chapter: 3, verse: 5, text: 'Trust in the Lord with all your heart and lean not on your own understanding.', ref: 'Proverbs 3:5' },
  { book: 'Psalms', chapter: 119, verse: 9, text: 'How can a young person stay on the path of purity? By living according to your word.', ref: 'Psalm 119:9' },
  { book: '1 Corinthians', chapter: 10, verse: 13, text: 'No temptation has overtaken you except what is common to mankind. And God is faithful.', ref: '1 Corinthians 10:13' },
  { book: 'Romans', chapter: 12, verse: 2, text: 'Do not conform to the pattern of this world, but be transformed by the renewing of your mind.', ref: 'Romans 12:2' },
  { book: 'Joshua', chapter: 1, verse: 9, text: 'Have I not commanded you? Be strong and courageous. Do not be afraid; do not be discouraged.', ref: 'Joshua 1:9' },
  { book: 'Psalms', chapter: 51, verse: 10, text: 'Create in me a clean heart, O God, and renew a right spirit within me.', ref: 'Psalm 51:10' },
  { book: 'James', chapter: 4, verse: 7, text: 'Submit yourselves therefore to God. Resist the devil, and he will flee from you.', ref: 'James 4:7' },
  { book: 'Galatians', chapter: 5, verse: 16, text: 'Walk by the Spirit, and you will not gratify the desires of the flesh.', ref: 'Galatians 5:16' },
  { book: 'Philippians', chapter: 4, verse: 8, text: 'Whatever is true, whatever is honorable, whatever is just, whatever is pure… think about these things.', ref: 'Philippians 4:8' }
];

const ALL_BADGES = [
  { id: 'first_focus', name: 'First Focus', icon: '🌱', desc: 'Complete your first focus session', category: 'daily' },
  { id: 'week_streak', name: 'Clean Week', icon: '🌿', desc: '7 days of purity', category: 'weekly' },
  { id: 'month_streak', name: 'Clean Month', icon: '🌳', desc: '30 days of purity', category: 'weekly' },
  { id: 'shield_master', name: 'Shield Master', icon: '🛡️', desc: 'Blocked 100 attempts', category: 'lifetime' },
  { id: 'focus_king', name: 'Focus King', icon: '👑', desc: 'Completed 10 focus sessions', category: 'lifetime' },
  { id: 'search_warrior', name: 'Search Warrior', icon: '⚔️', desc: 'A week without explicit searches', category: 'weekly' },
  { id: 'bible_reader', name: 'Bible Reader', icon: '📖', desc: 'Read 50 verses', category: 'lifetime' },
  { id: 'prayer_warrior', name: 'Prayer Warrior', icon: '🙏', desc: '5 prayer sessions', category: 'daily' },
  { id: 'deep_focus', name: 'Deep Focus', icon: '🧘', desc: '2-hour focus session', category: 'lifetime' },
  { id: 'night_owl', name: 'Night Owl', icon: '🦉', desc: 'Focus after 10 PM', category: 'daily' },
  { id: 'morning_warrior', name: 'Morning Warrior', icon: '🌅', desc: 'Focus before 6 AM', category: 'daily' },
  { id: 'perfect_week', name: 'Perfect Week', icon: '💎', desc: '7 days of focus', category: 'weekly' },
  { id: 'distraction_destroyer', name: 'Distraction Destroyer', icon: '💥', desc: 'Blocked 500 attempts', category: 'lifetime' },
  { id: 'homework_hero', name: 'Homework Hero', icon: '📚', desc: '10 study sessions', category: 'lifetime' },
  { id: 'centurion', name: 'Centurion', icon: '⚔️', desc: '100 hours focused', category: 'lifetime' },
  { id: 'legend', name: 'Productivity Legend', icon: '🌟', desc: '500 hours focused', category: 'lifetime' },
];

let state = {
  theme: 'dark', accentHue: 217, highContrast: false, reducedMotion: false,
  gracePeriod: 5, strictMode: false, defaultAllowedSite: '', whitelist: [], blocklist: [],
  history: [], achievements: [], analytics: { daily: {}, categories: {}, focusDays: [] },
  stats: { today: 0, streak: 0, longestStreak: 0, hoursSaved: 0, total: 0 },
  focusDays: [], verses: DEFAULT_VERSES, bookmarks: [], prayers: [],
  pomodoro: { length: 25, break: 5 }, level: 1, xp: 0,
  aiProvider: 'openai', aiKey: '', aiEnabled: true, telemetry: true, autoBackup: true,
  devtools: false, logLevel: 'info', experimental: false, glassEffect: true,
  fontSize: 'medium', redirectUrl: '', notifications: true, autoStartPomo: false,
  bibleReadCount: 0, isLocked: false, isPaused: false
};

let pomoInterval = null;
let pomoTime = 25 * 60;
let pomoRunning = false;
let pomoMode = 'focus';
let currentMode = 'focus';
let calDate = new Date();
let historyFilter = 'all';
let historySort = 'newest';
let achFilter = 'all';

const $ = id => document.getElementById(id);
const qs = (sel, ctx = document) => ctx.querySelector(sel);
const qsa = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatHours(seconds) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

function getToday() {
  return new Date().toISOString().split('T')[0];
}

function getDaysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y, m) { return new Date(y, m, 1).getDay(); }

function getWeekNumber(d) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + 3 - (t.getDay() + 6) % 7);
  const w1 = new Date(t.getFullYear(), 0, 4);
  return 1 + Math.round(((t - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'danger' ? '⚠️' : 'ℹ️'}</span> ${message}`;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function applyTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  document.documentElement.setAttribute('data-theme', theme === 'dark' || theme === 'amoled' || theme === 'ocean' || theme === 'forest' || theme === 'midnight' || theme === 'golden' ? theme : 'royal-blue');
  if (theme === 'light') document.documentElement.setAttribute('data-mode', 'light');
  else document.documentElement.setAttribute('data-mode', 'dark');
}

function applyAccent(hue) {
  document.documentElement.style.setProperty('--accent-hue', hue);
  document.documentElement.style.setProperty('--accent-color', `hsl(${hue}, 91%, 58%)`);
  document.documentElement.style.setProperty('--accent-glow', `hsla(${hue}, 91%, 58%, 0.35)`);
}

function applyHighContrast(v) {
  document.body.setAttribute('data-high-contrast', v ? 'true' : 'false');
  document.documentElement.setAttribute('data-high-contrast', v ? 'true' : 'false');
}

function applyReducedMotion(v) {
  document.body.setAttribute('data-reduced-motion', v ? 'true' : 'false');
  document.documentElement.setAttribute('data-reduced-motion', String(!!v));
}

function applyGlassEffect(v) {
  qsa('.glass-panel, .card, .stat-card').forEach(el => {
    el.style.backdropFilter = v ? 'blur(20px)' : 'none';
    el.style.webkitBackdropFilter = v ? 'blur(20px)' : 'none';
  });
}

function applyFontSize(size) {
  const sizes = { small: '14px', medium: '16px', large: '18px' };
  document.documentElement.style.fontSize = sizes[size] || '16px';
}

// ─── RENDERERS ───────────────────────────────────────────────────────────

function renderOverview() {
  const s = state.stats || {};
  const focusSec = state.analytics?.daily?.[getToday()]?.focused || 0;

  if ($('stat-focus-today')) $('stat-focus-today').textContent = formatHours(focusSec * 60 || 0);
  if ($('stat-blocked')) $('stat-blocked').textContent = s.today || 0;
  if ($('stat-saved')) $('stat-saved').textContent = ((s.hoursSaved || 0)).toFixed(1) + 'h';
  if ($('stat-level')) $('stat-level').textContent = state.level || 1;

  const score = Math.min(100, 60 + (s.streak || 0) * 2 + Math.floor((state.xp || 0) / 10));
  if ($('stat-score')) $('stat-score').textContent = score;

  const goalSec = 2 * 3600;
  const pct = Math.min(100, ((focusSec * 60) / goalSec) * 100);
  if ($('stat-goal')) $('stat-goal').textContent = Math.round(pct) + '%';
  if ($('daily-progress-bar')) $('daily-progress-bar').style.width = pct + '%';
  if ($('daily-progress-text')) $('daily-progress-text').textContent = Math.round(pct) + '%';
  if ($('daily-goal-text')) $('daily-goal-text').textContent = '2h';

  if ($('widget-streak')) $('widget-streak').textContent = `🔥 ${s.streak || 0}d`;
  if ($('widget-level')) $('widget-level').textContent = `⭐ Lv ${state.level || 1}`;
  if ($('widget-xp')) $('widget-xp').textContent = `⚡ ${state.xp || 0} XP`;
  if ($('hero-streak-tag')) $('hero-streak-tag').textContent = `🔥 ${s.streak || 0} Day Streak`;

  const latest = state.achievements?.length ? state.achievements[state.achievements.length - 1] : null;
  if ($('widget-latest-ach')) {
    $('widget-latest-ach').textContent = latest
      ? latest.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      : 'No achievements yet';
  }

  // Status
  const status = $('hero-status-value');
  const detail = $('hero-status-detail');
  if (state.isLocked) {
    status.textContent = '🔒 Locked';
    status.className = 'status-value locked';
    detail.textContent = 'Focus session in progress';
  } else if (state.isPaused) {
    status.textContent = '⏸ Paused';
    status.className = 'status-value paused';
    detail.textContent = 'Filters temporarily off';
  } else if (pomoRunning) {
    status.textContent = pomoMode === 'focus' ? '🟢 Focusing' : '☕ Break';
    status.className = 'status-value';
    detail.textContent = `${formatTime(pomoTime)} remaining`;
  } else {
    status.textContent = '🟢 Protected';
    status.className = 'status-value';
    detail.textContent = 'All filters running';
  }

  // Daily verse
  const verses = state.verses?.length ? state.verses : DEFAULT_VERSES;
  const v = verses[Math.floor(Math.random() * verses.length)];
  if ($('daily-verse')) $('daily-verse').textContent = `"${v.text}" — ${v.ref}`;

  renderRecentHistory();
  renderCalendar();
  updateAISuggestion();
}

function renderRecentHistory() {
  const list = $('recent-history-list');
  if (!list) return;
  const items = (state.history || []).slice(0, 6);
  if (!items.length) {
    list.innerHTML = `<div class="empty-state"><span class="empty-icon">📭</span><div>No recent activity</div></div>`;
    return;
  }
  list.innerHTML = items.map((h, i) => `
    <div class="timeline-item ${h.type || h.category || ''}" style="animation-delay:${i * 0.04}s">
      <div style="font-weight:600;font-size:0.88rem;">${h.description || h.type || 'Event'}</div>
      <div style="font-size:0.72rem;color:var(--text-tertiary);margin-top:0.2rem;">${new Date(h.timestamp).toLocaleString()}</div>
    </div>
  `).join('');
}

function renderCalendar() {
  const grid = $('calendar-grid');
  if (!grid) return;
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  if ($('cal-month-label')) {
    $('cal-month-label').textContent = `${calDate.toLocaleString('default', { month: 'long' })} ${year}`;
  }
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);
  const today = getToday();
  const focusDays = state.focusDays || state.analytics?.focusDays || [];

  let html = '';
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  for (let i = 0; i < startOffset; i++) html += `<div class="cal-day empty"></div>`;
  for (let i = 1; i <= daysInMonth; i++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    const isSuccess = focusDays.includes(dateStr);
    const isToday = dateStr === today;
    html += `<div class="cal-day ${isSuccess ? 'success' : ''} ${isToday ? 'today' : ''}">${i}</div>`;
  }
  grid.innerHTML = html;
}

function renderFullHistory() {
  let items = state.history || [];
  if (historyFilter !== 'all') {
    items = items.filter(h => (h.type || h.category) === historyFilter);
  }
  items = items.sort((a, b) => historySort === 'newest' ? (b.timestamp - a.timestamp) : (a.timestamp - b.timestamp));

  const container = $('full-history-list');
  const empty = $('history-empty');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = '';
    empty?.classList.remove('hidden');
    if ($('history-count')) $('history-count').textContent = 0;
    if ($('history-blocked-count')) $('history-blocked-count').textContent = 0;
    if ($('history-focus-count')) $('history-focus-count').textContent = 0;
    return;
  }
  empty?.classList.add('hidden');

  const searchVal = ($('history-search')?.value || '').toLowerCase();
  const filtered = items.filter(h =>
    (h.description || '').toLowerCase().includes(searchVal) ||
    (h.category || '').toLowerCase().includes(searchVal) ||
    (h.type || '').toLowerCase().includes(searchVal)
  );

  if ($('history-count')) $('history-count').textContent = filtered.length;
  if ($('history-blocked-count')) $('history-blocked-count').textContent = filtered.filter(h => (h.type || h.category) === 'blocked' || h.category === 'block').length;
  if ($('history-focus-count')) $('history-focus-count').textContent = filtered.filter(h => (h.type || h.category) === 'focus' || h.category === 'lock').length;

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state"><div>No matching events</div></div>`;
    return;
  }

  container.innerHTML = filtered.map((h, i) => {
    const type = h.type || h.category || 'event';
    return `
      <div class="timeline-item ${type}" style="animation-delay:${Math.min(i * 0.02, 0.4)}s">
        <div style="display:flex;justify-content:space-between;align-items:start;flex-wrap:wrap;gap:0.4rem;">
          <div>
            <div style="font-weight:600;font-size:0.9rem;">${h.description || type}</div>
            <div style="font-size:0.78rem;color:var(--text-secondary);margin-top:0.2rem;">${h.category || ''} ${h.duration ? '· ' + formatHours(h.duration) : ''}</div>
          </div>
          <div style="font-size:0.72rem;color:var(--text-tertiary);white-space:nowrap;">${new Date(h.timestamp).toLocaleString()}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderAchievements() {
  const earned = state.achievements || [];
  const grid = $('badge-grid');
  if (!grid) return;

  let filtered = ALL_BADGES;
  if (achFilter === 'earned') filtered = ALL_BADGES.filter(b => earned.includes(b.id));
  else if (achFilter === 'locked') filtered = ALL_BADGES.filter(b => !earned.includes(b.id));
  else if (['daily', 'weekly', 'lifetime'].includes(achFilter)) filtered = ALL_BADGES.filter(b => b.category === achFilter);

  grid.innerHTML = filtered.map(badge => {
    const isEarned = earned.includes(badge.id);
    const pct = isEarned ? 100 : Math.floor(Math.random() * 55) + 8;
    return `
      <div class="badge-item ${isEarned ? 'earned' : ''} ${badge.id.includes('destroyer') || badge.id.includes('legend') ? 'rare' : ''}">
        <span class="badge-icon">${badge.icon}</span>
        <span class="badge-name">${badge.name}</span>
        <span class="badge-desc">${badge.desc}</span>
        <div class="badge-progress"><div class="bar" style="width:${pct}%;"></div></div>
        ${isEarned ? '<span style="font-size:0.6rem;color:var(--success-color);margin-top:0.25rem;display:block;">✓ Earned</span>' : `<span style="font-size:0.6rem;color:var(--text-tertiary);margin-top:0.25rem;display:block;">${pct}%</span>`}
      </div>
    `;
  }).join('');

  if ($('ach-count')) $('ach-count').textContent = earned.length;
  if ($('ach-streak')) $('ach-streak').textContent = state.stats?.streak || 0;

  const lv = state.level || 1;
  const xp = state.xp || 0;
  const nextXP = lv * 100;
  const pctXP = Math.min(100, (xp / nextXP) * 100);

  if ($('level-number')) $('level-number').textContent = lv;
  if ($('level-ring-number')) $('level-ring-number').textContent = lv;
  if ($('level-ring')) $('level-ring').style.setProperty('--xp-pct', pctXP + '%');
  if ($('xp-current')) $('xp-current').textContent = xp;
  if ($('xp-next')) $('xp-next').textContent = nextXP;
  if ($('xp-bar-fill')) $('xp-bar-fill').style.width = pctXP + '%';

  const titles = ['Novice', 'Apprentice', 'Adept', 'Expert', 'Master', 'Grandmaster', 'Legend'];
  if ($('level-title')) $('level-title').textContent = titles[Math.min(lv - 1, titles.length - 1)] || 'Legend';
}

function renderAnalytics() {
  const daily = state.analytics?.daily || {};
  const dates = Object.keys(daily).sort().slice(-7);
  const heatmap = $('heatmap-container');

  if (heatmap) {
    if (dates.length) {
      const max = Math.max(...dates.map(d => daily[d]?.blocked || 0), 1);
      let svg = `<svg viewBox="0 0 700 180" style="width:100%;height:180px;">`;
      dates.forEach((date, i) => {
        const val = daily[date]?.blocked || 0;
        const h = (val / max) * 120;
        svg += `
          <rect x="${i * 100 + 20}" y="${150 - h}" width="60" height="${Math.max(h, 2)}" fill="var(--accent-color)" rx="6" opacity="0.85"/>
          <text x="${i * 100 + 50}" y="168" text-anchor="middle" fill="var(--text-secondary)" font-size="11">${date.slice(5)}</text>
          <text x="${i * 100 + 50}" y="${140 - h}" text-anchor="middle" fill="var(--text-primary)" font-size="12" font-weight="bold">${val}</text>
        `;
      });
      svg += `</svg>`;
      heatmap.innerHTML = svg;
    } else {
      heatmap.innerHTML = `<div class="empty-state"><span class="empty-icon">📈</span><div>No data yet</div></div>`;
    }
  }

  const cats = state.analytics?.categories || {};
  const sortedCats = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const catContainer = $('category-chart-container');
  if (catContainer) {
    if (sortedCats.length) {
      const maxCat = sortedCats[0][1] || 1;
      catContainer.innerHTML = sortedCats.map(([name, count]) => `
        <div style="margin-bottom:0.7rem;width:100%;">
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:var(--text-secondary);margin-bottom:0.15rem;">
            <span>${name.charAt(0).toUpperCase() + name.slice(1)}</span>
            <span>${count}</span>
          </div>
          <div style="height:6px;background:var(--glass-bg);border-radius:6px;overflow:hidden;">
            <div style="width:${Math.min(100, (count / maxCat) * 100)}%;height:100%;background:var(--accent-color);border-radius:6px;transition:width 0.6s;"></div>
          </div>
        </div>
      `).join('');
    } else {
      catContainer.innerHTML = `<div class="empty-state"><span class="empty-icon">📊</span><div>No category data</div></div>`;
    }
  }

  // Time of day
  const tod = $('tod-chart-container');
  if (tod) {
    const hours = Array(24).fill(0);
    (state.history || []).forEach(h => {
      if ((h.type === 'focus' || h.category === 'lock') && h.timestamp) {
        hours[new Date(h.timestamp).getHours()]++;
      }
    });
    const maxHr = Math.max(...hours, 1);
    let svg = `<svg viewBox="0 0 600 120" style="width:100%;height:120px;">`;
    hours.forEach((v, i) => {
      const h = (v / maxHr) * 80;
      svg += `<rect x="${i * 25}" y="${100 - h}" width="18" height="${Math.max(h, 1)}" fill="var(--accent-color)" rx="3" opacity="${v > 0 ? 0.85 : 0.15}"/>
              <text x="${i * 25 + 9}" y="115" text-anchor="middle" fill="var(--text-tertiary)" font-size="8">${i}</text>`;
    });
    svg += `</svg>`;
    tod.innerHTML = svg;
  }

  // Weekly report
  const allFocus = (state.history || []).filter(h => h.type === 'focus' || h.category === 'lock');
  const thisWeek = getWeekNumber(new Date());
  const thisWeekSec = allFocus.filter(h => getWeekNumber(new Date(h.timestamp)) === thisWeek).reduce((s, h) => s + (h.duration || 0), 0);
  const lastWeekSec = allFocus.filter(h => getWeekNumber(new Date(h.timestamp)) === thisWeek - 1).reduce((s, h) => s + (h.duration || 0), 0);

  if ($('rw-focus')) $('rw-focus').textContent = formatHours(thisWeekSec);
  if ($('rw-last')) $('rw-last').textContent = formatHours(lastWeekSec);
  const change = lastWeekSec > 0 ? ((thisWeekSec - lastWeekSec) / lastWeekSec * 100) : (thisWeekSec > 0 ? 100 : 0);
  if ($('rw-change')) {
    $('rw-change').textContent = (change >= 0 ? '+' : '') + Math.round(change) + '%';
    $('rw-change').style.color = change >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const bestDay = allFocus.filter(h => getWeekNumber(new Date(h.timestamp)) === thisWeek).reduce((acc, h) => {
    const d = new Date(h.timestamp).getDay();
    acc[d] = (acc[d] || 0) + (h.duration || 0);
    return acc;
  }, {});
  let bestDayName = '—', bestDayVal = 0;
  Object.entries(bestDay).forEach(([d, v]) => { if (v > bestDayVal) { bestDayVal = v; bestDayName = days[parseInt(d)]; } });
  if ($('rw-best-day')) $('rw-best-day').textContent = bestDayVal > 0 ? `${bestDayName} (${formatHours(bestDayVal)})` : '—';

  const totalDays = new Set(allFocus.map(h => new Date(h.timestamp).toISOString().split('T')[0])).size;
  if ($('an-total-days')) $('an-total-days').textContent = totalDays;
  const avgSec = allFocus.length ? allFocus.reduce((s, h) => s + (h.duration || 0), 0) / allFocus.length : 0;
  if ($('an-avg-session')) $('an-avg-session').textContent = formatHours(avgSec);
  const bestSec = allFocus.reduce((s, h) => Math.max(s, h.duration || 0), 0);
  if ($('an-best-day')) $('an-best-day').textContent = formatHours(bestSec);
  const totalAttempts = (state.history || []).filter(h => h.type === 'blocked' || h.category === 'block').length;
  const rate = totalAttempts + allFocus.length > 0 ? Math.round((allFocus.length / (totalAttempts + allFocus.length)) * 100) : 0;
  if ($('an-success-rate')) $('an-success-rate').textContent = rate + '%';
}

function renderBible() {
  const verses = state.verses?.length ? state.verses : DEFAULT_VERSES;
  if (verses.length) {
    const v = verses[Math.floor(Math.random() * verses.length)];
    if ($('bible-daily-text')) $('bible-daily-text').textContent = `"${v.text}"`;
    if ($('bible-daily-ref')) $('bible-daily-ref').textContent = v.ref;
  }

  const filter = $('bible-filter');
  if (filter) {
    const books = [...new Set(verses.map(v => v.book))];
    const current = filter.value;
    filter.innerHTML = `<option value="all">All Books</option>` + books.map(b => `<option value="${b}">${b}</option>`).join('');
    filter.value = current || 'all';
  }

  performBibleSearch();

  if ($('bible-total-read')) $('bible-total-read').textContent = state.bibleReadCount || 0;
  if ($('bible-bookmarks')) $('bible-bookmarks').textContent = (state.bookmarks || []).length;
  if ($('bible-week-read')) $('bible-week-read').textContent = state.bibleReadCount || 0;
  const pct = Math.min(100, ((state.bibleReadCount || 0) / 100) * 100);
  if ($('bible-progress-bar')) $('bible-progress-bar').style.width = pct + '%';
}

function performBibleSearch() {
  const query = ($('bible-search')?.value || '').toLowerCase();
  const filter = $('bible-filter')?.value || 'all';
  const verses = state.verses?.length ? state.verses : DEFAULT_VERSES;

  let results = verses;
  if (filter !== 'all') results = results.filter(v => v.book === filter);
  if (query) results = results.filter(v => v.text.toLowerCase().includes(query) || (v.ref || '').toLowerCase().includes(query));

  if ($('bible-result-count')) $('bible-result-count').textContent = results.length + ' verses';
  const container = $('bible-results');
  if (!container) return;

  if (!results.length) {
    container.innerHTML = `<div class="empty-state"><div>No verses found</div></div>`;
    return;
  }

  container.innerHTML = results.slice(0, 40).map(v => `
    <div style="padding:0.85rem;background:var(--glass-bg);border-radius:var(--radius-sm);margin-bottom:0.5rem;border-left:3px solid var(--gold-color);">
      <div style="font-weight:700;font-size:0.9rem;color:var(--gold-color);">${v.ref}</div>
      <div style="font-size:0.88rem;margin-top:0.25rem;font-style:italic;font-family:var(--font-serif);">${v.text}</div>
    </div>
  `).join('');
}

function renderFocus() {
  const focusSessions = (state.history || []).filter(h => h.type === 'focus' || h.category === 'lock');
  const today = getToday();
  const todaySessions = focusSessions.filter(h => new Date(h.timestamp).toISOString().split('T')[0] === today);
  if ($('focus-today-count')) $('focus-today-count').textContent = todaySessions.length;
  if ($('focus-total-count')) $('focus-total-count').textContent = focusSessions.length;
  if ($('focus-xp-gain')) $('focus-xp-gain').textContent = '+' + (focusSessions.length * 5);
}

function renderSettings() {
  if ($('set-theme')) $('set-theme').value = state.theme || 'dark';
  if ($('set-accent')) {
    $('set-accent').value = state.accentHue || 217;
    if ($('set-accent-label')) $('set-accent-label').textContent = (state.accentHue || 217) + '°';
  }
  if ($('set-highcontrast')) $('set-highcontrast').checked = !!state.highContrast;
  if ($('set-reducedmotion')) $('set-reducedmotion').checked = !!state.reducedMotion;
  if ($('set-fontsize')) $('set-fontsize').value = state.fontSize || 'medium';
  if ($('set-glass')) $('set-glass').checked = state.glassEffect !== false;
  if ($('set-grace')) $('set-grace').value = state.gracePeriod || 5;
  if ($('set-strict')) $('set-strict').checked = !!state.strictMode;
  if ($('set-defaultsite')) $('set-defaultsite').value = state.defaultAllowedSite || '';
  if ($('set-whitelist')) $('set-whitelist').value = (state.whitelist || []).join('\n');
  if ($('set-redirect')) $('set-redirect').value = state.redirectUrl || '';
  if ($('set-pomolength')) $('set-pomolength').value = state.pomodoro?.length || 25;
  if ($('set-breaklength')) $('set-breaklength').value = state.pomodoro?.break || 5;
  if ($('set-autostart')) $('set-autostart').checked = !!state.autoStartPomo;
  if ($('set-notifications')) $('set-notifications').checked = state.notifications !== false;
  if ($('set-devtools')) $('set-devtools').checked = !!state.devtools;
  if ($('set-loglevel')) $('set-loglevel').value = state.logLevel || 'info';
  if ($('set-experimental')) $('set-experimental').checked = !!state.experimental;
  if ($('set-telemetry')) $('set-telemetry').checked = state.telemetry !== false;
  if ($('set-autobackup')) $('set-autobackup').checked = state.autoBackup !== false;
}

async function saveSetting(key, value) {
  state[key] = value;
  await Storage.set({ [key]: value });
}

// ─── TABS ────────────────────────────────────────────────────────────────

function switchTab(tabId) {
  qsa('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.tab === tabId));
  qsa('.tab-panel').forEach(c => c.classList.toggle('active', c.id === `tab-${tabId}`));

  if (tabId === 'overview') renderOverview();
  else if (tabId === 'analytics') renderAnalytics();
  else if (tabId === 'history') renderFullHistory();
  else if (tabId === 'achievements') renderAchievements();
  else if (tabId === 'focus') renderFocus();
  else if (tabId === 'bible') renderBible();
  else if (tabId === 'settings') renderSettings();

  window.location.hash = tabId;
}

// ─── POMODORO ────────────────────────────────────────────────────────────

function startPomodoro() {
  if (pomoInterval) return;
  const length = parseInt($('set-pomolength')?.value || state.pomodoro?.length || 25);
  if (pomoTime <= 0 || pomoMode === 'break') {
    pomoTime = length * 60;
    pomoMode = 'focus';
  }
  pomoRunning = true;
  if ($('pomo-status')) $('pomo-status').textContent = '⏳ Focusing…';
  if ($('pomo-start')) $('pomo-start').textContent = '⏸ Running';

  pomoInterval = setInterval(() => {
    pomoTime--;
    updatePomoDisplay();
    if (pomoTime <= 0) {
      clearInterval(pomoInterval);
      pomoInterval = null;
      pomoRunning = false;
      if (pomoMode === 'focus') {
        const duration = length * 60;
        const entry = { type: 'focus', description: 'Pomodoro focus session', duration, timestamp: Date.now(), category: 'pomodoro' };
        state.history = state.history || [];
        state.history.unshift(entry);
        state.xp = (state.xp || 0) + 10;
        Storage.set({ history: state.history, xp: state.xp });
        if ($('pomo-status')) $('pomo-status').textContent = '✅ Focus complete! Take a break.';
        if ($('pomo-start')) $('pomo-start').textContent = '▶ Start';
        pomoMode = 'break';
        pomoTime = parseInt($('set-breaklength')?.value || 5) * 60;
        updatePomoDisplay();
        showToast('Focus session complete! +10 XP', 'success');
        setTimeout(() => { if (!pomoInterval && pomoMode === 'break') startPomodoro(); }, 3000);
      } else {
        if ($('pomo-status')) $('pomo-status').textContent = '☕ Break over! Ready to focus.';
        if ($('pomo-start')) $('pomo-start').textContent = '▶ Start';
        pomoMode = 'focus';
        pomoTime = length * 60;
        updatePomoDisplay();
        showToast('Break over! Ready to focus.', 'info');
      }
      renderOverview();
      renderFocus();
    }
  }, 1000);
  updatePomoDisplay();
}

function pausePomodoro() {
  if (pomoInterval) {
    clearInterval(pomoInterval);
    pomoInterval = null;
    pomoRunning = false;
    if ($('pomo-status')) $('pomo-status').textContent = '⏸ Paused';
    if ($('pomo-start')) $('pomo-start').textContent = '▶ Resume';
  }
}

function resetPomodoro() {
  pausePomodoro();
  pomoMode = 'focus';
  pomoTime = parseInt($('set-pomolength')?.value || 25) * 60;
  pomoRunning = false;
  updatePomoDisplay();
  if ($('pomo-status')) $('pomo-status').textContent = 'Ready to focus';
  if ($('pomo-start')) $('pomo-start').textContent = '▶ Start';
}

function updatePomoDisplay() {
  if ($('pomo-timer')) {
    $('pomo-timer').textContent = formatTime(pomoTime);
    $('pomo-timer').style.color = pomoMode === 'break' ? 'var(--warning-color)' : '';
  }
  if (pomoRunning && $('pomo-status')) {
    $('pomo-status').textContent = pomoMode === 'focus' ? '⏳ Focusing…' : '☕ Break time';
  }
}

function updateAISuggestion() {
  const box = $('ai-suggestion-box');
  if (!box) return;
  const streak = state.stats?.streak || 0;
  const blocked = (state.history || []).filter(h => h.type === 'blocked' || h.category === 'block').length;
  const suggestions = [
    { cond: streak >= 7, text: `🔥 You're on a ${streak}-day streak! Keep the momentum going.` },
    { cond: streak >= 3 && streak < 7, text: `🌟 ${streak} days strong! You're building a powerful habit.` },
    { cond: streak === 0, text: `💪 Every journey begins with a single step. Start a focus session now.` },
    { cond: blocked > 10, text: `🛡️ You've blocked ${blocked} attempts. You're becoming a shield master!` },
    { cond: (state.xp || 0) > 100, text: `🧠 You've earned ${state.xp} XP. Level ${state.level} is within reach!` },
  ];
  const match = suggestions.find(s => s.cond) || suggestions[2];
  box.querySelector('.ai-text').innerHTML = `<strong>AI Insight:</strong> ${match.text}`;
}

// ─── INIT ────────────────────────────────────────────────────────────────

async function init() {
  try {
    const data = await Storage.get(null);
    if (data && Object.keys(data).length) state = { ...state, ...data };
  } catch (e) {
    console.warn('Using default state');
  }

  // Also pull live lock state from background
  safeSend({ type: 'GET_STATE' }, (resp) => {
    if (resp) {
      state.isLocked = !!resp.isLocked;
      state.isPaused = !!resp.isPaused;
      if (resp.stats) state.stats = { ...state.stats, ...resp.stats };
      if (resp.history) state.history = resp.history;
      if (resp.analytics) state.analytics = resp.analytics;
      if (resp.achievements) state.achievements = resp.achievements;
      if (resp.level) state.level = resp.level;
      if (resp.xp != null) state.xp = resp.xp;
      renderOverview();
    }
  });

  applyTheme(state.theme || 'dark');
  applyAccent(state.accentHue || 217);
  applyHighContrast(state.highContrast);
  applyReducedMotion(state.reducedMotion);
  applyGlassEffect(state.glassEffect !== false);
  applyFontSize(state.fontSize || 'medium');

  // Nav
  qsa('.nav-item').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });
  qsa('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.goto));
  });

  if (window.location.hash) {
    const hash = window.location.hash.slice(1);
    if (qs(`.nav-item[data-tab="${hash}"]`)) switchTab(hash);
  }

  // Hero buttons
  $('hero-start-focus')?.addEventListener('click', () => switchTab('focus'));
  $('hero-view-stats')?.addEventListener('click', () => switchTab('analytics'));
  $('hero-bible')?.addEventListener('click', () => switchTab('bible'));

  // Calendar
  $('cal-prev')?.addEventListener('click', () => { calDate.setMonth(calDate.getMonth() - 1); renderCalendar(); });
  $('cal-next')?.addEventListener('click', () => { calDate.setMonth(calDate.getMonth() + 1); renderCalendar(); });

  // History
  $('history-search')?.addEventListener('input', renderFullHistory);
  $('history-filter')?.addEventListener('change', e => { historyFilter = e.target.value; renderFullHistory(); });
  $('history-sort')?.addEventListener('change', e => { historySort = e.target.value; renderFullHistory(); });
  $('clear-history-btn')?.addEventListener('click', async () => {
    if (confirm('Clear all history? This cannot be undone.')) {
      state.history = [];
      await Storage.set({ history: [] });
      renderFullHistory();
      renderOverview();
      showToast('History cleared', 'danger');
    }
  });
  $('export-history')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.history, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `purity-history-${getToday()}.json`;
    a.click();
    showToast('History exported', 'success');
  });

  // Achievements filters
  qsa('[data-ach-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('[data-ach-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      achFilter = btn.dataset.achFilter;
      renderAchievements();
    });
  });

  // Pomodoro
  $('pomo-start')?.addEventListener('click', () => pomoRunning ? pausePomodoro() : startPomodoro());
  $('pomo-pause')?.addEventListener('click', pausePomodoro);
  $('pomo-reset')?.addEventListener('click', resetPomodoro);
  qsa('[data-pomo-preset]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mins = parseInt(btn.dataset.pomoPreset);
      if ($('set-pomolength')) $('set-pomolength').value = mins;
      resetPomodoro();
    });
  });

  // Start Focus Session (real lock)
  $('start-focus-btn')?.addEventListener('click', async () => {
    const minutes = parseInt($('focus-duration')?.value || 25);
    const allowed = $('focus-allowed')?.value?.trim() || '';
    const duration = minutes * 60;
    const entry = {
      type: 'focus',
      description: `Manual focus session (${minutes}m)`,
      duration,
      timestamp: Date.now(),
      category: currentMode || 'focus'
    };
    state.history = state.history || [];
    state.history.unshift(entry);
    state.xp = (state.xp || 0) + 5;
    await Storage.set({ history: state.history, xp: state.xp });

    safeSend({ type: 'START_LOCK', minutes, allowedSite: allowed, reason: 'focus_session' }, (resp) => {
      if (resp?.ok) {
        showToast(`Focus lock started (${minutes}m)`, 'success');
        // Optional: window.location.href = 'locked.html';
      } else {
        showToast(`Focus session logged (${minutes}m)`, 'success');
      }
    });
    renderOverview();
    renderFocus();
  });

  // Mode chips
  qsa('.mode-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      qsa('.mode-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentMode = chip.dataset.mode;
    });
  });

  // Ambient sounds (UI only)
  qsa('[data-sound]').forEach(btn => {
    btn.addEventListener('click', () => {
      const label = btn.textContent.trim();
      qsa('[data-sound]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if ($('sound-status')) $('sound-status').textContent = `🔊 Playing: ${label}`;
      setTimeout(() => {
        btn.classList.remove('active');
        if ($('sound-status')) $('sound-status').textContent = '🔇 No sound playing';
      }, 2500);
    });
  });

  // Task list
  $('add-task')?.addEventListener('click', () => {
    const val = $('task-input')?.value?.trim();
    if (!val) return;
    const div = document.createElement('div');
    div.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.5rem;background:var(--glass-bg);border-radius:var(--radius-sm);margin-bottom:0.25rem;';
    div.innerHTML = `<input type="checkbox" style="accent-color:var(--accent-color);" /><span style="font-size:0.85rem;">${val}</span>`;
    $('task-list')?.prepend(div);
    if ($('task-input')) $('task-input').value = '';
  });

  // Bible
  $('bible-search-btn')?.addEventListener('click', performBibleSearch);
  $('bible-search')?.addEventListener('keydown', e => { if (e.key === 'Enter') performBibleSearch(); });
  $('bible-filter')?.addEventListener('change', performBibleSearch);
  $('bible-copy-verse')?.addEventListener('click', () => {
    const text = $('bible-daily-text')?.textContent || '';
    const ref = $('bible-daily-ref')?.textContent || '';
    navigator.clipboard?.writeText(`${text} — ${ref}`).then(() => showToast('Verse copied!', 'success'));
  });
  $('bible-bookmark-verse')?.addEventListener('click', async () => {
    const text = $('bible-daily-text')?.textContent || '';
    const ref = $('bible-daily-ref')?.textContent || '';
    state.bookmarks = state.bookmarks || [];
    state.bookmarks.push({ text, ref, timestamp: Date.now() });
    await Storage.set({ bookmarks: state.bookmarks });
    showToast('Verse bookmarked!', 'success');
    renderBible();
  });

  // Bible tabs
  qsa('[data-bible-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      qsa('[data-bible-tab]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.bibleTab;
      if ($('bible-content-search')) $('bible-content-search').classList.toggle('hidden', tab !== 'search' && tab !== 'stats' && tab !== 'plans');
      if ($('bible-content-prayer')) $('bible-content-prayer').classList.toggle('hidden', tab !== 'prayer');
    });
  });

  $('save-prayer')?.addEventListener('click', async () => {
    const text = $('prayer-input')?.value?.trim();
    if (!text) return;
    state.prayers = state.prayers || [];
    state.prayers.unshift({ text, timestamp: Date.now() });
    await Storage.set({ prayers: state.prayers });
    showToast('Prayer saved', 'success');
    if ($('prayer-input')) $('prayer-input').value = '';
    const list = $('prayer-list');
    if (list) {
      list.innerHTML = state.prayers.slice(0, 10).map(p => `
        <div style="padding:0.75rem;background:var(--glass-bg);border-radius:var(--radius-sm);margin-bottom:0.5rem;border-left:3px solid var(--accent-color);">
          <div style="font-size:0.85rem;">${p.text}</div>
          <div style="font-size:0.7rem;color:var(--text-tertiary);margin-top:0.3rem;">${new Date(p.timestamp).toLocaleString()}</div>
        </div>
      `).join('');
    }
  });

  // Settings listeners
  $('set-theme')?.addEventListener('change', async e => { applyTheme(e.target.value); await saveSetting('theme', e.target.value); });
  $('set-accent')?.addEventListener('input', e => {
    applyAccent(e.target.value);
    if ($('set-accent-label')) $('set-accent-label').textContent = e.target.value + '°';
  });
  $('set-accent')?.addEventListener('change', async e => await saveSetting('accentHue', parseInt(e.target.value)));
  $('set-highcontrast')?.addEventListener('change', async e => { applyHighContrast(e.target.checked); await saveSetting('highContrast', e.target.checked); });
  $('set-reducedmotion')?.addEventListener('change', async e => { applyReducedMotion(e.target.checked); await saveSetting('reducedMotion', e.target.checked); });
  $('set-glass')?.addEventListener('change', async e => { applyGlassEffect(e.target.checked); await saveSetting('glassEffect', e.target.checked); });
  $('set-fontsize')?.addEventListener('change', async e => { applyFontSize(e.target.value); await saveSetting('fontSize', e.target.value); });
  $('set-grace')?.addEventListener('change', async e => await saveSetting('gracePeriod', parseInt(e.target.value) || 5));
  $('set-strict')?.addEventListener('change', async e => await saveSetting('strictMode', e.target.checked));
  $('set-defaultsite')?.addEventListener('change', async e => await saveSetting('defaultAllowedSite', e.target.value.trim()));
  $('set-save-whitelist')?.addEventListener('click', async () => {
    const list = ($('set-whitelist')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
    await saveSetting('whitelist', list);
    safeSend({ type: 'UPDATE_WHITELIST', list }, () => showToast('Whitelist saved!', 'success'));
  });
  $('set-pomolength')?.addEventListener('change', async e => {
    state.pomodoro = state.pomodoro || {};
    state.pomodoro.length = parseInt(e.target.value) || 25;
    await Storage.set({ pomodoro: state.pomodoro });
    resetPomodoro();
  });
  $('set-breaklength')?.addEventListener('change', async e => {
    state.pomodoro = state.pomodoro || {};
    state.pomodoro.break = parseInt(e.target.value) || 5;
    await Storage.set({ pomodoro: state.pomodoro });
  });
  $('set-autostart')?.addEventListener('change', async e => await saveSetting('autoStartPomo', e.target.checked));
  $('set-notifications')?.addEventListener('change', async e => await saveSetting('notifications', e.target.checked));
  $('set-devtools')?.addEventListener('change', async e => await saveSetting('devtools', e.target.checked));
  $('set-loglevel')?.addEventListener('change', async e => await saveSetting('logLevel', e.target.value));
  $('set-experimental')?.addEventListener('change', async e => await saveSetting('experimental', e.target.checked));
  $('set-telemetry')?.addEventListener('change', async e => await saveSetting('telemetry', e.target.checked));
  $('set-autobackup')?.addEventListener('change', async e => await saveSetting('autoBackup', e.target.checked));
  $('set-redirect')?.addEventListener('change', async e => await saveSetting('redirectUrl', e.target.value.trim()));

  // Data actions
  $('set-export-data')?.addEventListener('click', async () => {
    const data = await Storage.get(null);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `purity-backup-${getToday()}.json`;
    a.click();
    showToast('Backup exported', 'success');
  });
  $('set-import-data')?.addEventListener('click', () => $('set-import-file')?.click());
  $('set-import-file')?.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      await Storage.set(data);
      showToast('Data restored! Refreshing…', 'success');
      setTimeout(() => location.reload(), 1000);
    } catch {
      showToast('Invalid backup file', 'danger');
    }
  });
  $('set-clear-history')?.addEventListener('click', async () => {
    if (confirm('Clear all history?')) {
      state.history = [];
      await Storage.set({ history: [] });
      renderFullHistory();
      renderOverview();
      showToast('History cleared', 'danger');
    }
  });
  $('set-reset-all')?.addEventListener('click', async () => {
    if (confirm('⚠️ RESET EVERYTHING? This cannot be undone.')) {
      await Storage.clear();
      showToast('All data reset. Refreshing…', 'danger');
      setTimeout(() => location.reload(), 1000);
    }
  });

  // Settings search
  $('settings-search')?.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    qsa('.settings-cat').forEach(cat => {
      const match = cat.textContent.toLowerCase().includes(q);
      cat.style.display = match ? '' : 'none';
    });
  });

  // Analytics export/print
  $('export-analytics')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state.analytics || {}, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `purity-analytics-${getToday()}.json`;
    a.click();
    showToast('Analytics exported', 'success');
  });
  $('print-analytics')?.addEventListener('click', () => window.print());

  // Initial renders
  renderOverview();
  renderAnalytics();
  renderFullHistory();
  renderAchievements();
  renderFocus();
  renderBible();
  renderSettings();

  if (state.autoStartPomo) setTimeout(startPomodoro, 600);

  // Live storage sync
  try {
    chrome.storage.onChanged.addListener((changes) => {
      for (const [key, { newValue }] of Object.entries(changes)) {
        state[key] = newValue;
      }
      const active = qs('.nav-item.active');
      if (active) switchTab(active.dataset.tab);
    });
  } catch {}

  console.log('🚀 Purity Lock Dashboard v3.0 Premium Loaded');
}

init().catch(console.error);
