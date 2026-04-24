import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Ionicons } from '@expo/vector-icons';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const getBackendUrl = () => {
  if (Platform.OS === 'web') return 'http://localhost:8001';
  try {
    const legacyManifest = Constants.manifest as { debuggerHost?: string } | null;
    const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost ?? legacyManifest?.debuggerHost;
    const host = hostUri?.split(':')[0];
    if (host) {
      if (Platform.OS === 'android' && host === 'localhost') return 'http://10.0.2.2:8001';
      return `http://${host}:8001`;
    }
  } catch {}
  return 'http://localhost:8001';
};

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? getBackendUrl();

const fundamentals = [
  { title: 'Writing Direction', icon: 'arrow-back', desc: 'Arabic is written and read from right to left (RTL).' },
  { title: 'Letter Forms', icon: 'swap-horizontal', desc: 'Most letters change shape depending on their position in a word: initial, medial, final, or isolated.' },
  { title: 'Vowels (Harakat)', icon: 'musical-note', desc: 'Short vowels are diacritical marks placed above or below letters: Fatha (َ), Kasra (ِ), Damma (ُ).' },
  { title: 'Connecting Letters', icon: 'link', desc: 'Most Arabic letters connect to the next letter. Six letters (ا د ذ ر ز و) only connect to the right.' },
  { title: 'Shadda ( ّ  )', icon: 'layers', desc: 'A doubled consonant, shown by the mark ّ above a letter. It makes the letter sound stronger.' },
  { title: 'Sukoon (ـْ)', icon: 'remove-circle', desc: 'A small circle above a letter meaning no vowel follows that consonant.' },
];

