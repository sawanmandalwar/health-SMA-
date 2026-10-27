

import React, { useCallback, useEffect } from 'react';
import {

  ActivityIndicator,

  Alert,

  Animated,

  Easing,

  Pressable,

  ScrollView,

  StyleSheet,

  Text,

  useWindowDimensions,

  View,


} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

import { router, useFocusEffect } from 'expo-router';
import { apiFetch, parseJson } from '../services/api';

import { useHeaderUser } from '../hooks/useHeaderUser';

import AppHeader from '../components/AppHeader';
import { registerPushTokenWithBackend, parseAppointmentDateTime } from '../services/notificationService';
import { syncTimezoneWithBackend } from '../services/timezoneService';

import { Ionicons } from '@expo/vector-icons';


import { Svg, Circle } from 'react-native-svg';

import { useFonts } from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';



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

type DashboardMedicineStatus = 'Pending' | 'Taken' | 'Missed';

type DashboardDose = {
  doseId: string;
  time: string;
  quantity: number;
  status: DashboardMedicineStatus;
};

type DashboardMedicine = {
  id: string;
  name: string;
  dosage: string;
  timing: string;
  time: string;
  frequency: string;
  status: DashboardMedicineStatus;
  schedules?: { id: string; time: string; quantity: number }[];
  doses?: DashboardDose[];
};

type DashboardAppointment = {
  id: string;
  doctor: string;
  specialty: string;
  hospital: string;
  date: string;
  time: string;
  reason: string;
  status: string;
};

type DashboardDay = {
  date: string;
  label: string;
  taken: number;
  missed: number;
};

type DashboardData = {
  user: { id: string; name: string; email: string; phone: string };
  today: string;
  stats: {
    medicinesScheduled: number;
    taken: number;
    missed: number;
    pending: number;
    dosesScheduled?: number;
    dosesTaken?: number;
    dosesMissed?: number;
    dosesPending?: number;
    upcomingAppointments: number;
  };
  medicines: DashboardMedicine[];
  weeklyAdherence: {
    taken: number;
    missed: number;
    totalDue: number;
    percentage: number;
    days: DashboardDay[];
  };
  nextAppointment: DashboardAppointment | null;
  unreadNotifications: number;
};

// ==========================================================
// DYNAMIC APPOINTMENT BADGE HELPERS
// ==========================================================

// Whole calendar days between today and the appointment.
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




const COLORS = {

  primary: '#1E76B6',

  darkBlue: '#155A8C',

  green: '#39A78D',

  lightBlue: '#E7F2FA',

  lightGreen: '#E5F7F1',

  red: '#E2574C',

  lightRed: '#FBE8E6',

  background: '#EAF3F5',

  text: '#1D2B33',

  secondary: '#71858D',

  white: '#FFFFFF',

  border: '#DDE9ED',

  pending: '#F2A900',

  lightPending: '#FFF1D1',

};



