function formatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function refresh() {
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (state) => {
    if (!state || !state.isLocked) {
      window.location.href = 'dashboard.html';
      return;
    }

    document.body.setAttribute('data-theme', state.theme || 'dark');
    document.documentElement.style.setProperty('--accent-hue', state.accentHue || 217);

    const remaining = state.lockEndTime - Date.now();
    if (remaining <= 0) {
      window.location.href = 'dashboard.html';
      return;
    }

    document.getElementById("timer").textContent = formatTime(remaining);

    document.getElementById('streak-val').textContent = state.stats?.streak || 0;
    document.getElementById('hours-saved').textContent = (state.stats?.hoursSaved || 0).toFixed(1);

    const circle = document.getElementById('timer-fg');
    if (circle) {
      const circumference = 2 * Math.PI * 125;
      const total = state.lockEndTime - state.lockStartedAt;
      const elapsed = Date.now() - state.lockStartedAt;
      const pct = total > 0 ? Math.min(1, elapsed / total) : 0;
      circle.style.strokeDashoffset = circumference * pct;
    }

    const allowedEl = document.getElementById("allowed-site");
    if (state.allowedSite) {
      if (allowedEl) allowedEl.textContent = state.allowedSite;
      document.getElementById("allowed-info")?.classList.remove("hidden");
    } else {
      document.getElementById("allowed-info")?.classList.add("hidden");
    }

    const isPenalty = state.lockReason === "immediateExit" ||
      state.lockReason === "bypass_penalty" ||
      state.lockReason === "search_penalty";

    if (isPenalty) {
      document.getElementById("lock-title").textContent = "Strict Lock Active";
      document.getElementById("lock-description").textContent =
        "Access is restricted due to a penalty. This cannot be skipped.";
      // Never show finish-early or emergency for penalty locks
      document.getElementById('finish-early-section')?.classList.add('hidden');
      document.getElementById('emergency-section')?.classList.add('hidden');
    } else {
      if (state.lockReason === 'focus_session') {
        document.getElementById('finish-early-section')?.classList.remove('hidden');
      }
      if (
        state.emergencyUnlockEnabled !== false &&
        !state.strictMode &&
        (state.emergencyUnlocksUsedToday || 0) < (state.emergencyUnlockDailyLimit ?? 1)
      ) {
        document.getElementById('emergency-section')?.classList.remove('hidden');
      } else {
        document.getElementById('emergency-section')?.classList.add('hidden');
      }
    }

    // Always hide debug skip
    const skip = document.getElementById('skip-timer');
    if (skip) skip.style.display = 'none';
  });
}

document.getElementById('finish-early')?.addEventListener('click', () => {
  if (!confirm('Finish your focus session early?')) return;
  chrome.runtime.sendMessage({ type: "CLEAR_LOCK" }, (resp) => {
    if (resp?.ok) window.location.href = 'dashboard.html';
    else alert(resp?.error === 'penalty_lock'
      ? 'Penalty locks cannot be ended early.'
      : 'Could not end session.');
  });
});

document.getElementById('emergency-unlock')?.addEventListener('click', () => {
  let count = 0;
  const btn = document.getElementById('emergency-unlock');
  btn.disabled = true;
  const waitInterval = setInterval(() => {
    count++;
    btn.textContent = `Wait ${60 - count}s…`;
    if (count >= 60) {
      clearInterval(waitInterval);
      btn.disabled = false;
      btn.textContent = 'Confirm Emergency Unlock';
      btn.onclick = () => {
        if (confirm('Confirmation 1/3: Are you sure you need an emergency unlock?')) {
          if (confirm('Confirmation 2/3: This will be logged and counts against your daily limit.')) {
            if (confirm('Confirmation 3/3: Unlock now?')) {
              chrome.runtime.sendMessage({ type: "CLEAR_LOCK", emergency: true }, (resp) => {
                if (resp?.ok) window.location.href = 'dashboard.html';
                else alert('Emergency unlock denied: ' + (resp?.error || 'unknown'));
              });
            }
          }
        }
      };
    }
  }, 1000);
});

// Skip timer permanently disabled
const skipBtn = document.getElementById('skip-timer');
if (skipBtn) {
  skipBtn.style.display = 'none';
  skipBtn.replaceWith(skipBtn.cloneNode(true)); // strip listeners
}

refresh();
setInterval(refresh, 1000);
