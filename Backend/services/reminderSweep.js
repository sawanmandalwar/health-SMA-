const Medicine = require("../models/Medicine");
const MedicineHistory = require("../models/MedicineHistory");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const ReminderDelivery = require("../models/ReminderDelivery");
const WebPushSubscription = require("../models/WebPushSubscription");

const {
  getSchedulesWithIds,
  timeToMinutes,
  buildDoseKey,
} = require("./doseService");
const {
  normalizeTimeZone,
  getDayKeyForDate,
  parseDayKey,
  zonedDateTimeToUtc,
  parseDateOnlyToDayKey,
} = require("./timezoneService");
const { resolveAppointmentAt } = require("./missedAppointmentService");
const {
  isWebPushConfigured,
  sendWebPushToUser,
} = require("./webPushService");

const APPOINTMENT_LEAD_MINUTES = 30;

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") return fallback;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

// Vercel cron invocations can be late, and a failed invocation should not
// drop a reminder, so each sweep processes occurrences due within this window.
// Keep it small enough that a reminder is never delivered very late.
function getReminderWindowMs() {
  const minutes = Math.min(
    180,
    Math.max(1, Math.floor(envNumber("REMINDER_WINDOW_MINUTES", 15)))
  );

  return minutes * 60 * 1000;
}

function isMedicineActiveOnDay(medicine, dayKey) {
  const startDay = parseDateOnlyToDayKey(medicine.startDate);
  const endDay = parseDateOnlyToDayKey(medicine.endDate);

  if (startDay && dayKey < startDay) return false;
  if (endDay && dayKey > endDay) return false;

  return true;
}

function buildMedicineCopy(medicine, schedule) {
  const quantityPrefix =
    schedule.quantity && schedule.quantity > 1
      ? `${schedule.quantity} x `
      : "";

  return {
    title: `Medicine Reminder: ${medicine.name}`,
    body: `Time to take ${quantityPrefix}${medicine.dosage}${
      medicine.timing ? ` (${medicine.timing})` : ""
    }.`,
  };
}

// Claim one occurrence. The unique index makes this atomic, so two overlapping
// serverless invocations can never both send the same reminder.
async function claimDelivery({
  userId,
  reminderKey,
  type,
  dueAt,
  title,
  body,
}) {
  try {
    await ReminderDelivery.create({
      userId,
      reminderKey,
      type,
      dueAt,
      title,
      body,
      deliveredCount: 0,
    });

    return true;
  } catch (error) {
    if (error && error.code === 11000) return false;
    throw error;
  }
}

// Release a claim when nothing could be delivered, so the next sweep within
// the window can retry (e.g. a transient push failure).
async function releaseDelivery(userId, reminderKey) {
  await ReminderDelivery.deleteOne({ userId, reminderKey }).catch(() => {});
}

async function deliver({
  userId,
  reminderKey,
  type,
  dueAt,
  title,
  body,
  url,
  data,
  summary,
}) {
  const claimed = await claimDelivery({
    userId,
    reminderKey,
    type,
    dueAt,
    title,
    body,
  });

  if (!claimed) return;

  const result = await sendWebPushToUser(userId, {
    title,
    body,
    tag: reminderKey,
    data: {
      type,
      url: url || "/home",
      reminderKey,
      ...data,
    },
  });

  if (result.sent > 0) {
    summary.remindersSent += 1;
    summary.notificationsDelivered += result.sent;

    await ReminderDelivery.updateOne(
      { userId, reminderKey },
      { $set: { deliveredCount: result.sent, sentAt: new Date() } }
    ).catch(() => {});
    return;
  }

  summary.remindersFailed += 1;
  await releaseDelivery(userId, reminderKey);
}

async function processMedicineReminders({
  userId,
  now,
  timeZone,
  windowMs,
  summary,
}) {
  const medicines = await Medicine.find({ userId });
  if (medicines.length === 0) return;

  const dayKey = getDayKeyForDate(now, timeZone);
  const dayParts = parseDayKey(dayKey);
  if (!dayParts) return;

  for (const medicine of medicines) {
    if (!isMedicineActiveOnDay(medicine, dayKey)) continue;

    for (const schedule of getSchedulesWithIds(medicine)) {
      const minutes = timeToMinutes(schedule.time);
      if (minutes === null) continue;

      const dueAt = zonedDateTimeToUtc(
        {
          year: dayParts.year,
          month: dayParts.month,
          day: dayParts.day,
          hour: Math.floor(minutes / 60),
          minute: minutes % 60,
        },
        timeZone
      );

      if (dueAt.getTime() > now.getTime()) continue;
      if (now.getTime() - dueAt.getTime() > windowMs) continue;

      const doseKey = buildDoseKey(medicine._id, schedule.id, dayKey);

      // Never remind a dose the user already logged for that day.
      const logged = await MedicineHistory.exists({
        doseKey,
        status: { $in: ["Taken", "Missed"] },
      });
      if (logged) continue;

      const reminderKey = `medicine:${String(medicine._id)}:${String(
        schedule.id
      )}:${dayKey}`;
      const copy = buildMedicineCopy(medicine, schedule);

      await deliver({
        userId,
        reminderKey,
        type: "medicine",
        dueAt,
        title: copy.title,
        body: copy.body,
        url: "/medicines",
        data: {
          medicineId: String(medicine._id),
          doseId: String(schedule.id),
          time: schedule.time,
          dayKey,
        },
        summary,
      });
    }
  }
}