export default function HomeScreen() {

  const { width } = useWindowDimensions();

  const [dashboard, setDashboard] = React.useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = React.useState(true);
  const [dashboardError, setDashboardError] = React.useState('');

  // Greeting name (fresh user data on every focus)
  const { displayName } = useHeaderUser();

  const [updatingMedicineId, setUpdatingMedicineId] = React.useState<string | null>(null);



  const isDesktop = width >= 900;






  const [fadeAnim] = React.useState(() => new Animated.Value(0));

  const [slideAnim] = React.useState(() => new Animated.Value(18));


  const [fontsLoaded] = useFonts({
    Poppins_400Regular,

    Poppins_500Medium,

    Poppins_600SemiBold,

    Poppins_700Bold,

    Inter_400Regular,

    Inter_500Medium,

    Inter_600SemiBold,

    Inter_700Bold,

  });



  useEffect(() => {

    Animated.parallel([

      Animated.timing(fadeAnim, {

        toValue: 1,

        duration: 500,

        easing: Easing.out(Easing.ease),

        useNativeDriver: true,

      }),

      Animated.timing(slideAnim, {

        toValue: 0,

        duration: 500,

        easing: Easing.out(Easing.ease),

        useNativeDriver: true,

      }),

    ]).start();

  }, [fadeAnim, slideAnim]);



  // ==========================================================
  // DASHBOARD DATA (real backend data)
  // ==========================================================

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setDashboardLoading(true);
    setDashboardError('');
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setDashboardError('Please log in again to view your dashboard.');
        return;
      }

      const response = await apiFetch(`/api/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await parseJson(response);

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Unable to load dashboard.');
      }

      setDashboard(data as DashboardData);
    } catch (error) {
      console.error('Dashboard load error:', error);
      setDashboardError(
        error instanceof Error ? error.message : 'Unable to load dashboard.'
      );
    } finally {
      if (!silent) setDashboardLoading(false);
    }
  }, []);

  const syncNotificationPreferences = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) return;

      await syncTimezoneWithBackend(token);
      await registerPushTokenWithBackend(token);
    } catch (error) {
      console.error('Notification preference sync error:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        await loadDashboard();
      })();
    }, [loadDashboard])
  );

  useFocusEffect(
    useCallback(() => {
      (async () => {
        await syncNotificationPreferences();
      })();
    }, [syncNotificationPreferences])
  );

  const updateMedicineStatus = async (
    medicine: DashboardMedicine,
    status: 'Taken' | 'Missed'
  ) => {
    if (!dashboard || updatingMedicineId) return;

    const previous = dashboard;
    setUpdatingMedicineId(medicine.id);

    // Prefer the per-dose endpoint so stock is deducted exactly once.
    const targetDose =
      medicine.doses && medicine.doses.length > 0
        ? medicine.doses.find((dose) => dose.status === 'Pending') ??
          medicine.doses[0]
        : null;

    // Optimistically update the UI so the change is visible immediately.
    setDashboard((current) =>
      current
        ? {
            ...current,
            medicines: current.medicines.map((item) =>
              item.id === medicine.id
                ? {
                    ...item,
                    status,
                    doses: item.doses?.map((dose) =>
                      targetDose && dose.doseId === targetDose.doseId
                        ? { ...dose, status }
                        : dose
                    ),
                  }
                : item
            ),
          }
        : current
    );

    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) throw new Error('Please log in again.');

      const now = new Date();

      if (targetDose) {
        const doseResponse = await apiFetch(
          `/api/medicines/${medicine.id}/doses/${targetDose.doseId}/status`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status, date: now.toISOString() }),
          }
        );
        const doseData = await parseJson(doseResponse).catch(() => ({}));

        if (!doseResponse.ok) {
          throw new Error(doseData.message || 'Unable to update dose status.');
        }
      } else {
        // Older medicines without a schedule keep the legacy behaviour.
        const medicineResponse = await apiFetch(
          `/api/medicines/${medicine.id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ status }),
          }
        );
        const medicineData = await parseJson(medicineResponse).catch(() => ({}));

        if (!medicineResponse.ok) {
          throw new Error(
            medicineData.message || 'Unable to update medicine status.'
          );
        }

        const historyResponse = await apiFetch(`/api/history`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            medicineId: medicine.id,
            medicineName: medicine.name,
            dosage: medicine.dosage,
            time: medicine.time,
            status,
            scheduledDate: now.toISOString(),
            takenAt: status === 'Taken' ? now.toISOString() : null,
          }),
        });
        const historyData = await parseJson(historyResponse).catch(() => ({}));

        if (!historyResponse.ok) {
          throw new Error(
            historyData.message || 'Unable to save medicine history.'
          );
        }
      }

      await loadDashboard(true);
    } catch (error) {
      // Roll back to the previous state so nothing is lost on failure.
      setDashboard(previous);
      Alert.alert(
        'Update failed',
        error instanceof Error
          ? error.message
          : 'Unable to update medicine status. Please try again.'
      );
    } finally {
      setUpdatingMedicineId(null);
    }
  };

  if (!fontsLoaded) {

    return null;

  }



  const now = new Date();

  const hour = now.getHours();



  const greeting =

    hour < 12

      ? 'Good Morning'

      : hour < 17

        ? 'Good Afternoon'

        : 'Good Evening';



  const today = now.toLocaleDateString('en-IN', {

    weekday: 'long',

    day: 'numeric',

    month: 'long',

    year: 'numeric',

  });



  // Derived dashboard values (kept in sync with optimistic updates).

  const medicines = dashboard?.medicines ?? [];

  const scheduledToday = medicines.length;

  const allDoses = medicines.flatMap((item) => item.doses ?? []);

  const dosesScheduled = allDoses.length;

  const dosesTaken = allDoses.filter((dose) => dose.status === 'Taken').length;

  const dosesMissed = allDoses.filter((dose) => dose.status === 'Missed').length;

  const dosesPending = allDoses.filter((dose) => dose.status === 'Pending').length;

  const upcomingCount = dashboard?.stats.upcomingAppointments ?? 0;

  const weeklyAdherence = dashboard?.weeklyAdherence;

  const adherencePercentage =

    weeklyAdherence && weeklyAdherence.totalDue > 0 ? weeklyAdherence.percentage : 0;

  const nextAppointment = dashboard?.nextAppointment ?? null;

