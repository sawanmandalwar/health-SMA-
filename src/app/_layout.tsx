import React from 'react';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: 'none',
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: 'Home' }}
      />

      <Tabs.Screen
        name="medicines"
        options={{ title: 'Medicines' }}
      />

      <Tabs.Screen
        name="appointments"
        options={{ title: 'Appointments' }}
      />

      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile' }}
      />

      {/* Hidden screens */}
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />

      <Tabs.Screen
        name="hospitals"
        options={{ href: null }}
      />

      <Tabs.Screen
        name="scan"
        options={{ href: null }}
      />

      <Tabs.Screen
        name="register"
        options={{ href: null }}
      />

      <Tabs.Screen
        name="welcome"
        options={{ href: null }}
      />

      <Tabs.Screen
        name="explore"
        options={{ href: null }}
      />
    </Tabs>
  );
}