/**
 * Vault 2.0 - Offline Credentials Manager
 * Optimized and Modular JavaScript Implementation
 */

// ========================================
// PART 1: APPLICATION STATE & CONSTANTS
// ========================================

// Application state object
let state = {
  masterPassword: null,
  isLocked: true,
  hasVault: false,
  decryptedData: null,
  currentCategory: "passwords",
  selectedItemId: null,
  searchTerm: "",
  showFavorites: false,
  viewState: {},
  lockedDueToInactivity: false,
  // Indicates the vault was previously unlocked and a page refresh caused relock
  lockedDueToRefresh: false,
  lockedDueToManual: false,
};

// Categories configuration
const CATEGORIES = {
  passwords: {
    name: "Website Logins",
    icon: "key",
    color: "text-blue-600 dark:text-blue-400",
  },
  cards: {
    name: "Bank Cards",
    icon: "credit-card",
    color: "text-green-600 dark:text-green-400",
  },
  identities: {
    name: "Government IDs",
    icon: "user",
    color: "text-purple-600 dark:text-purple-400",
  },
  notes: {
    name: "Secure Notes",
    icon: "file-text",
    color: "text-orange-600 dark:text-orange-400",
  },
};

// Special navigation items (non-data categories)
const SPECIAL_CATEGORIES = {
  passwordGenerator: {
    name: "Password Generator",
    icon: "star",
    color: "text-yellow-600 dark:text-yellow-400",
  },
  profile: {
    name: "Profile & Security",
    icon: "settings",
    color: "text-gray-600 dark:text-gray-400",
  },
};

// Auto-logout timer
let autoLogoutTimer = null;
const AUTO_LOGOUT_DELAY = 60000; // 1 minute (default)

// Auto logout time options (in minutes)
// Auto logout time options (in minutes) - ordered array to ensure correct display order
const AUTO_LOGOUT_OPTIONS = [
  { key: 1, label: "1 min", value: 1 },
  { key: 3, label: "3 min", value: 3 },
  { key: 5, label: "5 min", value: 5 },
  { key: 10, label: "10 min", value: 10 },
  { key: 0, label: "Disabled", value: 0 },
];

// Password history storage
let passwordHistory = JSON.parse(
  localStorage.getItem("passwordHistory") || "[]"
);

// Enhanced toast system (app view only; lock screen banners remain unchanged)
function showToast(message, type = "info", timeout = 2200) {
  try {
    // Don't show toasts over lock screen (lock screen has its own UX); queue later if needed
    if (state.isLocked) {
      return; // silent ignore while locked
    }

    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      Object.assign(container.style, {
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "clamp(260px, 420px, 90vw)",
        pointerEvents: "none",
      });
      document.body.appendChild(container);
    }

    // Use theme primary color (and slight variants) instead of per-type colors
    const basePrimary =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--primary-600")
        .trim() || "#6366f1";
    const altPrimary =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--primary-700")
        .trim() || basePrimary;
    const colors = { base: basePrimary, ring: altPrimary };

    const toast = document.createElement("div");
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.className = "vault-toast";
    Object.assign(toast.style, {
      position: "relative",
      display: "flex",
      alignItems: "flex-start",
      gap: "10px",
      background: `linear-gradient(135deg, ${colors.base}, ${colors.ring})`,
      color: "#fff",
      padding: "12px 14px 14px 14px",
      borderRadius: "14px",
      boxShadow:
        "0 4px 12px -2px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)",
      fontSize: "14px",
      fontWeight: 500,
      lineHeight: 1.3,
      opacity: "0",
      transform: "translateY(6px) scale(.96)",
      transition:
        "opacity .35s cubic-bezier(.4,0,.2,1), transform .45s cubic-bezier(.34,1.56,.64,1)",
      pointerEvents: "auto",
      overflow: "hidden",
    });

    // Icon bubble
    const iconWrap = document.createElement("div");
    Object.assign(iconWrap.style, {
      width: "26px",
      height: "26px",
      borderRadius: "8px",
      background: "rgba(255,255,255,0.15)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      backdropFilter: "blur(2px)",
    });
    // Unified icon style (single icon)
    iconWrap.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';

    const msgWrap = document.createElement("div");
    msgWrap.style.flex = "1";
    msgWrap.style.paddingRight = "4px";
    msgWrap.textContent = message;

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Dismiss notification");
    Object.assign(closeBtn.style, {
      background: "rgba(255,255,255,0.15)",
      color: "#fff",
      border: "none",
      width: "26px",
      height: "26px",
      borderRadius: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      cursor: "pointer",
      transition: "background .25s",
      flexShrink: 0,
      marginTop: "-2px",
    });
    closeBtn.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    closeBtn.onmouseenter = () =>
      (closeBtn.style.background = "rgba(255,255,255,0.25)");
    closeBtn.onmouseleave = () =>
      (closeBtn.style.background = "rgba(255,255,255,0.15)");

    // Progress bar
    const progress = document.createElement("div");
    Object.assign(progress.style, {
      position: "absolute",
      left: 0,
      bottom: 0,
      height: "3px",
      width: "100%",
      background: "rgba(255,255,255,0.25)",
      overflow: "hidden",
    });
    const bar = document.createElement("div");
    Object.assign(bar.style, {
      height: "100%",
      width: "100%",
      background: "rgba(255,255,255,0.9)",
      transform: "translateX(0)",
      transition: `transform ${timeout}ms linear`,
    });
    progress.appendChild(bar);

    toast.appendChild(iconWrap);
    toast.appendChild(msgWrap);
    toast.appendChild(closeBtn);
    toast.appendChild(progress);
    container.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0) scale(1)";
      bar.style.transform = "translateX(-100%)"; // animate timer
    });

    let removalTimer = setTimeout(dismiss, timeout + 80); // small buffer
    let removed = false;

    function dismiss() {
      if (removed) return;
      removed = true;
      toast.style.opacity = "0";
      toast.style.transform = "translateY(4px) scale(.95)";
      setTimeout(() => toast.remove(), 380);
    }

    closeBtn.addEventListener("click", () => {
      clearTimeout(removalTimer);
      dismiss();
    });

    // Pause on hover
    toast.addEventListener("mouseenter", () => {
      clearTimeout(removalTimer);
      bar.style.transition = "none";
      const computed = getComputedStyle(bar).transform;
      bar.dataset.transform = computed;
    });
    toast.addEventListener("mouseleave", () => {
      // resume remaining (approximate by remaining width)
      const remaining =
        bar.getBoundingClientRect().width /
        progress.getBoundingClientRect().width;
      const remainingMs = timeout * remaining;
      bar.style.transition = `transform ${remainingMs}ms linear`;
      bar.style.transform = "translateX(-100%)";
      removalTimer = setTimeout(dismiss, remainingMs + 120);
    });
  } catch (err) {
    console.log(message);
  }
}

// ========================================
// PART 2: ENCRYPTION & UTILITY FUNCTIONS
// ========================================

/**
 * Encrypt data using AES
 */
function encrypt(data, password) {
  try {
    const encrypted = CryptoJS.AES.encrypt(
      JSON.stringify(data),
      password
    ).toString();
    return encrypted;
  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt data");
  }
}
/**
 * Decrypt data using AES
 */
function decrypt(encryptedData, password) {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedData, password);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);
    if (!decryptedString) return null;
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error("Decryption error:", error);
    return null;
  }
}

// Derive a binding hash that couples the security question text with the answer.
// This prevents silently swapping a different question while keeping the same answer for an old backup.
function computeSecurityQABinding(question, answer) {
  try {
    return CryptoJS.SHA256((question || "") + "||" + (answer || "")).toString();
  } catch (e) {
    return null;
  }
}

/**
 * Generate a unique ID for items
 */
function generateId() {
  // 16 chars: timestamp base36 + random segment
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  ).toUpperCase();
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Reset auto-logout timer
 */
function resetAutoLogoutTimer() {
  if (autoLogoutTimer) {
    clearTimeout(autoLogoutTimer);
  }
  if (!state.isLocked) {
    // Get auto logout setting from user settings or default to 1 minute
    const autoLogoutMinutes =
      state.decryptedData?.settings?.autoLogoutMinutes ??
      localStorage.getItem("autoLogoutMinutes") ??
      1;

    // If disabled (0), don't set timer
    if (autoLogoutMinutes === 0 || autoLogoutMinutes === "0") {
      return;
    }

    autoLogoutTimer = setTimeout(() => {
      state.isLocked = true;
      // Close any open modals when locking for security (import/export, verification, etc.)
      try {
        closeAllModals();
      } catch (_) {}
      state.masterPassword = null;
      state.decryptedData = null;
      state.selectedItemId = null;
      state.lockedDueToInactivity = true;
      state.lockedDueToRefresh = false;
      try {
        localStorage.removeItem("vaultWasUnlocked");
      } catch (_) {}
      state.lockedDueToManual = false;
      try {
        localStorage.setItem("vaultLockReason", "inactivity");
      } catch (_) {}
      render();
    }, parseInt(autoLogoutMinutes) * 60000); // Convert minutes to milliseconds
  }
}
try {
  closeAllModals();
} catch (_) {}

// ========================================
// PART 3: DATA PERSISTENCE
// ========================================

/**
 * Save encrypted data to localStorage
 */
function saveData() {
  if (!state.decryptedData || !state.masterPassword) return;

  try {
    const encryptedData = encrypt(state.decryptedData, state.masterPassword);
    localStorage.setItem("vaultData", encryptedData);
  } catch (error) {
    console.error("Failed to save data:", error);
    showToast("Failed to save data", "error");
  }
}

/**
 * Load and decrypt data from localStorage
 */
function loadData(password) {
  try {
    const encryptedData = localStorage.getItem("vaultData");
    if (!encryptedData) return null;

    return decrypt(encryptedData, password);
  } catch (error) {
    console.error("Failed to load data:", error);
    return null;
  }
}

/**
 * Save view state (current category, search, etc.)
 */
function saveViewState() {
  const viewState = {
    currentCategory: state.currentCategory,
    searchTerm: state.searchTerm,
    showFavorites: state.showFavorites,
  };
  localStorage.setItem("vaultViewState", JSON.stringify(viewState));
}

/**
 * Load view state
 */
function loadViewState() {
  try {
    const saved = localStorage.getItem("vaultViewState");
    if (saved) {
      const viewState = JSON.parse(saved);
      state.currentCategory = viewState.currentCategory || "passwords";
      state.searchTerm = viewState.searchTerm || "";
      state.showFavorites = viewState.showFavorites || false;
    }
  } catch (error) {
    console.error("Failed to load view state:", error);
  }
}

/**
 * Initialize default data structure
 */
function initializeDefaultData() {
  return {
    passwords: [],
    cards: [],
    identities: [],
    notes: [],
    user: {
      name: "",
      email: "",
      securityQuestion: "",
      securityAnswer: "",
      created: new Date().toISOString(),
    },
    settings: {
      autoLockTimeout: 60000,
      theme: "auto",
      passwordLength: 16,
      includeSymbols: true,
      includeNumbers: true,
      includeUppercase: true,
      includeLowercase: true,
      accentTheme: "indigo", // new accent (primary) color theme key
      accentCustomBase: null, // base hex when using custom
      autoLogoutMinutes: 1, // auto logout time in minutes (0 = disabled)
    },
  };
}

// ========================================
// PART 4: THEME MANAGEMENT
// ========================================

/**
 * Update favicon color
 * @param {string} color - The color to use ('error', 'normal', or custom hex color)
 */
