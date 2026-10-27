import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ApiError,
  apiFetch,
  getApiErrorMessage,
  parseJson,
} from './api';

export interface MedicineScheduleInput {
  time: string;
  quantity: number;
}

export interface MedicineRecord {
  id: string;
  name: string;
  dosage: string;
  timing: string;
  time: string;
  frequency: string;
  startDate: string;
  endDate: string;
  schedules: MedicineScheduleInput[];
}

export interface CreateMedicineInput {
  name: string;
  dosage: string;
  timing: string;
  frequency?: string;
  startDate?: string;
  endDate?: string;
  schedules: MedicineScheduleInput[];
}

function toMedicineRecord(value: any): MedicineRecord | null {
  if (!value || typeof value !== 'object') return null;

  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name) return null;

  const schedules: MedicineScheduleInput[] = Array.isArray(value.schedules)
    ? value.schedules
        .filter(
          (schedule: any) =>
            schedule &&
            typeof schedule.time === 'string' &&
            schedule.time.trim()
        )
        .map((schedule: any) => ({
          time: schedule.time.trim(),
          quantity:
            typeof schedule.quantity === 'number' && schedule.quantity > 0
              ? schedule.quantity
              : 1,
        }))
    : [];

  return {
    id: String(value._id || value.id || ''),
    name,
    dosage: typeof value.dosage === 'string' ? value.dosage.trim() : '',
    timing: typeof value.timing === 'string' ? value.timing.trim() : '',
    time: typeof value.time === 'string' ? value.time.trim() : '',
    frequency:
      typeof value.frequency === 'string' ? value.frequency.trim() : '',
    startDate:
      typeof value.startDate === 'string' ? value.startDate.trim() : '',
    endDate: typeof value.endDate === 'string' ? value.endDate.trim() : '',
    schedules,
  };
}

async function getAuthToken(): Promise<string> {
  const token = await AsyncStorage.getItem('authToken');

  if (!token) {
    throw new Error('Your session has expired. Please log in again.');
  }

  return token;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = await parseJson<{ message?: string }>(response);
    if (data && typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
  } catch {
    // Fall through to a generic message below.
  }

  return `Unable to save medicine (server returned ${response.status}).`;
}

export function normalizeMedicineName(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F]+/g, '');
}

export function normalizeMedicineDosage(value: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/milligrams?/g, 'mg')
    .replace(/grams?/g, 'g');
}

export function medicineDuplicateKey(
  name: string,
  dosage: string
): string {
  return `${normalizeMedicineName(name)}::${normalizeMedicineDosage(dosage)}`;
}

export function findDuplicateMedicine(
  medicines: MedicineRecord[],
  candidate: { name: string; dosage: string }
): MedicineRecord | null {
  const key = medicineDuplicateKey(candidate.name, candidate.dosage);

  return (
    medicines.find(
      (medicine) =>
        medicineDuplicateKey(medicine.name, medicine.dosage) === key
    ) || null
  );
}

export async function fetchMedicines(): Promise<MedicineRecord[]> {
  const token = await getAuthToken();

  try {
    const response = await apiFetch('/api/medicines', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await parseJson<any>(response);

    if (!response.ok) {
      throw new Error(
        (data && typeof data.message === 'string' && data.message) ||
          'Unable to load medicines.'
      );
    }

    const list = Array.isArray(data?.medicines)
      ? data.medicines
      : Array.isArray(data)
        ? data
        : [];

    return list
      .map(toMedicineRecord)
      .filter((medicine: MedicineRecord | null): medicine is MedicineRecord =>
        Boolean(medicine)
      );
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error(getApiErrorMessage(error));
    }
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw new Error(getApiErrorMessage(error));
  }
}

export async function createMedicine(
  input: CreateMedicineInput
): Promise<MedicineRecord> {
  const token = await getAuthToken();
  const schedules = input.schedules
    .filter((schedule) => schedule.time.trim())
    .map((schedule) => ({
      time: schedule.time.trim(),
      quantity: Math.max(1, Number(schedule.quantity) || 1),
    }));

  if (schedules.length === 0) {
    throw new Error('Add at least one valid dose time.');
  }

  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    dosage: input.dosage.trim(),
    timing: input.timing.trim(),
    time: schedules[0].time,
    frequency:
      input.frequency?.trim() ||
      (schedules.length > 1
        ? `${schedules.length} times daily`
        : 'Once Daily'),
    schedules,
  };

  if (input.startDate?.trim()) payload.startDate = input.startDate.trim();
  if (input.endDate?.trim()) payload.endDate = input.endDate.trim();

  try {
    const response = await apiFetch('/api/medicines', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    const data = await parseJson<any>(response);
    const created = toMedicineRecord(data?.medicine || data);

    if (!created) {
      throw new Error('The server did not return the saved medicine.');
    }

    return created;
  } catch (error) {
    if (error instanceof ApiError) {
      throw new Error(getApiErrorMessage(error));
    }
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw new Error(getApiErrorMessage(error));
  }
}
