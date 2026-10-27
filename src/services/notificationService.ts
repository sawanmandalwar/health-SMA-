import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { apiFetch } from './api';

type NotificationsModule = typeof import('expo-notifications');

// Expo Go on Android can no longer load expo-notifications: remote push
// support was removed in SDK 53 and importing the package throws before any
// screen can render. Local reminders stay available in development builds,
// standalone builds, and Expo Go on iOS.
const isExpoGo =
  isRunningInExpoGo() || Constants.appOwnership === 'expo';

const notificationsSupported =
  Platform.OS !== 'web' && !(Platform.OS === 'android' && isExpoGo);

let notificationsPromise: Promise<NotificationsModule | null> | null = null;

// Load expo-notifications lazily so Expo Go on Android never evaluates the
// module. The handler is registered once, after the module is available.
function getNotifications(): Promise<NotificationsModule | null> {
  if (!notificationsSupported) {
    return Promise.resolve(null);
  }

  if (!notificationsPromise) {
    notificationsPromise = import('expo-notifications')
      .then((module) => {
        // Display notifications while the app is open.
        module.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          }),
        });

        return module;
      })
      .catch((error) => {
        console.log(
          '[notifications] expo-notifications could not be loaded; reminders are disabled.',
          error,
        );
        return null;
      });
  }

  return notificationsPromise;
}

interface MedicineScheduleReminder {
  id?: string;
  time: string;
  quantity?: number;
}

interface MedicineReminder {
  _id: string;
  name: string;
  dosage: string;
  timing?: string;
  time: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
  schedules?: MedicineScheduleReminder[];
}

interface AppointmentReminder {
  id: string;
  doctor: string;
  specialty: string;
  hospital: string;
  date: string;
  time: string;
  reminder: boolean;
  status: 'Upcoming' | 'Previous';
}

// Android notification channels. Creating a channel is idempotent but not
// free, so each one is only created once per app session.
//
// The `sound` key is intentionally omitted from both the channel and the
// notification content. Passing a string such as 'default' makes
// expo-notifications look for a custom raw sound resource (logging
// "Custom sound 'default' not found in native app"), and a boolean can be
// serialized as the string "true" on iOS. When the field is absent, iOS uses
// `.default` and Android uses the channel/system default sound, so reminders
// still play the normal notification sound.
//
// The channel ids are versioned because Android channel settings are immutable
// after creation; bumping the version guarantees a fresh channel with the
// correct default sound instead of keeping an old mis-configured one.
const MEDICINE_CHANNEL_ID = 'medicine-reminders-v2';
const APPOINTMENT_CHANNEL_ID = 'appointment-reminders-v2';
const ensuredChannels = new Set<string>();

async function ensureAndroidChannel(id: string, name: string) {
  const Notifications = await getNotifications();
  if (!Notifications) return;
  if (Platform.OS !== 'android' || ensuredChannels.has(id)) return;

  await Notifications.setNotificationChannelAsync(id, {
    name,
    importance: Notifications.AndroidImportance.MAX,
    enableVibrate: true,
  });

  ensuredChannels.add(id);

  console.log(`Android notification channel ready: ${id}`);
}

// Ask for notification permission. On Android 13+ the OS permission prompt
// does not appear until at least one notification channel exists, so the
// channel must be created BEFORE requesting permission.
async function ensureNotificationPermission(): Promise<boolean> {
  const Notifications = await getNotifications();
  if (!Notifications) {
    console.log(
      '[notifications] Reminders are disabled in Expo Go on Android. Use a development build to enable them.'
    );
    return false;
  }

  await ensureAndroidChannel(MEDICINE_CHANNEL_ID, 'Medicine Reminders');
  await ensureAndroidChannel(APPOINTMENT_CHANNEL_ID, 'Appointment Reminders');

  type PermissionStatus = Awaited<
    ReturnType<typeof Notifications.getPermissionsAsync>
  >;

  const isGranted = (status: PermissionStatus) =>
    status.granted ||
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  let permission = await Notifications.getPermissionsAsync();
  if (isGranted(permission)) {
    console.log('Notification permission already granted.');
    return true;
  }

  permission = await Notifications.requestPermissionsAsync();

  const granted = isGranted(permission);
  console.log(
    `Notification permission after request: ${
      granted ? 'granted' : 'denied'
    } (${permission.status}).`
  );

  return granted;
}

// Public wrapper so screens can request permission and react to a denial
// instead of silently dropping reminders.
export function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(false);
  return ensureNotificationPermission();
}

