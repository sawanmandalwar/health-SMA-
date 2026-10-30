import React, { useCallback, useRef, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useResponsiveDimensions } from '../hooks/useResponsiveDimensions';
import { formatDisplayTime } from '../utils/format-display-time';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Ionicons } from '@expo/vector-icons';

import { useFocusEffect, useRouter } from 'expo-router';
import { apiFetch, parseJson } from '../services/api';

import AppHeader from '../components/AppHeader';
import WebDateTimeInput from '../components/web-date-time-input';

import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import { useFonts } from 'expo-font';
import {
  syncMedicineReminders,
  cancelMedicineRemindersForMedicine,
  isValidMedicineTime,
} from '../services/notificationService';
import { requestReminderPermission } from '../services/reminderPermission';
import { confirmAction, showMessage } from '../utils/confirm-action';

import type { DateTimePickerEvent } from '@react-native-community/datetimepicker';

// ======================================================
// NATIVE DATE / TIME PICKERS (same pattern as Appointments)
// ======================================================

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

// Date format stored by the backend: "24 September 2026".
// The pickers below always produce this shape.
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

// Parse existing medicine strings ("24 September 2026",
// "2026-09-24", "24/09/2026") back into a Date for the picker.
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

// Parse "8:00 AM" / "20:30" into a Date used for the time picker.
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


// ======================================================
// COLORS
// ======================================================

const COLORS = {
  primaryBlue: '#1E76B6',
  darkBlue: '#155A8C',

  primaryGreen: '#39A78D',

  lightBlue: '#E7F2FA',
  lightGreen: '#E5F7F1',

  dangerRed: '#E2574C',

  background: '#EAF3F5',

  mainText: '#1D2B33',
  secondaryText: '#71858D',

  white: '#FFFFFF',

  border: '#D2E3E8',

  pendingBg: '#FFF0D2',
  pendingText: '#D99800',

  takenBg: '#DDF7EC',
  takenText: '#25A77E',

  missedBg: '#FDE5E3',
  missedText: '#D9534F',
};



// ======================================================
// TYPES
// ======================================================

type MedicineStatus =
  | 'Pending'
  | 'Taken'
  | 'Missed';


type MedicineSchedule = {
  id: string;

  time: string;

  quantity: number;
};


type MedicineDose = {
  doseId: string;

  time: string;

  quantity: number;

  status: MedicineStatus;
};


type Medicine = {
  id: string;

  name: string;

  dosage: string;

  timing: string;

  time: string;

  frequency: string;

  startDate: string;

  endDate: string;

  status: MedicineStatus;

  initialQuantity: number | null;

  remainingQuantity: number | null;

  unit: string;

  refillThreshold: number | null;

  dailyConsumption: number | null;

  refillReminderDays: number | null;

  estimatedRunOutDate: string | null;

  needsRefill: boolean;

  schedules: MedicineSchedule[];

  todayDoses: MedicineDose[];
};


// ======================================================
// HELPERS
// ======================================================

function formatMedicine(item: any): Medicine {

  const schedules: MedicineSchedule[] =
    Array.isArray(item.schedules) && item.schedules.length > 0
      ? item.schedules
          .filter((schedule: any) => schedule && schedule.time)
          .map((schedule: any) => ({
            id: String(schedule._id || schedule.id || 'default'),
            time: schedule.time || '',
            quantity:
              typeof schedule.quantity === 'number'
                ? schedule.quantity
                : 1,
          }))
      : item.time
      ? [{ id: 'default', time: item.time, quantity: 1 }]
      : [];

  const todayDoses: MedicineDose[] =
    Array.isArray(item.todayDoses) && item.todayDoses.length > 0
      ? item.todayDoses.map((dose: any) => ({
          doseId: String(dose.doseId || 'default'),
          time: dose.time || '',
          quantity:
            typeof dose.quantity === 'number' ? dose.quantity : 1,
          status: (dose.status as MedicineStatus) || 'Pending',
        }))
      : schedules.map((schedule) => ({
          doseId: schedule.id,
          time: schedule.time,
          quantity: schedule.quantity,
          status: 'Pending' as MedicineStatus,
        }));

  return {
    id: item._id || item.id,
    name: item.name || '',
    dosage: item.dosage || '',
    timing: item.timing || '',
    time: item.time || '',
    frequency: item.frequency || 'Once Daily',
    startDate: item.startDate || '',
    endDate: item.endDate || '',
    status: item.status || 'Pending',
    initialQuantity:
      typeof item.initialQuantity === 'number'
        ? item.initialQuantity
        : null,
    remainingQuantity:
      typeof item.remainingQuantity === 'number'
        ? item.remainingQuantity
        : null,
    unit: item.unit || '',
    refillThreshold:
      typeof item.refillThreshold === 'number'
        ? item.refillThreshold
        : null,
    dailyConsumption:
      typeof item.dailyConsumption === 'number'
        ? item.dailyConsumption
        : null,
    refillReminderDays:
      typeof item.refillReminderDays === 'number'
        ? item.refillReminderDays
        : null,
    estimatedRunOutDate: item.estimatedRunOutDate || null,
    needsRefill: Boolean(item.needsRefill),
    schedules,
    todayDoses,
  };
}


// ======================================================
// COMPONENT
// ======================================================

