const Medicine = require("../models/Medicine");
const MedicineHistory = require("../models/MedicineHistory");
const User = require("../models/User");
const CaregiverSettings = require("../models/CaregiverSettings");
const MissedDoseAlert = require("../models/MissedDoseAlert");
const Notification = require("../models/Notification");

const {
  getSchedulesWithIds,
  buildDoseKey,
  timeToMinutes,
} = require("./doseService");
const {
  normalizeTimeZone,
  getDayKeyForDate,
  parseDayKey,
  addDaysToDayKey,
  zonedDateTimeToUtc,
  parseDateOnlyToDayKey,
} = require("./timezoneService");
const {
  processPendingAlertDeliveries,
  refreshInAppNotification,
} = require("./caregiverAlertService");

const DAY_MS = 24 * 60 * 60 * 1000;

const NON_DAILY_PATTERN =
  /\b(weekly|week|monthly|alternate|every\s+other|every\s+\d+\s+days?|sos|as\s+needed|prn|when\s+required|once\s+a\s+week|twice\s+a\s+week|\d+\s*\/\s*week|\d+\s+times?\s+(?:a|per)\s+week|\d+\s+days?\s+(?:a|per)\s+week|(?:a|per)\s+week)\b/i;

function envNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || String(raw).trim() === "") return fallback;

  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function getMissedDoseConfig() {
  return {
    graceMs:
      Math.min(
        24 * 60,
        Math.max(0, envNumber("MISSED_DOSE_GRACE_MINUTES", 60))
      ) * 60 * 1000,
    threshold: Math.max(2, Math.floor(envNumber("CAREGIVER_ALERT_THRESHOLD", 2))),
    lookbackDays: Math.min(
      60,
      Math.max(1, Math.floor(envNumber("MISSED_DOSE_LOOKBACK_DAYS", 14)))
    ),
  };
}

function isMedicineActiveOnDay(medicine, dayKey) {
  const startDay = parseDateOnlyToDayKey(medicine.startDate);
  const endDay = parseDateOnlyToDayKey(medicine.endDate);

  if (startDay && dayKey < startDay) return false;
  if (endDay && dayKey > endDay) return false;

  return true;
}

function hasNonDailyFrequency(medicine) {
  const frequency = String(medicine?.frequency || "").trim();
  return frequency ? NON_DAILY_PATTERN.test(frequency) : false;
}

function getOccurrenceTimeParts(dayKey, time, timeZone) {
  const parsedDay = parseDayKey(dayKey);
  const minutes = timeToMinutes(time);

  if (!parsedDay || minutes === null) return null;

  return zonedDateTimeToUtc(
    {
      year: parsedDay.year,
      month: parsedDay.month,
      day: parsedDay.day,
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
    },
    timeZone
  );
}

function buildOccurrencesForMedicine({
  medicine,
  dayKeys,
  timeZone,
  now,
}) {
  const occurrences = [];
  const schedules = getSchedulesWithIds(medicine);
  const createdAt = medicine.createdAt ? new Date(medicine.createdAt) : null;

  if (hasNonDailyFrequency(medicine)) {
    return occurrences;
  }

  for (const dayKey of dayKeys) {
    if (!isMedicineActiveOnDay(medicine, dayKey)) continue;

    for (const schedule of schedules) {
      const scheduledAt = getOccurrenceTimeParts(
        dayKey,
        schedule.time,
        timeZone
      );

      if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) continue;
      if (scheduledAt.getTime() > now.getTime()) continue;

      // Do not retroactively mark a dose that was already due before the
      // medicine was created.
      if (createdAt && scheduledAt.getTime() < createdAt.getTime()) continue;

      const doseKey = buildDoseKey(medicine._id, schedule.id, dayKey);

      occurrences.push({
        medicineId: String(medicine._id),
        medicineName: medicine.name,
        dosage: medicine.dosage,
        doseId: schedule.id,
        time: schedule.time,
        quantity: schedule.quantity,
        dayKey,
        doseKey,
        scheduledAt,
      });
    }
  }

  return occurrences;
}

