const nodemailer = require("nodemailer");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const { formatInTimeZone } = require("./timezoneService");

const GMAIL_HOST = "smtp.gmail.com";
const GMAIL_PORT = 465;
const GMAIL_CONNECTION_TIMEOUT_MS = 15000;
const GMAIL_GREETING_TIMEOUT_MS = 10000;
const GMAIL_SOCKET_TIMEOUT_MS = 30000;
const NETWORK_ERROR_CODES = new Set([
  "ETIMEDOUT",
  "ECONNECTION",
  "ESOCKET",
  "EDNS",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
]);

function isValidEmail(value) {
  if (typeof value !== "string") return false;
  const email = value.trim();
  return email.length > 0 && email.length <= 254 && EMAIL_PATTERN.test(email);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildCaregiverEmail({
  studentName,
  caregiverName,
  missedCount,
  timestamp,
  timeZone,
}) {
  const safeStudentName =
    typeof studentName === "string" && studentName.trim()
      ? studentName.trim()
      : "The student";
  const safeCaregiverName =
    typeof caregiverName === "string" ? caregiverName.trim() : "";
  const count = Number.isFinite(Number(missedCount))
    ? Math.max(1, Number(missedCount))
    : 1;
  const formattedTime = timestamp
    ? formatInTimeZone(new Date(timestamp), timeZone)
    : formatInTimeZone(new Date(), timeZone);

  const greeting = safeCaregiverName
    ? `Hello ${safeCaregiverName},`
    : "Hello,";

  const subject = "Health-Saathi: consecutive missed medicine doses";

  const text = [
    greeting,
    "",
    `${safeStudentName} has missed ${count} scheduled medicine dose${
      count === 1 ? "" : "s"
    } in a row as of ${formattedTime}.`,
    "",
    "Please check in with them when you can.",
    "",
    "This is an automated alert from Health-Saathi.",
  ].join("\n");

  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(
      safeStudentName
    )} has missed <strong>${count}</strong> scheduled medicine dose${
      count === 1 ? "" : "s"
    } in a row as of ${escapeHtml(formattedTime)}.</p>`,
    "<p>Please check in with them when you can.</p>",
    '<p style="color:#71858D">This is an automated alert from Health-Saathi.</p>',
  ].join("");

  return { subject, text, html };
}

function buildMissedAppointmentEmail({
  studentName,
  caregiverName,
  doctor,
  hospital,
  date,
  time,
  timestamp,
  timeZone,
}) {
  const safeStudentName =
    typeof studentName === "string" && studentName.trim()
      ? studentName.trim()
      : "The student";
  const safeCaregiverName =
    typeof caregiverName === "string" ? caregiverName.trim() : "";
  const safeDoctor = String(doctor || "").trim() || "a doctor";
  const safeHospital = String(hospital || "").trim();
  const safeDate = String(date || "").trim();
  const safeTime = String(time || "").trim();
  const when = [safeDate, safeTime].filter(Boolean).join(", ");
  const formattedTime = timestamp
    ? formatInTimeZone(new Date(timestamp), timeZone)
    : formatInTimeZone(new Date(), timeZone);

  const greeting = safeCaregiverName
    ? `Hello ${safeCaregiverName},`
    : "Hello,";

  const subject = "Health-Saathi: missed doctor's appointment";

  const text = [
    greeting,
    "",
    `${safeStudentName} appears to have missed the doctor's appointment with ${
      safeDoctor
    }${when ? ` scheduled for ${when}` : ""}${
      safeHospital ? ` at ${safeHospital}` : ""
    }.`,
    "",
    "Please check in with them when you can.",
    "",
    "This is an automated alert from Health-Saathi.",
  ].join("\n");

  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>${escapeHtml(
      safeStudentName
    )} appears to have missed the doctor's appointment with <strong>${escapeHtml(
      safeDoctor
    )}</strong>${when ? ` scheduled for ${escapeHtml(when)}` : ""}${
      safeHospital ? ` at ${escapeHtml(safeHospital)}` : ""
    }.</p>`,
    "<p>Please check in with them when you can.</p>",
    '<p style="color:#71858D">This is an automated alert from Health-Saathi.</p>',
  ].join("");

  return { subject, text, html };
}