async function processAppointmentReminders({
  userId,
  now,
  timeZone,
  windowMs,
  summary,
}) {
  const appointments = await Appointment.find({
    userId,
    status: "Upcoming",
    reminder: true,
  });

  for (const appointment of appointments) {
    const appointmentAt = resolveAppointmentAt(appointment, timeZone);

    if (!appointmentAt || Number.isNaN(appointmentAt.getTime())) continue;

    const leadAt = new Date(
      appointmentAt.getTime() - APPOINTMENT_LEAD_MINUTES * 60 * 1000
    );

    const candidates = [
      {
        dueAt: leadAt,
        suffix: "lead",
        title: `Appointment soon: ${appointment.doctor}`,
        body: `Starts soon - ${appointment.specialty} at ${appointment.hospital} (${appointment.date} at ${appointment.time}).`,
      },
      {
        dueAt: appointmentAt,
        suffix: "at",
        title: `Appointment Reminder: ${appointment.doctor}`,
        body: `${appointment.specialty} at ${appointment.hospital} - ${appointment.date} at ${appointment.time}`,
      },
    ];

    for (const candidate of candidates) {
      if (candidate.dueAt.getTime() > now.getTime()) continue;
      if (now.getTime() - candidate.dueAt.getTime() > windowMs) continue;

      const reminderKey = `appointment:${String(
        appointment._id
      )}:${candidate.suffix}`;

      await deliver({
        userId,
        reminderKey,
        type: "appointment",
        dueAt: candidate.dueAt,
        title: candidate.title,
        body: candidate.body,
        url: "/appointments",
        data: {
          appointmentId: String(appointment._id),
          suffix: candidate.suffix,
        },
        summary,
      });
    }
  }
}

async function collectSubscribedUserIds() {
  const userIds = await WebPushSubscription.distinct("userId", {
    isActive: true,
  });

  return userIds.filter(Boolean);
}

// Sweep every user that has at least one active browser subscription and push
// any medicine/appointment reminder that became due inside the window.
// Process reminders for one user. Vercel does not run in-process timers, so
// the API also triggers this opportunistically for the active user.
async function runReminderSweepForUser(userId, options = {}) {
  const now =
    options.now instanceof Date && !Number.isNaN(options.now.getTime())
      ? options.now
      : new Date();
  const windowMs =
    typeof options.windowMs === "number" && options.windowMs > 0
      ? options.windowMs
      : getReminderWindowMs();

  const summary = {
    configured: isWebPushConfigured(),
    users: 0,
    remindersSent: 0,
    notificationsDelivered: 0,
    remindersFailed: 0,
    errors: 0,
  };

  if (!summary.configured) {
    summary.reason = "vapid_not_configured";
    return summary;
  }

  try {
    const user = await User.findById(userId).select("timezone").lean();

    if (!user) return summary;

    summary.users = 1;

    const timeZone = normalizeTimeZone(user.timezone);

    await processMedicineReminders({
      userId,
      now,
      timeZone,
      windowMs,
      summary,
    });

    await processAppointmentReminders({
      userId,
      now,
      timeZone,
      windowMs,
      summary,
    });
  } catch (error) {
    summary.errors += 1;
    console.error(
      "Reminder sweep user error:",
      error && error.message ? error.message : error
    );
  }

  return summary;
}

async function runReminderSweep(options = {}) {
  const now =
    options.now instanceof Date && !Number.isNaN(options.now.getTime())
      ? options.now
      : new Date();
  const windowMs =
    typeof options.windowMs === "number" && options.windowMs > 0
      ? options.windowMs
      : getReminderWindowMs();

  const summary = {
    configured: isWebPushConfigured(),
    users: 0,
    remindersSent: 0,
    notificationsDelivered: 0,
    remindersFailed: 0,
    errors: 0,
  };

  if (!summary.configured) {
    summary.reason = "vapid_not_configured";
    return summary;
  }

  const userIds = await collectSubscribedUserIds();
  summary.users = userIds.length;

  if (userIds.length === 0) {
    summary.reason = "no_subscriptions";
    return summary;
  }

  for (const userId of userIds) {
    try {
      const user = await User.findById(userId).select("timezone").lean();
      if (!user) continue;

      const timeZone = normalizeTimeZone(user.timezone);

      await processMedicineReminders({
        userId,
        now,
        timeZone,
        windowMs,
        summary,
      });

      await processAppointmentReminders({
        userId,
        now,
        timeZone,
        windowMs,
        summary,
      });
    } catch (error) {
      summary.errors += 1;
      console.error(
        "Reminder sweep user error:",
        error && error.message ? error.message : error
      );
    }
  }

  return summary;
}

let reminderIntervalHandle = null;

// Local development equivalent of the Vercel cron job. On Vercel the sweep is
// triggered by the /api/cron/reminders endpoint instead.
function startReminderScheduler() {
  if (reminderIntervalHandle) {
    return { started: false, alreadyRunning: true };
  }

  const intervalMs = Math.max(
    30 * 1000,
    envNumber("REMINDER_CHECK_INTERVAL_MS", 60 * 1000)
  );

  reminderIntervalHandle = setInterval(() => {
    runReminderSweep().catch((error) => {
      console.error(
        "Reminder scheduler error:",
        error && error.message ? error.message : error
      );
    });
  }, intervalMs);

  if (typeof reminderIntervalHandle.unref === "function") {
    reminderIntervalHandle.unref();
  }

  console.log(
    `Reminder scheduler started (every ${Math.round(intervalMs / 1000)}s).`
  );

  return { started: true, intervalMs };
}

module.exports = {
  getReminderWindowMs,
  runReminderSweep,
  runReminderSweepForUser,
  startReminderScheduler,
};
