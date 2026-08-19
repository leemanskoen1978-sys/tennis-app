import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'tennis.currentUserId';

export async function loadCurrentUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(KEY);
  } catch {
    return null;
  }
}
export async function saveCurrentUserId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, id);
  } catch {
    /* ignore */
  }
}
export async function clearCurrentUserId(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
