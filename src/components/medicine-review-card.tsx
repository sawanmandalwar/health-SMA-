import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const COLORS = {
  primaryBlue: '#1E76B6',
  primaryGreen: '#39A78D',
  lightBlue: '#E7F2FA',
  lightGreen: '#E5F7F1',
  dangerRed: '#E2574C',
  white: '#FFFFFF',
  mainText: '#1D2B33',
  secondaryText: '#71858D',
  border: '#D2E3E8',
  warningBg: '#FFF0D2',
  warningText: '#B77900',
};

export interface ReviewSchedule {
  id: string;
  time: string;
  quantity: number;
}

export interface ReviewMedicine {
  id: string;
  name: string;
  dosage: string;
  timing: string;
  frequency: string;
  startDate: string;
  endDate: string;
  schedules: ReviewSchedule[];
  warnings: string[];
  duplicateOf: string | null;
}

interface Props {
  medicine: ReviewMedicine;
  index: number;
  disabled?: boolean;
  onChange: (medicine: ReviewMedicine) => void;
  onRemove: () => void;
}

export function MedicineReviewCard({
  medicine,
  index,
  disabled = false,
  onChange,
  onRemove,
}: Props) {
  const update = <K extends keyof ReviewMedicine>(
    key: K,
    value: ReviewMedicine[K]
  ) => {
    onChange({ ...medicine, [key]: value });
  };

  const updateSchedule = (
    scheduleId: string,
    patch: Partial<ReviewSchedule>
  ) => {
    update(
      'schedules',
      medicine.schedules.map((schedule) =>
        schedule.id === scheduleId ? { ...schedule, ...patch } : schedule
      )
    );
  };

  const addSchedule = () => {
    update('schedules', [
      ...medicine.schedules,
      {
        id: `schedule-${Date.now()}-${medicine.schedules.length}`,
        time: '',
        quantity: 1,
      },
    ]);
  };

  const removeSchedule = (scheduleId: string) => {
    update(
      'schedules',
      medicine.schedules.filter((schedule) => schedule.id !== scheduleId)
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.numberBadge}>
            <Text style={styles.numberText}>{index + 1}</Text>
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={styles.title} numberOfLines={1}>
              {medicine.name || 'Unnamed medicine'}
            </Text>
            <Text style={styles.subtitle}>
              Review the details before adding
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove medicine ${index + 1}`}
          disabled={disabled}
          onPress={onRemove}
          style={styles.removeButton}
        >
          <Ionicons name="trash-outline" size={18} color={COLORS.dangerRed} />
        </Pressable>
      </View>

      {medicine.duplicateOf && (
        <View style={styles.duplicateBox}>
          <Ionicons
            name="copy-outline"
            size={17}
            color={COLORS.warningText}
          />
          <Text style={styles.duplicateText}>
            Possible duplicate of {medicine.duplicateOf}. Confirm before adding.
          </Text>
        </View>
      )}

      <Text style={styles.label}>Medicine name</Text>
      <TextInput
        editable={!disabled}
        value={medicine.name}
        onChangeText={(value) => update('name', value)}
        placeholder="e.g. Paracetamol"
        placeholderTextColor={COLORS.secondaryText}
        style={styles.input}
      />

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Dosage</Text>
          <TextInput
            editable={!disabled}
            value={medicine.dosage}
            onChangeText={(value) => update('dosage', value)}
            placeholder="e.g. 500mg"
            placeholderTextColor={COLORS.secondaryText}
            style={styles.input}
          />
        </View>

        <View style={styles.halfField}>
          <Text style={styles.label}>Timing</Text>
          <TextInput
            editable={!disabled}
            value={medicine.timing}
            onChangeText={(value) => update('timing', value)}
            placeholder="e.g. After Food"
            placeholderTextColor={COLORS.secondaryText}
            style={styles.input}
          />
        </View>
      </View>

      <Text style={styles.label}>Frequency</Text>
      <TextInput
        editable={!disabled}
        value={medicine.frequency}
        onChangeText={(value) => update('frequency', value)}
        placeholder="e.g. Twice Daily"
        placeholderTextColor={COLORS.secondaryText}
        style={styles.input}
      />

      <View style={styles.row}>
        <View style={styles.halfField}>
          <Text style={styles.label}>Start date (YYYY-MM-DD)</Text>
          <TextInput
            editable={!disabled}
            value={medicine.startDate}
            onChangeText={(value) => update('startDate', value)}
            placeholder="2026-10-22"
            placeholderTextColor={COLORS.secondaryText}
            autoCapitalize="none"
            style={styles.input}
          />
        </View>

        <View style={styles.halfField}>
          <Text style={styles.label}>End date (YYYY-MM-DD)</Text>
          <TextInput
            editable={!disabled}
            value={medicine.endDate}
            onChangeText={(value) => update('endDate', value)}
            placeholder="2026-10-27"
            placeholderTextColor={COLORS.secondaryText}
            autoCapitalize="none"
            style={styles.input}
          />
        </View>
      </View>

      <Text style={styles.label}>Dose times</Text>

      {medicine.schedules.length === 0 && (
        <Text style={styles.emptySchedule}>
          Add at least one dose time, for example 8:00 AM.
        </Text>
      )}

      {medicine.schedules.map((schedule, scheduleIndex) => (
        <View key={schedule.id} style={styles.scheduleRow}>
          <TextInput
            editable={!disabled}
            value={schedule.time}
            onChangeText={(value) =>
              updateSchedule(schedule.id, { time: value })
            }
            placeholder="8:00 AM"
            placeholderTextColor={COLORS.secondaryText}
            autoCapitalize="none"
            style={[styles.input, styles.scheduleTime]}
          />

          <TextInput
            editable={!disabled}
            value={String(schedule.quantity)}
            onChangeText={(value) =>
              updateSchedule(schedule.id, {
                quantity: Math.max(1, Number(value.replace(/[^\d]/g, '')) || 1),
              })
            }
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={COLORS.secondaryText}
            style={[styles.input, styles.quantityInput]}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove dose time ${scheduleIndex + 1}`}
            disabled={disabled}
            onPress={() => removeSchedule(schedule.id)}
            style={styles.scheduleRemove}
          >
            <Ionicons
              name="close-circle-outline"
              size={20}
              color={COLORS.secondaryText}
            />
          </Pressable>
        </View>
      ))}

      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={addSchedule}
        style={styles.addTimeButton}
      >
        <Ionicons name="add-circle-outline" size={18} color={COLORS.primaryBlue} />
        <Text style={styles.addTimeText}>Add another time</Text>
      </Pressable>

      {medicine.warnings.length > 0 && (
        <View style={styles.warningBox}>
          {medicine.warnings.map((warning) => (
            <View key={warning} style={styles.warningRow}>
              <Ionicons
                name="alert-circle-outline"
                size={15}
                color={COLORS.warningText}
              />
              <Text style={styles.warningText}>{warning}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerTextWrap: {
    flex: 1,
  },
  numberBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.lightBlue,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  numberText: {
    color: COLORS.primaryBlue,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  title: {
    color: COLORS.mainText,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 15,
  },
  subtitle: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    marginTop: 1,
  },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FDECEA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  duplicateBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    backgroundColor: COLORS.warningBg,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  duplicateText: {
    flex: 1,
    color: COLORS.warningText,
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 17,
  },
  label: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    marginBottom: 5,
    marginTop: 8,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: '#F8FBFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.mainText,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  halfField: {
    flex: 1,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  scheduleTime: {
    flex: 1,
  },
  quantityInput: {
    width: 58,
    textAlign: 'center',
  },
  scheduleRemove: {
    width: 28,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptySchedule: {
    color: COLORS.secondaryText,
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    marginBottom: 4,
  },
  addTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 6,
    marginTop: 1,
  },
  addTimeText: {
    color: COLORS.primaryBlue,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  warningBox: {
    backgroundColor: COLORS.warningBg,
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    gap: 5,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  warningText: {
    flex: 1,
    color: COLORS.warningText,
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    lineHeight: 16,
  },
});
