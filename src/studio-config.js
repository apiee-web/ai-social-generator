/**
 * studio-config.js — shared constants and small helpers
 * ---------------------------------------------------------------------------
 * Prices, platform limits, the plan copy and the storage/clipboard helpers.
 * Everything that both the screen and its sub-components need lives here.
 * ---------------------------------------------------------------------------
 */

export const FREE_CREDITS = 3; // credits a brand-new visitor starts with
export const CREDIT_COST = 1; // credits charged per generation
export const CREDITS_KEY = "aisg:credits:v1"; // localStorage key for the guest balance
export const RESULTS_KEY = "aisg:results:v1"; // localStorage key for past captions
export const MAX_RESULTS = 8; // how many past generations to keep in the list

export const PLATFORMS = [
  { id: "instagram", label: "Instagram", limit: 2200 },
  { id: "x", label: "X / Twitter", limit: 280 },
  { id: "linkedin", label: "LinkedIn", limit: 3000 },
  { id: "tiktok", label: "TikTok", limit: 2200 },
  { id: "facebook", label: "Facebook", limit: 63206 },
];

export const TONES = [
  { id: "friendly", label: "Friendly" },
  { id: "bold", label: "Bold" },
  { id: "witty", label: "Witty" },
  { id: "professional", label: "Professional" },
  { id: "inspirational", label: "Inspirational" },
];

/* Display copy only — the real prices are in api/_lib/plans.js. */
export const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 9,
    credits: 50,
    tagline: "Try it out",
    perks: ["50 generations", "All 5 platforms", "Every tone", "Copy-ready captions"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    credits: 250,
    tagline: "For creators",
    popular: true,
    perks: ["250 generations", "Everything in Starter", "3 options per post", "Saved history"],
  },
  {
    id: "agency",
    name: "Agency",
    price: 49,
    credits: 1000,
    tagline: "For teams",
    perks: ["1,000 generations", "Everything in Pro", "Best price per post", "Priority support"],
  },
];

export const PLATFORM_MAP = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));
export const TONE_MAP = Object.fromEntries(TONES.map((t) => [t.id, t]));

export function readStorage(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked — the app still works, it just won't remember */
  }
}

export function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function timeAgo(timestamp) {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function cleanHashtags(hashtags) {
  if (!Array.isArray(hashtags)) return [];
  return hashtags
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/^#+/g, "")}`));
}

/** Caption body + hashtags, exactly as it should be pasted into the app. */
export function composeText(variant) {
  const body = String(variant?.text ?? "").trim();
  const tags = cleanHashtags(variant?.hashtags);
  return tags.length > 0 ? `${body}\n\n${tags.join(" ")}` : body;
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}
