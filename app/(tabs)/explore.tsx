import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const resources = [
  {
    id: '1',
    title: 'Essential Phrases',
    description: 'Master the 100 most common Arabic phrases for daily life.',
    icon: 'book-outline',
    color: '#FFCC00',
  },
  {
    id: '2',
    title: 'Grammar Guide',
    description: 'Understand verb conjugations and sentence structure.',
    icon: 'library-outline',
    color: '#AF52DE',
  },
  {
    id: '3',
    title: 'Cultural Insights',
    description: 'Learn about etiquette, customs, and traditions.',
    icon: 'globe-outline',
    color: '#00C7BE',
  },
  {
    id: '4',
    title: 'Vocabulary Builder',
    description: 'Expand your word bank with themed lists.',
    icon: 'construct-outline',
    color: '#FF9500',
  },
];

export default function ExploreScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const backgroundColor = colorScheme === 'dark' ? '#000' : '#F2F2F7';
  const cardBg = colorScheme === 'dark' ? '#1C1C1E' : '#FFF';
  const textColor = theme.text;
  const subTextColor = '#8E8E93';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Resources</Text>
        <Text style={[styles.headerSubtitle, { color: subTextColor }]}>
          Expand your knowledge beyond conversation.
        </Text>

        <View style={styles.grid}>
          {resources.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { backgroundColor: cardBg }]}
              activeOpacity={0.7}
            >
              <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon as any} size={28} color="#FFF" />
              </View>
              <Text style={[styles.cardTitle, { color: textColor }]}>{item.title}</Text>
              <Text style={[styles.cardDescription, { color: subTextColor }]}>
                {item.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: textColor }]}>Daily Challenge</Text>
        <TouchableOpacity style={[styles.challengeCard, { backgroundColor: '#007AFF' }]}>
          <View style={styles.challengeContent}>
            <Text style={styles.challengeTitle}>Word of the Day</Text>
            <Text style={styles.challengeWord}>"Shukran" (Thank You)</Text>
            <Text style={styles.challengeDesc}>Learn how to express gratitude in different contexts.</Text>
          </View>
          <Ionicons name="trophy" size={40} color="rgba(255,255,255,0.8)" />
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
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  card: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
  },
  challengeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  challengeContent: {
    flex: 1,
  },
  challengeTitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  challengeWord: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 4,
  },
  challengeDesc: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
  },
});
