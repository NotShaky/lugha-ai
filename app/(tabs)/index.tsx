import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  FlatList,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const featuredScenarios = [
  {
    id: '1',
    title: 'Ordering Coffee',
    subtitle: 'Beginner • 5 min',
    image: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    color: '#FF9500',
  },
  {
    id: '3',
    title: 'Taking a Taxi',
    subtitle: 'Travel • 8 min',
    image: 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    color: '#34C759',
  },
    {
    id: '2',
    title: 'Introduce Yourself',
    subtitle: 'Basics • 3 min',
    image: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80',
    color: '#007AFF',
  },
];

const categories = [
  { id: 'c1', name: 'Basics', icon: '学校' },
  { id: 'c2', name: 'Travel', icon: '✈️' },
  { id: 'c3', name: 'Business', icon: '💼' },
  { id: 'c4', name: 'Shopping', icon: '🛍️' },
];

const activity = [
    { id: 'a1', title: 'Market Shopping', status: 'Completed', date: 'Yesterday' },
    { id: 'a2', title: 'Dining Out', status: 'In Progress', date: '2 days ago' },
];

export default function Dashboard() {
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  
  const theme = Colors[colorScheme];
  const backgroundColor = colorScheme === 'dark' ? '#000' : '#F2F2F7';
  const headerTextColor = colorScheme === 'dark' ? '#FFF' : '#000';
  const subTextColor = '#8E8E93';
  const cardBg = colorScheme === 'dark' ? '#1C1C1E' : '#FFF';
  
  const handleFeaturedPress = (id: string, title: string) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id, title },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle={colorScheme === 'dark' ? 'light-content' : 'dark-content'} />
      
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: subTextColor }]}>Marhaba, Shoaib!</Text>
            <Text style={[styles.headerTitle, { color: headerTextColor }]}>Ready to learn?</Text>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <Image 
                source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }} 
                style={styles.profileImage} 
            />
            <View style={styles.onlineBadge} />
          </TouchableOpacity>
        </View>

        {/* Progress Card */}
        <View style={[styles.progressCard, { backgroundColor: '#007AFF' }]}>
            <View>
                <Text style={styles.progressLabel}>Daily Goal</Text>
                <Text style={styles.progressValue}>3/5 Scenarios</Text>
                 <View style={styles.progressBarBg}>
                    <View style={[styles.progressBarFill, { width: '60%' }]} />
                </View> 
            </View>
            <View style={styles.streakContainer}>
                <Ionicons name="flame" size={24} color="#FF9500" />
                <Text style={styles.streakText}>12 Days</Text>
            </View>
        </View>

        {/* Categories */}
        <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: headerTextColor }]}>Categories</Text>
            <TouchableOpacity><Text style={styles.seeAll}>See All</Text></TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
            {categories.map((cat) => (
                <TouchableOpacity key={cat.id} style={[styles.categoryPill, { backgroundColor: cardBg }]}>
                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                    <Text style={[styles.categoryName, { color: headerTextColor }]}>{cat.name}</Text>
                </TouchableOpacity>
            ))}
        </ScrollView>

        {/* Featured Scenarios */}
        <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: headerTextColor }]}>Featured Scenarios</Text>
        </View>

        <FlatList
          horizontal
          data={featuredScenarios}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featuredList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.featuredCard, { backgroundColor: cardBg }]}
              onPress={() => handleFeaturedPress(item.id, item.title)}
              activeOpacity={0.9}
            >
              <Image source={{ uri: item.image }} style={styles.featuredImage} />
              <View style={styles.featuredOverlay} />
              <View style={styles.featuredContent}>
                <Text style={styles.featuredSubtitle}>{item.subtitle}</Text>
                <Text style={styles.featuredTitle}>{item.title}</Text>
                <View style={styles.playButton}>
                    <Ionicons name="play" size={16} color="#000" />
                    <Text style={styles.playText}>Start</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
        />

        {/* Recent Activity */}
        <View style={styles.sectionHeader}>
             <Text style={[styles.sectionTitle, { color: headerTextColor }]}>Recent Activity</Text>
        </View>
        {activity.map((act) => (
            <TouchableOpacity key={act.id} style={[styles.activityItem, { backgroundColor: cardBg }]}>
                 <View style={[styles.activityIcon, { backgroundColor: act.status === 'Completed' ? '#34C759' : '#FF9500' }]}>
                    <Ionicons name={act.status === 'Completed' ? 'checkmark' : 'time'} size={20} color="#FFF" />
                 </View>
                 <View style={styles.activityInfo}>
                    <Text style={[styles.activityTitle, { color: headerTextColor }]}>{act.title}</Text>
                    <Text style={styles.activityDate}>{act.date}</Text>
                 </View>
                 <Ionicons name="chevron-forward" size={20} color={subTextColor} />
            </TouchableOpacity>
        ))}

      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={styles.fab}>
        <Ionicons name="mic" size={32} color="#FFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#FFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#34C759',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  progressCard: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: 24,
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  progressValue: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 12,
  },
  progressBarBg: {
    width: 120,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 3,
  },
  streakContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  streakText: {
    color: '#FFF',
    fontWeight: '700',
    marginTop: 4,
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  seeAll: {
    color: '#007AFF',
    fontWeight: '600',
  },
  categoriesScroll: {
    paddingLeft: 20,
    paddingBottom: 24,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  categoryName: {
    fontWeight: '600',
    fontSize: 14,
  },
  featuredList: {
    paddingLeft: 20,
    paddingRight: 10,
    paddingBottom: 24,
  },
  featuredCard: {
    width: 280,
    height: 180,
    borderRadius: 24,
    marginRight: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  featuredContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  featuredSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  featuredTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  playText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
    color: '#000',
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  activityDate: {
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});