const arabicLetters = [
  { letter: 'ا', name: 'Alif', sound: 'a', forms: { isolated: 'ا', initial: 'ا', medial: 'ـا', final: 'ـا' } },
  { letter: 'ب', name: 'Ba', sound: 'b', forms: { isolated: 'ب', initial: 'بـ', medial: 'ـبـ', final: 'ـب' } },
  { letter: 'ت', name: 'Ta', sound: 't', forms: { isolated: 'ت', initial: 'تـ', medial: 'ـتـ', final: 'ـت' } },
  { letter: 'ث', name: 'Tha', sound: 'th', forms: { isolated: 'ث', initial: 'ثـ', medial: 'ـثـ', final: 'ـث' } },
  { letter: 'ج', name: 'Jeem', sound: 'j', forms: { isolated: 'ج', initial: 'جـ', medial: 'ـجـ', final: 'ـج' } },
  { letter: 'ح', name: 'Ha', sound: 'ḥ', forms: { isolated: 'ح', initial: 'حـ', medial: 'ـحـ', final: 'ـح' } },
  { letter: 'خ', name: 'Kha', sound: 'kh', forms: { isolated: 'خ', initial: 'خـ', medial: 'ـخـ', final: 'ـخ' } },
  { letter: 'د', name: 'Dal', sound: 'd', forms: { isolated: 'د', initial: 'د', medial: 'ـد', final: 'ـد' } },
  { letter: 'ذ', name: 'Dhal', sound: 'dh', forms: { isolated: 'ذ', initial: 'ذ', medial: 'ـذ', final: 'ـذ' } },
  { letter: 'ر', name: 'Ra', sound: 'r', forms: { isolated: 'ر', initial: 'ر', medial: 'ـر', final: 'ـر' } },
  { letter: 'ز', name: 'Zay', sound: 'z', forms: { isolated: 'ز', initial: 'ز', medial: 'ـز', final: 'ـز' } },
  { letter: 'س', name: 'Seen', sound: 's', forms: { isolated: 'س', initial: 'سـ', medial: 'ـسـ', final: 'ـس' } },
  { letter: 'ش', name: 'Sheen', sound: 'sh', forms: { isolated: 'ش', initial: 'شـ', medial: 'ـشـ', final: 'ـش' } },
  { letter: 'ص', name: 'Sad', sound: 'ṣ', forms: { isolated: 'ص', initial: 'صـ', medial: 'ـصـ', final: 'ـص' } },
  { letter: 'ض', name: 'Dad', sound: 'ḍ', forms: { isolated: 'ض', initial: 'ضـ', medial: 'ـضـ', final: 'ـض' } },
  { letter: 'ط', name: 'Ta', sound: 'ṭ', forms: { isolated: 'ط', initial: 'طـ', medial: 'ـطـ', final: 'ـط' } },
  { letter: 'ظ', name: 'Dha', sound: 'ẓ', forms: { isolated: 'ظ', initial: 'ظـ', medial: 'ـظـ', final: 'ـظ' } },
  { letter: 'ع', name: 'Ain', sound: 'ʿ', forms: { isolated: 'ع', initial: 'عـ', medial: 'ـعـ', final: 'ـع' } },
  { letter: 'غ', name: 'Ghain', sound: 'gh', forms: { isolated: 'غ', initial: 'غـ', medial: 'ـغـ', final: 'ـغ' } },
  { letter: 'ف', name: 'Fa', sound: 'f', forms: { isolated: 'ف', initial: 'فـ', medial: 'ـفـ', final: 'ـف' } },
  { letter: 'ق', name: 'Qaf', sound: 'q', forms: { isolated: 'ق', initial: 'قـ', medial: 'ـقـ', final: 'ـق' } },
  { letter: 'ك', name: 'Kaf', sound: 'k', forms: { isolated: 'ك', initial: 'كـ', medial: 'ـكـ', final: 'ـك' } },
  { letter: 'ل', name: 'Lam', sound: 'l', forms: { isolated: 'ل', initial: 'لـ', medial: 'ـلـ', final: 'ـل' } },
  { letter: 'م', name: 'Meem', sound: 'm', forms: { isolated: 'م', initial: 'مـ', medial: 'ـمـ', final: 'ـم' } },
  { letter: 'ن', name: 'Noon', sound: 'n', forms: { isolated: 'ن', initial: 'نـ', medial: 'ـنـ', final: 'ـن' } },
  { letter: 'ه', name: 'Ha', sound: 'h', forms: { isolated: 'ه', initial: 'هـ', medial: 'ـهـ', final: 'ـه' } },
  { letter: 'و', name: 'Waw', sound: 'w', forms: { isolated: 'و', initial: 'و', medial: 'ـو', final: 'ـو' } },
  { letter: 'ي', name: 'Ya', sound: 'y', forms: { isolated: 'ي', initial: 'يـ', medial: 'ـيـ', final: 'ـي' } },
];

const modules = [
  {
    id: 'm1',
    title: 'Module 1: Classroom Arabic',
    focus: 'Nouns + simple nominal sentences',
    color: '#005F73',
  },
  {
    id: 'm2',
    title: 'Module 2: Family & People',
    focus: 'Pronouns + possessive patterns',
    color: '#0A9396',
  },
  {
    id: 'm3',
    title: 'Module 3: Places & Movement',
    focus: 'Prepositions + where questions',
    color: '#EE9B00',
  },
  {
    id: 'm4',
    title: 'Module 4: Daily Actions',
    focus: 'Present tense verb forms',
    color: '#CA6702',
  },
];

const vocabByTheme = [
  {
    title: 'Classroom',
    words: [
      { ar: 'كِتَاب', en: 'book', tr: 'kitab' },
      { ar: 'قَلَم', en: 'pen', tr: 'qalam' },
      { ar: 'دَفْتَر', en: 'notebook', tr: 'daftar' },
      { ar: 'مَكْتَب', en: 'desk', tr: 'maktab' },
    ],
  },
  {
    title: 'People',
    words: [
      { ar: 'مُدَرِّس', en: 'teacher (male)', tr: 'mudarris' },
      { ar: 'طَالِب', en: 'student (male)', tr: 'talib' },
      { ar: 'طَالِبَة', en: 'student (female)', tr: 'talibah' },
      { ar: 'أُسْتَاذ', en: 'professor/teacher', tr: 'ustadh' },
    ],
  },
  {
    title: 'Places',
    words: [
      { ar: 'مَسْجِد', en: 'mosque', tr: 'masjid' },
      { ar: 'بَيْت', en: 'house', tr: 'bayt' },
      { ar: 'مَدْرَسَة', en: 'school', tr: 'madrasa' },
      { ar: 'سُوق', en: 'market', tr: 'suq' },
    ],
  },
];

