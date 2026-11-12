/**
 * api/_lib/mail.js
 * ---------------------------------------------------------------------------
 * One transactional email: the verification link.
 *
 * Delivery goes through Resend's REST API (no SDK, no build step). Set
 * RESEND_API_KEY and MAIL_FROM to switch it on; while either is missing the
 * route still creates the verification and hands the link back to the page, so
 * the app stays testable until the key is added.
 *
 * Because mail is best-effort, a failed send never fails a signup: the account
 * exists and "Resend verification email" tries again.
 * ---------------------------------------------------------------------------
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function mailConfigured() {
  return Boolean(String(process.env.RESEND_API_KEY || "").trim());
}

export function fromAddress() {
  return String(process.env.MAIL_FROM || "OmniContext AI <onboarding@resend.dev>").trim();
}

export function verificationMessage({ url, code }) {
  const subject = `Your OmniContext AI verification code: ${code}`;
  const text = [
    "Confirm your email for OmniContext AI",
    "",
    `Your code: ${code}`,
    "",
    "Or open this link to verify in one tap:",
    url,
    "",
    "The code and the link expire in 24 hours. Your 5 free test credits unlock as soon as the address is confirmed.",
    "",
    "If you didn't create this account you can ignore this email.",
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f5f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1b1b2a;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e6e7f2;border-radius:16px;padding:28px;">
    <h1 style="margin:0 0 6px;font-size:19px;">Confirm your email</h1>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#5b5b73;">
      One step left before the generator opens: your 5 free test credits unlock as soon as this address is confirmed.
    </p>
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a8aa3;">Your code</p>
    <p style="margin:0 0 20px;font-size:30px;font-weight:700;letter-spacing:.18em;">${code}</p>
    <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#5b53f0,#c44fd2);color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:10px;">Verify my email</a>
    <p style="margin:20px 0 0;font-size:12px;line-height:1.6;color:#8a8aa3;">
      The code and the link work for 24 hours. If you didn't create this account, ignore this email.
    </p>
  </div>
</body></html>`;

  return { subject, text, html };
}

/**
 * Send the verification email.
 * Returns { sent, reason } — never throws, so a mail outage can't block signup.
 */
export async function sendVerificationEmail({ to, url, code }) {
  const key = String(process.env.RESEND_API_KEY || "").trim();
  if (!key) return { sent: false, reason: "not_configured" };

  const { subject, text, html } = verificationMessage({ url, code });

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: fromAddress(), to: [to], subject, text, html }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      console.error("[mail] provider refused:", response.status, data?.message || "");
      return { sent: false, reason: "provider_error", status: response.status };
    }
    return { sent: true, id: data?.id || null };
  } catch (err) {
    console.error("[mail] couldn't reach the provider:", err?.message || err);
    return { sent: false, reason: "network" };
  }
}