const PUSH_TOKEN_STORAGE_KEY = 'expoPushToken';

let pushRegistrationPromise: Promise<boolean> | null = null;
let lastPushRegistrationKey = '';
let lastPushAttemptKey = '';

function getExpoProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  const easConfig = (
    Constants as typeof Constants & {
      easConfig?: { projectId?: string };
    }
  ).easConfig;

  const projectId = extra?.eas?.projectId || easConfig?.projectId;
  return typeof projectId === 'string' && projectId.trim()
    ? projectId.trim()
    : null;
}

// Register the device's Expo push token with the backend. Remote push is only
// available in a development/standalone build on a physical device, and only
// after notification permission has been granted.
export async function registerPushTokenWithBackend(
  authToken: string,
): Promise<boolean> {
  const isNativePlatform =
    Platform.OS === 'android' || Platform.OS === 'ios';

  if (!authToken || !isNativePlatform) return false;
  if (lastPushRegistrationKey === authToken) return true;
  if (lastPushAttemptKey === authToken) return false;

  if (pushRegistrationPromise) return pushRegistrationPromise;

  pushRegistrationPromise = (async () => {
    try {
      const Notifications = await getNotifications();
      if (!Notifications) {
        lastPushAttemptKey = authToken;
        return false;
      }

      if (isExpoGo) {
        console.log(
          '[push] Remote push requires a development build; skipping registration in Expo Go.',
        );
        lastPushAttemptKey = authToken;
        return false;
      }

      const Device = await import('expo-device');
      if (!Device.isDevice) {
        console.log(
          '[push] Expo push tokens require a physical device; skipping registration.',
        );
        lastPushAttemptKey = authToken;
        return false;
      }

      const granted = await ensureNotificationPermission();
      if (!granted) {
        lastPushAttemptKey = authToken;
        return false;
      }

      const projectId = getExpoProjectId();
      if (!projectId) {
        console.log(
          '[push] Missing EAS projectId; cannot request an Expo push token.',
        );
        lastPushAttemptKey = authToken;
        return false;
      }

      const tokenResult = await Notifications.getExpoPushTokenAsync({
        projectId,
      });
      const pushToken =
        tokenResult && typeof tokenResult.data === 'string'
          ? tokenResult.data.trim()
          : '';

      if (!pushToken) return false;

      const response = await apiFetch('/api/notifications/push-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token: pushToken,
          platform: Platform.OS,
        }),
      });

      if (!response.ok) {
        console.log(
          '[push] Backend rejected Expo push token:',
          response.status,
        );
        return false;
      }

      await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, pushToken);
      lastPushRegistrationKey = authToken;
      lastPushAttemptKey = '';

      console.log('[push] Expo push token registered.');
      return true;
    } catch (error) {
      console.log(
        '[push] Unable to register Expo push token:',
        error instanceof Error ? error.message : 'unknown error',
      );
      return false;
    } finally {
      pushRegistrationPromise = null;
    }
  })();

  return pushRegistrationPromise;
}

// Best-effort removal so a signed-out account does not keep receiving pushes on
// this device. The token itself is never logged.
export async function deactivatePushTokenWithBackend(
  authToken: string,
): Promise<boolean> {
  const isNativePlatform =
    Platform.OS === 'android' || Platform.OS === 'ios';

  if (!authToken || !isNativePlatform) return false;

  try {
    const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
    if (!pushToken) return false;

    const response = await apiFetch('/api/notifications/push-token', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token: pushToken }),
    });

    await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
    lastPushRegistrationKey = '';
    lastPushAttemptKey = '';

    return response.ok;
  } catch (error) {
    console.log(
      '[push] Unable to deactivate Expo push token:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return false;
  }
}

// True when a reminder time can be parsed. Used by the UI to block invalid
// values before saving so a reminder is never silently skipped.
export function isValidMedicineTime(time: string): boolean {
  try {
    parseMedicineTime(time);
    return true;
  } catch {
    return false;
  }
}