// Build the "Upcoming · Today / Tomorrow / In N days" badge text.
const nextAppointmentBadgeText = (() => {
  if (!nextAppointment) return '';

  try {
    const parsed = parseAppointmentDateTime(
      nextAppointment.date,
      nextAppointment.time
    );
    const label = getUpcomingBadgeText(
      getCalendarDayOffset(parsed)
    );

    return label ? `Upcoming · ${label}` : 'Upcoming';
  } catch {
    return 'Upcoming';
  }
})();

  const showInitialState = dashboardLoading && !dashboard;

  const showInitialError = !dashboardLoading && !dashboard && !!dashboardError;



  return (

    <SafeAreaView style={styles.safeArea}>

      <View style={styles.appContainer}>



        {/* ================= DESKTOP SIDEBAR ================= */}



        {isDesktop && (

          <View style={styles.sidebar}>



            <View style={styles.brandArea}>

              <View style={styles.logo}>

                <Ionicons

                  name="heart"

                  size={25}

                  color={COLORS.white}

                />

              </View>



              <View>

                <Text style={styles.brandName}>

                  Health-Saathi

                </Text>



                <Text style={styles.brandTagline}>

                  Aapki Sehat, Hamari Zimmedari

                </Text>

              </View>

            </View>



            <SidebarItem

              icon="home-outline"

              label="Home"

              active

              onPress={() => {}}

            />



            <SidebarItem

              icon="medical-outline"

              label="Medicines"

              onPress={() => router.push('/medicines')}

            />



            <SidebarItem

              icon="calendar-outline"

              label="Appointments"

              onPress={() => router.push('/appointments')}

            />



            <SidebarItem

              icon="business-outline"

              label="Hospitals"

              onPress={() => router.push('/hospitals')}

            />



            <SidebarItem

              icon="person-outline"

              label="Profile"

              onPress={() => router.push('/profile')}

            />



            <Text style={styles.toolsTitle}>

              HEALTH TOOLS

            </Text>



            <SidebarItem

              icon="scan-outline"

              label="Scan Prescription"

              onPress={() => router.push('/scan')}

            />



            <SidebarItem

              icon="time-outline"

              label="Medicine History"

              onPress={() => {}}

            />



          </View>

        )}



        {/* ================= MAIN AREA ================= */}



        <View style={styles.mainArea}>



          {/* TOP HEADER */}



          {/* TOP HEADER (shared across all screens) */}

          <AppHeader />



          {/* CONTENT */}



          <ScrollView

            showsVerticalScrollIndicator={false}

            contentContainerStyle={[

              styles.scrollContent,

              isDesktop && styles.desktopScrollContent,

            ]}

          >



            <Animated.View

              style={{

                opacity: fadeAnim,

                transform: [{ translateY: slideAnim }],

              }}

            >



              {/* PAGE HEADING */}



              <View style={styles.pageHeading}>



                <Text style={styles.pageTitle}>

                  {greeting}, {displayName} 👋

                </Text>



                <Text style={styles.pageDate}>

                  {today}

                </Text>



              </View>





              {/* ================= LOADING / ERROR ================= */}

              {showInitialState && (
                <View style={styles.dashboardStateCard}>
                  <ActivityIndicator
                    animating
                    color={COLORS.primary}
                    size="large"
                  />
                  <Text style={styles.dashboardStateText}>
                    Loading your dashboard…
                  </Text>
                </View>
              )}

              {showInitialError && (
                <View style={styles.dashboardStateCard}>
                  <Ionicons
                    name="cloud-offline-outline"
                    size={36}
                    color={COLORS.red}
                  />
                  <Text style={styles.dashboardStateTitle}>
                    Couldn’t load your dashboard
                  </Text>
                  <Text style={styles.dashboardStateText}>{dashboardError}</Text>
                  <Pressable
                    onPress={() => loadDashboard()}
                    style={styles.dashboardRetry}
                  >
                    <Text style={styles.dashboardRetryText}>Try again</Text>
                  </Pressable>
                </View>
              )}

              {dashboard && dashboardError && (
                <View style={styles.dashboardWarning}>
                  <Ionicons
                    name="warning-outline"
                    size={16}
                    color={COLORS.pending}
                  />
                  <Text style={styles.dashboardWarningText}>{dashboardError}</Text>
                  <Pressable onPress={() => loadDashboard()}>
                    <Text style={styles.dashboardWarningRetry}>Retry</Text>
                  </Pressable>
                </View>
              )}

              {dashboard && (
                <>

              {/* ================= STAT CARDS ================= */}



              <View style={styles.statsGrid}>



                <StatCard

                  icon="medical-outline"

                  value={String(scheduledToday)}

                  label="Medicines today"

                  iconColor={COLORS.primary}

                  iconBackground={COLORS.lightBlue}

                />



                <StatCard

                  icon="checkmark-circle-outline"

                  value={`${dosesTaken}/${dosesScheduled}`}

                  label="Doses taken today"

                  iconColor={COLORS.green}

                  iconBackground={COLORS.lightGreen}

                />



                <StatCard

                  icon="warning-outline"

                  value={String(dosesMissed)}

                  label="Missed doses today"

                  iconColor={COLORS.red}

                  iconBackground={COLORS.lightRed}

                />



                <StatCard

                  icon="time-outline"

                  value={String(dosesPending)}

                  label="Pending doses today"

                  iconColor={COLORS.pending}

                  iconBackground={COLORS.lightPending}

                />



                <StatCard

                  icon="calendar-outline"

                  value={String(upcomingCount)}

                  label="Upcoming appointments"

                  iconColor={COLORS.primary}

                  iconBackground={COLORS.lightBlue}

                />



              </View>





              {/* ================= MAIN TWO COLUMN ================= */}



              <View

                style={[

                  styles.mainGrid,

                  isDesktop && styles.desktopMainGrid,

                ]}

              >



                {/* TODAY'S MEDICINES */}



                <View style={styles.medicineCard}>



                  <View style={styles.sectionHeader}>



                    <Text style={styles.sectionTitle}>

                      Today’s Medicines

                    </Text>



                    <Pressable

                      onPress={() => router.push('/medicines')}

                    >

                      <Text style={styles.viewAll}>

                        View All

                      </Text>

                    </Pressable>



                  </View>



                  {medicines.length === 0 ? (
                    <View style={styles.medicineEmpty}>
                      <Ionicons
                        name="medkit-outline"
                        size={34}
                        color={COLORS.secondary}
                      />
                      <Text style={styles.medicineEmptyTitle}>
                        No medicines scheduled today
                      </Text>
                      <Text style={styles.medicineEmptyText}>
                        Add a medicine to start tracking your doses.
                      </Text>
                      <Pressable
                        onPress={() => router.push('/medicines')}
                        style={styles.medicineEmptyButton}
                      >
                        <Text style={styles.medicineEmptyButtonText}>
                          Add Medicine
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    medicines.map((medicine) => (
                      <MedicineRow
                        key={medicine.id}
                        name={medicine.name}
                        dose={medicine.dosage}
                        time={
                          medicine.timing
                            ? `${medicine.time} · ${medicine.timing}`
                            : medicine.time
                        }
                        status={medicine.status}
                        updating={updatingMedicineId === medicine.id}
                        onTaken={() => updateMedicineStatus(medicine, 'Taken')}
                        onMissed={() => updateMedicineStatus(medicine, 'Missed')}
                      />
                    ))
                  )}



                </View>





                {/* RIGHT COLUMN */}



                <View

                  style={[

                    styles.rightColumn,

                    !isDesktop && styles.mobileRightColumn,

                  ]}

                >



                  {/* ADHERENCE */}



                  <View style={styles.adherenceCard}>



                    <View style={styles.adherenceHeader}>



                      <Text style={styles.adherenceTitle}>

                        This Week’s Adherence

                      </Text>



                      <View style={styles.goodProgress}>

                        <Text style={styles.goodProgressText}>

                          {!weeklyAdherence || weeklyAdherence.totalDue === 0
                            ? 'No data yet'
                            : adherencePercentage >= 80
                              ? 'Good progress'
                              : adherencePercentage >= 50
                                ? 'Keep going'
                                : 'Needs attention'}

                        </Text>

                      </View>



                    </View>



                    <View style={styles.adherenceBody}>



                      <AdherenceCircle percentage={adherencePercentage} />



                      <View style={styles.adherenceInfo}>



                        <Text style={styles.takenNumber}>

                          {weeklyAdherence?.taken ?? 0} Taken

                        </Text>



                        <Text style={styles.missedNumber}>

                          {weeklyAdherence?.missed ?? 0} Missed

                        </Text>



                        <Text style={styles.keepText}>

                          {weeklyAdherence && weeklyAdherence.totalDue > 0
                            ? 'Keep following your routine.'
                            : 'No doses recorded yet this week.'}

                        </Text>



                        {(!weeklyAdherence || weeklyAdherence.totalDue === 0) && (

                          <Text style={styles.keepText}>

                            Showing limited data.

                          </Text>

                        )}



                      </View>



                    </View>



                  </View>





                  {/* APPOINTMENT */}



                  <View style={styles.appointmentCard}>

                    <View style={styles.sectionHeader}>

                      <Text style={styles.sectionTitle}>

                        Upcoming Appointment

                      </Text>

                      <Pressable onPress={() => router.push('/appointments')}>

                        <Text style={styles.viewAll}>View All</Text>

                      </Pressable>

                    </View>



                    {nextAppointment ? (

                      <View style={styles.appointmentBody}>



                        <View style={styles.calendarBox}>

                          <Ionicons

                            name="calendar-outline"

                            size={25}

                            color={COLORS.primary}

                          />

                        </View>



                        <View style={styles.appointmentDetails}>



                          <Text style={styles.doctorName}>

                            {nextAppointment.doctor}

                          </Text>



                          <Text style={styles.doctorDetails}>

                            {nextAppointment.specialty} · {nextAppointment.hospital}

                          </Text>



                          <Text style={styles.appointmentDate}>

                            {nextAppointment.date} · {nextAppointment.time}

                          </Text>



                          {!!nextAppointment.reason && (

                            <Text style={styles.opd}>

                              Reason: {nextAppointment.reason}

                            </Text>

                          )}

                        </View>



                        <View style={styles.upcomingBadge}>

                          <Ionicons

                            name="time-outline"

                            size={13}

                            color={COLORS.primary}

                          />



                          <Text style={styles.upcomingText}>

                            {nextAppointmentBadgeText}

                          </Text>

                        </View>



                      </View>

                    ) : (

                      <View style={styles.appointmentEmpty}>

                        <Ionicons

                          name="calendar-clear-outline"

                          size={30}

                          color={COLORS.secondary}

                        />

                        <Text style={styles.appointmentEmptyText}>

                          No upcoming appointments

                        </Text>

                        <Pressable

                          onPress={() => router.push('/appointments')}

                          style={styles.appointmentEmptyButton}

                        >

                          <Text style={styles.appointmentEmptyButtonText}>

                            Book Appointment

                          </Text>

                        </Pressable>

                      </View>

                    )}

                  </View>



                </View>



              </View>





              </>
              )}


              {/* ================= QUICK ACTIONS ================= */}



              <Text style={styles.quickTitle}>

                Quick Actions

              </Text>



              <View style={styles.quickGrid}>



                <QuickAction

                  icon="add"

                  label="Add Medicine"

                  onPress={() => router.push('/medicines')}

                />



                <QuickAction

                  icon="scan-outline"

                  label="Scan Prescription"

                  onPress={() => router.push('/scan')}

                />



                <QuickAction

                  icon="calendar-outline"

                  label="Appointments"

                  onPress={() => router.push('/appointments')}

                />



                <QuickAction

                  icon="business-outline"

                  label="Find Hospital"

                  onPress={() => router.push('/hospitals')}

                />



              </View>



            </Animated.View>



          </ScrollView>





          {/* ================= MOBILE NAV ================= */}



          {!isDesktop && (

            <View style={styles.mobileNav}>



              <MobileNavItem

                icon="home-outline"

                label="Home"

                active

              />



              <MobileNavItem

                icon="medical-outline"

                label="Medicines"

                onPress={() => router.push('/medicines')}

              />



              <MobileNavItem

                icon="calendar-outline"

                label="Appointments"

                onPress={() => router.push('/appointments')}

              />



              <MobileNavItem

                icon="person-outline"

                label="Profile"

                onPress={() => router.push('/profile')}

              />



            </View>

          )}



        </View>



      </View>

    </SafeAreaView>

  );

}





