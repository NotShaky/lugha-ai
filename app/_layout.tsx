import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/utils/supabase';
import { Session } from '@supabase/supabase-js';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  
  // --- New Auth State ---
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  
  const segments = useSegments();
  const router = useRouter();

  // 1. Fetch the initial session and listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Control the Routing
  useEffect(() => {
    // Only redirect once fonts and auth are fully loaded
    if (loaded && isAuthReady) {
      SplashScreen.hideAsync();
      
      // Check if the user is currently on the auth screen
      const inAuthGroup = segments[0] === 'auth';
      
      // If user is NOT logged in and NOT on the auth screen, kick them to auth
      if (!session && !inAuthGroup) {
        router.replace('/auth');
      } 
      // If user IS logged in and trying to view the auth screen, send them to tabs
      else if (session && inAuthGroup) {
        router.replace('/(tabs)');
      }
    }
  }, [session, loaded, isAuthReady, segments]);

  if (!loaded || !isAuthReady) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth" options={{ headerShown: false }} />
        <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
      </Stack>
    </ThemeProvider>
  );
}