// Convert "8:00 AM", "8:00AM", "8:00 a.m.", "08:00", or "20:00" into
// 24-hour time. The daily trigger uses the device's local time zone.
function parseMedicineTime(time: string) {
  const value = (time || '').trim();

  // 12-hour clock with an AM/PM suffix.
  const twelveHour = value.match(
    /^(\d{1,2}):(\d{2})\s*([AaPp])\.?\s?[Mm]\.?$/
  );
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2]);
    const period = twelveHour[3].toUpperCase();

    if (hour < 1 || hour > 12 || minute > 59) {
      throw new Error('Invalid medicine reminder time.');
    }

    if (period === 'A' && hour === 12) hour = 0;
    else if (period === 'P' && hour !== 12) hour += 12;

    return { hour, minute };
  }

  // 24-hour clock, e.g. "08:00" or "20:30".
  const twentyFourHour = value.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const hour = Number(twentyFourHour[1]);
    const minute = Number(twentyFourHour[2]);

    if (hour > 23 || minute > 59) {
      throw new Error('Invalid medicine reminder time.');
    }

    return { hour, minute };
  }

  throw new Error('Invalid time. Use a format such as 8:00 AM.');
}

// Parse a date-only string (same formats as appointments) into a Date.
function parseDateOnly(value?: string): Date | null {
  if (!value || !value.trim()) return null;

  try {
    return parseAppointmentDateTime(value, '12:00 AM');
  } catch {
    return null;
  }
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addLocalDays(value: Date, days: number): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate() + days
  );
}

function formatDayKey(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, '0'),
    String(value.getDate()).padStart(2, '0'),
  ].join('');
}

// Date-bounded courses are scheduled as individual one-time notifications so
// the reminder starts on the prescribed day and stops after the course ends.
const REMINDER_HORIZON_DAYS = 60;

interface MedicineReminderSpec {
  identifier: string;
  key: string;
  fingerprint: string;
  medicineId: string;
  doseId: string;
  time: string;
  hour: number;
  minute: number;
  nextOccurrence: Date;
  triggerDate?: Date;
  title: string;
  body: string;
}

// Build a deterministic, native-safe identifier. Supplying our own identifier
// (instead of letting expo generate a random UUID) gives every dose a stable
// ID that survives app restarts, so rescheduling replaces the same pending
// notification instead of creating duplicates.
function buildReminderIdentifier(prefix: string, ...parts: string[]): string {
  const safeParts = [prefix, ...parts].map((part) =>
    String(part).replace(/[^a-zA-Z0-9_-]/g, '_')
  );

  return safeParts.join('_').slice(0, 200);
}

