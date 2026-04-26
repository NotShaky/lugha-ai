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
import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { addProgress, logDrillError, markPackCompleted } from '../../utils/progress';
import { supabase } from '../../utils/supabase';

// --- Backend Configuration ---
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

const FETCH_TIMEOUT_MS = 15000;

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

interface PronunciationMistake {
  expected_char: string;
  spoken_char: string;
  position: number;
  word_expected: string;
  word_spoken: string;
  explanation: string;
}

interface AnnotatedChar {
  char: string;
  correct: boolean;
  expected?: string;
  spoken?: string;
}

interface PronunciationFeedback {
  score: number;
  feedback: string;
  mistakes: PronunciationMistake[];
  annotated: AnnotatedChar[];
}

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  type?: 'correction' | 'reply' | 'pronunciation';
  timestamp: Date;
  pronunciationData?: PronunciationFeedback;
}

interface DrillItem {
  prompt: string;
  answer: string;
}

interface DrillSet {
  title: string;
  intro: string;
  drills: DrillItem[];
}

interface AdaptiveDrillsResponse {
  title?: string;
  intro?: string;
  drills?: DrillItem[];
}

const hasArabicChars = (value: string) => /[\u0600-\u06FF]/.test(value);

const DRILL_SETS: Record<string, DrillSet> = {
  general: {
    title: 'General Chat Drills',
    intro: 'Build confidence with foundational Arabic sentences used in everyday conversation.',
    drills: [
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
    ],
  },
  airport: {
    title: 'Airport Drills',
    intro: 'Practice useful phrases for check-in, passport control, and navigating terminals.',
    drills: [
      {
        prompt: 'Translate to Arabic: "Where is gate 12?"',
        answer: 'أَيْنَ البَوَّابَةُ 12؟',
      },
      {
        prompt: 'Build in Arabic: "I have a reservation."',
        answer: 'لَدَيَّ حَجْزٌ',
      },
      {
        prompt: 'Translate: هٰذَا جَوَازُ سَفَرِي',
        answer: 'This is my passport.',
      },
    ],
  },
  classroom: {
    title: 'Classroom Drills',
    intro: 'Practice classroom language for asking questions and responding to your teacher.',
    drills: [
      {
        prompt: 'Build in Arabic: "May I ask a question?"',
        answer: 'هَلْ يُمْكِنُنِي أَنْ أَسْأَلَ سُؤَالًا؟',
      },
      {
        prompt: 'Translate: لَا أَفْهَمُ هٰذَا الدَّرْسَ',
        answer: 'I do not understand this lesson.',
      },
      {
        prompt: 'Build in Arabic: "Please repeat slowly."',
        answer: 'مِنْ فَضْلِكَ أَعِدْ بِبُطْءٍ',
      },
    ],
  },
  adaptive: {
    title: 'Adaptive Mastery Pack',
    intro: 'A fully personalized drill pack generated from your recent mistakes.',
    drills: [],
  },
};

const ADAPTIVE_BONUS_INTRO = 'Final challenge is adaptive and based on your recent mistakes.';
const FALLBACK_ADAPTIVE_DRILLS: DrillItem[] = [
  {
    prompt: 'Translate to Arabic: "Where is the house?"',
    answer: 'أَيْنَ الْبَيْتُ؟',
  },
  {
    prompt: 'Build in Arabic: "I have a notebook."',
    answer: 'عِنْدِي دَفْتَرٌ',
  },
  {
    prompt: 'Translate to English: هٰذِهِ مَدْرَسَةٌ',
    answer: 'This is a school.',
  },
];

