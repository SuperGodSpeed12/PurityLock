// Purity Lock · Premium Blocked / Recovery Page

const TIPS = [
  "Take a short walk. Movement clears the mind.",
  "Drink a glass of water. Hydration fuels focus.",
  "Stretch for 30 seconds. Your body will thank you.",
  "Finish one small task. Momentum builds.",
  "Read a verse. Truth renews the mind.",
  "Pray for strength. You are not alone.",
  "Organize your desk. Clarity starts outside.",
  "Rest your eyes for 20 seconds. Look far away.",
  "Practice gratitude. Name three good things.",
  "You've already saved time today. Protect it.",
  "Your streak is worth defending.",
  "One focused session can change the day.",
  "Breathe in for 4, hold for 4, out for 4.",
  "The urge will pass. Stay present.",
  "You are stronger than this moment.",
];

const CHALLENGES = [
  { title: "Stay focused for 25 more minutes", desc: "Complete a Pomodoro to earn bonus XP." },
  { title: "Reach today's focus goal", desc: "Every minute counts toward your streak." },
  { title: "Beat yesterday's record", desc: "Push a little further than last time." },
  { title: "Earn 50 XP today", desc: "Focus sessions and blocked attempts both count." },
  { title: "Read one Bible chapter", desc: "Open the Bible Center and continue reading." },
  { title: "Complete a full Pomodoro", desc: "25 minutes of deep work, then rest." },
  { title: "Stay hydrated", desc: "Drink water and stretch before your next session." },
  { title: "Protect your streak", desc: "One more clean hour keeps the chain alive." },
];

const AI_INSIGHTS = [
  "You've got this. One focused session at a time.",
  "You usually regain focus after a short walk.",
  "Your streak is worth defending right now.",
  "Completing today's challenge unlocks bonus XP.",
  "You've already blocked distractions today — keep going.",
  "Reading before studying improves retention.",
  "You're closer to the next level than you think.",
  "A 10-minute lock can reset your whole evening.",
];

const BREATHE_PHASES = [
  { label: "Inhale…", duration: 4000 },
  { label: "Hold…", duration: 4000 },
  { label: "Exhale…", duration: 4000 },
  { label: "Hold…", duration: 4000 },
];

let graceTime = 5;
let initialGraceTime = 5;
let graceInterval = null;
let breatheIndex = 0;
let tipInterval = null;
const pageParams = new URLSearchParams(window.location.search);

function $(id) { return document.getElementById(id); }

function safeSend(payload, cb) {
  try {
    chrome.runtime.sendMessage(payload, (resp) => {
      if (chrome.runtime.lastError) { cb?.(null); return; }
      cb?.(resp || null);
    });
  } catch { cb?.(null); }
}

function showStep(id) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const el = $(id);
  if (el) el.classList.add('active');
  const shared = $('shared-widgets');
  if (shared) {
    shared.style.display = (id === 'step-grace') ? 'none' : 'grid';
  }
}

function spawnParticles(count = 18) {
  const layer = $('bg-layer');
  if (!layer) return;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (12 + Math.random() * 16) + 's';
    p.style.animationDelay = (Math.random() * 10) + 's';
    p.style.width = p.style.height = (2 + Math.random() * 4) + 'px';
    p.style.background = Math.random() > 0.5 ? 'var(--accent-color)' : 'var(--gold-color)';
    layer.appendChild(p);
  }
}

function startBreatheCycle() {
  const label = $('breathe-label');
  if (!label) return;
  function next() {
    const phase = BREATHE_PHASES[breatheIndex % BREATHE_PHASES.length];
    label.textContent = phase.label;
    breatheIndex++;
    setTimeout(next, phase.duration);
  }
  next();
}

function rotateTip() {
  const el = $('rotating-tip');
  if (!el) return;
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    el.style.opacity = '1';
  }, 350);
}

function pickChallenge() {
  const c = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
  if ($('challenge-title')) $('challenge-title').textContent = c.title;
  if ($('challenge-desc')) $('challenge-desc').textContent = c.desc;
}