function updateFaviconColor(color = "normal") {
  let iconColor;

  if (color === "error") {
    // Red favicon for error states
    iconColor = "%23ef4444"; // Red color
  } else if (color === "normal") {
    // Normal favicon based on current theme
    const theme = localStorage.getItem("theme") || "auto";
    const root = document.documentElement;

    if (theme === "greyscale") {
      iconColor = "%23666666"; // Medium gray for greyscale theme
    } else {
      // Get current accent theme color from CSS custom property
      const primaryColor = getComputedStyle(root)
        .getPropertyValue("--primary-600")
        .trim();
      if (primaryColor) {
        // Convert RGB values to hex
        const rgbMatch = primaryColor.match(/(\d+)\s+(\d+)\s+(\d+)/);
        if (rgbMatch) {
          const r = parseInt(rgbMatch[1]).toString(16).padStart(2, "0");
          const g = parseInt(rgbMatch[2]).toString(16).padStart(2, "0");
          const b = parseInt(rgbMatch[3]).toString(16).padStart(2, "0");
          iconColor = `%23${r}${g}${b}`;
        } else {
          // Fallback to default indigo if parsing fails
          const isDark = root.classList.contains("dark");
          iconColor = isDark ? "%23A78BFA" : "%234F46E5"; // purple-400 : indigo-600
        }
      } else {
        // Fallback to default indigo if CSS property not found
        const isDark = root.classList.contains("dark");
        iconColor = isDark ? "%23A78BFA" : "%234F46E5"; // purple-400 : indigo-600
      }
    }
  } else {
    // Custom color provided
    iconColor = color.replace("#", "%23");
  }

  // Update favicon
  let favicon = document.getElementById("app-favicon");
  if (!favicon) {
    favicon =
      document.querySelector('link[rel="icon"]') ||
      document.querySelector('link[rel="shortcut icon"]');
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      favicon.id = "app-favicon";
      document.head.appendChild(favicon);
    } else if (!favicon.id) {
      favicon.id = "app-favicon";
    }
  }

  if (favicon) {
    favicon.href = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${iconColor}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='11' width='18' height='11' rx='2' ry='2'/%3E%3Cpath d='M7 11V7a5 5 0 0 1 10 0v4'/%3E%3C/svg%3E`;

    // Force browser to update favicon
    const currentHref = favicon.href;
    favicon.href = "";
    setTimeout(() => (favicon.href = currentHref), 1);
  }
}

/**
 * Apply theme to document
 */
function applyTheme(theme) {
  const root = document.documentElement;

  // Remove existing theme classes
  root.classList.remove("dark");
  root.classList.remove("greyscale");

  // Apply theme
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "greyscale") {
    root.classList.add("greyscale");
  } else if (theme === "auto") {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    }
  }

  // Update favicon color based on theme
  updateFaviconColor("normal");

  // Save theme preference
  localStorage.setItem("theme", theme);

  // Update theme button states
  updateThemeButtonStates(theme);
}

/**
 * Update theme button active states
 */
function updateThemeButtonStates(activeTheme) {
  const themeButtons = {
    light: document.querySelectorAll("#theme-light, #theme-light-setup"),
    dark: document.querySelectorAll("#theme-dark, #theme-dark-setup"),
    auto: document.querySelectorAll("#theme-auto, #theme-auto-setup"),
    greyscale: document.querySelectorAll(
      "#theme-greyscale, #theme-greyscale-setup"
    ),
  };

  // Remove active class from all theme buttons
  Object.values(themeButtons).forEach((buttons) => {
    buttons.forEach((btn) => btn?.classList.remove("active"));
  });

  // Add active class to current theme buttons
  if (themeButtons[activeTheme]) {
    themeButtons[activeTheme].forEach((btn) => btn?.classList.add("active"));
  }
}

/**
 * Setup theme system
 */
function setupTheme() {
  const savedTheme = localStorage.getItem("theme") || "auto";
  applyTheme(savedTheme);

  // Listen for system theme changes when in auto mode
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      const currentTheme = localStorage.getItem("theme") || "auto";
      if (currentTheme === "auto") {
        applyTheme("auto");
      }
    });
}

// ========================================
// PART 4b: ACCENT (PRIMARY) COLOR THEMES
// ========================================

// 10 preset accent palettes (Tailwind-inspired) each providing the primary-50..900 scale
const ACCENT_THEMES = {
  indigo: {
    label: "Indigo",
    palette: {
      50: "238 242 255",
      100: "224 231 255",
      200: "199 210 254",
      300: "165 180 252",
      400: "129 140 248",
      500: "99 102 241",
      600: "79 70 229",
      700: "67 56 202",
      800: "55 48 163",
      900: "49 46 129",
    },
  },
  emerald: {
    label: "Emerald",
    palette: {
      50: "236 253 245",
      100: "209 250 229",
      200: "167 243 208",
      300: "110 231 183",
      400: "52 211 153",
      500: "16 185 129",
      600: "5 150 105",
      700: "4 120 87",
      800: "6 95 70",
      900: "6 78 59",
    },
  },
  rose: {
    label: "Rose",
    palette: {
      50: "255 241 242",
      100: "255 228 230",
      200: "254 205 211",
      300: "253 164 175",
      400: "251 113 133",
      500: "244 63 94",
      600: "225 29 72",
      700: "190 18 60",
      800: "159 18 57",
      900: "136 19 55",
    },
  },
  amber: {
    label: "Amber",
    palette: {
      50: "255 251 235",
      100: "254 243 199",
      200: "253 230 138",
      300: "252 211 77",
      400: "251 191 36",
      500: "245 158 11",
      600: "217 119 6",
      700: "180 83 9",
      800: "146 64 14",
      900: "120 53 15",
    },
  },
  violet: {
    label: "Violet",
    palette: {
      50: "245 243 255",
      100: "237 233 254",
      200: "221 214 254",
      300: "196 181 253",
      400: "167 139 250",
      500: "139 92 246",
      600: "124 58 237",
      700: "109 40 217",
      800: "91 33 182",
      900: "76 29 149",
    },
  },
  cyan: {
    label: "Cyan",
    palette: {
      50: "236 254 255",
      100: "207 250 254",
      200: "165 243 252",
      300: "103 232 249",
      400: "34 211 238",
      500: "6 182 212",
      600: "8 145 178",
      700: "14 116 144",
      800: "21 94 117",
      900: "22 78 99",
    },
  },
  slate: {
    label: "Slate",
    palette: {
      50: "248 250 252",
      100: "241 245 249",
      200: "226 232 240",
      300: "203 213 225",
      400: "148 163 184",
      500: "100 116 139",
      600: "71 85 105",
      700: "51 65 85",
      800: "30 41 59",
      900: "15 23 42",
    },
  },
  fuchsia: {
    label: "Fuchsia",
    palette: {
      50: "253 244 255",
      100: "250 232 255",
      200: "245 208 254",
      300: "240 171 252",
      400: "232 121 249",
      500: "217 70 239",
      600: "192 38 211",
      700: "162 28 175",
      800: "134 25 143",
      900: "112 26 117",
    },
  },
  lime: {
    label: "Lime",
    palette: {
      50: "247 254 231",
      100: "236 252 203",
      200: "217 249 157",
      300: "190 242 100",
      400: "163 230 53",
      500: "132 204 22",
      600: "101 163 13",
      700: "77 124 15",
      800: "63 98 18",
      900: "54 83 20",
    },
  },
};

// Apply a palette (object with numeric shade keys) to CSS variables
function setAccentPalette(palette) {
  const root = document.documentElement;
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].forEach((shade) => {
    const rgb = palette[shade];
    if (rgb) root.style.setProperty(`--primary-${shade}`, `rgb(${rgb})`);
  });
}

// Generate palette from a single base hex (approximation using lightness steps)
function generatePaletteFromBase(baseHex) {
  // Convert hex -> hsl
  const hex = baseHex.replace("#", "");
  const bigint = parseInt(hex, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  const toHsl = (r, g, b) => {
    const nr = r / 255,
      ng = g / 255,
      nb = b / 255;
    const max = Math.max(nr, ng, nb),
      min = Math.min(nr, ng, nb);
    let h,
      s,
      l = (max + min) / 2;
    if (max === min) {
      h = s = 0;
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case nr:
          h = (ng - nb) / d + (ng < nb ? 6 : 0);
          break;
        case ng:
          h = (nb - nr) / d + 2;
          break;
        case nb:
          h = (nr - ng) / d + 4;
          break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  };
  const { h, s } = toHsl(r, g, b); // ignore original lightness for scale
  const lightnessScale = {
    50: 96,
    100: 92,
    200: 85,
    300: 75,
    400: 65,
    500: 55,
    600: 48,
    700: 40,
    800: 32,
    900: 25,
  };
  const clamp = (n) => Math.max(0, Math.min(100, n));
  const palette = {};
  Object.entries(lightnessScale).forEach(([k, l]) => {
    palette[k] = hslToRgbString(h, s, l);
  });
  return palette;
}

function hslToRgbString(h, s, l) {
  h /= 360;
  s /= 100;
  l /= 100;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return `${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)}`;
}

function applyAccentTheme(themeKey, customBaseHex) {
  let palette;
  if (themeKey === "custom") {
    if (!customBaseHex) {
      const stored = localStorage.getItem("accentCustomBase") || "#6366f1";
      palette = generatePaletteFromBase(stored);
    } else {
      palette = generatePaletteFromBase(customBaseHex);
    }
  } else if (ACCENT_THEMES[themeKey]) {
    palette = ACCENT_THEMES[themeKey].palette;
  } else {
    palette = ACCENT_THEMES.indigo.palette;
    themeKey = "indigo";
  }
  setAccentPalette(palette);
  // Persist outside vault for lock screen / pre-unlock usage
  try {
    localStorage.setItem("accentTheme", themeKey);
    if (customBaseHex) localStorage.setItem("accentCustomBase", customBaseHex);
  } catch (_) {}
  // Persist inside decrypted vault settings if available
  if (state.decryptedData && state.decryptedData.settings) {
    state.decryptedData.settings.accentTheme = themeKey;
    if (customBaseHex)
      state.decryptedData.settings.accentCustomBase = customBaseHex;
    saveData();
  }
  // Update favicon to match new accent theme
  updateFaviconColor("normal");
  // Update favicon to match new accent theme
  updateFaviconColor("normal");
  // Refresh elements relying on computed primary color (e.g., toasts) by no-op reflow
  document.documentElement.dispatchEvent(
    new CustomEvent("accent-changed", { detail: { themeKey } })
  );
}

function loadAccentTheme() {
  // Priority: decrypted settings -> localStorage -> default
  let themeKey = "indigo";
  let customBase = null;
  if (state.decryptedData?.settings?.accentTheme) {
    themeKey = state.decryptedData.settings.accentTheme;
    customBase = state.decryptedData.settings.accentCustomBase;
  } else {
    themeKey = localStorage.getItem("accentTheme") || "indigo";
    customBase = localStorage.getItem("accentCustomBase");
  }
  applyAccentTheme(themeKey, customBase || undefined);
}

// ========================================
// PART 5: DOM ELEMENT REFERENCES
// ========================================

// Cache DOM elements for performance
let domElements = {};

/**
 * Initialize DOM element references
 */
function initializeDOMElements() {
  domElements = {
    // Main containers
    app: document.getElementById("app"),
    lockScreen: document.getElementById("lock-screen"),
    mainApp: document.getElementById("main-app"),

    // Lock screen elements
    lockScreenTitle: document.getElementById("lock-screen-title"),
    lockScreenSubtitle: document.getElementById("lock-screen-subtitle"),
    masterPasswordForm: document.getElementById("master-password-form"),
    userNameContainer: document.getElementById("user-name-container"),
    userName: document.getElementById("user-name"),
    masterPassword: document.getElementById("master-password"),
    confirmPasswordContainer: document.getElementById(
      "confirm-password-container"
    ),
    confirmMasterPassword: document.getElementById("confirm-master-password"),
    passwordError: document.getElementById("password-error"),
    unlockButton: document.getElementById("unlock-button"),
    createVaultButton: document.getElementById("create-vault-button"),
    forgotPasswordContainer: document.getElementById(
      "forgot-password-container"
    ),
    forgotPasswordBtn: document.getElementById("forgot-password-btn"),

    // Main app navigation
    navSidebar: document.getElementById("nav-sidebar"),
    categoryNav: document.getElementById("category-nav"),
    lockButton: document.getElementById("lock-button"),
    globalSearchBtn: document.getElementById("global-search-btn"),

    // Mobile navigation
    mobileMenuBtn: document.getElementById("mobile-menu-btn"),
    mobileOverlay: document.getElementById("mobile-overlay"),
    mobileBackBtn: document.getElementById("mobile-back-btn"),

    // Item list
    itemListContainer: document.getElementById("item-list-container"),
    itemListTitle: document.getElementById("item-list-title"),
    addNewItemBtn: document.getElementById("add-new-item-btn"),
    searchBar: document.getElementById("search-bar"),
    itemList: document.getElementById("item-list"),

    // Details pane
    detailsPaneContainer: document.getElementById("details-pane-container"),
    detailsPane: document.getElementById("details-pane"),
    detailsPlaceholder: document.getElementById("details-placeholder"),

    // Third panel
    thirdPanelContainer: document.getElementById("third-panel-container"),
    thirdPanel: document.getElementById("third-panel"),

    // Modals and backdrops
    modalBackdrop: document.getElementById("modal-backdrop"),
    forgotPasswordModal: document.getElementById("forgot-password-modal"),
    panicModal: document.getElementById("panic-modal"),
    importExportModal: document.getElementById("import-export-modal"),
    importVerificationModal: document.getElementById(
      "import-verification-modal"
    ),
    deleteConfirmModal: document.getElementById("delete-confirm-modal"),

    // Global search modal
    globalSearchBackdrop: document.getElementById("global-search-backdrop"),
    globalSearchModal: document.getElementById("global-search-modal"),
    globalSearchInput: document.getElementById("global-search-input"),
    globalSearchResults: document.getElementById("global-search-results"),
    globalSearchClose: document.getElementById("global-search-close"),

    // Theme buttons
    themeBtns: {
      light: document.querySelectorAll("#theme-light, #theme-light-setup"),
      dark: document.querySelectorAll("#theme-dark, #theme-dark-setup"),
      auto: document.querySelectorAll("#theme-auto, #theme-auto-setup"),
      greyscale: document.querySelectorAll(
        "#theme-greyscale, #theme-greyscale-setup"
      ),
    },

    // Footer elements
    autoLockFooterText: document.getElementById("auto-lock-footer-text"),
    importExportButton: document.getElementById("import-export-button"),
  };
}

// ========================================
// PART 6: PASSWORD GENERATION & ANALYSIS
// ========================================

/**
 * Generate and display password based on current settings
 */
function generateAndDisplayPassword() {
  const lengthSlider = document.getElementById("generator-length-slider");
  const optUppercase = document.getElementById("generator-opt-uppercase");
  const optLowercase = document.getElementById("generator-opt-lowercase");
  const optNumbers = document.getElementById("generator-opt-numbers");
  const optSymbols = document.getElementById("generator-opt-symbols");
  const output = document.getElementById("generator-output");

  if (!lengthSlider || !output) return;

  const length = lengthSlider.value;
  const chars = {
    uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lowercase: "abcdefghijklmnopqrstuvwxyz",
    numbers: "0123456789",
    symbols: "!@#$%^&*()_+~`|}{[]:;?><,./-=",
  };

  let charset = "";
  if (optUppercase?.checked) charset += chars.uppercase;
  if (optLowercase?.checked) charset += chars.lowercase;
  if (optNumbers?.checked) charset += chars.numbers;
  if (optSymbols?.checked) charset += chars.symbols;

  if (charset === "") {
    if (output) {
      output.value = "";
      output.placeholder = "Select at least one option";
    }
    updatePasswordStrength();
    return;
  }

  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  if (output) {
    output.value = password;
    output.placeholder = "";
  }

  savePasswordToHistory(password);
  updatePasswordStrength();
}

/**
 * Generate passphrase with random words
 */
function generatePassphrase() {
  const words = [
    "apple",
    "banana",
    "cherry",
    "dragon",
    "elephant",
    "forest",
    "guitar",
    "harmony",
    "island",
    "jungle",
    "keyboard",
    "lighthouse",
    "mountain",
    "network",
    "ocean",
    "puzzle",
    "quantum",
    "rainbow",
    "sunset",
    "thunder",
    "universe",
    "volcano",
    "whisper",
    "galaxy",
    "meadow",
    "crystal",
    "phoenix",
    "wizard",
    "castle",
    "bridge",
  ];
  const selectedWords = [];

  for (let i = 0; i < 4; i++) {
    const randomIndex = Math.floor(Math.random() * words.length);
    selectedWords.push(words[randomIndex]);
  }

  const passphrase = selectedWords.join("-") + Math.floor(Math.random() * 100);
  const output = document.getElementById("generator-output");
  if (output) {
    output.value = passphrase;
    output.placeholder = "";
    savePasswordToHistory(passphrase);
    updatePasswordStrength();
  }
}

/**
 * Generate numeric PIN
 */
function generatePIN() {
  const pin = Math.floor(Math.random() * 900000) + 100000; // 6-digit PIN
  const output = document.getElementById("generator-output");
  if (output) {
    output.value = pin.toString();
    output.placeholder = "";
    savePasswordToHistory(pin.toString());
    updatePasswordStrength();
  }
}

/**
 * Analyze password strength
 */
function analyzePasswordStrength(password) {
  if (!password || password === "Select at least one option") {
    return {
      score: 0,
      feedback: ["✗ No password generated", "✗ Please select character types"],
    };
  }

  let score = 0;
  const feedback = [];

  // Length scoring
  if (password.length >= 24) {
    score += 35;
    feedback.push("✓ Excellent length (24+ characters)");
  } else if (password.length >= 16) {
    score += 25;
    feedback.push("✓ Good length (16+ characters)");
  } else if (password.length >= 12) {
    score += 15;
    feedback.push("⚠ Moderate length (12+ characters)");
  } else {
    score += 5;
    feedback.push("✗ Too short (less than 12 characters)");
  }

  // Character variety
  if (/[A-Z]/.test(password)) {
    score += 20;
    feedback.push("✓ Contains uppercase letters");
  } else {
    feedback.push("✗ Missing uppercase letters");
  }

  if (/[a-z]/.test(password)) {
    score += 20;
    feedback.push("✓ Contains lowercase letters");
  } else {
    feedback.push("✗ Missing lowercase letters");
  }

  if (/[0-9]/.test(password)) {
    score += 15;
    feedback.push("✓ Contains numbers");
  } else {
    feedback.push("✗ Missing numbers");
  }

  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score += 20;
    feedback.push("✓ Contains symbols");
  } else {
    feedback.push("✗ Missing symbols");
  }

  // Bonus points for character diversity
  const uniqueChars = new Set(password).size;
  const complexityRatio = uniqueChars / password.length;
  if (complexityRatio > 0.7) {
    score += 10;
    feedback.push("✓ High character diversity");
  }

  return { score: Math.min(score, 100), feedback };
}

/**
 * Update password strength display
 */
function updatePasswordStrength() {
  const passwordInput = document.getElementById("generator-output");
  const strengthBar = document.getElementById("strength-bar");
  const strengthText = document.getElementById("strength-text");
  const strengthDetails = document.getElementById("strength-details");

  if (!passwordInput || !strengthBar || !strengthText || !strengthDetails)
    return;

  const password = passwordInput.value;
  const analysis = analyzePasswordStrength(password);

  // Update strength bar
  strengthBar.style.width = `${analysis.score}%`;

  // Use primary theme color for all strength states (one-color scheme)
  let strengthLabel = "Weak";
  if (analysis.score >= 90) {
    strengthLabel = "Best";
  } else if (analysis.score >= 75) {
    strengthLabel = "Strong";
  } else if (analysis.score >= 55) {
    strengthLabel = "Good";
  } else if (analysis.score >= 35) {
    strengthLabel = "Fair";
  }

  strengthBar.className = `h-2 rounded-full transition-all duration-300 bg-primary-600`;
  strengthText.textContent = strengthLabel;
  strengthText.className = `text-sm font-semibold text-primary-600`;
  strengthDetails.innerHTML = `<div class="space-y-1">${analysis.feedback
    .map((f) => `<div>${f}</div>`)
    .join("")}</div>`;
}

/**
 * Set password template based on use case
 */
window.setPasswordTemplate = function (template) {
  const lengthSlider = document.getElementById("generator-length-slider");
  const lengthValue = document.getElementById("generator-length-value");
  const uppercaseCheck = document.getElementById("generator-opt-uppercase");
  const lowercaseCheck = document.getElementById("generator-opt-lowercase");
  const numbersCheck = document.getElementById("generator-opt-numbers");
  const symbolsCheck = document.getElementById("generator-opt-symbols");

  switch (template) {
    case "web":
      lengthSlider.value = 16;
      uppercaseCheck.checked = true;
      lowercaseCheck.checked = true;
      numbersCheck.checked = true;
      symbolsCheck.checked = true;
      break;
    case "banking":
      lengthSlider.value = 24;
      uppercaseCheck.checked = true;
      lowercaseCheck.checked = true;
      numbersCheck.checked = true;
      symbolsCheck.checked = true;
      break;
    case "gaming":
      lengthSlider.value = 12;
      uppercaseCheck.checked = true;
      lowercaseCheck.checked = true;
      numbersCheck.checked = true;
      symbolsCheck.checked = false;
      break;
  }

  if (lengthValue) lengthValue.textContent = lengthSlider.value;
  generateAndDisplayPassword();
  updatePasswordStrength();
};

/**
 * Setup password generator event listeners
 */
function setupPasswordGeneratorListeners() {
  const lengthSlider = document.getElementById("generator-length-slider");
  const lengthValue = document.getElementById("generator-length-value");
  const regenerateBtn = document.getElementById("regenerate-password-btn");
  const copyBtn = document.getElementById("copy-generated-password-btn");
  const checkboxes = document.querySelectorAll(
    "#generator-opt-uppercase, #generator-opt-lowercase, #generator-opt-numbers, #generator-opt-symbols"
  );
  const passphraseBtn = document.getElementById("generate-passphrase-btn");
  const pinBtn = document.getElementById("generate-pin-btn");
  const clearHistoryBtn = document.getElementById("clear-history-btn");

  if (!lengthSlider) return;

  lengthSlider.addEventListener("input", () => {
    if (lengthValue) lengthValue.textContent = lengthSlider.value;
    generateAndDisplayPassword();
    updatePasswordStrength();
  });

  checkboxes.forEach((cb) =>
    cb.addEventListener("change", () => {
      generateAndDisplayPassword();
      updatePasswordStrength();
    })
  );

  regenerateBtn?.addEventListener("click", () => {
    generateAndDisplayPassword();
    updatePasswordStrength();
  });

  copyBtn?.addEventListener("click", () => {
    const password = document.getElementById("generator-output")?.value;
    if (password) {
      copyToClipboardWithTimeout(password);
    }
  });

  passphraseBtn?.addEventListener("click", generatePassphrase);
  pinBtn?.addEventListener("click", generatePIN);
  clearHistoryBtn?.addEventListener("click", clearPasswordHistory);
}

// ========================================
// PART 7: PASSWORD HISTORY MANAGEMENT
// ========================================

/**
 * Save password to history
 */
function savePasswordToHistory(password) {
  if (!password) return;

  let history = JSON.parse(localStorage.getItem("passwordHistory") || "[]");

  // Don't add duplicates
  if (history.includes(password)) return;

  // Add to beginning and limit to 10 entries
  history.unshift(password);
  history = history.slice(0, 10);

  localStorage.setItem("passwordHistory", JSON.stringify(history));
  passwordHistory = history; // Update global variable
  loadPasswordHistory();
}

/**
 * Load and display password history
 */
