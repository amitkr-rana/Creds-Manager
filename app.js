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
const AUTO_LOGOUT_DELAY = 60000; // 1 minute

// Password history storage
let passwordHistory = JSON.parse(
  localStorage.getItem("passwordHistory") || "[]"
);

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

/**
 * Generate unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Show temporary toast notification
 */
function showToast(message, type = "success") {
  // Remove existing toast if any
  const existingToast = document.querySelector(".toast-notification");
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement("div");

  // Use primary theme blue for all toast types and center text
  let bgColor, textColor, borderColor;
  const isDark = document.documentElement.classList.contains("dark");
  bgColor = isDark ? "bg-primary-700" : "bg-primary-600";
  textColor = "text-white";
  borderColor = isDark ? "border-primary-600" : "border-primary-500";

  toast.className = `toast-notification fixed bottom-4 right-4 px-4 py-3 rounded-lg font-medium z-50 transition-all duration-300 transform translate-y-0 opacity-100 shadow-lg border text-center ${bgColor} ${textColor} ${borderColor}`;
  toast.textContent = message;

  document.body.appendChild(toast);

  // Auto remove after 3 seconds
  setTimeout(() => {
    toast.style.transform = "translateY(100px)";
    toast.style.opacity = "0";
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3000);
}

/**
 * Copy text to clipboard with visual feedback
 */
function copyToClipboardWithTimeout(text, element = null, timeout = 3000) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      showToast("Copied to clipboard!", "success");

      // Flash highlight effect on the element if provided
      if (element) {
        element.classList.add("flash-highlight");
        setTimeout(() => {
          element.classList.remove("flash-highlight");
        }, 1600);
      }
    })
    .catch(() => {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        showToast("Copied to clipboard!", "success");
        if (element) {
          element.classList.add("flash-highlight");
          setTimeout(() => {
            element.classList.remove("flash-highlight");
          }, 1600);
        }
      } catch (err) {
        showToast("Failed to copy", "error");
      }
      document.body.removeChild(textArea);
    });
}

/**
 * Debounce function for performance optimization
 */
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
    autoLogoutTimer = setTimeout(() => {
      state.isLocked = true;
      state.masterPassword = null;
      state.decryptedData = null;
      state.selectedItemId = null;
      state.lockedDueToInactivity = true;
      render();
    }, AUTO_LOGOUT_DELAY);
  }
}

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
    },
  };
}

// ========================================
// PART 4: THEME MANAGEMENT
// ========================================

/**
 * Apply theme to document
 */
