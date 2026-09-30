import '../global.css';

// Per-weight entry points: the package index would bundle every weight.
import { EBGaramond_500Medium } from '@expo-google-fonts/eb-garamond/500Medium';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { useCatalogSeed } from '@/hooks/useCatalogSeed';

// Splash calls reject when no native splash is showing (e.g. after a reload); nothing to recover.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({ EBGaramond_500Medium, Poppins_400Regular, Poppins_600SemiBold });
  // A font error falls back to system fonts rather than blocking the app.
  const ready = loaded || error != null;
  useCatalogSeed(ready);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  // Navigator option: className cannot reach the stack card behind each screen.
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#1A2334' } }} />
    </>
  );
}