function loadPasswordHistory() {
  const historyContainer = document.getElementById("password-history");
  if (!historyContainer) return;

  const history = JSON.parse(localStorage.getItem("passwordHistory") || "[]");

  if (history.length === 0) {
    historyContainer.innerHTML =
      '<div class="text-xs text-gray-500 dark:text-gray-400 italic">No recent passwords</div>';
    return;
  }

  historyContainer.innerHTML = history
    .map(
      (password, index) => `
        <div class="flex items-center gap-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
            <span class="font-mono truncate min-w-0 flex-1">${password.substring(
              0,
              16
            )}${password.length > 16 ? "..." : ""}</span>
            <button data-password="${index}" class="copy-history-password text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
        </div>
    `
    )
    .join("");

  // Add event listeners for copy buttons
  historyContainer
    .querySelectorAll(".copy-history-password")
    .forEach((button) => {
      button.addEventListener("click", (e) => {
        const passwordIndex = parseInt(
          e.currentTarget.getAttribute("data-password")
        );
        const passwordToCopy = history[passwordIndex];
        if (passwordToCopy) {
          copyToClipboardWithTimeout(passwordToCopy);
        }
      });
    });
}

/**
 * Clear password history
 */
function clearPasswordHistory() {
  localStorage.removeItem("passwordHistory");
  passwordHistory = [];
  loadPasswordHistory();
}

// ========================================
// PART 8: MAIN RENDERING FUNCTIONS
// ========================================

/**
 * Main render function - controls overall app state
 */
function render() {
  const backToTopBtn = document.getElementById("back-to-top-btn");

  if (state.isLocked) {
    domElements.lockScreen.style.display = "flex";
    domElements.mainApp.style.display = "none";
    domElements.mainApp.classList.add("opacity-0");
    // Hide back to top button on lock screen
    if (backToTopBtn) backToTopBtn.style.display = "none";
    setTimeout(() => domElements.lockScreen.classList.remove("opacity-0"), 10);
    setupLockScreen();
  } else {
    domElements.lockScreen.style.display = "none";
    domElements.lockScreen.classList.add("opacity-0");
    domElements.mainApp.style.display = "block";
    // Show back to top button on main app
    if (backToTopBtn) backToTopBtn.style.display = "flex";
    setTimeout(() => domElements.mainApp.classList.remove("opacity-0"), 10);
    renderCategories();
    renderItemList();
    renderDetailsPane();
    updateAutoLockFooter();
    updateResponsiveLayout();
    saveViewState();
    resetAutoLogoutTimer();
  }
}

/**
 * Setup lock/setup screen
 */
/**
 * Check if existing vault data is compatible with Vault2.0
 */
function isVaultDataCompatible() {
  try {
    const encryptedData = localStorage.getItem("vaultData");
    if (!encryptedData) return true; // No data, compatible

    // Try to decrypt with a test to see if data format is compatible
    // This is just a format check, not actual decryption
    return encryptedData.indexOf("U2FsdGVkX1") === 0; // CryptoJS AES format starts with this
  } catch (error) {
    console.warn("Vault data compatibility check failed:", error);
    return false;
  }
}

/**
 * Clear incompatible vault data and reset for new setup
 */
function resetIncompatibleVault() {
  console.log("Clearing incompatible vault data...");
  localStorage.removeItem("vaultData");
  localStorage.removeItem("vaultViewState");
  localStorage.removeItem("passwordHistory");

  // Show reset message
  showToast("Previous vault data cleared. Please set up a new vault.", "info");

  return false; // No vault data now
}

function setupLockScreen() {
  let hasVaultData = localStorage.getItem("vaultData") !== null;

  // Check compatibility if data exists
  if (hasVaultData && !isVaultDataCompatible()) {
    hasVaultData = resetIncompatibleVault();
  }

  const forgotPasswordContainer = domElements.forgotPasswordContainer;
  const userNameInput = domElements.userName;

  // Setup theme buttons on lock screen
  const setupThemeBtns = {
    light: document.getElementById("theme-light-setup"),
    dark: document.getElementById("theme-dark-setup"),
    auto: document.getElementById("theme-auto-setup"),
  };

  const setActiveSetupTheme = (theme) => {
    Object.keys(setupThemeBtns).forEach((k) => {
      setupThemeBtns[k]?.classList.toggle("active", k === theme);
    });
  };

  const savedTheme = localStorage.getItem("theme") || "auto";
  setActiveSetupTheme(savedTheme);

  Object.keys(setupThemeBtns).forEach((k) => {
    if (setupThemeBtns[k]) {
      setupThemeBtns[k].onclick = (e) => {
        e.preventDefault();
        applyTheme(k);
        setActiveSetupTheme(k);
      };
    }
  });

  state.hasVault = hasVaultData;
  // Reset flags then derive from persisted reason
  state.lockedDueToInactivity = false;
  state.lockedDueToRefresh = false;
  state.lockedDueToManual = false;
  if (hasVaultData) {
    const lockReason = localStorage.getItem("vaultLockReason");
    if (lockReason === "inactivity") state.lockedDueToInactivity = true;
    else if (lockReason === "manual") state.lockedDueToManual = true;
    else if (lockReason === "refresh") state.lockedDueToRefresh = true;
    else if (localStorage.getItem("vaultWasUnlocked") === "1") {
      // No explicit reason stored but vault was previously unlocked => refresh
      state.lockedDueToRefresh = true;
      try {
        localStorage.setItem("vaultLockReason", "refresh");
      } catch (_) {}
    }
  }
  domElements.masterPassword.value = "";
  if (domElements.confirmMasterPassword)
    domElements.confirmMasterPassword.value = "";
  domElements.passwordError.textContent = "";

  if (hasVaultData) {
    domElements.lockScreenTitle.textContent = "Welcome Back";
    domElements.lockScreenSubtitle.textContent =
      "Enter your master password to unlock your vault.";
    if (domElements.confirmPasswordContainer) {
      domElements.confirmPasswordContainer.style.display = "none";
    }
    if (domElements.userNameContainer) {
      domElements.userNameContainer.style.display = "none";
    }
    domElements.unlockButton.style.display = "block";
    domElements.createVaultButton.style.display = "none";
    if (forgotPasswordContainer) {
      forgotPasswordContainer.style.display = "block";
    }

    if (userNameInput) {
      userNameInput.removeAttribute("required");
    }

    // Auto-focus on master password field for existing vault
    setTimeout(() => {
      domElements.masterPassword.focus();
    }, 100);
  } else {
    domElements.lockScreenTitle.textContent = "Vault Guard";
    domElements.lockScreenSubtitle.textContent =
      "Set a strong master password. This password cannot be recovered.";
    if (domElements.confirmPasswordContainer) {
      domElements.confirmPasswordContainer.style.display = "block";
    }
    if (domElements.userNameContainer) {
      domElements.userNameContainer.style.display = "block";
    }
    domElements.unlockButton.style.display = "none";
    domElements.createVaultButton.style.display = "block";
    if (forgotPasswordContainer) {
      forgotPasswordContainer.style.display = "none";
    }

    if (userNameInput) {
      userNameInput.setAttribute("required", "");
    }

    // Auto-focus on name field for new vault setup
    setTimeout(() => {
      if (userNameInput) {
        userNameInput.focus();
      }
    }, 100);
  }

  // Inject/Toggle inactivity banner just below the form
  const formEl = domElements.masterPasswordForm;
  if (formEl) {
    let banner = document.getElementById("inactivity-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "inactivity-banner";
      banner.className = "mt-3 px-3 py-2 rounded-md text-sm border";
      formEl.parentElement.appendChild(banner);
    }
    if (
      state.lockedDueToInactivity ||
      state.lockedDueToRefresh ||
      state.lockedDueToManual
    ) {
      const isDark = document.documentElement.classList.contains("dark");
      const bg = isDark ? "bg-primary-700" : "bg-primary-600";
      const border = isDark ? "border-primary-600" : "border-primary-500";
      const text = "text-white";
      banner.className = `mt-3 px-3 py-2 rounded-md text-sm border text-center ${bg} ${border} ${text}`;
      if (state.lockedDueToInactivity) {
        banner.textContent =
          "Locked due to inactivity. Enter your master password to continue.";
      } else if (state.lockedDueToManual) {
        banner.textContent =
          "Locked because manual lock was chosen. Enter your master password to continue.";
      } else if (state.lockedDueToRefresh) {
        banner.textContent =
          "Locked because the site was refreshed. Enter your master password to continue.";
      }
      banner.style.display = "block";
    } else {
      banner.style.display = "none";
    }
  }
}

/**
 * Update auto-lock footer text
 */
function updateAutoLockFooter() {
  const footerText = domElements.autoLockFooterText;
  if (!footerText) return;

  // Get auto logout setting from user settings or default to 1 minute
  const autoLogoutMinutes = parseInt(
    state.decryptedData?.settings?.autoLogoutMinutes ??
      localStorage.getItem("autoLogoutMinutes") ??
      1
  );

  const label =
    autoLogoutMinutes === 0
      ? "Auto-Lock disabled"
      : `Auto-lock after ${autoLogoutMinutes} min${
          autoLogoutMinutes === 1 ? "" : "s"
        } of inactivity`;
  footerText.textContent = label;
}

/**
 * Render category navigation
 */
function renderCategories() {
  domElements.categoryNav.innerHTML = "";

  // Render main data categories
  Object.keys(CATEGORIES).forEach((key) => {
    const isActive = key === state.currentCategory;
    const category = CATEGORIES[key];
    const button = document.createElement("button");
    button.className = `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300"
        : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
    }`;

    // Generate SVG icon based on category
    const iconSvg = getCategoryIcon(key);
    button.innerHTML = `${iconSvg}<span>${category.name}</span>`;

    button.onclick = () => {
      state.currentCategory = key;
      state.selectedItemId = null;
      state.searchTerm = "";
      if (domElements.searchBar) domElements.searchBar.value = "";
      saveViewState();
      render();
    };

    domElements.categoryNav.appendChild(button);
  });

  // Add separator
  const separator = document.createElement("div");
  separator.className = "my-3 border-t border-gray-200 dark:border-gray-700";
  domElements.categoryNav.appendChild(separator);

  // Render special categories
  Object.keys(SPECIAL_CATEGORIES).forEach((key) => {
    const isActive = key === state.currentCategory;
    const category = SPECIAL_CATEGORIES[key];
    const button = document.createElement("button");
    button.className = `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300"
        : "hover:bg-gray-100 dark:hover:bg-gray-700/50"
    }`;

    // Generate SVG icon based on category
    const iconSvg = getCategoryIcon(key);
    button.innerHTML = `${iconSvg}<span>${category.name}</span>`;

    button.onclick = () => {
      state.currentCategory = key;
      state.selectedItemId = null;
      state.searchTerm = "";
      if (domElements.searchBar) domElements.searchBar.value = "";
      saveViewState();
      render();
    };

    domElements.categoryNav.appendChild(button);
  });
}

/**
 * Get SVG icon for category
 */
function getCategoryIcon(categoryKey) {
  const icons = {
    passwords:
      '<svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>',
    cards:
      '<svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>',
    identities:
      '<svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
    notes:
      '<svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14,2 14,8 20,8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10,9 9,9 8,9"></polyline></svg>',
    passwordGenerator:
      '<svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon></svg>',
    profile:
      '<svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
  };
  return icons[categoryKey] || icons.passwords;
}

/**
 * Update responsive layout based on screen size
 */
function updateResponsiveLayout() {
  const mainGrid = document.querySelector(".main-grid");
  const thirdPanelContainer = domElements.thirdPanelContainer;

  if (!mainGrid) return;

  // Handle different layout states
  if (state.currentCategory === "passwordGenerator") {
    // Use default grid and span details pane across columns 2 -> end
    mainGrid.classList.remove("three-column");
    mainGrid.classList.remove("two-column");
    if (domElements.detailsPaneContainer) {
      domElements.detailsPaneContainer.style.gridColumn = "2 / -1";
    }
  } else if (state.currentCategory === "profile") {
    domElements.itemListContainer.style.display = "none";
    domElements.detailsPaneContainer.style.display = "flex";
    if (thirdPanelContainer) {
      thirdPanelContainer.style.display = "none";
      domElements.thirdPanel.innerHTML = "";
    }
    mainGrid.classList.remove("three-column");
    mainGrid.classList.add("two-column");
    if (domElements.detailsPaneContainer) {
      domElements.detailsPaneContainer.style.gridColumn = "";
    }
  } else {
    // Normal category layout
    domElements.itemListContainer.style.display = "";
    domElements.detailsPaneContainer.style.display = "";
    if (thirdPanelContainer) {
      thirdPanelContainer.style.display = "none";
    }
    mainGrid.classList.remove("three-column", "two-column");
    if (domElements.detailsPaneContainer) {
      domElements.detailsPaneContainer.style.gridColumn = "";
    }
  }

  // Mobile specific adjustments
  if (window.innerWidth < 768) {
    if (state.selectedItemId) {
      domElements.itemListContainer.classList.add("mobile-hidden");
      domElements.detailsPaneContainer.classList.remove("mobile-hidden");
    } else {
      domElements.itemListContainer.classList.remove("mobile-hidden");
      domElements.detailsPaneContainer.classList.add("mobile-hidden");
    }
  } else {
    domElements.itemListContainer.classList.remove("mobile-hidden");
    domElements.detailsPaneContainer.classList.remove("mobile-hidden");
  }
}

// ========================================
// PART 9: ITEM LIST RENDERING & HELPERS
// ========================================

/**
 * Render item list for current category
 */
function renderItemList() {
  if (!state.decryptedData) return;

  const thirdPanelContainer = domElements.thirdPanelContainer;
  const mainGrid = document.querySelector(".main-grid");

  // Handle special categories
  if (state.currentCategory === "passwordGenerator") {
    if (mainGrid) {
      mainGrid.classList.remove("three-column");
      mainGrid.classList.remove("two-column");
    }
    return;
  } else if (state.currentCategory === "profile") {
    domElements.itemListContainer.style.display = "none";
    domElements.detailsPaneContainer.style.display = "flex";
    if (thirdPanelContainer) {
      thirdPanelContainer.style.display = "none";
      domElements.thirdPanel.innerHTML = "";
    }
    if (mainGrid) {
      mainGrid.classList.remove("three-column");
      mainGrid.classList.add("two-column");
    }
    return;
  } else {
    // Restore normal layout
    const itemListParent = domElements.itemList?.parentElement;
    const addNewItemBtn = domElements.addNewItemBtn;
    const searchBar = domElements.searchBar;

    if (itemListParent) itemListParent.style.display = "";
    if (addNewItemBtn) addNewItemBtn.style.display = "";
    if (searchBar?.parentElement) searchBar.parentElement.style.display = "";
    if (thirdPanelContainer) {
      thirdPanelContainer.style.display = "none";
    }
    if (mainGrid) {
      mainGrid.classList.remove("three-column", "two-column");
    }
  }

  const catMeta = CATEGORIES[state.currentCategory] || { name: "", icon: "" };
  const iconSvg = getCategoryIcon(state.currentCategory);
  domElements.itemListTitle.innerHTML = `
        <span class="inline-flex items-center gap-2">
            <span class="text-primary-500">${iconSvg}</span>
            <span>${catMeta.name || ""}</span>
        </span>
    `;

  const items = state.decryptedData[state.currentCategory] || [];
  const filteredItems = items.filter((item) => {
    const title = getItemTitle(item);
    return title.toLowerCase().includes(state.searchTerm.toLowerCase());
  });

  if (filteredItems.length === 0) {
    domElements.itemList.innerHTML = `<div class="text-center text-gray-500 mt-8">No items found.</div>`;
    return;
  }

  domElements.itemList.innerHTML = filteredItems
    .map((item) => {
      const isActive = item.id === state.selectedItemId;
      const title = getItemTitle(item);
      const subtitle = getItemSubtitle(item);
      const iconHtml = getItemIcon(item);

      return `
            <div class="item-card group cursor-pointer p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 ${
              isActive
                ? "ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-500/10"
                : ""
            }" data-id="${item.id}">
                <div class="flex items-center gap-3">
                    ${iconHtml}
                    <div class="flex-grow min-w-0">
                        <div class="font-medium text-gray-900 dark:text-white truncate">${escapeHtml(
                          title
                        )}</div>
                        <div class="text-sm text-gray-500 dark:text-gray-400 truncate">${escapeHtml(
                          subtitle
                        )}</div>
                    </div>
                    <svg class="w-5 h-5 text-gray-400 dark:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                </div>
            </div>
        `;
    })
    .join("");
}

/**
 * Get item title based on category
 */
function getItemTitle(item) {
  switch (state.currentCategory) {
    case "passwords":
      return item.title || "Untitled";
    case "cards":
      return item.bankName || "Unknown Bank";
    case "identities":
      return item.idType || "Identity";
    case "notes":
      return item.title || "Untitled Note";
    default:
      return item.title || "Untitled";
  }
}

/**
 * Get item subtitle based on category
 */
function getItemSubtitle(item) {
  switch (state.currentCategory) {
    case "passwords":
      return item.username || "No username";
    case "cards":
      const lastFour = item.cardNumber
        ? "•••• " + item.cardNumber.replace(/\s/g, "").slice(-4)
        : "••••";
      const cardDisplay =
        item.cardBrand ||
        item.cardType ||
        detectCardType(item.cardNumber || "") ||
        "Card";
      return `${lastFour} - ${cardDisplay}`;
    case "identities":
      return item.idNumber || "No ID number";
    case "notes":
      return item.content
        ? item.content.substring(0, 50) + "..."
        : "Empty note";
    default:
      return "";
  }
}

/**
 * Get item icon HTML
 */
function getItemIcon(item) {
  // Default icon for most items
  let iconHtml =
    '<div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center"><svg class="w-5 h-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg></div>';

  // Try to get favicon for password items
  if (state.currentCategory === "passwords" && item.website) {
    const domain = getDomainFromUrl(item.website);
    if (domain) {
      iconHtml = `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" class="w-8 h-8 rounded" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" loading="lazy">
                       <div class="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center" style="display:none;">
                           <svg class="w-4 h-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9"/>
                           </svg>
                       </div>`;
    }
  }

  // Card logos for payment cards
  if (state.currentCategory === "cards" && item.cardNumber) {
    const cardType = detectCardType(item.cardNumber);
    const logoPath = getCardLogoPath(cardType);
    if (logoPath) {
      iconHtml = `<img src="${logoPath}" alt="${cardType}" class="w-8 h-8 object-contain" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                       <div class="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center" style="display:none;">
                           <svg class="w-4 h-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/>
                           </svg>
                       </div>`;
    }
  }

  return iconHtml;
}