export default function MedicinesScreen() {

  const router = useRouter();

  const { width } =
    useResponsiveDimensions();


  // ====================================================
  // RESPONSIVE
  // ====================================================

  const isMobile =
    width < 600;

  const isDesktop =
    width >= 900;


  // ====================================================
  // FONTS
  // ====================================================

  const [fontsLoaded] =
    useFonts({

      Poppins_400Regular,

      Poppins_500Medium,

      Poppins_600SemiBold,

      Poppins_700Bold,

      Inter_400Regular,

      Inter_500Medium,

      Inter_600SemiBold,

      Inter_700Bold,

    });


  // ====================================================
  // STATE
  // ====================================================

  const [medicines, setMedicines] =
    useState<Medicine[]>([]);

  const [filter, setFilter] =
    useState<
      'All' |
      'Pending' |
      'Taken' |
      'Missed'
    >('All');


  const [modalVisible, setModalVisible] =
    useState(false);


  const [editingId, setEditingId] =
    useState<string | null>(null);


  const [medicineName, setMedicineName] =
    useState('');

  const [dosage, setDosage] =
    useState('');

  const [timing, setTiming] =
    useState('');

  const [frequency, setFrequency] =
    useState('Once Daily');

  const [scheduleRows, setScheduleRows] =
    useState<
      { id: string; time: string; quantity: string }[]
    >([{ id: '', time: '', quantity: '1' }]);

  const [startDate, setStartDate] =
    useState('');

  const [endDate, setEndDate] =
    useState('');


  // Native date/time picker state (mirrors the Appointments form).

  // Which date field the native picker is open for: start, end, or none.
  const [datePickerTarget, setDatePickerTarget] =
    useState<'start' | 'end' | null>(null);

  // Which schedule row's time picker is open (row index) or none.
  const [timePickerSlotIndex, setTimePickerSlotIndex] =
    useState<number | null>(null);


  // Refill / stock form fields

  const [initialQuantity, setInitialQuantity] =
    useState('');

  const [stockUnit, setStockUnit] =
    useState('');

  const [refillThreshold, setRefillThreshold] =
    useState('');

  const [dailyConsumption, setDailyConsumption] =
    useState('');

  const [refillReminderDays, setRefillReminderDays] =
    useState('');


  // Refill modal

  const [refillModalVisible, setRefillModalVisible] =
    useState(false);

  const [refillMedicine, setRefillMedicine] =
    useState<Medicine | null>(null);

  const [refillQuantity, setRefillQuantity] =
    useState('');

  const [refilling, setRefilling] =
    useState(false);

  // Per-row action state so buttons respond immediately and cannot be
  // double-submitted while a request is in flight.
  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [updatingDoses, setUpdatingDoses] =
    useState<Record<string, boolean>>({});

  const deleteInFlight = useRef(false);

  const doseUpdatesInFlight = useRef<Set<string>>(new Set());


  // ====================================================
  // LOAD MEDICINES FROM MONGODB
  // ====================================================

  const loadMedicines = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        Alert.alert('Login Required', 'Please login again.');
        router.replace('/');
        return;
      }

      const response = await apiFetch(`/api/medicines`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load medicines');
      }

      const serverMedicines = Array.isArray(data.medicines)
        ? data.medicines
        : Array.isArray(data)
        ? data
        : [];

      const formattedMedicines: Medicine[] = serverMedicines.map(
        formatMedicine
      );

      setMedicines(formattedMedicines);

      // Reconcile reminders after the list renders. The service matches by a
      // stable per-dose identifier, so unchanged doses are not recreated and
      // reopening the app never creates duplicates. Awaiting here guarantees
      // reminders are scheduled before saveMedicine() finishes.
      await syncMedicineReminders(
        formattedMedicines.map((medicine) => ({
          _id: medicine.id,
          name: medicine.name,
          dosage: medicine.dosage,
          timing: medicine.timing,
          time: medicine.time,
          frequency: medicine.frequency,
          startDate: medicine.startDate,
          endDate: medicine.endDate,
          schedules: medicine.schedules.map((schedule) => ({
            id: schedule.id,
            time: schedule.time,
            quantity: schedule.quantity,
          })),
        }))
      );
    } catch (error) {
      console.log('Medicine loading error:', error);
      Alert.alert('Error', 'Unable to load medicines from server.');
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      loadMedicines();
    }, [loadMedicines])
  );


  // ====================================================
  // RESET FORM
  // ====================================================

  const resetForm = () => {

    setMedicineName('');

    setDosage('');

    setTiming('');

    setScheduleRows([{ id: '', time: '', quantity: '1' }]);

    setFrequency('Once Daily');

    setStartDate('');

    setEndDate('');

    setDatePickerTarget(null);

    setTimePickerSlotIndex(null);

    setInitialQuantity('');

    setStockUnit('');

    setRefillThreshold('');

    setDailyConsumption('');

    setRefillReminderDays('');

    setEditingId(null);

  };


  // ====================================================
  // OPEN ADD MODAL
  // ====================================================

  const openAddMedicine = () => {

    resetForm();

    setModalVisible(true);

  };


  // ====================================================
  // OPEN EDIT MODAL
  // ====================================================

  const openEditMedicine = (
    medicine: Medicine
  ) => {

    setEditingId(
      medicine.id
    );

    setMedicineName(
      medicine.name
    );

    setDosage(
      medicine.dosage
    );

    setTiming(
      medicine.timing
    );

    setScheduleRows(
      medicine.schedules.length > 0
        ? medicine.schedules.map((schedule) => ({
            id: schedule.id,
            time: schedule.time,
            quantity: String(schedule.quantity),
          }))
        : [{ id: '', time: '', quantity: '1' }]
    );

    setFrequency(
      medicine.frequency
    );

    setStartDate(
      medicine.startDate
    );

    setEndDate(
      medicine.endDate
    );

    setDatePickerTarget(null);

    setTimePickerSlotIndex(null);

    setInitialQuantity(
      medicine.initialQuantity !== null
        ? String(medicine.initialQuantity)
        : ''
    );

    setStockUnit(
      medicine.unit || ''
    );

    setRefillThreshold(
      medicine.refillThreshold !== null
        ? String(medicine.refillThreshold)
        : ''
    );

    setDailyConsumption(
      medicine.dailyConsumption !== null
        ? String(medicine.dailyConsumption)
        : ''
    );

    setRefillReminderDays(
      medicine.refillReminderDays !== null
        ? String(medicine.refillReminderDays)
        : ''
    );

    setModalVisible(true);

  };


  // ====================================================
  // SCHEDULE ROWS
  // ====================================================

  const addScheduleRow = () => {

    setScheduleRows(
      (rows) => [
        ...rows,
        { id: '', time: '', quantity: '1' },
      ]
    );

  };

  const updateScheduleRow = (
    index: number,
    field: 'time' | 'quantity',
    value: string
  ) => {

    setScheduleRows(
      (rows) =>
        rows.map((row, rowIndex) =>
          rowIndex === index ? { ...row, [field]: value } : row
        )
    );

  };

  const removeScheduleRow = (index: number) => {

    setScheduleRows(
      (rows) =>
        rows.length <= 1 ? rows : rows.filter((_, i) => i !== index)
    );

  };


  // ====================================================
  // DATE / TIME PICKERS (same pattern as Appointments)
  // ====================================================

  const openDatePicker = (target: 'start' | 'end') => {
    setDatePickerTarget((current) =>
      current === target ? null : target
    );
  };

  const handleStartDateSelected = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    setDatePickerTarget(null);

    if (event.type === 'dismissed' || !selected) {
      return;
    }

    setStartDate(formatPickerDate(selected));
  };

  const handleEndDateSelected = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    setDatePickerTarget(null);

    if (event.type === 'dismissed' || !selected) {
      return;
    }

    setEndDate(formatPickerDate(selected));
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

    setScheduleRows((rows) =>
      rows.map((row, rowIndex) =>
        rowIndex === index
          ? { ...row, time: formatPickerTime(selected) }
          : row
      )
    );
  };


  // ====================================================
  // SAVE / UPDATE MEDICINE
  // ====================================================

  const saveMedicine = async () => {

    const validSchedules = scheduleRows
      .filter((row) => row.time.trim())
      .map((row) => ({
        id: row.id,
        time: row.time.trim(),
        quantity: Math.max(1, Number(row.quantity) || 1),
      }));

    if (
      !medicineName.trim() ||
      !dosage.trim() ||
      !timing.trim() ||
      validSchedules.length === 0
    ) {
      Alert.alert(
        'Missing Information',
        'Please fill Medicine Name, Dosage, Timing and at least one dose time.'
      );
      return;
    }

    // Reject unparseable times here so a reminder is never silently skipped.
    const invalidTime = validSchedules.find(
      (schedule) => !isValidMedicineTime(schedule.time)
    );

    if (invalidTime) {
      Alert.alert(
        'Invalid Dose Time',
        `"${invalidTime.time}" is not a valid time. Use a format such as 8:00 AM or 20:00.`
      );
      return;
    }

    // Keep the course ordered: end date cannot be before the start date.
    if (startDate.trim() && endDate.trim()) {
      const start = parsePickerDate(startDate);
      const end = parsePickerDate(endDate);

      if (
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime()) &&
        end.getTime() < start.getTime()
      ) {
        Alert.alert(
          'Invalid Dates',
          'End date must be the same day as or after the start date.'
        );
        return;
      }
    }

    // Ask for notification permission up front so a denial can be surfaced
    // instead of leaving the user with no reminders and no explanation.
    const remindersAllowed = await requestReminderPermission();

    const primaryTime = validSchedules[0].time;

    const derivedFrequency =
      validSchedules.length > 1
        ? `${validSchedules.length} times daily`
        : frequency || 'Once Daily';

    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        Alert.alert('Login Required', 'Please login again.');
        router.replace('/');
        return;
      }

      const medicineData: Record<string, unknown> = {
        name: medicineName.trim(),
        dosage: dosage.trim(),
        timing: timing.trim(),
        time: primaryTime,
        frequency: derivedFrequency,
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        initialQuantity: initialQuantity.trim(),
        unit: stockUnit.trim(),
        refillThreshold: refillThreshold.trim(),
        dailyConsumption: dailyConsumption.trim(),
        refillReminderDays: refillReminderDays.trim(),
        schedules: validSchedules.map((schedule) => ({
          ...(schedule.id && /^[a-f\d]{24}$/i.test(schedule.id)
            ? { _id: schedule.id }
            : {}),
          time: schedule.time,
          quantity: schedule.quantity,
        })),
      };

      // Starting stock only applies when creating; edits must not reset
      // the remaining quantity that refills/consumption have changed.
      if (!editingId) {
        medicineData.remainingQuantity = initialQuantity.trim();
      }

      const url = editingId
        ? `/api/medicines/${editingId}`
        : `/api/medicines`;

      const response = await apiFetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(medicineData),
      });

      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(data.message || 'Unable to save medicine');
      }

      // Reminders are reconciled in the background by loadMedicines() below,
      // which only recreates doses whose schedule actually changed.
      await loadMedicines();

      setModalVisible(false);
      resetForm();

      if (!remindersAllowed) {
        Alert.alert(
          'Reminders Are Off',
          Platform.OS === 'web'
            ? 'Notifications are blocked for Health Saathi in this browser, so medicine reminders will not appear. Allow notifications for this site in your browser settings to receive them.'
            : 'Notifications are disabled for Health Saathi, so medicine reminders will not appear. Enable notifications in your device settings to receive them.'
        );
      }
    } catch (error) {
      console.log('Medicine save error:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Unable to save medicine.'
      );
    }
  };


  // ====================================================
  // DELETE MEDICINE
