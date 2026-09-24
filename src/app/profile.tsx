import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const COLORS = {
  primaryBlue: '#1E76B6',
  darkBlue: '#155A8C',
  primaryGreen: '#39A78D',
  lightBlue: '#E7F2FA',
  lightGreen: '#E5F7F1',
  dangerRed: '#E2574C',
  background: '#EAF3F5',
  text: '#1D2B33',
  secondary: '#71858D',
  white: '#FFFFFF',
  border: '#D5E4E8',
};

const PROFILE_KEY = '@health_saathi_profile';

interface ProfileData {
  name: string;
  email: string;
  phone: string;
  age: string;
  gender: string;
  bloodGroup: string;
  emergencyName: string;
  emergencyPhone: string;
}

const defaultProfile: ProfileData = {
  name: 'Sawan Mandalwar',
  email: 'sawan@example.com',
  phone: '+91 98765 43210',
  age: '',
  gender: '',
  bloodGroup: '',
  emergencyName: '',
  emergencyPhone: '',
};

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 650;

  const [profile, setProfile] =
    useState<ProfileData>(defaultProfile);

  const [editing, setEditing] = useState(false);
  const [notifications, setNotifications] =
    useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');
  const [emergencyName, setEmergencyName] =
    useState('');
  const [emergencyPhone, setEmergencyPhone] =
    useState('');

  const [passwordModal, setPasswordModal] =
    useState(false);

  const [currentPassword, setCurrentPassword] =
    useState('');
  const [newPassword, setNewPassword] =
    useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const saved = await AsyncStorage.getItem(
        PROFILE_KEY
      );

      if (saved) {
        const data = JSON.parse(saved);
        setProfile(data);
        setFormValues(data);
      } else {
        setFormValues(defaultProfile);
      }
    } catch (error) {
      console.log('Error loading profile:', error);
      setFormValues(defaultProfile);
    }
  };

  const setFormValues = (data: ProfileData) => {
    setName(data.name);
    setEmail(data.email);
    setPhone(data.phone);
    setAge(data.age);
    setGender(data.gender);
    setBloodGroup(data.bloodGroup);
    setEmergencyName(data.emergencyName);
    setEmergencyPhone(data.emergencyPhone);
  };

  const saveProfile = async () => {
    const updatedProfile: ProfileData = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      age: age.trim(),
      gender: gender.trim(),
      bloodGroup: bloodGroup.trim(),
      emergencyName: emergencyName.trim(),
      emergencyPhone: emergencyPhone.trim(),
    };

    if (!updatedProfile.name) {
      Alert.alert(
        'Name Required',
        'Please enter your name.'
      );
      return;
    }

    try {
      await AsyncStorage.setItem(
        PROFILE_KEY,
        JSON.stringify(updatedProfile)
      );

      setProfile(updatedProfile);
      setEditing(false);

      Alert.alert(
        'Profile Updated',
        'Your profile has been updated successfully.'
      );
    } catch (error) {
      Alert.alert(
        'Error',
        'Unable to save your profile.'
      );
    }
  };

  const cancelEdit = () => {
    setFormValues(profile);
    setEditing(false);
  };

  const changePassword = () => {
    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      Alert.alert(
        'Missing Information',
        'Please fill all password fields.'
      );
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(
        'Weak Password',
        'New password should contain at least 6 characters.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(
        'Password Mismatch',
        'New password and confirm password do not match.'
      );
      return;
    }

    setPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    Alert.alert(
      'Password Changed',
      'Your password has been changed successfully.'
    );
  };

  const logout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => {
            router.replace('/');
          },
        },
      ]
    );
  };

  const firstLetter =
    profile.name?.charAt(0).toUpperCase() || 'S';

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          isMobile && styles.mobileScrollContent,
        ]}
      >

        {/* PAGE HEADER */}
        <View
          style={[
            styles.pageHeader,
            isMobile && styles.pageHeaderMobile,
          ]}
        >
          <View style={styles.pageHeaderText}>
            <Text
              style={[
                styles.title,
                isMobile && styles.mobileTitle,
              ]}
            >
              Profile
            </Text>

            <Text style={styles.subtitle}>
              Manage your personal information and
              preferences.
            </Text>
          </View>

          {!editing && (
            <Pressable
              onPress={() => setEditing(true)}
              style={({ pressed }) => [
                styles.editButton,
                isMobile && styles.editButtonMobile,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name="create-outline"
                size={19}
                color={COLORS.white}
              />

              <Text style={styles.editButtonText}>
                Edit Profile
              </Text>
            </Pressable>
          )}
        </View>

        {/* PROFILE CARD */}
        <View
          style={[
            styles.profileCard,
            isMobile && styles.profileCardMobile,
          ]}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {firstLetter}
            </Text>
          </View>

          <View style={styles.profileMain}>
            <Text style={styles.profileName}>
              {profile.name || 'Your Name'}
            </Text>

            <Text style={styles.profileEmail}>
              {profile.email || 'your@email.com'}
            </Text>

            <View style={styles.phoneRow}>
              <Ionicons
                name="call-outline"
                size={16}
                color={COLORS.secondary}
              />

              <Text style={styles.phoneText}>
                {profile.phone || 'Add mobile number'}
              </Text>
            </View>
          </View>
        </View>

        {/* PERSONAL INFORMATION */}
        <SectionTitle
          icon="person-outline"
          title="Personal Information"
        />

        <View style={styles.card}>
          {editing ? (
            <>
              <Input
                label="Full Name"
                value={name}
                placeholder="Enter your name"
                onChangeText={setName}
              />

              <Input
                label="Email"
                value={email}
                placeholder="Enter your email"
                onChangeText={setEmail}
                keyboardType="email-address"
              />

              <Input
                label="Mobile Number"
                value={phone}
                placeholder="Enter mobile number"
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />

              <Input
                label="Age"
                value={age}
                placeholder="Enter age"
                onChangeText={setAge}
                keyboardType="numeric"
              />

              <Input
                label="Gender"
                value={gender}
                placeholder="Male / Female / Other"
                onChangeText={setGender}
              />

              <Input
                label="Blood Group"
                value={bloodGroup}
                placeholder="e.g. O+"
                onChangeText={setBloodGroup}
              />

              <View style={styles.editButtons}>
                <Pressable
                  onPress={cancelEdit}
                  style={styles.cancelButton}
                >
                  <Text style={styles.cancelText}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  onPress={saveProfile}
                  style={styles.saveButton}
                >
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={COLORS.white}
                  />

                  <Text style={styles.saveText}>
                    Save Changes
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <InfoRow
                icon="person-outline"
                label="Full Name"
                value={profile.name}
              />

              <InfoRow
                icon="mail-outline"
                label="Email"
                value={profile.email}
              />

              <InfoRow
                icon="call-outline"
                label="Mobile Number"
                value={profile.phone}
              />

              <InfoRow
                icon="calendar-outline"
                label="Age"
                value={profile.age || 'Not added'}
              />

              <InfoRow
                icon="male-female-outline"
                label="Gender"
                value={profile.gender || 'Not added'}
              />

              <InfoRow
                icon="water-outline"
                label="Blood Group"
                value={profile.bloodGroup || 'Not added'}
                last
              />
            </>
          )}
        </View>

        {/* EMERGENCY CONTACT */}
        <SectionTitle
          icon="medical-outline"
          title="Emergency Contact"
        />

        <View style={styles.card}>
          {editing ? (
            <>
              <Input
                label="Contact Name"
                value={emergencyName}
                placeholder="e.g. Family member"
                onChangeText={setEmergencyName}
              />

              <Input
                label="Contact Number"
                value={emergencyPhone}
                placeholder="Enter emergency number"
                onChangeText={setEmergencyPhone}
                keyboardType="phone-pad"
              />
            </>
          ) : (
            <>
              <InfoRow
                icon="person-outline"
                label="Contact Name"
                value={
                  profile.emergencyName || 'Not added'
                }
              />

              <InfoRow
                icon="call-outline"
                label="Contact Number"
                value={
                  profile.emergencyPhone || 'Not added'
                }
                last
              />
            </>
          )}
        </View>

        {/* SETTINGS */}
        <SectionTitle
          icon="settings-outline"
          title="Settings"
        />

        <View style={styles.card}>
          <SettingRow
            icon="notifications-outline"
            title="Notifications"
            subtitle="Medicine and appointment reminders"
          >
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{
                false: '#C8D5D9',
                true: COLORS.primaryGreen,
              }}
              thumbColor={COLORS.white}
            />
          </SettingRow>

          <SettingRow
            icon="lock-closed-outline"
            title="Change Password"
            subtitle="Update your account password"
            onPress={() => setPasswordModal(true)}
          />

          <SettingRow
            icon="shield-checkmark-outline"
            title="Privacy & Security"
            subtitle="Manage your account security"
            last
          />
        </View>

        {/* LOGOUT */}
        <Pressable
          onPress={logout}
          style={styles.logoutButton}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color={COLORS.dangerRed}
          />

          <Text style={styles.logoutText}>
            Logout
          </Text>
        </Pressable>

      </ScrollView>

      {/* CHANGE PASSWORD MODAL */}
      {passwordModal && (
        <View style={styles.overlay}>
          <View
            style={[
              styles.passwordModal,
              isMobile && styles.passwordModalMobile,
            ]}
          >
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  Change Password
                </Text>

                <Text style={styles.modalSubtitle}>
                  Create a new secure password.
                </Text>
              </View>

              <Pressable
                onPress={() => setPasswordModal(false)}
              >
                <Ionicons
                  name="close"
                  size={26}
                  color={COLORS.secondary}
                />
              </Pressable>
            </View>

            <Input
              label="Current Password"
              value={currentPassword}
              placeholder="Enter current password"
              onChangeText={setCurrentPassword}
              secureTextEntry
            />

            <Input
              label="New Password"
              value={newPassword}
              placeholder="Enter new password"
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <Input
              label="Confirm Password"
              value={confirmPassword}
              placeholder="Confirm new password"
              onChangeText={setConfirmPassword}
              secureTextEntry
            />

            <View style={styles.passwordButtons}>
              <Pressable
                onPress={() => setPasswordModal(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                onPress={changePassword}
                style={styles.saveButton}
              >
                <Text style={styles.saveText}>
                  Change Password
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        <BottomTab
          icon="home"
          label="Home"
          onPress={() => router.push('/home')}
        />

        <BottomTab
          icon="medical"
          label="Medicines"
          onPress={() => router.push('/medicines')}
        />

        <BottomTab
          icon="calendar"
          label="Appointments"
          onPress={() => router.push('/appointments')}
        />

        <BottomTab
          icon="person"
          label="Profile"
          active
          onPress={() => router.push('/profile')}
        />
      </View>
    </View>
  );
}

/* SECTION TITLE */

function SectionTitle({
  icon,
  title,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      <Ionicons
        name={icon}
        size={21}
        color={COLORS.primaryBlue}
      />

      <Text style={styles.sectionTitle}>
        {title}
      </Text>
    </View>
  );
}

/* INFO ROW */

function InfoRow({
  icon,
  label,
  value,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        !last && styles.infoBorder,
      ]}
    >
      <View style={styles.infoIcon}>
        <Ionicons
          name={icon}
          size={19}
          color={COLORS.primaryBlue}
        />
      </View>

      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>
          {label}
        </Text>

        <Text style={styles.infoValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

/* SETTING ROW */

function SettingRow({
  icon,
  title,
  subtitle,
  children,
  onPress,
  last = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  const content = (
    <View
      style={[
        styles.settingRow,
        !last && styles.settingBorder,
      ]}
    >
      <View style={styles.settingIcon}>
        <Ionicons
          name={icon}
          size={20}
          color={COLORS.primaryBlue}
        />
      </View>

      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>
          {title}
        </Text>

        <Text style={styles.settingSubtitle}>
          {subtitle}
        </Text>
      </View>

      {children}

      {!children && onPress && (
        <Ionicons
          name="chevron-forward"
          size={20}
          color={COLORS.secondary}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress}>
        {content}
      </Pressable>
    );
  }

  return content;
}

/* INPUT */

function Input({
  label,
  value,
  placeholder,
  onChangeText,
  keyboardType,
  secureTextEntry = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (text: string) => void;
  keyboardType?:
    | 'default'
    | 'email-address'
    | 'phone-pad'
    | 'numeric';
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AAAB0"
        keyboardType={keyboardType || 'default'}
        secureTextEntry={secureTextEntry}
        style={styles.input}
      />
    </View>
  );
}

/* BOTTOM TAB */

function BottomTab({
  icon,
  label,
  active = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
}) {
  const scale = useRef(
    new Animated.Value(1)
  ).current;

  return (
    <Pressable
      onPressIn={() =>
        Animated.spring(scale, {
          toValue: 1.12,
          useNativeDriver: true,
        }).start()
      }
      onPressOut={() =>
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }).start()
      }
      onPress={onPress}
      style={styles.bottomTab}
    >
      <Animated.View
        style={[
          styles.bottomTabInner,
          {
            transform: [{ scale }],
          },
        ]}
      >
        <Ionicons
          name={icon}
          size={22}
          color={
            active
              ? COLORS.primaryBlue
              : COLORS.secondary
          }
        />

        <Text
          style={[
            styles.bottomText,
            active && styles.bottomTextActive,
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    padding: 28,
    paddingBottom: 120,
  },

  mobileScrollContent: {
    padding: 16,
    paddingBottom: 110,
  },

  /* PAGE HEADER */

  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },

  pageHeaderMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: 22,
  },

  pageHeaderText: {
    flex: 1,
  },

  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 34,
    color: COLORS.text,
  },

  mobileTitle: {
    fontSize: 28,
  },

  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: COLORS.secondary,
    marginTop: 4,
  },

  /* EDIT PROFILE BUTTON */

  editButton: {
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 9,
    paddingHorizontal: 17,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 15,
  },

  editButtonMobile: {
    width: '100%',
    marginLeft: 0,
    marginTop: 15,
    paddingVertical: 14,
  },

  editButtonText: {
    color: COLORS.white,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    marginLeft: 6,
  },

  pressed: {
    opacity: 0.75,
  },

  /* PROFILE CARD */

  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 15,
    padding: 25,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 28,
  },

  profileCardMobile: {
    padding: 18,
  },

  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: COLORS.primaryBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },

  avatarText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 32,
    color: COLORS.white,
  },

  profileMain: {
    flex: 1,
  },

  profileName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 22,
    color: COLORS.text,
  },

  profileEmail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: COLORS.secondary,
    marginTop: 3,
  },

  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },

  phoneText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: COLORS.secondary,
    marginLeft: 6,
  },

  /* SECTION */

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 19,
    color: COLORS.text,
    marginLeft: 8,
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 20,
    paddingVertical: 5,
    marginBottom: 27,
  },

  /* INFO */

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },

  infoBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  infoContent: {
    flex: 1,
  },

  infoLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: COLORS.secondary,
  },

  infoValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: COLORS.text,
    marginTop: 2,
  },

  /* INPUT */

  inputContainer: {
    marginBottom: 15,
  },

  inputLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 7,
  },

  input: {
    height: 46,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    paddingHorizontal: 13,
    color: COLORS.text,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },

  /* EDIT BUTTONS */

  editButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
    marginBottom: 15,
  },

  cancelButton: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cancelText: {
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.secondary,
    fontSize: 13,
  },

  saveButton: {
    flex: 1,
    backgroundColor: COLORS.primaryBlue,
    borderRadius: 9,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },

  saveText: {
    fontFamily: 'Inter_600SemiBold',
    color: COLORS.white,
    fontSize: 13,
    marginLeft: 5,
  },

  /* SETTINGS */

  settingRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },

  settingBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  settingIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },

  settingContent: {
    flex: 1,
  },

  settingTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: COLORS.text,
  },

  settingSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: COLORS.secondary,
    marginTop: 3,
  },

  /* LOGOUT */

  logoutButton: {
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3C9C5',
    backgroundColor: '#FDEBE9',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 20,
  },

  logoutText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: COLORS.dangerRed,
    marginLeft: 7,
  },

  /* PASSWORD MODAL */

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(29,43,51,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },

  passwordModal: {
    width: '100%',
    maxWidth: 550,
    backgroundColor: '#E4F4F7',
    borderRadius: 16,
    padding: 25,
  },

  passwordModalMobile: {
    padding: 18,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },

  modalTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 22,
    color: COLORS.text,
  },

  modalSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: COLORS.secondary,
    marginTop: 3,
  },

  passwordButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },

  /* BOTTOM NAVIGATION */

  bottomNav: {
    position: 'absolute',
    left: 15,
    right: 15,
    bottom: 15,
    height: 67,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 8,
    borderWidth: 1,
    borderColor: '#DDE8EB',
  },

  bottomTab: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },

  bottomTabInner: {
    alignItems: 'center',
  },

  bottomText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: COLORS.secondary,
    marginTop: 3,
  },

  bottomTextActive: {
    color: COLORS.primaryBlue,
    fontFamily: 'Inter_600SemiBold',
  },
});