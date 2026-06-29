import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useLanguage } from '../lib/LanguageContext';

export default function LoginScreen() {
  const { t } = useLanguage();
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);

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
    } catch (e) {}
    setLoading(false);
  }

  async function handleLogin() {
    if (!code.trim() || !pin.trim()) {
      Alert.alert('Error', t.enterCodeAndPin);
      return;
    }
    setLogging(true);
    try {
      const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';
      const res = await fetch(`${BACKEND}/posup/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim().toLowerCase(), pin: pin.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        await AsyncStorage.setItem('restaurant_code', code.trim().toLowerCase());
        await AsyncStorage.setItem('owner_pin', pin.trim());
        if (data.name) await AsyncStorage.setItem('restaurant_name', data.name);
        if (data.logo_url) await AsyncStorage.setItem('restaurant_logo', data.logo_url);
        router.replace('/(tabs)/orders');
      } else {
        Alert.alert('Error', data.error || t.invalidCodeOrPin);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not connect. Check your internet connection.');
    }
    setLogging(false);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#7c5cfc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.box}>
        <Image source={require('../assets/FoodupPOS-logo.png')} style={{ width: 180, height: 80, marginBottom: 8 }} resizeMode="contain" />
        <Text style={styles.sub}>Restaurant Point of Sale</Text>

        <Text style={styles.label}>{t.restaurantCode}</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="e.g. eatime"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>{t.ownerPin}</Text>
        <TextInput
          style={styles.input}
          value={pin}
          onChangeText={setPin}
          placeholder="Enter PIN"
          secureTextEntry
          keyboardType="numeric"
        />

        <TouchableOpacity
          style={styles.btn}
          onPress={handleLogin}
          disabled={logging}
        >
          {logging
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>{t.signIn}</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 40,
    width: 400,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  sub: {
    fontSize: 14,
    color: '#888',
    marginBottom: 32,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    marginBottom: 16,
    color: '#111',
  },
  btn: {
    backgroundColor: '#7c5cfc',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});