import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { fetch as expoFetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResponsiveDimensions } from '../hooks/useResponsiveDimensions';
import { apiFetch, parseJson, apiUrl } from '../services/api';
import { deactivatePushTokenWithBackend } from '../services/notificationService';
import { resetTimezoneSyncCache } from '../services/timezoneService';
import AppHeader from '../components/AppHeader';
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
  photoUrl: string;
}

const defaultProfile: ProfileData = {
  name: '',
  email: '',
  phone: '',
  age: '',
  gender: '',
  bloodGroup: '',
  photoUrl: '',
};

export default function ProfileScreen() {
  const { width } = useResponsiveDimensions();
  const isMobile = width < 650;

  const [profile, setProfile] =
    useState<ProfileData>(defaultProfile);

  const [editing, setEditing] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [bloodGroup, setBloodGroup] = useState('');

  const [photoUri, setPhotoUri] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Custom action sheet for Take Photo / Gallery / Remove.
  const [photoActionSheetVisible, setPhotoActionSheetVisible] =
    useState(false);

  const [passwordModal, setPasswordModal] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Full-screen preview of the profile photo.
  const [photoViewerVisible, setPhotoViewerVisible] =
    useState(false);

  const loadProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        Alert.alert('Login Required', 'Please login again.');
        router.replace('/');
        return;
      }

      const response = await apiFetch(`/api/profile`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(data.message || 'Unable to load profile');
      }

      // Keep extra fields locally until they are added to the backend.
      const saved = await AsyncStorage.getItem(PROFILE_KEY);
      const localProfile = saved ? JSON.parse(saved) : {};

      const updatedProfile: ProfileData = {
        name: data.user.name || '',
        email: data.user.email || '',
        phone: data.user.phone || '',
        age: localProfile.age || '',
        gender: localProfile.gender || '',
        bloodGroup: localProfile.bloodGroup || '',
        photoUrl: data.user.photoUrl
          ? apiUrl(String(data.user.photoUrl))
          : '',
      };

      setProfile(updatedProfile);
      setFormValues(updatedProfile);
      setPhotoUri(updatedProfile.photoUrl);

      await AsyncStorage.setItem(
        PROFILE_KEY,
        JSON.stringify(updatedProfile)
      );

      // Keep the shared 'user' cache in sync so the header avatars on
      // other screens show the photo too.
      const rawUser = await AsyncStorage.getItem('user');

      if (rawUser) {
        try {
          const cachedUser = JSON.parse(rawUser);

          await AsyncStorage.setItem(
            'user',
            JSON.stringify({
              ...cachedUser,
              photoUrl: data.user.photoUrl || '',
            })
          );
        } catch {
          // Ignore cache parse errors; next login refreshes it.
        }
      }
    } catch (error) {
      console.log('Error loading profile:', error);
      Alert.alert(
        'Profile Error',
        'Unable to load your profile from server.'
      );
    }
  };

  const setFormValues = (data: ProfileData) => {
    setName(data.name);
    setEmail(data.email);
    setPhone(data.phone);
    setAge(data.age);
    setGender(data.gender);
    setBloodGroup(data.bloodGroup);
  };

  // ==================================================
  // PROFILE PHOTO
  // ==================================================

  const pickOptions = {
    mediaTypes: ['images'] as ['images'],
    allowsEditing: true,
    aspect: [1, 1] as [number, number],
    quality: 0.7,
  };

    const ensureMediaLibraryPermission = async () => {
      const permission =
        await ImagePicker.getMediaLibraryPermissionsAsync();

      let status = permission.status;

      if (permission.canAskAgain && !permission.granted) {
        const requested =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        status = requested.status;
      }

      if (!permission.granted && status !== 'granted') {
        Alert.alert(
          'Permission Needed',
          'Allow photo library access to choose a profile photo.'
        );
        return false;
      }

      return true;
    };

    const ensureCameraPermission = async () => {
      const permission =
        await ImagePicker.getCameraPermissionsAsync();

      let status = permission.status;

      if (permission.canAskAgain && !permission.granted) {
        const requested =
          await ImagePicker.requestCameraPermissionsAsync();
        status = requested.status;
      }

      if (!permission.granted && status !== 'granted') {
        Alert.alert(
          'Permission Needed',
          'Allow camera access to take a profile photo.'
        );
        return false;
      }

      return true;
    };

    const uploadPhotoAsset = async (asset: ImagePicker.ImagePickerAsset) => {
      try {
        // Pickers return jpg; keep png if the system returns one.
        const extension =
          asset.mimeType === 'image/png'
            ? 'png'
            : asset.mimeType === 'image/webp'
            ? 'webp'
            : 'jpg';

        const token = await AsyncStorage.getItem('authToken');

        if (!token) {
          Alert.alert('Login Required', 'Please login again.');
          router.replace('/');
          return;
        }

        setUploadingPhoto(true);

        const formData = new FormData();
        let response: Response;

        if (Platform.OS === 'web') {
          // On web the picker hands out a blob: URL; convert it to a Blob
          // because react-native-web cannot read file:// URIs.
          const blobResponse = await fetch(asset.uri);
          const fileBlob = await blobResponse.blob();

          formData.append(
            'photo',
            fileBlob,
            `profile.${extension}`
          );

          // Browsers can use the global fetch directly for blob: URLs.
          response = await fetch(apiUrl('/api/profile/photo'), {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });
        } else {
          // Native (SDK 57): global fetch is expo/fetch, which rejects
          // { uri, name, type } form parts with "Unsupported FormDataPart
          // implementation". The supported shape is a Blob/File object.
          const photoFile = new File(asset.uri);

          formData.append('photo', photoFile as unknown as Blob);

          // Uploads can be slower than normal API calls, so give them a
          // dedicated 60s deadline.
          const uploadController = new AbortController();
          const uploadTimeout = setTimeout(() => {
            uploadController.abort();
          }, 60000);

          try {
            response = await expoFetch(apiUrl('/api/profile/photo'), {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
              },
              body: formData,
              signal: uploadController.signal,
            } as RequestInit);
          } finally {
            clearTimeout(uploadTimeout);
          }
        }

        const data = await parseJson(response);

        if (!response.ok) {
          throw new Error(
            data.message || 'Unable to update profile photo'
          );
        }

        const photoUrl = data.user?.photoUrl
          ? apiUrl(String(data.user.photoUrl))
          : '';

        setPhotoUri(photoUrl);
        setProfile((current) => ({
          ...current,
          photoUrl,
        }));

        const rawUser = await AsyncStorage.getItem('user');

        if (rawUser) {
          try {
            const cachedUser = JSON.parse(rawUser);

            await AsyncStorage.setItem(
              'user',
              JSON.stringify({
                ...cachedUser,
                photoUrl: data.user.photoUrl || '',
              })
            );
          } catch {
            // Ignore cache parse errors.
          }
        }

        Alert.alert('Profile Photo', 'Photo updated successfully.');
      } catch (error) {
        console.log('Profile photo upload error:', error);
        Alert.alert(
          'Profile Photo',
          error instanceof Error
            ? error.message
            : 'Unable to update profile photo.'
        );
      } finally {
        setUploadingPhoto(false);
      }
    };

    const chooseFromGallery = async () => {
      setPhotoActionSheetVisible(false);

      if (!(await ensureMediaLibraryPermission())) {
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync(
        pickOptions
      );

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      // Show the cropped photo instantly; the upload replaces the local
      // URI with the server URL once it completes.
      setPhotoUri(result.assets[0].uri);

      await uploadPhotoAsset(result.assets[0]);
    };

    const takeWithCamera = async () => {
      setPhotoActionSheetVisible(false);

      if (!(await ensureCameraPermission())) {
        return;
      }

      const result = await ImagePicker.launchCameraAsync(
        pickOptions
      );

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      setPhotoUri(result.assets[0].uri);

      await uploadPhotoAsset(result.assets[0]);
    };

    const removePhoto = async () => {
      setPhotoActionSheetVisible(false);

      try {
        const token = await AsyncStorage.getItem('authToken');

        if (!token) {
          Alert.alert('Login Required', 'Please login again.');
          router.replace('/');
          return;
        }

        const response = await apiFetch(`/api/profile/photo`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await parseJson(response);

        if (!response.ok) {
          throw new Error(
            data.message || 'Unable to remove profile photo'
          );
        }

        setPhotoUri('');
        setProfile((current) => ({
          ...current,
          photoUrl: '',
        }));

        const rawUser = await AsyncStorage.getItem('user');

        if (rawUser) {
          try {
            const cachedUser = JSON.parse(rawUser);

            await AsyncStorage.setItem(
              'user',
              JSON.stringify({
                ...cachedUser,
                photoUrl: '',
              })
            );
          } catch {
            // Ignore cache parse errors.
          }
        }

        Alert.alert('Profile Photo', 'Photo removed.');
      } catch (error) {
        console.log('Profile photo removal error:', error);
        Alert.alert(
          'Profile Photo',
          error instanceof Error
            ? error.message
            : 'Unable to remove profile photo.'
        );
      }
    };

  const openPhotoActionSheet = () => {
    if (uploadingPhoto) {
      return;
    }

    setPhotoActionSheetVisible(true);
  };

useFocusEffect(
  React.useCallback(() => {
    loadProfile();

    return () => {
      // Nothing needed here
    };
    // loadProfile is a plain function recreated every render; including it
    // would re-run this focus effect on every render and reload in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
);

  const saveProfile = async () => {
    const updatedProfile: ProfileData = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      age: age.trim(),
      gender: gender.trim(),
      bloodGroup: bloodGroup.trim(),
      photoUrl: photoUri,
    };

    if (!updatedProfile.name) {
      Alert.alert('Name Required', 'Please enter your name.');
      return;
    }

    try {
      const token = await AsyncStorage.getItem('authToken');

      if (!token) {
        Alert.alert('Login Required', 'Please login again.');
        router.replace('/');
        return;
      }

      const response = await apiFetch(`/api/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: updatedProfile.name,
          phone: updatedProfile.phone,
        }),
      });

      const data = await parseJson(response);

      if (!response.ok) {
        throw new Error(data.message || 'Unable to update profile');
      }

      const finalProfile: ProfileData = {
        ...updatedProfile,
        name: data.user.name || updatedProfile.name,
        email: data.user.email || updatedProfile.email,
        phone: data.user.phone || updatedProfile.phone,
        photoUrl: data.user.photoUrl
          ? apiUrl(String(data.user.photoUrl))
          : photoUri,
      };

      await AsyncStorage.setItem(
        PROFILE_KEY,
        JSON.stringify(finalProfile)
      );

      setProfile(finalProfile);
      setFormValues(finalProfile);
      setEditing(false);

      Alert.alert(
        'Profile Updated',
        'Your profile has been updated successfully.'
      );
    } catch (error) {
      console.log('Update Profile Error:', error);
      Alert.alert(
        'Profile Error',
        'Unable to update your profile.'
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

  // =========================
  // LOGOUT
  // =========================
  const logout = async () => {
    console.log('LOGOUT BUTTON PRESSED');

    try {
      const token = await AsyncStorage.getItem('authToken');

      if (token) {
        deactivatePushTokenWithBackend(token).catch(() => undefined);
      }

      resetTimezoneSyncCache();

      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem(PROFILE_KEY);

      router.replace('/');
    } catch (error) {
      console.log('Logout error:', error);
      Alert.alert(
        'Logout Error',
        'Unable to logout. Please try again.'
      );
    }
  };

  const firstLetter =
    profile.name?.charAt(0).toUpperCase() || 'S';

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.safeTop}>
        <AppHeader />
      </SafeAreaView>
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
          <View style={styles.avatarWrapper}>
            <Pressable
              onPress={() =>
                photoUri
                  ? setPhotoViewerVisible(true)
                  : openPhotoActionSheet()
              }
              style={({ pressed }) => [
                styles.avatar,
                pressed && styles.pressed,
              ]}
            >
              {photoUri ? (
                <Image
                  source={{ uri: photoUri }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  transition={150}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {firstLetter}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={openPhotoActionSheet}
              disabled={uploadingPhoto}
              style={({ pressed }) => [
                styles.avatarCameraBadge,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={uploadingPhoto ? 'hourglass-outline' : 'camera'}
                size={15}
                color={COLORS.white}
              />
            </Pressable>
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

        {/* SETTINGS */}
        <SectionTitle
          icon="settings-outline"
          title="Settings"
        />

        <View style={styles.card}>
          <SettingRow
            icon="people-outline"
            title="Caregiver Settings"
            subtitle="Receive alerts when you miss consecutive medicine doses."
            onPress={() => router.push('/caregiver')}
          />

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
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && styles.pressed,
          ]}
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
      <View
        style={[
          styles.bottomNav,
          !isMobile && styles.bottomNavDesktop,
        ]}
      >
        <BottomTab
          icon="home-outline"
          label="Home"
          onPress={() => router.push('/home')}
        />

        <BottomTab
          icon="medical-outline"
          label="Medicines"
          onPress={() => router.push('/medicines')}
        />

        <BottomTab
          icon="calendar-outline"
          label="Appointments"
          onPress={() => router.push('/appointments')}
        />

        <BottomTab
          icon="person-outline"
          label="Profile"
          active
          onPress={() => router.push('/profile')}
        />
      </View>

      {/* PHOTO ACTION SHEET */}
      <Modal
        visible={photoActionSheetVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setPhotoActionSheetVisible(false)}
      >
        <View style={styles.actionSheetBackdrop}>
          {/* Tap the dimmed area to dismiss. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPhotoActionSheetVisible(false)}
          />

          <Pressable
            onPress={() => setPhotoActionSheetVisible(false)}
          >
            <View style={styles.actionSheetContainer}>
              <Text style={styles.actionSheetTitle}>
                Profile Photo
              </Text>

              {photoUri && (
                <Pressable
                  onPress={removePhoto}
                  style={({ pressed }) => [
                    styles.actionSheetOption,
                    pressed && styles.actionSheetOptionPressed,
                  ]}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={COLORS.dangerRed}
                  />

                  <Text
                    style={[
                      styles.actionSheetOptionText,
                      styles.actionSheetOptionDestructive,
                    ]}
                  >
                    Remove Photo
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={takeWithCamera}
                style={({ pressed }) => [
                  styles.actionSheetOption,
                  pressed && styles.actionSheetOptionPressed,
                ]}
              >
                <Ionicons
                  name="camera-outline"
                  size={20}
                  color={COLORS.primaryBlue}
                />

                <Text style={styles.actionSheetOptionText}>
                  Take Photo
                </Text>
              </Pressable>

              <Pressable
                onPress={chooseFromGallery}
                style={({ pressed }) => [
                  styles.actionSheetOption,
                  pressed && styles.actionSheetOptionPressed,
                ]}
              >
                <Ionicons
                  name="images-outline"
                  size={20}
                  color={COLORS.primaryBlue}
                />

                <Text style={styles.actionSheetOptionText}>
                  Choose from Gallery
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setPhotoActionSheetVisible(false)}
                style={({ pressed }) => [
                  styles.actionSheetOption,
                  styles.actionSheetCancel,
                  pressed && styles.actionSheetOptionPressed,
                ]}
              >
                <Text
                  style={[
                    styles.actionSheetOptionText,
                    styles.actionSheetOptionDestructive,
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Modal>

      {/* FULL-SCREEN PHOTO VIEWER */}
      <Modal
        visible={photoViewerVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setPhotoViewerVisible(false)}
      >
        <View style={styles.photoViewerBackdrop}>
          {/* Touching the dark area around the photo closes the viewer. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setPhotoViewerVisible(false)}
          />

          {/* The photo itself does not close the viewer. */}
          <Pressable
            style={styles.photoViewerImageWrapper}
          >
            <Image
              source={{ uri: photoUri || undefined }}
              style={styles.photoViewerImage}
              contentFit="contain"
            />
          </Pressable>

          <Pressable
            onPress={() => setPhotoViewerVisible(false)}
            style={({ pressed }) => [
              styles.photoViewerCloseButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name="close"
              size={22}
              color={COLORS.white}
            />
          </Pressable>
        </View>
      </Modal>
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
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.bottomTab,
        active && styles.bottomTabActive,
      ]}
    >
      <Ionicons
        name={icon}
        size={23}
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
    </Pressable>
  );
}

/* STYLES */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  safeTop: {
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    padding: 28,
    paddingBottom: 28,
  },

  mobileScrollContent: {
    padding: 16,
    paddingBottom: 16,
  },

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
    overflow: 'hidden',
  },

  avatarWrapper: {
    marginRight: 18,
  },

  avatarImage: {
    width: 82,
    height: 82,
  },

  photoViewerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  photoViewerImage: {
    width: '92%',
    height: '76%',
  },

  photoViewerImageWrapper: {
    width: '92%',
    height: '76%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  actionSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },

  actionSheetContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 26,
  },

  actionSheetTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: COLORS.secondary,
    marginBottom: 8,
  },

  actionSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
  },

  actionSheetOptionPressed: {
    backgroundColor: COLORS.background,
  },

  actionSheetOptionText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 14,
  },

  actionSheetOptionDestructive: {
    color: COLORS.dangerRed,
  },

  actionSheetCancel: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 8,
  },

  photoViewerCloseButton: {
    position: 'absolute',
    bottom: 40,
    right: 24,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.primaryBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarCameraBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryBlue,
    borderWidth: 2,
    borderColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
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

  bottomNav: {
    height: 72,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
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
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
  },

  bottomTabActive: {
    backgroundColor: '#E5F2F9',
  },

  bottomText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: COLORS.secondary,
  },

  bottomTextActive: {
    color: COLORS.primaryBlue,
    fontFamily: 'Inter_700Bold',
  },
});