import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// Local activity storage used for the profile chart.
const ACTIVITY_STORAGE_PREFIX = 'activity_days:';

const getTodayKey = () => new Date().toLocaleDateString('en-CA');

// Keep the activity list unique and compact.
const normalizeActivityDays = (days: string[]) => {
  return Array.from(new Set(days)).sort().slice(-60);
};

// Record the current day as active for the signed-in user.
export async function markTodayActivity() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const storageKey = `${ACTIVITY_STORAGE_PREFIX}${session.user.id}`;
  const stored = await AsyncStorage.getItem(storageKey);
  const parsed: string[] = stored ? JSON.parse(stored) : [];
  const today = getTodayKey();

  const next = normalizeActivityDays([...parsed, today]);
  await AsyncStorage.setItem(storageKey, JSON.stringify(next));
}

// Read the last seven active days for the profile chart.
export async function getLast7Activity(userId: string) {
  const storageKey = `${ACTIVITY_STORAGE_PREFIX}${userId}`;
  const stored = await AsyncStorage.getItem(storageKey);
  const parsed: string[] = stored ? JSON.parse(stored) : [];
  return normalizeActivityDays(parsed).slice(-7);
}

// Update XP, streak, and last active date after practice.
export async function addProgress(xpToAdd: number) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const userId = session.user.id;

  const today = new Date().toLocaleDateString('en-CA');

  const { data: profile } = await supabase
    .from('profiles')
    .select('xp_points, streak, last_active')
    .eq('id', userId)
    .single();

  if (!profile) return;

  let newXp = (profile.xp_points || 0) + xpToAdd;
  let newStreak = profile.streak || 0;

  if (profile.last_active !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');

    if (profile.last_active === yesterdayStr) {
      newStreak += 1;
    } else {
      newStreak = 1;
    }
  }

  await supabase
    .from('profiles')
    .update({
      xp_points: newXp,
      streak: newStreak,
      last_active: today,
    })
    .eq('id', userId);

  await markTodayActivity();
}