const sentencePatterns = [
  {
    title: 'Pattern A: "This is ..."',
    formula: 'هٰذَا + noun',
    examples: [
      { ar: 'هٰذَا كِتَابٌ', en: 'This is a book.' },
      { ar: 'هٰذَا بَيْتٌ', en: 'This is a house.' },
    ],
  },
  {
    title: 'Pattern B: "Where is ...?"',
    formula: 'أَيْنَ + noun ?',
    examples: [
      { ar: 'أَيْنَ الْمَسْجِدُ؟', en: 'Where is the mosque?' },
      { ar: 'أَيْنَ الْمُدَرِّسُ؟', en: 'Where is the teacher?' },
    ],
  },
  {
    title: 'Pattern C: "I have ..."',
    formula: 'عِنْدِي + noun',
    examples: [
      { ar: 'عِنْدِي قَلَمٌ', en: 'I have a pen.' },
      { ar: 'عِنْدِي دَفْتَرٌ', en: 'I have a notebook.' },
    ],
  },
];

const grammarQuickBits = [
  {
    title: 'Masculine vs Feminine',
    tip: 'Many feminine nouns end with ة (taa marbuta).',
    sample: 'طَالِب (male student) / طَالِبَة (female student)',
  },
  {
    title: 'The Definite Article',
    tip: 'Use الْـ (al-) to mean "the".',
    sample: 'كِتَاب = a book, الْكِتَاب = the book',
  },
  {
    title: 'Simple Possession',
    tip: 'Attach pronoun endings for possession.',
    sample: 'كِتَابِي = my book, كِتَابُكَ = your book',
  },
];

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

const letterNamesArabic: Record<string, string> = {
  'ا': 'أَلِف', 'ب': 'بَاء', 'ت': 'تَاء', 'ث': 'ثَا', 'ج': 'جِييم',
  'ح': 'حَ', 'خ': 'خَاي', 'د': 'دَال', 'ذ': 'ذَال', 'ر': 'رَاا',
  'ز': 'زَاا', 'س': 'سِيين', 'ش': 'شِيين', 'ص': 'صَاد', 'ض': 'ضَاد',
  'ط': 'طَاء', 'ظ': 'ظَاء', 'ع': 'عَيْن', 'غ': 'غَيْن', 'ف': 'فَاا',
  'ق': 'قَاءف', 'ك': 'كَاف', 'ل': 'لَام', 'م': 'مِييم', 'ن': 'نُوون',
  'ه': 'هَا', 'و': 'وَاو', 'ي': 'يَا'
};

