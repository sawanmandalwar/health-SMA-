const Notification = require("../models/Notification");
const Medicine = require("../models/Medicine");
const MedicineHistory = require("../models/MedicineHistory");
const User = require("../models/User");
const {
  getSchedulesWithIds,
  timeToMinutes,
  getDayRangeForTimeZone,
} = require("./doseService");
const {
  normalizeTimeZone,
  zonedDateTimeToUtc,
  parseDateOnlyToDayKey,
} = require("./timezoneService");

const MISSED_DOSE_GRACE_MS = 60 * 60 * 1000;

function isMedicineActive(medicine, todayKey) {
  const startKey = parseDateOnlyToDayKey(medicine.startDate);
  const endKey = parseDateOnlyToDayKey(medicine.endDate);

  if (startKey && todayKey < startKey) return false;
  if (endKey && todayKey > endKey) return false;

  return true;
}

function buildNotificationKey(medicineId, doseId, dayKey) {
  return `medicine:${String(medicineId)}:${String(doseId)}:${dayKey}`;
}

function buildUpcomingNotification(medicine, schedule) {
  return {
    title: `Upcoming medicine: ${medicine.name}`,
    message: `Take ${medicine.dosage} at ${schedule.time}${
      medicine.timing ? ` (${medicine.timing})` : ""
    }.`,
  };
}

async function ensureNotification({
  userId,
  key,
  title,
  message,
  scheduledFor,
  medicineId,
  doseId,
}) {
  await Notification.updateOne(
    { userId, notificationKey: key },
    {
      $set: {
        title,
        message,
        type: "Medicine",
        scheduledFor,
        medicineId,
        doseId,
      },
      $setOnInsert: {
        userId,
        notificationKey: key,
        isRead: false,
      },
    },
    { upsert: true }
  );
}

async function removeNotificationKeys(userId, keys) {
  if (keys.length === 0) return;
  await Notification.deleteMany({
    userId,
    notificationKey: { $in: keys },
  });
}

async function syncMedicineNotifications(
  userId,
  { medicines, history, timeZone } = {}
) {
  const now = new Date();
  let zone =
    typeof timeZone === "string" && timeZone.trim()
      ? normalizeTimeZone(timeZone)
      : null;

  if (!zone) {
    const user = await User.findById(userId).select("timezone").lean();
    zone = normalizeTimeZone(user?.timezone);
  }

  const {
    start: todayStart,
    end: todayEnd,
    dayKey: todayKey,
  } = getDayRangeForTimeZone(now, zone);

  const medicineList =
    medicines || (await Medicine.find({ userId }).sort({ createdAt: -1 }));

  const historyList =
    history ||
    (await MedicineHistory.find({
      userId,
      scheduledDate: { $gte: todayStart, $lt: todayEnd },
    }));

  // Prune past medicine reminders, but keep standalone alerts that are
  // created for missed episodes/appointments so they stay visible in the bell.
  await Notification.deleteMany({
    userId,
    notificationKey: {
      $type: "string",
      $not: /^(missed-dose-episode|missed-appointment):/,
    },
    scheduledFor: { $lt: todayStart },
  });

  const todayHistory = historyList.filter((item) => {
    const date = new Date(item.scheduledDate || item.createdAt);
    return (
      !Number.isNaN(date.getTime()) &&
      date >= todayStart &&
      date < todayEnd
    );
  });

  for (const medicine of medicineList) {
    if (!isMedicineActive(medicine, todayKey)) {
      continue;
    }

    for (const schedule of getSchedulesWithIds(medicine)) {
      const minutes = timeToMinutes(schedule.time);
      if (minutes === null) continue;

      const [year, month, day] = todayKey.split("-").map(Number);
      const scheduledFor = zonedDateTimeToUtc(
        {
          year,
          month,
          day,
          hour: Math.floor(minutes / 60),
          minute: minutes % 60,
        },
        zone
      );

      const keyBase = buildNotificationKey(
        medicine._id,
        schedule.id,
        todayKey
      );
      const upcomingKey = `${keyBase}:upcoming`;
      const legacyMissedKey = `${keyBase}:missed`;

      const record = todayHistory.find(
        (item) =>
          String(item.medicineId) === String(medicine._id) &&
          String(item.doseId || "default") === String(schedule.id)
      );

      if (record && (record.status === "Taken" || record.status === "Missed")) {
        await removeNotificationKeys(userId, [upcomingKey, legacyMissedKey]);
        continue;
      }

      if (
        scheduledFor.getTime() > now.getTime() ||
        now.getTime() - scheduledFor.getTime() <= MISSED_DOSE_GRACE_MS
      ) {
        const content = buildUpcomingNotification(medicine, schedule);
        await ensureNotification({
          userId,
          key: upcomingKey,
          ...content,
          scheduledFor,
          medicineId: medicine._id,
          doseId: schedule.id,
        });
        continue;
      }

      // Automatic missed-dose reminders are aggregated by the missed-dose
      // engine into a single threshold alert instead of one per dose.
      await removeNotificationKeys(userId, [upcomingKey, legacyMissedKey]);
    }
  }
}

async function clearMedicineNotifications(userId, medicineId) {
  await Notification.deleteMany({
    userId,
    medicineId,
  });
}

module.exports = {
  syncMedicineNotifications,
  clearMedicineNotifications,
};
