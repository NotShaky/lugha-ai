import { Ionicons } from '@expo/vector-icons';
import {
  createAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import Constants from 'expo-constants';
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
      // Android emulator maps localhost to 10.0.2.2
      if (Platform.OS === 'android' && host === 'localhost') {
        return 'http://10.0.2.2:8001';
      }
      return `http://${host}:8001`;
    }
  } catch {
    // Fallback handled below.
  }

  return 'http://localhost:8001';
};

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? getBackendUrl();

const FETCH_TIMEOUT_MS = 15000; // 15 second timeout

// Fetch with timeout to prevent infinite loading
const fetchWithTimeout = (url: string, options: RequestInit, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response> => {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`Request timed out after ${timeoutMs / 1000}s — is the backend running at ${BACKEND_URL}?`));
    }, timeoutMs);

    fetch(url, { ...options, signal: controller.signal })
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timer));
  });
};

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  type?: 'correction' | 'reply';
  timestamp: Date;
}

// --- Drills Data ---
const drills = [
  {
    prompt: 'Build: "This is a pen"',
    answer: 'هٰذَا قَلَمٌ',
  },
  {
    prompt: 'Translate: أَيْنَ الْبَيْتُ؟',
    answer: 'Where is the house?',
  },
  {
    prompt: 'Build: "I have a notebook"',
    answer: 'عِنْدِي دَفْتَرٌ',
  },
];

// Parse AI reply into separate correction + reply messages
function parseAiReply(reply: string, baseId: string): Message[] {
  const msgs: Message[] = [];
  const now = new Date();

  // Extract correction (starts with ✏️)
  const correctionMatch = reply.match(/(?:✏️\s*Correction:?[\s\S]*?)(?=\n\n|$)/m);
  let remaining = reply;

  if (correctionMatch) {
    msgs.push({
      id: baseId + '_correction',
      text: correctionMatch[0].trim(),
      sender: 'ai',
      type: 'correction',
      timestamp: now,
    });
    remaining = remaining.replace(correctionMatch[0], '').trim();
  }

  if (remaining.length > 0) {
    msgs.push({
      id: baseId + '_reply',
      text: remaining,
      sender: 'ai',
      type: 'reply',
      timestamp: now,
    });
  }

  return msgs;
}