/* ========================================================= */

/* STAT CARD */

/* ========================================================= */



function StatCard({

  icon,

  value,

  label,

  iconColor,

  iconBackground,

}: {

  icon: any;

  value: string;

  label: string;

  iconColor: string;

  iconBackground: string;

}) {

  return (

    <View style={styles.statCard}>



      <View

        style={[

          styles.statIcon,

          { backgroundColor: iconBackground },

        ]}

      >

        <Ionicons

          name={icon}

          size={23}

          color={iconColor}

        />

      </View>



      <View style={styles.statTextArea}>



        <Text style={styles.statValue}>

          {value}

        </Text>



        <Text style={styles.statLabel}>

          {label}

        </Text>



      </View>



    </View>

  );

}





/* ========================================================= */

/* MEDICINE ROW */

/* ========================================================= */



function MedicineRow({

  name,

  dose,

  time,

  status,

  updating = false,

  onTaken,

  onMissed,

}: {

  name: string;

  dose: string;

  time: string;

  status: DashboardMedicineStatus;

  updating?: boolean;

  onTaken?: () => void;

  onMissed?: () => void;

}) {

  const isTaken = status === 'Taken';

  const isMissed = status === 'Missed';

  const statusColor = isTaken

    ? COLORS.green

    : isMissed

      ? COLORS.red

      : COLORS.pending;

  const statusBackground = isTaken

    ? COLORS.lightGreen

    : isMissed

      ? COLORS.lightRed

      : COLORS.lightPending;

  return (

    <View style={styles.medicineRow}>



      <View style={styles.medicineIcon}>

        <Ionicons

          name="medical-outline"

          size={24}

          color={COLORS.primary}

        />

      </View>



      <View style={styles.medicineInfo}>



        <Text style={styles.medicineName}>

          {name}{' '}

          <Text style={styles.medicineDose}>

            {dose}

          </Text>

        </Text>



        <Text style={styles.medicineTime}>

          {time}

        </Text>



        {status === 'Pending' && (onTaken || onMissed) && (

          <View style={styles.medicineActions}>

            <Pressable

              onPress={onTaken}

              disabled={updating}

              style={[

                styles.medicineActionButton,

                styles.takenActionButton,

                updating && styles.medicineActionDisabled,

              ]}

            >

              <Ionicons

                name="checkmark"

                size={14}

                color={COLORS.green}

              />

              <Text

                style={[styles.medicineActionText, { color: COLORS.green }]}

              >

                Taken

              </Text>

            </Pressable>



            <Pressable

              onPress={onMissed}

              disabled={updating}

              style={[

                styles.medicineActionButton,

                styles.missedActionButton,

                updating && styles.medicineActionDisabled,

              ]}

            >

              <Ionicons

                name="close"

                size={14}

                color={COLORS.red}

              />

              <Text

                style={[styles.medicineActionText, { color: COLORS.red }]}

              >

                Missed

              </Text>

            </Pressable>

          </View>

        )}

      </View>



      <View

        style={[

          styles.medicineStatus,

          { backgroundColor: statusBackground },

        ]}

      >



        <Ionicons

          name={isTaken ? 'checkmark' : isMissed ? 'close' : 'time-outline'}

          size={13}

          color={statusColor}

        />



        <Text

          style={[

            styles.statusText,

            {

              color: statusColor,

            },

          ]}

        >

          {status}

        </Text>



      </View>



    </View>

  );

}