/**
 * Extract domain from URL
 */
function getDomainFromUrl(url) {
  try {
    if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
      url = "https://" + url;
    }
    return new URL(url).hostname;
  } catch (e) {
    return null;
  }
}

/**
 * Detect card type from number
 */
function detectCardType(cardNumber) {
  if (!cardNumber) return "Unknown";

  const number = cardNumber.replace(/\s/g, "");

  if (/^4/.test(number)) return "Visa";
  if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return "Mastercard";
  if (/^3[47]/.test(number)) return "American Express";
  if (/^6(?:011|5)/.test(number)) return "Discover";
  if (/^35/.test(number)) return "JCB";
  if (/^30[0-5]/.test(number) || /^36/.test(number) || /^38/.test(number))
    return "Diners Club";
  if (/^60/.test(number)) return "RuPay";

  return "Unknown";
}

/**
 * Get card logo path (updated for Vault2.0 structure)
 */
function getCardLogoPath(cardType) {
  const logoMap = {
    Visa: "../static/visa.png",
    Mastercard: "../static/mastercard.png",
    "American Express": "../static/amex.png",
    Discover: "../static/discover.png",
    JCB: "../static/jcb.png",
    "Diners Club": "../static/dinersclub.png",
    RuPay: "../static/rupay.png",
  };
  return logoMap[cardType] || null;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ========================================
// PART 10: DETAILS PANE RENDERING
// ========================================

/**
 * Render details pane based on current selection
 */
function renderDetailsPane() {
  const thirdPanelContainer = domElements.thirdPanelContainer;
  const mainGrid = document.querySelector(".main-grid");

  if (state.currentCategory === "passwordGenerator") {
    if (mainGrid) {
      // Use default grid and span details pane
      mainGrid.classList.remove("three-column");
      mainGrid.classList.remove("two-column");
    }
    renderPasswordGenerator();
  } else if (state.currentCategory === "profile") {
    if (thirdPanelContainer) {
      thirdPanelContainer.style.display = "none";
      domElements.thirdPanel.innerHTML = "";
    }
    if (mainGrid) {
      mainGrid.classList.remove("three-column");
      mainGrid.classList.add("two-column");
    }
    renderProfileSettings();
  } else if (state.selectedItemId === "new") {
    if (thirdPanelContainer) {
      thirdPanelContainer.style.display = "none";
    }
    domElements.detailsPlaceholder.style.display = "none";
    renderForm();
  } else {
    const item = (state.decryptedData[state.currentCategory] || []).find(
      (i) => i.id === state.selectedItemId
    );
    if (item) {
      if (thirdPanelContainer) {
        thirdPanelContainer.style.display = "none";
      }
      domElements.detailsPlaceholder.style.display = "none";
      renderItemDetails(item);
    } else {
      if (thirdPanelContainer) {
        thirdPanelContainer.style.display = "none";
      }
      domElements.detailsPane.innerHTML = "";
      domElements.detailsPane.appendChild(domElements.detailsPlaceholder);
      domElements.detailsPlaceholder.style.display = "flex";
    }
  }
  updateResponsiveLayout();
}

/**
 * Render password generator interface
 */
function renderPasswordGenerator() {
  domElements.itemListContainer.style.display = "none";
  domElements.detailsPaneContainer.style.display = "block"; // Change to block for full width
  const thirdPanelContainer = domElements.thirdPanelContainer;
  const thirdPanel = domElements.thirdPanel;
  if (thirdPanelContainer) {
    thirdPanelContainer.style.display = "none"; // Hide third panel
  }

  domElements.detailsPane.innerHTML = `
        <div class="w-full py-8">
            <!-- Main Content -->
            <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <!-- Header -->
                <div class="text-center py-8 px-8 border-b border-gray-100 dark:border-gray-700">
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Password Generator</h1>
                    <p class="text-gray-500 dark:text-gray-400">Create secure passwords tailored to your needs</p>
                </div>

                <!-- Password Output Section -->
                <div class="p-8 border-b border-gray-100 dark:border-gray-700">
                    <div class="flex items-center justify-between mb-4">
                        <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Generated Password</h3>
                        <div class="flex items-center gap-3">
                            <button id="copy-generated-password-btn" class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-all duration-200">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                Copy
                            </button>
                            <button id="regenerate-password-btn" class="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-all duration-200 font-medium">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><polyline points="21,8 21,3 16,3"></polyline><polyline points="3,16 3,21 8,21"></polyline></svg>
                                Generate
                            </button>
                        </div>
                    </div>
                    <input type="text" id="generator-output" readonly class="w-full px-4 py-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl font-mono text-lg text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none select-all" placeholder="">
                    
                    <!-- Strength Indicator -->
                    <div class="mt-6 flex items-center justify-between">
                        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Password Strength</span>
            <span id="strength-text" class="text-sm font-semibold text-primary-600">Strong</span>
                    </div>
          <div class="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
            <div id="strength-bar" class="bg-primary-600 h-1 rounded-full transition-all duration-500" style="width: 80%"></div>
                    </div>
                    <div id="strength-details" class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-gray-400 min-h-16">
                        <span>✓ Uppercase</span>
                        <span>✓ Lowercase</span>
                        <span>✓ Numbers</span>
                        <span>✓ Symbols</span>
                    </div>
                </div>

                <!-- Configuration Section -->
                <div class="p-8">
                    <!-- Length Control -->
                    <div class="mb-8">
                        <div class="flex items-center justify-between mb-4">
                            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Password Length</label>
                            <span id="generator-length-value" class="text-lg font-semibold text-gray-900 dark:text-gray-100">16</span>
                        </div>
                        <input id="generator-length-slider" type="range" min="8" max="64" value="16" class="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer">
                        <div class="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-2">
                            <span>8</span>
                            <span>32</span>
                            <span>64</span>
                        </div>
                    </div>

          <!-- Three Column Layout -->
          <div class="grid md:grid-cols-3 gap-8 items-stretch">
                        <!-- Quick Templates -->
            <div class="flex flex-col h-full">
                            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Quick Templates</h4>
              <div class="flex-1 flex flex-col gap-2">
                <div class="flex-1"></div>
                                <button onclick="setPasswordTemplate('web')" class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200">
                                    <div class="font-medium text-gray-900 dark:text-gray-100 text-sm">Web Accounts</div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">16 characters, mixed case, numbers, symbols</div>
                                </button>
                                <button onclick="setPasswordTemplate('banking')" class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200">
                                    <div class="font-medium text-gray-900 dark:text-gray-100 text-sm">Banking & Finance</div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">24 characters, maximum security</div>
                                </button>
                                <button onclick="setPasswordTemplate('gaming')" class="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200">
                                    <div class="font-medium text-gray-900 dark:text-gray-100 text-sm">Gaming & Social</div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">12 characters, no special symbols</div>
                                </button>
                            </div>
                        </div>

                        <!-- Character Types -->
            <div class="flex flex-col h-full">
                            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Character Types</h4>
              <div class="flex-1 flex flex-col gap-2">
                <div class="flex-1"></div>
                                <label class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Uppercase (A-Z)</span>
                                    <input type="checkbox" id="generator-opt-uppercase" checked class="w-4 h-4 text-primary-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 focus:ring-2">
                                </label>
                                <label class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Lowercase (a-z)</span>
                                    <input type="checkbox" id="generator-opt-lowercase" checked class="w-4 h-4 text-primary-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 focus:ring-2">
                                </label>
                                <label class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Numbers (0-9)</span>
                                    <input type="checkbox" id="generator-opt-numbers" checked class="w-4 h-4 text-primary-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 focus:ring-2">
                                </label>
                                <label class="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200">
                                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Symbols (!@#$)</span>
                                    <input type="checkbox" id="generator-opt-symbols" checked class="w-4 h-4 text-primary-600 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500 focus:ring-2">
                                </label>
                            </div>
                        </div>

                        <!-- Alternative Formats -->
            <div class="flex flex-col h-full">
                            <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">Alternative Formats</h4>
              <div class="flex-1 flex flex-col gap-2">
                <button id="generate-passphrase-btn" class="w-full p-3 text-sm text-left rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 md:flex-1">
                                    <div class="font-medium text-gray-900 dark:text-gray-100">Generate Passphrase</div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Multiple words separated by dashes</div>
                                </button>
                <button id="generate-pin-btn" class="w-full p-3 text-sm text-left rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 md:flex-1">
                                    <div class="font-medium text-gray-900 dark:text-gray-100">Generate PIN Code</div>
                                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">4-8 digit numeric code</div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

  setupPasswordGeneratorListeners();
  updatePasswordStrength();
  loadPasswordHistory();
  generateAndDisplayPassword();
}

/**
 * Render profile settings
 */
function renderProfileSettings() {
  domElements.itemListContainer.style.display = "none";
  domElements.detailsPaneContainer.style.display = "flex";

  const user = state.decryptedData.user || {};
  const showFirstLoginBanner = user && user.profilePromptShown !== true;
  const updatedDisplay = user.updated
    ? (() => {
        const d = new Date(user.updated);
        const pad = (n) => String(n).padStart(2, "0");
        let hours = d.getHours();
        const minutes = pad(d.getMinutes());
        const ampm = hours >= 12 ? "PM" : "AM";
        hours = hours % 12;
        if (hours === 0) hours = 12;
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
          d.getDate()
        )} ${hours}:${minutes} ${ampm}`;
      })()
    : "Never";

  domElements.detailsPane.innerHTML = `
        <div class="space-y-6">
            <div class="flex items-center gap-3 mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary-500">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <h2 class="text-2xl font-bold">Profile & Security Settings</h2>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <form id="profile-form" class="md:col-span-2 lg:col-span-2 flex flex-col gap-6" novalidate>
                    ${
                      showFirstLoginBanner
                        ? `
                    <div class="p-4 rounded-lg profile-complete-banner">
                        <div class="flex items-start gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 flex-shrink-0">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            <p class="text-sm font-medium text-primary-800 dark:text-primary-100">Please complete your profile for secure data export/import.</p>
                        </div>
                    </div>`
                        : ""
                    }
                    
                    <!-- User Information -->
                    <div class="space-y-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <h3 class="text-lg font-semibold">User Information</h3>
                        <div>
                            <label for="profile-name" class="block text-sm font-medium mb-2">Full Name *</label>
                            <input type="text" id="profile-name" required value="${escapeHtml(
                              user.name || ""
                            )}" 
                                   class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none">
                        </div>
                        <div>
                            <label for="profile-email" class="block text-sm font-medium mb-2">Email Address *</label>
                            <input type="email" id="profile-email" required value="${escapeHtml(
                              user.email || ""
                            )}" 
                                   class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none">
                            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">Used for secure data export/import verification</p>
                        </div>
                    </div>

                    <!-- Security Question -->
                    <div class="space-y-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <h3 class="text-lg font-semibold">Security Question</h3>
                        <div>
                            <label for="profile-security-question" class="block text-sm font-medium mb-2">Question *</label>
                            ${(() => {
                              const predefinedQuestions = [
                                "What is the name of your first pet?",
                                "What city were you born in?",
                                "What is your favorite teacher's name?",
                                "What was your first school's name?",
                                "What is your favorite book?",
                                "What is your mother's maiden name?",
                                "What is your dream travel destination?",
                                "What is the name of your first employer?",
                                "What was the make of your first car?",
                                "What is your favorite movie?",
                              ];
                              const isCustom =
                                !!user.securityQuestion &&
                                !predefinedQuestions.includes(
                                  user.securityQuestion
                                );
                              const optionsHtml =
                                '<select id="profile-security-question" required class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none">' +
                                '<option value="">Select a question...</option>' +
                                predefinedQuestions
                                  .map(
                                    (q) =>
                                      `<option value="${q}" ${
                                        user.securityQuestion === q
                                          ? "selected"
                                          : ""
                                      }>${q}</option>`
                                  )
                                  .join("") +
                                `<option value="custom" ${
                                  isCustom ? "selected" : ""
                                }>Custom question...</option>` +
                                "</select>";
                              const customInputHtml = `<input type="text" id="profile-security-question-custom" class="mt-3 w-full px-3 py-2 bg-white dark:bg-gray-700 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none ${
                                isCustom ? "" : "hidden"
                              }" placeholder="Enter your custom security question" value="${escapeHtml(
                                isCustom ? user.securityQuestion : ""
                              )}">`;
                              return optionsHtml + customInputHtml;
                            })()}
                        </div>
                        <div>
                            <label for="profile-security-answer" class="block text-sm font-medium mb-2">Answer *</label>
                            <input type="text" id="profile-security-answer" required value="${escapeHtml(
                              user.securityAnswer || ""
                            )}" 
                                   class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none">
                            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">Used as additional verification for data imports</p>
                        </div>
                    </div>

          <!-- Accent Theme Picker -->
          <div class="space-y-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg" id="accent-theme-section">
            <h3 class="text-lg font-semibold">Accent Theme</h3>
            <p class="text-xs text-gray-600 dark:text-gray-400">Choose an accent color used across buttons, highlights & indicators. (Independent of Light/Dark/Auto)</p>
            <div id="accent-theme-grid" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"></div>
          </div>

          <!-- Auto Logout Timer -->
          <div class="space-y-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg" id="auto-logout-section">
            <h3 class="text-lg font-semibold">Auto Logout</h3>
            <p class="text-xs text-gray-600 dark:text-gray-400">Automatically lock the vault after a period of inactivity for security.</p>
            <div id="auto-logout-grid" class="grid grid-cols-5 gap-3"></div>
          </div>

                    <button type="submit" class="w-full px-4 py-3 font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                        Save Profile
                    </button>
          <div id="profile-last-updated" class="text-[11px] text-gray-500 dark:text-gray-400 text-center mt-3 select-none">
            Profile last updated: <span>${escapeHtml(updatedDisplay)}</span>
          </div>
                </form>
            </div>
        </div>
    `;

  // Setup profile form event listener
  const profileForm = document.getElementById("profile-form");
  profileForm?.addEventListener("submit", handleProfileSubmit);
  // Initialize security question custom field toggle (reverted simple logic)
  const selQ = document.getElementById("profile-security-question");
  const customQ = document.getElementById("profile-security-question-custom");
  const answerInput = document.getElementById("profile-security-answer");
  if (selQ && customQ) {
    const toggleCustom = () => {
      if (selQ.value === "custom") customQ.classList.remove("hidden");
      else customQ.classList.add("hidden");
    };
    const currentQuestionValue = () =>
      selQ.value === "custom" ? customQ.value.trim() : selQ.value.trim();
    toggleCustom();
    let lastQuestionValue = currentQuestionValue();
    let prevSelectValue = selQ.value;
    selQ.addEventListener("change", () => {
      const prev = lastQuestionValue;
      const wasCustom = prevSelectValue === "custom";
      toggleCustom();
      const now = currentQuestionValue();
      // If we just left the custom option, clear its input so returning later is blank
      if (wasCustom && selQ.value !== "custom") {
        customQ.value = "";
      }
      if (answerInput && now !== prev) {
        answerInput.value = ""; // Clear answer because question changed
      }
      lastQuestionValue = now;
      prevSelectValue = selQ.value;
    });
    customQ.addEventListener("input", () => {
      if (selQ.value === "custom") {
        const current = customQ.value.trim();
        if (current === "" && answerInput && answerInput.value !== "") {
          answerInput.value = "";
        }
      }
    });
  }

  // Build accent theme grid (no tick mark; border/ring highlight + integrated custom tile)
  const grid = document.getElementById("accent-theme-grid");
  if (grid) {
    let currentAccent =
      state.decryptedData.settings.accentTheme ||
      localStorage.getItem("accentTheme") ||
      "indigo";
    if (!(currentAccent in ACCENT_THEMES) && currentAccent !== "custom") {
      currentAccent = "indigo";
    }
    let html = Object.entries(ACCENT_THEMES)
      .map(([key, meta]) => {
        const isActive = key === currentAccent;
        return `<button type="button" data-accent="${key}" class="group flex flex-col items-center justify-center gap-1 p-3 rounded-lg border ${
          isActive
            ? "ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-gray-800 border-primary-400 dark:border-primary-500"
            : "border-gray-200 dark:border-gray-700"
        } bg-white dark:bg-gray-700 hover:shadow transition-all focus:outline-none">
          <span class=\"w-8 h-8 rounded-full shadow-inner\" style=\"background: linear-gradient(135deg, rgb(${
            meta.palette[400]
          }), rgb(${meta.palette[600]}))\"></span>
          <span class=\"text-[11px] font-medium text-gray-600 dark:text-gray-300\">${
            meta.label
          }</span>
        </button>`;
      })
      .join("");
    const customBase =
      state.decryptedData.settings.accentCustomBase ||
      localStorage.getItem("accentCustomBase") ||
      "#6366f1";
    const customPalette = generatePaletteFromBase(customBase);
    const customActive = currentAccent === "custom";
    html += `<button type="button" data-accent="custom" class="group flex flex-col items-center justify-center p-3 rounded-lg border ${
      customActive
        ? "ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-gray-800 border-primary-400 dark:border-primary-500"
        : "border-gray-200 dark:border-gray-700"
    } bg-white dark:bg-gray-700 hover:shadow transition-all focus:outline-none relative">
        <span class="text-[11px] font-medium text-gray-600 dark:text-gray-300">Custom</span>
        <input type="color" id="custom-accent-picker" class="absolute inset-0 opacity-0 cursor-pointer" value="${customBase}" aria-label="Pick custom accent color" />
      </button>`;
    grid.innerHTML = html;
    grid.querySelectorAll("button[data-accent]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const key = e.currentTarget.getAttribute("data-accent");
        if (key === "custom") {
          const picker = e.currentTarget.querySelector("#custom-accent-picker");
          picker?.click();
          return;
        }
        applyAccentTheme(key);
        // Update the accent theme grid selection without re-rendering the whole form
        updateAccentThemeSelection(key);
      });
    });
    const customPicker = document.getElementById("custom-accent-picker");
    let colorChangeTimeout;

    // Use 'input' for real-time preview but debounce the toast
    customPicker?.addEventListener("input", (e) => {
      const val = e.target.value;
      applyAccentTheme("custom", val);
      updateAccentThemeSelection("custom");

      // Clear previous timeout
      clearTimeout(colorChangeTimeout);
    });

    // Also listen for 'change' to ensure final state is saved
    customPicker?.addEventListener("change", (e) => {
      const val = e.target.value;
      applyAccentTheme("custom", val);
      updateAccentThemeSelection("custom");
    });
  }

  // Build auto logout grid
  const autoLogoutGrid = document.getElementById("auto-logout-grid");
  if (autoLogoutGrid) {
    const currentAutoLogout = parseInt(
      state.decryptedData?.settings?.autoLogoutMinutes ??
        localStorage.getItem("autoLogoutMinutes") ??
        1
    );

    let autoLogoutHtml = AUTO_LOGOUT_OPTIONS.map((option) => {
      const isActive = option.key === currentAutoLogout;
      return `<button type="button" data-logout-time="${
        option.key
      }" class="flex flex-col items-center justify-center gap-1 p-3 rounded-lg border ${
        isActive
          ? "ring-2 ring-offset-2 ring-primary-500 dark:ring-offset-gray-800 border-primary-400 dark:border-primary-500"
          : "border-gray-200 dark:border-gray-700"
      } bg-white dark:bg-gray-700 hover:shadow transition-all focus:outline-none">
          <span class="text-[11px] font-medium text-gray-600 dark:text-gray-300">${
            option.label
          }</span>
        </button>`;
    }).join("");

    autoLogoutGrid.innerHTML = autoLogoutHtml;

    // Add click handlers for auto logout options
    autoLogoutGrid
      .querySelectorAll("button[data-logout-time]")
      .forEach((btn) => {
        btn.addEventListener("click", (e) => {
          const minutes = parseInt(
            e.currentTarget.getAttribute("data-logout-time")
          );
          setAutoLogoutTime(minutes);
          updateAutoLogoutSelection(minutes);
        });
      });
  }

  // Auto-focus logic for profile section
  setTimeout(() => {
    const nameField = document.getElementById("profile-name");
    const emailField = document.getElementById("profile-email");

    // Focus on name field if it's empty (unlikely but possible on first navigation)
    if (nameField && (!nameField.value || nameField.value.trim() === "")) {
      nameField.focus();
    }
    // Focus on email field only if name has value BUT email is empty
    else if (
      emailField &&
      (!emailField.value || emailField.value.trim() === "")
    ) {
      emailField.focus();
    }
    // If both fields have values, don't focus on anything
  }, 100);
}

/**
 * Update accent theme selection without re-rendering the entire form
 */
function updateAccentThemeSelection(selectedKey) {
  const grid = document.getElementById("accent-theme-grid");
  if (!grid) return;

  // Remove selection from all tiles
  grid.querySelectorAll("[data-accent]").forEach((tile) => {
    tile.classList.remove(
      "ring-2",
      "ring-primary-500",
      "ring-offset-2",
      "dark:ring-offset-gray-800",
      "border-primary-400",
      "dark:border-primary-500"
    );
    tile.classList.add("border-gray-200", "dark:border-gray-700");
  });

  // Add selection to the chosen tile
  const selectedTile = grid.querySelector(`[data-accent="${selectedKey}"]`);
  if (selectedTile) {
    selectedTile.classList.remove("border-gray-200", "dark:border-gray-700");
    selectedTile.classList.add(
      "ring-2",
      "ring-primary-500",
      "ring-offset-2",
      "dark:ring-offset-gray-800",
      "border-primary-400",
      "dark:border-primary-500"
    );
  }
}

/**
 * Set auto logout time and update settings
 */
function setAutoLogoutTime(minutes) {
  // Update settings in decrypted data if available
  if (state.decryptedData && state.decryptedData.settings) {
    state.decryptedData.settings.autoLogoutMinutes = minutes;
    saveData();
  }

  // Also save to localStorage for immediate availability
  try {
    localStorage.setItem("autoLogoutMinutes", minutes.toString());
  } catch (_) {}

  // Reset the timer with new duration
  resetAutoLogoutTimer();

  // Update footer text
  updateAutoLockFooter();

  // Show toast feedback
  const label =
    minutes === 0
      ? "Auto-logout disabled"
      : `Auto-logout set to ${minutes} minute${minutes === 1 ? "" : "s"}`;
  showToast(label, "success");
}

/**
 * Update auto logout selection without re-rendering the entire form
 */
function updateAutoLogoutSelection(selectedMinutes) {
  const grid = document.getElementById("auto-logout-grid");
  if (!grid) return;

  // Remove selection from all tiles
  grid.querySelectorAll("[data-logout-time]").forEach((tile) => {
    tile.classList.remove(
      "ring-2",
      "ring-primary-500",
      "ring-offset-2",
      "dark:ring-offset-gray-800",
      "border-primary-400",
      "dark:border-primary-500"
    );
    tile.classList.add("border-gray-200", "dark:border-gray-700");
  });

  // Add selection to the chosen tile
  const selectedTile = grid.querySelector(
    `[data-logout-time="${selectedMinutes}"]`
  );
  if (selectedTile) {
    selectedTile.classList.remove("border-gray-200", "dark:border-gray-700");
    selectedTile.classList.add(
      "ring-2",
      "ring-primary-500",
      "ring-offset-2",
      "dark:ring-offset-gray-800",
      "border-primary-400",
      "dark:border-primary-500"
    );
  }
}

/**
 * Handle profile form submission
 */
function handleProfileSubmit(e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById("profile-name")?.value.trim() || "",
    email: document.getElementById("profile-email")?.value.trim() || "",
    securityQuestion: (function () {
      const sel = document.getElementById("profile-security-question");
      const customInput = document.getElementById(
        "profile-security-question-custom"
      );
      if (!sel) return "";
      const val = sel.value.trim();
      if (val === "custom") {
        return customInput?.value.trim() || "";
      }
      return val;
    })(),
    securityAnswer:
      document.getElementById("profile-security-answer")?.value.trim() || "",
  };

  // Validation
  if (
    !formData.name ||
    !formData.email ||
    !formData.securityQuestion ||
    !formData.securityAnswer
  ) {
    // Find the first empty field and scroll to it
    const fields = [
      { id: "profile-name", value: formData.name },
      { id: "profile-email", value: formData.email },
      { id: "profile-security-question", value: formData.securityQuestion },
      { id: "profile-security-answer", value: formData.securityAnswer },
    ];

    let firstEmptyField = null;
    const emptyFields = [];

    fields.forEach((field) => {
      const element = document.getElementById(field.id);
      if (!field.value && element) {
        emptyFields.push(element);
        if (!firstEmptyField) {
          firstEmptyField = element;
        }
      }
    });

    // Handle custom security question case
    const securitySelect = document.getElementById("profile-security-question");
    const customQuestionInput = document.getElementById(
      "profile-security-question-custom"
    );
    if (
      securitySelect &&
      securitySelect.value === "custom" &&
      customQuestionInput &&
      !customQuestionInput.value.trim()
    ) {
      emptyFields.push(customQuestionInput);
      if (!firstEmptyField) {
        firstEmptyField = customQuestionInput;
      }
    }

    // Scroll to first empty field
    if (firstEmptyField) {
      firstEmptyField.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => firstEmptyField.focus(), 300);
    }

    // Add shake animation to all empty fields
    emptyFields.forEach((field) => {
      field.classList.add("shake", "error-state");
    });

    // Add shake animation to Save Profile button
    const saveProfileBtn = document.querySelector(
      '#profile-form button[type="submit"]'
    );
    if (saveProfileBtn) {
      saveProfileBtn.classList.add("shake");
      // Match the same color as profile icon error-red class
      if (document.documentElement.classList.contains("dark")) {
        saveProfileBtn.style.backgroundColor = "#f87171";
        saveProfileBtn.style.borderColor = "#ef4444";
      } else {
        saveProfileBtn.style.backgroundColor = "#ef4444";
        saveProfileBtn.style.borderColor = "#dc2626";
      }
    }

    // Turn profile icon red
    const profileHeaders = document.querySelectorAll("h2");
    let profileIcon = null;
    profileHeaders.forEach((header) => {
      if (header.textContent.includes("Profile & Security Settings")) {
        const iconSvg = header.parentElement.querySelector("svg");
        if (iconSvg) {
          profileIcon = iconSvg;
        }
      }
    });

    if (profileIcon) {
      profileIcon.classList.add("error-red");
    }

    // Turn scroll to top button red
    const backToTopBtn = document.getElementById("back-to-top-btn");
    if (backToTopBtn) {
      backToTopBtn.style.backgroundColor = "#dc2626";
      backToTopBtn.style.borderColor = "#b91c1c";
      const arrow = backToTopBtn.querySelector("svg");
      if (arrow) {
        arrow.style.color = "#ffffff";
      }
    }

    // Replace banner with error banner
    const banner = document.querySelector(".profile-complete-banner");
    let originalBannerHTML = "";
    if (banner) {
      // Save original banner content
      originalBannerHTML = banner.innerHTML;

      // Replace with error banner
      banner.innerHTML = `
        <div class="flex items-start gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 flex-shrink-0">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <p class="text-sm font-medium text-red-600 dark:text-red-100">Please fill all fields</p>
        </div>
      `;

      // Add error styling to banner container - following design language
      banner.style.background =
        "linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.05))";
      banner.style.borderColor = "rgba(239, 68, 68, 0.3)";
      banner.style.color = "#dc2626";

      // Add dark mode styling if applicable
      if (document.documentElement.classList.contains("dark")) {
        banner.style.background =
          "linear-gradient(135deg, rgba(248, 113, 113, 0.15), rgba(239, 68, 68, 0.08))";
        banner.style.borderColor = "rgba(248, 113, 113, 0.4)";
        banner.style.color = "#fca5a5";
        // Update icon for dark mode
        const icon = banner.querySelector("svg");
        if (icon) {
          icon.setAttribute("stroke", "#f87171");
        }
      }
    }

    // Clean up after animation (extended for profile section)
    setTimeout(() => {
      emptyFields.forEach((field) => {
        field.classList.remove("shake", "error-state");
      });

      // Remove shake and red styling from Save Profile button
      const saveProfileBtn = document.querySelector(
        '#profile-form button[type="submit"]'
      );
      if (saveProfileBtn) {
        saveProfileBtn.classList.remove("shake");
        saveProfileBtn.style.backgroundColor = "";
        saveProfileBtn.style.borderColor = "";
      }

      if (profileIcon) {
        profileIcon.classList.remove("error-red");
      }

      // Remove red styling from scroll to top button
      const backToTopBtn = document.getElementById("back-to-top-btn");
      if (backToTopBtn) {
        backToTopBtn.style.backgroundColor = "";
        backToTopBtn.style.borderColor = "";
        const arrow = backToTopBtn.querySelector("svg");
        if (arrow) {
          arrow.style.color = "";
        }
      }

      // Restore original banner
      if (banner && originalBannerHTML) {
        banner.innerHTML = originalBannerHTML;
        banner.style.background = "";
        banner.style.borderColor = "";
        banner.style.color = "";
      }
    }, 1200);

    return;
  }

  const currentUser = state.decryptedData.user || {};
  const changed =
    currentUser.name !== formData.name ||
    currentUser.email !== formData.email ||
    currentUser.securityQuestion !== formData.securityQuestion ||
    currentUser.securityAnswer !== formData.securityAnswer ||
    currentUser.profilePromptShown !== true; // initial banner dismissal counts as change

  if (!changed) {
    return; // do not update timestamp or re-render
  }

  // Update user data only if something changed
  state.decryptedData.user = {
    ...currentUser,
    ...formData,
    profilePromptShown: true,
    updated: new Date().toISOString(),
  };

  saveData();

  // Re-render to update last updated date / hide banner
  renderProfileSettings();
}

/**
 * Render item details view
 */
function renderItemDetails(item) {
  // This is a simplified version - full implementation would be category-specific
  domElements.detailsPane.innerHTML = `
        <div class="space-y-6">
            <div class="flex items-center justify-between">
                <h2 class="text-2xl font-bold">${escapeHtml(
                  getItemTitle(item)
                )}</h2>
                <div class="flex items-center gap-2">
                    <button onclick="editItem('${
                      item.id
                    }')" class="icon-btn" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
                    <button onclick="deleteItem('${
                      item.id
                    }')" class="icon-btn text-red-600" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3,6 5,6 21,6"></polyline><path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </button>
                </div>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p class="text-sm text-gray-600 dark:text-gray-400">Item details would be rendered here based on category type.</p>
                <pre class="mt-2 text-xs text-gray-500">${JSON.stringify(
                  item,
                  null,
                  2
                )}</pre>
            </div>
        </div>
    `;
}

/**
 * Render form for new/edit item
 */
/**
 * Render form for new/edit item based on category
 */
function renderForm(item = null) {
  const isEdit = item !== null;
  const title = isEdit
    ? `Edit ${CATEGORIES[state.currentCategory].name.slice(0, -1)}`
    : `New ${CATEGORIES[state.currentCategory].name.slice(0, -1)}`;

  let formContent = "";

  switch (state.currentCategory) {
    case "passwords":
      formContent = renderWebsiteLoginForm(item);
      break;
    case "cards":
      formContent = renderBankCardForm(item);
      break;
    case "identities":
      formContent = renderGovernmentIdForm(item);
      break;
    case "notes":
      formContent = renderSecureNoteForm(item);
      break;
    default:
      formContent = '<p class="text-red-500">Unknown category</p>';
  }

  domElements.detailsPane.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-2xl font-bold">${title}</h2>
        <button onclick="cancelForm()" class="icon-btn" title="Cancel">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <form id="item-form" class="space-y-6" novalidate>
        ${formContent}
        <div class="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button type="submit" class="flex-1 px-4 py-3 font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
            ${isEdit ? "Update" : "Save"} ${CATEGORIES[
    state.currentCategory
  ].name.slice(0, -1)}
          </button>
          <button type="button" onclick="cancelForm()" class="px-4 py-3 font-semibold bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">
            Cancel
          </button>
        </div>
      </form>
    </div>
  `;

  // Setup form event listener
  const form = document.getElementById("item-form");
  form?.addEventListener("submit", (e) => handleFormSubmit(e, item));

  // Setup any category-specific functionality
  setupFormEvents(state.currentCategory);
}

