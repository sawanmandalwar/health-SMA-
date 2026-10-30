import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { usePathname } from 'expo-router';

import { apiFetch, parseJson } from '../services/api';

// ============================================================
// NotificationsProvider — one shared notification store for the
// whole app.
// ============================================================
// Previously every screen rendered its own <AppHeader/>, so each had
// its own notification state and fetched independently. Switching
// screens started from an empty list and could race with the server's
// notification sync, which is why the bell sometimes appeared empty on
// the medicines and appointments screens. A single provider keeps one
// list, one unread count and one in-flight request that every screen
// shares, and refreshes it whenever the route changes.
// ============================================================

export type HeaderNotification = {
  _id: string;
  title: string;
  message: string;
  type: 'Medicine' | 'Appointment' | 'General' | string;
  isRead: boolean;
  createdAt: string;
};

type NotificationsContextValue = {
  notifications: HeaderNotification[];
  unreadCount: number;
  notificationsLoading: boolean;
  notificationsError: string;
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
};

const NotificationsContext =
  createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);

  const [unreadCount, setUnreadCount] = useState(0);

  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const [notificationsError, setNotificationsError] = useState('');

  const pathname = usePathname();

  // One request at a time. Concurrent fetches made the server's sync run in
  // parallel, which could briefly return an empty list.
  const inFlightRef = useRef<Promise<void> | null>(null);

  const fetchNotifications = useCallback((): Promise<void> => {
    if (inFlightRef.current) {
      return inFlightRef.current;
    }

    const run = (async () => {
      setNotificationsLoading(true);
      setNotificationsError('');

      try {
        const token = await AsyncStorage.getItem('authToken');

        if (!token) {
          setNotificationsError('Please log in again to view notifications.');
          setNotifications([]);
          setUnreadCount(0);
          return;
        }

        const response = await apiFetch(`/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await parseJson(response);

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Could not load notifications.');
        }

        const nextNotifications: HeaderNotification[] = Array.isArray(
          data.notifications,
        )
          ? data.notifications
          : [];

        setNotifications(nextNotifications);
        setUnreadCount(
          typeof data.unreadCount === 'number'
            ? data.unreadCount
            : nextNotifications.filter((item) => !item.isRead).length,
        );
      } catch (error) {
        // Keep the last good list visible instead of wiping the bell.
        console.log('Fetch notifications failed:', error);
        setNotificationsError(
          'Could not load notifications. Check that the backend is running.',
        );
      } finally {
        setNotificationsLoading(false);
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = run;

    return run;
  }, []);

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      const target = notifications.find((item) => item._id === notificationId);

      if (target && target.isRead) return;

      try {
        const token = await AsyncStorage.getItem('authToken');

        if (!token) {
          setNotificationsError(
            'Please log in again to update notifications.',
          );
          return;
        }

        // Optimistically update so tapping responds immediately.
        setNotifications((current) =>
          current.map((item) =>
            item._id === notificationId ? { ...item, isRead: true } : item,
          ),
        );
        setUnreadCount((current) => Math.max(0, current - 1));

        const response = await apiFetch(
          `/api/notifications/${notificationId}/read`,
          {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        const data = await parseJson(response);

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Could not update notification.');
        }
      } catch (error) {
        console.log('Mark notification read failed:', error);
        setNotificationsError(
          'Could not update this notification. Please try again.',
        );
        // Reconcile with the server after a failure.
        void fetchNotifications();
      }
    },
    [notifications, fetchNotifications],
  );

  const deleteNotification = useCallback(
    async (notificationId: string) => {
      const target = notifications.find((item) => item._id === notificationId);

      try {
        const token = await AsyncStorage.getItem('authToken');

        if (!token) {
          setNotificationsError(
            'Please log in again to update notifications.',
          );
          return;
        }

        setNotifications((current) =>
          current.filter((item) => item._id !== notificationId),
        );

        if (target && !target.isRead) {
          setUnreadCount((current) => Math.max(0, current - 1));
        }

        const response = await apiFetch(
          `/api/notifications/${notificationId}`,
          {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          },
        );

        const data = await parseJson(response);

        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Could not delete notification.');
        }
      } catch (error) {
        console.log('Delete notification failed:', error);
        setNotificationsError(
          'Could not delete this notification. Please try again.',
        );
        void fetchNotifications();
      }
    },
    [notifications, fetchNotifications],
  );

  // Refresh on mount and every time the route changes.
  useEffect(() => {
    void fetchNotifications();
  }, [fetchNotifications, pathname]);

  const value: NotificationsContextValue = {
    notifications,
    unreadCount,
    notificationsLoading,
    notificationsError,
    fetchNotifications,
    markNotificationRead,
    deleteNotification,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useHeaderNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error(
      'useHeaderNotifications must be used inside a NotificationsProvider.',
    );
  }

  return context;
}
