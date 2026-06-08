import { Stack } from 'expo-router';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
  JetBrainsMono_800ExtraBold,
} from '@expo-google-fonts/jetbrains-mono';
import '../src/lib/polyfills';
import { VaultProvider }  from '../src/crypto/VaultContext';
import { AuthGuard }      from '../src/components/AuthGuard';
import { AiProvider }     from '../src/ai/AiContext';
import { NotesProvider }  from '../src/notes/NotesContext';
import { SyncProvider }   from '../src/sync/SyncContext';

SplashScreen.preventAutoHideAsync();

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // JetBrains Mono — primary typeface
    'JetBrainsMono':       JetBrainsMono_400Regular,
    'JetBrainsMono-Bold':  JetBrainsMono_700Bold,
    'JetBrainsMono-Black': JetBrainsMono_800ExtraBold,
    // SpaceMono — fallback
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <VaultProvider>
      <AiProvider>
        <SyncProvider>
        <AuthGuard>
          <NotesProvider>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)"    />
              <Stack.Screen name="note/[id]" />
              <Stack.Screen name="settings"  />
            </Stack>
          </NotesProvider>
        </AuthGuard>
        </SyncProvider>
      </AiProvider>
    </VaultProvider>
  );
}
