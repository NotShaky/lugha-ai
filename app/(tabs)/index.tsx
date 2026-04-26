import { getCompletedPacks } from '@/utils/progress';
import { supabase } from '@/utils/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const roleplayScenarios = [
  { id: 'market', title: 'At the Market', icon: 'cart-outline', color: '#34C759', scenario: 'Ordering groceries or haggling at an Arab market' },
  { id: 'restaurant', title: 'At the Restaurant', icon: 'restaurant-outline', color: '#FF3B30', scenario: 'Ordering food and drinks at a restaurant' },
  { id: 'airport', title: 'At the Airport', icon: 'airplane-outline', color: '#AF52DE', scenario: 'Checking in at the airport or going through customs' },
];

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
      params: { id: `chat-${Date.now()}`, title: 'Lugha AI Chat' },
    });
  };

  const handleOpenRoleplay = (scenarioParam: string, title: string) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: `chat-${Date.now()}`, title, scenario: scenarioParam },
    });
  };

  const handleOpenDrillScenario = (drillSet: string, title: string) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: 'drills', title, drillSet },
    });
  };



  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;

      const refreshCompletedPacks = async () => {
        const packs = await getCompletedPacks();
        if (mounted) setCompletedPacks(packs);
      };

      void refreshCompletedPacks();

      return () => {
        mounted = false;
      };
    }, [])
  );

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
        <TouchableOpacity style={styles.chatCard} onPress={handleOpenChat} activeOpacity={0.85}>
          <View style={styles.chatCardIcon}>
            <Ionicons name="chatbubble-ellipses" size={36} color="#007AFF" />
          </View>
          <View style={styles.chatCardText}>
            <Text style={styles.chatCardTitle}>Chat with Lugha AI</Text>
            <Text style={styles.chatCardDesc}>Practice Arabic conversation freely. Type or speak in English or Arabic.</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#007AFF" />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Roleplay Scenarios</Text>
        <Text style={styles.sectionSubtitle}>Pick a real-world situation and practice in character with the AI.</Text>
        
        <View style={styles.roleplayGrid}>
          {roleplayScenarios.map((rp) => (
            <TouchableOpacity
              key={rp.id}
              style={styles.roleplayCard}
              onPress={() => handleOpenRoleplay(rp.scenario, rp.title)}
            >
              <View style={[styles.roleplayIconWrap, { backgroundColor: rp.color + '1A' }]}>
                <Ionicons name={rp.icon as any} size={32} color={rp.color} />
              </View>
              <Text style={styles.roleplayTitle}>{rp.title}</Text>
            </TouchableOpacity>
          ))}
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
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF2FF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: '#007AFF',
  },
  chatCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  chatCardText: {
    flex: 1,
  },
  chatCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 4,
  },
  chatCardDesc: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
  roleplayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  roleplayCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  roleplayIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  roleplayTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
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
