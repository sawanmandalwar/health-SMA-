import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function MedicinesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Medicines</Text>
      <Text>Health-Saathi Medicines</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAF3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#155A8C',
    marginBottom: 10,
  },
});