function buildLegacyRecordMap(records, timeZone) {
  const map = new Map();

  for (const record of records) {
    if (record.doseKey) continue;

    const date = new Date(record.scheduledDate || record.createdAt);
    if (Number.isNaN(date.getTime())) continue;

    const dayKey = getDayKeyForDate(date, timeZone);
    const time = String(record.time || "").trim();
    const key = `${String(record.medicineId)}::${time}::${dayKey}`;

    if (!map.has(key)) map.set(key, []);
    map.get(key).push(record);
  }

  return map;
}

function getRecordStatus(records) {
  if (!Array.isArray(records) || records.length === 0) return null;

  if (records.some((record) => record.status === "Taken")) return "Taken";
  if (records.some((record) => record.status === "Missed")) return "Missed";
  return null;
}

function findOccurrenceRecords({
  occurrence,
  recordsByDoseKey,
  legacyRecordMap,
  usedLegacyRecordIds,
}) {
  const exact = recordsByDoseKey.get(occurrence.doseKey);
  if (exact && exact.length > 0) {
    return exact;
  }

  const key = `${occurrence.medicineId}::${occurrence.time}::${occurrence.dayKey}`;
  const candidates = legacyRecordMap.get(key) || [];
  const available = candidates.filter(
    (record) => !usedLegacyRecordIds.has(String(record._id))
  );

  if (available.length === 0) return [];

  // A legacy record is ambiguous when the same medicine had two doses at the
  // same time. Consume it once, in chronological occurrence order.
  usedLegacyRecordIds.add(String(available[0]._id));
  return [available[0]];
}

