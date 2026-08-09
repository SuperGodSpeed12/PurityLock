import { Storage } from './scripts/storage.js';
import { SearchDetection } from './scripts/search_detection.js';
import { CategoryDetection } from './scripts/category_detection.js';

const BLOCKLIST_URL = chrome.runtime.getURL("blocklist.json");
const VERSES_URL = chrome.runtime.getURL("assets/verses.json");
const LOCK_ALARM = "purity-lock-unlock";
const BLOCKED_PAGE = () => chrome.runtime.getURL("pages/blocked.html");
const LOCKED_PAGE = () => chrome.runtime.getURL("pages/locked.html");

let blockedDomains = new Set();
let whitelist = new Set();
let isLocked = false;
let lockEndTime = 0;
let lockStartedAt = 0;
let allowedSiteDuringLock = null;
let lockReason = null;

// tabId -> { domain, startTime, graceSeconds, completed }
const pendingGracePeriods = new Map();

function normalizeDomain(value) {
  if (typeof value !== "string") return "";
  let domain = value.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, "").split("/")[0].split(":")[0].replace(/\.$/, "");
  try { domain = new URL(`https://${domain}`).hostname; } catch { return ""; }
  return domain.replace(/^(?:www|m|mobile|amp)\./, "");
}

function isDomain(value) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(value);
}

function hostMatches(host, domain) {
  return host === domain || host.endsWith(`.${domain}`);
}

function isExtensionPage(url) {
  try {
    const u = new URL(url);
    return u.protocol === "chrome-extension:" || u.protocol === "about:" || u.protocol === "chrome:";
  } catch { return false; }
}

async function loadBlocklist() {
  try {
    const response = await fetch(BLOCKLIST_URL, { cache: "no-store" });
    const list = await response.json();
    blockedDomains = new Set(list.map(normalizeDomain).filter(isDomain));
    await Storage.set({ cachedBlocklistAt: Date.now() });
  } catch (error) {
    console.error("Purity Lock could not load blocklist:", error);
  }
}

async function init() {
  await Storage.init();
  await loadBlocklist();
  await SearchDetection.loadKeywords();
  await CategoryDetection.load();

  const data = await Storage.get(["whitelist", "lockEndTime", "lockStartedAt", "allowedSite", "lockReason"]);
  whitelist = new Set((data.whitelist || []).map(normalizeDomain).filter(isDomain));

  if (Number(data.lockEndTime) > Date.now()) {
    isLocked = true;
    lockEndTime = Number(data.lockEndTime);
    lockStartedAt = Number(data.lockStartedAt) || Date.now();
    allowedSiteDuringLock = normalizeDomain(data.allowedSite);
    lockReason = data.lockReason || null;
    chrome.alarms.create(LOCK_ALARM, { when: lockEndTime });
  }
  updateBadge();
}

const ready = init();

function isBlocked(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = normalizeDomain(parsed.hostname);
    if ([...whitelist].some(domain => hostMatches(host, domain))) return false;
    if (blockedDomains.has(host)) return true;

    const labels = host.split(".");
    for (let index = 1; index < labels.length - 1; index++) {
      if (blockedDomains.has(labels.slice(index).join("."))) return true;
    }
  } catch { /* ignore */ }
  return false;
}

function isAllowedDuringLock(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
    if (!allowedSiteDuringLock) return false;
    return hostMatches(normalizeDomain(parsed.hostname), allowedSiteDuringLock);
  } catch {
    return false;
  }
}

