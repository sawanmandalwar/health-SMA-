const EXPO_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

function isValidExpoPushToken(value) {
  return (
    typeof value === "string" &&
    value.length <= 200 &&
    EXPO_TOKEN_PATTERN.test(value)
  );
}

function getPushConfig() {
  return {
    url: String(
      process.env.EXPO_PUSH_URL || "https://exp.host/--/api/v2/push/send"
    ).trim(),
    accessToken: String(process.env.EXPO_ACCESS_TOKEN || "").trim(),
    channelId: String(
      process.env.EXPO_PUSH_CHANNEL_ID || "medicine-reminders-v2"
    ).trim(),
  };
}

function buildMissedDosePush({ missedCount, alertId }) {
  const count = Math.max(1, Number(missedCount) || 1);

  return {
    title: "Missed medicine doses",
    body: `You have missed ${count} scheduled medicine dose${
      count === 1 ? "" : "s"
    } in a row. Please check your medicine schedule.`,
    data: {
      type: "missed-dose-alert",
      alertId: String(alertId || ""),
    },
  };
}

async function sendStudentPush({ token, missedCount, alertId }) {
  if (!isValidExpoPushToken(token)) {
    return {
      ok: false,
      invalidToken: true,
      retryable: false,
      error: "invalid_push_token",
    };
  }

  const config = getPushConfig();
  const content = buildMissedDosePush({ missedCount, alertId });

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (config.accessToken) {
    headers.Authorization = `Bearer ${config.accessToken}`;
  }

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: token,
        title: content.title,
        body: content.body,
        data: content.data,
        sound: "default",
        priority: "high",
        channelId: config.channelId,
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
        error: `expo_http_${response.status}`,
      };
    }

    const ticket = Array.isArray(data?.data) ? data.data[0] : data?.data;

    if (!ticket || ticket.status !== "ok") {
      const errorCode =
        typeof ticket?.details?.error === "string"
          ? ticket.details.error
          : "expo_ticket_error";

      return {
        ok: false,
        invalidToken: errorCode === "DeviceNotRegistered",
        retryable:
          errorCode === "MessageRateExceeded" || errorCode === "InternalError",
        error: errorCode.slice(0, 160),
      };
    }

    if (typeof ticket.id !== "string" || !ticket.id.trim()) {
      return {
        ok: false,
        retryable: false,
        error: "expo_missing_ticket_id",
      };
    }

    return {
      ok: true,
      accepted: true,
      ticketId: ticket.id,
    };
  } catch {
    return {
      ok: false,
      retryable: true,
      error: "expo_network_error",
    };
  }
}

module.exports = {
  isValidExpoPushToken,
  buildMissedDosePush,
  sendStudentPush,
};
