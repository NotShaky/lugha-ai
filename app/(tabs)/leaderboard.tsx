import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface LeaderboardEntry {
  id: string;
  email: string;
  xp_points: number;
  streak: number;
}

const getBackendUrl = () => {
  if (Platform.OS === 'web') return 'http://localhost:8001';

  try {
    const legacyManifest = Constants.manifest as { debuggerHost?: string } | null;
    const hostUri =
      Constants.expoConfig?.hostUri ??
      Constants.manifest2?.extra?.expoGo?.debuggerHost ??
      legacyManifest?.debuggerHost;
    const host = hostUri?.split(':')[0];

    if (host) {
      if (Platform.OS === 'android' && host === 'localhost') {
        return 'http://10.0.2.2:8001';
      }
      return `http://${host}:8001`;
    }
  } catch {
  }

  return 'http://localhost:8001';
};

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? getBackendUrl();

const MEDAL_COLORS = ['#FFD700', '#C0C0C0', '#CD7F32'];

export default function LeaderboardScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const backgroundColor = colorScheme === 'dark' ? '#000' : '#F2F2F7';
  const cardBg = colorScheme === 'dark' ? '#1C1C1E' : '#FFF';
  const textColor = theme.text;
  const subTextColor = '#8E8E93';

  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUserId(session?.user?.id ?? null);

      try {
        const response = await fetch(`${BACKEND_URL}/leaderboard`);
        if (!response.ok) {
          throw new Error(`Status ${response.status}`);
        }

        const payload = await response.json();
        const rows = Array.isArray(payload?.leaders) ? payload.leaders : [];
        setLeaders(
          rows.map((row: any) => ({
            id: typeof row?.id === 'string' ? row.id : '',
            email: typeof row?.email === 'string' ? row.email : '',
            xp_points: typeof row?.xp_points === 'number' ? row.xp_points : 0,
            streak: typeof row?.streak === 'number' ? row.streak : 0,
          }))
        );
        return;
      } catch (backendErr) {
        console.warn('Backend leaderboard fetch failed, trying direct Supabase query:', backendErr);
      }

      // Keep older deployments working by querying Supabase directly.
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, xp_points, streak')
        .order('xp_points', { ascending: false })
        .limit(10);

      if (error) {
        console.error('Leaderboard fetch failed:', error.message);
        return;
      }

      if (data) {
        setLeaders(
          data.map((row) => ({
            id: row.id,
            email: typeof row.email === 'string' ? row.email : '',
            xp_points: row.xp_points ?? 0,
            streak: row.streak ?? 0,
          }))
        );
      }
    } catch (err) {
      console.error('Leaderboard error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchLeaderboard();
  }, [fetchLeaderboard]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getDisplayName = (entry: LeaderboardEntry): string => {
    if (!entry.email) return 'Learner';
    return entry.email.split('@')[0];
  };

  const getInitials = (entry: LeaderboardEntry): string => {
    const name = getDisplayName(entry);
    return name.slice(0, 2).toUpperCase();
  };

  const avatarColors = [
    '#FF9500', '#AF52DE', '#007AFF', '#34C759', '#FF2D55',
    '#5856D6', '#FF3B30', '#30B0C7', '#FFD60A', '#64D2FF',
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textColor} />
        }
      >
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: textColor }]}>Leaderboard</Text>
          <Text style={[styles.headerSubtitle, { color: subTextColor }]}>
            Top learners ranked by XP
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={[styles.loadingText, { color: subTextColor }]}>Loading rankings...</Text>
          </View>
        ) : leaders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="trophy-outline" size={64} color={subTextColor} />
            <Text style={[styles.emptyTitle, { color: textColor }]}>No rankings yet</Text>
            <Text style={[styles.emptyDesc, { color: subTextColor }]}>
              Complete drills and chat to earn XP and appear on the leaderboard!
            </Text>
          </View>
        ) : (
          <>
            {leaders.length >= 3 && (
              <View style={styles.podiumContainer}>
                <View style={styles.podiumItem}>
                  <View style={[styles.podiumAvatar, styles.podiumAvatarSmall, { backgroundColor: '#C0C0C0' }]}>
                    <Text style={styles.podiumInitials}>{getInitials(leaders[1])}</Text>
                  </View>
                  <View style={[styles.podiumPedestal, styles.pedestalSecond, { backgroundColor: '#FFF' }]}>
                    <Text style={styles.podiumMedal}>🥈</Text>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {getDisplayName(leaders[1])}
                    </Text>
                    <Text style={[styles.podiumXp, { color: subTextColor }]}>{leaders[1].xp_points} XP</Text>
                  </View>
                </View>

                <View style={styles.podiumItem}>
                  <View style={[styles.crownContainer]}>
                    <Text style={styles.crownEmoji}>👑</Text>
                  </View>
                  <View style={[styles.podiumAvatar, styles.podiumAvatarLarge, { backgroundColor: '#FFD700' }]}>
                    <Text style={[styles.podiumInitials, styles.podiumInitialsLarge]}>{getInitials(leaders[0])}</Text>
                  </View>
                  <View style={[styles.podiumPedestal, styles.pedestalFirst, { backgroundColor: '#FFF' }]}>
                    <Text style={styles.podiumMedal}>🥇</Text>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {getDisplayName(leaders[0])}
                    </Text>
                    <Text style={[styles.podiumXp, { color: subTextColor }]}>{leaders[0].xp_points} XP</Text>
                  </View>
                </View>

                <View style={styles.podiumItem}>
                  <View style={[styles.podiumAvatar, styles.podiumAvatarSmall, { backgroundColor: '#CD7F32' }]}>
                    <Text style={styles.podiumInitials}>{getInitials(leaders[2])}</Text>
                  </View>
                  <View style={[styles.podiumPedestal, styles.pedestalThird, { backgroundColor: '#FFF' }]}>
                    <Text style={styles.podiumMedal}>🥉</Text>
                    <Text style={styles.podiumName} numberOfLines={1}>
                      {getDisplayName(leaders[2])}
                    </Text>
                    <Text style={[styles.podiumXp, { color: subTextColor }]}>{leaders[2].xp_points} XP</Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.listContainer}>
              {leaders.slice(leaders.length >= 3 ? 3 : 0).map((entry, idx) => {
                const rank = leaders.length >= 3 ? idx + 4 : idx + 1;
                const isCurrentUser = entry.id === currentUserId;

                return (
                  <View
                    key={entry.id}
                    style={[
                      styles.rankRow,
                      { backgroundColor: cardBg },
                      isCurrentUser && styles.rankRowHighlight,
                    ]}
                  >
                    <Text style={[styles.rankNumber, { color: subTextColor }]}>#{rank}</Text>
                    <View style={[styles.rankAvatar, { backgroundColor: avatarColors[(rank - 1) % avatarColors.length] }]}>
                      <Text style={styles.rankInitials}>{getInitials(entry)}</Text>
                    </View>
                    <View style={styles.rankInfo}>
                      <Text style={[styles.rankName, { color: '#000000ff' }]} numberOfLines={1}>
                        {getDisplayName(entry)}
                        {isCurrentUser && <Text style={styles.youBadge}> (You)</Text>}
                      </Text>
                      <View style={styles.rankMeta}>
                        <Ionicons name="flash" size={12} color="#FF9500" />
                        <Text style={[styles.rankStreak, { color: subTextColor }]}>{entry.streak} day streak</Text>
                      </View>
                    </View>
                    <Text style={[styles.rankXp, { color: '#000000ff' }]}>{entry.xp_points}</Text>
                    <Text style={[styles.rankXpLabel, { color: subTextColor }]}>XP</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
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
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyDesc: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },

  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  podiumItem: {
    alignItems: 'center',
    flex: 1,
  },
  crownContainer: {
    marginBottom: -4,
  },
  crownEmoji: {
    fontSize: 24,
  },
  podiumAvatar: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -18,
    zIndex: 2,
    borderWidth: 3,
    borderColor: '#FFF',
  },
  podiumAvatarLarge: {
    width: 56,
    height: 56,
  },
  podiumAvatarSmall: {
    width: 46,
    height: 46,
  },
  podiumInitials: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFF',
  },
  podiumInitialsLarge: {
    fontSize: 20,
  },
  podiumPedestal: {
    width: '100%',
    alignItems: 'center',
    borderRadius: 16,
    paddingTop: 24,
    paddingBottom: 12,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  pedestalFirst: {
    minHeight: 120,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  pedestalSecond: {
    minHeight: 100,
  },
  pedestalThird: {
    minHeight: 90,
  },
  podiumMedal: {
    fontSize: 20,
    marginBottom: 4,
  },
  podiumName: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
    color: '#1A1A1A',
  },
  podiumXp: {
    fontSize: 12,
    fontWeight: '600',
    color: '#555',
  },

  listContainer: {
    gap: 10,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  rankRowHighlight: {
    borderWidth: 2,
    borderColor: '#007AFF',
    backgroundColor: '#EBF2FF',
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: '700',
    width: 32,
    textAlign: 'center',
  },
  rankAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankInitials: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFF',
  },
  rankInfo: {
    flex: 1,
  },
  rankName: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  youBadge: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 13,
  },
  rankMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rankStreak: {
    fontSize: 12,
    fontWeight: '500',
  },
  rankXp: {
    fontSize: 18,
    fontWeight: '800',
    marginRight: 2,
  },
  rankXpLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});