/* ========================================================= */

/* ADHERENCE CIRCLE */

/* ========================================================= */



function AdherenceCircle({ percentage }: { percentage: number }) {

  const size = 125;

  const strokeWidth = 13;

  const radius = (size - strokeWidth) / 2;

  const circumference = 2 * Math.PI * radius;



  const safePercentage = Math.max(0, Math.min(100, percentage));

  const progress = safePercentage / 100;

  const dashOffset =

    circumference * (1 - progress);



  return (

    <View style={styles.circleContainer}>



      <Svg

        width={size}

        height={size}

        viewBox={`0 0 ${size} ${size}`}

      >



        <Circle

          cx={size / 2}

          cy={size / 2}

          r={radius}

          stroke="rgba(255,255,255,0.25)"

          strokeWidth={strokeWidth}

          fill="none"

        />



      <Circle

  cx={size / 2}

  cy={size / 2}

  r={radius}

  stroke={COLORS.green}

  strokeWidth={strokeWidth}

  fill="none"

  strokeDasharray={`${circumference} ${circumference}`}

  strokeDashoffset={dashOffset}

  strokeLinecap="round"

  transform={`rotate(-90 ${size / 2} ${size / 2})`}

/>

      </Svg>



      <View style={styles.circleText}>

        <Text style={styles.percentText}>

          {safePercentage}%

        </Text>

      </View>



    </View>

  );

}





/* ========================================================= */

/* QUICK ACTION */

/* ========================================================= */



function QuickAction({

  icon,

  label,

  onPress,

}: {

  icon: any;

  label: string;

  onPress: () => void;

}) {

  return (

    <Pressable

      onPress={onPress}

      style={({ pressed }) => [

        styles.quickAction,

        pressed && styles.pressed,

      ]}

    >



      <View style={styles.quickIcon}>

        <Ionicons

          name={icon}

          size={24}

          color={COLORS.primary}

        />

      </View>



      <Text style={styles.quickLabel}>

        {label}

      </Text>



    </Pressable>

  );

}





/* ========================================================= */

/* SIDEBAR ITEM */

/* ========================================================= */



