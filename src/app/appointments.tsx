import React, { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useResponsiveDimensions } from '../hooks/useResponsiveDimensions';

import { Ionicons } from '@expo/vector-icons';

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
} from '@expo-google-fonts/poppins';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { useFonts } from 'expo-font';

import { useRouter } from 'expo-router';

import {
  replaceAppointmentReminder,
  cancelAppointmentRemindersForAppointment,
  syncAppointmentReminders,
  requestNotificationPermission,
  isValidMedicineTime,
  parseAppointmentDateTime,
} from '../services/notificationService';
import { apiFetch, parseJson } from '../services/api';

import AppHeader from '../components/AppHeader';
import WebDateTimeInput from '../components/web-date-time-input';

import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';

// The native date/time picker only ships for iOS/Android. On web the raw
// import would fail with "TurboModuleRegistry.getEnforcing(...)", so the
// module is required lazily and the form falls back to text inputs.
type NativeDateTimePickerProps = {
  value: Date;
  mode: 'date' | 'time';
  display?: 'default' | 'spinner';
  is24Hour?: boolean;
  maximumDate?: Date;
  onChange: (event: DateTimePickerEvent, selected?: Date) => void;
};

let NativeDateTimePicker: React.ComponentType<NativeDateTimePickerProps> | null =
  null;

if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  NativeDateTimePicker = require('@react-native-community/datetimepicker')
    .default as React.ComponentType<NativeDateTimePickerProps>;
}

const isDateTimePickerSupported = NativeDateTimePicker !== null;

// ====================================================
// DYNAMIC BADGE HELPERS (module scope, no per-render cost)
// ====================================================

// Resolve an appointment's Date; returns null when the stored
// text cannot be understood (never throws).
function getAppointmentDateTime(
  appointment: Appointment
): Date | null {
  try {
    return parseAppointmentDateTime(
      appointment.date,
      appointment.time
    );
  } catch {
    return null;
  }
}

// Whole calendar days between today and the appointment ("14 October
// 2026" vs now, both in device-local time).
function getCalendarDayOffset(target: Date): number {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const targetStart = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate()
  ).getTime();

  return Math.round(
    (targetStart - todayStart) / (24 * 60 * 60 * 1000)
  );
}

function getUpcomingBadgeText(offset: number): string {
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  if (offset <= 0) return ''; // passed during the current day
  if (offset <= 6) return `In ${offset} days`;
  if (offset <= 31) return `In ${Math.round(offset / 7)} weeks`;

  const months = Math.round(offset / 30);

  return months === 1 ? 'In 1 month' : `In ${months} months`;
}

// Date formats accepted by the backend: "14 October 2026",
// "10:00 AM". The pickers below always produce these shapes.
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_NAME_MAP: Record<string, number> = MONTH_NAMES.reduce(
  (map, month, index) => {
    map[month.toLowerCase()] = index + 1;
    map[month.toLowerCase().slice(0, 3)] = index + 1;
    return map;
  },
  {} as Record<string, number>
);

function formatPickerDate(value: Date): string {
  return `${value.getDate()} ${MONTH_NAMES[value.getMonth()]} ${value.getFullYear()}`;
}

function formatPickerTime(value: Date): string {
  let hours = value.getHours();
  const minutes = value.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';

  hours = hours % 12;

  if (hours === 0) {
    hours = 12;
  }

  const minuteText =
    minutes < 10 ? `0${minutes}` : String(minutes);

  return `${hours}:${minuteText} ${period}`;
}

// Parse existing appointment strings ("14 October 2026",
// "2026-10-14", "14/10/2026") back into a Date for the picker.
// Falls back to now when nothing can be understood.
function parsePickerDate(value: string): Date {
  const text = String(value || '').trim();

  if (!text) return new Date();

  const named = text.match(
    /^(\d{1,2})\s+([A-Za-z.]+),?\s+(\d{4})$/
  );

  if (named) {
    const month = MONTH_NAME_MAP[named[2].toLowerCase().replace(/\./g, '')];

    if (month) {
      const parsed = new Date(Number(named[3]), month - 1, Number(named[1]));
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (iso) {
    const parsed = new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3])
    );
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const numeric = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    const parsed = new Date(
      Number(numeric[3]),
      Number(numeric[2]) - 1,
      Number(numeric[1])
    );
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

// Parse "10:00 AM" / "20:30" into a Date used for the time picker.
function parsePickerTime(value: string): Date {
  const today = new Date();
  const text = String(value || '').trim();

  const twelveHour = text.match(
    /^(\d{1,2}):(\d{2})\s*([AaPp])\.?\s?[Mm]\.?$/
  );

  if (twelveHour) {
    let hours = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2]);
    const period = twelveHour[3].toUpperCase();

    if (period === 'A' && hours === 12) hours = 0;
    else if (period === 'P' && hours !== 12) hours += 12;

    today.setHours(hours, minutes, 0, 0);
    return today;
  }

  const twentyFour = text.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFour) {
    today.setHours(Number(twentyFour[1]), Number(twentyFour[2]), 0, 0);
    return today;
  }

  today.setHours(10, 0, 0, 0);
  return today;
}


// ====================================================
// COLORS
// ====================================================

const COLORS = {
  primaryBlue: '#1E76B6',
  darkBlue: '#155A8C',

  primaryGreen: '#39A78D',

  lightBlue: '#E7F2FA',
  lightGreen: '#E5F7F1',

  dangerRed: '#E2574C',

  background: '#EAF3F5',

  white: '#FFFFFF',

  mainText: '#1D2B33',
  secondaryText: '#71858D',

  border: '#D2E3E8',

  upcomingBg: '#D7EEFB',
  upcomingText: '#087DBE',

  previousBg: '#E5EDEF',
  previousText: '#71858D',
};


// ====================================================
// TYPES
// ====================================================

type Appointment = {
  id: string;

  doctor: string;

  specialty: string;

  hospital: string;

  date: string;

  time: string;

  reason: string;

  reminder: boolean;

  status: 'Upcoming' | 'Previous';

  // Shared by every time slot created from one "Add" submission; lets the
  // edit modal manage the whole set of timings for the same visit.
  groupId?: string | null;
};


// ====================================================
// BOTTOM TAB (module scope so it is not recreated on render)
// ====================================================

function BottomTab({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;

  label: string;

  active?: boolean;

  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.bottomTab,

        active &&
          styles.bottomTabActive,
      ]}
    >

      <Ionicons
        name={icon}
        size={23}
        color={
          active
            ? COLORS.primaryBlue
            : COLORS.secondaryText
        }
      />

      <Text
        style={[
          styles.bottomTabText,

          active &&
            styles.bottomTabTextActive,
        ]}
      >
        {label}
      </Text>

    </Pressable>
  );
}


// ====================================================
// SCREEN
// ====================================================

export default function AppointmentsScreen() {
  const router = useRouter();

  const { width } = useResponsiveDimensions();

  const isMobile = width < 600;

  const isTablet =
    width >= 600 && width < 900;

  const isDesktop = width >= 900;


  // ==================================================
  // FONTS
  // ==================================================

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,

    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });


  // ==================================================
  // APPOINTMENT STATE
  // ==================================================
