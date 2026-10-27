const Appointment = require("../models/Appointment");
const User = require("../models/User");
const CaregiverSettings = require("../models/CaregiverSettings");
const Notification = require("../models/Notification");

const {
  normalizeTimeZone,
  parseDayKey,
  zonedDateTimeToUtc,
  parseDateOnlyToDayKey,
} = require("./timezoneService");
const {
  isValidEmail,
  buildMissedAppointmentEmail,
  sendCaregiverEmail,
  isEmailProviderConfigured,
} = require("./emailService");

const APPOINTMENT_TIME_PATTERN = /^\d{1,2}:\d{2}\s*([AaPp])\.?\s?[Mm]\.?$/;
const APPOINTMENT_TIME_24H_PATTERN = /^\d{1,2}:\d{2}$/;

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") return fallback;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function getMissedAppointmentConfig() {
  return {
    graceMs:
      Math.min(
        24 * 60,
        Math.max(0, envNumber("MISSED_APPOINTMENT_GRACE_MINUTES", 120))
      ) * 60 * 1000,
    maxAttempts: Math.max(
      1,
      Math.floor(envNumber("CAREGIVER_EMAIL_MAX_ATTEMPTS", 3))
    ),
    backoffMs: envNumber(
      "CAREGIVER_EMAIL_RETRY_BACKOFF_MS",
      5 * 60 * 1000
    ),
  };
}

// Convert "8:00 AM", "08:15", or "20:30" into { hour, minute } (24h).
// Returns null when the format is not recognised.
function parseAppointmentTimeToParts(time) {
  const value = String(time || "").trim();
  if (!value) return null;

  if (APPOINTMENT_TIME_PATTERN.test(value)) {
    const match = value.match(/(\d{1,2}):(\d{2})\s*([AaPp])/);
    let hour = Number(match[1]);
    const minute = Number(match[2]);
    const period = match[3].toUpperCase();

    if (hour < 1 || hour > 12 || minute > 59) return null;

    if (period === "A" && hour === 12) hour = 0;
    else if (period === "P" && hour !== 12) hour += 12;

    return { hour, minute };
  }

  if (APPOINTMENT_TIME_24H_PATTERN.test(value)) {
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (hour > 23 || minute > 59) return null;

    return { hour, minute };
  }

  return null;
}

// Resolve the UTC instant an appointment takes place, using the user's
// timezone (the same wall-clock the reminder was scheduled for).
function resolveAppointmentAt(appointment, timeZone) {
  const dayKey = parseDateOnlyToDayKey(appointment.date);
  const timeParts = parseAppointmentTimeToParts(appointment.time);
  const parsedDay = dayKey ? parseDayKey(dayKey) : null;

  if (!parsedDay || !timeParts) return null;

  return zonedDateTimeToUtc(
    {
      year: parsedDay.year,
      month: parsedDay.month,
      day: parsedDay.day,
      hour: timeParts.hour,
      minute: timeParts.minute,
      second: 0,
    },
    timeZone
  );
}

async function ensureAppointmentAt(appointment, timeZone) {
  if (
    appointment.appointmentAt instanceof Date &&
    !Number.isNaN(appointment.appointmentAt.getTime())
  ) {
    return appointment.appointmentAt;
  }

  if (appointment.appointmentAtFailed) return null;

  const resolved = resolveAppointmentAt(appointment, timeZone);

  if (!resolved) {
    appointment.appointmentAtFailed = true;
    await appointment.save();
    return null;
  }

  appointment.appointmentAt = resolved;
  await appointment.save();
  return resolved;
}