function pickAIInsight() {
  const t = AI_INSIGHTS[Math.floor(Math.random() * AI_INSIGHTS.length)];
  if ($('ai-coach-text')) {
    $('ai-coach-text').innerHTML = `<strong>Insight:</strong> ${t}`;
  }
}

function applyState(state) {
  if (!state) return;

  document.body.setAttribute('data-theme', state.theme || 'dark');
  document.documentElement.setAttribute('data-theme', state.theme === 'light' ? 'royal-blue' : (state.theme || 'royal-blue'));
  document.documentElement.setAttribute('data-mode', state.theme === 'light' ? 'light' : 'dark');
  if (state.accentHue) {
    document.documentElement.style.setProperty('--accent-hue', state.accentHue);
  }
  if (state.reducedMotion) {
    document.documentElement.setAttribute('data-reduced-motion', 'true');
  }
  if (state.highContrast) {
    document.documentElement.setAttribute('data-high-contrast', 'true');
  }

  const streak = state.stats?.streak || 0;
  const level = state.level || 1;
  const xp = state.xp || 0;
  const nextXP = level * 100;
  const pct = Math.min(100, (xp / nextXP) * 100);
  const blocked = state.stats?.today || 0;
  const saved = (state.stats?.hoursSaved || 0).toFixed(1);
  const score = Math.min(100, 60 + streak * 2 + Math.floor(xp / 10));

  if ($('streak-pill')) $('streak-pill').textContent = `🔥 ${streak} Day Streak`;
  if ($('level-pill')) $('level-pill').textContent = `Lv ${level}`;
  if ($('rec-level')) $('rec-level').textContent = level;
  if ($('rec-xp')) $('rec-xp').textContent = xp;
  if ($('rec-xp-next')) $('rec-xp-next').textContent = nextXP;
  if ($('rec-xp-bar')) $('rec-xp-bar').style.width = pct + '%';
  if ($('rec-streak')) $('rec-streak').textContent = streak;
  if ($('rec-blocked')) $('rec-blocked').textContent = blocked;
  if ($('rec-saved')) $('rec-saved').textContent = saved + 'h';
  if ($('rec-score')) $('rec-score').textContent = score;
  if ($('sw-streak')) $('sw-streak').textContent = streak;
  if ($('sw-saved')) $('sw-saved').textContent = saved + 'h';

  if (state.gracePeriod) {
    graceTime = state.gracePeriod;
    initialGraceTime = state.gracePeriod;
  }
  if (state.defaultAllowedSite && $('lock-allowed-site')) {
    $('lock-allowed-site').value = state.defaultAllowedSite;
  }

  // Domain reason
  const domain = pageParams.get('domain');
  if (domain && $('block-reason')) {
    $('block-reason').textContent = domain;
  }
}

function startGracePeriod() {
  const circle = $('grace-circle');
  const circumference = 2 * Math.PI * 90;
  if (circle) {
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = 0;
  }
  if ($('grace-val')) $('grace-val').textContent = graceTime;
  if ($('grace-timer')) $('grace-timer').textContent = graceTime;

  graceInterval = setInterval(() => {
    graceTime--;
    if ($('grace-timer')) $('grace-timer').textContent = Math.max(0, graceTime);
    if ($('grace-val')) $('grace-val').textContent = Math.max(0, graceTime);

    if (circle) {
      const offset = circumference - (graceTime / initialGraceTime) * circumference;
      circle.style.strokeDashoffset = offset;
    }

    if (graceTime <= 0) {
      clearInterval(graceInterval);
      proceedToRecovery();
    }
  }, 1000);
}

function proceedToRecovery() {
  showStep('step-recovery');
  loadVerse();
  startBreatheCycle();
  pickChallenge();
  pickAIInsight();
  rotateTip();
  tipInterval = setInterval(rotateTip, 8000);
}