// The next time the clock reaches hour:minute. If that moment has already
// passed today, roll over to tomorrow. This mirrors what a DAILY trigger does
// natively and is used for logging/verification (never a past date).
function computeNextOccurrence(
  hour: number,
  minute: number,
  reference = new Date()
): Date {
  const next = new Date(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
    hour,
    minute,
    0,
    0
  );

  if (next.getTime() <= reference.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

// Build one reminder spec per scheduled dose. Date-bounded courses use a
// separate one-time notification for every prescribed day, while open-ended
// courses keep a daily repeating notification.
function buildMedicineReminderSpecs(
  medicine: MedicineReminder
): MedicineReminderSpec[] {
  if (!medicine?._id) {
    return [];
  }

  const schedules =
    medicine.schedules && medicine.schedules.length > 0
      ? medicine.schedules
      : medicine.time
      ? [{ id: 'default', time: medicine.time }]
      : [];

  if (schedules.length === 0) {
    return [];
  }

  const now = new Date();
  const today = startOfLocalDay(now);
  const start = parseDateOnly(medicine.startDate);
  const end = parseDateOnly(medicine.endDate);
  const hasDateWindow = Boolean(start || end);

  if (end && end.getTime() < today.getTime()) {
    console.log(
      `Medicine ${medicine._id}: course ended on ${medicine.endDate}; no reminders scheduled.`
    );
    return [];
  }

  const firstDay =
    start && start.getTime() > today.getTime() ? start : today;
  const lastAllowedDay = addLocalDays(firstDay, REMINDER_HORIZON_DAYS - 1);
  const lastDay =
    end && end.getTime() < lastAllowedDay.getTime() ? end : lastAllowedDay;

  if (firstDay.getTime() > lastDay.getTime()) {
    return [];
  }

  const specs: MedicineReminderSpec[] = [];
  const usedDoseIds = new Set<string>();

  for (const schedule of schedules) {
    let parsed;

    try {
      parsed = parseMedicineTime(schedule.time);
    } catch (error) {
      console.log(
        `Medicine ${medicine._id}: skipping invalid reminder time "${schedule.time}".`,
        error
      );
      continue;
    }

    const baseDoseId = schedule.id || 'default';
    let doseId = baseDoseId;
    let suffix = 1;
    while (usedDoseIds.has(doseId)) {
      doseId = `${baseDoseId}-${suffix}`;
      suffix += 1;
    }
    usedDoseIds.add(doseId);

    const quantityPrefix =
      schedule.quantity && schedule.quantity > 1
        ? `${schedule.quantity} × `
        : '';
    const title = `Medicine Reminder: ${medicine.name}`;
    const body = `Time to take ${quantityPrefix}${medicine.dosage}${
      medicine.timing ? ` — ${medicine.timing}` : ''
    }.`;
    const baseFingerprint = {
      time: schedule.time,
      hour: parsed.hour,
      minute: parsed.minute,
      quantity: schedule.quantity ?? 1,
      title,
      body,
    };

    if (!hasDateWindow) {
      specs.push({
        identifier: buildReminderIdentifier(
          'med',
          medicine._id,
          doseId,
          'daily'
        ),
        key: `${medicine._id}::${doseId}::daily`,
        fingerprint: JSON.stringify(baseFingerprint),
        medicineId: medicine._id,
        doseId,
        time: schedule.time,
        hour: parsed.hour,
        minute: parsed.minute,
        nextOccurrence: computeNextOccurrence(parsed.hour, parsed.minute),
        title,
        body,
      });
      continue;
    }

    for (
      let day = firstDay;
      day.getTime() <= lastDay.getTime();
      day = addLocalDays(day, 1)
    ) {
      const triggerDate = new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        parsed.hour,
        parsed.minute,
        0,
        0
      );

      if (triggerDate.getTime() <= now.getTime()) {
        continue;
      }

      const dayKey = formatDayKey(day);

      specs.push({
        identifier: buildReminderIdentifier(
          'med',
          medicine._id,
          doseId,
          dayKey,
          `${parsed.hour}${String(parsed.minute).padStart(2, '0')}`
        ),
        key: `${medicine._id}::${doseId}::${dayKey}`,
        fingerprint: JSON.stringify({
          ...baseFingerprint,
          triggerDate: triggerDate.toISOString(),
        }),
        medicineId: medicine._id,
        doseId,
        time: schedule.time,
        hour: parsed.hour,
        minute: parsed.minute,
        nextOccurrence: triggerDate,
        triggerDate,
        title,
        body,
      });
    }
  }

  return specs;
}

interface ScheduleOutcome {
  identifier: string;
  time?: string;
  ok: boolean;
  error?: unknown;
}

// Schedule a single dose reminder. Errors are caught per reminder so one bad
// dose can never prevent the remaining doses from being scheduled.
async function scheduleMedicineSpec(
  spec: MedicineReminderSpec
): Promise<ScheduleOutcome> {
  const Notifications = await getNotifications();
  if (!Notifications) {
    return { identifier: spec.identifier, time: spec.time, ok: false };
  }

  const channelId =
    Platform.OS === 'android' ? MEDICINE_CHANNEL_ID : undefined;

  type TriggerInput = Parameters<
    NotificationsModule['scheduleNotificationAsync']
  >[0]['trigger'];

  const trigger: TriggerInput = spec.triggerDate
    ? {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: spec.triggerDate,
        channelId,
      }
    : {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: spec.hour,
        minute: spec.minute,
        channelId,
      };

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: spec.identifier,
      content: {
        title: spec.title,
        body: spec.body,
        data: {
          medicineId: spec.medicineId,
          doseId: spec.doseId,
          time: spec.time,
          reminderKey: spec.key,
          fingerprint: spec.fingerprint,
          type: 'medicine-reminder',
        },
      },
      trigger,
    });

    console.log(
      `Medicine reminder scheduled: ${spec.identifier} (${spec.time}, next ${spec.nextOccurrence.toISOString()}).`
    );

    return { identifier: spec.identifier, time: spec.time, ok: true };
  } catch (error) {
    console.log(
      `Medicine reminder FAILED: ${spec.identifier} (${spec.time}).`,
      error
    );

    return {
      identifier: spec.identifier,
      time: spec.time,
      ok: false,
      error,
    };
  }
}

