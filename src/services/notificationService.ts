import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

interface MedicineReminder {
  _id: string;
  name: string;
  dosage: string;
  timing?: string;
  time: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
}

// Display notifications while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Convert "8:00 AM" into 24-hour time.
function parseMedicineTime(time: string) {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

  if (!match) {
    throw new Error('Invalid time. Use a format such as 8:00 AM.');
  }

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3].toUpperCase();

  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) {
    throw new Error('Invalid medicine reminder time.');
  }

  if (period === 'AM' && hour === 12) {
    hour = 0;
  } else if (period === 'PM' && hour !== 12) {
    hour += 12;
  }

  return { hour, minute };
}

// Schedule a daily medicine reminder.
export async function replaceMedicineReminder(
  medicine: MedicineReminder
) {
  // Notifications are unavailable on web in this implementation.
  if (Platform.OS === 'web') {
    return;
  }

  // Request notification permission.
  let permission = await Notifications.getPermissionsAsync();

  if (!permission.granted) {
    permission = await Notifications.requestPermissionsAsync();
  }

  if (!permission.granted) {
    console.log('Please allow notifications in Android settings.');
    return;
  }

  // Create the Android notification channel.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(
      'medicine-reminders',
      {
        name: 'Medicine Reminders',
        importance: Notifications.AndroidImportance.MAX,
        enableVibrate: true,
        // sound: 'default',
      }
    );
  }

  // Remove the previous reminder for this medicine.
  await cancelMedicineRemindersForMedicine(medicine._id);

  const { hour, minute } = parseMedicineTime(medicine.time);

  // Schedule the reminder every day at the selected time.
  const notificationId =
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Medicine Reminder: ${medicine.name}`,
        body: `Time to take ${medicine.dosage}${
          medicine.timing ? ` — ${medicine.timing}` : ''
        }.`,
        sound: true,
        data: {
          medicineId: medicine._id,
          type: 'medicine-reminder',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId:
          Platform.OS === 'android'
            ? 'medicine-reminders'
            : undefined,
      },
    });

  console.log('Medicine reminder scheduled:', notificationId);

  return notificationId;
}

// Cancel reminders belonging to a particular medicine.
export async function cancelMedicineRemindersForMedicine(
  medicineId: string
) {
  if (Platform.OS === 'web') {
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