export type ThemePref = "system" | "light" | "dark";
export interface Settings {
  theme: ThemePref;
  density: "comfortable" | "compact";
  reduceMotion: boolean;
  exportFormat: "svg" | "png" | "pdf";
}
export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  density: "comfortable",
  reduceMotion: false,
  exportFormat: "svg",
};
const KEY = "rip-settings";

export function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    return raw
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
      : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function applySettings(s: Settings): void {
  const root = document.documentElement;
  const dark =
    s.theme === "dark" ||
    (s.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.density = s.density;
  root.dataset.motion = s.reduceMotion ? "reduce" : "normal";
}

export function writeSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage can be blocked, the page still works */
  }
  applySettings(s);
  window.dispatchEvent(new Event("rip-settings"));
}

/** Runs before first paint so the theme never flashes. Kept in sync with applySettings. */
export const THEME_SCRIPT = `(function(){try{var s=JSON.parse(localStorage.getItem("${KEY}")||"{}");var t=s.theme||"system";var d=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.dataset.density=s.density||"comfortable";r.dataset.motion=s.reduceMotion?"reduce":"normal"}catch(e){document.documentElement.dataset.theme="light"}})()`;