// Reconcile every scheduled medicine reminder against one medicine list:
//  - cancel reminders whose dose is gone or whose details changed
//  - cancel reminders created by older app versions (random identifiers)
//  - schedule only new/changed doses; unchanged ones are left untouched
//
// Matching is done by the native notification identifier, which we control.
// That keeps every dose independent and makes reopening the app idempotent.
async function reconcileMedicineReminders(
  medicines: MedicineReminder[],
  partial = false
) {
  const Notifications = await getNotifications();
  if (!Notifications) {
    console.log(
      '[notifications] Reminders are disabled in Expo Go on Android; skipping medicine reminder sync.'
    );
    return;
  }

  const granted = await ensureNotificationPermission();
  if (!granted) {
    console.log(
      'Notification permission not granted; skipping medicine reminders.'
    );
    return;
  }

  const desired = new Map<string, MedicineReminderSpec>();
  for (const medicine of medicines) {
    for (const spec of buildMedicineReminderSpecs(medicine)) {
      if (desired.has(spec.identifier)) {
        console.log(
          `Duplicate medicine reminder identifier "${spec.identifier}"; keeping the first.`
        );
        continue;
      }
      desired.set(spec.identifier, spec);
    }
  }

  const managedMedicineIds = new Set(
    medicines.map((medicine) => String(medicine._id))
  );
  const isManaged = (medicineId: unknown) =>
    !partial ||
    (typeof medicineId === 'string' &&
      managedMedicineIds.has(String(medicineId)));

  console.log(
    `Medicine reminders: ${desired.size} wanted across ${medicines.length} medicine(s).`
  );

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  const existing = new Map<
    string,
    { fingerprint: string; medicineId: string }
  >();
  const legacyIdentifiers: string[] = [];

  for (const notification of scheduled) {
    const data = notification.content?.data || {};
    if (data.type !== 'medicine-reminder') continue;

    const key = typeof data.reminderKey === 'string' ? data.reminderKey : null;
    const medicineId =
      typeof data.medicineId === 'string' ? data.medicineId : '';

    if (!key) {
      if (isManaged(medicineId)) {
        legacyIdentifiers.push(notification.identifier);
      }
      continue;
    }

    existing.set(notification.identifier, {
      fingerprint: typeof data.fingerprint === 'string' ? data.fingerprint : '',
      medicineId,
    });
  }

  const cancelPromises: Promise<void>[] = [];

  for (const identifier of legacyIdentifiers) {
    cancelPromises.push(
      Notifications.cancelScheduledNotificationAsync(identifier)
    );
  }

  // Cancel anything that is no longer wanted or whose details changed.
  for (const [identifier, entry] of existing) {
    const wanted = desired.get(identifier);
    const shouldCancel =
      (!wanted && isManaged(entry.medicineId)) ||
      (wanted && wanted.fingerprint !== entry.fingerprint);

    if (shouldCancel) {
      cancelPromises.push(
        Notifications.cancelScheduledNotificationAsync(identifier)
      );
    }
  }

  await Promise.all(cancelPromises);

  const toSchedule: MedicineReminderSpec[] = [];
  for (const [identifier, spec] of desired) {
    const entry = existing.get(identifier);
    if (entry && entry.fingerprint === spec.fingerprint) continue;
    toSchedule.push(spec);
  }

  // allSettled-style: each reminder succeeds or fails on its own.
  const outcomes = await Promise.all(toSchedule.map(scheduleMedicineSpec));
  const failed = outcomes.filter((outcome) => !outcome.ok);

  console.log(
    `Medicine reminders synced: ${outcomes.length - failed.length} scheduled, ${
      failed.length
    } failed, ${cancelPromises.length} cancelled, ${desired.size} active.`
  );

  for (const failure of failed) {
    console.log(
      `Medicine reminder failure detail: ${failure.identifier} (${failure.time})`,
      failure.error
    );
  }
}

// Sync state. `pending` always holds the newest list; the loop guarantees the
// latest data is reconciled even when requests arrive during an active sync.
let medicineSyncInFlight: Promise<void> | null = null;
let pendingMedicines: MedicineReminder[] | null = null;
let pendingPartial = false;

// Reconcile medicine reminders without blocking the UI. Safe to call on every
// screen load and after every save — unchanged doses are never recreated.
// Partial syncs (after saving scanned medicines) leave other medicines alone.
export function syncMedicineReminders(
  medicines: MedicineReminder[],
  options?: { partial?: boolean }
): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();

  pendingMedicines = medicines;
  pendingPartial = Boolean(options?.partial);

  if (medicineSyncInFlight) {
    return medicineSyncInFlight;
  }

  medicineSyncInFlight = (async () => {
    try {
      while (pendingMedicines) {
        const list = pendingMedicines;
        const partial = pendingPartial;
        pendingMedicines = null;
        pendingPartial = false;

        try {
          await reconcileMedicineReminders(list, partial);
        } catch (error) {
          console.log('Medicine reminder sync failed:', error);
        }
      }
    } finally {
      medicineSyncInFlight = null;
    }
  })();

  return medicineSyncInFlight;
}