function loadVerse() {
  safeSend({ type: 'GET_VERSES' }, (resp) => {
    if (resp?.verses?.length) {
      const verse = resp.verses[Math.floor(Math.random() * resp.verses.length)];
      if ($('verse-text')) $('verse-text').textContent = `"${verse.text}"`;
      if ($('verse-ref')) $('verse-ref').textContent = `— ${verse.ref}`;
    }
  });
}

function startLock(minutes) {
  const allowedSite = $('lock-allowed-site')?.value?.trim() || '';
  safeSend({ type: 'START_LOCK', minutes, allowedSite, reason: 'recovery_session' }, (resp) => {
    if (resp?.ok) {
      window.location.href = 'locked.html';
    }
  });
}

// ─── Event wiring ────────────────────────────────────────────────────────

$('leave-now')?.addEventListener('click', () => {
  // Voluntary leave during grace — no 2-hour penalty
  try {
    chrome.runtime.sendMessage({ type: 'GRACE_VOLUNTARY_LEAVE' }, () => {
      window.location.href = 'about:blank';
    });
  } catch {
    window.location.href = 'about:blank';
  }
});

$('finish-recovery')?.addEventListener('click', () => {
  const reflection = $('reflection-input')?.value?.trim() || '';
  if (reflection.length < 3) {
    alert('Please take a moment to write a short reflection (at least a few words).');
    return;
  }
  safeSend({ type: 'SAVE_REFLECTION', text: reflection });
  showStep('step-lock');
  pickChallenge();
  pickAIInsight();
});

$('start-lock-btn')?.addEventListener('click', () => startLock(10));
$('start-lock-25')?.addEventListener('click', () => startLock(25));
$('start-lock-60')?.addEventListener('click', () => startLock(60));

$('search-yes')?.addEventListener('click', () => {
  safeSend({ type: 'SEARCH_DECISION', decision: 'yes' }, (resp) => {
    if (resp?.ok && resp.redirect) window.location.href = resp.redirect;
    else window.location.href = 'locked.html';
  });
});

$('search-no')?.addEventListener('click', () => {
  safeSend({ type: 'SEARCH_DECISION', decision: 'no' }, (resp) => {
    if (resp?.ok) window.location.href = 'about:blank';
    else window.location.href = 'about:blank';
  });
});

// Allowed site cards
document.querySelectorAll('.site-card').forEach(card => {
  card.addEventListener('click', () => {
    const url = card.dataset.url;
    if (url) window.open(url, '_blank');
  });
});

// Quick actions
document.querySelectorAll('.qa-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const action = btn.dataset.action;
    if (action === 'dashboard') {
      window.location.href = 'dashboard.html';
    } else if (action === 'bible') {
      window.location.href = 'dashboard.html#bible';
    } else if (action === 'focus') {
      window.location.href = 'dashboard.html#focus';
    } else if (action === 'achievements') {
      window.location.href = 'dashboard.html#achievements';
    } else if (action === 'notes') {
      const note = prompt('Quick note:');
      if (note) safeSend({ type: 'SAVE_REFLECTION', text: '[Note] ' + note });
    } else if (action === 'tip') {
      rotateTip();
      if ($('sw-tip')) $('sw-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
    }
  });
});

// ─── Init ────────────────────────────────────────────────────────────────

async function init() {
  spawnParticles(20);

  const type = pageParams.get('type');
  if (type === 'search_warning') {
    showStep('step-search-warning');
    if ($('sw-tip')) $('sw-tip').textContent = TIPS[Math.floor(Math.random() * TIPS.length)];
  }

  safeSend({ type: 'GET_STATE' }, (state) => {
    applyState(state);
    if (type !== 'search_warning') {
      if ($('grace-val')) $('grace-val').textContent = graceTime;
      if ($('grace-timer')) $('grace-timer').textContent = graceTime;
      startGracePeriod();
    }
  });

  // Fallback if messaging fails
  if (type !== 'search_warning') {
    setTimeout(() => {
      if (graceTime === initialGraceTime && !graceInterval) startGracePeriod();
    }, 800);
  }
}

init();
