import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- Configuration ---
// Hardcoded IP for debugging connectivity
const BACKEND_URL = 'http://192.168.0.180:8001';

// const getBackendUrl = () => {
//   try {
//     const debuggerHost = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost ?? Constants.manifest?.debuggerHost;
//     const localhost = debuggerHost?.split(':')[0] ?? 'localhost';
//     if (Platform.OS === 'android' && localhost === 'localhost') {
//       return 'http://10.0.2.2:8000';
//     }
//     return `http://${localhost}:8000`;
//   } catch (e) {
//     return 'http://localhost:8000';
//   }
// };

// const BACKEND_URL = getBackendUrl();

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

export default function ChatScreen() {
  const router = useRouter();
  const { title } = useLocalSearchParams();
  
  // --- State ---
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      text: 'Ahlan! I am Lugha AI. How can I help you practice Arabic today?',
      sender: 'ai',
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // --- Effects ---
  useEffect(() => {
    // Scroll to bottom when messages change
    setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  // --- Functions ---

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    // Optimistic Update
    const userMsg: Message = { id: Date.now().toString(), text, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    try {
      console.log(`Sending to: ${BACKEND_URL}/chat`);
      const response = await fetch(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        Alert.alert('Server Error', `Status: ${response.status}\nBody: ${errorText}`);
        return;
      }

      const data = await response.json();
      console.log('Response data:', data);
      
      if (data.reply) {
        const aiMsg: Message = { id: Date.now().toString() + '_ai', text: data.reply, sender: 'ai', timestamp: new Date() };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        Alert.alert('Error', 'Invalid Response:\n' + JSON.stringify(data));
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to send message: ' + (error instanceof Error ? error.message : String(error)));
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Microphone access is required.');
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    setIsProcessing(true);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI(); 
      setRecording(null);
      
      if (!uri) return;

      // Upload Audio
      const formData = new FormData();
      // @ts-ignore
      formData.append('file', { uri, name: 'audio.m4a', type: 'audio/m4a' });

      const response = await fetch(`${BACKEND_URL}/transcribe`, {
        method: 'POST',
        body: formData,
        // headers: { 'Content-Type': 'multipart/form-data' }, // Let fetch handle boundary
      });
      
      const data = await response.json();
      
      // 1. Show Transcription (User Message)
      if (data.text) {
        const userMsg: Message = { id: Date.now().toString(), text: data.text, sender: 'user', timestamp: new Date() };
        setMessages(prev => [...prev, userMsg]);
      }

      // 2. Show AI Reply
      if (data.reply) {
        const aiMsg: Message = { id: Date.now().toString() + '_ai', text: data.reply, sender: 'ai', timestamp: new Date() };
        setMessages(prev => [...prev, aiMsg]);
      }

    } catch (error) {
      console.error('Audio processing failed', error);
      Alert.alert('Error', 'Failed to process audio.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Render ---
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
             <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{typeof title === 'string' ? title : 'Lugha AI Chat'}</Text>
        <TouchableOpacity style={styles.backButton}>
             <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={[
            styles.bubble, 
            item.sender === 'user' ? styles.bubbleUser : styles.bubbleAi
          ]}>
            <Text style={[
              styles.text, 
              item.sender === 'user' ? styles.textUser : styles.textAi
            ]}>
              {item.text}
            </Text>
            <Text style={[
                 styles.timestamp, 
                 item.sender === 'user' ? { color: 'rgba(255,255,255,0.7)' } : { color: '#8E8E93' }
            ]}>
                {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        )}
      />

      {/* Input Area */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        style={styles.inputContainer}
      >
        <View style={styles.inputWrapper}>
          <TextInput 
            style={styles.textInput}
            placeholder="Type in Arabic or English..."
            value={inputText}
            onChangeText={setInputText}
            multiline
            placeholderTextColor="#999"
          />
          
          {inputText.trim().length > 0 ? (
            <TouchableOpacity onPress={() => sendMessage(inputText)} style={styles.sendBtn}>
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={recording ? stopRecording : startRecording}
              style={[styles.micBtn, recording ? styles.micBtnRecording : null]}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name={recording ? "stop" : "mic"} size={20} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    padding: 8,
  },
  listContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 20,
  },
  bubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '80%',
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 2,
  },
  bubbleAi: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2F2F7',
    borderBottomLeftRadius: 2,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  textUser: {
    color: '#fff',
  },
  textAi: {
    color: '#000',
  },
  timestamp: {
      fontSize: 10,
      marginTop: 4,
      alignSelf: 'flex-end',
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 12 : 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 24,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingHorizontal: 12,
    maxHeight: 100,
    minHeight: 36,
    color: '#000',
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micBtnRecording: {
    backgroundColor: '#FF3B30',
  },
});