// Cancel reminders belonging to a particular medicine.
export async function cancelMedicineRemindersForMedicine(
  medicineId: string
) {
  if (Platform.OS === 'web') {
    return;
  }

  const Notifications = await getNotifications();
  if (!Notifications) {
    return;
  }

  const scheduled =
    await Notifications.getAllScheduledNotificationsAsync();

  for (const notification of scheduled) {
    if (notification.content.data?.medicineId === medicineId) {
      await Notifications.cancelScheduledNotificationAsync(
        notification.identifier
      );
    }
  }
}

// ======================================================
// APPOINTMENT REMINDERS
// ======================================================

const MONTH_MAP: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

// Parse "11:50 PM", "08:30 AM", "23:50", etc. into 24-hour components.
// Shares the medicine parser so appointments accept the same 12-hour and
// 24-hour formats.
function parseAppointmentTime(time: string) {
  return parseMedicineTime(time);
}

// Build a Date and verify the components survived (guards against silent
// rollover such as 2026-13-40 becoming a valid but wrong date).
function buildAppointmentDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 0 || month > 11 ||
    day < 1 || day > 31
  ) {
    throw new Error('Invalid date components.');
  }

  const result = new Date(year, month, day, hour, minute, 0, 0);

  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month ||
    result.getDate() !== day ||
    result.getHours() !== hour ||
    result.getMinutes() !== minute
  ) {
    throw new Error('Invalid date.');
  }

  return result;
}

// Parse appointment date and time strings into a Date object.
// Supports: "14 October 2026" (extra whitespace tolerated), "2026-10-14",
// "14/10/2026", "14-10-2026", "10/14/2026", and ISO strings.
function parseAppointmentDateTime(date: string, time: string): Date {
  const { hour, minute } = parseAppointmentTime(time);

  // Normalize non-breaking spaces (some keyboards paste them) and collapse
  // repeated whitespace so "14 October  2026" is handled.
  const normalizedDate = date
    .trim()
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/\s+/g, ' ');

  // Look up a month name, tolerating abbreviations with a trailing period
  // ("Sept." / "Oct.").
  const lookupMonth = (token: string) =>
    MONTH_MAP[token.toLowerCase().replace(/\./g, '')];

  // Format 1a: "14 October 2026" / "14 Oct 2026" (optional trailing comma).
  const monthNameMatch = normalizedDate.match(
    /^(\d{1,2})\s+([A-Za-z.]+),?\s+(\d{4})$/
  );
  if (monthNameMatch) {
    const day = Number(monthNameMatch[1]);
    const month = lookupMonth(monthNameMatch[2]);
    const year = Number(monthNameMatch[3]);

    if (month === undefined) {
      throw new Error(`Invalid month in date: "${date}".`);
    }

    return buildAppointmentDate(year, month, day, hour, minute);
  }

  // Format 1b: "October 14, 2026" / "Oct. 14 2026" (month-first).
  const monthFirstMatch = normalizedDate.match(
    /^([A-Za-z.]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/
  );
  if (monthFirstMatch) {
    const month = lookupMonth(monthFirstMatch[1]);
    const day = Number(monthFirstMatch[2]);
    const year = Number(monthFirstMatch[3]);

    if (month === undefined) {
      throw new Error(`Invalid month in date: "${date}".`);
    }

    return buildAppointmentDate(year, month, day, hour, minute);
  }

  // Format 2: ISO "2026-10-14" or "2026-10-14T00:00:00.000Z".
  const isoMatch = normalizedDate.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/
  );
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1; // 0-indexed
    const day = Number(isoMatch[3]);
    return buildAppointmentDate(year, month, day, hour, minute);
  }

  // Format 3: "14/10/2026", "14-10-2026" (DD/MM) or "10/14/2026" (MM/DD).
  const slashMatch = normalizedDate.match(
    /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/
  );
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const year = Number(slashMatch[3]);

    let day: number;
    let month: number; // 0-indexed

    if (first > 12 && second <= 12) {
      // Unambiguously DD/MM/YYYY.
      day = first;
      month = second - 1;
    } else if (second > 12 && first <= 12) {
      // Unambiguously MM/DD/YYYY.
      day = second;
      month = first - 1;
    } else {
      // Ambiguous (both <= 12): default to day-first, matching the app's
      // existing behaviour and the "DD Month YYYY" placeholder.
      day = first;
      month = second - 1;
    }

    return buildAppointmentDate(year, month, day, hour, minute);
  }

  // Fallback: native parsing (e.g. full ISO strings with timezone offset).
  const fallback = new Date(normalizedDate);
  if (!isNaN(fallback.getTime())) {
    fallback.setHours(hour, minute, 0, 0);
    return fallback;
  }

  console.error('Failed to parse date:', date, 'time:', time);
  throw new Error(
    `Invalid date format: "${date}". Expected formats: "14 October 2026", "2026-10-14", or "14/10/2026".`
  );
}

