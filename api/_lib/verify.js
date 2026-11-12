/**
 * api/_lib/verify.js
 * ---------------------------------------------------------------------------
 * Email verification plus the temporary-address blocklist.
 *
 *   • A verification is a long random token (for the emailed link) and a
 *     six-digit code (for people who would rather type it), both expiring
 *     after 24 hours. Only the hash of the code is stored, so a database
 *     reader can't lift a working code out of the table.
 *   • Disposable mailboxes are refused at signup: they are the cheapest way to
 *     farm free credits, and their owners can't be reached later anyway.
 * ---------------------------------------------------------------------------
 */

import { createHash, randomBytes, randomInt } from "node:crypto";

export const VERIFICATION_HOURS = 24;
export const RESEND_COOLDOWN_SECONDS = 60;

/* Exact domains plus their subdomains (anything.mailinator.com). */
const DISPOSABLE_DOMAINS = [
  "10minutemail.com",
  "10minutemail.net",
  "20minutemail.com",
  "33mail.com",
  "byom.de",
  "cock.li",
  "discard.email",
  "discardmail.com",
  "dispostable.com",
  "emailondeck.com",
  "fakeinbox.com",
  "getnada.com",
  "grr.la",
  "guerrillamail.biz",
  "guerrillamail.com",
  "guerrillamail.de",
  "guerrillamail.info",
  "guerrillamail.net",
  "guerrillamail.org",
  "guerrillamailblock.com",
  "inboxkitten.com",
  "luxusmail.org",
  "mail.tm",
  "mailcatch.com",
  "maildrop.cc",
  "mailinator.com",
  "mailinator.net",
  "mailnesia.com",
  "mintemail.com",
  "moakt.com",
  "mohmal.com",
  "mytemp.email",
  "sharklasers.com",
  "spam4.me",
  "spamgourmet.com",
  "temp-mail.io",
  "temp-mail.org",
  "tempail.com",
  "tempmail.com",
  "tempmail.dev",
  "tempmailo.com",
  "tempr.email",
  "throwaway.email",
  "throwawaymail.com",
  "tmail.ws",
  "trash-mail.com",
  "trashmail.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
];

export function emailDomain(email) {
  const at = String(email || "").lastIndexOf("@");
  return at === -1 ? "" : String(email).slice(at + 1).trim().toLowerCase();
}

/** True for the domains above and anything hosted under them. */
export function isDisposableEmail(email) {
  const domain = emailDomain(email);
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
}

export function hashCode(code) {
  return createHash("sha256").update(String(code || "").trim()).digest("hex");
}

/**
 * A fresh token + code pair. `token` goes in the link, `code` is what the user
 * types, `hash` and `expires` go in the database.
 */
export function newVerification() {
  const token = randomBytes(32).toString("base64url");
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expires = new Date(Date.now() + VERIFICATION_HOURS * 3600 * 1000);
  return { token, code, hash: hashCode(code), expires };
}

/** Case-insensitive, whitespace-tolerant code comparison on the hash. */
export function codeMatches(code, storedHash) {
  const given = hashCode(code);
  return Boolean(storedHash) && given.length === String(storedHash).length && given === storedHash;
}
