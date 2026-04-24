import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const ACTIVITY_STORAGE_PREFIX = 'activity_days:';

const getTodayKey = () => new Date().toLocaleDateString('en-CA');

const normalizeActivityDays = (days: string[]) => {
  // Keep unique values and cap history so local storage stays small.
  return Array.from(new Set(days)).sort().slice(-60);
};

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

export async function getLast7Activity(userId: string) {
  const storageKey = `${ACTIVITY_STORAGE_PREFIX}${userId}`;
  const stored = await AsyncStorage.getItem(storageKey);
  const parsed: string[] = stored ? JSON.parse(stored) : [];
  return normalizeActivityDays(parsed).slice(-7);
}

export async function addProgress(xpToAdd: number) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const userId = session.user.id;

  // Get today's date in YYYY-MM-DD format based on local time
  const today = new Date().toLocaleDateString('en-CA');

  // 1. Get the user's current stats
  const { data: profile } = await supabase
    .from('profiles')
    .select('xp_points, streak, last_active')
    .eq('id', userId)
    .single();

  if (!profile) return;

  let newXp = (profile.xp_points || 0) + xpToAdd;
  let newStreak = profile.streak || 0;

  // 2. Calculate the streak logic
  if (profile.last_active !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');

    if (profile.last_active === yesterdayStr) {
      newStreak += 1; // They practiced yesterday, keep the streak alive!
    } else {
      newStreak = 1; // They missed a day, reset streak to 1
    }
  }

  // 3. Save the updated stats back to Supabase
  await supabase
    .from('profiles')
    .update({
      xp_points: newXp,
      streak: newStreak,
      last_active: today,
    })
    .eq('id', userId);

  // Also record local per-day activity so profile can render a 7-day chart.
  await markTodayActivity();
}
