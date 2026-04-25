import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useColorScheme } from '../hooks/useColorScheme';
import { supabase } from '../utils/supabase';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  async function continueWithEmail() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Info', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!signInError) {
        router.replace('/(tabs)');
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (!signUpError) {
        if (signUpData?.session) {
          router.replace('/(tabs)');
        } else {
          Alert.alert(
            'Check Your Email',
            'We sent a confirmation email. Open the link in your inbox to verify your account, then sign in.'
          );
        }
        return;
      }

      const msg = signUpError.message.toLowerCase();
      if (msg.includes('already registered') || msg.includes('already exists')) {
        Alert.alert('Sign In Failed', 'This email is already registered. Please check your password and try again.');
        return;
      }

      Alert.alert('Auth Error', signUpError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={styles.card}>
        <Text style={[styles.title, { color: theme.text }]}>Welcome to Lugha</Text>
        <Text style={styles.subtitle}>Sign in or create an account to save your progress.</Text>

        <TextInput
          style={[styles.input, { color: theme.text, borderColor: colorScheme === 'dark' ? '#333' : '#E5E5EA' }]}
          onChangeText={(text) => setEmail(text)}
          value={email}
          placeholder="email@address.com"
          placeholderTextColor="#8E8E93"
          autoCapitalize={'none'}
          keyboardType="email-address"
        />
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: colorScheme === 'dark' ? '#333' : '#E5E5EA' }]}
          onChangeText={(text) => setPassword(text)}
          value={password}
          secureTextEntry={true}
          placeholder="Password"
          placeholderTextColor="#8E8E93"
          autoCapitalize={'none'}
        />

        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#007AFF' }]} 
          disabled={loading} 
          onPress={continueWithEmail}
        >
          <Text style={styles.buttonText}>{loading ? 'Please wait...' : 'Sign In / Create Account'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  card: { padding: 20, borderRadius: 16, gap: 16 },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#8E8E93', textAlign: 'center', marginBottom: 24 },
  input: { borderWidth: 1, padding: 16, borderRadius: 12, fontSize: 16 },
  button: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});