// Exposed for testing/verification of the date parser.
export { parseAppointmentDateTime };

// Build the trigger date + stable fingerprint for an appointment reminder,
// or null when it should not be scheduled (disabled, not upcoming, past, or
// an unparseable date/time).
function buildAppointmentSpec(appointment: AppointmentReminder) {
  if (!appointment.reminder || appointment.status !== 'Upcoming') {
    return null;
  }

  let triggerDate: Date;
  try {
    triggerDate = parseAppointmentDateTime(appointment.date, appointment.time);
  } catch (error) {
    console.log('Skipping appointment reminder with invalid date/time:', error);
    return null;
  }

  if (triggerDate.getTime() <= Date.now()) {
    return null;
  }

  const title = `Appointment Reminder: ${appointment.doctor}`;
  const body = `${appointment.specialty} at ${appointment.hospital} — ${appointment.date} at ${appointment.time}`;

  return {
    identifier: buildReminderIdentifier('appt', appointment.id),
    appointmentId: appointment.id,
    reminderKey: `appointment::${appointment.id}`,
    fingerprint: JSON.stringify({
      date: appointment.date,
      time: appointment.time,
      title,
      body,
    }),
    triggerDate,
    title,
    body,
  };
}

type AppointmentSpec = NonNullable<ReturnType<typeof buildAppointmentSpec>>;

async function scheduleAppointmentSpec(spec: AppointmentSpec) {
  const Notifications = await getNotifications();
  if (!Notifications) {
    throw new Error('Notifications are not available in this environment.');
  }

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: spec.identifier,
      content: {
        title: spec.title,
        body: spec.body,
        data: {
          appointmentId: spec.appointmentId,
          reminderKey: spec.reminderKey,
          fingerprint: spec.fingerprint,
          type: 'appointment-reminder',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: spec.triggerDate,
        channelId:
          Platform.OS === 'android' ? APPOINTMENT_CHANNEL_ID : undefined,
      },
    });

    console.log(
      `Appointment reminder scheduled: ${spec.identifier} at ${spec.triggerDate.toISOString()}.`
    );

    return spec.identifier;
  } catch (error) {
    console.log(
      `Appointment reminder FAILED: ${spec.identifier} at ${spec.triggerDate.toISOString()}.`,
      error
    );
    throw error;
  }
}

// Schedule a one-time appointment reminder.
export async function scheduleAppointmentReminder(
  appointment: AppointmentReminder
) {
  if (Platform.OS === 'web') {
    return;
  }

  const Notifications = await getNotifications();
  if (!Notifications) {
    return;
  }

  const spec = buildAppointmentSpec(appointment);
  if (!spec) {
    return;
  }

  const granted = await ensureNotificationPermission();
  if (!granted) {
    console.log(
      'Notification permission not granted; skipping appointment reminder.'
    );
    return;
  }

  // Remove any existing reminder for this appointment.
  await cancelAppointmentRemindersForAppointment(appointment.id);

  const notificationId = await scheduleAppointmentSpec(spec);

  console.log('Appointment reminder scheduled:', notificationId);
  return notificationId;
}

// Cancel reminders belonging to a particular appointment.
export async function cancelAppointmentRemindersForAppointment(
  appointmentId: string
) {
  if (Platform.OS === 'web') {
    return;
  }

  const Notifications = await getNotifications();
  if (!Notifications) {
    return;
  }

  const scheduled =
    await Notifications.getAllScheduledNotificationsAsync();

  for (const notification of scheduled) {
    if (notification.content.data?.appointmentId === appointmentId) {
      await Notifications.cancelScheduledNotificationAsync(
        notification.identifier
      );
    }
  }
}

