import React, { useState , useCallback } from 'react';
import { useFocusEffect , useRouter } from 'expo-router';
import { apiFetch, parseJson } from '../services/api';

import AppHeader from '../components/AppHeader';

import { SafeAreaView } from 'react-native-safe-area-context';

import { useResponsiveDimensions } from '../hooks/useResponsiveDimensions';
import { formatDisplayTime } from '../utils/format-display-time';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Ionicons } from '@expo/vector-icons';



import {
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
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
// STORAGE
// ======================================================



// ======================================================
// TYPE
// ======================================================

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
// SCREEN
// ======================================================

export default function HistoryScreen() {

  const router = useRouter();

  const { width } =
    useResponsiveDimensions();


  // ====================================================
  // RESPONSIVE
  // ====================================================

  const isMobile =
    width < 600;


  // ====================================================
  // FONTS
  // ====================================================

  const [fontsLoaded] =
    useFonts({

      Poppins_500Medium,

      Poppins_600SemiBold,

      Poppins_700Bold,

      Inter_400Regular,

      Inter_500Medium,

      Inter_600SemiBold,

    });


  // ====================================================
  // STATE
  // ====================================================

  const [history, setHistory] =
    useState<HistoryItem[]>([]);


  // ====================================================
  // LOAD HISTORY
  // ====================================================

  const loadHistory = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        console.log('Authentication token not found. Please log in again.');
        setHistory([]);
        return;
      }

      const response = await apiFetch(`/api/history`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load medicine history.');
      }

      const records = Array.isArray(data.history) ? data.history : [];

      const formattedHistory: HistoryItem[] = records
        .map((item: any) => {
          const historyDate = item.scheduledDate || item.createdAt;
          const parsedDate = historyDate ? new Date(historyDate) : null;
          const validDate = parsedDate && !Number.isNaN(parsedDate.getTime());

          return {
            id: String(item._id || item.id || `${item.medicineId}-${historyDate}`),
            medicineId: String(item.medicineId?._id || item.medicineId || ''),
            medicineName: item.medicineName || 'Unknown medicine',
            dosage: item.dosage || '',
            time: item.time || '',
            status: item.status,
            date: validDate
              ? parsedDate!.toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '',
            timestamp: validDate ? parsedDate!.getTime() : 0,
          };
        })
        .filter(
          (item: HistoryItem) => item.status === 'Taken' || item.status === 'Missed'
        )
        .sort((a: HistoryItem, b: HistoryItem) => b.timestamp - a.timestamp);

      setHistory(formattedHistory);
    } catch (error) {
      console.error('History loading error:', error);
      setHistory([]);
    }
  };

 useFocusEffect(
  useCallback(() => {
    loadHistory();
  }, [])
);


  // ====================================================
  // WEEKLY ADHERENCE (CURRENT WEEK, MONDAY-SUNDAY)
  // ====================================================

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  const daysSinceMonday = (startOfWeek.getDay() + 6) % 7;
  startOfWeek.setDate(startOfWeek.getDate() - daysSinceMonday);

  const startOfNextWeek = new Date(startOfWeek);
  startOfNextWeek.setDate(startOfNextWeek.getDate() + 7);

  const thisWeekHistory = history.filter((item) => {
    const itemDate = new Date(item.timestamp);
    return (
      item.timestamp > 0 &&
      itemDate >= startOfWeek &&
      itemDate < startOfNextWeek
    );
  });

  const weeklyTaken = thisWeekHistory.filter(
    (item) => item.status === 'Taken'
  ).length;

  const weeklyMissed = thisWeekHistory.filter(
    (item) => item.status === 'Missed'
  ).length;

  const weeklyTotal = weeklyTaken + weeklyMissed;
  const weeklyAdherence = weeklyTotal === 0
    ? 0
    : Math.round((weeklyTaken / weeklyTotal) * 100);


  // ====================================================
  // STATUS BADGE
  // ====================================================

  const StatusBadge = ({
    status,
  }: {
    status: 'Taken' | 'Missed';
  }) => {

    const taken =
      status === 'Taken';


    return (

      <View
        style={[
          styles.statusBadge,

          taken
            ? styles.takenBadge
            : styles.missedBadge,
        ]}
      >

        <Ionicons

          name={
            taken
              ? 'checkmark-circle'
              : 'warning-outline'
          }

          size={15}

          color={
            taken
              ? COLORS.takenText
              : COLORS.missedText
          }

        />


        <Text
          style={[
            styles.statusText,

            {
              color: taken
                ? COLORS.takenText
                : COLORS.missedText,
            },
          ]}
        >
          {status}
        </Text>

      </View>

    );

  };


  // ====================================================
  // HISTORY ITEM
  // ====================================================

  const HistoryRow = ({
    item,
  }: {
    item: HistoryItem;
  }) => (

    <View
      style={[
        styles.historyRow,

        isMobile &&
          styles.historyRowMobile,
      ]}
    >

      {/* LEFT */}

      <View
        style={
          styles.historyLeft
        }
      >

        <View
          style={
            styles.medicineIcon
          }
        >

          <Ionicons
            name="medical-outline"
            size={25}
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
              styles.nameRow
            }
          >

            <Text
              style={
                styles.medicineName
              }
            >
              {item.medicineName}
            </Text>


            <Text
              style={
                styles.dosage
              }
            >
              {item.dosage}
            </Text>

          </View>


          <Text
            style={
              styles.time
            }
          >
            {formatDisplayTime(item.time)}
          </Text>

        </View>

      </View>


      {/* STATUS */}

      <StatusBadge
        status={
          item.status
        }
      />

    </View>

  );


  // ====================================================
  // EMPTY
  // ====================================================

  if (!fontsLoaded) {

    return null;

  }


  // ====================================================
  // UI
  // ====================================================

  return (

    <SafeAreaView
      style={
        styles.screen
      }

      edges={['top']}
    >

      {/* ================================================= */}
      {/* HEADER */}
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

        {/* PAGE TITLE */}

        <View
          style={
            styles.titleContainer
          }
        >

          <Text
            style={[
              styles.pageTitle,

              isMobile &&
                styles.pageTitleMobile,
            ]}
          >
            Medicine History
          </Text>


          <Text
            style={
              styles.subtitle
            }
          >
            A clear record of your recent doses.
          </Text>

        </View>


        {/* ================================================= */}
        {/* WEEKLY ADHERENCE */}
        {/* ================================================= */}

        <View
          style={[
            styles.adherenceCard,

            isMobile &&
              styles.adherenceCardMobile,
          ]}
        >

          <View
            style={
              styles.circle
            }
          >

            <Text
              style={
                styles.circleText
              }
            >
              {weeklyAdherence}% 
            </Text>

          </View>


          <View
            style={
              styles.adherenceInfo
            }
          >

            <Text
              style={
                styles.adherenceTitle
              }
            >
              Weekly adherence
            </Text>


            <Text
              style={
                styles.adherenceSubtitle
              }
            >
              {weeklyTaken} Taken · {weeklyMissed} Missed
            </Text>

          </View>

        </View>


        {/* ================================================= */}
        {/* HISTORY CARD */}
        {/* ================================================= */}

        <View
          style={
            styles.historyCard
          }
        >

          {history.length === 0 ? (

            <View
              style={
                styles.empty
              }
            >

              <Ionicons
                name="time-outline"
                size={48}
                color={
                  COLORS.primaryBlue
                }
              />


              <Text
                style={
                  styles.emptyTitle
                }
              >
                No medicine history yet
              </Text>


              <Text
                style={
                  styles.emptyText
                }
              >
                When you mark a medicine as Taken or Missed,
                it will appear here.
              </Text>


              <Pressable
                onPress={() =>
                  router.push(
                    '/medicines'
                  )
                }

                style={
                  styles.goMedicineButton
                }
              >

                <Text
                  style={
                    styles.goMedicineText
                  }
                >
                  Go to Medicines
                </Text>

              </Pressable>

            </View>

          ) : (

            <>

              <Text
                style={
                  styles.sectionTitle
                }
              >
                Recent doses
              </Text>


              {history.map(
                item => (

                  <HistoryRow
                    key={
                      item.id
                    }

                    item={
                      item
                    }
                  />

                )
              )}

            </>

          )}

        </View>


        <View
          style={{
            height: 100,
          }}
        />

      </ScrollView>


      {/* ================================================= */}
      {/* BOTTOM NAVIGATION */}
      {/* ================================================= */}

      <View
        style={[
          styles.bottomNav,
          !isMobile && styles.bottomNavDesktop,
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
          onPress={() =>
            router.push(
              '/medicines'
            )
          }

          style={
            styles.bottomTab
          }
        >

          <Ionicons
            name="medical-outline"
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

  titleContainer: {
    marginBottom: 24,
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
  // ADHERENCE
  // ====================================================

  adherenceCard: {
    minHeight: 145,

    backgroundColor:
      COLORS.primaryBlue,

    borderRadius: 9,

    paddingHorizontal: 28,

    paddingVertical: 22,

    flexDirection: 'row',

    alignItems: 'center',

    marginBottom: 24,
  },


  adherenceCardMobile: {
    paddingHorizontal: 18,

    paddingVertical: 20,

    minHeight: 125,
  },


  circle: {
    width: 96,

    height: 96,

    borderRadius: 48,

    borderWidth: 8,

    borderColor:
      COLORS.primaryGreen,

    alignItems: 'center',

    justifyContent: 'center',

    marginRight: 20,
  },


  circleText: {
    fontFamily:
      'Poppins_700Bold',

    fontSize: 28,

    color:
      COLORS.white,
  },


  adherenceInfo: {
    flex: 1,
  },


  adherenceTitle: {
    fontFamily:
      'Poppins_700Bold',

    fontSize: 23,

    color:
      COLORS.white,
  },


  adherenceSubtitle: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 15,

    color:
      '#E6F5FA',

    marginTop: 5,
  },


  // ====================================================
  // HISTORY CARD
  // ====================================================

  historyCard: {
    backgroundColor:
      COLORS.white,

    borderRadius: 9,

    borderWidth: 1,

    borderColor:
      COLORS.border,

    paddingHorizontal: 24,

    paddingVertical: 20,
  },


  sectionTitle: {
    fontFamily:
      'Poppins_600SemiBold',

    fontSize: 20,

    color:
      COLORS.mainText,

    marginBottom: 8,
  },


  historyRow: {
    minHeight: 100,

    borderBottomWidth: 1,

    borderBottomColor:
      COLORS.border,

    flexDirection: 'row',

    alignItems: 'center',

    justifyContent:
      'space-between',

    paddingVertical: 18,
  },


  historyRowMobile: {
    minHeight: 92,
  },


  historyLeft: {
    flexDirection: 'row',

    alignItems: 'center',

    flex: 1,
  },


  medicineIcon: {
    width: 48,

    height: 48,

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


  nameRow: {
    flexDirection: 'row',

    alignItems: 'baseline',

    flexWrap: 'wrap',

    gap: 5,
  },


  medicineName: {
    fontFamily:
      'Poppins_600SemiBold',

    fontSize: 17,

    color:
      COLORS.mainText,
  },


  dosage: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 15,

    color:
      COLORS.secondaryText,
  },


  time: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 14,

    color:
      COLORS.secondaryText,

    marginTop: 2,
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
  // EMPTY
  // ====================================================

  empty: {
    minHeight: 320,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 25,
  },


  emptyTitle: {
    fontFamily:
      'Poppins_600SemiBold',

    fontSize: 20,

    color:
      COLORS.mainText,

    marginTop: 14,
  },


  emptyText: {
    fontFamily:
      'Inter_400Regular',

    fontSize: 14,

    color:
      COLORS.secondaryText,

    textAlign: 'center',

    marginTop: 6,

    lineHeight: 21,
  },


  goMedicineButton: {
    marginTop: 18,

    backgroundColor:
      COLORS.primaryBlue,

    paddingHorizontal: 20,

    paddingVertical: 12,

    borderRadius: 7,
  },


  goMedicineText: {
    fontFamily:
      'Inter_600SemiBold',

    fontSize: 14,

    color:
      COLORS.white,
  },


  // ====================================================
  // BOTTOM NAV
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
    minWidth: 75,

    minHeight: 55,

    alignItems: 'center',

    justifyContent: 'center',

    gap: 2,
  },


  bottomText: {
    fontFamily:
      'Inter_500Medium',

    fontSize: 11,

    color:
      COLORS.secondaryText,
  },

});