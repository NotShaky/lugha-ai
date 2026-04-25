import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { getLast7Activity, markTodayActivity } from '@/utils/progress';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const PACK_LABELS: Record<string, string> = {
  general: 'General Chat Drills',
  airport: 'At the Airport',
  classroom: 'In the Classroom',
  adaptive: 'Adaptive Mastery Pack',
};

export default function ProfileScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const backgroundColor = colorScheme === 'dark' ? '#000' : '#F2F2F7';
  const cardBg = colorScheme === 'dark' ? '#1C1C1E' : '#FFF';
  const textColor = theme.text;
  const subTextColor = '#8E8E93';

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(colorScheme === 'dark');
  const [user, setUser] = useState<User | null>(null);
  const [xp, setXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const [activeDays, setActiveDays] = useState<string[]>([]);
  const [completedPacks, setCompletedPacks] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Build the last 7 days chart from stored activity dates.
  const chartDays = useMemo(() => {
    const active = new Set(activeDays);
    return Array.from({ length: 7 }, (_, idx) => {
      const date = new Date();
      const daysAgo = 6 - idx;
      date.setDate(date.getDate() - daysAgo);
      const key = date.toLocaleDateString('en-CA');

      return {
        key,
        label: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
        isToday: daysAgo === 0,
        isActive: active.has(key),
      };
    });
  }, [activeDays]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUser(data.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    async function fetchStats() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await markTodayActivity();

      const { data, error } = await supabase
        .from('profiles')
        .select('xp_points, streak, completed_packs')
        .eq('id', session.user.id)
        .single();

      if (data) {
        setXp(data.xp_points || 0);
        setStreak(data.streak || 0);
        setCompletedPacks(Array.isArray(data.completed_packs) ? data.completed_packs.map((item: unknown) => String(item)) : []);
      } else if (error) {
        // Fallback for profiles tables that do not yet include completed_packs.
        const { data: fallback } = await supabase
          .from('profiles')
          .select('xp_points, streak')
          .eq('id', session.user.id)
          .single();

        if (fallback) {
          setXp(fallback.xp_points || 0);
          setStreak(fallback.streak || 0);
        }
        setCompletedPacks([]);
      }

      const recentDays = await getLast7Activity(session.user.id);
      setActiveDays(recentDays);
    }

    fetchStats();
  }, [user?.id]);

  const displayName = useMemo(() => {
    if (!user?.email) return 'Guest';
    return user.email.split('@')[0];
  }, [user]);

  const username = useMemo(() => {
    if (!user?.email) return '@guest';
    return `@${user.email.split('@')[0]}`;
  }, [user]);

  const signOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    setLoading(false);

    if (error) {
      Alert.alert('Sign Out Failed', error.message);
      return;
    }

    router.replace('/auth');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.avatarContainer}>
            <Image
              source={{ uri: '' }}
              style={styles.avatar}
            />
            <View style={styles.editIcon}>
              <Ionicons name="pencil" size={12} color="#FFF" />
            </View>
          </View>
          <Text style={[styles.name, { color: textColor }]}>{displayName}</Text>
          <Text style={[styles.username, { color: subTextColor }]}>{username}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.statValue, { color: textColor }]}>{streak}</Text>
            <Text style={styles.statLabel}>Day Streak</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.statValue, { color: textColor }]}>{xp}</Text>
            <Text style={styles.statLabel}>XP Earned</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.statValue, { color: textColor }]}>{completedPacks.length}</Text>
            <Text style={styles.statLabel}>Packs Done</Text>
          </View>
        </View>

        <View style={[styles.activityCard, { backgroundColor: cardBg }]}>
          <View style={styles.activityHeader}>
            <Text style={[styles.activityTitle, { color: textColor }]}>Completed Packs</Text>
            <Text style={styles.activityMeta}>{completedPacks.length} total</Text>
          </View>

          {completedPacks.length === 0 ? (
            <Text style={styles.emptyPacksText}>No completed packs yet. Start a scenario drill from Home.</Text>
          ) : (
            <View style={styles.completedPacksList}>
              {completedPacks.map((packId) => (
                <View key={packId} style={styles.completedPackChip}>
                  <Ionicons name="checkmark-circle" size={14} color="#34C759" />
                  <Text style={styles.completedPackText}>{PACK_LABELS[packId] ?? packId}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={[styles.activityCard, { backgroundColor: cardBg }]}> 
          <View style={styles.activityHeader}>
            <Text style={[styles.activityTitle, { color: textColor }]}>Last 7 Days</Text>
            <Text style={styles.activityMeta}>{chartDays.filter(d => d.isActive).length}/7 active</Text>
          </View>
          <View style={styles.activityChartRow}>
            {chartDays.map((day) => (
              <View key={day.key} style={styles.activityDayCol}>
                <View
                  style={[
                    styles.activityBar,
                    day.isActive ? styles.activityBarActive : styles.activityBarInactive,
                    day.isToday && styles.activityBarToday,
                  ]}
                />
                <Text style={[styles.activityDayLabel, day.isToday && styles.activityDayLabelToday]}>{day.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: textColor }]}>Settings</Text>

        <View style={[styles.settingsGroup, { backgroundColor: cardBg, marginTop: 20 }]}>
          <TouchableOpacity style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="language-outline" size={22} color={textColor} />
              <Text style={[styles.settingLabel, { color: textColor }]}>Target Language</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: subTextColor, marginRight: 8 }}>Arabic</Text>
              <Ionicons name="chevron-forward" size={20} color={subTextColor} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingItem, { borderBottomWidth: 0 }]}>
            <View style={styles.settingLeft}>
              <Ionicons name="help-circle-outline" size={22} color={textColor} />
              <Text style={[styles.settingLabel, { color: textColor }]}>Help & Support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={subTextColor} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={signOut} disabled={loading}>
          <Text style={styles.logoutText}>{loading ? 'Logging out...' : 'Log Out'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statCard: {
    width: '30%',
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    marginLeft: 4,
  },
  activityCard: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  activityMeta: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '600',
  },
  activityChartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  activityDayCol: {
    alignItems: 'center',
    width: 30,
  },
  activityBar: {
    width: 18,
    height: 30,
    borderRadius: 9,
    marginBottom: 6,
  },
  activityBarActive: {
    backgroundColor: '#34C759',
  },
  activityBarInactive: {
    backgroundColor: '#D1D1D6',
    opacity: 0.5,
  },
  activityBarToday: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  activityDayLabel: {
    fontSize: 11,
    color: '#8E8E93',
    fontWeight: '600',
  },
  activityDayLabelToday: {
    color: '#007AFF',
  },
  completedPacksList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  completedPackChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF9F1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  completedPackText: {
    color: '#1E7A35',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyPacksText: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 18,
  },
  settingsGroup: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingLabel: {
    fontSize: 16,
    marginLeft: 12,
  },
  logoutButton: {
    marginTop: 32,
    alignSelf: 'center',
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});
