/**
 * studio-config.js — shared constants and small helpers
 * ---------------------------------------------------------------------------
 * Plans, channels, tone list and the storage/clipboard helpers. Everything the
 * screen and its sub-components need lives here.
 * ---------------------------------------------------------------------------
 */

export const FREE_CREDITS = 5; // free test generations a new, verified account starts with
export const CREDIT_COST = 1; // free credits charged per full 3-channel generation
export const CREDITS_KEY = "aisg:credits:v1"; // localStorage key for the guest balance
export const RESULTS_KEY = "omni:results:v1"; // localStorage key for past generations
export const MAX_RESULTS = 8; // how many past generations to keep

export const TONES = [
  { id: "friendly", label: "Friendly" },
  { id: "bold", label: "Bold" },
  { id: "witty", label: "Witty" },
  { id: "professional", label: "Professional" },
  { id: "inspirational", label: "Inspirational" },
];

/* The three channels every generation returns, in tab order. */
export const CHANNELS = [
  { id: "linkedin", label: "LinkedIn", blurb: "Hook · story · call to action", limit: 3000 },
  { id: "instagram", label: "Instagram / Facebook", blurb: "Caption + hashtags", limit: 2200 },
  { id: "tiktok", label: "TikTok / Reels", blurb: "3-second hook + spoken script", limit: 2200 },
];

/* Display copy and limits only — the real prices live in api/_lib/plans.js. */
export const PLANS = [
  {
    id: "creator",
    name: "Creator",
    price: 19,
    interval: "month",
    vaults: 1,
    tagline: "One brand, every channel",
    popular: true,
    perks: [
      "Unlimited generations",
      "LinkedIn, Instagram and TikTok in one click",
      "1 Brand Vault profile",
      "Anti-cliché voice guard",
    ],
  },
  {
    id: "agency",
    name: "Agency",
    price: 49,
    interval: "month",
    vaults: 5,
    tagline: "Several brands or clients",
    perks: [
      "Unlimited generations",
      "Everything in Creator",
      "Up to 5 Brand Vault profiles",
      "Switch brands per generation",
    ],
  },
];

export const CHANNEL_MAP = Object.fromEntries(CHANNELS.map((channel) => [channel.id, channel]));
export const TONE_MAP = Object.fromEntries(TONES.map((tone) => [tone.id, tone]));

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

/** Does this generation actually contain anything for the channel? */
export function channelHasContent(channelId, channels) {
  const channel = channels?.[channelId] || {};
  if (channelId === "tiktok") return Boolean(String(channel.hook || channel.script || "").trim());
  return Boolean(String(channel.text || "").trim());
}

/** Exactly what should land on the clipboard for one channel. */
export function composeChannel(channelId, channels) {
  const channel = channels?.[channelId] || {};

  if (channelId === "linkedin") return String(channel.text || "").trim();

  if (channelId === "instagram") {
    const tags = cleanHashtags(channel.hashtags);
    const body = String(channel.text || "").trim();
    return tags.length > 0 ? `${body}\n\n${tags.join(" ")}` : body;
  }

  const hook = String(channel.hook || "").trim();
  const script = String(channel.script || "").trim();
  return [hook && `HOOK (first 3 seconds): ${hook}`, script && `SCRIPT:\n${script}`]
    .filter(Boolean)
    .join("\n\n");
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
