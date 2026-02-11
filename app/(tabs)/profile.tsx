import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const backgroundColor = colorScheme === 'dark' ? '#000' : '#F2F2F7';
  const cardBg = colorScheme === 'dark' ? '#1C1C1E' : '#FFF';
  const textColor = theme.text;
  const subTextColor = '#8E8E93';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
            <View style={styles.avatarContainer}>
                <Image 
                    source={{ uri: 'https://randomuser.me/api/portraits/men/32.jpg' }} 
                    style={styles.avatar} 
                />
                <View style={styles.editIcon}>
                    <Ionicons name="pencil" size={12} color="#FFF" />
                </View>
            </View>
            <Text style={[styles.name, { color: textColor }]}>Shoaib</Text>
            <Text style={[styles.username, { color: subTextColor }]}>@shoaib_dev</Text>
        </View>

        <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
                <Text style={[styles.statValue, { color: textColor }]}>12</Text>
                <Text style={styles.statLabel}>Day Streak</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: cardBg }]}>
                <Text style={[styles.statValue, { color: textColor }]}>450</Text>
                <Text style={styles.statLabel}>XP Earned</Text>
            </View>
             <View style={[styles.statCard, { backgroundColor: cardBg }]}>
                <Text style={[styles.statValue, { color: textColor }]}>5</Text>
                <Text style={styles.statLabel}>Modules</Text>
            </View>
        </View>

        <Text style={[styles.sectionTitle, { color: textColor }]}>Settings</Text>
        
        <View style={[styles.settingsGroup, { backgroundColor: cardBg }]}>
            <View style={styles.settingItem}>
                <View style={styles.settingLeft}>
                    <Ionicons name="notifications-outline" size={22} color={textColor} />
                    <Text style={[styles.settingLabel, { color: textColor }]}>Notifications</Text>
                </View>
                <Switch value={true} trackColor={{ false: '#767577', true: '#34C759' }} />
            </View>
             <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
                <View style={styles.settingLeft}>
                    <Ionicons name="moon-outline" size={22} color={textColor} />
                    <Text style={[styles.settingLabel, { color: textColor }]}>Dark Mode</Text>
                </View>
                <Switch value={colorScheme === 'dark'} trackColor={{ false: '#767577', true: '#34C759' }} />
            </View>
        </View>

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

        <TouchableOpacity style={styles.logoutButton}>
            <Text style={styles.logoutText}>Log Out</Text>
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