function SidebarItem({

  icon,

  label,

  active = false,

  onPress,

}: {

  icon: any;

  label: string;

  active?: boolean;

  onPress: () => void;

}) {

  return (

    <Pressable

      onPress={onPress}

      style={[

        styles.sidebarItem,

        active && styles.sidebarActive,

      ]}

    >



      <Ionicons

        name={icon}

        size={22}

        color={

          active

            ? COLORS.primary

            : COLORS.secondary

        }

      />



      <Text

        style={[

          styles.sidebarText,

          active && styles.sidebarActiveText,

        ]}

      >

        {label}

      </Text>



    </Pressable>

  );

}





/* ========================================================= */

/* MOBILE NAV ITEM */

/* ========================================================= */



function MobileNavItem({

  icon,

  label,

  active = false,

  onPress,

}: {

  icon: any;

  label: string;

  active?: boolean;

  onPress?: () => void;

}) {

  return (

    <Pressable

      onPress={onPress}

      style={[

        styles.mobileNavItem,

        active && styles.mobileNavActiveItem,

      ]}

    >



      <Ionicons

        name={icon}

        size={23}

        color={

          active

            ? COLORS.primary

            : COLORS.secondary

        }

      />



      <Text

        style={[

          styles.mobileNavText,

          active && styles.mobileNavActiveText,

        ]}

      >

        {label}

      </Text>



    </Pressable>

  );

}





/* ========================================================= */

/* STYLES */

/* ========================================================= */