// ====================================================

const deleteMedicine = async (id: string) => {
  if (deleteInFlight.current) return;

  // Lock immediately so a second tap cannot open another confirm dialog.
  deleteInFlight.current = true;

  try {
    const confirmed = await confirmAction({
      title: 'Delete Medicine',
      message:
        'Are you sure you want to delete this medicine? Its scheduled reminders will also be removed.',
      confirmText: 'Delete',
    });

    if (!confirmed) return;

    setDeletingId(id);

    const token = await AsyncStorage.getItem('authToken');

    if (!token) {
      showMessage('Login Required', 'Please login again.');
      router.replace('/');
      return;
    }

    const response = await apiFetch(`/api/medicines/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await parseJson(response);

    if (!response.ok) {
      throw new Error(data.message || 'Unable to delete medicine');
    }

    // Cancel scheduled reminders, but never fail the delete over a local
    // notification error.
    try {
      await cancelMedicineRemindersForMedicine(id);
    } catch (reminderError) {
      console.log('Reminder cancel error:', reminderError);
    }

    // Remove the row immediately instead of re-fetching the whole list.
    setMedicines((current) =>
      current.filter((medicine) => medicine.id !== id)
    );
  } catch (error) {
    console.log('Medicine delete error:', error);

    showMessage(
      'Error',
      error instanceof Error ? error.message : 'Unable to delete medicine.'
    );
  } finally {
    deleteInFlight.current = false;
    setDeletingId(null);
  }
};


  // ====================================================
  // MARK DOSE (per-dose status)
  // ====================================================

  const markDose = async (
    medicine: Medicine,
    dose: MedicineDose,
    status: 'Taken' | 'Missed'
  ) => {
    const doseKey = `${medicine.id}:${dose.doseId}`;

    if (doseUpdatesInFlight.current.has(doseKey)) return;
    if (dose.status === status) return;

    const previousStatus = dose.status;

    doseUpdatesInFlight.current.add(doseKey);

    setUpdatingDoses((current) => ({ ...current, [doseKey]: true }));

    // Optimistically show the new status right away instead of waiting for a
    // full list reload. This is what makes the button feel instant.
    setMedicines((current) =>
      current.map((item) =>
        item.id === medicine.id
          ? {
              ...item,
              todayDoses: item.todayDoses.map((entry) =>
                entry.doseId === dose.doseId
                  ? { ...entry, status }
                  : entry
              ),
            }
          : item
      )
    );

    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        showMessage('Login Required', 'Please login again.');
        router.replace('/');
        return;
      }

      const response = await apiFetch(
        `/api/medicines/${medicine.id}/doses/${dose.doseId}/status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            date: new Date().toISOString(),
          }),
        }
      );

      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(data.message || 'Unable to update dose status');
      }

      // Apply the authoritative server result (stock, overall status, doses)
      // without a second round trip.
      setMedicines((current) =>
        current.map((item) => {
          if (item.id !== medicine.id) return item;

          // Only reconcile this dose; other doses may still have optimistic
          // updates in flight and must not be overwritten by a stale response.
          const serverDose = Array.isArray(data.doses)
            ? data.doses.find(
                (entry: any) =>
                  String(entry.doseId) === String(dose.doseId)
              )
            : null;

          return {
            ...item,
            status: (data.medicineStatus as MedicineStatus) || item.status,
            todayDoses: item.todayDoses.map((entry) =>
              entry.doseId === dose.doseId
                ? {
                    ...entry,
                    status:
                      (serverDose?.status as MedicineStatus) || entry.status,
                  }
                : entry
            ),
            remainingQuantity:
              typeof data.stock?.remainingQuantity === 'number'
                ? data.stock.remainingQuantity
                : item.remainingQuantity,
            estimatedRunOutDate:
              data.stock?.estimatedRunOutDate ?? item.estimatedRunOutDate,
            needsRefill:
              typeof data.stock?.needsRefill === 'boolean'
                ? data.stock.needsRefill
                : item.needsRefill,
          };
        })
      );
    } catch (error) {
      console.log('Dose status update error:', error);

      // Revert the optimistic change so the UI matches the server.
      setMedicines((current) =>
        current.map((item) =>
          item.id === medicine.id
            ? {
                ...item,
                todayDoses: item.todayDoses.map((entry) =>
                  entry.doseId === dose.doseId
                    ? { ...entry, status: previousStatus }
                    : entry
                ),
              }
            : item
        )
      );

      showMessage(
        'Error',
        error instanceof Error
          ? error.message
          : 'Unable to update dose status.'
      );
    } finally {
      doseUpdatesInFlight.current.delete(doseKey);
      setUpdatingDoses((current) => {
        const next = { ...current };
        delete next[doseKey];
        return next;
      });
    }
  };


  // ====================================================
  // REFILL
  // ====================================================

  const openRefillModal = (medicine: Medicine) => {
    setRefillMedicine(medicine);
    setRefillQuantity('');
    setRefillModalVisible(true);
  };

  const closeRefillModal = () => {
    setRefillModalVisible(false);
    setRefillMedicine(null);
    setRefillQuantity('');
  };

  const submitRefill = async () => {
    if (!refillMedicine) return;

    const qty = Number(refillQuantity);

    if (!refillQuantity.trim() || !Number.isFinite(qty) || qty <= 0) {
      Alert.alert('Invalid Quantity', 'Enter a quantity greater than 0.');
      return;
    }

    try {
      setRefilling(true);

      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        Alert.alert('Login Required', 'Please login again.');
        router.replace('/');
        return;
      }

      const response = await apiFetch(
        `/api/medicines/${refillMedicine.id}/refill`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            quantityAdded: qty,
            unit: refillMedicine.unit || undefined,
          }),
        }
      );

      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(data.message || 'Unable to record refill');
      }

      await loadMedicines();

      Alert.alert(
        'Refill Recorded',
        `Added ${qty} ${refillMedicine.unit || 'units'}. New stock: ${
          data.newQuantity ?? ''
        }.`
      );

      closeRefillModal();
    } catch (error) {
      console.log('Refill error:', error);

      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Unable to record refill.'
      );
    } finally {
      setRefilling(false);
    }
  };

  const formatRunOutDate = (value: string) => {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };


  // ====================================================
  // FILTER
  // ====================================================

  const filteredMedicines =
    filter === 'All'
      ? medicines
      : medicines.filter(
          medicine =>
            medicine.status ===
            filter
        );


  // ====================================================
  // STATUS BADGE
  // ====================================================

  const StatusBadge = ({
    status,
  }: {
    status: MedicineStatus;
  }) => {

    if (status === 'Taken') {

      return (

        <View
          style={[
            styles.statusBadge,
            styles.takenBadge,
          ]}
        >

          <Ionicons
            name="checkmark-circle"
            size={15}
            color={
              COLORS.takenText
            }
          />

          <Text
            style={[
              styles.statusText,
              {
                color:
                  COLORS.takenText,
              },
            ]}
          >
            Taken
          </Text>

        </View>

      );

    }


    if (status === 'Missed') {

      return (

        <View
          style={[
            styles.statusBadge,
            styles.missedBadge,
          ]}
        >

          <Ionicons
            name="warning-outline"
            size={15}
            color={
              COLORS.missedText
            }
          />

          <Text
            style={[
              styles.statusText,
              {
                color:
                  COLORS.missedText,
              },
            ]}
          >
            Missed
          </Text>

        </View>

      );

    }


    return (

      <View
        style={[
          styles.statusBadge,
          styles.pendingBadge,
        ]}
      >

        <Ionicons
          name="time-outline"
          size={15}
          color={
            COLORS.pendingText
          }
        />

        <Text
          style={[
            styles.statusText,
            {
              color:
                COLORS.pendingText,
            },
          ]}
        >
          Pending
        </Text>

      </View>

    );

  };


  // ====================================================
  // MEDICINE ROW
  // ====================================================

  const MedicineRow = ({
    medicine,
  }: {
    medicine: Medicine;
  }) => (

    <View
      style={[
        styles.medicineRow,

        isMobile &&
          styles.medicineRowMobile,
      ]}
    >

      {/* LEFT */}

      <View
        style={
          styles.medicineMain
        }
      >

        <View
          style={
            styles.medicineIcon
          }
        >

          <Ionicons
            name="medical-outline"
            size={27}
            color={
              COLORS.primaryBlue
            }
          />

        </View>


        <View
          style={
            styles.medicineInfo
          }
        >

          <View
            style={
              styles.medicineNameRow
            }
          >

            <Text
              style={
                styles.medicineName
              }
            >
              {medicine.name}
            </Text>


            <Text
              style={
                styles.medicineDosage
              }
            >
              {medicine.dosage}
            </Text>

          </View>


          <Text
            style={
              styles.medicineDetails
            }
          >
            {formatDisplayTime(medicine.time)}
            {' Â· '}
            {medicine.timing}
          </Text>

          {medicine.todayDoses.length > 0 && (
            <View
              style={
                styles.doseList
              }
            >

              {medicine.todayDoses.map(
                (dose) => (
                  <View
                    key={dose.doseId}
                    style={
                      styles.doseRow
                    }
                  >

                    <Text
                      style={
                        styles.doseTime
                      }
                    >
                      {formatDisplayTime(dose.time)}

                      {dose.quantity > 1
                        ? ` Â· ${dose.quantity} doses`
                        : ''}
                    </Text>


                    <StatusBadge
                      status={
                        dose.status
                      }
                    />


                    {dose.status ===
                      'Pending' && (
                      <View
                        style={
                          styles.doseActions
                        }
                      >

                        <Pressable
                          onPress={() =>
                            markDose(
                              medicine,
                              dose,
                              'Taken'
                            )
                          }

                          disabled={Boolean(
                            updatingDoses[
                              `${medicine.id}:${dose.doseId}`
                            ]
                          )}

                          style={[
                            styles.doseActionButton,

                            Boolean(
                              updatingDoses[
                                `${medicine.id}:${dose.doseId}`
                              ]
                            ) &&
                              styles.doseActionButtonDisabled,
                          ]}
                        >

                          <Text
                            style={
                              styles.doseActionText
                            }
                          >
                            Taken
                          </Text>

                        </Pressable>


                        <Pressable
                          onPress={() =>
                            markDose(
                              medicine,
                              dose,
                              'Missed'
                            )
                          }

                          disabled={Boolean(
                            updatingDoses[
                              `${medicine.id}:${dose.doseId}`
                            ]
                          )}

                          style={[
                            styles.doseActionButton,

                            Boolean(
                              updatingDoses[
                                `${medicine.id}:${dose.doseId}`
                              ]
                            ) &&
                              styles.doseActionButtonDisabled,
                          ]}
                        >

                          <Text
                            style={
                              styles.doseActionText
                            }
                          >
                            Missed
                          </Text>

                        </Pressable>

                      </View>
                    )}

                  </View>
                )
              )}

            </View>
          )}

          {medicine.remainingQuantity !== null ? (
            <View
              style={
                styles.stockRow
              }
            >

              <Ionicons
                name="cube-outline"
                size={13}
                color={
                  COLORS.secondaryText
                }
              />

              <Text
                style={
                  styles.stockText
                }
              >
                {medicine.remainingQuantity}
                {' '}
                {medicine.unit || 'units'}
                {medicine.estimatedRunOutDate
                  ? ` Â· runs out ${formatRunOutDate(
                      medicine.estimatedRunOutDate
                    )}`
                  : ''}
              </Text>

            </View>
          ) : (
            <Text
              style={
                styles.stockMuted
              }
            >
              Stock not tracked
            </Text>
          )}

          {medicine.needsRefill && (
            <View
              style={
                styles.lowStockBadge
              }
            >

              <Ionicons
                name="alert-circle-outline"
                size={13}
                color={
                  COLORS.missedText
                }
              />

              <Text
                style={
                  styles.lowStockText
                }
              >
                Refill needed
              </Text>

            </View>
          )}

        </View>

      </View>


      {/* RIGHT */}

      <View
        style={[
          styles.medicineRight,

          isMobile &&
            styles.medicineRightMobile,
        ]}
      >

        <StatusBadge
          status={
            medicine.status
          }
        />


        <View
          style={
            styles.actionRow
          }
        >

          <Pressable
            onPress={() =>
              openRefillModal(
                medicine
              )
            }

            style={
              styles.actionButton
            }
          >

            <Text
              style={[
                styles.actionText,
                {
                  color: COLORS.primaryBlue,
                },
              ]}
            >
              Refill
            </Text>

          </Pressable>


          <Pressable
            onPress={() =>
              openEditMedicine(
                medicine
              )
            }

            style={
              styles.iconButton
            }
          >

            <Ionicons
              name="create-outline"
              size={20}
              color={
                COLORS.mainText
              }
            />

          </Pressable>


          <Pressable
            onPress={() =>
              deleteMedicine(
                medicine.id
              )
            }

            disabled={
              deletingId === medicine.id
            }

            style={[
              styles.iconButton,

              deletingId === medicine.id &&
                styles.iconButtonDisabled,
            ]}
          >

            {deletingId === medicine.id ? (
              <ActivityIndicator
                size="small"
                color={COLORS.dangerRed}
              />
            ) : (
              <Ionicons
                name="trash-outline"
                size={20}
                color={
                  COLORS.dangerRed
                }
              />
            )}

          </Pressable>

        </View>

      </View>

    </View>

  );


  // ====================================================
  // FONT LOADING
  // ====================================================

  if (!fontsLoaded) {

    return null;

  }


  // ====================================================
  // MAIN UI
  // ====================================================

  return (

    <SafeAreaView
      style={styles.screen}
      edges={['top', 'bottom']}
    >

      {/* ================================================= */}
      {/* HEADER (shared across all screens) */}
      {/* ================================================= */}

      <AppHeader />

      {/* ================================================= */}
      {/* CONTENT */}
      {/* ================================================= */}

      <ScrollView
        style={
          styles.scroll
        }

        contentContainerStyle={[
          styles.content,

          isMobile &&
            styles.contentMobile,
        ]}

        showsVerticalScrollIndicator={
          false
        }
      >

        {/* ================================================= */}
        {/* TITLE */}
        {/* ================================================= */}

        <View
          style={[
            styles.titleSection,

            isMobile &&
              styles.titleSectionMobile,
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
              Medicines
            </Text>


            <Text
              style={
                styles.subtitle
              }
            >
              Stay on track with every dose.
            </Text>

          </View>


          <Pressable
            onPress={
              openAddMedicine
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
              Add Medicine
            </Text>

          </Pressable>

        </View>


        {/* ================================================= */}
        {/* MEDICINE HISTORY BUTTON */}
        {/* ================================================= */}

        <Pressable
          onPress={() =>
            router.push(
              '/history'
            )
          }

          style={
            styles.historyButton
          }
        >

          <View
            style={
              styles.historyButtonLeft
            }
          >

            <View
              style={
                styles.historyIcon
              }
            >

              <Ionicons
                name="time-outline"
                size={22}
                color={
                  COLORS.primaryBlue
                }
              />

            </View>


            <View>

              <Text
                style={
                  styles.historyButtonTitle
                }
              >
                Medicine History
              </Text>


              <Text
                style={
                  styles.historyButtonSubtitle
                }
              >
                View your taken and missed doses
              </Text>

            </View>

          </View>


          <Ionicons
            name="chevron-forward"
            size={22}
            color={
              COLORS.secondaryText
            }
          />

        </Pressable>


        {/* ================================================= */}
        {/* FILTERS */}
        {/* ================================================= */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }

          contentContainerStyle={
            styles.filters
          }
        >

          {[
            'All',
            'Pending',
            'Taken',
            'Missed',
          ].map(
            item => (

              <Pressable
                key={item}

                onPress={() =>
                  setFilter(
                    item as
                      | 'All'
                      | 'Pending'
                      | 'Taken'
                      | 'Missed'
                  )
                }

                style={[
                  styles.filterButton,

                  filter === item &&
                    styles.filterActive,
                ]}
              >

                <Text
                  style={[
                    styles.filterText,

                    filter === item &&
                      styles.filterTextActive,
                  ]}
                >
                  {item}
                </Text>

              </Pressable>

            )
          )}

        </ScrollView>


        {/* ================================================= */}
        {/* MEDICINES CARD */}
        {/* ================================================= */}

        <View
          style={
            styles.medicinesCard
          }
        >

          {filteredMedicines.length === 0 ? (

            <View
              style={
                styles.empty
              }
            >

              <Ionicons
                name="medical-outline"
                size={50}
                color={
                  COLORS.primaryBlue
                }
              />


              <Text
                style={
                  styles.emptyTitle
                }
              >
                No medicines found
              </Text>


              <Text
                style={
                  styles.emptyText
                }
              >
                There are no medicines in this category.
              </Text>

            </View>

          ) : (

            filteredMedicines.map(
              medicine => (

                <MedicineRow
                  key={
                    medicine.id
                  }

                  medicine={
                    medicine
                  }
                />

              )
            )

          )}

        </View>


        <View
          style={{
            height: 100,
          }}
        />

      </ScrollView>


      {/* ================================================= */}
      {/* ADD / EDIT MODAL */}
      {/* ================================================= */}

      <Modal
        visible={
          modalVisible
        }

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

          <View
            style={[
              styles.modal,

              isMobile &&
                styles.modalMobile,
            ]}
          >

            {/* MODAL HEADER */}

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
                    ? 'Edit Medicine'
                    : 'Add Medicine'}
                </Text>


                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  {editingId
                    ? 'Update your medicine reminder.'
                    : 'Set a reminder for your medicine.'}
                </Text>

              </View>


              <Pressable
                onPress={() => {

                  setModalVisible(
                    false
                  );

                  resetForm();

                }}
              >

                <Ionicons
                  name="close"
                  size={25}
                  color={
                    COLORS.mainText
                  }
                />

              </Pressable>

            </View>


            {/* FORM */}

            <ScrollView
              style={
                styles.modalForm
              }

              contentContainerStyle={
                styles.modalFormContent
              }

              showsVerticalScrollIndicator={
                false
              }

              keyboardShouldPersistTaps="handled"
            >

              {/* MEDICINE NAME */}

              <View
                style={[
                  styles.field,

                  isDesktop &&
                    styles.fieldHalf,
                ]}
              >

                <Text
                  style={
                    styles.label
                  }
                >
                  Medicine Name
                </Text>


                <TextInput
                  value={
                    medicineName
                  }

                  onChangeText={
                    setMedicineName
                  }

                  placeholder="e.g. Metformin"

                  placeholderTextColor={
                    COLORS.secondaryText
                  }

                  style={
                    styles.input
                  }
                />

              </View>


              {/* DOSAGE */}

              <View
                style={[
                  styles.field,

                  isDesktop &&
                    styles.fieldHalf,
                ]}
              >

                <Text
                  style={
                    styles.label
                  }
                >
                  Dosage
                </Text>


                <TextInput
                  value={
                    dosage
                  }

                  onChangeText={
                    setDosage
                  }

                  placeholder="e.g. 500mg"

                  placeholderTextColor={
                    COLORS.secondaryText
                  }

                  style={
                    styles.input
                  }
                />

              </View>


              {/* TIMING */}

              <View
                style={[
                  styles.field,

                  isDesktop &&
                    styles.fieldHalf,
                ]}
              >

                <Text
                  style={
                    styles.label
                  }
                >
                  Timing
                </Text>


                <TextInput
                  value={
                    timing
                  }

                  onChangeText={
                    setTiming
                  }

                  placeholder="e.g. After Breakfast"

                  placeholderTextColor={
                    COLORS.secondaryText
                  }

                  style={
                    styles.input
                  }
                />

              </View>


              {/* SCHEDULE (DOSE TIMES) */}

              <View
                style={[
                  styles.field,

                  styles.fieldFull,
                ]}
              >

                <Text
                  style={
                    styles.label
                  }
                >
                  Dose times per day
                </Text>


                {scheduleRows.map(
                  (row, index) => (
                    <View
                      key={`schedule-${index}`}
                      style={
                        styles.scheduleRow
                      }
                    >

                      {Platform.OS === 'web' ? (
                        <WebDateTimeInput
                          mode="time"
                          value={row.time}
                          onChange={(value) =>
                            updateScheduleRow(
                              index,
                              'time',
                              value
                            )
                          }
                          placeholder="Select time"
                          style={{
                            flex: 1,
                            width: 'auto',
                            minHeight: 52,
                            backgroundColor: '#E7F3F5',
                            borderColor: '#C9E0E5',
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


                      <View
                        style={
                          styles.scheduleQtyRemoveWrapper
                        }
                      >

                        <TextInput
                          value={
                            row.quantity
                          }

                          onChangeText={(value) =>
                            updateScheduleRow(
                              index,
                              'quantity',
                              value
                            )
                          }

                          placeholder="Qty"

                          keyboardType="numeric"

                          placeholderTextColor={
                            COLORS.secondaryText
                          }

                          style={[
                            styles.input,
                            styles.scheduleQtyInput,
                          ]}
                        />


                        <Pressable
                          onPress={() =>
                            removeScheduleRow(index)
                          }

                          style={
                            styles.scheduleRemoveButton
                          }
                        >

                          <Ionicons
                            name="close-outline"
                            size={20}
                            color={
                              COLORS.missedText
                            }
                          />

                        </Pressable>

                      </View>

                    </View>
                  )
                )}


                {timePickerSlotIndex !== null &&
                  isDateTimePickerSupported &&
                  NativeDateTimePicker && (
                    <NativeDateTimePicker
                      value={parsePickerTime(
                        scheduleRows[timePickerSlotIndex]?.time || ''
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
                  onPress={
                    addScheduleRow
                  }

                  style={
                    styles.addScheduleButton
                  }
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


              {/* FREQUENCY */}

              <View
                style={[
                  styles.field,

                  isDesktop &&
                    styles.fieldHalf,
                ]}
              >

                <Text
                  style={
                    styles.label
                  }
                >
                  Frequency
                </Text>


                <TextInput
                  value={
                    frequency
                  }

                  onChangeText={
                    setFrequency
                  }

                  placeholder="Once Daily"

                  placeholderTextColor={
                    COLORS.secondaryText
                  }

                  style={
                    styles.input
                  }
                />

              </View>


              {/* START DATE */}

              <View
                style={[
                  styles.field,

                  isDesktop &&
                    styles.fieldHalf,
                ]}
              >

                <Text
                  style={
                    styles.label
                  }
                >
                  Start Date
                </Text>


                {Platform.OS === 'web' ? (
                  <WebDateTimeInput
                    mode="date"
                    value={startDate}
                    onChange={setStartDate}
                    ariaLabel="Start date"
                    placeholder="Select date"
                    style={{
                      minHeight: 52,
                      backgroundColor: '#E7F3F5',
                      borderColor: '#C9E0E5',
                    }}
                  />
                ) : (
                  <Pressable
                    onPress={() => openDatePicker('start')}

                    style={[
                      styles.input,
                      styles.pickerField,
                    ]}
                  >

                    <Text
                      style={[
                        styles.pickerFieldText,

                        !startDate &&
                          styles.pickerFieldPlaceholder,
                      ]}
                    >
                      {startDate || 'Select date'}
                    </Text>

                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={
                        startDate
                          ? COLORS.primaryBlue
                          : COLORS.secondaryText
                      }
                    />

                  </Pressable>
                )}


                {datePickerTarget === 'start' &&
                  isDateTimePickerSupported &&
                  NativeDateTimePicker && (
                    <NativeDateTimePicker
                      value={parsePickerDate(startDate)}
                      mode="date"
                      display={
                        Platform.OS === 'ios'
                          ? 'spinner'
                          : 'default'
                      }
                      onChange={handleStartDateSelected}
                      maximumDate={
                        new Date(2100, 11, 31)
                      }
                    />
                  )}

              </View>


              {/* END DATE */}

              <View
                style={[
                  styles.field,

                  isDesktop &&
                    styles.fieldHalf,
                ]}
              >

                <Text
                  style={
                    styles.label
                  }
                >
                  End Date
                </Text>


                {Platform.OS === 'web' ? (
                  <WebDateTimeInput
                    mode="date"
                    value={endDate}
                    onChange={setEndDate}
                    ariaLabel="End date"
                    placeholder="Select date"
                    style={{
                      minHeight: 52,
                      backgroundColor: '#E7F3F5',
                      borderColor: '#C9E0E5',
                    }}
                  />
                ) : (
                  <Pressable
                    onPress={() => openDatePicker('end')}

                    style={[
                      styles.input,
                      styles.pickerField,
                    ]}
                  >

                    <Text
                      style={[
                        styles.pickerFieldText,

                        !endDate &&
                          styles.pickerFieldPlaceholder,
                      ]}
                    >
                      {endDate || 'Select date'}
                    </Text>

                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={
                        endDate
                          ? COLORS.primaryBlue
                          : COLORS.secondaryText
                      }
                    />

                  </Pressable>
                )}


                {datePickerTarget === 'end' &&
                  isDateTimePickerSupported &&
                  NativeDateTimePicker && (
                    <NativeDateTimePicker
                      value={parsePickerDate(endDate)}
                      mode="date"
                      display={
                        Platform.OS === 'ios'
                          ? 'spinner'
                          : 'default'
                      }
                      onChange={handleEndDateSelected}
                      maximumDate={
                        new Date(2100, 11, 31)
                      }
                    />
                  )}

              </View>


              {/* STOCK & REFILL */}

              <Text
                style={[
                  styles.sectionLabel,
                  isDesktop && styles.fieldFull,
                ]}
              >
                Stock & Refill
              </Text>


              <View
                style={[
                  styles.field,

                  isDesktop &&
                    styles.fieldHalf,
                ]}
              >

                <Text
                  style={
                    styles.label
                  }
                >
                  Initial Quantity
                </Text>


                <TextInput
                  value={
                    initialQuantity
                  }

                  onChangeText={
                    setInitialQuantity
                  }

                  keyboardType="numeric"

                  placeholder="e.g. 30"

                  placeholderTextColor={
                    COLORS.secondaryText
                  }

                  style={
                    styles.input
                  }
                />

              </View>


              <View
                style={[
                  styles.field,

                  isDesktop &&
                    styles.fieldHalf,
                ]}
              >

                <Text
                  style={
                    styles.label
                  }
                >
                  Unit
                </Text>


                <TextInput
                  value={
                    stockUnit
                  }

                  onChangeText={
                    setStockUnit
                  }

                  placeholder="e.g. tablets"

                  placeholderTextColor={
                    COLORS.secondaryText
                  }

                  style={
                    styles.input
                  }
                />

              </View>


              <View
                style={[
                  styles.field,

                  isDesktop &&
                    styles.fieldHalf,
                ]}
              >

                <Text
                  style={
                    styles.label
                  }
                >
                  Refill Threshold
                </Text>


                <TextInput
                  value={
                    refillThreshold
                  }

                  onChangeText={
                    setRefillThreshold
                  }

                  keyboardType="numeric"

                  placeholder="e.g. 5"

                  placeholderTextColor={
                    COLORS.secondaryText
                  }

                  style={
                    styles.input
                  }
                />

              </View>


              <View
                style={[
                  styles.field,

                  isDesktop &&
                    styles.fieldHalf,
                ]}
              >

                <Text
                  style={
                    styles.label
                  }
                >
                  Daily Consumption
                </Text>


                <TextInput
                  value={
                    dailyConsumption
                  }

                  onChangeText={
                    setDailyConsumption
                  }

                  keyboardType="numeric"

                  placeholder="e.g. 2"

                  placeholderTextColor={
                    COLORS.secondaryText
                  }

                  style={
                    styles.input
                  }
                />

              </View>


              <View
                style={[
                  styles.field,

                  isDesktop &&
                    styles.fieldHalf,
                ]}
              >

                <Text
                  style={
                    styles.label
                  }
                >
                  Refill Reminder (days)
                </Text>


                <TextInput
                  value={
                    refillReminderDays
                  }

                  onChangeText={
                    setRefillReminderDays
                  }

                  keyboardType="numeric"

                  placeholder="e.g. 3"

                  placeholderTextColor={
                    COLORS.secondaryText
                  }

                  style={
                    styles.input
                  }
                />

              </View>

            </ScrollView>


            {/* ================================================= */}
            {/* MODAL BUTTONS (fixed footer, outside scroll) */}
            {/* ================================================= */}

            <View
              style={[
                styles.modalButtonsFooter,
              ]}
            >

              <Pressable
                onPress={() => {

                  setModalVisible(
                    false
                  );

                  resetForm();

                }}

                style={
                  styles.cancelButton
                }
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
                  saveMedicine
                }

                style={
                  styles.saveButton
                }
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
                    : 'Save Reminder'}
                </Text>

              </Pressable>

            </View>

          </View>

        </View>

      </Modal>


      {/* ================================================= */}
      {/* REFILL MODAL */}
      {/* ================================================= */}

      <Modal
        visible={refillModalVisible}

        transparent

        animationType="fade"

        onRequestClose={closeRefillModal}
      >

        <View
          style={
            styles.modalOverlay
          }
        >

          <View
            style={[
              styles.modal,

              isMobile &&
                styles.modalMobile,

              {
                maxWidth: 420,
              },
            ]}
          >

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
                  Record Refill
                </Text>


                <Text
                  style={
                    styles.modalSubtitle
                  }
                >
                  {refillMedicine
                    ? `${refillMedicine.name} Â· ${
                        refillMedicine.remainingQuantity ?? 0
                      } ${refillMedicine.unit || 'units'} in stock`
                    : ''}
                </Text>

              </View>


              <Pressable
                onPress={closeRefillModal}
              >

                <Ionicons
                  name="close"
                  size={25}
                  color={
                    COLORS.mainText
                  }
                />

              </Pressable>

            </View>


            <View
              style={
                styles.field
              }
            >

              <Text
                style={
                  styles.label
                }
              >
                Quantity Added
              </Text>


              <TextInput
                value={
                  refillQuantity
                }

                onChangeText={
                  setRefillQuantity
                }

                keyboardType="numeric"

                placeholder="e.g. 30"

                placeholderTextColor={
                  COLORS.secondaryText
                }

                style={
                  styles.input
                }
              />

            </View>


            <View
              style={[
                styles.modalButtons,

                isMobile &&
                  styles.modalButtonsMobile,
              ]}
            >

              <Pressable
                onPress={closeRefillModal}

                style={
                  styles.cancelButton
                }
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
                onPress={submitRefill}

                disabled={refilling}

                style={[
                  styles.saveButton,

                  refilling && {
                    opacity: 0.6,
                  },
                ]}
              >

                <Ionicons
                  name="add-circle-outline"
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
                  {refilling ? 'Saving...' : 'Save Refill'}
                </Text>

              </Pressable>

            </View>

          </View>

        </View>

      </Modal>


      {/* ================================================= */}
      {/* BOTTOM NAVIGATION (same design as Appointments) */}
      {/* ================================================= */}

      <View
        style={[
          styles.bottomNav,
          isDesktop && styles.bottomNavDesktop,
        ]}
      >

        <Pressable
          onPress={() =>
            router.push(
              '/home'
            )
          }

          style={
            styles.bottomTab
          }
        >

          <Ionicons
            name="home-outline"
            size={23}
            color={
              COLORS.secondaryText
            }
          />

          <Text
            style={
              styles.bottomText
            }
          >
            Home
          </Text>

        </Pressable>


        <Pressable
          style={[
            styles.bottomTab,
            styles.bottomTabActive,
          ]}
        >

          <Ionicons
            name="medical-outline"
            size={23}
            color={
              COLORS.primaryBlue
            }
          />

          <Text
            style={[
              styles.bottomText,
              styles.bottomTextActive,
            ]}
          >
            Medicines
          </Text>

        </Pressable>


        <Pressable
          onPress={() =>
            router.push(
              '/appointments'
            )
          }

          style={
            styles.bottomTab
          }
        >

          <Ionicons
            name="calendar-outline"
            size={23}
            color={
              COLORS.secondaryText
            }
          />

          <Text
            style={
              styles.bottomText
            }
          >
            Appointments
          </Text>

        </Pressable>


        <Pressable
          onPress={() =>
            router.push(
              '/profile'
            )
          }

          style={
            styles.bottomTab
          }
        >

          <Ionicons
            name="person-outline"
            size={23}
            color={
              COLORS.secondaryText
            }
          />

          <Text
            style={
              styles.bottomText
            }
          >
            Profile
          </Text>

        </Pressable>

      </View>

    </SafeAreaView>

  );

}


// ======================================================
// STYLES
// ======================================================

const styles =
  StyleSheet.create({

  screen: {
    flex: 1,

    backgroundColor:
      COLORS.background,
  },


  scroll: {
    flex: 1,
  },


  // ====================================================
  // HEADER
  // ====================================================

  header: {
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
  },


  headerMobile: {
    height: 76,

    paddingHorizontal: 18,
  },


  welcome: {
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

    justifyContent: 'center',
  },


  avatarWithPhoto: {
    overflow: 'hidden',
  },

  avatarPhoto: {
    width: 48,

    height: 48,
  },


  avatarText: {
    fontFamily:
      'Poppins_700Bold',

    fontSize: 17,

    color:
      COLORS.white,
  },


  // ====================================================
  // CONTENT
  // ====================================================

  content: {
    paddingHorizontal: 32,

    paddingTop: 28,
  },


  contentMobile: {
    paddingHorizontal: 16,

    paddingTop: 22,
  },


  // ====================================================
  // TITLE
  // ====================================================

  titleSection: {
    flexDirection: 'row',

    justifyContent:
      'space-between',

    alignItems: 'center',

    marginBottom: 20,

    gap: 15,
  },


  titleSectionMobile: {
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


  subtitle: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 18,

    color:
      COLORS.secondaryText,

    marginTop: 2,
  },


  // ====================================================
  // ADD BUTTON
  // ====================================================

  addButton: {
    minHeight: 50,

    backgroundColor:
      COLORS.primaryBlue,

    borderRadius: 7,

    paddingHorizontal: 18,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 7,

    flexShrink: 0,
  },


  addButtonMobile: {
    width: '100%',

    minHeight: 46,

    paddingHorizontal: 13,
  },


  addButtonText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 15,

    color:
      COLORS.white,
  },


  // ====================================================
  // HISTORY BUTTON
  // ====================================================

  historyButton: {
    minHeight: 72,

    backgroundColor:
      COLORS.white,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    borderRadius: 9,

    paddingHorizontal: 18,

    marginBottom: 16,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',
  },


  historyButtonLeft: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 13,
  },


  historyIcon: {
    width: 43,

    height: 43,

    borderRadius: 8,

    backgroundColor:
      COLORS.lightBlue,

    alignItems: 'center',

    justifyContent: 'center',
  },


  historyButtonTitle: {
    fontFamily:
      'Poppins_600SemiBold',

    fontSize: 16,

    color:
      COLORS.mainText,
  },


  historyButtonSubtitle: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 12,

    color:
      COLORS.secondaryText,

    marginTop: 2,
  },


  // ====================================================
  // FILTERS
  // ====================================================

  filters: {
    gap: 9,

    paddingBottom: 18,
  },


  filterButton: {
    minHeight: 48,

    paddingHorizontal: 18,

    borderRadius: 7,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    backgroundColor:
      COLORS.white,

    alignItems: 'center',

    justifyContent: 'center',
  },


  filterActive: {
    backgroundColor:
      COLORS.primaryBlue,

    borderColor:
      COLORS.primaryBlue,
  },


  filterText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 15,

    color:
      COLORS.mainText,
  },


  filterTextActive: {
    color:
      COLORS.white,

    fontFamily:
      'Inter_600SemiBold',
  },


  // ====================================================
  // MEDICINES CARD
  // ====================================================

  medicinesCard: {
    backgroundColor:
      COLORS.white,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    borderRadius: 9,

    paddingHorizontal: 23,

    paddingVertical: 8,

    width: '100%',

    maxWidth: 980,

    alignSelf: 'center',
  },


  // ====================================================
  // MEDICINE ROW
  // ====================================================

  medicineRow: {
    minHeight: 120,

    paddingVertical: 18,

    borderBottomWidth: 1,

    borderBottomColor:
      COLORS.border,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    gap: 20,
  },


  medicineRowMobile: {
    minHeight: 180,

    flexDirection: 'column',

    alignItems: 'stretch',

    justifyContent: 'center',

    gap: 13,
  },


  medicineMain: {
    flexDirection: 'row',

    alignItems: 'center',

    flex: 1,
  },


  medicineIcon: {
    width: 51,

    height: 51,

    borderRadius: 8,

    backgroundColor:
      '#D4ECFA',

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 14,
  },


  medicineInfo: {
    flex: 1,
  },


  medicineNameRow: {
    flexDirection: 'row',

    alignItems: 'baseline',

    flexWrap: 'wrap',

    gap: 5,
  },


  medicineName: {
    fontFamily:
      'Poppins_600SemiBold',

    fontSize: 18,

    color:
      COLORS.mainText,
  },


  medicineDosage: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 16,

    color:
      COLORS.secondaryText,
  },


  medicineDetails: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 15,

    color:
      COLORS.secondaryText,

    marginTop: 3,
  },


  doseList: {
    marginTop: 8,

    gap: 6,
  },


  doseRow: {
    flexDirection: 'row',

    alignItems: 'center',

    flexWrap: 'wrap',

    gap: 8,
  },


  doseTime: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 13,

    color:
      COLORS.mainText,

    minWidth: 74,
  },


  doseActions: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 12,
  },


  doseActionButton: {
    paddingHorizontal: 3,

    paddingVertical: 4,
  },

  doseActionButtonDisabled: {
    opacity: 0.5,
  },


  doseActionText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 12,

    color:
      COLORS.primaryBlue,
  },


  medicineRight: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 18,
  },


  medicineRightMobile: {
    flexDirection: 'row',

    justifyContent:
      'space-between',

    width: '100%',
  },


  // ====================================================
  // STATUS
  // ====================================================

  statusBadge: {
    minHeight: 32,

    paddingHorizontal: 12,

    borderRadius: 18,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 5,
  },


  takenBadge: {
    backgroundColor:
      COLORS.takenBg,
  },


  pendingBadge: {
    backgroundColor:
      COLORS.pendingBg,
  },


  missedBadge: {
    backgroundColor:
      COLORS.missedBg,
  },


  statusText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 13,
  },


  // ====================================================
  // ACTIONS
  // ====================================================

  actionRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 9,
  },


  actionButton: {
    paddingHorizontal: 3,

    paddingVertical: 8,
  },


  actionText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 13,

    color:
      COLORS.mainText,
  },


  iconButton: {
    width: 34,

    height: 34,

    alignItems: 'center',

    justifyContent: 'center',
  },

  iconButtonDisabled: {
    opacity: 0.5,
  },


  // ====================================================
  // EMPTY
  // ====================================================

  empty: {
    minHeight: 260,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 20,
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

    textAlign: 'center',
  },


  // ====================================================
  // MODAL
  // ====================================================

  modalOverlay: {
    flex: 1,

    backgroundColor:
      'rgba(0,0,0,0.55)',

    alignItems: 'center',

    justifyContent: 'center',

    padding: 18,
  },


  modal: {
    backgroundColor:
      '#E4F4F7',

    borderRadius: 11,

    width: '100%',

    maxWidth: 650,

    maxHeight: '85%',

    padding: 28,

    flex: 1,

    flexDirection: 'column',

    justifyContent: 'space-between',
  },


  modalMobile: {
    padding: 18,

    maxHeight: '87%',
  },


  modalHeader: {
    flexDirection: 'row',

    justifyContent:
      'space-between',

    alignItems: 'flex-start',

    marginBottom: 18,
  },


  modalTitle: {
    fontFamily:
      'Poppins_700Bold',

    fontSize: 22,

    color:
      COLORS.mainText,
  },


  modalSubtitle: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 14,

    color:
      COLORS.secondaryText,

    marginTop: 2,
  },


  modalForm: {
    flexGrow: 1,
  },


  modalFormContent: {
    flexDirection: 'column',

    gap: 12,

    paddingBottom: 100,
  },


  // ====================================================
  // FORM
  // ====================================================

  field: {
    width: '100%',

    marginBottom: 14,
  },


  fieldHalf: {
    width: '48.5%',
  },


  label: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 14,

    color:
      COLORS.mainText,

    marginBottom: 6,
  },


  input: {
    minHeight: 52,

    backgroundColor:
      '#E7F3F5',

    borderWidth: 1,

    borderColor:
      '#C9E0E5',

    borderRadius: 7,

    paddingHorizontal: 14,

    fontFamily:
      'Inter_400Regular',

    fontSize: 15,

    color:
      COLORS.mainText,
  },


  // ====================================================
  // MODAL BUTTONS
  // ====================================================

  modalButtons: {
    flexDirection: 'row',

    justifyContent:
      'flex-end',

    alignItems: 'center',

    gap: 10,

    paddingTop: 12,
  },


  modalButtonsMobile: {
    flexDirection: 'column-reverse',

    alignItems: 'stretch',

    gap: 9,
  },


  modalButtonsFooter: {
    flexDirection: 'row',

    justifyContent: 'flex-end',

    alignItems: 'center',

    gap: 10,

    marginTop: 12,
  },


  cancelButton: {
    minHeight: 50,

    paddingHorizontal: 20,

    borderRadius: 7,

    backgroundColor:
      '#EAF4F5',

    borderWidth: 1,

    borderColor:
      '#C9E0E5',

    alignItems: 'center',

    justifyContent: 'center',
  },


  cancelText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 15,

    color:
      COLORS.mainText,
  },


  saveButton: {
    minHeight: 50,

    paddingHorizontal: 20,

    borderRadius: 7,

    backgroundColor:
      COLORS.primaryBlue,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'center',

    gap: 7,
  },


  saveText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 15,

    color:
      COLORS.white,
  },


  // ====================================================
  // BOTTOM NAVIGATION
  // ====================================================

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

    justifyContent: 'center',

    gap: 4,

    borderRadius: 10,

    paddingVertical: 5,
  },


  bottomTabActive: {
    backgroundColor: '#E5F2F9',
  },


  bottomText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 11,

    color:
      COLORS.secondaryText,
  },


  bottomTextActive: {
    color:
      COLORS.primaryBlue,

    fontFamily:
      'Inter_700Bold',
  },


  // ====================================================
  // REFILL / STOCK
  // ====================================================

  stockRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 5,

    marginTop: 5,
  },


  stockText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 13,

    color:
      COLORS.mainText,
  },


  stockMuted: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 13,

    color:
      COLORS.secondaryText,

    marginTop: 4,
  },


  lowStockBadge: {
    alignSelf: 'flex-start',

    flexDirection: 'row',

    alignItems: 'center',

    gap: 4,

    paddingHorizontal: 9,

    paddingVertical: 3,

    borderRadius: 12,

    backgroundColor:
      COLORS.missedBg,

    marginTop: 6,
  },


  lowStockText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 12,

    color:
      COLORS.missedText,
  },


  sectionLabel: {
    fontFamily:
      'Poppins_600SemiBold',

    fontSize: 15,

    color:
      COLORS.mainText,

    marginBottom: 12,

    marginTop: 4,
  },


  fieldFull: {
    width: '100%',
  },


  scheduleRow: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 8,

    marginBottom: 10,

    flexWrap: 'wrap',
  },


  scheduleTimeInput: {
    flex: 1,

    flexShrink: 1,

    minWidth: 120,
  },


  // Picker fields (Pressable styled like a text input, same as Appointments)

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


  scheduleQtyRemoveWrapper: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'flex-end',

    gap: 8,

    flexShrink: 0,
  },


  scheduleQtyInput: {
    width: 80,

    flexShrink: 0,
  },


  scheduleRemoveButton: {
    width: 36,

    height: 36,

    flexShrink: 0,

    alignItems: 'center',

    justifyContent: 'center',
  },


  addScheduleButton: {
    flexDirection: 'row',

    alignItems: 'center',

    gap: 6,

    paddingVertical: 8,
  },


  addScheduleText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 13,

    color:
      COLORS.primaryBlue,
  },

});