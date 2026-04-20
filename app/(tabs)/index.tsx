import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const router = useRouter();

  const handleOpenChat = () => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: 'chat-bot', title: 'Lugha AI Chat' },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Lugha AI</Text>

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
          <Text style={styles.chatButtonText}>Start Chatting</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
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
});
