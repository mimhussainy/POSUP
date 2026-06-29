import { Stack } from 'expo-router';
import { StatusBar, Platform, View, ActivityIndicator, Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { LanguageProvider } from '../lib/LanguageContext';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
  });

  

  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' }}>
        <ActivityIndicator size="large" color="#8B38CB" />
      </View>
    );
  }

  if (fontError) {
    console.log('Ionicons font failed to load:', fontError);
  }

  return (
    <LanguageProvider>
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" translucent={false} />
        <SafeAreaView style={{ flex: 1, paddingTop: Platform.OS === 'web' ? 0 : 20 }} edges={[]}>
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
        </SafeAreaView>
      </GestureHandlerRootView>
    </SafeAreaProvider>
    </LanguageProvider>
  );
}