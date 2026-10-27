const MissedDoseAlert = require("../models/MissedDoseAlert");
const Notification = require("../models/Notification");
const PushToken = require("../models/PushToken");

const {
  isValidEmail,
  buildCaregiverEmail,
  sendCaregiverEmail,
  isEmailProviderConfigured,
} = require("./emailService");
const { sendStudentPush } = require("./pushService");

const STALE_SENDING_MS = 10 * 60 * 1000;

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") return fallback;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function getRetryConfig() {
  return {
    maxAttempts: Math.max(
      1,
      Math.floor(envNumber("CAREGIVER_EMAIL_MAX_ATTEMPTS", 3))
    ),
    backoffMs: envNumber("CAREGIVER_EMAIL_RETRY_BACKOFF_MS", 5 * 60 * 1000),
  };
}

function safeError(error) {
  return String(error || "unknown_error").slice(0, 160);
}

async function resetStaleDeliveries() {
  const staleBefore = new Date(Date.now() - STALE_SENDING_MS);

  await MissedDoseAlert.updateMany(
    {
      caregiverEmailStatus: "sending",
      caregiverEmailLastAttemptAt: { $lt: staleBefore },
    },
    {
      $set: {
        caregiverEmailStatus: "failed",
        caregiverEmailRetryable: true,
        caregiverEmailLastError: "stale_sending_attempt",
      },
    }
  );

  await MissedDoseAlert.updateMany(
    {
      pushStatus: "sending",
      pushAttemptedAt: { $lt: staleBefore },
    },
    {
      $set: {
        pushStatus: "failed",
        pushLastError: "stale_sending_attempt",
      },
    }
  );
}

