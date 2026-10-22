import React, { useCallback, useEffect, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  useWindowDimensions,
  Alert,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Ionicons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';
import { apiFetch, parseJson } from '../services/api';

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
  requestNotificationPermission,
} from '../services/notificationService';


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
    useWindowDimensions();


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

  useEffect(() => {
    (async () => {
      await loadMedicines();
    })();
  }, [loadMedicines]);


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

    // Ask for notification permission up front so a denial can be surfaced
    // instead of leaving the user with no reminders and no explanation.
    const remindersAllowed = await requestNotificationPermission();

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
          'Notifications are disabled for Health Saathi, so medicine reminders will not appear. Enable notifications in your device settings to receive them.'
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

const deleteMedicine = (id: string) => {
  Alert.alert(
    'Delete Medicine',
    'Are you sure you want to delete this medicine?',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('authToken');

            if (!token) {
              Alert.alert('Login Required', 'Please login again.');
              router.replace('/');
              return;
            }

            const response = await apiFetch(
              `/api/medicines/${id}`,
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
                data.message || 'Unable to delete medicine'
              );
            }

            // Cancel all scheduled reminders for this medicine.
            await cancelMedicineRemindersForMedicine(id);

            // Refresh the medicine list.
            await loadMedicines();

            Alert.alert(
              'Success',
              'Medicine and its scheduled reminders have been deleted.'
            );
          } catch (error) {
            console.log('Medicine delete error:', error);

            Alert.alert(
              'Error',
              error instanceof Error
                ? error.message
                : 'Unable to delete medicine.'
            );
          }
        },
      },
    ]
  );
};


  // ====================================================
  // MARK DOSE (per-dose status)
  // ====================================================

  const markDose = async (
    medicine: Medicine,
    dose: MedicineDose,
    status: 'Taken' | 'Missed'
  ) => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        Alert.alert('Login Required', 'Please login again.');
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

      await loadMedicines();
    } catch (error) {
      console.log('Dose status update error:', error);
      Alert.alert(
        'Error',
        error instanceof Error
          ? error.message
          : 'Unable to update dose status.'
      );
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
            {medicine.time}
            {' · '}
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
                      {dose.time}

                      {dose.quantity > 1
                        ? ` · ${dose.quantity} doses`
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

                          style={
                            styles.doseActionButton
                          }
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

                          style={
                            styles.doseActionButton
                          }
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
                  ? ` · runs out ${formatRunOutDate(
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

            style={
              styles.iconButton
            }
          >

            <Ionicons
              name="trash-outline"
              size={20}
              color={
                COLORS.mainText
              }
            />

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

    <View
      style={
        styles.screen
      }
    >

      {/* ================================================= */}
      {/* HEADER */}
      {/* ================================================= */}

      <View
        style={[
          styles.header,

          isMobile &&
            styles.headerMobile,
        ]}
      >

        <Text
          style={
            styles.welcome
          }
        >
          Welcome back, sawan
        </Text>


        <View
          style={
            styles.headerRight
          }
        >

          <View
            style={
              styles.notification
            }
          >

            <Ionicons
              name="notifications-outline"
              size={25}
              color={
                COLORS.mainText
              }
            />

            <View
              style={
                styles.notificationDot
              }
            />

          </View>


          <View
            style={
              styles.avatar
            }
          >

            <Text
              style={
                styles.avatarText
              }
            >
              S
            </Text>

          </View>

        </View>

      </View>


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
          style={
            styles.titleSection
          }
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

                      <TextInput
                        value={
                          row.time
                        }

                        onChangeText={(value) =>
                          updateScheduleRow(
                            index,
                            'time',
                            value
                          )
                        }

                        placeholder="e.g. 8:00 AM"

                        placeholderTextColor={
                          COLORS.secondaryText
                        }

                        style={[
                          styles.input,
                          styles.scheduleTimeInput,
                        ]}
                      />


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
                  )
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


                <TextInput
                  value={
                    startDate
                  }

                  onChangeText={
                    setStartDate
                  }

                  placeholder="e.g. 24 September 2026"

                  placeholderTextColor={
                    COLORS.secondaryText
                  }

                  style={
                    styles.input
                  }
                />

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


                <TextInput
                  value={
                    endDate
                  }

                  onChangeText={
                    setEndDate
                  }

                  placeholder="e.g. 24 October 2026"

                  placeholderTextColor={
                    COLORS.secondaryText
                  }

                  style={
                    styles.input
                  }
                />

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
            {/* MODAL BUTTONS */}
            {/* ================================================= */}

            <View
              style={[
                styles.modalButtons,

                isMobile &&
                  styles.modalButtonsMobile,
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
                    ? `${refillMedicine.name} · ${
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
      {/* BOTTOM NAVIGATION */}
      {/* ================================================= */}

      <View
        style={
          styles.bottomNav
        }
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
            name="medical"
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

    </View>

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

    gap: 18,
  },


  notification: {
    position: 'relative',
  },


  notificationDot: {
    position: 'absolute',

    width: 7,

    height: 7,

    borderRadius: 4,

    backgroundColor:
      COLORS.dangerRed,

    right: 0,

    top: 0,
  },


  avatar: {
    width: 48,

    height: 48,

    borderRadius: 24,

    backgroundColor:
      COLORS.primaryBlue,

    alignItems: 'center',

    justifyContent: 'center',
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
  },


  addButtonMobile: {
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

    maxHeight: '90%',

    padding: 28,
  },


  modalMobile: {
    padding: 18,

    maxHeight: '92%',
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
    flexGrow: 0,
  },


  modalFormContent: {
    flexDirection: 'row',

    flexWrap: 'wrap',

    justifyContent:
      'space-between',

    paddingBottom: 5,
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
    height: 74,

    backgroundColor:
      COLORS.white,

    borderTopWidth: 1,

    borderTopColor:
      COLORS.border,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-around',
  },


  bottomTab: {
    minWidth: 75,

    minHeight: 56,

    alignItems: 'center',

    justifyContent: 'center',

    gap: 2,
  },


  bottomTabActive: {
    transform: [
      {
        scale: 1.05,
      },
    ],
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
      'Inter_600SemiBold',
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
  },


  scheduleTimeInput: {
    flex: 1,
  },


  scheduleQtyInput: {
    width: 70,
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
  },


  addScheduleText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 13,

    color:
      COLORS.primaryBlue,
  },

});