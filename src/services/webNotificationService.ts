export async function requestWebNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.log('Browser notifications are not supported.');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    console.log('Notifications are blocked in browser settings.');
    return false;
  }

  const permission = await Notification.requestPermission();

  return permission === 'granted';
}

export async function scheduleWebMedicineReminder(
  medicineName: string,
  dosage: string,
  timeInSeconds: number = 60
) {
  const permission = await requestWebNotificationPermission();

  if (!permission) {
    return false;
  }

  if (timeInSeconds < 0) {
    throw new Error('Reminder delay cannot be negative.');
  }

  setTimeout(() => {
    new Notification(`Medicine Reminder: ${medicineName}`, {
      body: `Time to take ${dosage}.`,
      icon: '/favicon.ico',
    });
  }, timeInSeconds * 1000);

  return true;
}