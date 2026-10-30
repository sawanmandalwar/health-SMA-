// The notification bell state is shared across every screen, so the hook now
// reads from the app-wide NotificationsProvider (see _layout.tsx). This file
// stays as the stable import path used by AppHeader.
export {
  NotificationsProvider,
  useHeaderNotifications,
  type HeaderNotification,
} from '../context/notifications-context';