// Force lock even if already locked (for penalties). Extends if longer.
async function startLock(minutes, allowedSite, reason = null, { force = false } = {}) {
  const newEnd = Date.now() + minutes * 60 * 1000;

  if (isLocked && !force) {
    // Already locked — only extend if new lock is longer
    if (newEnd <= lockEndTime) return;
  }

  isLocked = true;
  if (!lockStartedAt || force || !isLocked) lockStartedAt = Date.now();
  // If forcing a penalty on top of existing lock, take the later end time
  lockEndTime = isLocked && lockEndTime > newEnd && !force ? lockEndTime : newEnd;
  if (force || !allowedSiteDuringLock) {
    allowedSiteDuringLock = normalizeDomain(allowedSite) || null;
  } else if (allowedSite) {
    allowedSiteDuringLock = normalizeDomain(allowedSite);
  }
  lockReason = reason || lockReason;

  await Storage.set({
    lockEndTime,
    lockStartedAt,
    allowedSite: allowedSiteDuringLock,
    lockReason
  });
  chrome.alarms.create(LOCK_ALARM, { when: lockEndTime });

  await Storage.addHistory({
    category: 'lock',
    description: `Lock started for ${minutes} minutes (${reason || 'manual'}). Allowed: ${allowedSiteDuringLock || 'None'}`,
    severity: reason === 'bypass_penalty' ? 'critical' : 'high'
  });

  updateBadge();
}

async function clearLock({ emergency = false } = {}) {
  // Block easy unlock of penalty locks unless emergency
  if (isLocked && (lockReason === 'bypass_penalty' || lockReason === 'search_penalty') && !emergency) {
    return { ok: false, error: 'penalty_lock' };
  }

  const settings = await Storage.get(['strictMode', 'emergencyUnlockEnabled', 'emergencyUnlocksUsedToday', 'emergencyUnlockDailyLimit']);
  if (emergency) {
    if (settings.strictMode) return { ok: false, error: 'strict_mode' };
    if (settings.emergencyUnlockEnabled === false) return { ok: false, error: 'disabled' };
    const used = settings.emergencyUnlocksUsedToday || 0;
    const limit = settings.emergencyUnlockDailyLimit ?? 1;
    if (used >= limit) return { ok: false, error: 'daily_limit' };
  }

  if (isLocked && lockStartedAt > 0) {
    const elapsedMinutes = Math.floor((Date.now() - lockStartedAt) / 60000);
    if (elapsedMinutes > 0) {
      await Storage.updateStats(stats => {
        stats.hoursSaved = (stats.hoursSaved || 0) + (elapsedMinutes / 60);
      });

      const analyticsData = await Storage.get('analytics');
      const analytics = analyticsData.analytics || { daily: {}, categories: {}, focusDays: [] };
      const today = new Date().toISOString().split('T')[0];
      if (!analytics.daily[today]) analytics.daily[today] = { blocked: 0, focused: 0, searches: 0 };
      analytics.daily[today].focused += elapsedMinutes;
      if (!analytics.focusDays.includes(today)) analytics.focusDays.push(today);
      await Storage.set({ analytics });
    }
  }

  isLocked = false;
  lockEndTime = 0;
  lockStartedAt = 0;
  allowedSiteDuringLock = null;
  lockReason = null;
  await Storage.set({ lockEndTime: 0, lockStartedAt: 0, allowedSite: null, lockReason: null });
  await chrome.alarms.clear(LOCK_ALARM);
  updateBadge();
  return { ok: true };
}

function updateBadge() {
  if (isLocked && lockEndTime > Date.now()) {
    const mins = Math.ceil((lockEndTime - Date.now()) / 60000);
    chrome.action.setBadgeText({ text: String(mins) });
    chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
  } else {
    chrome.action.setBadgeText({ text: "" });
  }
}

async function applyBypassPenalty(tabId) {
  const pending = pendingGracePeriods.get(tabId);
  if (!pending || pending.completed) return;

  pendingGracePeriods.delete(tabId);
  // 2-hour hard lock, no allowed site
  await startLock(120, null, 'bypass_penalty', { force: true });

  try {
    chrome.tabs.create({ url: LOCKED_PAGE() });
  } catch { /* ignore */ }

  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon128.png",
    title: "Purity Lock — Bypass Detected",
    message: "Closing the recovery page triggers a 2-hour lock. Stay strong."
  });
}