const [appointments, setAppointments] =
  useState<Appointment[]>([]);


  // ==================================================
  // TAB
  // ==================================================

  const [activeTab, setActiveTab] =
    useState<'Upcoming' | 'Previous'>(
      'Upcoming'
    );


  // ==================================================
  // MODAL
  // ==================================================

  const [modalVisible, setModalVisible] =
    useState(false);

  const [editingId, setEditingId] =
    useState<string | null>(null);


  // ==================================================
  // FORM
  // ==================================================

  const [doctor, setDoctor] = useState('');

  const [specialty, setSpecialty] =
    useState('');

  const [hospital, setHospital] =
    useState('');

  const [date, setDate] =
    useState('');

  // Multiple visit times per appointment (same doctor, same day).
  const [timeSlots, setTimeSlots] = useState<
    { id: string; time: string }[]
  >([{ id: '', time: '' }]);

  // Native date/time pickers (mirrored per-open state).
  const [showDatePicker, setShowDatePicker] =
    useState(false);

  const [timePickerSlotIndex, setTimePickerSlotIndex] =
    useState<number | null>(null);

  const [reason, setReason] =
    useState('');

  const [reminder, setReminder] =
    useState(true);


  // ==================================================
  // TOAST
  // ==================================================

  const [toastVisible, setToastVisible] =
    useState(false);

  const [toastMessage, setToastMessage] =
    useState('');


  // ==================================================
  // TOAST FUNCTION
  // ==================================================

  const showToast = useCallback(
    (message: string) => {
      setToastMessage(message);

      setToastVisible(true);
    },
    []
  );


  // ==================================================
  // LOAD APPOINTMENTS FROM BACKEND
  // ==================================================

  const loadAppointments = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        showToast('Please login again');
        router.replace('/');
        return;
      }

      const response = await apiFetch(
        `/api/appointments`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(
          data.message || 'Unable to load appointments'
        );
      }

      const serverAppointments: Appointment[] =
        (data.appointments || []).map((item: any) => ({
          id: item._id,
          doctor: item.doctor,
          specialty: item.specialty,
          hospital: item.hospital,
          date: item.date,
          time: item.time,
          reason: item.reason,
          reminder: item.reminder,
          status: item.status,
          groupId: item.groupId || null,
        }));

      setAppointments(serverAppointments);

      // Reconcile reminders in the background; unchanged ones are not recreated
      // and this never blocks rendering the appointment list.
      void syncAppointmentReminders(serverAppointments);
    } catch (error) {
      console.log('Appointment loading error:', error);
      showToast('Unable to load appointments');
    }
  }, [router, showToast]);


  useEffect(() => {
    if (!toastVisible) return;

    const timer = setTimeout(() => {
      setToastVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [toastVisible]);


  useEffect(() => {
    (async () => {
      await loadAppointments();
    })();
  }, [loadAppointments]);


  // ==================================================
  // OPEN ADD
  // ==================================================

  const openAddAppointment = () => {
    setEditingId(null);

    setDoctor('');

    setSpecialty('');

    setHospital('');

    setDate('');

    setTimeSlots([{ id: '', time: '' }]);

    setReason('');

    setReminder(true);

    setShowDatePicker(false);
    setTimePickerSlotIndex(null);

    setModalVisible(true);
  };


  // ==================================================
  // OPEN EDIT
  // ==================================================

  const openEditAppointment = (
    appointment: Appointment
  ) => {
    setEditingId(appointment.id);

    setDoctor(appointment.doctor);

    setSpecialty(
      appointment.specialty
    );

    setHospital(
      appointment.hospital
    );

    setDate(appointment.date);

    // Prefill every time slot of the same visit (all documents created
    // together share a groupId), sorted by time of day.
    const groupMembers = appointment.groupId
      ? appointments.filter(
          (item) =>
            item.groupId === appointment.groupId &&
            item.id !== appointment.id
        )
      : [];

    const sortKey = (value: string) => {
      const parsed = parsePickerTime(value);
      return parsed.getHours() * 60 + parsed.getMinutes();
    };

    const slots = [
      { time: appointment.time },
      ...groupMembers.map((item) => ({ time: item.time })),
    ].sort((a, b) => sortKey(a.time) - sortKey(b.time));

    setTimeSlots(
      slots.map((slot, index) => ({
        id: index === 0 ? appointment.id : '',
        time: slot.time,
      }))
    );

    setReason(appointment.reason);

    setReminder(
      appointment.reminder
    );

    setShowDatePicker(false);
    setTimePickerSlotIndex(null);

    setModalVisible(true);
  };


  // ==================================================
  // TIME SLOT ROWS
  // ==================================================

  const addTimeSlotRow = () => {
    setTimeSlots((rows) => [...rows, { id: '', time: '' }]);
  };

  const removeTimeSlotRow = (index: number) => {
    setTimeSlots((rows) =>
      rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)
    );
  };

  // Web fallback: type the time manually (e.g. "10:00 AM").
  const updateTimeSlotRow = (index: number, value: string) => {
    setTimeSlots((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, time: value } : row
      )
    );
  };


  // ==================================================
  // DATE / TIME PICKERS
  // ==================================================

  const toggleDatePicker = () => {
    setShowDatePicker((visible) => !visible);
  };

  const handleDateSelected = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    setShowDatePicker(false);

    if (event.type === 'dismissed' || !selected) {
      return;
    }

    setDate(formatPickerDate(selected));
  };

  const openTimePicker = (index: number) => {
    setTimePickerSlotIndex((current) =>
      current === index ? null : index
    );
  };

  const handleTimeSelected = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    setTimePickerSlotIndex(null);

    if (event.type === 'dismissed' || !selected) {
      return;
    }

    const index = timePickerSlotIndex;

    if (index === null) {
      return;
    }

    setTimeSlots((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, time: formatPickerTime(selected) }
          : row
      )
    );
  };


  // ==================================================
  // SAVE APPOINTMENT
  // ==================================================

  const saveAppointment = async () => {
    if (!doctor.trim()) {
      showToast('Please enter doctor name');
      return;
    }

    if (!specialty.trim()) {
      showToast('Please enter specialty');
      return;
    }

    if (!hospital.trim()) {
      showToast('Please enter hospital or clinic');
      return;
    }

    if (!date.trim()) {
      showToast('Please enter appointment date');
      return;
    }

    const filledSlots = timeSlots
      .map((row) => row.time.trim())
      .filter(Boolean);

    if (filledSlots.length === 0) {
      showToast('Please enter an appointment time');
      return;
    }

    if (filledSlots.some((slot) => !isValidMedicineTime(slot))) {
      showToast('Invalid time. Use a format such as 10:00 AM.');
      return;
    }

    if (!reason.trim()) {
      showToast('Please enter reason for visit');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        showToast('Please login again');
        router.replace('/');
        return;
      }

      const appointmentData = {
        doctor: doctor.trim(),
        specialty: specialty.trim(),
        hospital: hospital.trim(),
        date: date.trim(),
        time: filledSlots[0],
        times: filledSlots,
        reason: reason.trim(),
        reminder,
      };

      // ================================================
      // EDIT APPOINTMENT
      // ================================================

      if (editingId) {
        const response = await apiFetch(
          `/api/appointments/${editingId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(appointmentData),
          }
        );

        const data = await parseJson(response);

        if (!response.ok) {
          throw new Error(
            data.message || 'Unable to update appointment'
          );
        }

        // Schedule/update reminders for the whole updated visit (the
        // edited slot plus any extra timings created by this edit).
        const updatedAppointments =
          Array.isArray(data.appointments) && data.appointments.length > 0
            ? data.appointments
            : data.appointment
            ? [data.appointment]
            : [];

        if (updatedAppointments.length > 0) {
          const reminderAllowed = await requestNotificationPermission();

          try {
            for (const updated of updatedAppointments) {
              await replaceAppointmentReminder({
                id: updated._id,
                doctor: updated.doctor,
                specialty: updated.specialty,
                hospital: updated.hospital,
                date: updated.date,
                time: updated.time,
                reminder: updated.reminder,
                status: updated.status,
              });
            }
          } catch (reminderError) {
            console.error(
              'Appointment reminder scheduling failed:',
              reminderError
            );
            showToast('Reminder could not be scheduled');
          }

          if (!reminderAllowed) {
            showToast('Enable notifications to get appointment reminders');
          }
        }

        await loadAppointments();

        setModalVisible(false);
        setEditingId(null);

        showToast('Appointment updated');
        return;
      }

      // ================================================
      // ADD APPOINTMENT
      // ================================================

      const response = await apiFetch(
        `/api/appointments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(appointmentData),
        }
      );

      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(
          data.message || 'Unable to save appointment'
        );
      }

      // Schedule reminders for all created time slots.
      const createdAppointments =
        Array.isArray(data.appointments) && data.appointments.length > 0
          ? data.appointments
          : data.appointment
          ? [data.appointment]
          : [];

      if (createdAppointments.length > 0) {
        const reminderAllowed = await requestNotificationPermission();

        try {
          for (const created of createdAppointments) {
            await replaceAppointmentReminder({
              id: created._id,
              doctor: created.doctor,
              specialty: created.specialty,
              hospital: created.hospital,
              date: created.date,
              time: created.time,
              reminder: created.reminder,
              status: created.status,
            });
          }
        } catch (reminderError) {
          console.error(
            'Appointment reminder scheduling failed:',
            reminderError
          );
          showToast('Reminder could not be scheduled');
        }

        if (!reminderAllowed) {
          showToast('Enable notifications to get appointment reminders');
        }
      }

      await loadAppointments();

      setActiveTab('Upcoming');
      setModalVisible(false);
      setEditingId(null);

      showToast('Appointment saved');
    } catch (error) {
      console.log('Save appointment error:', error);
      showToast(
        error instanceof Error
          ? error.message
          : 'Unable to save appointment'
      );
    }
  };


  // ==================================================
  // DELETE
  // ==================================================

  const deleteAppointment = async (
    id: string
  ) => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        showToast('Please login again');
        router.replace('/');
        return;
      }

      const response = await apiFetch(
        `/api/appointments/${id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(
          data.message || 'Unable to delete appointment'
        );
      }

      // Cancel any scheduled reminders for this appointment.
      await cancelAppointmentRemindersForAppointment(id);

      await loadAppointments();

      showToast('Appointment deleted');
    } catch (error) {
      console.log('Delete appointment error:', error);
      showToast(
        error instanceof Error
          ? error.message
          : 'Unable to delete appointment'
      );
    }
  };


  // ==================================================
  // REMINDER
  // ==================================================

  const toggleReminder = async (
    id: string
  ) => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        showToast('Please login again');
        router.replace('/');
        return;
      }

      const appointment = appointments.find(
        item => item.id === id
      );

      if (!appointment) {
        return;
      }

      const newReminderValue = !appointment.reminder;

      const response = await apiFetch(
        `/api/appointments/${id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reminder: newReminderValue,
          }),
        }
      );

      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(
          data.message || 'Unable to update reminder'
        );
      }

      // Directly schedule or cancel the reminder based on new value.
      if (newReminderValue) {
        try {
          await replaceAppointmentReminder({
            ...appointment,
            reminder: true,
          });
        } catch (reminderError) {
          console.error('Appointment reminder scheduling failed:', reminderError);
        }
      } else {
        await cancelAppointmentRemindersForAppointment(id);
      }

      await loadAppointments();
    } catch (error) {
      console.log('Reminder update error:', error);
      showToast(
        error instanceof Error
          ? error.message
          : 'Unable to update reminder'
      );
    }
  };


  // ==================================================
  // FILTER
  // ==================================================

  const filteredAppointments = appointments
    .filter(
      appointment =>
        appointment.status ===
        activeTab
    )
    // Upcoming: soonest first. Previous: most recent first.
    .sort((a, b) => {
      const timeA = getAppointmentDateTime(a)?.getTime();
      const timeB = getAppointmentDateTime(b)?.getTime();

      if (timeA == null && timeB == null) {
        return 0;
      }

      if (timeA == null) {
        return 1; // unparsable entries sink to the end
      }

      if (timeB == null) {
        return -1;
      }

      return activeTab === 'Upcoming'
        ? timeA - timeB
        : timeB - timeA;
    });


  // ==================================================
  // FONT CHECK
  // ==================================================

  if (!fontsLoaded) {
    return null;
  }


  // ==================================================
  // APPOINTMENT CARD
  // ==================================================

  const renderAppointment = (
    appointment: Appointment
  ) => {
    const isUpcoming =
      appointment.status ===
      'Upcoming';

    // Dynamic badge: show how far away the visit is.
    const parsedDateTime =
      isUpcoming
        ? getAppointmentDateTime(appointment)
        : null;

    const dayOffset =
      parsedDateTime
        ? getCalendarDayOffset(parsedDateTime)
        : null;

    const dynamicLabel =
      dayOffset != null
        ? getUpcomingBadgeText(dayOffset)
        : '';

    const badgeText =
      isUpcoming && dynamicLabel
        ? `Upcoming Â· ${dynamicLabel}`
        : appointment.status;

    return (
      <View
        key={appointment.id}
        style={[
          styles.appointmentCard,

          isMobile &&
            styles.appointmentCardMobile,
        ]}
      >

        {/* ------------------------------------------ */}
        {/* TOP */}
        {/* ------------------------------------------ */}

        <View
          style={[
            styles.cardTop,
            isMobile &&
              styles.cardTopMobile,
          ]}
        >

          {/* CALENDAR ICON */}

          <View style={styles.calendarBox}>
            <Ionicons
              name="calendar-outline"
              size={27}
              color={
                COLORS.primaryBlue
              }
            />
          </View>


          {/* STATUS */}

          <View
            style={[
              styles.statusBadge,

              {
                backgroundColor:
                  isUpcoming
                    ? COLORS.upcomingBg
                    : COLORS.previousBg,
              },
            ]}
          >
            <Ionicons
              name={
                isUpcoming
                  ? 'time-outline'
                  : 'checkmark-circle-outline'
              }
              size={14}
              color={
                isUpcoming
                  ? COLORS.upcomingText
                  : COLORS.previousText
              }
            />

            <Text
              style={[
                styles.statusText,

                {
                  color:
                    isUpcoming
                      ? COLORS.upcomingText
                      : COLORS.previousText,
                },
              ]}
            >
              {badgeText}
            </Text>
          </View>
        </View>


        {/* ------------------------------------------ */}
        {/* DOCTOR */}
        {/* ------------------------------------------ */}

        <Text
          style={[
            styles.doctorName,

            isMobile &&
              styles.doctorNameMobile,
          ]}
        >
          {appointment.doctor}
        </Text>


        {/* SPECIALTY */}
        <Text
          style={styles.specialtyText}
        >
          {appointment.specialty}
          {' Â· '}
          {appointment.hospital}
        </Text>


        {/* ------------------------------------------ */}
        {/* DETAILS BOX */}
        {/* ------------------------------------------ */}

        <View
          style={[
            styles.detailsBox,

            isMobile &&
              styles.detailsBoxMobile,
          ]}
        >

          {/* DATE */}

          <View style={styles.detailRow}>
            <Ionicons
              name="calendar-outline"
              size={19}
              color={
                COLORS.primaryBlue
              }
            />

            <Text
              style={styles.detailText}
            >
              {appointment.date}
            </Text>
          </View>


          {/* TIME */}

          <View style={styles.detailRow}>
            <Ionicons
              name="time-outline"
              size={19}
              color={
                COLORS.primaryBlue
              }
            />

            <Text
              style={styles.detailText}
            >
              {appointment.time}
            </Text>
          </View>


          {/* REASON */}

          <View style={styles.detailRow}>
            <Ionicons
              name="location-outline"
              size={19}
              color={
                COLORS.primaryBlue
              }
            />

            <Text
              style={styles.detailText}
            >
              Reason: {appointment.reason}
            </Text>
          </View>
        </View>


        {/* ------------------------------------------ */}
        {/* REMINDER */}
        {/* ------------------------------------------ */}

        <View
          style={[
            styles.reminderRow,

            isMobile &&
              styles.reminderRowMobile,
          ]}
        >

          <Text
            style={styles.reminderText}
          >
            Reminder Notification
          </Text>


          <View
            style={styles.reminderRight}
          >

            <Text
              style={styles.onText}
            >
              {appointment.reminder
                ? 'ON'
                : 'OFF'}
            </Text>

            <Switch
              value={
                appointment.reminder
              }
              onValueChange={() =>
                toggleReminder(
                  appointment.id
                )
              }
              trackColor={{
                false: '#C5D4D9',
                true:
                  COLORS.primaryBlue,
              }}
              thumbColor={
                COLORS.white
              }
              ios_backgroundColor="#C5D4D9"
            />

          </View>
        </View>


        {/* ------------------------------------------ */}
        {/* ACTIONS */}
        {/* ------------------------------------------ */}

        <View
          style={[
            styles.cardActions,

            isMobile &&
              styles.cardActionsMobile,
          ]}
        >

          <Pressable
            onPress={() =>
              openEditAppointment(
                appointment
              )
            }
            style={styles.actionButton}
          >
            <Ionicons
              name="create-outline"
              size={18}
              color={
                COLORS.mainText
              }
            />

            <Text
              style={
                styles.actionButtonText
              }
            >
              Edit
            </Text>
          </Pressable>


          <Pressable
            onPress={() =>
              deleteAppointment(
                appointment.id
              )
            }
            style={styles.actionButton}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={
                COLORS.dangerRed
              }
            />

            <Text
              style={[
                styles.actionButtonText,
                {
                  color:
                    COLORS.dangerRed,
                },
              ]}
            >
              Delete
            </Text>
          </Pressable>

        </View>

      </View>
    );
  };


  // ==================================================
  // RETURN
  // ==================================================

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >

        <View style={styles.screen}>

        {/* ========================================== */}
        {/* HEADER (same layout as Home) */}
        {/* ========================================== */}

        {/* HEADER (shared across all screens) */}

        <AppHeader />

        {/* ========================================== */}
        {/* MAIN */}
        {/* ========================================== */}

        <ScrollView
          style={styles.scrollView}

          contentContainerStyle={[
            styles.scrollContent,

            isMobile &&
              styles.scrollContentMobile,
          ]}

          showsVerticalScrollIndicator={
            false
          }
        >

          {/* ======================================== */}
          {/* PAGE HEADER */}
          {/* ======================================== */}

          <View
            style={[
              styles.titleRow,

              isMobile &&
                styles.titleRowMobile,
            ]}
          >

            <View>

              <Text
                style={[
                  styles.pageTitle,

                  isMobile &&
                    styles.pageTitleMobile,
                ]}
              >
                Appointments
              </Text>


              <Text
                style={[
                  styles.pageSubtitle,

                  isMobile &&
                    styles.pageSubtitleMobile,
                ]}
              >
                Plan visits and keep
                reminders in one place.
              </Text>

            </View>


            {/* ADD BUTTON */}

            <Pressable
              onPress={
                openAddAppointment
              }
              style={[
                styles.addButton,

                isMobile &&
                  styles.addButtonMobile,
              ]}
            >

              <Ionicons
                name="add"
                size={22}
                color={
                  COLORS.white
                }
              />

              <Text
                style={
                  styles.addButtonText
                }
              >
                Add
              </Text>

            </Pressable>

          </View>


          {/* ======================================== */}
          {/* TABS */}
          {/* ======================================== */}

          <View
            style={[
              styles.tabsContainer,

              isMobile &&
                styles.tabsContainerMobile,
            ]}
          >

            <Pressable
              onPress={() =>
                setActiveTab(
                  'Upcoming'
                )
              }
              style={[
                styles.tabButton,

                activeTab ===
                  'Upcoming' &&
                  styles.tabButtonActive,
              ]}
            >

              <Text
                style={[
                  styles.tabText,

                  activeTab ===
                    'Upcoming' &&
                    styles.tabTextActive,
                ]}
              >
                Upcoming
              </Text>

            </Pressable>


            <Pressable
              onPress={() =>
                setActiveTab(
                  'Previous'
                )
              }
              style={[
                styles.tabButton,

                activeTab ===
                  'Previous' &&
                  styles.tabButtonActive,
              ]}
            >

              <Text
                style={[
                  styles.tabText,

                  activeTab ===
                    'Previous' &&
                    styles.tabTextActive,
                ]}
              >
                Previous
              </Text>

            </Pressable>

          </View>


          {/* ======================================== */}
          {/* APPOINTMENTS */}
          {/* ======================================== */}

          <View
            style={[
              styles.appointmentsGrid,

              isMobile &&
                styles.appointmentsGridMobile,
            ]}
          >

            {filteredAppointments.length >
            0 ? (
              filteredAppointments.map(
                renderAppointment
              )
            ) : (

              <View
                style={
                  styles.emptyContainer
                }
              >

                <Ionicons
                  name="calendar-outline"
                  size={50}
                  color={
                    COLORS.secondaryText
                  }
                />

                <Text
                  style={
                    styles.emptyTitle
                  }
                >
                  No appointments
                </Text>

                <Text
                  style={
                    styles.emptyText
                  }
                >
                  There are no{' '}
                  {activeTab.toLowerCase()}{' '}
                  appointments.
                </Text>

              </View>

            )}

          </View>


          <View
            style={{
              height: 100,
            }}
          />

        </ScrollView>


        {/* ========================================== */}
        {/* BOTTOM NAV */}
        {/* ========================================== */}

        <View
          style={[
            styles.bottomNav,
            isDesktop && styles.bottomNavDesktop,
          ]}
        >

          <BottomTab
            icon="home-outline"
            label="Home"
            onPress={() =>
              router.push('/home')
            }
          />


          <BottomTab
            icon="medical-outline"
            label="Medicines"
            onPress={() =>
              router.push('/medicines')
            }
          />


          <BottomTab
            icon="calendar-outline"
            label="Appointments"
            active
            onPress={() =>
              router.push(
                '/appointments'
              )
            }
          />


          <BottomTab
            icon="person-outline"
            label="Profile"
            onPress={() =>
              router.push('/profile')
            }
          />

        </View>


        {/* ========================================== */}
        {/* TOAST */}
        {/* ========================================== */}

        {toastVisible && (
          <View
            style={[
              styles.toast,

              isMobile &&
                styles.toastMobile,
            ]}
          >

            <View
              style={
                styles.toastIcon
              }
            >
              <Ionicons
                name="checkmark"
                size={15}
                color={
                  COLORS.white
                }
              />
            </View>

            <Text
              style={
                styles.toastText
              }
            >
              {toastMessage}
            </Text>

          </View>
        )}


        {/* ========================================== */}
        {/* ADD / EDIT MODAL */}
        {/* ========================================== */}

        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"

          onRequestClose={() =>
            setModalVisible(false)
          }
        >

          <View
            style={
              styles.modalOverlay
            }
          >

            <KeyboardAvoidingView
              behavior={
                Platform.OS === 'ios'
                  ? 'padding'
                  : undefined
              }
              style={
                styles.keyboardAvoid
              }
            >

            <View
              style={[
                styles.modal,

                isMobile &&
                  styles.modalMobile,

                isTablet &&
                  styles.modalTablet,
              ]}
            >

              {/* ------------------------------------ */}
              {/* MODAL HEADER */}
              {/* ------------------------------------ */}

              <View
                style={
                  styles.modalHeader
                }
              >

                <View>

                  <Text
                    style={
                      styles.modalTitle
                    }
                  >
                    {editingId
                      ? 'Edit Appointment'
                      : 'Add Appointment'}
                  </Text>


                  <Text
                    style={
                      styles.modalSubtitle
                    }
                  >
                    Add a mock appointment
                    to your schedule.
                  </Text>

                </View>


                <Pressable
                  onPress={() =>
                    setModalVisible(
                      false
                    )
                  }
                  style={
                    styles.closeButton
                  }
                >

                  <Ionicons
                    name="close"
                    size={23}
                    color={
                      COLORS.secondaryText
                    }
                  />

                </Pressable>

              </View>


              {/* ------------------------------------ */}
              {/* FORM */}
              {/* ------------------------------------ */}

              <ScrollView
                style={styles.modalForm}

                contentContainerStyle={
                  styles.modalFormContent
                }

                showsVerticalScrollIndicator={
                  false
                }

                keyboardShouldPersistTaps="handled"
              >

                {/* DOCTOR */}

                <View
                  style={[
                    styles.inputGroup,

                    isDesktop &&
                      styles.inputHalf,
                  ]}
                >

                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Doctor Name
                  </Text>


                  <TextInput
                    value={doctor}
                    onChangeText={setDoctor}
                    placeholder="e.g. Dr. Neha Sharma"
                    placeholderTextColor={
                      COLORS.secondaryText
                    }
                    style={
                      styles.input
                    }
                  />

                </View>


                {/* SPECIALTY */}

                <View
                  style={[
                    styles.inputGroup,

                    isDesktop &&
                      styles.inputHalf,
                  ]}
                >

                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Specialty
                  </Text>


                  <TextInput
                    value={specialty}
                    onChangeText={
                      setSpecialty
                    }
                    placeholder="e.g. General Physician"
                    placeholderTextColor={
                      COLORS.secondaryText
                    }
                    style={
                      styles.input
                    }
                  />

                </View>


                {/* HOSPITAL */}

                <View
                  style={[
                    styles.inputGroup,

                    isDesktop &&
                      styles.inputHalf,
                  ]}
                >

                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Hospital/Clinic
                  </Text>


                  <TextInput
                    value={hospital}
                    onChangeText={
                      setHospital
                    }
                    placeholder="e.g. City Care Hospital"
                    placeholderTextColor={
                      COLORS.secondaryText
                    }
                    style={
                      styles.input
                    }
                  />

                </View>


                {/* DATE */}

                <View
                  style={[
                    styles.inputGroup,

                    isDesktop &&
                      styles.inputHalf,
                  ]}
                >

                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Date
                  </Text>


                  {Platform.OS === 'web' ? (
                    <WebDateTimeInput
                      mode="date"
                      value={date}
                      onChange={setDate}
                      ariaLabel="Appointment date"
                      placeholder="Select date"
                      style={{
                        minHeight: 50,
                        backgroundColor: '#E1F1F5',
                        borderColor: '#C6DDE3',
                      }}
                    />
                  ) : (
                    <Pressable
                      onPress={toggleDatePicker}

                      style={[
                        styles.input,
                        styles.pickerField,
                      ]}
                    >

                      <Text
                        style={[
                          styles.pickerFieldText,

                          !date &&
                            styles.pickerFieldPlaceholder,
                        ]}
                      >
                        {date || 'Select date'}
                      </Text>

                      <Ionicons
                        name="calendar-outline"
                        size={20}
                        color={
                          date
                            ? COLORS.primaryBlue
                            : COLORS.secondaryText
                        }
                      />

                    </Pressable>
                  )}


                  {showDatePicker &&
                    isDateTimePickerSupported &&
                    NativeDateTimePicker && (
                      <NativeDateTimePicker
                        value={parsePickerDate(date)}
                        mode="date"
                        display={
                          Platform.OS === 'ios'
                            ? 'spinner'
                            : 'default'
                        }
                        onChange={handleDateSelected}
                        maximumDate={
                          new Date(2100, 11, 31)
                        }
                      />
                    )}

                </View>


                {/* TIME SLOTS */}

                <View
                  style={styles.inputGroup}
                >

                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Time
                  </Text>


                  {timeSlots.map((row, index) => (
                    <View
                      key={`appointment-time-${index}`}
                      style={styles.scheduleRow}
                    >

                      {Platform.OS === 'web' ? (
                        <WebDateTimeInput
                          mode="time"
                          value={row.time}
                          onChange={(value) =>
                            updateTimeSlotRow(index, value)
                          }
                          placeholder="Select time"
                          style={{
                            flex: 1,
                            width: 'auto',
                            minHeight: 50,
                            backgroundColor: '#E1F1F5',
                            borderColor: '#C6DDE3',
                          }}
                        />
                      ) : (
                        <Pressable
                          onPress={() => openTimePicker(index)}

                          style={[
                            styles.input,
                            styles.scheduleTimeInput,
                            styles.pickerField,
                          ]}
                        >

                          <Text
                            style={[
                              styles.pickerFieldText,

                              !row.time &&
                                styles.pickerFieldPlaceholder,
                            ]}
                          >
                            {row.time || 'Select time'}
                          </Text>

                          <Ionicons
                            name="time-outline"
                            size={20}
                            color={
                              row.time
                                ? COLORS.primaryBlue
                                : COLORS.secondaryText
                            }
                          />

                        </Pressable>
                      )}

                      <Pressable
                        onPress={() =>
                          removeTimeSlotRow(index)
                        }

                        style={styles.scheduleRemoveButton}
                      >

                        <Ionicons
                          name="close-outline"
                          size={20}
                          color={
                            COLORS.dangerRed
                          }
                        />

                      </Pressable>

                    </View>
                  ))}


                  {timePickerSlotIndex !== null &&
                    isDateTimePickerSupported &&
                    NativeDateTimePicker && (
                      <NativeDateTimePicker
                        value={parsePickerTime(
                          timeSlots[timePickerSlotIndex]?.time || ''
                        )}
                        mode="time"
                        display={
                          Platform.OS === 'ios'
                            ? 'spinner'
                            : 'default'
                        }
                        is24Hour={false}
                        onChange={handleTimeSelected}
                      />
                    )}


                  <Pressable
                    onPress={addTimeSlotRow}

                    style={styles.addScheduleButton}
                  >

                    <Ionicons
                      name="add-outline"
                      size={18}
                      color={
                        COLORS.primaryBlue
                      }
                    />

                    <Text
                      style={
                        styles.addScheduleText
                      }
                    >
                      Add another time
                    </Text>

                  </Pressable>

                </View>


                {/* REASON */}

                <View
                  style={[
                    styles.inputGroup,

                    isDesktop &&
                      styles.inputHalf,
                  ]}
                >

                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Reason for Visit
                  </Text>


                  <TextInput
                    value={reason}
                    onChangeText={
                      setReason
                    }
                    placeholder="e.g. General Consultation"
                    placeholderTextColor={
                      COLORS.secondaryText
                    }
                    style={
                      styles.input
                    }
                  />

                </View>


                {/* REMINDER */}

                <View
                  style={[
                    styles.reminderFormRow,

                    isMobile &&
                      styles.reminderFormRowMobile,
                  ]}
                >

                  <Text
                    style={
                      styles.reminderFormText
                    }
                  >
                    Reminder
                  </Text>


                  <Switch
                    value={reminder}
                    onValueChange={
                      setReminder
                    }

                    trackColor={{
                      false: '#C5D4D9',

                      true:
                        COLORS.primaryBlue,
                    }}

                    thumbColor={
                      COLORS.white
                    }

                    ios_backgroundColor="#C5D4D9"
                  />

                </View>

              </ScrollView>


              {/* ------------------------------------ */}
              {/* MODAL BUTTONS */}
              {/* ------------------------------------ */}

              <View
                style={[
                  styles.modalButtons,

                  isMobile &&
                    styles.modalButtonsMobile,
                ]}
              >

                <Pressable
                  onPress={() =>
                    setModalVisible(
                      false
                    )
                  }

                  style={[
                    styles.cancelButton,

                    isMobile &&
                      styles.modalButtonMobile,
                  ]}
                >

                  <Text
                    style={
                      styles.cancelText
                    }
                  >
                    Cancel
                  </Text>

                </Pressable>


                <Pressable
                  onPress={
                    saveAppointment
                  }

                  style={[
                    styles.saveButton,

                    isMobile &&
                      styles.modalButtonMobile,
                  ]}
                >

                  <Ionicons
                    name="checkmark-circle-outline"
                    size={19}
                    color={
                      COLORS.white
                    }
                  />

                  <Text
                    style={
                      styles.saveText
                    }
                  >
                    {editingId
                      ? 'Save Changes'
                      : 'Save Appointment'}
                  </Text>

                </Pressable>

              </View>

            </View>

            </KeyboardAvoidingView>

          </View>

        </Modal>

      </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}