function parseAiReply(reply: string, baseId: string): Message[] {
  const msgs: Message[] = [];
  const now = new Date();

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
  const { title, id, drillSet, scenario } = useLocalSearchParams();
  const isDrillMode = id === 'drills';
  const selectedSetKey = typeof drillSet === 'string' && DRILL_SETS[drillSet] ? drillSet : 'general';
  const isAdaptiveMasteryPack = selectedSetKey === 'adaptive';
  const baseDrillSet = DRILL_SETS[selectedSetKey];
  const activeDrillSetKey = isDrillMode ? selectedSetKey : 'general';
  
  const [adaptiveDrillTitle, setAdaptiveDrillTitle] = useState(baseDrillSet.title);
  const [adaptiveDrillIntro, setAdaptiveDrillIntro] = useState(
    isAdaptiveMasteryPack ? baseDrillSet.intro : `${baseDrillSet.intro}\n\n${ADAPTIVE_BONUS_INTRO}`,
  );
  const [adaptiveDrills, setAdaptiveDrills] = useState<DrillItem[]>(() =>
    isAdaptiveMasteryPack ? [] : baseDrillSet.drills,
  );
  const [adaptiveBonusIndex, setAdaptiveBonusIndex] = useState<number | null>(null);
  const [isLoadingDrills, setIsLoadingDrills] = useState(false);
  const [currentDrillIndex, setCurrentDrillIndex] = useState(0);
  const [drillWrongAttempts, setDrillWrongAttempts] = useState<Record<number, number>>({});
  const [hasSwitchedToNormalChat, setHasSwitchedToNormalChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (isDrillMode) {
      return [
        {
          id: 'welcome',
          text: isAdaptiveMasteryPack
            ? `Preparing ${baseDrillSet.title}...\n\nGenerating a fully personalized drill pack from your recent mistakes.`
            : `Preparing ${baseDrillSet.title}...\n\nLoading core set drills and your adaptive bonus challenge.`,
          sender: 'ai',
          timestamp: new Date(),
        },
      ];
    }
    let welcomeText = ' أهلا وسهلا\n\nWelcome to Lugha AI Chat! Practice Arabic conversation with me.';
    if (typeof scenario === 'string' && scenario) {
       welcomeText += `\n\nWe are roleplaying: ${typeof title === 'string' ? title : scenario}. Go ahead and start the conversation!`;
    } else {
       welcomeText += "\n\nYou can type in English or Arabic, or use the microphone to speak. Let's get started!";
    }

    return [
      {
        id: 'welcome',
        text: welcomeText,
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
  const activeDrills = adaptiveDrills;
  const getDisplayPrompt = (drills: DrillItem[], index: number): string => {
    const rawPrompt = drills[index]?.prompt ?? '';
    if (!isAdaptiveMasteryPack && adaptiveBonusIndex === index) {
      return `Adaptive Bonus Challenge:\n\n${rawPrompt}`;
    }
    return rawPrompt;
  };

  // --- Refs ---
  const speakingIdRef = useRef<string | null>(null); 
  const currentPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const currentWebPlayerRef = useRef<HTMLAudioElement | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const loadAdaptiveDrills = useCallback(async () => {
    if (!isDrillMode) return;

    setIsLoadingDrills(true);

    try {
      const baseDrills = isAdaptiveMasteryPack ? [] : baseDrillSet.drills;
      const composeIntro = isAdaptiveMasteryPack
        ? baseDrillSet.intro
        : `${baseDrillSet.intro}\n\n${ADAPTIVE_BONUS_INTRO}`;
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        if (isAdaptiveMasteryPack) {
          setAdaptiveDrillTitle(baseDrillSet.title);
          setAdaptiveDrillIntro(baseDrillSet.intro);
          setAdaptiveDrills([]);
          setAdaptiveBonusIndex(null);
          setCurrentDrillIndex(0);
          setDrillWrongAttempts({});
          setHasSwitchedToNormalChat(false);

          setMessages([
            {
              id: 'welcome',
              text: 'Sign in to start the Adaptive Mastery Pack. This pack is fully personalized from your learning history.',
              sender: 'ai',
              timestamp: new Date(),
            },
          ]);
          return;
        }

        setAdaptiveDrillTitle(baseDrillSet.title);
        setAdaptiveDrillIntro(composeIntro);
        setAdaptiveDrills(baseDrills);
        setAdaptiveBonusIndex(null);
        setCurrentDrillIndex(0);
        setDrillWrongAttempts({});
        setHasSwitchedToNormalChat(false);

        setMessages([
          {
            id: 'welcome',
            text: `Ready for ${baseDrillSet.title}?\n\n${baseDrillSet.intro}\n\nAdaptive bonus challenge is unavailable until you sign in.\n\nFirst challenge:\n\n${baseDrills[0].prompt}`,
            sender: 'ai',
            timestamp: new Date(),
          },
        ]);
        return;
      }

      const response = await fetchWithTimeout(`${BACKEND_URL}/adaptive-drills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          drill_set: selectedSetKey,
          count: isAdaptiveMasteryPack ? 3 : 1,
        }),
      }, 20000);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Status ${response.status}: ${errorBody}`);
      }

      const data: AdaptiveDrillsResponse = await response.json();
      const drills = Array.isArray(data.drills)
        ? data.drills.filter((item) => item?.prompt?.trim() && item?.answer?.trim())
        : [];

      if (isAdaptiveMasteryPack) {
        const masteryDrills = drills.length > 0
          ? drills.slice(0, 3)
          : FALLBACK_ADAPTIVE_DRILLS;

        setAdaptiveDrillTitle(baseDrillSet.title);
        setAdaptiveDrillIntro(baseDrillSet.intro);
        setAdaptiveDrills(masteryDrills);
        setAdaptiveBonusIndex(null);
        setCurrentDrillIndex(0);
        setDrillWrongAttempts({});
        setHasSwitchedToNormalChat(false);

        setMessages([
          {
            id: 'welcome',
            text: `Ready for ${baseDrillSet.title}?\n\n${baseDrillSet.intro}\n\nFirst challenge:\n\n${masteryDrills[0].prompt}`,
            sender: 'ai',
            timestamp: new Date(),
          },
        ]);
        return;
      }

      const adaptiveCandidate = drills[0] ?? FALLBACK_ADAPTIVE_DRILLS[0];
      const isDuplicate = baseDrills.some((item) => {
        return item.prompt.trim().toLowerCase() === adaptiveCandidate.prompt.trim().toLowerCase()
          && item.answer.trim().toLowerCase() === adaptiveCandidate.answer.trim().toLowerCase();
      });
      const combinedDrills = isDuplicate ? baseDrills : [...baseDrills, adaptiveCandidate];
      const resolvedAdaptiveBonusIndex = isDuplicate ? null : baseDrills.length;
      const resolvedIntro = `${baseDrillSet.intro}\n\n${ADAPTIVE_BONUS_INTRO}`;

      setAdaptiveDrillTitle(baseDrillSet.title);
      setAdaptiveDrillIntro(resolvedIntro);
      setAdaptiveDrills(combinedDrills);
      setAdaptiveBonusIndex(resolvedAdaptiveBonusIndex);
      setCurrentDrillIndex(0);
      setDrillWrongAttempts({});
      setHasSwitchedToNormalChat(false);

      setMessages([
        {
          id: 'welcome',
          text: `Ready for ${baseDrillSet.title}?\n\n${resolvedIntro}\n\nFirst challenge:\n\n${resolvedAdaptiveBonusIndex === 0 ? `Adaptive Bonus Challenge:\n\n${combinedDrills[0].prompt}` : combinedDrills[0].prompt}`,
          sender: 'ai',
          timestamp: new Date(),
        },
      ]);
    } catch (error) {
      console.error('Failed to load adaptive drills:', error);

      if (isAdaptiveMasteryPack) {
        const masteryFallbackDrills = FALLBACK_ADAPTIVE_DRILLS;

        setAdaptiveDrillTitle(baseDrillSet.title);
        setAdaptiveDrillIntro(baseDrillSet.intro);
        setAdaptiveDrills(masteryFallbackDrills);
        setAdaptiveBonusIndex(null);
        setCurrentDrillIndex(0);
        setDrillWrongAttempts({});
        setHasSwitchedToNormalChat(false);

        setMessages([
          {
            id: 'welcome',
            text: `Ready for ${baseDrillSet.title}?\n\n${baseDrillSet.intro}\n\nFirst challenge:\n\n${masteryFallbackDrills[0].prompt}`,
            sender: 'ai',
            timestamp: new Date(),
          },
        ]);
        return;
      }

      const baseDrills = baseDrillSet.drills;
      const fallbackAdaptive = FALLBACK_ADAPTIVE_DRILLS.find((item) => {
        return !baseDrills.some((base) => {
          return base.prompt.trim().toLowerCase() === item.prompt.trim().toLowerCase()
            && base.answer.trim().toLowerCase() === item.answer.trim().toLowerCase();
        });
      });
      const combinedDrills = fallbackAdaptive ? [...baseDrills, fallbackAdaptive] : baseDrills;
      const resolvedAdaptiveBonusIndex = fallbackAdaptive ? baseDrills.length : null;
      const resolvedIntro = `${baseDrillSet.intro}\n\n${ADAPTIVE_BONUS_INTRO}`;

      setAdaptiveDrillTitle(baseDrillSet.title);
      setAdaptiveDrillIntro(resolvedIntro);
      setAdaptiveDrills(combinedDrills);
      setAdaptiveBonusIndex(resolvedAdaptiveBonusIndex);
      setCurrentDrillIndex(0);
      setDrillWrongAttempts({});
      setHasSwitchedToNormalChat(false);

      setMessages([
        {
          id: 'welcome',
          text: `Ready for ${baseDrillSet.title}?\n\n${resolvedIntro}\n\nFirst challenge:\n\n${resolvedAdaptiveBonusIndex === 0 ? `Adaptive Bonus Challenge:\n\n${combinedDrills[0].prompt}` : combinedDrills[0].prompt}`,
          sender: 'ai',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoadingDrills(false);
    }
  }, [baseDrillSet, isAdaptiveMasteryPack, isDrillMode, selectedSetKey]);

  // --- Audio Helpers ---
  const stopPlayingAudio = () => {
    if (currentPlayerRef.current) {
      try {
        currentPlayerRef.current.pause();
      } catch (e) {
        // player may already be in an invalid state
      }
      currentPlayerRef.current.remove();
      currentPlayerRef.current = null;
    }
    if (currentWebPlayerRef.current) {
      currentWebPlayerRef.current.pause();
      currentWebPlayerRef.current.currentTime = 0;
      currentWebPlayerRef.current = null;
    }
    setSpeakingId(null);
    speakingIdRef.current = null;
  };

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
    setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    if (autoSpeak && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender === 'ai' && lastMsg.type !== 'correction') {
        speakArabic(lastMsg.text, lastMsg.id);
      }
    }
  }, [messages]);

  useEffect(() => {
    void loadAdaptiveDrills();
  }, [loadAdaptiveDrills]);

  // Stop all audio when the user leaves the chat screen.
  useEffect(() => {
    return () => {
      stopPlayingAudio();
    };
  }, []);

  // --- Text Helpers ---
  const getArabicText = (text: string): string => {
    return text
      .replace(/\(English:[\s\S]*?\)\s*$/, '')
      .replace(/\{[\s\S]*?\}/g, '')
      .trim();
  };

  // --- TTS Helpers ---
  const segmentTextByLanguage = (text: string) => {
    const parts = text.split(/([a-zA-Z0-9]+(?:[\s.,!?'"-]+[a-zA-Z0-9]+)*)/g);
    const segments: { text: string; voice: string }[] = [];

    parts.forEach(p => {
      const trimmed = p.trim();
      if (!trimmed || /^[^a-zA-Z0-9\u0600-\u06FF]+$/.test(trimmed)) return;
      
      if (/[a-zA-Z]/.test(trimmed)) {
        segments.push({ text: trimmed, voice: 'en-GB-RyanNeural' }); 
      } else {
        segments.push({ text: trimmed, voice: 'ar-SA-HamedNeural' });
      }
    });
    return segments;
  };

  const speakArabic = async (text: string, messageId: string) => {
    const textToSpeak = getArabicText(text);
    if (!textToSpeak) return;

    if (speakingId === messageId) {
      stopPlayingAudio();
      return;
    }

    stopPlayingAudio();

    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch (e) {
      console.warn('Failed to set audio mode for playback:', e);
    }

    setSpeakingId(messageId);
    speakingIdRef.current = messageId;

    const segments = segmentTextByLanguage(textToSpeak);

    for (const segment of segments) {
      if (speakingIdRef.current !== messageId) break;

      try {
        if (Platform.OS === 'web') {
          const response = await fetchWithTimeout(`${BACKEND_URL}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: segment.text, voice: segment.voice }),
          }, 20000);

          if (!response.ok) throw new Error(`TTS failed: ${response.status}`);

          const blob = await response.blob();
          const url = URL.createObjectURL(blob);

          await new Promise<void>((resolve) => {
            if (speakingIdRef.current !== messageId) {
              URL.revokeObjectURL(url);
              return resolve();
            }
            const audio = new Audio(url);
            currentWebPlayerRef.current = audio;

            const onEnd = () => {
              URL.revokeObjectURL(url);
              resolve();
            };
            audio.onended = onEnd;
            audio.onerror = onEnd;
            audio.play();
          });
        } else {
          const ttsUrl = `${BACKEND_URL}/tts?text=${encodeURIComponent(segment.text)}&voice=${encodeURIComponent(segment.voice)}`;
          
          await new Promise<void>((resolve) => {
            if (speakingIdRef.current !== messageId) return resolve();

            const player = createAudioPlayer({ uri: ttsUrl });
            currentPlayerRef.current = player;
            player.play();

            let hasStartedPlaying = false;
            let checkCount = 0;

            const checkInterval = setInterval(() => {
              if (currentPlayerRef.current !== player || speakingIdRef.current !== messageId) {
                clearInterval(checkInterval);
                return resolve();
              }

              if (player.playing) {
                hasStartedPlaying = true;
              }

              checkCount++;
              const networkTimeout = !hasStartedPlaying && checkCount > 40;

              if ((hasStartedPlaying && !player.playing) || networkTimeout) {
                clearInterval(checkInterval);
                if (currentPlayerRef.current === player) {
                  player.remove();
                  currentPlayerRef.current = null;
                }
                resolve();
              }
            }, 250); 
          });
        }
      } catch (error) {
        console.error('Segment TTS error:', error);
        break;
      }
    }

    if (speakingIdRef.current === messageId) {
      setSpeakingId(null);
      speakingIdRef.current = null;
    }
  };

  // --- Message Handling ---
  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), text, sender: 'user', timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
  // --- Recording ---
    setIsProcessing(true);

    try {
      if (isDrillMode && isLoadingDrills) {
        const waitMsg: Message = {
          id: Date.now().toString() + '_ai_wait',
          text: 'Still preparing your adaptive drills. Please wait a moment.',
          sender: 'ai',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, waitMsg]);
        setIsProcessing(false);
        return;
      }

      const drillIsActive = isDrillMode && currentDrillIndex < activeDrills.length;

      if (drillIsActive) {
        const currentDrill = activeDrills[currentDrillIndex];

        const removeHarakat = (str: string): string => {
          return str
            .replace(/[\u064B-\u0652\u0670]/g, '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ')
            .replace(/[؟?!.,;:]/g, '');
        };

        const normalizeArabicForTolerance = (str: string): string => {
          return removeHarakat(str)
            .replace(/[أإآٱ]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/ؤ/g, 'و')
            .replace(/ئ/g, 'ي')
            .replace(/ة/g, 'ه')
            .replace(/ء/g, '')
            // STT can confuse throat-heavy openings like ع with nearby vowels.
            .replace(/ع/g, 'ا');
        };

        const normalizeEnglishWords = (str: string): string[] => {
          const expanded = str
            .toLowerCase()
            .replace(/\bdo\s*['’]?nt\b/g, 'do not');

          return expanded
            .replace(/[^a-z0-9\s]/g, ' ')
            .trim()
            .split(/\s+/)
            .filter(Boolean);
        };

        const ENGLISH_SYNONYM_GROUPS = [
          ['lesson', 'class', 'session'],
          ['teacher', 'instructor', 'professor', 'tutor'],
          ['student', 'pupil', 'learner'],
          ['home', 'house'],
        ];

        const ENGLISH_SYNONYM_MAP = ENGLISH_SYNONYM_GROUPS.reduce<Record<string, string>>((acc, group) => {
          const canonical = group[0];
          group.forEach((word) => {
            acc[word] = canonical;
          });
          return acc;
        }, {});

        const normalizeEnglishForSynonyms = (str: string): string => {
          const normalizedWords = normalizeEnglishWords(str).map((word) => ENGLISH_SYNONYM_MAP[word] ?? word);
          return normalizedWords.join(' ');
        };

         const buildHint = (answer: string, userInput: string, attempt: number): string => {
          const answerWordsRaw = answer.trim().split(/\s+/).filter(Boolean);
          const userWordsRaw = userInput.trim().split(/\s+/).filter(Boolean);
          const answerWords = answerWordsRaw.map((w) => normalizeArabicForTolerance(w));
          const userWords = userWordsRaw.map((w) => normalizeArabicForTolerance(w));

          const samePositionMatches = answerWords.reduce((count, word, index) => {
            return count + (userWords[index] === word ? 1 : 0);
          }, 0);

          const matchedWordCount = answerWords.filter((word) => userWords.includes(word)).length;
          const startsCorrectly = answerWords.length > 0 && userWords[0] === answerWords[0];

          if (attempt === 1) {
            if (samePositionMatches > 0) {
              return `Hint: good start, you already have ${samePositionMatches} word(s) in the correct position. Check the remaining part.`;
            }

            if (matchedWordCount > 0) {
              return `Hint: you're close. ${matchedWordCount} word(s) match, but the order/ending needs adjustment.`;
            }

            if (startsCorrectly) {
              return 'Hint: your opening is correct. Focus on the second half of the sentence.';
            }

            return `Hint: start with "${answerWordsRaw[0] ?? answer}" and keep the phrase concise.`;
          }

          if (attempt === 2) {
            if (answerWordsRaw.length > 1) {
              return `Hint: target has ${answerWordsRaw.length} words. It starts with "${answerWordsRaw[0]}" and ends with "${answerWordsRaw[answerWordsRaw.length - 1]}".`;
            }

            return `Hint: focus on the exact pronunciation/spelling of "${answerWordsRaw[0] ?? answer}".`;
          }

          return `Hint: compare your response to the expected structure word by word.`;
        };

        if (!currentDrill) {
          const doneMsg: Message = {
            id: Date.now().toString() + '_ai_done',
            text: `You've already completed ${adaptiveDrillTitle}. Nice work!`,
            sender: 'ai',
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, doneMsg]);
          setIsProcessing(false);
          return;
        }

        const normalizedInput = text.trim().toLowerCase();
        if (normalizedInput === 'reload drills') {
          await loadAdaptiveDrills();
          setIsProcessing(false);
          return;
        }

        if (normalizedInput === 'next' || normalizedInput === 'skip') {
          const nextIndex = currentDrillIndex + 1;
          setDrillWrongAttempts((prev) => {
            const next = { ...prev };
            delete next[currentDrillIndex];
            return next;
          });
          if (nextIndex < activeDrills.length) {
            setCurrentDrillIndex(nextIndex);
            const skipMsg: Message = {
              id: Date.now().toString() + '_ai_skip',
              text: `Skipping this one. Next challenge:\n\n${getDisplayPrompt(activeDrills, nextIndex)}`,
              sender: 'ai',
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, skipMsg]);
          } else {
            setCurrentDrillIndex(activeDrills.length);
            void markPackCompleted(activeDrillSetKey);
            const completeMsg: Message = {
              id: Date.now().toString() + '_ai_complete',
              text: `All done. You completed ${adaptiveDrillTitle}!`,
              sender: 'ai',
              timestamp: new Date(),
            };
            setMessages(prev => [...prev, completeMsg]);
          }
          setIsProcessing(false);
          return;
        }

        const userAnswer = removeHarakat(text);
        const expectedAnswer = removeHarakat(currentDrill.answer);

        const strictMatch =
          userAnswer === expectedAnswer ||
          userAnswer.includes(expectedAnswer) ||
          expectedAnswer.includes(userAnswer);

        const answerLooksArabic = hasArabicChars(currentDrill.answer);
        const userLooksArabic = hasArabicChars(text);

        const tolerantUser = normalizeArabicForTolerance(text);
        const tolerantExpected = normalizeArabicForTolerance(currentDrill.answer);

        const toleranceMatch =
          answerLooksArabic &&
          userLooksArabic &&
          (tolerantUser === tolerantExpected ||
            tolerantUser.includes(tolerantExpected) ||
            tolerantExpected.includes(tolerantUser));

        const expectedLooksEnglish = /[a-z]/i.test(currentDrill.answer) && !answerLooksArabic;
        const userLooksEnglish = /[a-z]/i.test(text) && !userLooksArabic;

        const synonymExpected = normalizeEnglishForSynonyms(currentDrill.answer);
        const synonymUser = normalizeEnglishForSynonyms(text);

        const synonymMatch =
          expectedLooksEnglish &&
          userLooksEnglish &&
          synonymExpected.length > 0 &&
          synonymUser.length > 0 &&
          (synonymUser === synonymExpected ||
            synonymUser.includes(synonymExpected) ||
            synonymExpected.includes(synonymUser));

        const isCorrect = strictMatch || toleranceMatch || synonymMatch;
        const acceptedByTolerance = !strictMatch && (toleranceMatch || synonymMatch);
        
        if (isCorrect) {
          void addProgress(10);
          setDrillWrongAttempts((prev) => {
            const next = { ...prev };
            delete next[currentDrillIndex];
            return next;
          });

          const nextIndex = currentDrillIndex + 1;
          const toleranceNote = acceptedByTolerance
            ? answerLooksArabic
              ? '\n\nNote: Accepted with pronunciation tolerance because speech transcription can mix similar letters (for example, alif/ayn-style sounds).'
              : '\n\nNote: Accepted with meaning tolerance because multiple English words can map to the same Arabic meaning (for example, class/lesson).'
            : '';

          if (nextIndex < activeDrills.length) {
            setCurrentDrillIndex(nextIndex);
            const feedback = `✓ Correct! Well done!${toleranceNote}\n\nNext drill:` + `\n\n${getDisplayPrompt(activeDrills, nextIndex)}`;
            const aiMsg: Message = { 
              id: Date.now().toString() + '_ai', 
              text: feedback, 
              sender: 'ai', 
              timestamp: new Date() 
            };
            setMessages(prev => [...prev, aiMsg]);
          } else {
            setCurrentDrillIndex(activeDrills.length);
            void markPackCompleted(activeDrillSetKey);
            const feedback = `✓ Correct! Excellent work!${toleranceNote}\n\n🎉 You've completed ${adaptiveDrillTitle}!\n\nGreat job practicing Arabic!`;
            const aiMsg: Message = { 
              id: Date.now().toString() + '_ai', 
              text: feedback, 
              sender: 'ai', 
              timestamp: new Date() 
            };
            setMessages(prev => [...prev, aiMsg]);
          }
        } else {
          void logDrillError(currentDrill.prompt, text, currentDrill.answer);

          const nextAttempt = (drillWrongAttempts[currentDrillIndex] ?? 0) + 1;
          setDrillWrongAttempts((prev) => ({ ...prev, [currentDrillIndex]: nextAttempt }));

          const pronunciationNote = answerLooksArabic
            ? '\n\nNote: We allow some pronunciation/transcription variation (like similar-sounding letters such as alif/ayn), so keep trying if your spoken Arabic was close.'
            : '';

          const feedback = nextAttempt < 3
            ? `Not quite yet. ${buildHint(currentDrill.answer, text, nextAttempt)}${pronunciationNote}\n\nTry again or type 'next' to skip.`
            : `Not quite. The suggested answer is:\n\n${currentDrill.answer}${pronunciationNote}\n\nTry again or move to the next drill by typing 'next'.`;

          const aiMsg: Message = { 
            id: Date.now().toString() + '_ai', 
            text: feedback, 
            sender: 'ai', 
            timestamp: new Date() 
          };
          setMessages(prev => [...prev, aiMsg]);

          // Fire pronunciation analysis for Arabic answers (async, non-blocking).
          if (answerLooksArabic && userLooksArabic) {
            fetchWithTimeout(`${BACKEND_URL}/pronunciation-check`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                user_text: text,
                expected_text: currentDrill.answer,
              }),
            }, 10000)
              .then(res => res.json())
              .then((pronData: PronunciationFeedback) => {
                if (pronData && pronData.score >= 0 && pronData.annotated?.length > 0) {
                  const pronMsg: Message = {
                    id: Date.now().toString() + '_pron',
                    text: `🎯 Pronunciation Score: ${pronData.score}/100\n${pronData.feedback}`,
                    sender: 'ai',
                    type: 'pronunciation',
                    timestamp: new Date(),
                    pronunciationData: pronData,
                  };
                  setMessages(prev => [...prev, pronMsg]);
                }
              })
              .catch(err => console.warn('Pronunciation check failed:', err));
          }
        }
        setIsProcessing(false);
        return;
      }

      if (isDrillMode && !hasSwitchedToNormalChat) {
        setHasSwitchedToNormalChat(true);
        const transitionMsg: Message = {
          id: Date.now().toString() + '_ai_transition',
          text: 'Drills are complete. You are now in normal chat mode, so feel free to continue the conversation naturally.',
          sender: 'ai',
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, transitionMsg]);
      }

      console.log(`Sending to: ${BACKEND_URL}/chat`);
      
      const chatHistory = messages
        .filter(m => m.id !== 'welcome' && m.type !== 'correction') 
        .slice(-10) 
        .map(m => ({
          role: m.sender === 'ai' ? 'assistant' : 'user',
          content: m.text
        }));

      // 1. Get the logged-in user's ID securely from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      if (!userId) {
        console.error("User not logged in!");
        return; 
      }

      let userPersona = 'General Learner';
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('persona')
          .eq('id', userId)
          .single();

        if (typeof profile?.persona === 'string' && profile.persona.trim()) {
          userPersona = profile.persona;
        }
      } catch (error) {
        console.warn('Failed to load persona for chat request:', error);
      }

      // 2. Call standard text chat endpoint WITH the user_id and persona attached
      const response = await fetchWithTimeout(`${BACKEND_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,            
          session_id: id,
          user_id: userId, 
          persona: userPersona,
          scenario: typeof scenario === 'string' && scenario ? scenario : undefined,
          history: chatHistory,
        }),
      }, 15000);
      
      if (!response.ok) {
        const errorText = await response.text();
        Alert.alert('Server Error', `Status: ${response.status}\nBody: ${errorText}`);
        return;
      }

      const data = await response.json();
      console.log('Response data:', data);

      const aiReply = typeof data?.reply === 'string'
        ? data.reply
        : typeof data?.response === 'string'
          ? data.response
          : '';

      if (aiReply) {
        const aiMsgs = parseAiReply(aiReply, Date.now().toString());
        setMessages(prev => [...prev, ...aiMsgs]);

        void addProgress(10);
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
    stopPlayingAudio();

    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
          },
        });

        const preferredMimeType = 'audio/webm;codecs=opus';
        const recorderOptions = MediaRecorder.isTypeSupported(preferredMimeType)
          ? { mimeType: preferredMimeType, audioBitsPerSecond: 128000 }
          : undefined;

        const mediaRecorder = new MediaRecorder(stream, recorderOptions);
        const chunks: Blob[] = [];

        mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());

          setIsProcessing(true);
          try {
            const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
            const formData = new FormData();
            formData.append('file', blob, 'recording.webm');

            const res = await fetch(`${BACKEND_URL}/transcribe`, {
              method: 'POST',
              body: formData,
            });
            const data = await res.json();

            if (data.text && data.text.trim()) {
              await sendMessage(data.text);
            } else {
              setIsProcessing(false);
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
        mediaRecorderRef.current.stop();
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
        setIsProcessing(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', { uri, name: 'audio.m4a', type: 'audio/m4a' } as any);

      console.log('Uploading audio to:', `${BACKEND_URL}/transcribe`);
      const response = await fetchWithTimeout(`${BACKEND_URL}/transcribe`, {
        method: 'POST',
        body: formData,
      }, 30000);
      
      const data = await response.json();
      
      if (data.text && data.text.trim()) {
        await sendMessage(data.text);
      } else {
        console.log('Empty transcription — mic may have picked up silence.');
        setIsProcessing(false);
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

          let arabicPart: string = item.text;
          let englishPart: string | null = null;

          if (isAi && !isCorrection) {
            const englishMatch = item.text.match(/(\(English:[\s\S]*?\))\s*$/);
            if (englishMatch) {
              englishPart = englishMatch[1].replace(/^\(English:\s*/, '').replace(/\)$/, '').trim();
              arabicPart = item.text.replace(englishMatch[0], '').trim();

              const mainLooksIncomplete =
                /(?:meant to|to write|to say|correction|translate)\s*\.?$/i.test(arabicPart) ||
                arabicPart.length < 10;

              if (!hasArabicChars(arabicPart) && mainLooksIncomplete && englishPart) {
                arabicPart = englishPart;
                englishPart = null;
              }
            }
          }

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

          // --- Pronunciation Feedback Bubble ---
          if (item.type === 'pronunciation' && item.pronunciationData) {
            const pd = item.pronunciationData;
            const scoreColor = pd.score >= 80 ? '#34C759' : pd.score >= 50 ? '#FF9500' : '#FF3B30';

            return (
              <View style={[styles.bubble, styles.bubblePronunciation]}>
                {/* Score Badge */}
                <View style={styles.pronScoreRow}>
                  <View style={[styles.pronScoreBadge, { backgroundColor: scoreColor }]}>
                    <Text style={styles.pronScoreText}>{pd.score}</Text>
                    <Text style={styles.pronScoreLabel}>/100</Text>
                  </View>
                  <View style={styles.pronFeedbackWrap}>
                    <Text style={styles.pronTitle}>Pronunciation Analysis</Text>
                    <Text style={styles.pronFeedback}>{pd.feedback}</Text>
                  </View>
                </View>

                {/* Annotated Characters */}
                {pd.annotated.length > 0 && (
                  <View style={styles.pronAnnotatedRow}>
                    {pd.annotated.map((ch, idx) => (
                      <TouchableOpacity
                        key={`${idx}-${ch.char}`}
                        disabled={ch.correct}
                        onPress={() => {
                          if (!ch.correct && ch.expected) {
                            speakArabic(ch.expected, `pron-${item.id}-${idx}`);
                          }
                        }}
                        activeOpacity={0.6}
                      >
                        <Text
                          style={[
                            styles.pronChar,
                            ch.correct ? styles.pronCharCorrect : styles.pronCharWrong,
                          ]}
                        >
                          {ch.char}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Mistake Details */}
                {pd.mistakes.length > 0 && (
                  <View style={styles.pronMistakesList}>
                    {pd.mistakes.map((m, idx) => (
                      <View key={idx} style={styles.pronMistakeRow}>
                        <View style={styles.pronMistakeChars}>
                          <TouchableOpacity onPress={() => speakArabic(m.expected_char, `pron-exp-${idx}`)}>
                            <Text style={styles.pronExpectedChar}>{m.expected_char}</Text>
                          </TouchableOpacity>
                          <Ionicons name="arrow-back" size={12} color="#FF3B30" />
                          <Text style={styles.pronSpokenChar}>{m.spoken_char}</Text>
                        </View>
                        <Text style={styles.pronExplanation}>{m.explanation}</Text>
                        <TouchableOpacity
                          style={styles.pronPlayCorrect}
                          onPress={() => speakArabic(m.word_expected, `pron-word-${idx}`)}
                        >
                          <Ionicons name="volume-medium" size={14} color="#007AFF" />
                          <Text style={styles.pronPlayText}>Hear "{m.word_expected}"</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          }
          return (
            <View style={[
              styles.bubble, 
              item.sender === 'user' ? styles.bubbleUser : styles.bubbleAi
            ]}>
              <Text style={[
                styles.text, 
                item.sender === 'user' ? styles.textUser : styles.textAi,
                isAi && hasArabicChars(arabicPart) && styles.textRtl,
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
        <Text style={styles.recordingHint}>
          Voice tip: background audio can reduce transcription accuracy. For best results, pause playback.
        </Text>
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
  recordingHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
    paddingHorizontal: 4,
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

  // --- Pronunciation Feedback ---
  bubblePronunciation: {
    backgroundColor: '#F8F9FE',
    borderWidth: 1,
    borderColor: '#E0E4F0',
    borderRadius: 16,
    padding: 14,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  pronScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  pronScoreBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pronScoreText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFF',
  },
  pronScoreLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginTop: -2,
  },
  pronFeedbackWrap: {
    flex: 1,
  },
  pronTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  pronFeedback: {
    fontSize: 13,
    color: '#555',
    lineHeight: 18,
  },
  pronAnnotatedRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#FFF',
    borderRadius: 10,
  },
  pronChar: {
    fontSize: 26,
    fontWeight: '600',
    paddingHorizontal: 3,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pronCharCorrect: {
    color: '#34C759',
  },
  pronCharWrong: {
    color: '#FF3B30',
    backgroundColor: '#FFE5E5',
    textDecorationLine: 'underline',
  },
  pronMistakesList: {
    gap: 10,
  },
  pronMistakeRow: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FF3B30',
  },
  pronMistakeChars: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pronExpectedChar: {
    fontSize: 24,
    fontWeight: '700',
    color: '#34C759',
  },
  pronSpokenChar: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FF3B30',
    textDecorationLine: 'line-through',
  },
  pronExplanation: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    marginBottom: 6,
  },
  pronPlayCorrect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pronPlayText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '600',
  },
});