async function handleNavigation(details) {
  if (details.frameId !== 0) return;

  const blockedPage = BLOCKED_PAGE();
  const lockedPage = LOCKED_PAGE();
  const url = details.url || "";

  // Navigating away from blocked page → penalty if still pending
  if (pendingGracePeriods.has(details.tabId)) {
    const isStillOnBlocked = url.startsWith(blockedPage);
    const isLockedPage = url.startsWith(lockedPage);
    const isAboutBlank = url === "about:blank" || url.startsWith("about:");

    if (!isStillOnBlocked && !isLockedPage) {
      const pending = pendingGracePeriods.get(details.tabId);
      const elapsed = (Date.now() - (pending?.startTime || 0)) / 1000;
      const grace = pending?.graceSeconds ?? 5;

      if (elapsed <= grace && isAboutBlank) {
        // Voluntary leave during grace via "I'll leave now"
        pendingGracePeriods.delete(details.tabId);
      } else if (!isAboutBlank || elapsed > grace) {
        // Left recovery flow without completing → penalty
        await applyBypassPenalty(details.tabId);
        return;
      }
    }
  }

  if (url.startsWith(blockedPage) || url.startsWith(lockedPage)) return;

  await ready;

  // Search Detection
  const searchType = SearchDetection.detect(url);
  const settings = await Storage.get(['searchMonitoringEnabled', 'searchEscalationLevel']);
  if (searchType && settings.searchMonitoringEnabled !== false) {
    const analyticsData = await Storage.get('analytics');
    const analytics = analyticsData.analytics || { daily: {}, categories: {} };
    const today = new Date().toISOString().split('T')[0];
    if (!analytics.daily[today]) analytics.daily[today] = { blocked: 0, focused: 0, searches: 0 };
    analytics.daily[today].searches = (analytics.daily[today].searches || 0) + 1;
    await Storage.set({ analytics });

    const level = settings.searchEscalationLevel || 0;

    if (level === 0) {
      chrome.tabs.update(details.tabId, { url: `${blockedPage}?type=search_warning&level=1` });
      return;
    } else {
      const minutes = level === 1 ? 20 : 30;
      await startLock(minutes, null, 'search_penalty', { force: true });
      chrome.tabs.update(details.tabId, { url: lockedPage });
      await Storage.set({ searchEscalationLevel: level + 1 });
      return;
    }
  }

  if (isLocked) {
    if (!isAllowedDuringLock(url) && !isExtensionPage(url)) {
      chrome.tabs.update(details.tabId, { url: lockedPage });
    }
    return;
  }

  if (isBlocked(url)) {
    let host;
    try { host = normalizeDomain(new URL(url).hostname); } catch { return; }

    const category = CategoryDetection.getCategory(host);

    await Storage.updateStats(stats => {
      stats.today += 1;
      stats.total += 1;
      stats.cleanStreakStart = Date.now();
    });

    const analyticsData = await Storage.get('analytics');
    const analytics = analyticsData.analytics || { daily: {}, categories: {} };
    const today = new Date().toISOString().split('T')[0];
    if (!analytics.daily[today]) analytics.daily[today] = { blocked: 0, focused: 0, searches: 0 };
    analytics.daily[today].blocked += 1;
    analytics.categories[category] = (analytics.categories[category] || 0) + 1;
    await Storage.set({ analytics });

    await Storage.addHistory({
      category: 'block',
      type: 'blocked',
      description: `Blocked attempt to visit ${host} (${category})`,
      severity: 'medium'
    });

    const graceData = await Storage.get('gracePeriod');
    const graceSeconds = graceData.gracePeriod ?? 5;

    const target = `${blockedPage}?domain=${encodeURIComponent(host)}`;
    chrome.tabs.update(details.tabId, { url: target });
    pendingGracePeriods.set(details.tabId, {
      domain: host,
      startTime: Date.now(),
      graceSeconds,
      completed: false
    });
  }
}

chrome.webNavigation.onBeforeNavigate.addListener(handleNavigation, { url: [{ schemes: ["http", "https"] }] });
chrome.webNavigation.onHistoryStateUpdated.addListener(handleNavigation, { url: [{ schemes: ["http", "https"] }] });