// Replace (cancel old + schedule new) appointment reminder.
// Safe to call on every load/edit to avoid duplicates.
export async function replaceAppointmentReminder(
  appointment: AppointmentReminder
) {
  await cancelAppointmentRemindersForAppointment(appointment.id);
  await scheduleAppointmentReminder(appointment);
}

// Reconcile all appointment reminders against one list. Unchanged reminders
// are left untouched, removed/edited ones are updated, and stale reminders
// from older app versions are cancelled.
async function reconcileAppointmentReminders(
  appointments: AppointmentReminder[]
) {
  const Notifications = await getNotifications();
  if (!Notifications) {
    console.log(
      '[notifications] Reminders are disabled in Expo Go on Android; skipping appointment reminder sync.'
    );
    return;
  }

  const granted = await ensureNotificationPermission();
  if (!granted) {
    console.log(
      'Notification permission not granted; skipping appointment reminders.'
    );
    return;
  }

  const desired = new Map<string, AppointmentSpec>();
  for (const appointment of appointments) {
    const spec = buildAppointmentSpec(appointment);
    if (spec) desired.set(spec.identifier, spec);
  }

  console.log(
    `Appointment reminders: ${desired.size} wanted across ${appointments.length} appointment(s).`
  );

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  const existing = new Map<string, { fingerprint: string }>();
  const legacyIdentifiers: string[] = [];

  for (const notification of scheduled) {
    const data = notification.content?.data || {};
    if (data.type !== 'appointment-reminder') continue;

    const key = typeof data.reminderKey === 'string' ? data.reminderKey : null;

    if (!key) {
      legacyIdentifiers.push(notification.identifier);
      continue;
    }

    existing.set(notification.identifier, {
      fingerprint: typeof data.fingerprint === 'string' ? data.fingerprint : '',
    });
  }

  const cancelPromises: Promise<void>[] = [];

  for (const identifier of legacyIdentifiers) {
    cancelPromises.push(
      Notifications.cancelScheduledNotificationAsync(identifier)
    );
  }

  for (const [identifier, entry] of existing) {
    const wanted = desired.get(identifier);
    if (!wanted || wanted.fingerprint !== entry.fingerprint) {
      cancelPromises.push(
        Notifications.cancelScheduledNotificationAsync(identifier)
      );
    }
  }

  await Promise.all(cancelPromises);

  const schedulePromises: Promise<string>[] = [];
  for (const [identifier, spec] of desired) {
    const entry = existing.get(identifier);
    if (entry && entry.fingerprint === spec.fingerprint) continue;
    schedulePromises.push(scheduleAppointmentSpec(spec));
  }

  const results = await Promise.allSettled(schedulePromises);
  const failed = results.filter((result) => result.status === 'rejected');

  console.log(
    `Appointment reminders synced: ${results.length - failed.length} scheduled, ${
      failed.length
    } failed, ${cancelPromises.length} cancelled, ${desired.size} active.`
  );
}

let appointmentSyncInFlight: Promise<void> | null = null;
let pendingAppointments: AppointmentReminder[] | null = null;

// Reconcile appointment reminders without blocking the UI. Safe to call on
// every screen load; unchanged reminders are never recreated.
export function syncAppointmentReminders(
  appointments: AppointmentReminder[]
): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();

  pendingAppointments = appointments;

  if (appointmentSyncInFlight) {
    return appointmentSyncInFlight;
  }

  appointmentSyncInFlight = (async () => {
    try {
      while (pendingAppointments) {
        const list = pendingAppointments;
        pendingAppointments = null;

        try {
          await reconcileAppointmentReminders(list);
        } catch (error) {
          console.log('Appointment reminder sync failed:', error);
        }
      }
    } finally {
      appointmentSyncInFlight = null;
    }
  })();

  return appointmentSyncInFlight;
}

// Diagnostic helper: list the reminders currently scheduled on the device.
// Handy for verifying that saving a medicine/appointment actually scheduled
// something (log the result from any screen).
export async function getScheduledReminders() {
  if (Platform.OS === 'web') return [];

  const Notifications = await getNotifications();
  if (!Notifications) return [];

  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  return scheduled
    .filter((notification) => {
      const type = notification.content?.data?.type;
      return type === 'medicine-reminder' || type === 'appointment-reminder';
    })
    .map((notification) => ({
      id: notification.identifier,
      type: notification.content?.data?.type as string,
      key: (notification.content?.data?.reminderKey as string) || null,
      title: notification.content?.title || '',
      trigger: notification.trigger,
    }));
}