/**
 * Render Website Login form
 */
function renderWebsiteLoginForm(item) {
  const data = item || {};
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="space-y-4">
        <div>
          <label for="title" class="block text-sm font-medium mb-2">Website/Service Name *</label>
          <input type="text" id="title" name="title" required 
                 value="${escapeHtml(data.title || "")}"
                 class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                 placeholder="e.g., Google, Facebook, GitHub">
        </div>
        <div>
          <label for="website" class="block text-sm font-medium mb-2">Website URL</label>
          <input type="url" id="website" name="website" 
                 value="${escapeHtml(data.website || "")}"
                 class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                 placeholder="https://example.com">
        </div>
        <div>
          <label for="username" class="block text-sm font-medium mb-2">Username/Email *</label>
          <input type="text" id="username" name="username" required 
                 value="${escapeHtml(data.username || "")}"
                 class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                 placeholder="your@email.com">
        </div>
      </div>
      <div class="space-y-4">
        <div>
          <label for="password" class="block text-sm font-medium mb-2">Password *</label>
          <div class="relative">
            <input type="password" id="password" name="password" required 
                   value="${escapeHtml(data.password || "")}"
                   class="w-full px-3 py-2 pr-20 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none">
            <button type="button" onclick="togglePasswordVisibility('password')" class="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700">
              <svg id="password-eye" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
            <button type="button" onclick="generatePassword('password')" class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-primary-600 hover:text-primary-700" title="Generate Password">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"></polygon>
              </svg>
            </button>
          </div>
        </div>
        <div>
          <label for="email" class="block text-sm font-medium mb-2">Recovery Email</label>
          <input type="email" id="email" name="email" 
                 value="${escapeHtml(data.email || "")}"
                 class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none">
        </div>
        <div>
          <label for="notes" class="block text-sm font-medium mb-2">Notes</label>
          <textarea id="notes" name="notes" rows="3" 
                    class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    placeholder="Additional notes...">${escapeHtml(
                      data.notes || ""
                    )}</textarea>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Bank Card form
 */
function renderBankCardForm(item) {
  const data = item || {};
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="space-y-4">
        <div>
          <label for="bankName" class="block text-sm font-medium mb-2">Bank Name *</label>
          <input type="text" id="bankName" name="bankName" required 
                 value="${escapeHtml(data.bankName || "")}"
                 class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                 placeholder="e.g., HDFC Bank, SBI, ICICI">
        </div>
        <div>
          <label for="cardType" class="block text-sm font-medium mb-2">Card Type *</label>
          <select id="cardType" name="cardType" required 
                  class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none">
            <option value="">Select Card Type</option>
            <option value="Debit Card" ${
              data.cardType === "Debit Card" ? "selected" : ""
            }>Debit Card</option>
            <option value="Credit Card" ${
              data.cardType === "Credit Card" ? "selected" : ""
            }>Credit Card</option>
            <option value="Prepaid Card" ${
              data.cardType === "Prepaid Card" ? "selected" : ""
            }>Prepaid Card</option>
          </select>
        </div>
        <div>
          <label for="nameOnAccount" class="block text-sm font-medium mb-2">Name on Card *</label>
          <input type="text" id="nameOnAccount" name="nameOnAccount" required 
                 value="${escapeHtml(data.nameOnAccount || "")}"
                 class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                 placeholder="As printed on card">
        </div>
        <div>
          <label for="cardNumber" class="block text-sm font-medium mb-2">Card Number *</label>
          <input type="text" id="cardNumber" name="cardNumber" required 
                 value="${escapeHtml(data.cardNumber || "")}"
                 class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                 placeholder="1234 5678 9012 3456"
                 maxlength="19">
        </div>
      </div>
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label for="expiryDate" class="block text-sm font-medium mb-2">Expiry Date *</label>
            <input type="text" id="expiryDate" name="expiryDate" required 
                   value="${escapeHtml(data.expiryDate || "")}"
                   class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                   placeholder="MM/YY"
                   maxlength="5">
          </div>
          <div>
            <label for="cvv" class="block text-sm font-medium mb-2">CVV *</label>
            <div class="relative">
              <input type="password" id="cvv" name="cvv" required 
                     value="${escapeHtml(data.cvv || "")}"
                     class="w-full px-3 py-2 pr-10 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                     placeholder="123"
                     maxlength="4">
              <button type="button" onclick="togglePasswordVisibility('cvv')" class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div>
          <label for="pin" class="block text-sm font-medium mb-2">ATM PIN</label>
          <div class="relative">
            <input type="password" id="pin" name="pin" 
                   value="${escapeHtml(data.pin || "")}"
                   class="w-full px-3 py-2 pr-10 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                   placeholder="****"
                   maxlength="6">
            <button type="button" onclick="togglePasswordVisibility('pin')" class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
        </div>
        <div>
          <label for="notes" class="block text-sm font-medium mb-2">Notes</label>
          <textarea id="notes" name="notes" rows="3" 
                    class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    placeholder="Additional notes...">${escapeHtml(
                      data.notes || ""
                    )}</textarea>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Government ID form
 */
function renderGovernmentIdForm(item) {
  const data = item || {};
  return `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="space-y-4">
        <div>
          <label for="idType" class="block text-sm font-medium mb-2">ID Type *</label>
          <select id="idType" name="idType" required 
                  class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none">
            <option value="">Select ID Type</option>
            <option value="Aadhaar Card" ${
              data.idType === "Aadhaar Card" ? "selected" : ""
            }>Aadhaar Card</option>
            <option value="PAN Card" ${
              data.idType === "PAN Card" ? "selected" : ""
            }>PAN Card</option>
            <option value="Passport" ${
              data.idType === "Passport" ? "selected" : ""
            }>Passport</option>
            <option value="Driving License" ${
              data.idType === "Driving License" ? "selected" : ""
            }>Driving License</option>
            <option value="Voter ID" ${
              data.idType === "Voter ID" ? "selected" : ""
            }>Voter ID</option>
            <option value="Employee ID" ${
              data.idType === "Employee ID" ? "selected" : ""
            }>Employee ID</option>
            <option value="Other" ${
              data.idType === "Other" ? "selected" : ""
            }>Other</option>
          </select>
        </div>
        <div>
          <label for="idNumber" class="block text-sm font-medium mb-2">ID Number *</label>
          <input type="text" id="idNumber" name="idNumber" required 
                 value="${escapeHtml(data.idNumber || "")}"
                 class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                 placeholder="Enter ID number">
        </div>
        <div>
          <label for="fullName" class="block text-sm font-medium mb-2">Full Name *</label>
          <input type="text" id="fullName" name="fullName" required 
                 value="${escapeHtml(data.fullName || "")}"
                 class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                 placeholder="As per ID document">
        </div>
        <div>
          <label for="dateOfBirth" class="block text-sm font-medium mb-2">Date of Birth</label>
          <input type="date" id="dateOfBirth" name="dateOfBirth" 
                 value="${data.dateOfBirth || ""}"
                 class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none">
        </div>
      </div>
      <div class="space-y-4">
        <div>
          <label for="issuedDate" class="block text-sm font-medium mb-2">Issue Date</label>
          <input type="date" id="issuedDate" name="issuedDate" 
                 value="${data.issuedDate || ""}"
                 class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none">
        </div>
        <div>
          <label for="expiryDate" class="block text-sm font-medium mb-2">Expiry Date</label>
          <input type="date" id="expiryDate" name="expiryDate" 
                 value="${data.expiryDate || ""}"
                 class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none">
        </div>
        <div>
          <label for="issuingAuthority" class="block text-sm font-medium mb-2">Issuing Authority</label>
          <input type="text" id="issuingAuthority" name="issuingAuthority" 
                 value="${escapeHtml(data.issuingAuthority || "")}"
                 class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                 placeholder="Government department/agency">
        </div>
        <div>
          <label for="notes" class="block text-sm font-medium mb-2">Notes</label>
          <textarea id="notes" name="notes" rows="3" 
                    class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    placeholder="Additional notes...">${escapeHtml(
                      data.notes || ""
                    )}</textarea>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render Secure Note form
 */
function renderSecureNoteForm(item) {
  const data = item || {};
  return `
    <div class="space-y-4">
      <div>
        <label for="title" class="block text-sm font-medium mb-2">Note Title *</label>
        <input type="text" id="title" name="title" required 
               value="${escapeHtml(data.title || "")}"
               class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
               placeholder="Enter note title">
      </div>
      <div>
        <label for="content" class="block text-sm font-medium mb-2">Content *</label>
        <textarea id="content" name="content" required rows="12" 
                  class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  placeholder="Enter your secure note content...">${escapeHtml(
                    data.content || ""
                  )}</textarea>
      </div>
      <div>
        <label for="category" class="block text-sm font-medium mb-2">Category</label>
        <select id="category" name="category" 
                class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none">
          <option value="">Select Category</option>
          <option value="Personal" ${
            data.category === "Personal" ? "selected" : ""
          }>Personal</option>
          <option value="Work" ${
            data.category === "Work" ? "selected" : ""
          }>Work</option>
          <option value="Finance" ${
            data.category === "Finance" ? "selected" : ""
          }>Finance</option>
          <option value="Health" ${
            data.category === "Health" ? "selected" : ""
          }>Health</option>
          <option value="Travel" ${
            data.category === "Travel" ? "selected" : ""
          }>Travel</option>
          <option value="Other" ${
            data.category === "Other" ? "selected" : ""
          }>Other</option>
        </select>
      </div>
    </div>
  `;
}

/**
 * Setup form-specific events and formatting
 */
function setupFormEvents(category) {
  switch (category) {
    case "cards":
      // Format card number input
      const cardNumberInput = document.getElementById("cardNumber");
      cardNumberInput?.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\s/g, "").replace(/\D/g, "");
        value = value.replace(/(.{4})/g, "$1 ").trim();
        e.target.value = value;
      });

      // Format expiry date input
      const expiryInput = document.getElementById("expiryDate");
      expiryInput?.addEventListener("input", (e) => {
        let value = e.target.value.replace(/\D/g, "");
        if (value.length >= 2) {
          value = value.substring(0, 2) + "/" + value.substring(2, 4);
        }
        e.target.value = value;
      });
      break;

    case "passwords":
      // Auto-generate website favicon
      const websiteInput = document.getElementById("website");
      const titleInput = document.getElementById("title");

      websiteInput?.addEventListener("blur", (e) => {
        const url = e.target.value;
        if (url && !titleInput.value) {
          try {
            const domain = new URL(
              url.startsWith("http") ? url : "https://" + url
            ).hostname;
            const siteName = domain.replace("www.", "").split(".")[0];
            titleInput.value =
              siteName.charAt(0).toUpperCase() + siteName.slice(1);
          } catch (e) {
            // Ignore invalid URLs
          }
        }
      });
      break;
  }
}

/**
 * Handle form submission for all categories
 */
function handleFormSubmit(e, existingItem) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = {};

  // Convert FormData to regular object
  for (let [key, value] of formData.entries()) {
    data[key] = value.trim();
  }

  // Add metadata
  data.id = existingItem ? existingItem.id : generateId();
  data.created = existingItem ? existingItem.created : new Date().toISOString();
  data.updated = new Date().toISOString();

  // Category-specific validation and processing
  if (!validateFormData(data, state.currentCategory)) {
    return; // Validation errors are shown by validateFormData
  }

  // Process data based on category
  processFormData(data, state.currentCategory);

  // Save to state
  if (!state.decryptedData[state.currentCategory]) {
    state.decryptedData[state.currentCategory] = [];
  }

  if (existingItem) {
    // Update existing item
    const index = state.decryptedData[state.currentCategory].findIndex(
      (item) => item.id === existingItem.id
    );
    if (index !== -1) {
      state.decryptedData[state.currentCategory][index] = data;
      showToast(
        `${CATEGORIES[state.currentCategory].name.slice(
          0,
          -1
        )} updated successfully!`,
        "success"
      );
    }
  } else {
    // Add new item
    state.decryptedData[state.currentCategory].push(data);
    showToast(
      `${CATEGORIES[state.currentCategory].name.slice(
        0,
        -1
      )} saved successfully!`,
      "success"
    );
  }

  // Save to localStorage
  saveData();

  // Set the selected item first, then render
  state.selectedItemId = data.id;
  render();
  renderDetailsPane();
}

function validateFormData(data, category) {
  // Basic validation - ensure required fields are present
  switch (category) {
    case "passwords":
      if (!data.website || !data.username) {
        showToast("Website and username are required", "error");
        return false;
      }
      break;
    case "cards":
      if (!data.cardholderName || !data.cardNumber) {
        showToast("Cardholder name and card number are required", "error");
        return false;
      }
      break;
    case "notes":
      if (!data.title) {
        showToast("Title is required", "error");
        return false;
      }
      break;
    case "identities":
      if (!data.firstName || !data.lastName) {
        showToast("First name and last name are required", "error");
        return false;
      }
      break;
  }
  return true;
}

/**
 * Process form data for category-specific formatting
 */
function processFormData(data, category) {
  switch (category) {
    case "cards":
      // Auto-detect card brand
      data.cardBrand = detectCardType(data.cardNumber);
      break;

    case "passwords":
      // Ensure website has protocol
      if (data.website && !data.website.startsWith("http")) {
        data.website = "https://" + data.website;
      }
      break;
  }
}

/**
 * Validate URL format
 */
function isValidUrl(string) {
  try {
    new URL(string.startsWith("http") ? string : "https://" + string);
    return true;
  } catch (_) {
    return false;
  }
}

/**
 * Toggle password visibility
 */
window.togglePasswordVisibility = function (fieldId) {
  const field = document.getElementById(fieldId);
  const eye =
    document.getElementById(fieldId + "-eye") ||
    field.nextElementSibling?.querySelector("svg");

  if (field.type === "password") {
    field.type = "text";
    if (eye) {
      eye.innerHTML =
        '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    }
  } else {
    field.type = "password";
    if (eye) {
      eye.innerHTML =
        '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
  }
};

/**
 * Generate password and fill field
 */
window.generatePassword = function (fieldId) {
  const chars = {
    uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    lowercase: "abcdefghijklmnopqrstuvwxyz",
    numbers: "0123456789",
    symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
  };

  let charset =
    chars.uppercase + chars.lowercase + chars.numbers + chars.symbols;
  let password = "";

  // Ensure at least one character from each set
  password += chars.uppercase.charAt(
    Math.floor(Math.random() * chars.uppercase.length)
  );
  password += chars.lowercase.charAt(
    Math.floor(Math.random() * chars.lowercase.length)
  );
  password += chars.numbers.charAt(
    Math.floor(Math.random() * chars.numbers.length)
  );
  password += chars.symbols.charAt(
    Math.floor(Math.random() * chars.symbols.length)
  );

  // Fill remaining characters
  for (let i = 4; i < 16; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  // Shuffle the password
  password = password
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");

  const field = document.getElementById(fieldId);
  if (field) {
    field.value = password;
  }
};

/**
 * Cancel form and return to item list
 */
window.cancelForm = function () {
  state.selectedItemId = null;
  renderDetailsPane();
};

/**
 * Close the third panel (form panel)
 */
function closeThirdPanel() {
  const thirdPanelContainer = domElements.thirdPanelContainer;
  if (thirdPanelContainer) {
    thirdPanelContainer.style.display = "none";
    domElements.thirdPanel.innerHTML = "";
  }
  state.selectedItemId = null;
}

/**
 * Detect card type from card number
 */
function detectCardType(number) {
  const cleanNumber = number.replace(/\s/g, "");

  // Visa
  if (/^4/.test(cleanNumber)) return "visa";

  // Mastercard
  if (/^5[1-5]/.test(cleanNumber) || /^2[2-7]/.test(cleanNumber))
    return "mastercard";

  // American Express
  if (/^3[47]/.test(cleanNumber)) return "amex";

  // Discover
  if (/^6/.test(cleanNumber)) return "discover";

  // Diners Club
  if (/^30[0-5]/.test(cleanNumber) || /^3[68]/.test(cleanNumber))
    return "dinersclub";

  // JCB
  if (/^35/.test(cleanNumber)) return "jcb";

  // RuPay
  if (/^60|^65|^81|^82/.test(cleanNumber)) return "rupay";

  return "unknown";
}

window.editItem = function (itemId) {
  const item = (state.decryptedData[state.currentCategory] || []).find(
    (i) => i.id === itemId
  );
  if (item) {
    state.selectedItemId = itemId;
    renderForm(item);
  }
};

window.deleteItem = function (itemId) {
  const item = (state.decryptedData[state.currentCategory] || []).find(
    (i) => i.id === itemId
  );
  if (item) {
    const deleteItemName = document.getElementById("delete-item-name");
    if (deleteItemName) {
      deleteItemName.textContent = getItemTitle(item);
    }
    domElements.modalBackdrop.style.display = "flex";
    domElements.deleteConfirmModal.style.display = "block";

    // Store the item ID for deletion
    window.pendingDeleteId = itemId;
  }
};

window.cancelForm = function () {
  state.selectedItemId = null;
  renderDetailsPane();
};

// ========================================
// PART 11: EVENT LISTENERS & INITIALIZATION
// ========================================

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Master password form
  domElements.masterPasswordForm?.addEventListener(
    "submit",
    handleMasterPasswordSubmit
  );

  // Forgot password
  domElements.forgotPasswordBtn?.addEventListener("click", () => {
    domElements.modalBackdrop.style.display = "flex";
    domElements.forgotPasswordModal.style.display = "block";
  });

  // Lock button
  domElements.lockButton?.addEventListener("click", () => {
    if (autoLogoutTimer) {
      clearTimeout(autoLogoutTimer);
    }
    state.isLocked = true;
    state.masterPassword = null;
    state.decryptedData = null;
    state.selectedItemId = null;
    state.lockedDueToInactivity = false; // manual lock should not show inactivity banner
    state.lockedDueToRefresh = false; // nor refresh banner
    state.lockedDueToManual = true;
    try {
      closeAllModals();
    } catch (_) {}
    try {
      localStorage.setItem("vaultLockReason", "manual");
    } catch (_) {}
    render();
  });

  // Search functionality
  domElements.searchBar?.addEventListener(
    "input",
    debounce((e) => {
      state.searchTerm = e.target.value;
      saveViewState();
      renderItemList();
    }, 300)
  );

  // Add new item
  domElements.addNewItemBtn?.addEventListener("click", () => {
    state.selectedItemId = "new";
    renderDetailsPane();
  });

  // Item list clicks
  domElements.itemList?.addEventListener("click", (e) => {
    const card = e.target.closest(".item-card");
    if (card) {
      state.selectedItemId = card.dataset.id;
      renderItemList(); // re-render for active state
      renderDetailsPane();
    }
  });

  // Mobile navigation
  domElements.mobileMenuBtn?.addEventListener("click", () => {
    domElements.navSidebar.classList.add("is-open");
    domElements.mobileOverlay.style.display = "block";
  });

  domElements.mobileOverlay?.addEventListener("click", () => {
    domElements.navSidebar.classList.remove("is-open");
    domElements.mobileOverlay.style.display = "none";
  });

  domElements.mobileBackBtn?.addEventListener("click", () => {
    state.selectedItemId = null;
    render();
  });

  // Global search
  domElements.globalSearchBtn?.addEventListener("click", openGlobalSearch);
  domElements.globalSearchClose?.addEventListener("click", closeGlobalSearch);
  domElements.globalSearchInput?.addEventListener("input", handleGlobalSearch);

  // Theme buttons
  Object.keys(domElements.themeBtns).forEach((theme) => {
    domElements.themeBtns[theme].forEach((btn) => {
      btn?.addEventListener("click", () => applyTheme(theme));
    });
  });

  // Fallback: inject greyscale buttons if missing (in case HTML not updated)
  (function ensureGreyscaleButtons() {
    const currentTheme = localStorage.getItem("theme") || "auto";

    // Setup screen container
    if (!document.getElementById("theme-greyscale-setup")) {
      const setupContainer = document.querySelector(
        "#lock-screen .flex.items-center.justify-center.gap-2.pt-2"
      );
      if (setupContainer) {
        setupContainer.insertAdjacentHTML(
          "beforeend",
          `<button type="button" id="theme-greyscale-setup" class="theme-btn p-2 rounded-lg" title="Greyscale Mode">
             <svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'>
               <circle cx='12' cy='12' r='9' fill='#374151'/>
               <path d='M12 3a9 9 0 0 1 0 18z' fill='white'/>
               <circle cx='12' cy='9' r='1.5' fill='white'/>
               <circle cx='12' cy='15' r='1.5' fill='#374151'/>
             </svg>
           </button>`
        );
      }
    }

    // Sidebar container
    if (!document.getElementById("theme-greyscale")) {
      const sidebarContainer = document.querySelector(
        "#nav-sidebar .flex.items-center.justify-center.space-x-2"
      );
      if (sidebarContainer) {
        sidebarContainer.insertAdjacentHTML(
          "beforeend",
          `<button type="button" id="theme-greyscale" class="theme-btn p-2 rounded-lg" title="Greyscale Mode">
             <svg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'>
               <circle cx='12' cy='12' r='9' fill='#374151'/>
               <path d='M12 3a9 9 0 0 1 0 18z' fill='white'/>
               <circle cx='12' cy='9' r='1.5' fill='white'/>
               <circle cx='12' cy='15' r='1.5' fill='#374151'/>
             </svg>
           </button>`
        );
      }
    }

    // Re-query theme buttons to include injected ones
    domElements.themeBtns.greyscale = document.querySelectorAll(
      "#theme-greyscale, #theme-greyscale-setup"
    );
    domElements.themeBtns.greyscale.forEach((btn) =>
      btn?.addEventListener("click", () => applyTheme("greyscale"))
    );
    updateThemeButtonStates(currentTheme);
  })();

  // Import/Export
  domElements.importExportButton?.addEventListener(
    "click",
    openImportExportModal
  );

  // Modal event listeners
  setupModalEventListeners();

  // Window resize
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1024) {
      domElements.navSidebar.classList.remove("is-open");
      domElements.mobileOverlay.style.display = "none";
    }
    renderItemList();
    updateResponsiveLayout();
  });

  // Global keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    // Ctrl+/ for global search
    if ((e.ctrlKey || e.metaKey) && e.key === "/") {
      e.preventDefault();
      openGlobalSearch();
    }
    // Escape to close modals
    if (e.key === "Escape") {
      closeAllModals();
    }
  });

  // Activity events for auto-logout
  const activityEvents = [
    "mousedown",
    "mousemove",
    "keypress",
    "keydown",
    "keyup",
    "input",
    "scroll",
    "touchstart",
    "click",
  ];
  activityEvents.forEach((event) => {
    document.addEventListener(
      event,
      () => {
        if (!state.isLocked) {
          resetAutoLogoutTimer();
        }
      },
      { passive: true, capture: true }
    );
  });
}

/**
 * Setup modal event listeners
 */
function setupModalEventListeners() {
  // Modal backdrop clicks
  domElements.modalBackdrop?.addEventListener("click", (e) => {
    if (e.target === domElements.modalBackdrop) {
      closeAllModals();
    }
  });

  domElements.globalSearchBackdrop?.addEventListener("click", (e) => {
    if (e.target === domElements.globalSearchBackdrop) {
      closeGlobalSearch();
    }
  });

  // Forgot password modal
  document
    .getElementById("cancel-forgot-modal")
    ?.addEventListener("click", closeAllModals);
  document
    .getElementById("proceed-to-wipe-btn")
    ?.addEventListener("click", () => {
      domElements.forgotPasswordModal.style.display = "none";
      domElements.panicModal.style.display = "block";
    });
  document
    .getElementById("export-from-forgot-btn")
    ?.addEventListener("click", exportEncryptedData);

  // Panic modal
  document
    .getElementById("cancel-panic")
    ?.addEventListener("click", closeAllModals);
  document
    .getElementById("panic-confirm-input")
    ?.addEventListener("input", (e) => {
      const confirmBtn = document.getElementById("confirm-panic");
      if (confirmBtn) {
        confirmBtn.disabled = e.target.value !== "DELETE";
      }
    });
  document.getElementById("confirm-panic")?.addEventListener("click", () => {
    localStorage.removeItem("vaultData");
    window.location.reload();
  });

  // Import/Export modal
  document
    .getElementById("close-import-export-modal")
    ?.addEventListener("click", closeAllModals);
  document.getElementById("export-data-btn")?.addEventListener("click", () => {
    if (!state.masterPassword) {
      showToast("Please unlock the vault to export data", "error");
      return;
    }
    exportEncryptedData();
  });

  // File import handling
  document
    .getElementById("import-file-input")
    ?.addEventListener("change", handleFileImport);

  // Import verification form
  document
    .getElementById("import-verification-form")
    ?.addEventListener("submit", handleImportVerification);
  document
    .getElementById("cancel-verification-btn")
    ?.addEventListener("click", () => {
      domElements.importVerificationModal.style.display = "none";
      domElements.importExportModal.style.display = "none";
      domElements.modalBackdrop.style.display = "none";
    });

  // Delete confirmation
  document
    .getElementById("confirm-delete-btn")
    ?.addEventListener("click", confirmDeleteItem);
  document
    .getElementById("cancel-delete-btn")
    ?.addEventListener("click", closeAllModals);
}

/**
 * Handle master password form submission
 */
function handleMasterPasswordSubmit(e) {
  e.preventDefault();

  const password = domElements.masterPassword.value;
  const userName = domElements.userName?.value.trim();
  const confirmPassword = domElements.confirmMasterPassword?.value;

  // Clear previous validation messages
  domElements.passwordError.innerHTML = "";

  if (state.hasVault) {
    // Unlock existing vault

    // Check if password field is empty
    if (!password || password.trim() === "") {
      const errorContainer = domElements.passwordError;
      errorContainer.innerHTML = `
        <div class="validation-message error">
          <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>Please enter a password.</span>
        </div>
      `;
      // Shake password input and unlock button with error styling
      const passwordInput = domElements.masterPassword;
      const unlockButton = document.getElementById("unlock-button");

      // Add red styling to lock screen elements
      const lockIcon = document.querySelector("#lock-screen svg");
      const banner = document.getElementById("inactivity-banner");
      const themeButtons = document.querySelectorAll("#lock-screen .theme-btn");

      passwordInput.classList.add("shake", "error-state");
      unlockButton.classList.add("shake");

      // Turn elements red (no shake)
      if (lockIcon) lockIcon.classList.add("error-red");
      if (banner && banner.style.display !== "none")
        banner.classList.add("error-red");
      themeButtons.forEach((btn) => btn.classList.add("error-red"));

      // Turn favicon red during error
      updateFaviconColor("error");

      setTimeout(() => {
        passwordInput.classList.remove("shake", "error-state");
        unlockButton.classList.remove("shake");

        // Remove red styling from other elements
        if (lockIcon) lockIcon.classList.remove("error-red");
        if (banner && banner.style.display !== "none")
          banner.classList.remove("error-red");
        themeButtons.forEach((btn) => btn.classList.remove("error-red"));

        // Restore favicon to normal color
        updateFaviconColor("normal");

        // Clear error message when shake animation ends
        domElements.passwordError.innerHTML = "";
      }, 800); // Match shake animation duration
      return;
    }

    const decryptedData = loadData(password);

    if (decryptedData) {
      state.masterPassword = password;
      state.decryptedData = decryptedData;
      state.isLocked = false;
      state.lockedDueToInactivity = false;
      state.lockedDueToRefresh = false;
      state.lockedDueToManual = false;
      // Mark that vault was unlocked this session (so a hard refresh can show banner)
      try {
        localStorage.setItem("vaultWasUnlocked", "1");
        localStorage.removeItem("vaultLockReason");
      } catch (_) {}
      loadViewState();
      render();
    } else {
      // Enhanced validation message with icon
      const errorContainer = domElements.passwordError;
      errorContainer.innerHTML = `
        <div class="validation-message error">
          <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <span>Invalid master password. Please try again.</span>
        </div>
      `;
      // Shake password input and unlock button with error styling
      const passwordInput = domElements.masterPassword;
      const unlockButton = document.getElementById("unlock-button");

      // Add red styling to lock screen elements
      const lockIcon = document.querySelector("#lock-screen svg");
      const banner = document.getElementById("inactivity-banner");
      const themeButtons = document.querySelectorAll("#lock-screen .theme-btn");

      passwordInput.classList.add("shake", "error-state");
      unlockButton.classList.add("shake");

      // Turn elements red (no shake)
      if (lockIcon) lockIcon.classList.add("error-red");
      if (banner && banner.style.display !== "none")
        banner.classList.add("error-red");
      themeButtons.forEach((btn) => btn.classList.add("error-red"));

      // Turn favicon red during error
      updateFaviconColor("error");

      setTimeout(() => {
        passwordInput.classList.remove("shake", "error-state");
        unlockButton.classList.remove("shake");

        // Remove red styling from other elements
        if (lockIcon) lockIcon.classList.remove("error-red");
        if (banner && banner.style.display !== "none")
          banner.classList.remove("error-red");
        themeButtons.forEach((btn) => btn.classList.remove("error-red"));

        // Restore favicon to normal color
        updateFaviconColor("normal");

        // Clear error message when shake animation ends
        domElements.passwordError.innerHTML = "";
      }, 800); // Match shake animation duration
    }
  } else {
    // Create new vault

    // First check if any required fields are empty
    if (!password || !confirmPassword || !userName) {
      const errorContainer = domElements.passwordError;
      errorContainer.innerHTML = `
        <div class="validation-message error">
          <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>Please fill all fields</span>
        </div>
      `;

      // Get all inputs and buttons
      const nameInput = domElements.userName;
      const passwordInput = domElements.masterPassword;
      const confirmInput = domElements.confirmMasterPassword;
      const createVaultButton = document.getElementById("create-vault-button");
      const lockIcon = document.querySelector("#lock-screen svg");

      // Only shake fields that are empty
      const fieldsToShake = [];
      if (nameInput && !nameInput.value.trim()) fieldsToShake.push(nameInput);
      if (passwordInput && !passwordInput.value.trim())
        fieldsToShake.push(passwordInput);
      if (confirmInput && !confirmInput.value.trim())
        fieldsToShake.push(confirmInput);

      fieldsToShake.forEach((input) => {
        input.classList.add("shake", "error-state");
      });
      createVaultButton.classList.add("shake");

      // Turn lock icon red
      if (lockIcon) lockIcon.classList.add("error-red");

      // Turn favicon red during error
      updateFaviconColor("error");

      setTimeout(() => {
        fieldsToShake.forEach((input) => {
          input.classList.remove("shake", "error-state");
        });
        createVaultButton.classList.remove("shake");

        // Remove red styling from lock icon
        if (lockIcon) lockIcon.classList.remove("error-red");

        // Restore favicon to normal color
        updateFaviconColor("normal");

        // Clear error message when shake animation ends
        domElements.passwordError.innerHTML = "";
      }, 800); // Match shake animation duration
      return;
    }

    if (password.length < 8) {
      const errorContainer = domElements.passwordError;
      errorContainer.innerHTML = `
        <div class="validation-message error">
          <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
            <line x1="12" y1="9" x2="12" y2="13"></line>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
          <span>Password must be at least 8 characters long for security.</span>
        </div>
      `;
      // Shake password input and create vault button
      const passwordInput = domElements.masterPassword;
      const createVaultButton = document.getElementById("create-vault-button");
      const lockIcon = document.querySelector("#lock-screen svg");

      passwordInput.classList.add("shake", "error-state");
      createVaultButton.classList.add("shake");

      // Turn lock icon red
      if (lockIcon) lockIcon.classList.add("error-red");

      // Turn favicon red during error
      updateFaviconColor("error");

      setTimeout(() => {
        passwordInput.classList.remove("shake", "error-state");
        createVaultButton.classList.remove("shake");

        // Remove red styling from lock icon
        if (lockIcon) lockIcon.classList.remove("error-red");

        // Restore favicon to normal color
        updateFaviconColor("normal");

        // Clear error message when shake animation ends
        domElements.passwordError.innerHTML = "";
      }, 800); // Match shake animation duration
      return;
    }
    if (password !== confirmPassword) {
      const errorContainer = domElements.passwordError;
      errorContainer.innerHTML = `
        <div class="validation-message error">
          <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6L6 18"></path>
            <path d="M6 6l12 12"></path>
          </svg>
          <span>Passwords don't match. Please check and try again.</span>
        </div>
      `;
      // Shake confirm password input and create vault button
      const confirmInput = domElements.confirmMasterPassword;
      const createVaultButton = document.getElementById("create-vault-button");
      const lockIcon = document.querySelector("#lock-screen svg");

      confirmInput.classList.add("shake", "error-state");
      createVaultButton.classList.add("shake");

      // Turn lock icon red
      if (lockIcon) lockIcon.classList.add("error-red");

      // Turn favicon red during error
      updateFaviconColor("error");

      setTimeout(() => {
        confirmInput.classList.remove("shake", "error-state");
        createVaultButton.classList.remove("shake");

        // Remove red styling from lock icon
        if (lockIcon) lockIcon.classList.remove("error-red");

        // Restore favicon to normal color
        updateFaviconColor("normal");

        // Clear error message when shake animation ends
        domElements.passwordError.innerHTML = "";
      }, 800); // Match shake animation duration
      return;
    }

    // Initialize new vault
    state.masterPassword = password;
    state.decryptedData = initializeDefaultData();
    state.decryptedData.user.name = userName;
    state.isLocked = false;
    state.lockedDueToInactivity = false;
    state.lockedDueToRefresh = false;
    state.lockedDueToManual = false;
    try {
      localStorage.setItem("vaultWasUnlocked", "1");
      localStorage.removeItem("vaultLockReason");
    } catch (_) {}

    saveData();
    render();
  }
}

/**
 * Global search functions
 */
function openGlobalSearch() {
  domElements.globalSearchBackdrop.style.display = "flex";
  domElements.globalSearchInput.focus();
  domElements.globalSearchInput.value = "";
  domElements.globalSearchResults.innerHTML = "";
}

function closeGlobalSearch() {
  domElements.globalSearchBackdrop.style.display = "none";
}

function handleGlobalSearch(e) {
  const query = e.target.value.toLowerCase().trim();

  if (query.length < 2) {
    domElements.globalSearchResults.innerHTML = "";
    return;
  }

  // Search across all categories
  const results = [];
  Object.keys(state.decryptedData).forEach((category) => {
    if (Array.isArray(state.decryptedData[category])) {
      state.decryptedData[category].forEach((item) => {
        const title = getItemTitle(item);
        const subtitle = getItemSubtitle(item);

        if (
          title.toLowerCase().includes(query) ||
          subtitle.toLowerCase().includes(query)
        ) {
          results.push({ item, category });
        }
      });
    }
  });

  // Display results
  if (results.length === 0) {
    domElements.globalSearchResults.innerHTML =
      '<div class="p-4 text-center text-gray-500">No results found</div>';
  } else {
    domElements.globalSearchResults.innerHTML = results
      .map(
        ({ item, category }) => `
            <div class="search-result-item p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-700" 
                 data-category="${category}" data-id="${item.id}">
                <div class="font-medium">${escapeHtml(getItemTitle(item))}</div>
                <div class="text-sm text-gray-500">${escapeHtml(
                  getItemSubtitle(item)
                )} • ${CATEGORIES[category]?.name}</div>
            </div>
        `
      )
      .join("");

    // Add click handlers to results
    domElements.globalSearchResults
      .querySelectorAll(".search-result-item")
      .forEach((el) => {
        el.addEventListener("click", (e) => {
          const category = e.currentTarget.dataset.category;
          const itemId = e.currentTarget.dataset.id;

          state.currentCategory = category;
          state.selectedItemId = itemId;
          closeGlobalSearch();
          render();
        });
      });
  }
}

/**
 * Import/Export functions
 */
function openImportExportModal() {
  domElements.modalBackdrop.style.display = "flex";
  domElements.importExportModal.style.display = "block";

  // Reset status
  const statusEl = document.getElementById("import-status");
  const fileInput = document.getElementById("import-file-input");
  const uploadIcon = document.querySelector(
    "#import-export-modal .border-dashed svg"
  );

  if (statusEl) {
    statusEl.textContent = "";
    statusEl.className = "text-sm h-4 text-center";
  }
  if (fileInput) fileInput.value = "";
  if (uploadIcon) uploadIcon.classList.remove("error-red");
}

function exportEncryptedData() {
  if (
    !state.decryptedData ||
    !state.decryptedData.user ||
    !state.decryptedData.user.email ||
    !state.decryptedData.user.securityQuestion ||
    !state.decryptedData.user.securityAnswer
  ) {
    showToast("Please complete your profile settings first", "error");
    return;
  }

  // Create export data with security metadata
  const exportData = {
    vaultData: state.decryptedData,
    exportMetadata: {
      userName: state.decryptedData.user.name,
      userEmail: state.decryptedData.user.email,
      securityQuestion: state.decryptedData.user.securityQuestion,
      exportDate: new Date().toISOString(),
      version: "2.0",
    },
  };

  // Create composite key for enhanced security (include question to bind answer to specific question)
  const compositeKey =
    state.masterPassword +
    state.decryptedData.user.email +
    state.decryptedData.user.securityQuestion +
    state.decryptedData.user.securityAnswer;

  const qaBinding = computeSecurityQABinding(
    state.decryptedData.user.securityQuestion,
    state.decryptedData.user.securityAnswer
  );
  const encryptedVaultData = encrypt(state.decryptedData, compositeKey);

  // Create the final export structure with metadata
  const finalExportData = {
    vaultData: encryptedVaultData,
    exportMetadata: {
      userName: state.decryptedData.user.name,
      userEmail: state.decryptedData.user.email,
      securityQuestion: state.decryptedData.user.securityQuestion,
      securityQABinding: qaBinding,
      exportDate: new Date().toISOString(),
      version: "2.1", // bump minor due to composite key & binding change
      compositeIncludesQuestion: true,
    },
  };

  const blob = new Blob([JSON.stringify(finalExportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `vault-backup-${new Date().toISOString().split("T")[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("Secure backup exported successfully!", "success");
}

/**
 * Handle file import when user selects a JSON file
 */
function handleFileImport(e) {
  const file = e.target.files[0];
  const statusEl = document.getElementById("import-status");

  if (!file) return;

  if (file.type !== "application/json" && !file.name.endsWith(".json")) {
    statusEl.innerHTML = `
      <div class="validation-message error">
        <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14,2 14,8 20,8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
        <span>Please select a valid JSON file</span>
      </div>
    `;
    statusEl.className = "text-sm h-4 text-center";
    const uploadIcon = document.querySelector(
      "#import-export-modal .border-dashed svg"
    );
    if (uploadIcon) uploadIcon.classList.add("error-red");
    updateFaviconColor("error");
    return;
  }

  const reader = new FileReader();
  reader.onload = function (event) {
    try {
      const fileContent = event.target.result;

      // Try to parse as JSON first
      let importData;
      try {
        importData = JSON.parse(fileContent);
      } catch (parseError) {
        statusEl.innerHTML = `
          <div class="validation-message error">
            <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14,2 14,8 20,8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10,9 9,9 8,9"></polyline>
            </svg>
            <span>Invalid JSON file format</span>
          </div>
        `;
        statusEl.className = "text-sm h-4 text-center";
        const uploadIcon = document.querySelector(
          "#import-export-modal .border-dashed svg"
        );
        if (uploadIcon) uploadIcon.classList.add("error-red");
        updateFaviconColor("error");
        return;
      }

      // Check if this is encrypted export data (has vaultData and exportMetadata)
      if (importData.vaultData && importData.exportMetadata) {
        statusEl.textContent =
          "Encrypted backup detected. Please verify your identity.";
        statusEl.className = "text-sm h-4 text-center text-blue-600";

        // Store temporary import data
        window.tempImportData = importData;

        // Show verification modal
        domElements.importExportModal.style.display = "none";
        domElements.importVerificationModal.style.display = "block";

        // Don't pre-fill email - user must enter it manually for verification
        const emailField = document.getElementById("verify-email");
        if (emailField) {
          emailField.value = "";
        }

        // Always show master password field for security verification
        const masterPasswordContainer = document.getElementById(
          "verify-master-password-container"
        );
        const masterPasswordField = document.getElementById(
          "verify-master-password"
        );
        if (masterPasswordContainer && masterPasswordField) {
          // Always show and require master password field for security
          masterPasswordContainer.classList.remove("hidden");
          masterPasswordField.required = true;
          masterPasswordField.value = ""; // Never auto-populate for security
        }

        const questionDisplay = document.getElementById(
          "security-question-display"
        );
        if (questionDisplay && importData.exportMetadata.securityQuestion) {
          questionDisplay.textContent =
            importData.exportMetadata.securityQuestion;
        }
        // Always clear any previously entered security answer and messages to prevent auto-pass on re-import
        const answerField = document.getElementById("verify-security-answer");
        if (answerField) answerField.value = "";
        const verificationMsg = document.getElementById("verification-error");
        if (verificationMsg) {
          verificationMsg.textContent = "";
          verificationMsg.className = "text-sm h-4"; // neutral reset
        }
      } else if (
        importData.passwords ||
        importData.cards ||
        importData.identities ||
        importData.notes
      ) {
        // This looks like plain vault data - direct import
        statusEl.textContent = "Unencrypted data detected. Importing...";
        statusEl.className = "text-sm h-4 text-center text-blue-600";

        setTimeout(() => {
          importVaultData(importData);
          closeAllModals();
        }, 500);
      } else {
        // Check if this might be a raw encrypted string (older export format)
        if (
          typeof fileContent === "string" &&
          fileContent.startsWith("U2FsdGVk")
        ) {
          statusEl.textContent =
            "Legacy encrypted backup detected. Please enter your master password.";
          statusEl.className = "text-sm h-4 text-center text-blue-600";

          // Try to decrypt with current master password
          const decryptedData = decrypt(fileContent, state.masterPassword);
          if (decryptedData) {
            setTimeout(() => {
              importVaultData(decryptedData);
              closeAllModals();
            }, 500);
          } else {
            statusEl.innerHTML = `
              <div class="validation-message error">
                <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <circle cx="12" cy="16" r="1"></circle>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>Could not decrypt legacy backup with current password.</span>
              </div>
            `;
            statusEl.className = "text-sm h-4 text-center";
            const uploadIcon = document.querySelector(
              "#import-export-modal .border-dashed svg"
            );
            if (uploadIcon) uploadIcon.classList.add("error-red");
            updateFaviconColor("error");
          }
        } else {
          statusEl.innerHTML = `
            <div class="validation-message error">
              <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                <polyline points="13,2 13,9 20,9"></polyline>
                <circle cx="12" cy="15" r="3"></circle>
                <path d="m9 18 6-6"></path>
              </svg>
              <span>Unknown file format. Please select a valid vault backup.</span>
            </div>
          `;
          statusEl.className = "text-sm h-4 text-center";
          const uploadIcon = document.querySelector(
            "#import-export-modal .border-dashed svg"
          );
          if (uploadIcon) uploadIcon.classList.add("error-red");
          updateFaviconColor("error");
        }
      }
    } catch (error) {
      console.error("Import error:", error);
      statusEl.innerHTML = `
        <div class="validation-message error">
          <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <span>Error reading file. Please try again.</span>
        </div>
      `;
      statusEl.className = "text-sm h-4 text-center";
      const uploadIcon = document.querySelector(
        "#import-export-modal .border-dashed svg"
      );
      if (uploadIcon) uploadIcon.classList.add("error-red");
      updateFaviconColor("error");
    }
  };

  reader.readAsText(file);
}

/**
 * Handle import verification form submission
 */
function handleImportVerification(e) {
  e.preventDefault();

  const email = document.getElementById("verify-email")?.value.trim();
  const securityAnswer = document
    .getElementById("verify-security-answer")
    ?.value.trim();
  const verifyMasterPassword = document
    .getElementById("verify-master-password")
    ?.value.trim();
  const errorEl = document.getElementById("verification-error");

  // Master password is always required for security verification
  if (!email || !securityAnswer || !verifyMasterPassword) {
    errorEl.innerHTML = `
      <div class="validation-message error">
        <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
          <line x1="12" y1="9" x2="12" y2="13"></line>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span>Please fill in all required fields</span>
      </div>
    `;
    updateFaviconColor("error");
    const verifyButton = document.getElementById("verify-and-import-btn");
    const envelopeIcon = document.querySelector(
      "#import-verification-modal svg"
    );

    // Turn envelope icon red
    if (envelopeIcon) envelopeIcon.classList.add("error-red");

    // Shake empty fields
    if (!email) {
      const emailInput = document.getElementById("verify-email");
      emailInput.classList.add("shake", "error-state");
      verifyButton.classList.add("shake");
      setTimeout(() => {
        emailInput.classList.remove("shake", "error-state");
        verifyButton.classList.remove("shake");
        errorEl.innerHTML = "";
        updateFaviconColor("normal");
        if (envelopeIcon) envelopeIcon.classList.remove("error-red");
      }, 800);
    }
    if (!securityAnswer) {
      const answerInput = document.getElementById("verify-security-answer");
      answerInput.classList.add("shake", "error-state");
      verifyButton.classList.add("shake");
      setTimeout(() => {
        answerInput.classList.remove("shake", "error-state");
        verifyButton.classList.remove("shake");
        errorEl.innerHTML = "";
        updateFaviconColor("normal");
        if (envelopeIcon) envelopeIcon.classList.remove("error-red");
      }, 800);
    }
    if (!verifyMasterPassword) {
      const passwordInput = document.getElementById("verify-master-password");
      passwordInput.classList.add("shake", "error-state");
      verifyButton.classList.add("shake");
      setTimeout(() => {
        passwordInput.classList.remove("shake", "error-state");
        verifyButton.classList.remove("shake");
        errorEl.innerHTML = "";
        updateFaviconColor("normal");
        if (envelopeIcon) envelopeIcon.classList.remove("error-red");
      }, 800);
    }
    return;
  }

  if (!window.tempImportData) {
    errorEl.innerHTML = `
      <div class="validation-message error">
        <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <span>No import data found. Please try again.</span>
      </div>
    `;
    updateFaviconColor("error");
    const envelopeIcon = document.querySelector(
      "#import-verification-modal svg"
    );
    if (envelopeIcon) envelopeIcon.classList.add("error-red");
    return;
  }

  try {
    // Determine if export used question in composite key (v2.1+)
    const meta = window.tempImportData.exportMetadata || {};

    // Use the master password entered by the user (always required for security)
    let masterPassword = verifyMasterPassword;

    if (!masterPassword) {
      errorEl.innerHTML = `
        <div class="validation-message error">
          <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <circle cx="12" cy="16" r="1"></circle>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>Master password is required for import verification</span>
        </div>
      `;
      updateFaviconColor("error");
      const envelopeIcon = document.querySelector(
        "#import-verification-modal svg"
      );
      if (envelopeIcon) envelopeIcon.classList.add("error-red");
      return;
    }

    // Validate credentials by attempting decryption with user-provided information
    // This ensures email, master password, and security answer all match the backup
    const compositeKey = meta.compositeIncludesQuestion
      ? masterPassword + email + meta.securityQuestion + securityAnswer
      : masterPassword + email + securityAnswer; // backward compatibility (v2.0)
    let decryptedImportData = decrypt(
      window.tempImportData.vaultData,
      compositeKey
    );

    // If composite key fails, try with just master password (compatibility with older exports)
    if (!decryptedImportData) {
      // Fallback attempt: legacy (master only) if previous also failed
      decryptedImportData = decrypt(
        window.tempImportData.vaultData,
        masterPassword
      );
    }

    // Check QA binding if present and credentials are valid so far
    let validCredentials = !!decryptedImportData;
    if (validCredentials && meta.securityQABinding) {
      const recomputed = computeSecurityQABinding(
        meta.securityQuestion,
        securityAnswer
      );
      if (recomputed !== meta.securityQABinding) {
        validCredentials = false;
      }
    }

    if (!validCredentials) {
      errorEl.innerHTML = `
        <div class="validation-message error">
          <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <span>Invalid credentials. Please check your email, master password, and security answer.</span>
        </div>
      `;
      updateFaviconColor("error");

      // Get all input fields and verify button
      const emailInput = document.getElementById("verify-email");
      const passwordInput = document.getElementById("verify-master-password");
      const answerInput = document.getElementById("verify-security-answer");
      const verifyButton = document.getElementById("verify-and-import-btn");
      const envelopeIcon = document.querySelector(
        "#import-verification-modal svg"
      );

      // Only shake fields that have values
      const fieldsToShake = [];
      if (emailInput && emailInput.value.trim()) fieldsToShake.push(emailInput);
      if (passwordInput && passwordInput.value.trim())
        fieldsToShake.push(passwordInput);
      if (answerInput && answerInput.value.trim())
        fieldsToShake.push(answerInput);

      fieldsToShake.forEach((input) => {
        input.classList.add("shake", "error-state");
      });
      verifyButton.classList.add("shake");
      if (envelopeIcon) envelopeIcon.classList.add("error-red");

      setTimeout(() => {
        fieldsToShake.forEach((input) => {
          input.classList.remove("shake", "error-state");
        });
        verifyButton.classList.remove("shake");
        errorEl.innerHTML = "";
        updateFaviconColor("normal");
        if (envelopeIcon) envelopeIcon.classList.remove("error-red");
      }, 800);
      return;
    }

    // Successful verification - import the data
    errorEl.innerHTML = `
      <div class="validation-message success">
        <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20,6 9,17 4,12"></polyline>
        </svg>
        <span>Verification successful! Importing data...</span>
      </div>
    `;
    errorEl.className = "text-sm h-4";
    updateFaviconColor("normal");
    const envelopeIcon = document.querySelector(
      "#import-verification-modal svg"
    );
    if (envelopeIcon) envelopeIcon.classList.remove("error-red");

    setTimeout(() => {
      importVaultData(
        decryptedImportData,
        window.tempImportData.exportMetadata
      );
      delete window.tempImportData;
      closeAllModals();
    }, 1000);
  } catch (error) {
    console.error("Verification error:", error);
    errorEl.innerHTML = `
      <div class="validation-message error">
        <svg class="validation-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
        <span>Verification failed. Please check your details.</span>
      </div>
    `;
    errorEl.className = "text-sm h-4";
    updateFaviconColor("error");
    const envelopeIcon = document.querySelector(
      "#import-verification-modal svg"
    );
    if (envelopeIcon) envelopeIcon.classList.add("error-red");
  }
}

/**
 * Import vault data and replace current data
 */
function importVaultData(importedData, exportMetadata = null) {
  try {
    // Backup current data (in case user wants to restore)
    const currentBackup = {
      ...state.decryptedData,
      backupDate: new Date().toISOString(),
    };
    localStorage.setItem(
      "vaultBackupBeforeImport",
      JSON.stringify(currentBackup)
    );

    // Merge/replace data
    const newData = {
      passwords: importedData.passwords || [],
      cards: importedData.cards || [],
      identities: importedData.identities || [],
      notes: importedData.notes || [],
      user: importedData.user || state.decryptedData.user,
      settings: {
        ...state.decryptedData.settings,
        ...importedData.settings,
      },
    };

    // Check if we'll be populating name from backup metadata for success message
    const willPopulateName =
      exportMetadata &&
      exportMetadata.userName &&
      (!state.decryptedData.user || !state.decryptedData.user.name);

    // If user data doesn't exist in current vault and we have export metadata with name, populate it
    if (willPopulateName) {
      // For new users or users without profile data, populate name from backup metadata
      newData.user = {
        ...newData.user,
        name: exportMetadata.userName,
      };
    }

    // Update state
    state.decryptedData = newData;

    // Save to localStorage
    saveData();

    // Refresh the view
    render();

    const totalImported =
      (newData.passwords?.length || 0) +
      (newData.cards?.length || 0) +
      (newData.identities?.length || 0) +
      (newData.notes?.length || 0);

    let successMessage = `Successfully imported ${totalImported} items!`;

    // Add note about profile information if name was populated from backup
    if (willPopulateName) {
      successMessage += ` Profile name populated from backup.`;
    }

    showToast(successMessage, "success");
  } catch (error) {
    console.error("Import failed:", error);
    showToast("Import failed. Please try again.", "error");
  }
}

function confirmDeleteItem() {
  if (window.pendingDeleteId) {
    // Remove item from data
    state.decryptedData[state.currentCategory] = state.decryptedData[
      state.currentCategory
    ].filter((i) => i.id !== window.pendingDeleteId);
    saveData();
    state.selectedItemId = null;
    delete window.pendingDeleteId;

    closeAllModals();
    render();
    showToast("Item deleted successfully", "success");
  }
}

/**
 * Close all modals
 */
function closeAllModals() {
  domElements.modalBackdrop.style.display = "none";
  domElements.globalSearchBackdrop.style.display = "none";

  // Hide individual modals
  domElements.forgotPasswordModal.style.display = "none";
  domElements.panicModal.style.display = "none";
  domElements.importExportModal.style.display = "none";
  domElements.importVerificationModal.style.display = "none";
  domElements.deleteConfirmModal.style.display = "none";

  // Clean up temporary data
  if (window.tempImportData) {
    delete window.tempImportData;
    const fileInput = document.getElementById("import-file-input");
    if (fileInput) fileInput.value = "";
  }

  // Reset panic modal
  const panicInput = document.getElementById("panic-confirm-input");
  const confirmPanic = document.getElementById("confirm-panic");
  if (panicInput) panicInput.value = "";
  if (confirmPanic) confirmPanic.disabled = true;

  // Reset import verification modal styling
  const envelopeIcon = document.querySelector("#import-verification-modal svg");
  if (envelopeIcon) envelopeIcon.classList.remove("error-red");

  // Reset import/export modal styling
  const uploadIcon = document.querySelector(
    "#import-export-modal .border-dashed svg"
  );
  if (uploadIcon) uploadIcon.classList.remove("error-red");
}

/**
 * Initialize the application
 */
function init() {
  // Initialize DOM elements
  initializeDOMElements();

  // Setup theme
  setupTheme();

  // Load accent theme (after light/dark so variables override base)
  loadAccentTheme();

  // Setup event listeners
  setupEventListeners();

  // Initial render
  render();
  updateAutoLockFooter();

  // Reveal the app after initial setup
  const appRoot = domElements.app;
  if (appRoot) appRoot.style.visibility = "";

  // Inject back-to-top button (hidden until user reaches bottom of a scroll area)
  if (!document.getElementById("back-to-top-btn")) {
    const btn = document.createElement("button");
    btn.id = "back-to-top-btn";
    btn.type = "button";
    btn.setAttribute("aria-label", "Back to top");
    btn.className =
      "items-center justify-center w-11 h-11 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 dark:focus:ring-offset-gray-900 transition-colors";
    btn.innerHTML =
      "<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M5 12l7-7 7 7'/><path d='M12 19V5'/></svg>";
    document.body.appendChild(btn);
    btn.addEventListener("click", () => {
      const panes = document.querySelectorAll(
        "#item-list-container, #details-pane-container, #third-panel-container, .overflow-y-auto"
      );
      panes.forEach((el) => {
        if (el.scrollTop > 0) {
          try {
            el.scrollTo({ top: 0, behavior: "smooth" });
          } catch (_) {}
        }
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    const tracked = new Set();
    const collectTracked = () => {
      document
        .querySelectorAll(
          "#item-list-container, #details-pane-container, #third-panel-container, .overflow-y-auto"
        )
        .forEach((el) => tracked.add(el));
    };
    collectTracked();
    const SCROLL_SHOW_RATIO = 0.95; // show when 95% or more of scroll reached
    const evaluate = () => {
      let show = false;
      tracked.forEach((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return;
        const max = el.scrollHeight - el.clientHeight;
        if (max <= 0) return;
        const ratio = el.scrollTop / max; // 0..1
        if (ratio >= SCROLL_SHOW_RATIO) show = true;
      });
      const bodyMax =
        document.documentElement.scrollHeight -
        document.documentElement.clientHeight;
      if (bodyMax > 0) {
        const bodyRatio =
          (window.scrollY || document.documentElement.scrollTop) / bodyMax;
        if (bodyRatio >= SCROLL_SHOW_RATIO) show = true;
      }
      if (show) btn.classList.add("show");
      else btn.classList.remove("show");
    };
    const attach = () => {
      tracked.forEach((el) => {
        el.addEventListener("scroll", evaluate, { passive: true });
      });
      window.addEventListener("scroll", evaluate, { passive: true });
    };
    attach();
    document.addEventListener("vault:render", () => {
      collectTracked();
      evaluate();
    });
    evaluate();
  }

  console.log("Vault 2.0: Application initialized successfully");
}

// ========================================
// START APPLICATION
// ========================================

// Wait for DOM to be ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

console.log("Vault 2.0: All modules loaded and ready");