async function createMissedHistory(occurrence, userId) {
  try {
    return await MedicineHistory.create({
      userId,
      medicineId: occurrence.medicineId,
      medicineName: occurrence.medicineName,
      dosage: occurrence.dosage,
      time: occurrence.time,
      quantity: occurrence.quantity,
      status: "Missed",
      scheduledDate: occurrence.scheduledAt,
      takenAt: null,
      doseId: occurrence.doseId,
      doseKey: occurrence.doseKey,
      stockDeducted: false,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      const existing = await MedicineHistory.findOne({
        doseKey: occurrence.doseKey,
      });
      if (existing) return existing;
    }

    throw error;
  }
}

async function closeOpenAlertForTaken({
  userId,
  takenAt,
  doseKey = "",
}) {
  if (!(takenAt instanceof Date) || Number.isNaN(takenAt.getTime())) {
    return 0;
  }

  const openAlerts = await MissedDoseAlert.find({
    userId,
    status: "open",
    // $lte on purpose: taking the exact dose that anchors the open episode
    // also ends it (same-scheduled-minute take would never match $lt).
    lastMissedAt: { $lte: takenAt },
  })
    .select("_id episodeKey")
    .lean();

  if (openAlerts.length === 0) {
    return 0;
  }

  await MissedDoseAlert.updateMany(
    { _id: { $in: openAlerts.map((alert) => alert._id) } },
    {
      $set: {
        status: "closed",
        closedAt: new Date(),
        closedByDoseKey: String(doseKey || ""),
      },
    }
  );

  // The episode is over: retire its "missed doses" in-app notification so a
  // user who resumed taking their medicine is not presented a stale warning.
  await Notification.deleteMany({
    userId,
    notificationKey: {
      $in: openAlerts.map(
        (alert) => `missed-dose-episode:${alert.episodeKey}`
      ),
    },
  });

  return openAlerts.length;
}

async function createOrGetAlert({
  userId,
  episodeKey,
  runStartAt,
  lastMissedAt,
  lastMissedDoseKey,
  consecutiveMissed,
}) {
  try {
    const alert = await MissedDoseAlert.create({
      userId,
      episodeKey,
      status: "open",
      consecutiveMissed,
      firstMissedDoseKey: episodeKey,
      lastMissedDoseKey,
      firstMissedAt: runStartAt,
      lastMissedAt,
    });

    return { alert, created: true };
  } catch (error) {
    if (!error || error.code !== 11000) throw error;

    const existing = await MissedDoseAlert.findOne({
      userId,
      episodeKey,
    });

    if (existing && existing.status === "open") {
      return { alert: existing, created: false };
    }

    if (existing) {
      // A closed alert with the same episode key means the replayed lookback
      // window re-entered an episode that was closed earlier. Re-arm it as a
      // fresh open episode with reset delivery state; the next "Taken"
      // occurrence will close it again if the run is legitimately interrupted.
      existing.status = "open";
      existing.consecutiveMissed = consecutiveMissed;
      existing.firstMissedDoseKey = episodeKey;
      existing.firstMissedAt = runStartAt;
      existing.lastMissedDoseKey = lastMissedDoseKey;
      existing.lastMissedAt = lastMissedAt;
      existing.closedAt = null;
      existing.closedByDoseKey = "";
      existing.caregiverEmailStatus = "pending";
      existing.caregiverEmailRetryable = true;
      existing.caregiverEmailLastError = "";
      existing.caregiverEmailAttempts = 0;
      existing.caregiverEmailLastAttemptAt = null;
      await existing.save();
      return { alert: existing, created: false, reactivated: true };
    }

    const open = await MissedDoseAlert.findOne({
      userId,
      status: "open",
    });

    if (open) return { alert: open, created: false };

    throw error;
  }
}

async function processMissedDosesForUser(userId, options = {}) {
  const now =
    options.now instanceof Date && !Number.isNaN(options.now.getTime())
      ? options.now
      : new Date();

  const [user, caregiver] = await Promise.all([
    User.findById(userId).select("name email timezone"),
    CaregiverSettings.findOne({ userId }),
  ]);

  if (!user) {
    return {
      skipped: true,
      reason: "user_not_found",
      missesCreated: 0,
      alertCreated: false,
      alertUpdated: false,
    };
  }

  const timeZone = normalizeTimeZone(user.timezone);
  const config = getMissedDoseConfig();
  const todayKey = getDayKeyForDate(now, timeZone);

  const dayKeys = [];
  for (let offset = config.lookbackDays - 1; offset >= 0; offset -= 1) {
    const dayKey = addDaysToDayKey(todayKey, -offset);
    if (dayKey) dayKeys.push(dayKey);
  }

  const medicineList = await Medicine.find({ userId }).sort({ createdAt: 1 });

  if (medicineList.length === 0) {
    let openAlert = await MissedDoseAlert.findOne({
      userId,
      status: "open",
    });

    if (openAlert) {
      await processPendingAlertDeliveries({
        alert: openAlert,
        user,
        caregiver,
        timeZone,
      });
    }

    return {
      missesCreated: 0,
      alertCreated: false,
      alertUpdated: false,
      alertsClosed: 0,
      checkedMedicines: 0,
    };
  }

  const historyFrom = new Date(
    now.getTime() - (config.lookbackDays + 2) * DAY_MS
  );
  const historyTo = new Date(now.getTime() + DAY_MS);

  const history = await MedicineHistory.find({
    userId,
    scheduledDate: { $gte: historyFrom, $lt: historyTo },
  }).sort({ scheduledDate: 1, createdAt: 1 });

  const recordsByDoseKey = new Map();
  for (const record of history) {
    if (!record.doseKey) continue;
    if (!recordsByDoseKey.has(record.doseKey)) {
      recordsByDoseKey.set(record.doseKey, []);
    }
    recordsByDoseKey.get(record.doseKey).push(record);
  }

  const legacyRecordMap = buildLegacyRecordMap(history, timeZone);
  const usedLegacyRecordIds = new Set();

  const occurrences = [];
  for (const medicine of medicineList) {
    occurrences.push(
      ...buildOccurrencesForMedicine({
        medicine,
        dayKeys,
        timeZone,
        now,
      })
    );
  }

  occurrences.sort((a, b) => {
    const timeDiff = a.scheduledAt.getTime() - b.scheduledAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    const medicineDiff = a.medicineId.localeCompare(b.medicineId);
    if (medicineDiff !== 0) return medicineDiff;
    return a.doseId.localeCompare(b.doseId);
  });

  let openAlert = await MissedDoseAlert.findOne({
    userId,
    status: "open",
  });

  let runCount = 0;
  let runStartKey = "";
  let runStartAt = null;
  let lastMissedKey = "";
  let lastMissedAt = null;

  let missesCreated = 0;
  let alertsClosed = 0;
  let alertCreated = false;
  let alertUpdated = false;

  for (const occurrence of occurrences) {
    const records = findOccurrenceRecords({
      occurrence,
      recordsByDoseKey,
      legacyRecordMap,
      usedLegacyRecordIds,
    });

    const explicitStatus = getRecordStatus(records);
    const graceReached =
      now.getTime() >=
      occurrence.scheduledAt.getTime() + config.graceMs;

    let status = explicitStatus;

    if (!status && graceReached) {
      const created = await createMissedHistory(occurrence, userId);
      status = created?.status === "Taken" ? "Taken" : "Missed";
      if (!created || created.status !== "Taken") {
        missesCreated += 1;
      }
    }

    if (status === "Taken") {
      runCount = 0;
      runStartKey = "";
      runStartAt = null;
      lastMissedKey = "";
      lastMissedAt = null;

      if (openAlert && occurrence.scheduledAt >= openAlert.lastMissedAt) {
        const closed = await closeOpenAlertForTaken({
          userId,
          takenAt: occurrence.scheduledAt,
          doseKey: occurrence.doseKey,
        });
        alertsClosed += closed;
        if (closed > 0) {
          openAlert = null;
        }
      }

      continue;
    }

    // An explicitly recorded "Missed" is a user-asserted fact: count it
    // immediately. Auto-detected misses (no record yet) still wait for the
    // grace window so a late taken dose does not count as a false miss.
    if (status !== "Missed") {
      continue;
    }

    runCount += 1;

    if (runCount === 1) {
      runStartKey = occurrence.doseKey;
      runStartAt = occurrence.scheduledAt;
    }

    lastMissedKey = occurrence.doseKey;
    lastMissedAt = occurrence.scheduledAt;

    if (runCount < config.threshold) {
      continue;
    }

    if (!openAlert) {
      const result = await createOrGetAlert({
        userId,
        episodeKey: runStartKey,
        runStartAt,
        lastMissedAt,
        lastMissedDoseKey: lastMissedKey,
        consecutiveMissed: runCount,
      });

      openAlert = result.alert;
      alertCreated =
        alertCreated || result.created || Boolean(result.reactivated);
    }

    if (openAlert) {
      const previousCount = Number(openAlert.consecutiveMissed) || 0;
      const nextCount = Math.max(previousCount, runCount);

      const update = await MissedDoseAlert.updateOne(
        { _id: openAlert._id, status: "open" },
        {
          $set: {
            consecutiveMissed: nextCount,
            lastMissedDoseKey: lastMissedKey,
            lastMissedAt,
          },
        }
      );

      if ((update.matchedCount || 0) === 0) {
        // The alert was closed concurrently; drop the stale reference so a
        // later occurrence can open a fresh episode instead of silently
        // updating a closed alert forever.
        openAlert = null;
        continue;
      }

      openAlert.consecutiveMissed = nextCount;
      openAlert.lastMissedDoseKey = lastMissedKey;
      openAlert.lastMissedAt = lastMissedAt;
      alertUpdated = true;

      if (nextCount !== previousCount) {
        try {
          const inApp = await refreshInAppNotification(openAlert);
          if (inApp.status === "created") {
            openAlert.inAppStatus = "created";
            openAlert.inAppNotificationId = inApp.notificationId || null;
          }
        } catch (inAppError) {
          console.error(
            "Missed-dose in-app refresh error:",
            inAppError && inAppError.message ? inAppError.message : inAppError
          );
        }
      }
    }
  }

  if (openAlert) {
    const currentAlert = await MissedDoseAlert.findById(openAlert._id);
    if (currentAlert && currentAlert.status === "open") {
      await processPendingAlertDeliveries({
        alert: currentAlert,
        user,
        caregiver,
        timeZone,
      });
    }
  }

  return {
    missesCreated,
    alertCreated,
    alertUpdated,
    alertsClosed,
    checkedMedicines: medicineList.length,
    checkedOccurrences: occurrences.length,
  };
}

module.exports = {
  getMissedDoseConfig,
  closeOpenAlertForTaken,
  processMissedDosesForUser,
  isMedicineActiveOnDay,
  hasNonDailyFrequency,
  buildOccurrencesForMedicine,
};
