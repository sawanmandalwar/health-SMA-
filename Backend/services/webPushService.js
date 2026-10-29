const webpush = require("web-push");

const WebPushSubscription = require("../models/WebPushSubscription");

let vapidConfigured = null;

function getVapidConfig() {
  return {
    publicKey: String(process.env.VAPID_PUBLIC_KEY || "").trim(),
    privateKey: String(process.env.VAPID_PRIVATE_KEY || "").trim(),
    subject: String(
      process.env.VAPID_SUBJECT || "mailto:support@health-saathi.app"
    ).trim(),
  };
}

function isWebPushConfigured() {
  const { publicKey, privateKey } = getVapidConfig();
  return Boolean(publicKey && privateKey);
}

// web-push validates the VAPID details on every call, so configure it once per
// process (serverless may reuse the module between invocations).
function ensureVapidConfigured() {
  if (vapidConfigured === true) return true;
  if (vapidConfigured === false) return false;

  const { publicKey, privateKey, subject } = getVapidConfig();

  if (!publicKey || !privateKey) {
    vapidConfigured = false;
    console.warn(
      "[web-push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are not set; web push is disabled."
    );
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidConfigured = true;
    return true;
  } catch (error) {
    vapidConfigured = false;
    console.error(
      "[web-push] Invalid VAPID configuration:",
      error && error.message ? error.message : error
    );
    return false;
  }
}

// Normalise the stored document into the shape web-push expects.
function toPushSubscription(subscription) {
  return {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  };
}

async function sendWebPushToSubscription(subscription, payload) {
  if (!ensureVapidConfigured()) {
    return { ok: false, reason: "not_configured" };
  }

  try {
    await webpush.sendNotification(toPushSubscription(subscription), JSON.stringify(payload), {
      TTL: 60 * 60,
      urgency: "high",
    });

    await WebPushSubscription.updateOne(
      { _id: subscription._id },
      { $set: { isActive: true, lastSeenAt: new Date(), lastError: "" } }
    ).catch(() => {});

    return { ok: true };
  } catch (error) {
    const statusCode = Number(error && error.statusCode);
    const gone = statusCode === 404 || statusCode === 410;

    const message = String(
      (error && (error.body || error.message)) || "web_push_send_failed"
    ).slice(0, 200);

    await WebPushSubscription.updateOne(
      { _id: subscription._id },
      {
        $set: {
          isActive: gone ? false : subscription.isActive,
          lastError: message,
        },
      }
    ).catch(() => {});

    if (!gone) {
      console.error(
        `[web-push] send failed for subscription ${String(subscription._id)}:`,
        statusCode || message
      );
    }

    return { ok: false, gone, reason: message };
  }
}

// Send one push payload to every active browser subscription for a user.
async function sendWebPushToUser(userId, payload) {
  if (!ensureVapidConfigured()) {
    return { sent: 0, failed: 0, reason: "not_configured" };
  }

  const subscriptions = await WebPushSubscription.find({
    userId,
    isActive: true,
  });

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, reason: "no_subscription" };
  }

  const results = await Promise.all(
    subscriptions.map((subscription) =>
      sendWebPushToSubscription(subscription, payload)
    )
  );

  const sent = results.filter((result) => result.ok).length;
  const failed = results.length - sent;

  return { sent, failed, total: subscriptions.length };
}

async function deactivateByEndpoint(userId, endpoint) {
  const result = await WebPushSubscription.updateOne(
    { userId, endpoint },
    { $set: { isActive: false } }
  );

  return result.modifiedCount > 0;
}

module.exports = {
  getVapidConfig,
  isWebPushConfigured,
  ensureVapidConfigured,
  sendWebPushToUser,
  deactivateByEndpoint,
};
