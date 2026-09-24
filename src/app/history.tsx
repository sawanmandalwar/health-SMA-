import React, { useEffect, useState } from 'react';

import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  useWindowDimensions,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import { Ionicons } from '@expo/vector-icons';

import { useRouter } from 'expo-router';

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

const HISTORY_STORAGE_KEY =
  '@health_saathi_medicine_history';


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
    useWindowDimensions();


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

  useEffect(() => {

    loadHistory();

  }, []);


  const loadHistory = async () => {

    try {

      const saved =
        await AsyncStorage.getItem(
          HISTORY_STORAGE_KEY
        );


      if (!saved) {

        setHistory([]);

        return;

      }


      const parsed =
        JSON.parse(saved);


      if (
        Array.isArray(parsed)
      ) {

        // newest first
        const sorted =
          [...parsed].sort(
            (a, b) =>
              b.timestamp -
              a.timestamp
          );


        setHistory(sorted);

      }

    } catch (error) {

      console.log(
        'History loading error:',
        error
      );

      setHistory([]);

    }

  };


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
            {item.time}
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
              85%
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
              {history.filter(
                item =>
                  item.status ===
                  'Taken'
              ).length}{' '}
              Taken ·{' '}

              {history.filter(
                item =>
                  item.status ===
                  'Missed'
              ).length}{' '}
              Missed
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