export const DEFAULT_URL = "https://claude.ai/new";
const KEY = "claude-launcher:settings";

const guessLang = () =>
  (navigator.language || "en").toLowerCase().startsWith("vi") ? "vi" : "en";

const defaults = () => ({
  lang: guessLang(),
  theme: "system", // light | dark | system
  windowMode: "remember", // remember | maximized
  size: null, // { w, h } kích thước đã nhớ
  url: DEFAULT_URL,
});

export function loadSettings() {
  try {
    return { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return defaults();
  }
}

export function saveSettings(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}
