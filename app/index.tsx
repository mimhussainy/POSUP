import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useLanguage } from '../lib/LanguageContext';
import { appFont } from '../lib/fonts';
import { colors, borders, radii, fontSizes, fontWeights } from '../lib/theme';

const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';

const PRIMARY = colors.primary;
const APP_BG = colors.appBg;
const CARD_BG = colors.cardBg;
const BORDER = colors.borderStrong;
const FIELD_BORDER = colors.fieldBorder;
const BORDER_FOCUS = colors.borderFocus;
const FIELD_BG = colors.fieldBg;
const TEXT = colors.text;
const MUTED = colors.muted;
const PLACEHOLDER = colors.placeholder;

export default function LoginScreen() {
  const { t } = useLanguage();

  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [focusedField, setFocusedField] = useState<'code' | 'pin' | null>(null);

  useEffect(() => {
    AsyncStorage.getItem('prefill_restaurant_code').then(prefill => {
      if (prefill) {
        setCode(prefill);
        AsyncStorage.removeItem('prefill_restaurant_code');
      }
    });
  }, []);

  useEffect(() => {
    checkSavedLogin();
  }, []);

  async function checkSavedLogin() {
    try {
      const savedCode = await AsyncStorage.getItem('restaurant_code');
      const savedPin = await AsyncStorage.getItem('owner_pin');

      if (savedCode && savedPin) {
        router.replace('/(tabs)/orders');
        return;
      }
    } catch (e) {
      console.log('Failed to check saved login', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!code.trim() || !pin.trim()) {
      Alert.alert('Error', t.enterCodeAndPin);
      return;
    }

    setLogging(true);

    try {
      const cleanCode = code.trim().toLowerCase();
      const cleanPin = pin.trim();

      const res = await fetch(`${BACKEND}/posup/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: cleanCode, pin: cleanPin }),
      });

      const data = await res.json();

      if (data.success) {
        await AsyncStorage.setItem('restaurant_code', cleanCode);
        await AsyncStorage.setItem('owner_pin', cleanPin);

        if (data.name) {
          await AsyncStorage.setItem('restaurant_name', data.name);
        }

        if (data.logo_url) {
          await AsyncStorage.setItem('restaurant_logo', data.logo_url);
        }

        router.replace('/(tabs)/orders');
      } else {
        Alert.alert('Error', data.error || t.invalidCodeOrPin);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not connect. Check your internet connection.');
    } finally {
      setLogging(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Image
            source={require('../assets/FoodupPOS-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.titleBlock}>
            <Text style={styles.title}>Restaurant Login</Text>
            <Text style={styles.subtitle}>Sign in to your POS system</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>{t.restaurantCode}</Text>
            <View
              style={[
                styles.inputBox,
                focusedField === 'code' && styles.inputBoxFocused,
              ]}
            >
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder={t.restaurantCode}
                placeholderTextColor={PLACEHOLDER}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onFocus={() => setFocusedField('code')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <Text style={styles.label}>{t.ownerPin}</Text>
            <View
              style={[
                styles.inputBox,
                focusedField === 'pin' && styles.inputBoxFocused,
              ]}
            >
              <TextInput
                style={styles.input}
                value={pin}
                onChangeText={setPin}
                placeholder={t.ownerPin || 'PIN'}
                placeholderTextColor={PLACEHOLDER}
                secureTextEntry
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                onFocus={() => setFocusedField('pin')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <TouchableOpacity
              style={[styles.button, logging && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={logging}
              activeOpacity={0.88}
            >
              {logging ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>{t.signIn}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: Platform.OS === 'android' ? 24 : 32,
  },

  center: {
    flex: 1,
    backgroundColor: APP_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },

  loadingBox: {
    width: 64,
    height: 64,
    borderRadius: radii.huge,
    backgroundColor: CARD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: CARD_BG,
    borderRadius: radii.giant,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingHorizontal: 26,
    paddingTop: 30,
    paddingBottom: 28,
  },

  logo: {
    alignSelf: 'center',
    width: 178,
    height: 72,
    marginBottom: 22,
  },

  titleBlock: {
    alignItems: 'center',
    marginBottom: 30,
  },

  title: {
    fontSize: fontSizes.giant,
    fontWeight: fontWeights.bold,
    color: TEXT,
    textAlign: 'center',
    letterSpacing: -0.35,
    fontFamily: appFont,
  },

  subtitle: {
    fontSize: fontSizes.lg,
    color: MUTED,
    marginTop: 8,
    textAlign: 'center',
    fontWeight: fontWeights.regular,
    fontFamily: appFont,
  },

  form: {
    width: '100%',
  },

  label: {
    fontSize: fontSizes.md,
    color: MUTED,
    fontWeight: fontWeights.medium,
    marginBottom: 8,
    marginLeft: 2,
    fontFamily: appFont,
  },

  inputBox: {
    minHeight: 54,
    backgroundColor: FIELD_BG,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    marginBottom: 17,
    justifyContent: 'center',
  },

  inputBoxFocused: {
    backgroundColor: CARD_BG,
    borderColor: BORDER_FOCUS,
  },

  input: {
    minHeight: 54,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 15 : 12,
    fontSize: fontSizes.lgl,
    color: TEXT,
    fontWeight: fontWeights.regular,
    fontFamily: appFont,
  },

  button: {
    minHeight: 54,
    borderRadius: radii.xl,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: fontSizes.lgl,
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
  },
});