function buildTestEmail({
  studentName,
  caregiverName,
  timestamp,
  timeZone,
}) {
  const safeStudentName =
    typeof studentName === "string" && studentName.trim()
      ? studentName.trim()
      : "The student";
  const safeCaregiverName =
    typeof caregiverName === "string" ? caregiverName.trim() : "";
  const formattedTime = timestamp
    ? formatInTimeZone(new Date(timestamp), timeZone)
    : formatInTimeZone(new Date(), timeZone);

  const greeting = safeCaregiverName
    ? `Hello ${safeCaregiverName},`
    : "Hello,";

  const subject = "Health-Saathi: caregiver email test";

  const text = [
    greeting,
    "",
    `This is a test email requested by ${safeStudentName} from Health-Saathi.`,
    `Requested at ${formattedTime}.`,
    "",
    "No medicine doses were missed. This message only confirms that caregiver emails can reach this address.",
    "",
    "This is an automated message from Health-Saathi.",
  ].join("\n");

  const html = [
    `<p>${escapeHtml(greeting)}</p>`,
    `<p>This is a test email requested by <strong>${escapeHtml(
      safeStudentName
    )}</strong> from Health-Saathi.</p>`,
    `<p>Requested at ${escapeHtml(formattedTime)}.</p>`,
    "<p>No medicine doses were missed. This message only confirms that caregiver emails can reach this address.</p>",
    '<p style="color:#71858D">This is an automated message from Health-Saathi.</p>',
  ].join("");

  return { subject, text, html };
}

function getGmailCredentials() {
  return {
    user: String(process.env.GMAIL_USER || "").trim(),
    appPassword: String(process.env.GMAIL_APP_PASSWORD || "").replace(
      /\s+/g,
      ""
    ),
  };
}

function getEmailConfig() {
  const provider = String(process.env.EMAIL_PROVIDER || "disabled")
    .trim()
    .toLowerCase();
  const gmail = getGmailCredentials();

  return {
    provider,
    from: String(process.env.EMAIL_FROM || "").trim(),
    resendApiKey: String(process.env.RESEND_API_KEY || "").trim(),
    resendApiUrl: String(
      process.env.RESEND_API_URL || "https://api.resend.com/emails"
    ).trim(),
    gmailConfigured: Boolean(gmail.user && gmail.appPassword),
    mockFail: String(process.env.EMAIL_MOCK_FAIL || "").toLowerCase() === "true",
  };
}

function isEmailProviderConfigured(config = getEmailConfig()) {
  if (!config || typeof config !== "object") return false;

  if (config.provider === "mock") return true;
  if (config.provider === "resend") {
    return Boolean(config.resendApiKey && config.from);
  }
  if (config.provider === "gmail") return Boolean(config.gmailConfigured);

  return false;
}

function safeGmailError(error) {
  const code = String(error && error.code ? error.code : "").toUpperCase();
  const responseCode = Number(error && error.responseCode);

  if (
    code === "EAUTH" ||
    responseCode === 530 ||
    responseCode === 534 ||
    responseCode === 535
  ) {
    return "gmail_auth_failed";
  }

  if (code === "EENVELOPE") return "gmail_recipient_rejected";
  if ([550, 551, 553, 554].includes(responseCode)) {
    return "gmail_recipient_rejected";
  }
  if (responseCode >= 400 && responseCode < 500) {
    return "gmail_smtp_temporary_failure";
  }
  if (responseCode >= 500 && responseCode < 600) {
    return "gmail_smtp_rejected";
  }
  if (NETWORK_ERROR_CODES.has(code)) return "gmail_network_error";

  return "gmail_send_failed";
}

function isGmailRetryable(error) {
  const code = String(error && error.code ? error.code : "").toUpperCase();
  const responseCode = Number(error && error.responseCode);

  if (responseCode >= 400 && responseCode < 500) return true;

  return NETWORK_ERROR_CODES.has(code);
}

function createGmailTransport(user, appPassword) {
  return nodemailer.createTransport({
    host: GMAIL_HOST,
    port: GMAIL_PORT,
    secure: true,
    auth: {
      user,
      pass: appPassword,
    },
    connectionTimeout: GMAIL_CONNECTION_TIMEOUT_MS,
    greetingTimeout: GMAIL_GREETING_TIMEOUT_MS,
    socketTimeout: GMAIL_SOCKET_TIMEOUT_MS,
    tls: {
      minVersion: "TLSv1.2",
    },
  });
}

