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

const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';

const PRIMARY = '#8B38CB';
const APP_BG = '#F6F7F9';
const FIELD_BG = '#FFFFFF';
const FIELD_BORDER = '#E5E7EE';
const FIELD_FOCUSED = '#CDAAF0';
const TEXT = '#1D1D1F';
const MUTED = '#737985';
const PLACEHOLDER = '#A5ABB5';

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
        <ActivityIndicator size="large" color={PRIMARY} />
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
        <View style={styles.content}>
          <Image
            source={require('../assets/FoodupPOS-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.titleBlock}>
            <Text style={styles.title}>Restaurant Login</Text>
            <Text style={styles.sub}>Sign in to continue</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>{t.restaurantCode}</Text>
            <View
              style={[
                styles.inputWrap,
                focusedField === 'code' && styles.inputWrapFocused,
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
                onFocus={() => setFocusedField('code')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <Text style={styles.label}>{t.ownerPin}</Text>
            <View
              style={[
                styles.inputWrap,
                focusedField === 'pin' && styles.inputWrapFocused,
              ]}
            >
              <TextInput
                style={styles.input}
                value={pin}
                onChangeText={setPin}
                placeholder={t.ownerPin || 'PIN'}
                placeholderTextColor={PLACEHOLDER}
                secureTextEntry
                keyboardType="default"
                onFocus={() => setFocusedField('pin')}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, logging && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={logging}
              activeOpacity={0.9}
            >
              {logging ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>{t.signIn}</Text>
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
    paddingHorizontal: 24,
    paddingVertical: Platform.OS === 'android' ? 24 : 32,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: APP_BG,
  },

  content: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'stretch',
  },

  logo: {
    alignSelf: 'center',
    width: 174,
    height: 70,
    marginBottom: 24,
  },

  titleBlock: {
    alignItems: 'center',
    marginBottom: 30,
  },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT,
    textAlign: 'center',
    letterSpacing: -0.3,
  },

  sub: {
    fontSize: 15,
    color: MUTED,
    marginTop: 8,
    fontWeight: '400',
    textAlign: 'center',
  },

  form: {
    width: '100%',
  },

  label: {
    fontSize: 13,
    fontWeight: '500',
    color: MUTED,
    marginBottom: 8,
    marginLeft: 2,
  },

  inputWrap: {
    backgroundColor: FIELD_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: FIELD_BORDER,
    borderRadius: 14,
    marginBottom: 17,
  },

  inputWrapFocused: {
    borderColor: FIELD_FOCUSED,
  },

  input: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 15 : 12,
    fontSize: 16,
    color: TEXT,
    fontWeight: '400',
  },

  btn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },

  btnDisabled: {
    opacity: 0.65,
  },

  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});