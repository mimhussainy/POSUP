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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useLanguage } from '../lib/LanguageContext';
import { appFont } from '../lib/fonts';

const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';

const PRIMARY = '#8B38CB';
const PRIMARY_SOFT = '#F6EEFF';
const APP_BG = '#F7F8FB';
const CARD_BG = '#FFFFFF';
const BORDER = '#ECEEF3';
const TEXT = '#171725';
const MUTED = '#7A7F8C';

export default function LoginScreen() {
  const { t } = useLanguage();

  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);

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
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.backgroundCircleTop} />
      <View style={styles.backgroundCircleBottom} />

      <View style={styles.loginCard}>
        <View style={styles.logoBox}>
          <Image
            source={require('../assets/FoodupPOS-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.sub}>Sign in to your restaurant POS system</Text>

        <View style={styles.form}>
          <Text style={styles.label}>{t.restaurantCode}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder={t.restaurantCode}
              placeholderTextColor="#A8ACB7"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <Text style={styles.label}>{t.ownerPin}</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              placeholder={t.ownerPin || 'PIN'}
              placeholderTextColor="#A8ACB7"
              secureTextEntry
              keyboardType="default"
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, logging && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={logging}
            activeOpacity={0.82}
          >
            {logging ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>{t.signIn}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Powered by FoodUp.ch</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_BG,
  },

  loadingCard: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },

  container: {
    flex: 1,
    backgroundColor: APP_BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    overflow: 'hidden',
  },

  backgroundCircleTop: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: PRIMARY_SOFT,
    top: -150,
    right: -120,
  },

  backgroundCircleBottom: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#EEF0F5',
    bottom: -120,
    left: -100,
  },

  loginCard: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: CARD_BG,
    borderRadius: 26,
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: BORDER,

    shadowColor: '#111827',
    shadowOpacity: 0.06,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },

  logoBox: {
    alignSelf: 'center',
    width: 190,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  logo: {
    width: 180,
    height: 78,
  },

  title: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'center',
    fontFamily: appFont,
  },

  sub: {
    fontSize: 13,
    color: MUTED,
    marginTop: 6,
    marginBottom: 26,
    fontWeight: '600',
    fontFamily: appFont,
    textAlign: 'center',
  },

  form: {
    width: '100%',
  },

  label: {
    fontSize: 11,
    fontWeight: '800',
    color: MUTED,
    marginBottom: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: appFont,
  },

  inputWrap: {
    backgroundColor: '#FAFAFC',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 16,
    marginBottom: 15,
  },

  input: {
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 15,
    color: TEXT,
    fontFamily: appFont,
    fontWeight: '700',
  },

  btn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    minHeight: 52,
  },

  btnDisabled: {
    opacity: 0.72,
  },

  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: appFont,
  },

  footer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },

  footerText: {
    fontSize: 12,
    color: '#A0A4AE',
    fontWeight: '700',
    fontFamily: appFont,
  },
});