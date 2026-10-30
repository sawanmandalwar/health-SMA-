const Notification = require("../models/Notification");
const Appointment = require("../models/Appointment");
const User = require("../models/User");
const { resolveAppointmentAt } = require("./missedAppointmentService");

// Keep an in-app bell entry in sync with an appointment so reminders are
// visible immediately, not only after the appointment is missed.
async function upsertAppointmentNotification(appointment, timeZone) {
  try {
    if (!appointment) return;

    const key = `appointment:${String(appointment._id)}`;

    // Remember that this appointment has been processed so the GET backfill
    // does not recreate notifications the user deleted from the bell.
    if (!appointment.notificationCreatedAt) {
      appointment.notificationCreatedAt = new Date();
      await appointment.save();
    }

    if (appointment.reminder === false) {
      await Notification.deleteOne({
        userId: appointment.userId,
        notificationKey: key,
      });
      return;
    }

    let scheduledFor = appointment.appointmentAt;

    if (
      !(scheduledFor instanceof Date) ||
      Number.isNaN(scheduledFor.getTime())
    ) {
      scheduledFor = resolveAppointmentAt(appointment, timeZone);

      if (scheduledFor) {
        appointment.appointmentAt = scheduledFor;
        await appointment.save();
      }
    }

    const when = [appointment.date, appointment.time]
      .filter(Boolean)
      .join(" at ");

    await Notification.findOneAndUpdate(
      { userId: appointment.userId, notificationKey: key },
      {
        $set: {
          title: `Appointment reminder: ${appointment.doctor}`,
          message: `You have an appointment with ${appointment.doctor}${
            appointment.hospital ? ` at ${appointment.hospital}` : ""
          }${when ? ` on ${when}` : ""}.`,
          type: "Appointment",
          scheduledFor: scheduledFor || null,
          medicineId: null,
          doseId: null,
        },
        $setOnInsert: {
          userId: appointment.userId,
          notificationKey: key,
          isRead: false,
        },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  } catch (error) {
    console.error(
      "Appointment notification sync error:",
      error && error.message ? error.message : error
    );
  }
}

async function removeAppointmentNotifications(userId, appointmentIds = []) {
  const ids = appointmentIds.filter(Boolean).map(String);

  if (ids.length === 0) return;

  const keys = [];

  for (const id of ids) {
    keys.push(`appointment:${id}`, `missed-appointment:${id}`);
  }

  try {
    await Notification.deleteMany({
      userId,
      notificationKey: { $in: keys },
    });
  } catch (error) {
    console.error(
      "Appointment notification cleanup error:",
      error && error.message ? error.message : error
    );
  }
}

async function getUserTimeZone(userId) {
  try {
    const user = await User.findById(userId).select("timezone");
    return user ? user.timezone : undefined;
  } catch (error) {
    return undefined;
  }
}

// Backfills reminders for appointments that were created before this feature
// existed. Safe to call repeatedly because it upserts by appointment id.
async function syncAppointmentNotificationsForUser(userId) {
  try {
    const [timeZone, appointments] = await Promise.all([
      getUserTimeZone(userId),
      Appointment.find({
        userId,
        status: "Upcoming",
        notificationCreatedAt: null,
      }),
    ]);

    await Promise.all(
      appointments.map((appointment) =>
        upsertAppointmentNotification(appointment, timeZone)
      )
    );
  } catch (error) {
    console.error(
      "Appointment notification backfill error:",
      error && error.message ? error.message : error
    );
  }
}

module.exports = {
  upsertAppointmentNotification,
  removeAppointmentNotifications,
  syncAppointmentNotificationsForUser,
  getUserTimeZone,
};
