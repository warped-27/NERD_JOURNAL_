import { useFonts } from 'expo-font';
import { Stack, Slot } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme, View, StatusBar } from 'react-native';
import { Palette } from '../constants/Colors';
import AuthGuard from '../components/AuthGuard';
import 'react-native-reanimated';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Impedisce alla splash screen di nascondersi automaticamente
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'), // Mantiene il font di default del template
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  // Usiamo l'hook nativo direttamente da react-native per massima stabilità
  const systemColorScheme = useColorScheme();
  const isDark = systemColorScheme === 'dark';
  const currentTheme = isDark ? Palette.dark : Palette.light;

  return (
    <View style={{ flex: 1, backgroundColor: currentTheme.background }}>
      {/* Configurazione della barra di stato in contrasto con lo sfondo di sistema */}
      <StatusBar 
        barStyle={isDark ? 'light-content' : 'dark-content'} 
        backgroundColor={currentTheme.background}
      />
      
      {/* Avvolgiamo la navigazione con l'AuthGuard Zero-Knowledge */}
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
      </AuthGuard>
    </View>
  );
}