const styles = StyleSheet.create({



  safeArea: {

    flex: 1,

    backgroundColor: COLORS.background,

  },



  appContainer: {

    flex: 1,

    flexDirection: 'row',

    backgroundColor: COLORS.background,

  },



  /* SIDEBAR */



  sidebar: {

    width: 270,

    backgroundColor: COLORS.white,

    borderRightWidth: 1,

    borderRightColor: COLORS.border,

    paddingTop: 28,

    paddingHorizontal: 14,

  },



  brandArea: {

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 10,

    marginBottom: 28,

  },



  logo: {

    width: 50,

    height: 50,

    borderRadius: 12,

    backgroundColor: COLORS.primary,

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 13,

  },



  brandName: {

    color: COLORS.text,

    fontFamily: 'Poppins_700Bold',

    fontSize: 20,

  },



  brandTagline: {

    color: COLORS.secondary,

    fontFamily: 'Inter_400Regular',

    fontSize: 10,

    marginTop: 2,

  },



  sidebarItem: {

    height: 50,

    borderRadius: 9,

    flexDirection: 'row',

    alignItems: 'center',

    paddingHorizontal: 15,

    marginBottom: 4,

  },



  sidebarActive: {

    backgroundColor: '#D8EEFC',

  },



  sidebarText: {

    color: COLORS.secondary,

    fontFamily: 'Inter_500Medium',

    fontSize: 15,

    marginLeft: 15,

  },



  sidebarActiveText: {

    color: COLORS.primary,

    fontFamily: 'Inter_600SemiBold',

  },



  toolsTitle: {

    color: COLORS.secondary,

    fontFamily: 'Inter_500Medium',

    fontSize: 12,

    marginTop: 23,

    marginBottom: 9,

    paddingHorizontal: 15,

  },



  /* MAIN */



  mainArea: {

    flex: 1,

    minWidth: 0,

  },



  topHeader: {

  height: 82,

  backgroundColor: COLORS.white,

  borderBottomWidth: 1,

  borderBottomColor: COLORS.border,

  flexDirection: 'row',

  alignItems: 'center',

  justifyContent: 'space-between',

  paddingHorizontal: 28,

  position: 'relative',

  zIndex: 9999,

},



  headerWelcome: {

    color: COLORS.secondary,

    fontFamily: 'Inter_500Medium',

    fontSize: 15,

  },

headerRight: {

  flexDirection: 'row',

  alignItems: 'center',

  gap: 20,

  position: 'relative',

  zIndex: 9999,

},



notificationBadge: { position: 'absolute', top: 2, right: 1, minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center' },
notificationBadgeText: { color: COLORS.white, fontFamily: 'Inter_700Bold', fontSize: 9 },
notificationDropdown: {

  position: 'absolute',

  top: 55,

  right: 0,

  width: 360,

  maxWidth: 360,

  backgroundColor: COLORS.white,

  borderWidth: 1,

  borderColor: COLORS.border,

  borderRadius: 14,

  padding: 20,

  zIndex: 9999,

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

    color: COLORS.text,

    fontFamily: 'Poppins_600SemiBold',

    fontSize: 17,

  },



  notificationEmptyState: {

    alignItems: 'center',

    paddingVertical: 24,

    paddingHorizontal: 8,

  },



  notificationEmptyTitle: {

    color: COLORS.text,

    fontFamily: 'Inter_600SemiBold',

    fontSize: 14,

    marginTop: 10,

  },



  notificationEmptyText: {

    color: COLORS.secondary,

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
  notificationItemTitle: { flex: 1, color: COLORS.text, fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  notificationItemMessage: { color: COLORS.secondary, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 17, marginTop: 4 },
  notificationItemDate: { color: COLORS.secondary, fontFamily: 'Inter_400Regular', fontSize: 10, marginTop: 6 },
  notificationMarkRead: { color: COLORS.primary, fontFamily: 'Inter_500Medium', fontSize: 10, marginTop: 4 },
  notificationUnreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary },
  notificationRetryButton: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: COLORS.lightBlue },
  notificationRetryText: { color: COLORS.primary, fontFamily: 'Inter_600SemiBold', fontSize: 12 },

  avatar: {

    width: 48,

    height: 48,

    borderRadius: 24,

    backgroundColor: COLORS.primary,

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

    color: COLORS.white,

    fontFamily: 'Poppins_600SemiBold',

    fontSize: 18,

  },



  /* SCROLL */



  scrollContent: {

    paddingHorizontal: 18,

    paddingTop: 25,

    paddingBottom: 35,

  },



  desktopScrollContent: {

    paddingHorizontal: 32,

    paddingTop: 28,

  },



  /* HEADING */



  pageHeading: {

    marginBottom: 25,

  },



  pageTitle: {

    color: COLORS.text,

    fontFamily: 'Poppins_700Bold',

    fontSize: 34,

    lineHeight: 43,

  },



  pageDate: {

    color: COLORS.secondary,

    fontFamily: 'Inter_400Regular',

    fontSize: 18,

    marginTop: 3,

  },



  /* STATS */



  statsGrid: {

    flexDirection: 'row',

    flexWrap: 'wrap',

    justifyContent: 'space-between',

    marginBottom: 28,

  },



  statCard: {

    width: '48.7%',

    backgroundColor: COLORS.white,

    borderWidth: 1,

    borderColor: COLORS.border,

    borderRadius: 10,

    minHeight: 88,

    paddingHorizontal: 16,

    paddingVertical: 14,

    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 10,

  },



  statIcon: {

    width: 51,

    height: 51,

    borderRadius: 9,

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 14,

  },



  statTextArea: {

    flex: 1,

  },



  statValue: {

    color: COLORS.text,

    fontFamily: 'Poppins_700Bold',

    fontSize: 23,

  },



  statLabel: {

    color: COLORS.secondary,

    fontFamily: 'Inter_400Regular',

    fontSize: 12,

    marginTop: 1,

  },



  /* MAIN GRID */



  mainGrid: {

    width: '100%',

  },



  desktopMainGrid: {

    flexDirection: 'row',

    gap: 27,

    alignItems: 'flex-start',

  },



  /* MEDICINE */



  medicineCard: {

    flex: 1,

    backgroundColor: COLORS.white,

    borderWidth: 1,

    borderColor: COLORS.border,

    borderRadius: 10,

    paddingHorizontal: 22,

    paddingVertical: 25,

    marginBottom: 20,

  },



  sectionHeader: {

    flexDirection: 'row',

    justifyContent: 'space-between',

    alignItems: 'center',

    columnGap: 16,

    marginBottom: 15,

  },



  sectionTitle: {

    color: COLORS.text,

    fontFamily: 'Poppins_600SemiBold',

    fontSize: 21,

    flexShrink: 1,

  },



  viewAll: {

    color: COLORS.primary,

    fontFamily: 'Inter_600SemiBold',

    fontSize: 14,

    flexShrink: 0,

    paddingVertical: 6,

    paddingHorizontal: 6,

  },



  medicineRow: {

    minHeight: 82,

    flexDirection: 'row',

    alignItems: 'center',

    borderBottomWidth: 1,

    borderBottomColor: COLORS.border,

  },



  medicineIcon: {

    width: 51,

    height: 51,

    borderRadius: 9,

    backgroundColor: COLORS.lightBlue,

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 13,

  },



  medicineInfo: {

    flex: 1,

  },



  medicineName: {

    color: COLORS.text,

    fontFamily: 'Inter_600SemiBold',

    fontSize: 16,

  },



  medicineDose: {

    color: COLORS.secondary,

    fontFamily: 'Inter_500Medium',

  },



  medicineTime: {

    color: COLORS.secondary,

    fontFamily: 'Inter_400Regular',

    fontSize: 14,

    marginTop: 4,

  },



  medicineStatus: {

    borderRadius: 18,

    paddingHorizontal: 10,

    paddingVertical: 7,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 3,

  },



  takenStatus: {

    backgroundColor: COLORS.lightGreen,

  },



  pendingStatus: {

    backgroundColor: COLORS.lightPending,

  },



  statusText: {

    fontFamily: 'Inter_600SemiBold',

    fontSize: 11,

  },



  /* RIGHT */



  rightColumn: {

    flex: 0.85,

  },



  mobileRightColumn: {

    width: '100%',

  },



  /* ADHERENCE */



  adherenceCard: {

    backgroundColor: COLORS.primary,

    borderTopLeftRadius: 10,

    borderTopRightRadius: 10,

    padding: 22,

  },



  adherenceHeader: {

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

  },



  adherenceTitle: {

    color: COLORS.white,

    fontFamily: 'Inter_600SemiBold',

    fontSize: 15,

  },



  goodProgress: {

    backgroundColor: 'rgba(255,255,255,0.18)',

    borderRadius: 18,

    paddingHorizontal: 13,

    paddingVertical: 6,

  },



  goodProgressText: {

    color: COLORS.white,

    fontFamily: 'Inter_500Medium',

    fontSize: 11,

  },



  adherenceBody: {

    flexDirection: 'row',

    alignItems: 'center',

    marginTop: 18,

  },



  circleContainer: {

    width: 125,

    height: 125,

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 20,

  },



  circleText: {

    position: 'absolute',

    alignItems: 'center',

    justifyContent: 'center',

  },



  percentText: {

    color: COLORS.white,

    fontFamily: 'Poppins_700Bold',

    fontSize: 25,

  },



  adherenceInfo: {

    flex: 1,

  },



  takenNumber: {

    color: COLORS.white,

    fontFamily: 'Poppins_700Bold',

    fontSize: 25,

  },



  missedNumber: {

    color: COLORS.white,

    opacity: 0.85,

    fontFamily: 'Inter_500Medium',

    fontSize: 15,

    marginTop: 2,

  },



  keepText: {

    color: COLORS.white,

    opacity: 0.85,

    fontFamily: 'Inter_400Regular',

    fontSize: 11,

    marginTop: 12,

  },



  /* APPOINTMENT */



  appointmentCard: {

    backgroundColor: COLORS.white,

    borderWidth: 1,

    borderColor: COLORS.border,

    borderBottomLeftRadius: 10,

    borderBottomRightRadius: 10,

    padding: 22,

    marginBottom: 20,

  },



  appointmentBody: {

    flexDirection: 'row',

    alignItems: 'flex-start',

    marginTop: 18,

  },



  calendarBox: {

    width: 51,

    height: 51,

    borderRadius: 9,

    backgroundColor: COLORS.lightBlue,

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 13,

  },



  appointmentDetails: {

    flex: 1,

  },



  doctorName: {

    color: COLORS.text,

    fontFamily: 'Inter_600SemiBold',

    fontSize: 16,

  },



  doctorDetails: {

    color: COLORS.secondary,

    fontFamily: 'Inter_400Regular',

    fontSize: 13,

    marginTop: 3,

  },



  appointmentDate: {

    color: COLORS.text,

    fontFamily: 'Inter_500Medium',

    fontSize: 13,

    marginTop: 13,

  },



  opd: {

    color: COLORS.secondary,

    fontFamily: 'Inter_400Regular',

    fontSize: 11,

    marginTop: 3,

  },



  upcomingBadge: {

    backgroundColor: COLORS.lightBlue,

    borderRadius: 18,

    paddingHorizontal: 9,

    paddingVertical: 6,

    flexDirection: 'row',

    alignItems: 'center',

    gap: 3,

  },



  upcomingText: {

    color: COLORS.primary,

    fontFamily: 'Inter_600SemiBold',

    fontSize: 10,

  },



  /* QUICK ACTIONS */



  quickTitle: {

    color: COLORS.text,

    fontFamily: 'Poppins_600SemiBold',

    fontSize: 21,

    marginTop: 4,

    marginBottom: 14,

  },



  quickGrid: {

    flexDirection: 'row',

    flexWrap: 'wrap',

    justifyContent: 'space-between',

  },



  quickAction: {

    width: '48.7%',

    minHeight: 80,

    backgroundColor: COLORS.white,

    borderWidth: 1,

    borderColor: COLORS.border,

    borderRadius: 10,

    padding: 15,

    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 12,

  },



  quickIcon: {

    width: 51,

    height: 51,

    borderRadius: 9,

    backgroundColor: COLORS.lightBlue,

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 13,

  },



  quickLabel: {

    color: COLORS.text,

    fontFamily: 'Inter_600SemiBold',

    fontSize: 13,

    flex: 1,

  },



  pressed: {

    opacity: 0.7,

    transform: [{ scale: 0.98 }],

  },



  /* MOBILE NAV */



  mobileNav: {

    height: 72,

    backgroundColor: COLORS.white,

    borderTopWidth: 1,

    borderTopColor: COLORS.border,

    flexDirection: 'row',

    justifyContent: 'space-around',

    alignItems: 'center',

    paddingHorizontal: 20,

  },



  mobileNavItem: {

    height: 48,

    flex: 1,

    maxWidth: 96,

    alignItems: 'center',

    justifyContent: 'center',

    gap: 4,

    borderRadius: 10,

    paddingVertical: 5,

  },



  mobileNavActiveItem: {

    backgroundColor: '#E5F2F9',

    borderRadius: 10,

  },



  mobileNavText: {

    color: COLORS.secondary,

    fontFamily: 'Inter_500Medium',

    fontSize: 11,

  },



  mobileNavActiveText: {

    color: COLORS.primary,

    fontFamily: 'Inter_700Bold',

  },


  /* DASHBOARD STATES */

  dashboardStateCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 34,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },

  dashboardStateTitle: {
    color: COLORS.text,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    marginTop: 12,
    textAlign: 'center',
  },

  dashboardStateText: {
    color: COLORS.secondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },

  dashboardRetry: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },

  dashboardRetryText: {
    color: COLORS.white,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },

  dashboardWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.lightPending,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 16,
  },

  dashboardWarningText: {
    flex: 1,
    color: COLORS.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },

  dashboardWarningRetry: {
    color: COLORS.primary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },


  /* MEDICINE ACTIONS */

  medicineActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },

  medicineActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },

  takenActionButton: {
    borderColor: COLORS.green,
    backgroundColor: COLORS.lightGreen,
  },

  missedActionButton: {
    borderColor: COLORS.red,
    backgroundColor: COLORS.lightRed,
  },

  medicineActionText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },

  medicineActionDisabled: {
    opacity: 0.5,
  },

  medicineEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },

  medicineEmptyTitle: {
    color: COLORS.text,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    marginTop: 10,
  },

  medicineEmptyText: {
    color: COLORS.secondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },

  medicineEmptyButton: {
    marginTop: 14,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },

  medicineEmptyButtonText: {
    color: COLORS.white,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },

  appointmentEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    paddingHorizontal: 16,
  },

  appointmentEmptyText: {
    color: COLORS.secondary,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 8,
  },

  appointmentEmptyButton: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },

  appointmentEmptyButtonText: {
    color: COLORS.white,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },

});