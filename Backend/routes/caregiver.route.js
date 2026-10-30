const express = require("express");

const CaregiverSettings = require("../models/CaregiverSettings");
const MissedDoseAlert = require("../models/MissedDoseAlert");
const User = require("../models/User");
const auth = require("../middleware/auth");
const {
  isValidEmail,
  buildTestEmail,
  sendCaregiverEmail,
  isEmailProviderConfigured,
} = require("../services/emailService");

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_MAX_LENGTH = 80;
const EMAIL_MAX_LENGTH = 254;
const TEST_EMAIL_COOLDOWN_MS = 60 * 1000;
const TEST_EMAIL_COOLDOWN_PRUNE_MS = 2 * TEST_EMAIL_COOLDOWN_MS;
const testEmailAttempts = new Map();

// The cooldown map should not grow for the lifetime of the process: drop
// entries older than one cooldown window before doing the rate check.
function pruneTestEmailAttempts(now) {
  for (const [key, attemptAt] of testEmailAttempts) {
    if (now - attemptAt >= TEST_EMAIL_COOLDOWN_PRUNE_MS) {
      testEmailAttempts.delete(key);
    }
  }
}

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

// When caregiver settings change, past "final" skips should not stay final:
// a corrected email or re-enabled alerts must let open missed-dose episodes
// deliver to the new configuration. Only open alerts are re-armed; sent,
// sending and pending deliveries are untouched so nothing is double-sent.
const SKIPPED_CAREGIVER_EMAIL_STATES = [
  "skipped_disabled",
  "skipped_invalid",
  "skipped_not_configured",
];

async function rearmOpenAlertsForSettings(userId, alertsEnabled) {
  if (!alertsEnabled) {
    return 0;
  }

  const result = await MissedDoseAlert.updateMany(
    {
      userId,
      status: "open",
      caregiverEmailStatus: { $in: SKIPPED_CAREGIVER_EMAIL_STATES },
    },
    {
      $set: {
        caregiverEmailStatus: "pending",
        caregiverEmailRetryable: true,
        caregiverEmailLastError: "",
        caregiverEmailAttempts: 0,
        caregiverEmailLastAttemptAt: null,
      },
    }
  );

  return result.modifiedCount || 0;
}

// When the caregiver address itself changes, an alert already delivered to the
// old address must be delivered again to the new one. Alerts are marked "sent"
// after the first successful delivery, so without this re-arm the new
// caregiver would never hear about an episode that is still open.
async function rearmSentAlertsForEmailChange(userId, alertsEnabled) {
  if (!alertsEnabled) {
    return 0;
  }

  const result = await MissedDoseAlert.updateMany(
    {
      userId,
      status: "open",
      caregiverEmailStatus: "sent",
    },
    {
      $set: {
        caregiverEmailStatus: "pending",
        caregiverEmailRetryable: true,
        caregiverEmailLastError: "",
        caregiverEmailAttempts: 0,
        caregiverEmailLastAttemptAt: null,
      },
    }
  );

  return result.modifiedCount || 0;
}

const serializeSettings = (settings) => ({
  id: settings._id,
  userId: settings.userId,
  name: settings.name || "",
  email: settings.email || "",
  alertsEnabled: Boolean(settings.alertsEnabled),
  createdAt: settings.createdAt,
  updatedAt: settings.updatedAt,
});

const validatePayload = (body = {}) => {
  if (typeof body.alertsEnabled !== "boolean") {
    return { error: "alertsEnabled must be a boolean" };
  }

  if (body.name !== undefined && typeof body.name !== "string") {
    return { error: "Name must be a string" };
  }

  if (body.email !== undefined && typeof body.email !== "string") {
    return { error: "Email must be a string" };
  }

  const name = normalizeText(body.name);
  const email = normalizeText(body.email).toLowerCase();
  const alertsEnabled = body.alertsEnabled;

  if (name.length > NAME_MAX_LENGTH) {
    return {
      error: `Name must be ${NAME_MAX_LENGTH} characters or fewer`,
    };
  }

  if (email.length > EMAIL_MAX_LENGTH) {
    return {
      error: `Email must be ${EMAIL_MAX_LENGTH} characters or fewer`,
    };
  }

  if (alertsEnabled && !name) {
    return {
      error:
        "Parent/guardian name is required when caregiver alerts are enabled",
    };
  }

  if (alertsEnabled && !email) {
    return {
      error:
        "Caregiver email is required when caregiver alerts are enabled",
    };
  }

  if (email && !EMAIL_PATTERN.test(email)) {
    return {
      error: "Please provide a valid caregiver email address",
    };
  }

  return { name, email, alertsEnabled };
};

// GET LOGGED-IN USER CAREGIVER SETTINGS
router.get("/", auth, async (req, res) => {
  try {
    const settings = await CaregiverSettings.findOne({
      userId: req.userId,
    });

    res.status(200).json({
      success: true,
      settings: settings ? serializeSettings(settings) : null,
    });
  } catch (error) {
    console.error("Get Caregiver Settings Error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load caregiver settings",
    });
  }
});