// Also catch chrome-extension navigations leaving blocked (e.g. to dashboard)
chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return;
  if (!pendingGracePeriods.has(details.tabId)) return;

  const blockedPage = BLOCKED_PAGE();
  const lockedPage = LOCKED_PAGE();
  const url = details.url || "";

  if (url.startsWith(blockedPage) || url.startsWith(lockedPage)) return;

  const pending = pendingGracePeriods.get(details.tabId);
  const elapsed = (Date.now() - (pending?.startTime || 0)) / 1000;
  const grace = pending?.graceSeconds ?? 5;

  if (url === "about:blank" && elapsed <= grace) {
    pendingGracePeriods.delete(details.tabId);
    return;
  }

  await applyBypassPenalty(details.tabId);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (pendingGracePeriods.has(tabId)) {
    await applyBypassPenalty(tabId);
  }
});

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === LOCK_ALARM) {
    await clearLock({ emergency: true }); // timer expiry is allowed
    // Force unlock on alarm regardless of reason
    isLocked = false;
    lockEndTime = 0;
    lockStartedAt = 0;
    allowedSiteDuringLock = null;
    lockReason = null;
    await Storage.set({ lockEndTime: 0, lockStartedAt: 0, allowedSite: null, lockReason: null });
    updateBadge();

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon128.png",
      title: "Purity Lock",
      message: "Lock expired. Stay strong."
    });
  }
});

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === "install") {
    chrome.tabs.create({ url: chrome.runtime.getURL("pages/onboarding.html") });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    await ready;
    switch (message.type) {
      case "GET_STATE": {
        const data = await Storage.get(null);
        sendResponse({
          ...data,
          isLocked,
          lockEndTime,
          lockStartedAt,
          allowedSite: allowedSiteDuringLock,
          lockReason
        });
        break;
      }
      case "START_LOCK": {
        // Mark grace complete so closing after intentional lock doesn't double-penalize
        if (sender.tab?.id != null && pendingGracePeriods.has(sender.tab.id)) {
          const p = pendingGracePeriods.get(sender.tab.id);
          p.completed = true;
          pendingGracePeriods.delete(sender.tab.id);
        }
        await startLock(message.minutes, message.allowedSite, message.reason, { force: true });
        sendResponse({ ok: true });
        break;
      }
      case "CLEAR_LOCK": {
        const result = await clearLock({ emergency: !!message.emergency });
        if (result.ok && message.emergency) {
          const stats = await Storage.get(['emergencyUnlocksUsedToday']);
          await Storage.set({ emergencyUnlocksUsedToday: (stats.emergencyUnlocksUsedToday || 0) + 1 });
          await Storage.addHistory({
            category: 'security',
            description: 'Emergency unlock used',
            severity: 'high'
          });
        }
        sendResponse(result);
        break;
      }
      case "GET_VERSES": {
        try {
          const versesResponse = await fetch(VERSES_URL);
          const verses = await versesResponse.json();
          sendResponse({ verses });
        } catch (e) {
          sendResponse({ verses: [] });
        }
        break;
      }
      case "UPDATE_WHITELIST": {
        whitelist = new Set((message.list || []).map(normalizeDomain).filter(isDomain));
        await Storage.set({ whitelist: [...whitelist] });
        sendResponse({ ok: true });
        break;
      }
      case "SAVE_REFLECTION": {
        await Storage.addHistory({
          category: 'reflection',
          description: `Reflection saved: ${(message.text || '').slice(0, 50)}...`,
          severity: 'low'
        });
        sendResponse({ ok: true });
        break;
      }
      case "GRACE_VOLUNTARY_LEAVE": {
        // Called by blocked page "I'll leave now" during grace
        if (sender.tab?.id != null) {
          pendingGracePeriods.delete(sender.tab.id);
        }
        sendResponse({ ok: true });
        break;
      }
      case "SKIP_TIMER": {
        // HARD DISABLED — no debug skip in production
        sendResponse({ ok: false, error: "disabled" });
        break;
      }
      case "SEARCH_DECISION": {
        if (message.decision === 'yes') {
          await startLock(10, null, 'search_prevention', { force: true });
          await Storage.set({ searchEscalationLevel: 1 });
          sendResponse({ ok: true, redirect: 'locked.html' });
        } else {
          await Storage.set({ searchEscalationLevel: 1 });
          sendResponse({ ok: true });
        }
        break;
      }
      default:
        sendResponse({ ok: false, error: "Unknown message type" });
    }
  })();
  return true;
});

setInterval(updateBadge, 30000);