// ====================================================
// STYLES
// ====================================================

const styles = StyleSheet.create({

  // ==================================================
  // SCREEN
  // ==================================================

  screen: {
    flex: 1,

    backgroundColor:
      COLORS.background,
  },


  scrollView: {
    flex: 1,
  },


  scrollContent: {
    paddingHorizontal: 36,

    paddingTop: 30,
  },


  scrollContentMobile: {
    paddingHorizontal: 16,

    paddingTop: 22,
  },


  // ==================================================
  // HEADER
  // ==================================================

  topHeader: {
    height: 84,

    backgroundColor:
      COLORS.white,

    borderBottomWidth: 1,

    borderBottomColor:
      COLORS.border,

    paddingHorizontal: 32,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    position: 'relative',

    zIndex: 9999,
  },


  welcomeText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 17,

    color:
      COLORS.secondaryText,
  },


  headerRight: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 12,

    position: 'relative',

    zIndex: 9999,
  },


  notificationBadge: {
    position: 'absolute',

    top: 2,

    right: 1,

    minWidth: 17,

    height: 17,

    paddingHorizontal: 4,

    borderRadius: 9,

    backgroundColor: COLORS.dangerRed,

    alignItems: 'center',

    justifyContent: 'center',
  },


  notificationBadgeText: {
    color: COLORS.white,

    fontFamily: 'Inter_700Bold',

    fontSize: 9,
  },


  notificationDropdown: {
    position: 'absolute',

    top: 50,

    right: 0,

    width: 360,

    maxWidth: 360,

    backgroundColor: COLORS.white,

    borderWidth: 1,

    borderColor: COLORS.border,

    borderRadius: 14,

    padding: 20,

    zIndex: 99999,

    elevation: 12,

    shadowColor: '#000000',

    shadowOffset: { width: 0, height: 5 },

    shadowOpacity: 0.15,

    shadowRadius: 12,
  },


  notificationDropdownHeader: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    paddingBottom: 12,

    borderBottomWidth: 1,

    borderBottomColor: COLORS.border,
  },


  notificationDropdownTitle: {
    color: COLORS.mainText,

    fontFamily: 'Poppins_600SemiBold',

    fontSize: 17,
  },


  notificationEmptyState: {
    alignItems: 'center',

    paddingVertical: 24,

    paddingHorizontal: 8,
  },


  notificationEmptyTitle: {
    color: COLORS.mainText,

    fontFamily: 'Inter_600SemiBold',

    fontSize: 14,

    marginTop: 10,
  },


  notificationEmptyText: {
    color: COLORS.secondaryText,

    fontFamily: 'Inter_400Regular',

    fontSize: 12,

    lineHeight: 18,

    textAlign: 'center',

    marginTop: 5,
  },


  notificationList: { maxHeight: 360, marginTop: 4 },

  notificationItem: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 13, paddingHorizontal: 5, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 10 },

  notificationUnread: { backgroundColor: '#F2F8FC' },

  notificationItemIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.lightBlue, alignItems: 'center', justifyContent: 'center' },

  notificationItemContent: { flex: 1, minWidth: 0 },

  notificationItemTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },

  notificationItemTitle: { flex: 1, color: COLORS.mainText, fontFamily: 'Inter_600SemiBold', fontSize: 13 },

  notificationItemMessage: { color: COLORS.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 4 },

  notificationItemDate: { color: COLORS.secondaryText, fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 6 },

  notificationMarkRead: { color: COLORS.primaryBlue, fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 4 },

  notificationUnreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primaryBlue },

  notificationRetryButton: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: COLORS.lightBlue },

  notificationRetryText: { color: COLORS.primaryBlue, fontFamily: 'Inter_600SemiBold', fontSize: 12 },


  avatar: {
    width: 48,

    height: 48,

    borderRadius: 24,

    backgroundColor:
      COLORS.primaryBlue,

    alignItems: 'center',

    justifyContent:
      'center',
  },


  avatarWithPhoto: {
    overflow: 'hidden',
  },

  avatarPhoto: {
    width: 48,

    height: 48,
  },


  avatarText: {
    color:
      COLORS.white,

    fontFamily:
      'Poppins_700Bold',

    fontSize: 17,
  },


  // ==================================================
  // TITLE
  // ==================================================

  titleRow: {
    flexDirection: 'row',

    justifyContent:
      'space-between',

    alignItems: 'center',

    marginBottom: 28,
  },


  titleRowMobile: {
    flexDirection: 'column',

    alignItems: 'flex-start',

    gap: 18,
  },


  pageTitle: {
    fontFamily:
      'Poppins_700Bold',

    fontSize: 36,

    color:
      COLORS.mainText,
  },


  pageTitleMobile: {
    fontSize: 29,
  },


  pageSubtitle: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 18,

    color:
      COLORS.secondaryText,

    marginTop: 2,
  },


  pageSubtitleMobile: {
    fontSize: 15,
  },


  // ==================================================
  // ADD
  // ==================================================

  addButton: {
    minHeight: 50,

    backgroundColor:
      COLORS.primaryBlue,

    paddingHorizontal: 22,

    borderRadius: 8,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'center',

    gap: 6,

    elevation: 3,
  },


  addButtonMobile: {
    width: '100%',
  },


  addButtonText: {
    color:
      COLORS.white,

    fontFamily:
      'Inter_700Bold',

    fontSize: 16,
  },


  // ==================================================
  // TABS
  // ==================================================

  tabsContainer: {
    alignSelf: 'flex-start',

    flexDirection: 'row',

    backgroundColor:
      COLORS.white,

    borderRadius: 10,

    padding: 5,

    marginBottom: 25,

    borderWidth: 1,

    borderColor:
      COLORS.border,
  },


  tabsContainerMobile: {
    width: '100%',
  },


  tabButton: {
    minWidth: 125,

    paddingVertical: 13,

    paddingHorizontal: 20,

    borderRadius: 7,

    alignItems: 'center',

    justifyContent:
      'center',
  },


  tabButtonActive: {
    backgroundColor:
      COLORS.primaryBlue,
  },


  tabText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 16,

    color:
      COLORS.mainText,
  },


  tabTextActive: {
    color:
      COLORS.white,

    fontFamily:
      'Inter_700Bold',
  },


  // ==================================================
  // GRID
  // ==================================================

  appointmentsGrid: {
    flexDirection: 'row',

    flexWrap: 'wrap',

    gap: 20,
  },


  appointmentsGridMobile: {
    flexDirection: 'column',

    gap: 16,
  },


  // ==================================================
  // CARD
  // ==================================================

  appointmentCard: {
    backgroundColor:
      COLORS.white,

    borderRadius: 10,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    padding: 25,

    flex: 1,

    minWidth: 390,

    maxWidth: 750,

    elevation: 2,
  },


  appointmentCardMobile: {
    width: '100%',

    minWidth: 0,

    maxWidth: undefined,

    padding: 18,
  },


  // ==================================================
  // CARD TOP
  // ==================================================

  cardTop: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    marginBottom: 22,
  },


  cardTopMobile: {
    marginBottom: 17,
  },


  calendarBox: {
    width: 60,

    height: 60,

    borderRadius: 10,

    backgroundColor:
      '#D7EFFA',

    alignItems: 'center',

    justifyContent:
      'center',
  },


  statusBadge: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 5,

    paddingVertical: 8,

    paddingHorizontal: 13,

    borderRadius: 18,
  },


  statusText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 13,
  },


  // ==================================================
  // DOCTOR
  // ==================================================

  doctorName: {
    fontFamily:
      'Poppins_700Bold',

    fontSize: 21,

    color:
      COLORS.mainText,

    marginBottom: 2,
  },


  doctorNameMobile: {
    fontSize: 18,
  },


  specialtyText: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 16,

    color:
      COLORS.secondaryText,

    marginBottom: 20,
  },


  // ==================================================
  // DETAILS
  // ==================================================

  detailsBox: {
    backgroundColor:
      '#E8F5F8',

    borderRadius: 9,

    paddingVertical: 13,

    paddingHorizontal: 15,

    gap: 9,

    marginBottom: 17,
  },


  detailsBoxMobile: {
    padding: 13,

    gap: 10,
  },


  detailRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,
  },


  detailText: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 16,

    color:
      COLORS.mainText,

    flex: 1,
  },


  // ==================================================
  // REMINDER
  // ==================================================

  reminderRow: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    marginTop: 1,
  },


  reminderRowMobile: {
    paddingTop: 3,
  },


  reminderText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 16,

    color:
      COLORS.mainText,
  },


  reminderRight: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 4,
  },


  onText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 13,

    color:
      COLORS.secondaryText,
  },


  // ==================================================
  // ACTIONS
  // ==================================================

  cardActions: {
    flexDirection: 'row',

    justifyContent:
      'flex-end',

    gap: 18,

    marginTop: 14,

    paddingTop: 13,

    borderTopWidth: 1,

    borderTopColor:
      '#E0EAED',
  },


  cardActionsMobile: {
    justifyContent:
      'flex-start',
  },


  actionButton: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 5,

    paddingVertical: 5,
  },


  actionButtonText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 13,

    color:
      COLORS.mainText,
  },


  // ==================================================
  // EMPTY
  // ==================================================

  emptyContainer: {
    flex: 1,

    width: '100%',

    alignItems: 'center',

    justifyContent:
      'center',

    backgroundColor:
      COLORS.white,

    borderRadius: 10,

    paddingVertical: 70,
  },


  emptyTitle: {
    fontFamily:
      'Poppins_600SemiBold',

    fontSize: 20,

    color:
      COLORS.mainText,

    marginTop: 12,
  },


  emptyText: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 14,

    color:
      COLORS.secondaryText,

    marginTop: 5,
  },


  // ==================================================
  // BOTTOM NAV
  // ==================================================

  bottomNav: {
    height: 72,

    backgroundColor:
      COLORS.white,

    borderTopWidth: 1,

    borderTopColor:
      COLORS.border,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-around',

    paddingHorizontal: 20,
  },


  bottomNavDesktop: {
    width: '100%',

    maxWidth: 720,

    alignSelf: 'center',

    height: 64,

    marginTop: 10,

    marginBottom: 14,

    paddingHorizontal: 12,

    borderTopWidth: 0,

    borderWidth: 1,

    borderColor: COLORS.border,

    borderRadius: 16,
  },


  bottomTab: {
    height: 48,

    flex: 1,

    maxWidth: 96,

    alignItems: 'center',

    justifyContent:
      'center',

    gap: 4,

    borderRadius: 10,

    paddingVertical: 5,
  },


  bottomTabActive: {
    backgroundColor:
      '#E5F2F9',
  },


  bottomTabText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 11,

    color:
      COLORS.secondaryText,
  },


  bottomTabTextActive: {
    fontFamily:
      'Inter_700Bold',

    color:
      COLORS.primaryBlue,
  },


  // ==================================================
  // TOAST
  // ==================================================

  toast: {
    position: 'absolute',

    top: 28,

    alignSelf: 'center',

    backgroundColor:
      COLORS.white,

    borderRadius: 11,

    paddingVertical: 15,

    paddingHorizontal: 21,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 10,

    shadowColor: '#000',

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.15,

    shadowRadius: 10,

    elevation: 10,

    zIndex: 9999,
  },


  toastMobile: {
    top: 15,

    left: 16,

    right: 16,

    alignSelf: 'auto',
  },


  toastIcon: {
    width: 23,

    height: 23,

    borderRadius: 12,

    backgroundColor:
      '#1D1D1D',

    alignItems: 'center',

    justifyContent:
      'center',
  },


  toastText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 14,

    color:
      COLORS.mainText,
  },


  // ==================================================
  // MODAL
  // ==================================================

  modalOverlay: {
    flex: 1,

    backgroundColor:
      'rgba(20, 40, 50, 0.45)',

    alignItems: 'center',

    justifyContent:
      'center',

    padding: 20,
  },


  // Keeps the modal header (close button) visible while the keyboard is open.
  keyboardAvoid: {
    width: '100%',

    alignItems: 'center',
  },


  modal: {
    backgroundColor:
      '#E4F4F7',

    borderRadius: 10,

    width: '65%',

    maxWidth: 720,

    maxHeight: '90%',

    padding: 28,
  },


  modalTablet: {
    width: '82%',
  },


  modalMobile: {
    width: '100%',

    maxHeight: '92%',

    padding: 20,
  },


  // ==================================================
  // MODAL HEADER
  // ==================================================

  modalHeader: {
    flexDirection: 'row',

    alignItems: 'flex-start',

    justifyContent:
      'space-between',

    marginBottom: 18,
  },


  modalTitle: {
    fontFamily:
      'Poppins_700Bold',

    fontSize: 23,

    color:
      COLORS.mainText,
  },


  modalSubtitle: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 15,

    color:
      COLORS.secondaryText,

    marginTop: 2,
  },


  closeButton: {
    width: 36,

    height: 36,

    borderRadius: 18,

    alignItems: 'center',

    justifyContent:
      'center',
  },


  // ==================================================
  // MODAL FORM
  // ==================================================

  modalForm: {
    flexGrow: 0,
  },


  modalFormContent: {
    paddingBottom: 5,
  },


  inputGroup: {
    marginBottom: 15,
  },


  inputHalf: {
    width: '48%',
  },


  inputLabel: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 15,

    color:
      COLORS.mainText,

    marginBottom: 7,
  },


  input: {
    minHeight: 50,

    backgroundColor:
      '#E1F1F5',

    borderWidth: 1,

    borderColor:
      '#C6DDE3',

    borderRadius: 7,

    paddingHorizontal: 14,

    fontFamily:
      'Inter_400Regular',

    fontSize: 15,

    color:
      COLORS.mainText,
  },


  // ==================================================
  // REMINDER FORM
  // ==================================================

  reminderFormRow: {
    minHeight: 50,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    marginTop: 2,

    marginBottom: 5,
  },


  reminderFormRowMobile: {
    marginTop: 3,
  },


  reminderFormText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 16,

    color:
      COLORS.mainText,
  },


  // ==================================================
  // MODAL BUTTONS
  // ==================================================

  modalButtons: {
    flexDirection: 'row',

    justifyContent:
      'flex-end',

    gap: 10,

    marginTop: 12,

    paddingTop: 15,

    borderTopWidth: 1,

    borderTopColor:
      '#C7DDE2',
  },


  modalButtonsMobile: {
    flexDirection:
      'column-reverse',
  },


  modalButtonMobile: {
    width: '100%',
  },


  cancelButton: {
    minHeight: 48,

    paddingHorizontal: 22,

    borderRadius: 7,

    backgroundColor:
      COLORS.white,

    borderWidth: 1,

    borderColor:
      '#C6D9DE',

    alignItems: 'center',

    justifyContent:
      'center',
  },


  cancelText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 15,

    color:
      COLORS.mainText,
  },


  saveButton: {
    minHeight: 48,

    paddingHorizontal: 20,

    borderRadius: 7,

    backgroundColor:
      COLORS.primaryBlue,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'center',

    gap: 7,

    elevation: 2,
  },


  saveText: {
    fontFamily:
      'Inter_700Bold',

    fontSize: 15,

    color:
      COLORS.white,
  },


  scheduleRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 8,

    marginBottom: 10,
  },


  pickerField: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    gap: 8,
  },


  pickerFieldText: {
    flexShrink: 1,

    fontFamily:
      'Inter_400Regular',

    fontSize: 15,

    color:
      COLORS.mainText,
  },


  pickerFieldPlaceholder: {
    color:
      COLORS.secondaryText,
  },


  scheduleTimeInput: {
    flex: 1,
  },


  scheduleRemoveButton: {
    width: 34,

    height: 34,

    alignItems: 'center',

    justifyContent: 'center',
  },


  addScheduleButton: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 6,

    paddingVertical: 8,
    alignSelf: 'flex-start',
  },


  addScheduleText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 13,

    color:
      COLORS.primaryBlue,
  },

});