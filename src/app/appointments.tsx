import React, { useEffect, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  Switch,
  useWindowDimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';

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
};


// ====================================================
// DEFAULT APPOINTMENTS
// ====================================================

const DEFAULT_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    doctor: 'Dr. Rajesh Mehta',
    specialty: 'Cardiologist',
    hospital: 'City Care Hospital',
    date: 'Friday, 12 September',
    time: '11:30 AM',
    reason: 'Routine Checkup',
    reminder: true,
    status: 'Upcoming',
  },

  {
    id: '2',
    doctor: 'Dr. Anjali Nair',
    specialty: 'Dermatologist',
    hospital: 'Sunrise Clinic',
    date: 'Monday, 22 September',
    time: '4:00 PM',
    reason: 'Skin Allergy Follow-up',
    reminder: true,
    status: 'Upcoming',
  },
];


// ====================================================
// SCREEN
// ====================================================

export default function AppointmentsScreen() {
  const router = useRouter();

  const { width } = useWindowDimensions();

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
    useState<Appointment[]>(
      DEFAULT_APPOINTMENTS
    );


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

  const [time, setTime] =
    useState('');

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

  const showToast = (
    message: string
  ) => {
    setToastMessage(message);

    setToastVisible(true);
  };


  useEffect(() => {
    if (!toastVisible) return;

    const timer = setTimeout(() => {
      setToastVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [toastVisible]);


  // ==================================================
  // OPEN ADD
  // ==================================================

  const openAddAppointment = () => {
    setEditingId(null);

    setDoctor('');

    setSpecialty('');

    setHospital('');

    setDate('');

    setTime('');

    setReason('');

    setReminder(true);

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

    setTime(appointment.time);

    setReason(appointment.reason);

    setReminder(
      appointment.reminder
    );

    setModalVisible(true);
  };


  // ==================================================
  // SAVE APPOINTMENT
  // ==================================================

  const saveAppointment = () => {
    if (!doctor.trim()) {
      showToast(
        'Please enter doctor name'
      );

      return;
    }

    if (!specialty.trim()) {
      showToast(
        'Please enter specialty'
      );

      return;
    }

    if (!hospital.trim()) {
      showToast(
        'Please enter hospital or clinic'
      );

      return;
    }

    if (!date.trim()) {
      showToast(
        'Please enter appointment date'
      );

      return;
    }

    if (!time.trim()) {
      showToast(
        'Please enter appointment time'
      );

      return;
    }

    if (!reason.trim()) {
      showToast(
        'Please enter reason for visit'
      );

      return;
    }


    // ================================================
    // EDIT
    // ================================================

    if (editingId) {
      setAppointments(
        previous =>
          previous.map(
            appointment =>
              appointment.id ===
              editingId
                ? {
                    ...appointment,

                    doctor,

                    specialty,

                    hospital,

                    date,

                    time,

                    reason,

                    reminder,
                  }
                : appointment
          )
      );

      setModalVisible(false);

      setEditingId(null);

      showToast(
        'Appointment updated'
      );

      return;
    }


    // ================================================
    // ADD
    // ================================================

    const newAppointment: Appointment = {
      id: Date.now().toString(),

      doctor,

      specialty,

      hospital,

      date,

      time,

      reason,

      reminder,

      status: 'Upcoming',
    };


    setAppointments(
      previous => [
        ...previous,
        newAppointment,
      ]
    );


    setActiveTab('Upcoming');

    setModalVisible(false);

    setEditingId(null);

    showToast(
      'Appointment saved'
    );
  };


  // ==================================================
  // DELETE
  // ==================================================

  const deleteAppointment = (
    id: string
  ) => {
    setAppointments(
      previous =>
        previous.filter(
          appointment =>
            appointment.id !== id
        )
    );

    showToast(
      'Appointment deleted'
    );
  };


  // ==================================================
  // REMINDER
  // ==================================================

  const toggleReminder = (
    id: string
  ) => {
    setAppointments(
      previous =>
        previous.map(
          appointment =>
            appointment.id === id
              ? {
                  ...appointment,

                  reminder:
                    !appointment.reminder,
                }
              : appointment
        )
    );
  };


  // ==================================================
  // FILTER
  // ==================================================

  const filteredAppointments =
    appointments.filter(
      appointment =>
        appointment.status ===
        activeTab
    );


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
              {appointment.status}
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
          {' · '}
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
  // BOTTOM TAB
  // ==================================================

  const BottomTab = ({
    icon,
    label,
    active,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;

    label: string;

    active?: boolean;

    onPress: () => void;
  }) => {
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
          size={22}
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
  };


  // ==================================================
  // RETURN
  // ==================================================

  return (
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
        {/* HEADER */}
        {/* ========================================== */}

        <View style={styles.topHeader}>

          <Text
            style={styles.welcomeText}
          >
            Welcome back, sawan
          </Text>


          <View
            style={styles.headerRight}
          >

            <View
              style={
                styles.notificationIcon
              }
            >
              <Ionicons
                name="notifications-outline"
                size={24}
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
              style={styles.avatar}
            >
              <Text
                style={styles.avatarText}
              >
                S
              </Text>
            </View>

          </View>

        </View>


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

            isMobile &&
              styles.bottomNavMobile,
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


                  <TextInput
                    value={date}
                    onChangeText={setDate}
                    placeholder="e.g. 28 September 2026"
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
                    Time
                  </Text>


                  <TextInput
                    value={time}
                    onChangeText={setTime}
                    placeholder="e.g. 10:00 AM"
                    placeholderTextColor={
                      COLORS.secondaryText
                    }
                    style={
                      styles.input
                    }
                  />

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

          </View>

        </Modal>

      </View>

    </KeyboardAvoidingView>
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

    gap: 22,
  },


  notificationIcon: {
    position: 'relative',
  },


  notificationDot: {
    position: 'absolute',

    right: 1,

    top: 0,

    width: 7,

    height: 7,

    borderRadius: 4,

    backgroundColor:
      COLORS.dangerRed,
  },


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

    paddingHorizontal: 25,
  },


  bottomNavMobile: {
    height: 68,

    paddingHorizontal: 8,
  },


  bottomTab: {
    minWidth: 80,

    alignItems: 'center',

    justifyContent:
      'center',

    gap: 3,

    paddingVertical: 5,
  },


  bottomTabActive: {
    backgroundColor:
      '#E5F2F9',

    borderRadius: 10,
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

});