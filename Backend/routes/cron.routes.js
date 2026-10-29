const express = require("express");

const router = express.Router();

const { runReminderSweep } = require("../services/reminderSweep");
const { runMissedDoseSweep } = require("../services/missedDoseScheduler");
const {
  runMissedAppointmentSweep,
} = require("../services/missedAppointmentScheduler");
const { isEmailProviderConfigured } = require("../services/emailService");

function getEmailDiagnostics() {
  const provider =
    String(process.env.EMAIL_PROVIDER || "").trim().toLowerCase() || "disabled";

  return {
    provider,
    hasResendKey: Boolean(String(process.env.RESEND_API_KEY || "").trim()),
    hasFrom: Boolean(String(process.env.EMAIL_FROM || "").trim()),
    configured: isEmailProviderConfigured(),
  };
}

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` when CRON_SECRET is
// configured for the project. A query-string secret is also accepted so an
// external cron service (e.g. cron-job.org) can trigger the sweep.
function isAuthorized(req) {
  const secret = String(process.env.CRON_SECRET || "").trim();

  if (!secret) {
    console.warn(
      "[cron] CRON_SECRET is not set; the reminder endpoint is publicly reachable."
    );
    return true;
  }

  const authorization = String(req.headers.authorization || "");

  if (authorization === `Bearer ${secret}`) return true;

  return String(req.query.secret || "") === secret;
}

async function runSweep(name, run) {
  try {
    return { ok: true, ...(await run()) };
  } catch (error) {
    console.error(
      `${name} cron error:`,
      error && error.message ? error.message : error
    );

    return {
      ok: false,
      error: name === "reminders" ? "reminder_sweep_failed" : `${name}_failed`,
    };
  }
}

// The missed-dose sweep marks overdue doses as missed and emails the caregiver
// once the configured threshold is reached. The missed-appointment sweep does
// the same for appointments. Both used to run only from in-process timers,
// which never fire on Vercel, so the cron endpoint drives them here as well.
async function handleSweep(req, res) {
  if (!isAuthorized(req)) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  const [reminders, missedDoses, missedAppointments] = await Promise.all([
    runSweep("reminders", () => runReminderSweep()),
    runSweep("missedDoses", () => runMissedDoseSweep()),
    runSweep("missedAppointments", () => runMissedAppointmentSweep()),
  ]);

  const failed = [reminders, missedDoses, missedAppointments].some(
    (result) => result && result.ok === false
  );

  return res.status(failed ? 500 : 200).json({
    success: !failed,
    emailConfigured: isEmailProviderConfigured(),
    email: getEmailDiagnostics(),
    ...(reminders && reminders.ok ? reminders : {}),
    reminders,
    missedDoses,
    missedAppointments,
  });
}

router.get("/reminders", handleSweep);
router.post("/reminders", handleSweep);

module.exports = router;
