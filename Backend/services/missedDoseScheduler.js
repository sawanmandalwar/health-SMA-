const Medicine = require("../models/Medicine");
const MissedDoseAlert = require("../models/MissedDoseAlert");
const {
  processMissedDosesForUser,
} = require("./missedDoseService");
const {
  resetStaleDeliveries,
} = require("./caregiverAlertService");

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
    process.env.MISSED_DOSE_SCHEDULER_ENABLED || ""
  ).trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(explicit)) return true;
  if (["0", "false", "no", "off"].includes(explicit)) return false;

  return true;
}

function getSchedulerConfig() {
  return {
    enabled: isSchedulerEnabled(),
    intervalMs: Math.max(
      30 * 1000,
      envNumber("MISSED_DOSE_CHECK_INTERVAL_MS", 5 * 60 * 1000)
    ),
    initialDelayMs: Math.max(
      0,
      envNumber("MISSED_DOSE_INITIAL_DELAY_MS", 30 * 1000)
    ),
  };
}

async function collectUserIds() {
  const [medicineUserIds, alertUserIds] = await Promise.all([
    Medicine.distinct("userId"),
    MissedDoseAlert.distinct("userId", { status: "open" }),
  ]);

  const unique = new Map();
  for (const id of [...medicineUserIds, ...alertUserIds]) {
    if (id) unique.set(String(id), id);
  }

  return [...unique.values()];
}

async function runMissedDoseSweep(options = {}) {
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
    await resetStaleDeliveries();

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
      alertsCreated: 0,
      alertsUpdated: 0,
      alertsClosed: 0,
    };

    for (const userId of userIds) {
      try {
        const result = await processMissedDosesForUser(userId, { now });
        summary.missesCreated += result.missesCreated || 0;
        summary.alertsCreated += result.alertCreated ? 1 : 0;
        summary.alertsUpdated += result.alertUpdated ? 1 : 0;
        summary.alertsClosed += result.alertsClosed || 0;
      } catch (error) {
        summary.failedUsers += 1;
        console.error(
          "Missed-dose sweep user error:",
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
    const summary = await runMissedDoseSweep();

    if (
      summary.failedUsers > 0 ||
      summary.missesCreated > 0 ||
      summary.alertsCreated > 0 ||
      summary.alertsClosed > 0
    ) {
      console.log("Missed-dose sweep:", summary);
    }
  } catch (error) {
    console.error(
      "Missed-dose scheduler error:",
      error && error.message ? error.message : error
    );
  }
}

function startMissedDoseScheduler() {
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
    `Missed-dose scheduler started (every ${Math.round(
      config.intervalMs / 1000
    )}s).`
  );

  return { started: true, enabled: true, ...config };
}

function stopMissedDoseScheduler() {
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
  runMissedDoseSweep,
  startMissedDoseScheduler,
  stopMissedDoseScheduler,
};