export default function LearnScreen() {
  const router = useRouter();
  const [expandedLetter, setExpandedLetter] = useState<number | null>(null);
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const backgroundColor = colorScheme === 'dark' ? '#000' : '#F2F2F7';
  const cardBg = colorScheme === 'dark' ? '#1C1C1E' : '#FFF';
  const textColor = theme.text;
  const mutedTextColor = colorScheme === 'dark' ? '#B8B8BE' : '#555';
  const subTextColor = '#8E8E93';

  const [playingId, setPlayingId] = useState<string | null>(null);
  const currentPlayerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);
  const currentWebPlayerRef = useRef<HTMLAudioElement | null>(null);

  const stopPlayingAudio = () => {
    if (currentPlayerRef.current) {
      currentPlayerRef.current.remove();
      currentPlayerRef.current = null;
    }
    if (currentWebPlayerRef.current) {
      currentWebPlayerRef.current.pause();
      currentWebPlayerRef.current.currentTime = 0;
      currentWebPlayerRef.current = null;
    }
    setPlayingId(null);
  };

  const playAudio = async (text: string, id: string, rate: string = '-10%') => {
    if (playingId === id) {
      stopPlayingAudio();
      return;
    }
    stopPlayingAudio();

    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch (e) {
      console.warn('Failed to set audio mode:', e);
    }

    setPlayingId(id);

    try {
      if (Platform.OS === 'web') {
        const response = await fetch(`${BACKEND_URL}/tts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, voice: 'ar-SA-HamedNeural', rate }), 
        });
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentWebPlayerRef.current = audio;
        audio.onended = () => { setPlayingId(null); URL.revokeObjectURL(url); };
        audio.play();
      } else {
        const ttsUrl = `${BACKEND_URL}/tts?text=${encodeURIComponent(text)}&voice=ar-SA-HamedNeural&rate=${encodeURIComponent(rate)}`;
        const player = createAudioPlayer({ uri: ttsUrl });
        currentPlayerRef.current = player;
        player.play();

        let hasStartedPlaying = false;
        let checkCount = 0;

        const checkInterval = setInterval(() => {
          if (currentPlayerRef.current !== player || playingId !== id) {
            clearInterval(checkInterval);
            return;
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
              setPlayingId(null);
            }
          }
        }, 250);
      }
    } catch (error) {
      console.error('TTS error:', error);
      setPlayingId(null);
    }
  };

  const handleStartDrills = () => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: 'drills', title: 'Practice Drills' },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.headerTitle, { color: textColor }]}>Arabic Learning Lab</Text>
        <Text style={[styles.headerSubtitle, { color: subTextColor }]}>
          Beginner-friendly vocabulary and sentence practice inspired by a Madinah-style progression.
        </Text>

        <View style={styles.noticeCard}>
          <Ionicons name="school-outline" size={18} color="#001219" />
          <Text style={styles.noticeText}>
            Original study material organized around topics commonly introduced in early Arabic curricula.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: textColor }]}>Fundamentals</Text>
        {fundamentals.map((item, idx) => (
          <View key={idx} style={[styles.fundamentalCard, { backgroundColor: cardBg }]}>
            <View style={styles.fundamentalIcon}>
              <Ionicons name={item.icon as any} size={20} color="#007AFF" />
            </View>
            <View style={styles.fundamentalText}>
              <Text style={[styles.fundamentalTitle, { color: textColor }]}>{item.title}</Text>
              <Text style={[styles.fundamentalDesc, { color: mutedTextColor }]}>{item.desc}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: textColor }]}>Arabic Alphabet</Text>
        <Text style={[styles.sectionSub, { color: subTextColor }]}>Tap a letter to see all its forms</Text>
        <View style={styles.letterGrid}>
          {arabicLetters.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.letterCard,
                { backgroundColor: cardBg, borderColor: colorScheme === 'dark' ? '#2A2A2C' : '#F0F0F0' },
                expandedLetter === idx && styles.letterCardExpanded,
              ]}
              onPress={() => setExpandedLetter(expandedLetter === idx ? null : idx)}
              activeOpacity={0.7}
            >
              <Text style={styles.letterArabic}>{item.letter}</Text>
              <Text style={[styles.letterName, { color: textColor }]}>{item.name}</Text>
              <Text style={[styles.letterSound, { color: subTextColor }]}>/{item.sound}/</Text>

              <TouchableOpacity 
                style={styles.playIconBtn}
                onPress={(e) => { 
                  e.stopPropagation(); 
                  const textToSpeak = letterNamesArabic[item.letter] || item.letter;
                  playAudio(textToSpeak, `letter-${idx}`, '-20%'); 
                }}
              >
                <Ionicons 
                  name={playingId === `letter-${idx}` ? "stop-circle" : "volume-medium"} 
                  size={18} 
                  color={playingId === `letter-${idx}` ? '#FF3B30' : '#007AFF'} 
                />
              </TouchableOpacity>

              {expandedLetter === idx && (
                <View style={styles.formsContainer}>
                  <View style={styles.formRow}>
                    <Text style={[styles.formLabel, { color: mutedTextColor }]}>Isolated</Text>
                    <Text style={styles.formArabic}>{item.forms.isolated}</Text>
                  </View>
                  <View style={styles.formRow}>
                    <Text style={[styles.formLabel, { color: mutedTextColor }]}>Initial</Text>
                    <Text style={styles.formArabic}>{item.forms.initial}</Text>
                  </View>
                  <View style={styles.formRow}>
                    <Text style={[styles.formLabel, { color: mutedTextColor }]}>Medial</Text>
                    <Text style={styles.formArabic}>{item.forms.medial}</Text>
                  </View>
                  <View style={styles.formRow}>
                    <Text style={[styles.formLabel, { color: mutedTextColor }]}>Final</Text>
                    <Text style={styles.formArabic}>{item.forms.final}</Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: textColor }]}>Learning Path</Text>
        {modules.map((module) => (
          <View key={module.id} style={[styles.moduleCard, { backgroundColor: cardBg }]}>
            <View style={[styles.moduleBadge, { backgroundColor: module.color }]} />
            <View style={styles.moduleContent}>
              <Text style={[styles.moduleTitle, { color: textColor }]}>{module.title}</Text>
              <Text style={[styles.moduleFocus, { color: subTextColor }]}>{module.focus}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: textColor }]}>Vocabulary Bank</Text>
        {vocabByTheme.map((themeItem) => (
          <View key={themeItem.title} style={[styles.blockCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.blockTitle, { color: textColor }]}>{themeItem.title}</Text>
            {themeItem.words.map((word) => (
              <View key={`${themeItem.title}-${word.ar}`} style={styles.wordRow}>
                <Text style={styles.wordArabic}>{word.ar}</Text>

                <TouchableOpacity 
                  style={styles.inlinePlayBtn}
                  onPress={() => playAudio(word.ar, `vocab-${word.ar}`, '-40%')}
                >
                  <Ionicons 
                    name={playingId === `vocab-${word.ar}` ? "stop-circle" : "volume-medium"} 
                    size={20} 
                    color={playingId === `vocab-${word.ar}` ? '#FF3B30' : '#007AFF'} 
                  />
                </TouchableOpacity>

                <View style={styles.wordMeta}>
                  <Text style={[styles.wordEnglish, { color: textColor }]}>{word.en}</Text>
                  <Text style={[styles.wordTranslit, { color: subTextColor }]}>{word.tr}</Text>
                </View>
              </View>
            ))}
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: textColor }]}>Sentence Studio</Text>
        {sentencePatterns.map((pattern) => (
          <View key={pattern.title} style={[styles.blockCard, { backgroundColor: cardBg }]}>
            <Text style={[styles.blockTitle, { color: textColor }]}>{pattern.title}</Text>
            <Text style={styles.formula}>{pattern.formula}</Text>
            {pattern.examples.map((ex) => (
              <View key={`${pattern.title}-${ex.ar}`} style={styles.exampleCard}>
                
                <View style={styles.sentenceHeaderRow}>
                  <Text style={styles.exampleArabic}>{ex.ar}</Text>
                  
                  <TouchableOpacity onPress={() => playAudio(ex.ar, `sentence-${ex.ar}`)}>
                    <Ionicons 
                      name={playingId === `sentence-${ex.ar}` ? "stop-circle" : "volume-medium"} 
                      size={20} 
                      color={playingId === `sentence-${ex.ar}` ? '#FF3B30' : '#007AFF'} 
                    />
                  </TouchableOpacity>
                </View>

                <Text style={[styles.exampleEnglish, { color: subTextColor }]}>{ex.en}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: textColor }]}>Grammar Quick Bits</Text>
        {grammarQuickBits.map((bit) => (
          <View key={bit.title} style={[styles.quickBitCard, { backgroundColor: cardBg }]}>
            <Ionicons name="flash-outline" size={18} color="#CA6702" />
            <View style={styles.quickBitTextWrap}>
              <Text style={[styles.quickBitTitle, { color: textColor }]}>{bit.title}</Text>
              <Text style={[styles.quickBitTip, { color: subTextColor }]}>{bit.tip}</Text>
              <Text style={styles.quickBitSample}>{bit.sample}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionTitle, { color: textColor }]}>Drills</Text>
        <TouchableOpacity style={styles.drillStartCard} onPress={handleStartDrills} activeOpacity={0.8}>
          <View style={styles.drillStartContent}>
            <Ionicons name="play-circle-outline" size={32} color="#007AFF" />
            <View style={styles.drillStartText}>
              <Text style={[styles.drillStartTitle, { color: textColor }]}>Start Practice Drill</Text>
              <Text style={[styles.drillStartDesc, { color: subTextColor }]}>Test your skills with interactive drills. Type or speak your answers!</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#007AFF" />
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
    marginBottom: 14,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#E9F5F6',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#001219',
    lineHeight: 18,
  },
  moduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  moduleBadge: {
    width: 8,
    height: 44,
    borderRadius: 6,
    marginRight: 12,
  },
  moduleContent: {
    flex: 1,
  },
  moduleTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  moduleFocus: {
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 18,
  },
  sectionSub: {
    fontSize: 14,
    marginBottom: 16,
    marginTop: -6,
  },
  fundamentalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  fundamentalIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#EBF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  fundamentalText: {
    flex: 1,
  },
  fundamentalTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  fundamentalDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  letterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  letterCard: {
    width: '30%',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  letterCardExpanded: {
    width: '100%',
    backgroundColor: '#EBF2FF',
    borderColor: '#007AFF',
  },
  letterArabic: {
    fontSize: 36,
    color: '#001219',
    fontWeight: '500',
  },
  letterName: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  letterSound: {
    fontSize: 12,
    marginTop: 2,
  },
  formsContainer: {
    marginTop: 12,
    width: '100%',
    gap: 6,
  },
  formRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  formLabel: {
    fontSize: 13,
  },
  formArabic: {
    fontSize: 28,
    color: '#001219',
  },
  blockCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#D6D6D6',
  },
  wordArabic: {
    width: 110,
    fontSize: 24,
    color: '#001219',
    textAlign: 'right',
  },
  wordMeta: {
    flex: 1,
    marginLeft: 10,
  },
  wordEnglish: {
    fontSize: 15,
    fontWeight: '600',
  },
  wordTranslit: {
    fontSize: 13,
    marginTop: 2,
  },
  formula: {
    color: '#0A9396',
    fontWeight: '700',
    marginBottom: 8,
  },
  exampleCard: {
    backgroundColor: '#F0FBFC',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  exampleArabic: {
    fontSize: 22,
    color: '#001219',
    textAlign: 'right',
    marginBottom: 4,
  },
  exampleEnglish: {
    fontSize: 13,
  },
  quickBitCard: {
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  quickBitTextWrap: {
    flex: 1,
  },
  quickBitTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  quickBitTip: {
    fontSize: 13,
    marginBottom: 4,
  },
  quickBitSample: {
    fontSize: 13,
    color: '#005F73',
    fontWeight: '600',
  },
  drillStack: {
    gap: 10,
    marginBottom: 8,
  },
  drillStartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#EBF2FF',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#007AFF',
    gap: 12,
  },
  drillStartContent: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    gap: 12,
  },
  drillStartText: {
    flex: 1,
  },
  drillStartTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  drillStartDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  drillCard: {
    borderRadius: 14,
    padding: 14,
  },
  drillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  drillBadge: {
    fontSize: 12,
    color: '#005F73',
    fontWeight: '700',
    backgroundColor: '#E9F5F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  drillPrompt: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  drillAnswerLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  drillAnswer: {
    fontSize: 20,
    color: '#001219',
    textAlign: 'right',
  },

  playIconBtn: {
    marginTop: 8,
    padding: 4,
  },
  inlinePlayBtn: {
    paddingHorizontal: 10,
  },
  sentenceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
});