function applyTheme(theme) {
  const root = document.documentElement;
  const favicon = document.getElementById("app-favicon");

  // Remove existing theme classes
  root.classList.remove("dark");

  // Apply theme
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "auto") {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
    }
  }

  // Update favicon color based on theme
  const isDark = root.classList.contains("dark");
  const iconColor = isDark ? "%23A78BFA" : "%236366F1"; // purple-400 : indigo-600
  if (favicon) {
    favicon.href = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${iconColor}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='11' width='18' height='11' rx='2' ry='2'/%3E%3Cpath d='M7 11V7a5 5 0 0 1 10 0v4'/%3E%3C/svg%3E`;
  }

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
  if (state.isLocked) {
    domElements.lockScreen.style.display = "flex";
    domElements.mainApp.style.display = "none";
    domElements.mainApp.classList.add("opacity-0");
    setTimeout(() => domElements.lockScreen.classList.remove("opacity-0"), 10);
    setupLockScreen();
  } else {
    domElements.lockScreen.style.display = "none";
    domElements.lockScreen.classList.add("opacity-0");
    domElements.mainApp.style.display = "block";
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
    domElements.unlockButton.textContent = "Unlock";
    if (forgotPasswordContainer) {
      forgotPasswordContainer.style.display = "block";
    }

    if (userNameInput) {
      userNameInput.removeAttribute("required");
    }
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
    domElements.unlockButton.textContent = "Create Vault";
    if (forgotPasswordContainer) {
      forgotPasswordContainer.style.display = "none";
    }

    if (userNameInput) {
      userNameInput.setAttribute("required", "");
    }
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
    if (state.lockedDueToInactivity) {
      const isDark = document.documentElement.classList.contains("dark");
      const bg = isDark ? "bg-primary-700" : "bg-primary-600";
      const border = isDark ? "border-primary-600" : "border-primary-500";
      const text = "text-white";
      banner.className = `mt-3 px-3 py-2 rounded-md text-sm border text-center ${bg} ${border} ${text}`;
      banner.textContent =
        "Locked due to inactivity. Enter your master password to continue.";
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

  const autoLockMinutes = 1; // Default to 1 minute
  const label =
    autoLockMinutes === 0
      ? "Auto-Lock disabled"
      : `Auto-lock after ${autoLockMinutes} min${
          autoLockMinutes === 1 ? "" : "s"
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
                <form id="profile-form" class="md:col-span-2 lg:col-span-2 space-y-6">
                    ${
                      showFirstLoginBanner
                        ? `
                    <div class="p-4 rounded-lg border border-primary-200 bg-primary-50 dark:bg-primary-500/20 dark:border-primary-800 text-primary-800 dark:text-primary-200">
                        <div class="flex items-start gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mt-0.5 flex-shrink-0">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12" y2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            <p class="text-sm font-medium">Please complete your profile for secure data export/import.</p>
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
                            <input type="text" id="profile-security-question" required value="${escapeHtml(
                              user.securityQuestion || ""
                            )}" 
                                   class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                   placeholder="What is the name of your first pet?">
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

                    <button type="submit" class="w-full px-4 py-3 font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500">
                        Save Profile
                    </button>
                </form>
            </div>
        </div>
    `;

  // Setup profile form event listener
  const profileForm = document.getElementById("profile-form");
  profileForm?.addEventListener("submit", handleProfileSubmit);
}

/**
 * Handle profile form submission
 */
function handleProfileSubmit(e) {
  e.preventDefault();

  const formData = {
    name: document.getElementById("profile-name")?.value.trim() || "",
    email: document.getElementById("profile-email")?.value.trim() || "",
    securityQuestion:
      document.getElementById("profile-security-question")?.value.trim() || "",
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
    showToast("Please fill in all required fields", "error");
    return;
  }

  // Update user data
  state.decryptedData.user = {
    ...state.decryptedData.user,
    ...formData,
    profilePromptShown: true,
    updated: new Date().toISOString(),
  };

  saveData();
  showToast("Profile saved successfully!", "success");

  // Re-render to hide the banner
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
      <form id="item-form" class="space-y-6">
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

  // Update UI
  state.selectedItemId = data.id;
  render();
}

/**
 * Validate form data based on category
 */
function validateFormData(data, category) {
  const errors = [];

  switch (category) {
    case "passwords":
      if (!data.title) errors.push("Website/Service name is required");
      if (!data.username) errors.push("Username/Email is required");
      if (!data.password) errors.push("Password is required");
      if (data.website && !isValidUrl(data.website))
        errors.push("Please enter a valid website URL");
      break;

    case "cards":
      if (!data.bankName) errors.push("Bank name is required");
      if (!data.cardType) errors.push("Card type is required");
      if (!data.nameOnAccount) errors.push("Name on card is required");
      if (!data.cardNumber) errors.push("Card number is required");
      if (!data.expiryDate) errors.push("Expiry date is required");
      if (!data.cvv) errors.push("CVV is required");

      // Validate card number format
      if (data.cardNumber && data.cardNumber.replace(/\s/g, "").length < 13) {
        errors.push("Card number must be at least 13 digits");
      }

      // Validate expiry date format
      if (data.expiryDate && !/^\d{2}\/\d{2}$/.test(data.expiryDate)) {
        errors.push("Expiry date must be in MM/YY format");
      }

      // Validate CVV
      if (data.cvv && (data.cvv.length < 3 || data.cvv.length > 4)) {
        errors.push("CVV must be 3 or 4 digits");
      }
      break;

    case "identities":
      if (!data.idType) errors.push("ID type is required");
      if (!data.idNumber) errors.push("ID number is required");
      if (!data.fullName) errors.push("Full name is required");
      break;

    case "notes":
      if (!data.title) errors.push("Note title is required");
      if (!data.content) errors.push("Note content is required");
      break;
  }

  if (errors.length > 0) {
    showToast(errors[0], "error");
    return false;
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
    showToast("Strong password generated!", "success");
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
      domElements.importExportModal.style.display = "block";
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

  domElements.passwordError.textContent = "";

  if (state.hasVault) {
    // Unlock existing vault
    const decryptedData = loadData(password);

    if (decryptedData) {
      state.masterPassword = password;
      state.decryptedData = decryptedData;
      state.isLocked = false;
      state.lockedDueToInactivity = false;
      loadViewState();
      render();
      showToast("Vault unlocked successfully!", "success");
    } else {
      domElements.passwordError.textContent = "Invalid master password";
    }
  } else {
    // Create new vault
    if (password.length < 8) {
      domElements.passwordError.textContent =
        "Password must be at least 8 characters";
      return;
    }
    if (password !== confirmPassword) {
      domElements.passwordError.textContent = "Passwords do not match";
      return;
    }
    if (!userName) {
      domElements.passwordError.textContent = "Please enter your name";
      return;
    }

    // Initialize new vault
    state.masterPassword = password;
    state.decryptedData = initializeDefaultData();
    state.decryptedData.user.name = userName;
    state.isLocked = false;
    state.lockedDueToInactivity = false;

    saveData();
    render();
    showToast("Vault created successfully!", "success");
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
  if (statusEl) {
    statusEl.textContent = "";
    statusEl.className = "text-sm h-4 text-center";
  }
  if (fileInput) fileInput.value = "";
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

  // Create composite key for enhanced security
  const compositeKey =
    state.masterPassword +
    state.decryptedData.user.email +
    state.decryptedData.user.securityAnswer;
  const encryptedVaultData = encrypt(state.decryptedData, compositeKey);

  // Create the final export structure with metadata
  const finalExportData = {
    vaultData: encryptedVaultData,
    exportMetadata: {
      userName: state.decryptedData.user.name,
      userEmail: state.decryptedData.user.email,
      securityQuestion: state.decryptedData.user.securityQuestion,
      exportDate: new Date().toISOString(),
      version: "2.0",
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
    statusEl.textContent = "Please select a valid JSON file";
    statusEl.className = "text-sm h-4 text-center text-red-600";
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
        statusEl.textContent = "Invalid JSON file format";
        statusEl.className = "text-sm h-4 text-center text-red-600";
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

        // Pre-fill email if available
        const emailField = document.getElementById("verification-email");
        if (emailField && importData.exportMetadata.userEmail) {
          emailField.value = importData.exportMetadata.userEmail;
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
            statusEl.textContent =
              "Could not decrypt legacy backup with current password.";
            statusEl.className = "text-sm h-4 text-center text-red-600";
          }
        } else {
          statusEl.textContent =
            "Unknown file format. Please select a valid vault backup.";
          statusEl.className = "text-sm h-4 text-center text-red-600";
        }
      }
    } catch (error) {
      console.error("Import error:", error);
      statusEl.textContent = "Error reading file. Please try again.";
      statusEl.className = "text-sm h-4 text-center text-red-600";
    }
  };

  reader.readAsText(file);
}

/**
 * Handle import verification form submission
 */
function handleImportVerification(e) {
  e.preventDefault();

  const email = document.getElementById("verification-email")?.value.trim();
  const securityAnswer = document
    .getElementById("verification-security-answer")
    ?.value.trim();
  const errorEl = document.getElementById("verification-error");

  if (!email || !securityAnswer) {
    errorEl.textContent = "Please fill in all fields";
    errorEl.className = "text-red-500 text-sm h-4";
    return;
  }

  if (!window.tempImportData) {
    errorEl.textContent = "No import data found. Please try again.";
    errorEl.className = "text-red-500 text-sm h-4";
    return;
  }

  try {
    // Verify email matches
    if (email !== window.tempImportData.exportMetadata.userEmail) {
      errorEl.textContent = "Email doesn't match the backup file";
      errorEl.className = "text-red-500 text-sm h-4";
      return;
    }

    // Try to decrypt with composite key
    const compositeKey = state.masterPassword + email + securityAnswer;
    let decryptedImportData = decrypt(
      window.tempImportData.vaultData,
      compositeKey
    );

    // If composite key fails, try with just master password (compatibility with older exports)
    if (!decryptedImportData) {
      decryptedImportData = decrypt(
        window.tempImportData.vaultData,
        state.masterPassword
      );
    }

    if (!decryptedImportData) {
      errorEl.textContent = "Invalid security answer or corrupted backup";
      errorEl.className = "text-red-500 text-sm h-4";
      return;
    }

    // Successful verification - import the data
    errorEl.textContent = "Verification successful! Importing data...";
    errorEl.className = "text-green-500 text-sm h-4";

    setTimeout(() => {
      importVaultData(decryptedImportData);
      delete window.tempImportData;
      closeAllModals();
    }, 1000);
  } catch (error) {
    console.error("Verification error:", error);
    errorEl.textContent = "Verification failed. Please check your details.";
    errorEl.className = "text-red-500 text-sm h-4";
  }
}

/**
 * Import vault data and replace current data
 */
function importVaultData(importedData) {
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

    showToast(`Successfully imported ${totalImported} items!`, "success");
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
}

/**
 * Initialize the application
 */
function init() {
  // Initialize DOM elements
  initializeDOMElements();

  // Setup theme
  setupTheme();

  // Setup event listeners
  setupEventListeners();

  // Initial render
  render();
  updateAutoLockFooter();

  // Reveal the app after initial setup
  const appRoot = domElements.app;
  if (appRoot) appRoot.style.visibility = "";

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
