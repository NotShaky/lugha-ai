import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- Arabic Alphabet Data ---
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

const fundamentals = [
  { title: 'Writing Direction', icon: 'arrow-back', desc: 'Arabic is written and read from right to left (RTL).' },
  { title: 'Letter Forms', icon: 'swap-horizontal', desc: 'Most letters change shape depending on their position in a word: initial, medial, final, or isolated.' },
  { title: 'Vowels (Harakat)', icon: 'musical-note', desc: 'Short vowels are diacritical marks placed above or below letters: Fatha (َ), Kasra (ِ), Damma (ُ).' },
  { title: 'Connecting Letters', icon: 'link', desc: 'Most Arabic letters connect to the next letter. Six letters (ا د ذ ر ز و) only connect to the right.' },
  { title: 'Shadda (ّ)', icon: 'layers', desc: 'A doubled consonant, shown by the mark ّ above a letter. It makes the letter sound stronger.' },
  { title: 'Sukoon (ْ)', icon: 'remove-circle', desc: 'A small circle above a letter meaning no vowel follows that consonant.' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'learn' | 'chat'>('learn');
  const [expandedLetter, setExpandedLetter] = useState<number | null>(null);

  const handleOpenChat = () => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: 'chat-bot', title: 'Lugha AI Chat' },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Text style={styles.header}>Lugha AI</Text>

      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'learn' && styles.tabActive]}
          onPress={() => setActiveTab('learn')}
        >
          <Ionicons name="book" size={18} color={activeTab === 'learn' ? '#007AFF' : '#8E8E93'} />
          <Text style={[styles.tabText, activeTab === 'learn' && styles.tabTextActive]}>Learn</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
          onPress={() => setActiveTab('chat')}
        >
          <Ionicons name="chatbubbles" size={18} color={activeTab === 'chat' ? '#007AFF' : '#8E8E93'} />
          <Text style={[styles.tabText, activeTab === 'chat' && styles.tabTextActive]}>Chat</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'learn' ? (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Fundamentals Section */}
          <Text style={styles.sectionTitle}>Fundamentals</Text>
          {fundamentals.map((item, idx) => (
            <View key={idx} style={styles.fundamentalCard}>
              <View style={styles.fundamentalIcon}>
                <Ionicons name={item.icon as any} size={20} color="#007AFF" />
              </View>
              <View style={styles.fundamentalText}>
                <Text style={styles.fundamentalTitle}>{item.title}</Text>
                <Text style={styles.fundamentalDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}

          {/* Alphabet Section */}
          <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Arabic Alphabet</Text>
          <Text style={styles.sectionSub}>Tap a letter to see all its forms</Text>
          <View style={styles.letterGrid}>
            {arabicLetters.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.letterCard, expandedLetter === idx && styles.letterCardExpanded]}
                onPress={() => setExpandedLetter(expandedLetter === idx ? null : idx)}
                activeOpacity={0.7}
              >
                <Text style={styles.letterArabic}>{item.letter}</Text>
                <Text style={styles.letterName}>{item.name}</Text>
                <Text style={styles.letterSound}>/{item.sound}/</Text>
                {expandedLetter === idx && (
                  <View style={styles.formsContainer}>
                    <View style={styles.formRow}>
                      <Text style={styles.formLabel}>Isolated</Text>
                      <Text style={styles.formArabic}>{item.forms.isolated}</Text>
                    </View>
                    <View style={styles.formRow}>
                      <Text style={styles.formLabel}>Initial</Text>
                      <Text style={styles.formArabic}>{item.forms.initial}</Text>
                    </View>
                    <View style={styles.formRow}>
                      <Text style={styles.formLabel}>Medial</Text>
                      <Text style={styles.formArabic}>{item.forms.medial}</Text>
                    </View>
                    <View style={styles.formRow}>
                      <Text style={styles.formLabel}>Final</Text>
                      <Text style={styles.formArabic}>{item.forms.final}</Text>
                    </View>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
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
      )}
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
    paddingBottom: 8,
    color: '#000',
  },
  // --- Tab Bar ---
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 4,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#8E8E93',
  },
  tabTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  // --- Learn Tab ---
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  sectionSub: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 16,
    marginTop: -6,
  },
  // Fundamentals
  fundamentalCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9F9FB',
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
    color: '#000',
    marginBottom: 4,
  },
  fundamentalDesc: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  // Letter Grid
  letterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  letterCard: {
    width: '30%',
    backgroundColor: '#F9F9FB',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  letterCardExpanded: {
    width: '100%',
    backgroundColor: '#EBF2FF',
    borderColor: '#007AFF',
  },
  letterArabic: {
    fontSize: 36,
    color: '#000',
    fontWeight: '500',
  },
  letterName: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
    marginTop: 4,
  },
  letterSound: {
    fontSize: 12,
    color: '#8E8E93',
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
    color: '#555',
  },
  formArabic: {
    fontSize: 28,
    color: '#000',
  },
  // --- Chat Tab ---
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