async function ensureInAppNotification(alert) {
  const notificationKey = `missed-dose-episode:${alert.episodeKey}`;
  const count = Math.max(1, Number(alert.consecutiveMissed) || 1);
  const message = `You have missed ${count} scheduled medicine dose${
    count === 1 ? "" : "s"
  } in a row. Please check your medicine schedule.`;

  if (alert.inAppStatus === "created" && alert.inAppNotificationId) {
    // Refresh the count if the notification is still present, but never
    // recreate one the user deliberately cleared.
    await Notification.updateOne(
      { _id: alert.inAppNotificationId, userId: alert.userId },
      {
        $set: {
          title: "Missed medicine doses",
          message,
          type: "Medicine",
          scheduledFor: alert.lastMissedAt,
        },
      }
    );

    return { status: "created", notificationId: alert.inAppNotificationId };
  }

  try {
    const notification = await Notification.findOneAndUpdate(
      { userId: alert.userId, notificationKey },
      {
        $setOnInsert: {
          userId: alert.userId,
          notificationKey,
          title: "Missed medicine doses",
          message,
          type: "Medicine",
          isRead: false,
          scheduledFor: alert.lastMissedAt,
          doseId: null,
          medicineId: null,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        setDefaultsOnInsert: true,
      }
    );

    await MissedDoseAlert.updateOne(
      { _id: alert._id },
      {
        $set: {
          inAppStatus: "created",
          inAppNotificationId: notification?._id || null,
        },
      }
    );

    return {
      status: "created",
      notificationId: notification?._id || null,
    };
  } catch (error) {
    await MissedDoseAlert.updateOne(
      { _id: alert._id },
      { $set: { inAppStatus: "failed" } }
    );

    return { status: "failed", error: safeError(error.message) };
  }
}

async function deliverCaregiverEmail({ alert, user, caregiver, timeZone }) {
  if (!caregiver || caregiver.alertsEnabled !== true) {
    await MissedDoseAlert.updateOne(
      {
        _id: alert._id,
        caregiverEmailStatus: { $in: ["pending", "failed"] },
      },
      {
        $set: {
          caregiverEmailStatus: "skipped_disabled",
          caregiverEmailRetryable: false,
        },
      }
    );
    return { status: "skipped_disabled" };
  }

  const recipient = typeof caregiver.email === "string"
    ? caregiver.email.trim().toLowerCase()
    : "";

  if (!isValidEmail(recipient)) {
    await MissedDoseAlert.updateOne(
      {
        _id: alert._id,
        caregiverEmailStatus: { $in: ["pending", "failed"] },
      },
      {
        $set: {
          caregiverEmailStatus: "skipped_invalid",
          caregiverEmailRetryable: false,
        },
      }
    );
    return { status: "skipped_invalid" };
  }

  if (!isEmailProviderConfigured()) {
    await MissedDoseAlert.updateOne(
      {
        _id: alert._id,
        caregiverEmailStatus: { $in: ["pending", "failed"] },
      },
      {
        $set: {
          caregiverEmailStatus: "skipped_not_configured",
          caregiverEmailRetryable: false,
        },
      }
    );
    return { status: "skipped_not_configured" };
  }

  const { maxAttempts, backoffMs } = getRetryConfig();
  const now = new Date();

  const claimed = await MissedDoseAlert.findOneAndUpdate(
    {
      _id: alert._id,
      caregiverEmailStatus: { $in: ["pending", "failed"] },
      caregiverEmailAttempts: { $lt: maxAttempts },
      $or: [
        { caregiverEmailLastAttemptAt: null },
        { caregiverEmailLastAttemptAt: { $lte: new Date(now.getTime() - backoffMs) } },
      ],
      caregiverEmailRetryable: true,
    },
    {
      $set: {
        caregiverEmailStatus: "sending",
        caregiverEmailLastAttemptAt: now,
      },
      $inc: { caregiverEmailAttempts: 1 },
    },
    { returnDocument: "after" }
  );

  if (!claimed) {
    return { status: "not_claimed" };
  }

  const email = buildCaregiverEmail({
    studentName: user?.name,
    caregiverName: caregiver.name,
    missedCount: claimed.consecutiveMissed,
    timestamp: claimed.lastMissedAt,
    timeZone,
  });

  const result = await sendCaregiverEmail({
    to: recipient,
    subject: email.subject,
    text: email.text,
    html: email.html,
    idempotencyKey: `missed-dose-alert-${String(alert._id)}`,
  });

  if (result.ok) {
    await MissedDoseAlert.updateOne(
      { _id: alert._id },
      {
        $set: {
          caregiverEmailStatus: "sent",
          caregiverEmailMessageId: String(result.messageId || "").slice(0, 200),
          caregiverEmailLastError: "",
          caregiverEmailRetryable: false,
        },
      }
    );

    return { status: "sent" };
  }

  const skipped = result.skipped === true;
  const retryable = result.retryable === true && !skipped;

  await MissedDoseAlert.updateOne(
    { _id: alert._id },
    {
      $set: {
        caregiverEmailStatus: skipped ? "skipped_not_configured" : "failed",
        caregiverEmailLastError: safeError(result.error),
        caregiverEmailRetryable: retryable,
      },
    }
  );

  return {
    status: skipped ? "skipped_not_configured" : "failed",
    error: safeError(result.error),
  };
}

async function deliverStudentPush({ alert }) {
  if (alert.pushStatus !== "not_attempted") {
    return { status: alert.pushStatus };
  }

  const claimed = await MissedDoseAlert.findOneAndUpdate(
    { _id: alert._id, pushStatus: "not_attempted" },
    {
      $set: {
        pushStatus: "sending",
        pushAttemptedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  if (!claimed) {
    return { status: "not_claimed" };
  }

  const token = await PushToken.findOne({
    userId: alert.userId,
    isActive: true,
  }).sort({ updatedAt: -1 });

  if (!token) {
    await MissedDoseAlert.updateOne(
      { _id: alert._id },
      {
        $set: {
          pushStatus: "skipped_no_token",
          pushLastError: "",
        },
      }
    );
    return { status: "skipped_no_token" };
  }

  const result = await sendStudentPush({
    token: token.token,
    missedCount: claimed.consecutiveMissed,
    alertId: claimed._id,
  });

  if (result.ok) {
    await MissedDoseAlert.updateOne(
      { _id: alert._id },
      {
        $set: {
          pushStatus: "accepted",
          pushTicketId: String(result.ticketId || "").slice(0, 200),
          pushLastError: "",
        },
      }
    );

    return { status: "accepted" };
  }

  if (result.invalidToken) {
    await PushToken.updateOne(
      { _id: token._id, userId: alert.userId },
      {
        $set: {
          isActive: false,
          lastError: "DeviceNotRegistered",
        },
      }
    );
  }

  await MissedDoseAlert.updateOne(
    { _id: alert._id },
    {
      $set: {
        pushStatus: "failed",
        pushLastError: safeError(result.error),
      },
    }
  );

  return {
    status: "failed",
    error: safeError(result.error),
  };
}

async function safeDelivery(label, delivery) {
  try {
    return await delivery;
  } catch (error) {
    return {
      status: "failed",
      label,
      error: safeError(error && error.message ? error.message : error),
    };
  }
}

async function deliverAlert({ alert, user, caregiver, timeZone }) {
  const [inApp, email, push] = await Promise.all([
    safeDelivery("in_app", ensureInAppNotification(alert)),
    safeDelivery(
      "caregiver_email",
      deliverCaregiverEmail({ alert, user, caregiver, timeZone })
    ),
    safeDelivery("push", deliverStudentPush({ alert })),
  ]);

  return { inApp, email, push };
}

async function processPendingAlertDeliveries({
  alert,
  user,
  caregiver,
  timeZone,
}) {
  if (!alert) return null;

  const hasPendingInApp = alert.inAppStatus !== "created";
  const hasPendingEmail = ["pending", "failed"].includes(
    alert.caregiverEmailStatus
  );
  const hasPendingPush = alert.pushStatus === "not_attempted";

  if (!hasPendingInApp && !hasPendingEmail && !hasPendingPush) {
    return null;
  }

  return deliverAlert({ alert, user, caregiver, timeZone });
}

async function refreshInAppNotification(alert) {
  return ensureInAppNotification(alert);
}

module.exports = {
  resetStaleDeliveries,
  deliverAlert,
  processPendingAlertDeliveries,
  refreshInAppNotification,
};