async function sendWithMock({ to, subject, text }) {
  const config = getEmailConfig();

  if (config.mockFail) {
    return {
      ok: false,
      retryable: true,
      error: "mock_provider_unavailable",
    };
  }

  return {
    ok: true,
    provider: "mock",
    messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    preview: {
      to,
      subject,
      textLength: text.length,
    },
  };
}

async function sendWithResend({ to, subject, text, html, idempotencyKey }) {
  const config = getEmailConfig();

  if (!config.resendApiKey || !config.from) {
    return {
      ok: false,
      skipped: true,
      retryable: false,
      error: "email_provider_not_configured",
    };
  }

  const headers = {
    Authorization: `Bearer ${config.resendApiKey}`,
    "Content-Type": "application/json",
  };

  if (idempotencyKey) {
    headers["Idempotency-Key"] = String(idempotencyKey);
  }

  try {
    const response = await fetch(config.resendApiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: config.from,
        to: [to],
        subject,
        text,
        html,
      }),
    });

    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      return {
        ok: false,
        retryable: response.status === 429 || response.status >= 500,
        error: `resend_http_${response.status}`,
      };
    }

    if (!data || typeof data.id !== "string" || !data.id.trim()) {
      return {
        ok: false,
        retryable: false,
        error: "resend_missing_message_id",
      };
    }

    return {
      ok: true,
      provider: "resend",
      messageId: data.id,
    };
  } catch {
    return {
      ok: false,
      retryable: true,
      error: "resend_network_error",
    };
  }
}

async function sendWithGmail({ to, subject, text, html }) {
  const config = getEmailConfig();
  const credentials = getGmailCredentials();

  if (
    !config.gmailConfigured ||
    !credentials.user ||
    !credentials.appPassword
  ) {
    return {
      ok: false,
      skipped: true,
      retryable: false,
      error: "email_provider_not_configured",
    };
  }

  const transporter = createGmailTransport(
    credentials.user,
    credentials.appPassword
  );

  try {
    const info = await transporter.sendMail({
      from: config.from || credentials.user,
      to,
      subject,
      text,
      html,
    });

    if (Array.isArray(info && info.rejected) && info.rejected.length > 0) {
      return {
        ok: false,
        retryable: false,
        error: "gmail_recipient_rejected",
      };
    }

    if (
      !info ||
      typeof info.messageId !== "string" ||
      !info.messageId.trim()
    ) {
      return {
        ok: false,
        retryable: false,
        error: "gmail_missing_message_id",
      };
    }

    return {
      ok: true,
      provider: "gmail",
      messageId: info.messageId.trim(),
    };
  } catch (error) {
    return {
      ok: false,
      retryable: isGmailRetryable(error),
      error: safeGmailError(error),
    };
  } finally {
    try {
      transporter.close();
    } catch {
      // Ignore close errors.
    }
  }
}

async function verifyGmailConnection() {
  const credentials = getGmailCredentials();

  if (!credentials.user || !credentials.appPassword) {
    return {
      ok: false,
      skipped: true,
      error: "gmail_not_configured",
    };
  }

  const transporter = createGmailTransport(
    credentials.user,
    credentials.appPassword
  );

  try {
    await transporter.verify();
    return { ok: true, provider: "gmail" };
  } catch (error) {
    return { ok: false, error: safeGmailError(error) };
  } finally {
    try {
      transporter.close();
    } catch {
      // Ignore close errors.
    }
  }
}

async function sendCaregiverEmail({
  to,
  subject,
  text,
  html,
  idempotencyKey,
}) {
  if (!isValidEmail(to)) {
    return {
      ok: false,
      retryable: false,
      error: "invalid_recipient_email",
    };
  }

  const config = getEmailConfig();

  if (config.provider === "mock") {
    return sendWithMock({ to, subject, text });
  }

  if (config.provider === "resend") {
    return sendWithResend({ to, subject, text, html, idempotencyKey });
  }

  if (config.provider === "gmail") {
    return sendWithGmail({ to, subject, text, html });
  }

  return {
    ok: false,
    skipped: true,
    retryable: false,
    error: "email_provider_not_configured",
  };
}

module.exports = {
  isValidEmail,
  buildCaregiverEmail,
  buildMissedAppointmentEmail,
  buildTestEmail,
  sendCaregiverEmail,
  getEmailConfig,
  isEmailProviderConfigured,
  verifyGmailConnection,
};
