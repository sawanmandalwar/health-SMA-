import React from 'react';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
} from 'react-native';

import { Image } from 'expo-image';

import { Ionicons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useResponsiveDimensions } from '../hooks/useResponsiveDimensions';

import { useHeaderUser } from '../hooks/useHeaderUser';

import {
  useHeaderNotifications,
  type HeaderNotification,
} from '../hooks/useHeaderNotifications';

// ============================================================
// AppHeader — the one top header used on every screen.
// ============================================================
// Left:  "Welcome back, <name>" (single line, never overlaps).
// Right: notification bell with unread badge + dropdown, and the
//        profile avatar (photo or initials) linking to /profile.
//
// The header has a fixed height on every screen size, and the avatar
// keeps a fixed container size whether it shows a photo or initials,
// so nothing shifts or flickers when data loads.
// ============================================================

const COLORS = {
  white: '#FFFFFF',
  mainText: '#1D2B33',
  secondaryText: '#71858D',
  border: '#D2E3E8',
  lightBlue: '#E7F2FA',
  primaryBlue: '#1E76B6',
  primaryGreen: '#39A78D',
  dangerRed: '#E2574C',
};

export default function AppHeader() {
  const router = useRouter();

  const { width } = useResponsiveDimensions();

  const insets = useSafeAreaInsets();

  const isMobile = width < 600;

  const { userPhoto, displayName, avatarLetter } = useHeaderUser();

  const {
    notificationsOpen,
    setNotificationsOpen,
    notifications,
    unreadCount,
    notificationsLoading,
    notificationsError,
    fetchNotifications,
    markNotificationRead,
  } = useHeaderNotifications();

  const dropdownWidth = Math.min(360, width - 32);

  const styles = createStyles(isMobile);

  return (
    <View style={styles.header}>
      {/* WELCOME TEXT (flex 1 + single line: no overlap with icons) */}
      <Text style={styles.welcome} numberOfLines={1}>
        Welcome back, {displayName}
      </Text>

      <View style={styles.headerRight}>
        {/* NOTIFICATION BELL + UNREAD BADGE */}
        <Pressable
          onPress={() => setNotificationsOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
          style={styles.bellButton}
        >
          <Ionicons
            name="notifications-outline"
            size={isMobile ? 22 : 24}
            color={COLORS.mainText}
          />

          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
        </Pressable>

        {/* NOTIFICATIONS DROPDOWN — rendered through a transparent Modal
            so it always sits above the screen content on every platform
            (an absolutely positioned dropdown gets buried under later
            siblings like the profile ScrollView on Android). Tapping
            outside the panel closes it. */}
        <Modal
          transparent
          visible={notificationsOpen}
          animationType="fade"
          onRequestClose={() => setNotificationsOpen(false)}
        >
          {/* Dismiss layer: anywhere outside the panel closes the dropdown. */}
          <Pressable
            style={styles.dropdownBackdrop}
            onPress={() => setNotificationsOpen(false)}
          />

          <View
            style={[
              styles.notificationDropdown,
              {
                width: dropdownWidth,
                top: insets.top + (isMobile ? 54 : 62),
                right: isMobile ? 12 : 20,
              },
            ]}
          >
            <View style={styles.notificationDropdownHeader}>
              <Text style={styles.notificationDropdownTitle}>
                Notifications
              </Text>

              <Pressable onPress={() => setNotificationsOpen(false)}>
                <Ionicons
                  name="close"
                  size={20}
                  color={COLORS.secondaryText}
                />
              </Pressable>
            </View>

            {notificationsLoading ? (
              <View style={styles.notificationEmptyState}>
                <Text style={styles.notificationEmptyText}>
                  Loading notifications...
                </Text>
              </View>
            ) : notificationsError ? (
              <View style={styles.notificationEmptyState}>
                <Ionicons
                  name="alert-circle-outline"
                  size={28}
                  color={COLORS.dangerRed}
                />
                <Text style={styles.notificationEmptyText}>
                  {notificationsError}
                </Text>
                <Pressable
                  onPress={fetchNotifications}
                  style={styles.notificationRetryButton}
                >
                  <Text style={styles.notificationRetryText}>Try again</Text>
                </Pressable>
              </View>
            ) : notifications.length === 0 ? (
              <View style={styles.notificationEmptyState}>
                <Ionicons
                  name="notifications-outline"
                  size={30}
                  color={COLORS.secondaryText}
                />
                <Text style={styles.notificationEmptyTitle}>
                  No notifications yet
                </Text>
                <Text style={styles.notificationEmptyText}>
                  Medicine and appointment notifications will appear here.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.notificationList} nestedScrollEnabled>
                {notifications.map((item) => (
                  <NotificationRow
                    key={item._id}
                    item={item}
                    onPress={() =>
                      !item.isRead && markNotificationRead(item._id)
                    }
                  />
                ))}
              </ScrollView>
            )}
          </View>
        </Modal>

        {/* PROFILE AVATAR (fixed-size container: photo or initials) */}
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          style={styles.avatar}
        >
          {userPhoto ? (
            <Image
              source={{ uri: userPhoto }}
              style={styles.avatarPhoto}
              contentFit="cover"
              transition={120}
              recyclingKey={userPhoto}
            />
          ) : (
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function NotificationRow({
  item,
  onPress,
}: {
  item: HeaderNotification;
  onPress: () => void;
}) {
  const icon =
    item.type === 'Medicine'
      ? 'medical-outline'
      : item.type === 'Appointment'
      ? 'calendar-outline'
      : 'information-circle-outline';

  const iconColor =
    item.type === 'Appointment' ? COLORS.primaryGreen : COLORS.primaryBlue;

  return (
    <Pressable
      onPress={onPress}
      style={[styles2.notificationItem, !item.isRead && styles2.notificationUnread]}
    >
      <View style={styles2.notificationItemIcon}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>

      <View style={styles2.notificationItemContent}>
        <View style={styles2.notificationItemTitleRow}>
          <Text style={styles2.notificationItemTitle}>{item.title}</Text>

          {!item.isRead && <View style={styles2.notificationUnreadDot} />}
        </View>

        <Text style={styles2.notificationItemMessage}>{item.message}</Text>

        <Text style={styles2.notificationItemDate}>
          {new Date(item.createdAt).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>

        {!item.isRead && (
          <Text style={styles2.notificationMarkRead}>
            Tap to mark as read
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// Static styles for notification rows (size-independent).
const styles2 = StyleSheet.create({
  notificationItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 10,
    gap: 10,
  },

  notificationUnread: {
    backgroundColor: '#F1F8FC',
  },

  notificationItemIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },

  notificationItemContent: {
    flex: 1,
    gap: 3,
  },

  notificationItemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  notificationItemTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: COLORS.mainText,
    flexShrink: 1,
  },

  notificationUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primaryBlue,
  },

  notificationItemMessage: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: COLORS.secondaryText,
  },

  notificationItemDate: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: COLORS.secondaryText,
  },

  notificationMarkRead: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: COLORS.primaryBlue,
  },
});

// Responsive header styles: one scale for phones, one for larger screens.
const createStyles = (isMobile: boolean) =>
  StyleSheet.create({
    header: {
      height: isMobile ? 58 : 66,

      backgroundColor: COLORS.white,

      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,

      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',

      paddingHorizontal: isMobile ? 16 : 24,

      position: 'relative',

      zIndex: 9999,
    },

    welcome: {
      flex: 1,
      minWidth: 0,

      fontFamily: 'Inter_500Medium',
      fontSize: isMobile ? 15 : 17,

      color: COLORS.secondaryText,

      marginRight: 8,
    },

    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isMobile ? 8 : 12,
    },

    bellButton: {
      width: isMobile ? 38 : 42,
      height: isMobile ? 38 : 42,

      alignItems: 'center',
      justifyContent: 'center',
    },

    notificationBadge: {
      position: 'absolute',
      top: 2,
      right: 0,

      minWidth: 18,
      height: 18,
      borderRadius: 9,

      backgroundColor: COLORS.dangerRed,

      alignItems: 'center',
      justifyContent: 'center',

      paddingHorizontal: 4,
    },

    notificationBadgeText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10,
      lineHeight: 12,

      color: COLORS.white,
    },

    dropdownBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(20, 40, 50, 0.25)',
    },

    notificationDropdown: {
      position: 'absolute',

      maxHeight: 420,

      backgroundColor: COLORS.white,

      borderRadius: 14,

      borderWidth: 1,
      borderColor: COLORS.border,

      padding: 12,

      zIndex: 99999,

      elevation: 20,

      shadowColor: '#000',
      shadowOpacity: 0.12,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
    },

    notificationDropdownHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',

      paddingBottom: 10,

      borderBottomWidth: 1,
      borderBottomColor: COLORS.border,

      marginBottom: 6,
    },

    notificationDropdownTitle: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: 15,

      color: COLORS.mainText,
    },

    notificationEmptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,

      paddingVertical: 26,
      paddingHorizontal: 10,
    },

    notificationEmptyTitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,

      color: COLORS.mainText,

      textAlign: 'center',
    },

    notificationEmptyText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,

      color: COLORS.secondaryText,

      textAlign: 'center',
    },

    notificationRetryButton: {
      marginTop: 6,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 8,
      backgroundColor: COLORS.lightBlue,
    },

    notificationRetryText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: COLORS.primaryBlue,
    },

    notificationList: {
      flexGrow: 0,
    },

    avatar: {
      width: isMobile ? 38 : 44,
      height: isMobile ? 38 : 44,

      borderRadius: isMobile ? 19 : 22,

      backgroundColor: COLORS.primaryBlue,

      alignItems: 'center',
      justifyContent: 'center',

      overflow: 'hidden',
    },

    avatarPhoto: {
      width: '100%',
      height: '100%',
    },

    avatarText: {
      fontFamily: 'Poppins_600SemiBold',
      fontSize: isMobile ? 15 : 18,

      color: COLORS.white,
    },
  });
