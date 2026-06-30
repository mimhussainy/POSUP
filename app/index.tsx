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

const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';

const PRIMARY = '#8B38CB';
const PRIMARY_SOFT = '#F6EEFF';
const APP_BG = '#F1F3F7';
const CARD_BG = '#FFFFFF';
const BORDER = '#DEE3EC';
const TEXT = '#171725';
const MUTED = '#7A7F8C';
const SOFT_TEXT = '#5F6572';

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
        <View style={styles.loadingCard}>
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
        <View style={styles.loginCard}>
          <View style={styles.logoWrap}>
            <Image
              source={require('../assets/FoodupPOS-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          <View style={styles.titleBlock}>
            <Text style={styles.kicker}>POSUP</Text>
            <Text style={styles.title}>Restaurant Login</Text>
            <Text style={styles.sub}>Sign in to your restaurant POS system</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>{t.restaurantCode}</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder={t.restaurantCode}
                placeholderTextColor="#9BA1AE"
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
                placeholderTextColor="#9BA1AE"
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
    paddingHorizontal: 18,
    paddingVertical: 28,
  },

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

    shadowColor: '#111827',
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
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
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },

  logoWrap: {
    alignSelf: 'center',
    width: 190,
    height: 76,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },

  logo: {
    width: 180,
    height: 72,
  },

  titleBlock: {
    alignItems: 'center',
    marginBottom: 26,
  },

  kicker: {
    fontSize: 10,
    fontWeight: '800',
    color: PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: appFont,
    marginBottom: 4,
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
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEF0F5',
  },

  footerText: {
    fontSize: 12,
    color: '#A0A4AE',
    fontWeight: '700',
    fontFamily: appFont,
  },
});