import React, { useEffect, useState } from 'react';

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
// STORAGE KEYS
// ======================================================

const MEDICINES_STORAGE_KEY =
  '@health_saathi_medicines';

const HISTORY_STORAGE_KEY =
  '@health_saathi_medicine_history';


// ======================================================
// TYPES
// ======================================================

type MedicineStatus =
  | 'Pending'
  | 'Taken'
  | 'Missed';


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
};


type HistoryItem = {
  id: string;

  medicineId: string;

  medicineName: string;

  dosage: string;

  time: string;

  status: 'Taken' | 'Missed';

  date: string;

  timestamp: number;
};


// ======================================================
// DEFAULT MEDICINES
// ======================================================

const DEFAULT_MEDICINES: Medicine[] = [
  {
    id: '1',

    name: 'Metformin',

    dosage: '500mg',

    timing: 'After Breakfast',

    time: '8:00 AM',

    frequency: 'Once Daily',

    startDate: '10 September 2026',

    endDate: '10 October 2026',

    status: 'Taken',
  },

  {
    id: '2',

    name: 'Amlodipine',

    dosage: '5mg',

    timing: 'After Lunch',

    time: '2:00 PM',

    frequency: 'Once Daily',

    startDate: '10 September 2026',

    endDate: '10 October 2026',

    status: 'Pending',
  },

  {
    id: '3',

    name: 'Atorvastatin',

    dosage: '10mg',

    timing: 'Before Sleep',

    time: '9:00 PM',

    frequency: 'Once Daily',

    startDate: '10 September 2026',

    endDate: '10 October 2026',

    status: 'Pending',
  },
];


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

  const isTablet =
    width >= 600 && width < 900;

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
    useState<Medicine[]>(DEFAULT_MEDICINES);

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

  const [time, setTime] =
    useState('');

  const [frequency, setFrequency] =
    useState('Once Daily');

  const [startDate, setStartDate] =
    useState('');

  const [endDate, setEndDate] =
    useState('');


  // ====================================================
  // LOAD MEDICINES
  // ====================================================

  useEffect(() => {

    loadMedicines();

  }, []);


  const loadMedicines = async () => {

    try {

      const saved =
        await AsyncStorage.getItem(
          MEDICINES_STORAGE_KEY
        );


      if (saved) {

        const parsed =
          JSON.parse(saved);


        if (Array.isArray(parsed)) {

          setMedicines(parsed);

        }

      } else {

        await AsyncStorage.setItem(
          MEDICINES_STORAGE_KEY,
          JSON.stringify(
            DEFAULT_MEDICINES
          )
        );

      }

    } catch (error) {

      console.log(
        'Medicine loading error:',
        error
      );

    }

  };


  // ====================================================
  // SAVE MEDICINES
  // ====================================================

  const saveMedicinesToStorage =
    async (
      updatedMedicines: Medicine[]
    ) => {

      try {

        await AsyncStorage.setItem(
          MEDICINES_STORAGE_KEY,
          JSON.stringify(
            updatedMedicines
          )
        );

      } catch (error) {

        console.log(
          'Medicine save error:',
          error
        );

      }

    };


  // ====================================================
  // RESET FORM
  // ====================================================

  const resetForm = () => {

    setMedicineName('');

    setDosage('');

    setTiming('');

    setTime('');

    setFrequency('Once Daily');

    setStartDate('');

    setEndDate('');

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

    setTime(
      medicine.time
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

    setModalVisible(true);

  };


  // ====================================================
  // SAVE / UPDATE MEDICINE
  // ====================================================

  const saveMedicine = async () => {

    if (
      !medicineName.trim() ||
      !dosage.trim() ||
      !timing.trim() ||
      !time.trim()
    ) {

      Alert.alert(
        'Missing Information',
        'Please fill Medicine Name, Dosage, Timing and Time.'
      );

      return;

    }


    if (editingId) {

      const updated =
        medicines.map(
          medicine =>
            medicine.id === editingId
              ? {
                  ...medicine,

                  name:
                    medicineName.trim(),

                  dosage:
                    dosage.trim(),

                  timing:
                    timing.trim(),

                  time:
                    time.trim(),

                  frequency,

                  startDate:
                    startDate.trim(),

                  endDate:
                    endDate.trim(),
                }
              : medicine
        );


      setMedicines(updated);

      await saveMedicinesToStorage(
        updated
      );

    } else {

      const newMedicine: Medicine = {

        id:
          Date.now().toString(),

        name:
          medicineName.trim(),

        dosage:
          dosage.trim(),

        timing:
          timing.trim(),

        time:
          time.trim(),

        frequency,

        startDate:
          startDate.trim(),

        endDate:
          endDate.trim(),

        status:
          'Pending',

      };


      const updated = [
        ...medicines,

        newMedicine,
      ];


      setMedicines(updated);

      await saveMedicinesToStorage(
        updated
      );

    }


    setModalVisible(false);

    resetForm();

  };


  // ====================================================
  // DELETE MEDICINE
  // ====================================================

  const deleteMedicine = (
    id: string
  ) => {

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

            const updated =
              medicines.filter(
                medicine =>
                  medicine.id !== id
              );


            setMedicines(updated);

            await saveMedicinesToStorage(
              updated
            );

          },
        },

      ]

    );

  };


  // ====================================================
  // ADD HISTORY
  // ====================================================

  const addHistory = async (
    medicine: Medicine,
    status: 'Taken' | 'Missed'
  ) => {

    try {

      const saved =
        await AsyncStorage.getItem(
          HISTORY_STORAGE_KEY
        );


      let history: HistoryItem[] =
        saved
          ? JSON.parse(saved)
          : [];


      const now =
        new Date();


      const date =
        now.toLocaleDateString(
          'en-IN',
          {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          }
        );


      const historyItem: HistoryItem = {

        id:
          `${medicine.id}-${Date.now()}`,

        medicineId:
          medicine.id,

        medicineName:
          medicine.name,

        dosage:
          medicine.dosage,

        time:
          medicine.time,

        status,

        date,

        timestamp:
          Date.now(),

      };


      history = [
        historyItem,

        ...history,
      ];


      await AsyncStorage.setItem(

        HISTORY_STORAGE_KEY,

        JSON.stringify(history)

      );


      console.log(
        'Medicine history saved'
      );

    } catch (error) {

      console.log(
        'History save error:',
        error
      );

    }

  };


  // ====================================================
  // CHANGE STATUS
  // ====================================================

  const changeStatus = async (
    medicine: Medicine,
    status: MedicineStatus
  ) => {

    const updated =
      medicines.map(
        item =>
          item.id === medicine.id
            ? {
                ...item,

                status,
              }
            : item
      );


    setMedicines(updated);

    await saveMedicinesToStorage(
      updated
    );


    if (
      status === 'Taken' ||
      status === 'Missed'
    ) {

      await addHistory(
        medicine,
        status
      );

    }

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
              changeStatus(
                medicine,
                'Taken'
              )
            }

            style={
              styles.actionButton
            }
          >

            <Text
              style={
                styles.actionText
              }
            >
              Taken
            </Text>

          </Pressable>


          <Pressable
            onPress={() =>
              changeStatus(
                medicine,
                'Missed'
              )
            }

            style={
              styles.actionButton
            }
          >

            <Text
              style={
                styles.actionText
              }
            >
              Missed
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


              {/* TIME */}

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
                  Time
                </Text>


                <TextInput
                  value={
                    time
                  }

                  onChangeText={
                    setTime
                  }

                  placeholder="e.g. 8:00 AM"

                  placeholderTextColor={
                    COLORS.secondaryText
                  }

                  style={
                    styles.input
                  }
                />

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

});