async function createMissedNotification(appointment) {
  try {
    await Notification.findOneAndUpdate(
      {
        userId: appointment.userId,
        notificationKey: `missed-appointment:${String(appointment._id)}`,
      },
      {
        $setOnInsert: {
          userId: appointment.userId,
          notificationKey: `missed-appointment:${String(appointment._id)}`,
          title: "Missed appointment",
          message: `You appear to have missed the appointment with ${appointment.doctor}${
            appointment.time ? ` at ${appointment.time}` : ""
          }.`,
          type: "Appointment",
          isRead: false,
          scheduledFor: appointment.appointmentAt || null,
          doseId: null,
          medicineId: null,
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    return { status: "created" };
  } catch (error) {
    console.error(
      "Missed-appointment in-app notification error:",
      error && error.message ? error.message : error
    );
    return { status: "failed", error: String(error?.message || error) };
  }
}

// Send the caregiver email for one missed appointment. Uses an attempts cap +
// backoff so a broken email provider does not retry on every sweep forever.
async function notifyCaregiverOfMissedAppointment({
  appointment,
  user,
  caregiver,
  timeZone,
  config,
}) {
  if (appointment.caregiverNotified || appointment.caregiverNotifySkipped) {
    return { status: "already_handled" };
  }

  if (
    !caregiver ||
    caregiver.alertsEnabled !== true ||
    !isValidEmail(
      typeof caregiver.email === "string" ? caregiver.email.trim() : ""
    )
  ) {
    await Appointment.updateOne(
      { _id: appointment._id, caregiverNotifySkipped: false },
      { $set: { caregiverNotifySkipped: true } }
    );
    return { status: "skipped" };
  }

  if (!isEmailProviderConfigured()) {
    await Appointment.updateOne(
      { _id: appointment._id, caregiverNotifySkipped: false },
      { $set: { caregiverNotifySkipped: true } }
    );
    return { status: "skipped_not_configured" };
  }

  const now = new Date();
  const withinBackoff =
    appointment.caregiverNotifyAttempts > 0 &&
    appointment.caregiverNotifyLastAttemptAt instanceof Date &&
    now.getTime() -
      appointment.caregiverNotifyLastAttemptAt.getTime() <
      config.backoffMs;

  if (
    appointment.caregiverNotifyAttempts >= config.maxAttempts ||
    withinBackoff
  ) {
    return { status: "retry_wait" };
  }

  const email = buildMissedAppointmentEmail({
    studentName: user?.name,
    caregiverName: caregiver.name,
    doctor: appointment.doctor,
    hospital: appointment.hospital,
    date: appointment.date,
    time: appointment.time,
    timestamp: appointment.appointmentAt,
    timeZone,
  });

  const result = await sendCaregiverEmail({
    to: String(caregiver.email).trim().toLowerCase(),
    subject: email.subject,
    text: email.text,
    html: email.html,
    idempotencyKey: `missed-appointment-${String(appointment._id)}`,
  });

  if (result.ok) {
    await Appointment.updateOne(
      { _id: appointment._id, caregiverNotified: false },
      {
        $set: {
          caregiverNotified: true,
          caregiverNotifyAttempts: appointment.caregiverNotifyAttempts + 1,
          caregiverNotifyLastAttemptAt: now,
        },
      }
    );

    return { status: "sent" };
  }

  const skipped = result.skipped === true;

  await Appointment.updateOne(
    { _id: appointment._id },
    {
      $set: {
        caregiverNotifyAttempts: appointment.caregiverNotifyAttempts + 1,
        caregiverNotifyLastAttemptAt: now,
        ...(skipped ? { caregiverNotifySkipped: true } : {}),
      },
    }
  );

  return {
    status: skipped ? "skipped_not_configured" : "failed",
    error: String(result.error || ""),
  };
}

async function processMissedAppointmentsForUser(userId, options = {}) {
  const now =
    options.now instanceof Date && !Number.isNaN(options.now.getTime())
      ? options.now
      : new Date();

  const [user, caregiver] = await Promise.all([
    User.findById(userId).select("name email timezone"),
    CaregiverSettings.findOne({ userId }),
  ]);

  if (!user) {
    return { skipped: true, reason: "user_not_found" };
  }

  const timeZone = normalizeTimeZone(user.timezone);
  const config = getMissedAppointmentConfig();

  const upcoming = await Appointment.find({
    userId,
    status: "Upcoming",
  }).sort({ createdAt: 1 });

  const summary = {
    checked: upcoming.length,
    missesCreated: 0,
    emailsSent: 0,
    emailFailures: 0,
    emailSkipped: 0,
  };

  for (const appointment of upcoming) {
    const appointmentAt = await ensureAppointmentAt(appointment, timeZone);

    if (!appointmentAt || Number.isNaN(appointmentAt.getTime())) {
      continue;
    }

    if (appointmentAt.getTime() > now.getTime()) continue;

    // Refresh the document before counting it as missed so a reminder
    // updated concurrently in the last seconds is still respected.
    const current = await Appointment.findById(appointment._id);

    if (!current || current.status !== "Upcoming") continue;

    if (
      current.appointmentAt &&
      now.getTime() <
        current.appointmentAt.getTime() + config.graceMs
    ) {
      continue;
    }

    current.status = "Previous";
    current.missedAt = now;
    await current.save();
    summary.missesCreated += 1;

    await createMissedNotification(current);

    const delivery = await notifyCaregiverOfMissedAppointment({
      appointment: current,
      user,
      caregiver,
      timeZone,
      config,
    });

    if (delivery.status === "sent") summary.emailsSent += 1;
    else if (delivery.status === "failed") summary.emailFailures += 1;
    else if (String(delivery.status).startsWith("skipped"))
      summary.emailSkipped += 1;
  }

  // Sweep failed-email retries for appointments missed earlier in this run or
  // a previous one.
  const unnotified = await Appointment.find({
    userId,
    missedAt: { $ne: null },
    caregiverNotified: false,
    caregiverNotifySkipped: false,
  }).sort({ appointmentAt: 1 });

  for (const appointment of unnotified) {
    const delivery = await notifyCaregiverOfMissedAppointment({
      appointment,
      user,
      caregiver,
      timeZone,
      config,
    });

    if (delivery.status === "sent") summary.emailsSent += 1;
    else if (delivery.status === "failed") summary.emailFailures += 1;
  }

  return summary;
}

module.exports = {
  getMissedAppointmentConfig,
  parseAppointmentTimeToParts,
  resolveAppointmentAt,
  processMissedAppointmentsForUser,
};
