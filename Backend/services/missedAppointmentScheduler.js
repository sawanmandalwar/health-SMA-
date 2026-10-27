const Appointment = require("../models/Appointment");
const { processMissedAppointmentsForUser } = require("./missedAppointmentService");

let intervalHandle = null;
let initialHandle = null;
let sweepRunning = false;

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") return fallback;

  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function isSchedulerEnabled() {
  const explicit = String(
    process.env.MISSED_APPOINTMENT_SCHEDULER_ENABLED || ""
  ).trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(explicit)) return true;
  if (["0", "false", "no", "off"].includes(explicit)) return false;

  // On by default; can be disabled explicitly.
  return true;
}

function getSchedulerConfig() {
  return {
    enabled: isSchedulerEnabled(),
    intervalMs: Math.max(
      60 * 1000,
      envNumber("MISSED_APPOINTMENT_CHECK_INTERVAL_MS", 5 * 60 * 1000)
    ),
    initialDelayMs: Math.max(
      0,
      envNumber("MISSED_APPOINTMENT_INITIAL_DELAY_MS", 60 * 1000)
    ),
  };
}

async function collectUserIds() {
  const userIds = await Appointment.distinct("userId", {
    $or: [
      { status: "Upcoming" },
      { missedAt: { $ne: null }, caregiverNotified: false },
    ],
  });

  return userIds.filter(Boolean);
}

async function runMissedAppointmentSweep(options = {}) {
  if (sweepRunning) {
    return {
      skipped: true,
      reason: "sweep_already_running",
      users: 0,
      failedUsers: 0,
    };
  }

  sweepRunning = true;

  try {
    const now =
      options.now instanceof Date && !Number.isNaN(options.now.getTime())
        ? options.now
        : new Date();

    const userIds = await collectUserIds();

    const summary = {
      skipped: false,
      users: userIds.length,
      failedUsers: 0,
      missesCreated: 0,
      emailsSent: 0,
      emailFailures: 0,
    };

    for (const userId of userIds) {
      try {
        const result = await processMissedAppointmentsForUser(userId, { now });
        summary.missesCreated += result.missesCreated || 0;
        summary.emailsSent += result.emailsSent || 0;
        summary.emailFailures += result.emailFailures || 0;
      } catch (error) {
        summary.failedUsers += 1;
        console.error(
          "Missed-appointment sweep user error:",
          error && error.message ? error.message : error
        );
      }
    }

    return summary;
  } finally {
    sweepRunning = false;
  }
}

async function runScheduledSweep() {
  try {
    const summary = await runMissedAppointmentSweep();

    if (
      summary.failedUsers > 0 ||
      summary.missesCreated > 0 ||
      summary.emailsSent > 0
    ) {
      console.log("Missed-appointment sweep:", summary);
    }
  } catch (error) {
    console.error(
      "Missed-appointment scheduler error:",
      error && error.message ? error.message : error
    );
  }
}

function startMissedAppointmentScheduler() {
  const config = getSchedulerConfig();

  if (!config.enabled) {
    return { started: false, enabled: false, ...config };
  }

  if (intervalHandle || initialHandle) {
    return { started: false, enabled: true, alreadyRunning: true, ...config };
  }

  initialHandle = setTimeout(() => {
    initialHandle = null;
    runScheduledSweep();
  }, config.initialDelayMs);

  if (typeof initialHandle.unref === "function") {
    initialHandle.unref();
  }

  intervalHandle = setInterval(runScheduledSweep, config.intervalMs);

  if (typeof intervalHandle.unref === "function") {
    intervalHandle.unref();
  }

  console.log(
    `Missed-appointment scheduler started (every ${Math.round(
      config.intervalMs / 1000
    )}s).`
  );

  return { started: true, enabled: true, ...config };
}

function stopMissedAppointmentScheduler() {
  if (initialHandle) {
    clearTimeout(initialHandle);
    initialHandle = null;
  }

  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  return { stopped: true };
}

module.exports = {
  isSchedulerEnabled,
  getSchedulerConfig,
  runMissedAppointmentSweep,
  startMissedAppointmentScheduler,
  stopMissedAppointmentScheduler,
};
