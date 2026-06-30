import { Stack } from 'expo-router';
import { StatusBar, View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { Ionicons } from '@expo/vector-icons';
import { LanguageProvider } from '../lib/LanguageContext';

const APP_BG = '#F7F8FB';
const PRIMARY = '#8B38CB';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
  });

  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  if (fontError) {
    console.log('Ionicons font failed to load:', fontError);
  }

  return (
    <LanguageProvider>
      <SafeAreaProvider>
        <GestureHandlerRootView style={styles.root}>
          <StatusBar
            barStyle="dark-content"
            backgroundColor={APP_BG}
            translucent={false}
          />

          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: APP_BG,
              },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  loadingScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_BG,
  },
});