// CREATE OR UPDATE LOGGED-IN USER CAREGIVER SETTINGS
router.put("/", auth, async (req, res) => {
  try {
    const validation = validatePayload(req.body || {});

    if (validation.error) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    const previousSettings = await CaregiverSettings.findOne({
      userId: req.userId,
    });

    const settings = await CaregiverSettings.findOneAndUpdate(
      { userId: req.userId },
      {
        $set: {
          name: validation.name,
          email: validation.email,
          alertsEnabled: validation.alertsEnabled,
        },
        $setOnInsert: {
          userId: req.userId,
        },
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    let rearmedAlerts = 0;
    try {
      rearmedAlerts = await rearmOpenAlertsForSettings(
        req.userId,
        settings.alertsEnabled
      );

      const previousEmail = normalizeText(
        previousSettings && previousSettings.email
      ).toLowerCase();
      const nextEmail = normalizeText(settings.email).toLowerCase();

      if (previousEmail !== nextEmail) {
        rearmedAlerts += await rearmSentAlertsForEmailChange(
          req.userId,
          settings.alertsEnabled
        );
      }
    } catch (rearmError) {
      // Settings are already saved; a re-arm failure must not fail the save.
      console.error("Re-arm caregiver alerts error:", rearmError);
    }

    console.log("Caregiver settings saved. Re-armed alerts:", rearmedAlerts);

    res.status(200).json({
      success: true,
      message: "Caregiver settings saved successfully",
      settings: serializeSettings(settings),
    });
  } catch (error) {
    console.error("Save Caregiver Settings Error:", error);

    if (error && error.code === 11000) {
      return res.status(409).json({
        success: false,
        message:
          "Caregiver settings already exist for this user. Please try again.",
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to save caregiver settings",
    });
  }
});

// SEND A TEST EMAIL TO THE SAVED CAREGIVER EMAIL
router.post("/test-email", auth, async (req, res) => {
  try {
    const settings = await CaregiverSettings.findOne({
      userId: req.userId,
    });

    const caregiverEmail = settings
      ? normalizeText(settings.email).toLowerCase()
      : "";

    if (!caregiverEmail) {
      return res.status(400).json({
        success: false,
        sent: false,
        message: "Save a caregiver email address before sending a test email",
      });
    }

    if (!isValidEmail(caregiverEmail)) {
      return res.status(400).json({
        success: false,
        sent: false,
        message: "The saved caregiver email address is invalid",
      });
    }

    const user = await User.findById(req.userId).select("name timezone");

    if (!user) {
      return res.status(404).json({
        success: false,
        sent: false,
        message: "User not found",
      });
    }

    if (!isEmailProviderConfigured()) {
      return res.status(503).json({
        success: false,
        sent: false,
        code: "email_provider_not_configured",
        message: "Email provider is not configured",
      });
    }

    const userKey = String(req.userId);
    const now = Date.now();
    pruneTestEmailAttempts(now);
    const lastAttempt = testEmailAttempts.get(userKey) || 0;
    const remainingMs = TEST_EMAIL_COOLDOWN_MS - (now - lastAttempt);

    if (remainingMs > 0) {
      return res.status(429).json({
        success: false,
        sent: false,
        message: "Please wait before requesting another test email",
        retryAfterSeconds: Math.ceil(remainingMs / 1000),
      });
    }

    testEmailAttempts.set(userKey, now);

    const email = buildTestEmail({
      studentName: user.name,
      caregiverName: settings.name,
      timestamp: new Date(now),
      timeZone: user.timezone,
    });

    const result = await sendCaregiverEmail({
      to: caregiverEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
      idempotencyKey: `caregiver-test-${userKey}-${now}`,
    });

    if (result.ok) {
      return res.status(200).json({
        success: true,
        sent: true,
        provider: result.provider || "unknown",
        message: "Test email sent successfully",
      });
    }

    if (result.error === "invalid_recipient_email") {
      return res.status(400).json({
        success: false,
        sent: false,
        code: "invalid_recipient_email",
        message: "The saved caregiver email address is invalid",
      });
    }

    if (
      result.skipped ||
      result.error === "email_provider_not_configured"
    ) {
      return res.status(503).json({
        success: false,
        sent: false,
        code: "email_provider_not_configured",
        message: "Email provider is not configured",
      });
    }

    console.error(
      "Send Caregiver Test Email Error:",
      result.error || "unknown_error"
    );

    return res.status(result.retryable ? 503 : 502).json({
      success: false,
      sent: false,
      code: result.error || "email_send_failed",
      message:
        "Unable to send test email. Please verify the email provider configuration.",
    });
  } catch (error) {
    console.error(
      "Send Caregiver Test Email Error:",
      error && error.name ? error.name : "unknown_error"
    );

    res.status(500).json({
      success: false,
      sent: false,
      message: "Failed to send test email",
    });
  }
});

module.exports = router;