export default function ChatScreen() {
  const router = useRouter();
  const { title, id } = useLocalSearchParams();
  const isDrillMode = id === 'drills';
  
  // --- State ---
  const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (isDrillMode) {
      return [
        {
          id: 'welcome',
          text: `Ready for practice drills? Here's your first challenge:\n\n${drills[0].prompt}`,
          sender: 'ai',
          timestamp: new Date(),
        },
      ];
    }
    return [
      {
        id: 'welcome',
        text: 'Ahlan! I am Lugha AI. How can I help you practice Arabic today?',
        sender: 'ai',
        timestamp: new Date(),
      },
    ];
  });
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedCorrections, setExpandedCorrections] = useState<Set<string>>(new Set());
  const [showTranslations, setShowTranslations] = useState(true);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const currentPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // expo-audio recorder (native only)
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY, (status) => {
    console.log('Recorder status:', JSON.stringify(status));
    if (status.isFinished) {
      console.log('Recording finished, url:', status.url);
    }
    if (status.hasError) {
      console.error('Recorder error:', status.error);
    }
  });

  // --- Effects ---
  useEffect(() => {
    // Scroll to bottom when messages change
    setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Auto-speak last AI reply message
    if (autoSpeak && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender === 'ai' && lastMsg.type !== 'correction') {
        speakArabic(lastMsg.text, lastMsg.id);
      }
    }
  }, [messages]);

  // --- Functions ---

  // Extract Arabic text from a message for TTS
  const getArabicText = (text: string): string => {
    // Remove English translation part
    return text.replace(/\(English:[\s\S]*?\)\s*$/, '').trim();
  };

  const speakArabic = async (text: string, messageId: string) => {
    const arabicText = getArabicText(text);
    if (!arabicText) return;

    // If already speaking this message, stop
    if (speakingId === messageId) {
      if (currentPlayerRef.current) {
        currentPlayerRef.current.remove();
        currentPlayerRef.current = null;
      }
      setSpeakingId(null);
      return;
    }

    // Stop any current playback
    if (currentPlayerRef.current) {
      currentPlayerRef.current.remove();
      currentPlayerRef.current = null;
    }

    // Switch audio mode to playback
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch (e) {
      console.warn('Failed to set audio mode for playback:', e);
    }

    setSpeakingId(messageId);

    try {
      if (Platform.OS === 'web') {
        // Web: fetch blob and play with HTML5 Audio
        const response = await fetchWithTimeout(`${BACKEND_URL}/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: arabicText }),
        }, 20000);

        if (!response.ok) throw new Error(`TTS failed: ${response.status}`);

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => {
          setSpeakingId(null);
          URL.revokeObjectURL(url);
        };
        audio.onerror = () => {
          setSpeakingId(null);
          URL.revokeObjectURL(url);
        };
        audio.play();
      } else {
        // Native: use expo-audio player with GET endpoint URL
        const ttsUrl = `${BACKEND_URL}/tts?text=${encodeURIComponent(arabicText)}`;
        const player = createAudioPlayer({ uri: ttsUrl });
        currentPlayerRef.current = player;
        player.play();

        // Clean up when done
        const checkInterval = setInterval(() => {
          if (!player.playing) {
            clearInterval(checkInterval);
            player.remove();
            if (currentPlayerRef.current === player) {
              currentPlayerRef.current = null;
              setSpeakingId(null);
            }
          }
        }, 500);
      }
    } catch (error) {
      console.error('TTS error:', error);
      setSpeakingId(null);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    // Optimistic Update
    const userMsg: Message = { id: Date.now().toString(), text, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    try {
      // --- Drill Mode Handler ---
      if (isDrillMode) {
        const currentDrill = drills[currentDrillIndex];
        
        // Remove Arabic diacritical marks (harakat) so حذا قلم matches حٰذَا قَلَمٌ
        const removeHarakat = (str: string): string => {
          return str
            .replace(/[\u064B-\u0652\u0670]/g, '') // Remove all harakat
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' '); // Normalize whitespace
        };
        
        const userAnswer = removeHarakat(text);
        const expectedAnswer = removeHarakat(currentDrill.answer);
        
        // Check if answers match exactly or if one contains the other
        const isCorrect = userAnswer === expectedAnswer || 
                         userAnswer.includes(expectedAnswer) || 
                         expectedAnswer.includes(userAnswer);
        
        if (isCorrect) {
          const nextIndex = currentDrillIndex + 1;
          if (nextIndex < drills.length) {
            // Move to next drill
            setCurrentDrillIndex(nextIndex);
            const feedback = `✓ Correct! Well done!\n\nNext drill:`+ `\n\n${drills[nextIndex].prompt}`;
            const aiMsg: Message = { 
              id: Date.now().toString() + '_ai', 
              text: feedback, 
              sender: 'ai', 
              timestamp: new Date() 
            };
            setMessages(prev => [...prev, aiMsg]);
          } else {
            // All drills completed
            const feedback = `✓ Correct! Excellent work!\n\n🎉 You've completed all practice drills!\n\nGreat job practicing Arabic!`;
            const aiMsg: Message = { 
              id: Date.now().toString() + '_ai', 
              text: feedback, 
              sender: 'ai', 
              timestamp: new Date() 
            };
            setMessages(prev => [...prev, aiMsg]);
          }
        } else {
          const feedback = `Not quite. The suggested answer is:\n\n${currentDrill.answer}\n\nTry again or move to the next drill by typing 'next'`;
          const aiMsg: Message = { 
            id: Date.now().toString() + '_ai', 
            text: feedback, 
            sender: 'ai', 
            timestamp: new Date() 
          };
          setMessages(prev => [...prev, aiMsg]);
        }
        setIsProcessing(false);
        return;
      }

      // --- Regular Chat Mode ---
      console.log(`Sending to: ${BACKEND_URL}/chat`);
      const response = await fetchWithTimeout(`${BACKEND_URL}/chat`, {
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
        const aiMsgs = parseAiReply(data.reply, Date.now().toString());
        setMessages(prev => [...prev, ...aiMsgs]);
      } else {
        Alert.alert('Error', 'Invalid Response:\n' + JSON.stringify(data));
      }
    } catch (error) {
      Alert.alert('Error', `Failed to send message to ${BACKEND_URL}: ` + (error instanceof Error ? error.message : String(error)));
      console.error('Chat request failed:', BACKEND_URL, error);
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = async () => {
          // Stop all tracks so the browser mic indicator goes away
          stream.getTracks().forEach(track => track.stop());

          setIsProcessing(true);
          try {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const formData = new FormData();
            formData.append('file', blob, 'recording.webm');

            const res = await fetch(`${BACKEND_URL}/transcribe`, {
              method: 'POST',
              body: formData,
            });
            const data = await res.json();

            if (data.text) {
              await sendMessage(data.text);
            }
          } catch (error) {
            console.error('Web audio processing failed', error);
            Alert.alert('Error', 'Failed to process audio.');
            setIsProcessing(false);
          }
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
      } catch (err) {
        console.error('Web recording failed:', err);
      }
    } else {
      try {
        console.log('Requesting recording permissions...');
        const { granted } = await requestRecordingPermissionsAsync();
        if (!granted) {
          Alert.alert('Permission Required', 'Microphone permission is needed to record audio.');
          return;
        }
        console.log('Permissions granted, setting audio mode...');
        await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        console.log('Preparing recorder...');
        await recorder.prepareToRecordAsync();
        console.log('Starting recording...');
        recorder.record();
        setIsRecording(true);
        console.log('Recording started successfully');
      } catch (err) {
        console.error('Failed to start recording', err);
        Alert.alert('Recording Error', 'Failed to start recording: ' + (err instanceof Error ? err.message : String(err)));
      }
    }
  };

  const stopRecording = async () => {
    if (Platform.OS === 'web') {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop(); // triggers onstop handler above
        mediaRecorderRef.current = null;
      }
      setIsRecording(false);
      return;
    }

    if (!isRecording) return;

    setIsRecording(false);
    setIsProcessing(true);
    try {
      console.log('Stopping recorder...');
      try {
        await recorder.stop();
      } catch (stopErr) {
        console.error('Error stopping recorder:', stopErr);
      }
      const uri = recorder.uri;
      console.log('Recording stopped, uri:', uri);
      
      if (!uri) {
        console.error('No recording URI available');
        Alert.alert('Error', 'Recording failed — no audio file was created.');
        return;
      }

      const formData = new FormData();
      // @ts-ignore
      formData.append('file', { uri, name: 'audio.m4a', type: 'audio/m4a' });

      console.log('Uploading audio to:', `${BACKEND_URL}/transcribe`);
      const response = await fetchWithTimeout(`${BACKEND_URL}/transcribe`, {
        method: 'POST',
        body: formData,
      }, 30000); // 30s for audio upload
      
      const data = await response.json();
      
      if (data.text) {
        await sendMessage(data.text);
      }

    } catch (error) {
      console.error('Audio processing failed', error);
      Alert.alert('Error', `Failed to process audio (${BACKEND_URL}): ` + (error instanceof Error ? error.message : String(error)));
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
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => {
              setAutoSpeak(prev => !prev);
              if (autoSpeak && currentPlayerRef.current) {
                currentPlayerRef.current.remove();
                currentPlayerRef.current = null;
              }
            }}
            style={styles.translateBtn}
          >
            <Ionicons name={autoSpeak ? 'volume-high' : 'volume-mute'} size={20} color={autoSpeak ? '#007AFF' : '#999'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowTranslations(prev => !prev)}
            style={styles.translateBtn}
          >
            <Ionicons name="language" size={20} color={showTranslations ? '#007AFF' : '#999'} />
            <Text style={[styles.translateBtnText, showTranslations && { color: '#007AFF' }]}>
              {showTranslations ? 'EN' : 'EN'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Chat Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const isAi = item.sender === 'ai';
          const isCorrection = item.type === 'correction';

          // For AI reply messages, split Arabic and English
          let arabicPart: string = item.text;
          let englishPart: string | null = null;

          if (isAi && !isCorrection) {
            const englishMatch = item.text.match(/(\(English:[\s\S]*?\))\s*$/);
            if (englishMatch) {
              englishPart = englishMatch[1].replace(/^\(English:\s*/, '').replace(/\)$/, '').trim();
              arabicPart = item.text.replace(englishMatch[0], '').trim();
            }
          }

          // Correction bubble — collapsed by default
          if (isCorrection) {
            const isExpanded = expandedCorrections.has(item.id);
            const toggleCorrection = () => {
              setExpandedCorrections(prev => {
                const next = new Set(prev);
                if (next.has(item.id)) {
                  next.delete(item.id);
                } else {
                  next.add(item.id);
                }
                return next;
              });
            };

            return (
              <TouchableOpacity
                onPress={toggleCorrection}
                activeOpacity={0.7}
                style={[styles.bubble, isExpanded ? styles.bubbleCorrection : styles.bubbleCorrectionCollapsed]}
              >
                <View style={styles.correctionToggle}>
                  <Text style={styles.correctionLabel}>✏️ {isExpanded ? 'Hide Correction' : 'Show Correction'}</Text>
                  <View style={styles.correctionActions}>
                    <TouchableOpacity
                      onPress={() => speakArabic(item.text.replace(/^✏️\s*Correction:?\s*/i, ''), item.id)}
                      style={styles.correctionAudioBtn}
                      activeOpacity={0.6}
                    >
                      <Ionicons
                        name={speakingId === item.id ? 'stop-circle' : 'volume-medium'}
                        size={16}
                        color={speakingId === item.id ? '#FF3B30' : '#F59E0B'}
                      />
                    </TouchableOpacity>
                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color="#F59E0B" />
                  </View>
                </View>
                {isExpanded && (
                  <Text style={styles.correctionText}>{item.text.replace(/^✏️\s*Correction:?\s*/i, '')}</Text>
                )}
              </TouchableOpacity>
            );
          }

          // Regular user or AI reply bubble
          return (
            <View style={[
              styles.bubble, 
              item.sender === 'user' ? styles.bubbleUser : styles.bubbleAi
            ]}>
              <Text style={[
                styles.text, 
                item.sender === 'user' ? styles.textUser : styles.textAi,
                isAi && styles.textRtl,
              ]}>
                {arabicPart}
              </Text>
              {englishPart && showTranslations && (
                <View style={styles.englishBox}>
                  <Text style={styles.englishLabel}>English</Text>
                  <Text style={styles.textEnglish}>{englishPart}</Text>
                </View>
              )}
              <View style={styles.bubbleFooter}>
                {isAi && (
                  <TouchableOpacity
                    onPress={() => speakArabic(item.text, item.id)}
                    style={styles.speakerBtn}
                    activeOpacity={0.6}
                  >
                    <Ionicons
                      name={speakingId === item.id ? 'stop-circle' : 'volume-medium'}
                      size={16}
                      color={speakingId === item.id ? '#FF3B30' : '#007AFF'}
                    />
                  </TouchableOpacity>
                )}
                <Text style={[
                     styles.timestamp, 
                     item.sender === 'user' ? { color: 'rgba(255,255,255,0.7)' } : { color: '#8E8E93' }
                ]}>
                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        }}
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
          
          {isRecording ? (
            <TouchableOpacity 
              onPress={stopRecording}
              style={[styles.micBtn, styles.micBtnRecording]}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="stop" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          ) : inputText.trim().length > 0 ? (
            <TouchableOpacity onPress={() => sendMessage(inputText)} style={styles.sendBtn}>
              <Ionicons name="arrow-up" size={20} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={startRecording}
              style={styles.micBtn}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="mic" size={20} color="#fff" />
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  translateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F2F2F7',
  },
  translateBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
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
  textRtl: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  bubbleCorrectionCollapsed: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFDF5',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bubbleCorrection: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFF8E1',
    borderBottomLeftRadius: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#FFC107',
  },
  correctionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  correctionAudioBtn: {
    padding: 4,
  },
  correctionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  correctionHeader: {
    marginBottom: 6,
  },
  correctionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
  },
  correctionText: {
    fontSize: 15,
    color: '#664D03',
    lineHeight: 22,
    writingDirection: 'ltr',
    textAlign: 'left',
  },
  englishBox: {
    backgroundColor: '#E8F4FD',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  englishLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textEnglish: {
    writingDirection: 'ltr',
    textAlign: 'left',
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
  },
  timestamp: {
      fontSize: 10,
      marginTop: 4,
      alignSelf: 'flex-end',
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  speakerBtn: {
    padding: 4,
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