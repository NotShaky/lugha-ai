import { getCompletedPacks } from '@/utils/progress';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const scenarioCards = [
  {
    id: 'general',
    title: 'General Chat Drills',
    subtitle: 'Everyday phrases and conversation starters',
    icon: 'chatbubble-ellipses-outline',
    color: '#005F73',
  },
  {
    id: 'airport',
    title: 'At the Airport',
    subtitle: 'Check-in, passport, and gate navigation',
    icon: 'airplane-outline',
    color: '#0A9396',
  },
  {
    id: 'classroom',
    title: 'In the Classroom',
    subtitle: 'Ask questions and follow instructions',
    icon: 'school-outline',
    color: '#CA6702',
  },
  {
    id: 'adaptive',
    title: 'Adaptive Mastery Pack',
    subtitle: 'Fully personalized drills from your completed packs and mistakes',
    icon: 'sparkles-outline',
    color: '#7C3AED',
  },
];

const CORE_PACK_IDS = ['general', 'airport', 'classroom'];

export default function HomeScreen() {
  const router = useRouter();
  const [completedPacks, setCompletedPacks] = useState<string[]>([]);

  const handleOpenChat = () => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: 'chat-bot', title: 'Lugha AI Chat' },
    });
  };

  const handleOpenDrillScenario = (drillSet: string, title: string) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: 'drills', title, drillSet },
    });
  };

  useEffect(() => {
    let mounted = true;

    const refreshCompletedPacks = async () => {
      const packs = await getCompletedPacks();
      if (mounted) setCompletedPacks(packs);
    };

    void refreshCompletedPacks();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void refreshCompletedPacks();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAdaptiveUnlocked = useMemo(() => {
    return CORE_PACK_IDS.every((packId) => completedPacks.includes(packId));
  }, [completedPacks]);

  const adaptiveUnlockProgress = useMemo(() => {
    const completedCoreCount = CORE_PACK_IDS.filter((packId) => completedPacks.includes(packId)).length;
    return `${completedCoreCount}/${CORE_PACK_IDS.length} core packs completed`;
  }, [completedPacks]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Lugha AI</Text>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.chatContent}>
          <View style={styles.chatIllustration}>
            <Ionicons name="chatbubble-ellipses" size={80} color="#007AFF" />
          </View>
          <Text style={styles.chatTitle}>Practice with AI</Text>
          <Text style={styles.chatDesc}>
            Chat with Lugha AI to practice Arabic conversation. Type in English or Arabic, or use your microphone.
          </Text>
          <TouchableOpacity style={styles.chatButton} onPress={handleOpenChat}>
            <Ionicons name="chatbubbles" size={22} color="#fff" />
            <Text style={styles.chatButtonText}>Start General Chat</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Scenario Drill Packs</Text>
        <Text style={styles.sectionSubtitle}>Choose a scenario and complete all drills in that pack.</Text>

        {scenarioCards.map((scenario) => (
          <TouchableOpacity
            key={scenario.id}
            style={[styles.scenarioCard, scenario.id === 'adaptive' && !isAdaptiveUnlocked && styles.scenarioCardLocked]}
            activeOpacity={0.85}
            disabled={scenario.id === 'adaptive' && !isAdaptiveUnlocked}
            onPress={() => handleOpenDrillScenario(scenario.id, scenario.title)}
          >
            <View style={[styles.scenarioIconWrap, { backgroundColor: `${scenario.color}1A` }]}> 
              <Ionicons name={scenario.icon as any} size={24} color={scenario.color} />
            </View>
            <View style={styles.scenarioTextWrap}>
              <Text style={styles.scenarioTitle}>{scenario.title}</Text>
              <Text style={styles.scenarioSubtitle}>
                {scenario.id === 'adaptive' && !isAdaptiveUnlocked
                  ? 'Locked: complete General, Airport, and Classroom packs to unlock'
                  : scenario.subtitle}
              </Text>
              {scenario.id === 'adaptive' && (
                <Text style={styles.scenarioProgressText}>{adaptiveUnlockProgress}</Text>
              )}
            </View>
            {scenario.id === 'adaptive' && !isAdaptiveUnlocked ? (
              <Ionicons name="lock-closed" size={18} color="#8E8E93" />
            ) : (
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    paddingTop: 12,
    paddingBottom: 16,
    color: '#000',
  },
  chatContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    marginBottom: 20,
  },
  chatIllustration: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#EBF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  chatTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  chatDesc: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  chatButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  chatButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  scenarioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  scenarioCardLocked: {
    opacity: 0.6,
  },
  scenarioIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  scenarioTextWrap: {
    flex: 1,
  },
  scenarioTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 2,
  },
  scenarioSubtitle: {
    fontSize: 13,
    color: '#666',
  },
  scenarioProgressText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    color: '#5A5A5A',
  },
});
