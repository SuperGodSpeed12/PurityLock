/* ==========================================================================
   PURITY LOCK — Appearance Controller
   Handles: theme presets, custom accent color, font selection, light/dark
   mode, reduced motion & high contrast toggles. Persists to localStorage
   and exposes a small public API (window.PurityAppearance) that the
   Settings → Appearance screen can call directly.
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "purityLock.appearance";
  const ROOT = document.documentElement;

  /* ------------------------------------------------------------------
     Preset catalogue — mirrors the Theme Gallery cards in the UI.
     Add/remove entries here and the settings panel (built at the
     bottom of this file) updates automatically.
     ------------------------------------------------------------------ */
  const THEME_PRESETS = [
    { id: "royal-blue", label: "Royal Blue", swatch: "linear-gradient(135deg,#2D6BFF,#59C7FF)" },
    { id: "midnight",   label: "Midnight",   swatch: "linear-gradient(135deg,#4A3FE0,#8B7CFF)" },
    { id: "amber",      label: "Amber",      swatch: "linear-gradient(135deg,#D8912A,#FBBF24)" },
    { id: "emerald",    label: "Emerald",    swatch: "linear-gradient(135deg,#0E9E6E,#34D399)" },
    { id: "lavender",   label: "Lavender",   swatch: "linear-gradient(135deg,#7C5CE0,#B79CFF)" },
    { id: "crimson",    label: "Crimson",    swatch: "linear-gradient(135deg,#C4293F,#F87171)" },
    { id: "ocean",      label: "Ocean",      swatch: "linear-gradient(135deg,#0A6E9E,#59C7FF)" },
    { id: "galaxy",     label: "Galaxy",     swatch: "linear-gradient(135deg,#5B2FC2,#E068C9)" },
  ];

  /* ------------------------------------------------------------------
     Font catalogue — one option per role. Each entry ships a Google
     Fonts URL (loaded lazily, once) plus the CSS font-family stack.
     Users can mix and match roles independently.
     ------------------------------------------------------------------ */
  const FONT_OPTIONS = {
    primary: [
      { id: "space-grotesk", label: "Space Grotesk", stack: "'Space Grotesk', sans-serif", gfont: "Space+Grotesk:wght@300;400;500;600;700" },
      { id: "inter",         label: "Inter",          stack: "'Inter', system-ui, sans-serif", gfont: "Inter:wght@300;400;500;600;700" },
      { id: "manrope",       label: "Manrope",        stack: "'Manrope', sans-serif", gfont: "Manrope:wght@300;400;500;600;700" },
      { id: "outfit",        label: "Outfit",         stack: "'Outfit', sans-serif", gfont: "Outfit:wght@300;400;500;600;700" },
    ],
    heading: [
      { id: "orbitron",      label: "Orbitron",       stack: "'Orbitron', sans-serif", gfont: "Orbitron:wght@600;700;800;900" },
      { id: "audiowide",     label: "Audiowide",      stack: "'Audiowide', sans-serif", gfont: "Audiowide" },
      { id: "michroma",      label: "Michroma",       stack: "'Michroma', sans-serif", gfont: "Michroma" },
      { id: "space-grotesk-h", label: "Space Grotesk", stack: "'Space Grotesk', sans-serif", gfont: "Space+Grotesk:wght@600;700" },
    ],
    stat: [
      { id: "rajdhani",      label: "Rajdhani",       stack: "'Rajdhani', sans-serif", gfont: "Rajdhani:wght@500;600;700" },
      { id: "oxanium",       label: "Oxanium",        stack: "'Oxanium', sans-serif", gfont: "Oxanium:wght@500;600;700" },
      { id: "orbitron-s",    label: "Orbitron",       stack: "'Orbitron', sans-serif", gfont: "Orbitron:wght@600;700" },
    ],
    serif: [
      { id: "cormorant",     label: "Cormorant Garamond", stack: "'Cormorant Garamond', serif", gfont: "Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400" },
      { id: "libre-baskerville", label: "Libre Baskerville", stack: "'Libre Baskerville', serif", gfont: "Libre+Baskerville:ital,wght@0,400;1,400" },
      { id: "eb-garamond",   label: "EB Garamond",    stack: "'EB Garamond', serif", gfont: "EB+Garamond:ital,wght@0,400;0,500;1,400" },
    ],
  };

  const DEFAULTS = {
    theme: "royal-blue",
    mode: "dark",
    customAccent: null,      // hex string when the user picks a custom color
    fonts: { primary: "space-grotesk", heading: "orbitron", stat: "rajdhani", serif: "cormorant" },
    reducedMotion: false,
    highContrast: false,
  };

  let state = loadState();
  const loadedFonts = new Set();

  /* ------------------------------ storage ------------------------------ */
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return Object.assign({}, DEFAULTS, saved, { fonts: Object.assign({}, DEFAULTS.fonts, saved && saved.fonts) });
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  /* ------------------------------ color math ---------------------------- */
  function hexToHsl(hex) {
    hex = hex.replace("#", "");
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
  }

  /* ------------------------------ font loading --------------------------- */
  function ensureFontLoaded(gfont) {
    if (!gfont || loadedFonts.has(gfont)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${gfont}&display=swap`;
    document.head.appendChild(link);
    loadedFonts.add(gfont);
  }

  function findFont(role, id) {
    return (FONT_OPTIONS[role] || []).find((f) => f.id === id) || FONT_OPTIONS[role][0];
  }

  /* ------------------------------ apply ---------------------------------- */
  function applyAll() {
    // Theme preset (sets the base accent hue/sat/light + bg tint via CSS)
    ROOT.setAttribute("data-theme", state.theme);
    ROOT.setAttribute("data-mode", state.mode);
    ROOT.setAttribute("data-reduced-motion", String(state.reducedMotion));
    ROOT.setAttribute("data-high-contrast", String(state.highContrast));

    // Custom accent overrides the preset hue/sat/light directly
    if (state.customAccent) {
      const { h, s, l } = hexToHsl(state.customAccent);
      ROOT.style.setProperty("--accent-hue", h);
      ROOT.style.setProperty("--accent-sat", s + "%");
      ROOT.style.setProperty("--accent-light", l + "%");
    } else {
      ROOT.style.removeProperty("--accent-hue");
      ROOT.style.removeProperty("--accent-sat");
      ROOT.style.removeProperty("--accent-light");
    }

    // Fonts
    Object.keys(state.fonts).forEach((role) => {
      const font = findFont(role, state.fonts[role]);
      ensureFontLoaded(font.gfont);
      ROOT.style.setProperty(`--font-${role === "primary" ? "primary" : role === "heading" ? "heading" : role === "stat" ? "stat" : "serif"}`, font.stack);
    });

    document.dispatchEvent(new CustomEvent("purity:appearance-change", { detail: structuredClone(state) }));
  }

  /* ------------------------------ public API ------------------------------ */
  const api = {
    getState: () => structuredClone(state),
    getThemes: () => THEME_PRESETS,
    getFontOptions: (role) => FONT_OPTIONS[role] || [],

    setTheme(themeId) {
      state.theme = themeId;
      state.customAccent = null; // preset overrides any custom pick
      saveState(); applyAll();
    },

    setCustomAccent(hex) {
      state.customAccent = hex;
      saveState(); applyAll();
    },

    setMode(mode) { // "dark" | "light"
      state.mode = mode;
      saveState(); applyAll();
    },

    setFont(role, fontId) {
      if (!FONT_OPTIONS[role]) return;
      state.fonts[role] = fontId;
      saveState(); applyAll();
    },

    setReducedMotion(on) { state.reducedMotion = !!on; saveState(); applyAll(); },
    setHighContrast(on) { state.highContrast = !!on; saveState(); applyAll(); },

    reset() {
      state = Object.assign({}, DEFAULTS, { fonts: Object.assign({}, DEFAULTS.fonts) });
      saveState(); applyAll();
    },

    /* Renders a ready-to-use Appearance settings panel into `container`.
       Optional — call this once from Settings, or build your own UI
       against the API above. */
    mountSettingsPanel(container) {
      if (!container) return;
      container.innerHTML = "";

      const section = (title) => {
        const h = document.createElement("h3");
        h.textContent = title;
        h.style.marginTop = "1.5rem";
        return h;
      };

      // Theme gallery
      container.appendChild(section("Theme"));
      const grid = document.createElement("div");
      grid.className = "swatch-grid";
      THEME_PRESETS.forEach((t) => {
        const el = document.createElement("div");
        el.className = "swatch" + (!state.customAccent && state.theme === t.id ? " selected" : "");
        el.style.background = t.swatch;
        el.innerHTML = `<span>${t.label}</span>`;
        el.addEventListener("click", () => { api.setTheme(t.id); api.mountSettingsPanel(container); });
        grid.appendChild(el);
      });
      container.appendChild(grid);

      // Custom color
      container.appendChild(section("Custom Accent Color"));
      const row = document.createElement("div");
      row.className = "color-picker-row";
      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = state.customAccent || "#2D6BFF";
      colorInput.addEventListener("input", (e) => api.setCustomAccent(e.target.value));
      const label = document.createElement("span");
      label.className = "text-secondary";
      label.textContent = "Pick any color — every glow, ring and gradient re-tints instantly.";
      row.appendChild(colorInput);
      row.appendChild(label);
      container.appendChild(row);

      // Fonts
      const roleLabels = { primary: "Interface Font", heading: "Heading Font", stat: "Timer / Stats Font", serif: "Scripture Font" };
      Object.keys(FONT_OPTIONS).forEach((role) => {
        container.appendChild(section(roleLabels[role]));
        const fgrid = document.createElement("div");
        fgrid.className = "swatch-grid";
        fgrid.style.gridTemplateColumns = "repeat(auto-fill, minmax(150px, 1fr))";
        FONT_OPTIONS[role].forEach((f) => {
          const opt = document.createElement("div");
          opt.className = "font-option" + (state.fonts[role] === f.id ? " selected" : "");
          opt.innerHTML = `<div class="font-sample" style="font-family:${f.stack}">Aa Purity</div><div class="font-name">${f.label}</div>`;
          opt.addEventListener("click", () => { api.setFont(role, f.id); api.mountSettingsPanel(container); });
          fgrid.appendChild(opt);
        });
        container.appendChild(fgrid);
      });

      // Accessibility toggles
      container.appendChild(section("Accessibility"));
      const toggles = [
        { key: "reducedMotion", label: "Reduce motion", setter: api.setReducedMotion },
        { key: "highContrast", label: "High contrast", setter: api.setHighContrast },
      ];
      toggles.forEach(({ key, label: lbl, setter }) => {
        const wrap = document.createElement("div");
        wrap.className = "flex items-center justify-between";
        wrap.style.margin = "0.6rem 0";
        wrap.innerHTML = `<span>${lbl}</span>`;
        const toggle = document.createElement("label");
        toggle.className = "toggle";
        toggle.innerHTML = `<input type="checkbox" ${state[key] ? "checked" : ""}><span class="toggle-track"></span>`;
        toggle.querySelector("input").addEventListener("change", (e) => setter(e.target.checked));
        wrap.appendChild(toggle);
        container.appendChild(wrap);
      });

      // Reset
      const resetBtn = document.createElement("button");
      resetBtn.className = "btn btn-ghost";
      resetBtn.style.marginTop = "1.5rem";
      resetBtn.textContent = "Reset to defaults";
      resetBtn.addEventListener("click", () => { api.reset(); api.mountSettingsPanel(container); });
      container.appendChild(resetBtn);
    },
  };

  // Apply saved appearance immediately (before first paint if script is in <head>)
  applyAll();

  window.PurityAppearance = api;
})();
