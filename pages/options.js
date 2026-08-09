const toast = document.getElementById("toast");
function showToast(message, error = false) {
  toast.textContent = message;
  toast.className = `toast show${error ? " error" : ""}`;
  setTimeout(() => { toast.className = "toast"; }, 3200);
}

async function hashPin(pin) {
  const bytes = new TextEncoder().encode(pin);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

chrome.runtime.sendMessage({ type: "GET_STATE" }, state => {
  if (!state) return;
  document.getElementById("whitelist").value = (state.whitelist || []).join("\n");
  document.getElementById("status-title").textContent = state.isLocked ? "Lock running" : "Protection active";
  document.getElementById("status-detail").textContent = state.isLocked
    ? (state.lockReason === "immediateExit" ? "Strict lock: no websites are available until the timer ends." : `Only ${state.allowedSite || "the selected domain"} is available until the timer ends.`)
    : "The blocklist and saved settings are ready.";
  if (state.isLocked) {
    document.querySelectorAll(".setting-card input, .setting-card textarea, .setting-card button").forEach(el => { el.disabled = true; });
  }
});

chrome.storage.local.get("customVerses", data => {
  if (data.customVerses) document.getElementById("verses").value = JSON.stringify(data.customVerses, null, 2);
});

document.getElementById("save-whitelist").addEventListener("click", () => {
  const list = document.getElementById("whitelist").value.split("\n").map(value => value.trim()).filter(Boolean);
  chrome.runtime.sendMessage({ type: "UPDATE_WHITELIST", list }, response => {
    showToast(response && response.ok ? "Whitelist saved." : "Whitelist could not be saved.", !(response && response.ok));
  });
});

document.getElementById("save-pin").addEventListener("click", async () => {
  const pin = document.getElementById("pin").value.trim();
  const pinHash = pin ? await hashPin(pin) : null;
  chrome.runtime.sendMessage({ type: "SET_PIN", pinHash }, response => {
    if (response && response.ok) {
      document.getElementById("pin").value = "";
      showToast(pin ? "PIN saved." : "PIN removed.");
    } else showToast("PIN could not be saved.", true);
  });
});

document.getElementById("save-verses").addEventListener("click", () => {
  const raw = document.getElementById("verses").value.trim();
  if (!raw) {
    chrome.runtime.sendMessage({ type: "UPDATE_VERSES", verses: null }, response => {
      showToast(response && response.ok ? "Default verses restored." : "Verses could not be updated.", !(response && response.ok));
    });
    return;
  }
  try {
    const verses = JSON.parse(raw);
    if (!Array.isArray(verses) || !verses.every(v => v && typeof v.text === "string" && typeof v.ref === "string")) throw new Error();
    chrome.runtime.sendMessage({ type: "UPDATE_VERSES", verses }, response => {
      showToast(response && response.ok ? "Custom verses saved." : "Verses could not be saved.", !(response && response.ok));
    });
  } catch { showToast("Use an array of objects with text and ref fields.", true); }
});

document.getElementById("test-recovery").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "TEST_RECOVERY" }, response => {
    showToast(response && response.ok ? "Opening test recovery flow…" : "Test flow could not be opened.", !(response && response.ok));
  });
});
