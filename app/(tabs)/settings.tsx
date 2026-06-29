import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, TextInput, Platform, Image, Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useLanguage } from '../../lib/LanguageContext';

const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';
const PRIMARY = '#8B38CB';

import TcpSocket from 'react-native-tcp-socket';

function PrinterStatusCard() {
  const [printerIp, setPrinterIp] = useState('');
  const [printerPort, setPrinterPort] = useState('');
  const [printerModel, setPrinterModel] = useState('');
  const [status, setStatus] = useState<'checking' | 'online' | 'offline' | 'unknown'>('unknown');

  useEffect(() => {
    loadPrinterInfo();
  }, []);

  const loadPrinterInfo = async () => {
    const ip = await AsyncStorage.getItem('printer_ip') || '';
    const port = await AsyncStorage.getItem('printer_port') || '9100';
    const model = await AsyncStorage.getItem('printer_model') || '';
    setPrinterIp(ip);
    setPrinterPort(port);
    setPrinterModel(model);
    if (ip) checkStatus(ip, parseInt(port));
  };

  const checkStatus = (ip: string, port: number) => {
    if (Platform.OS === 'web') { setStatus('unknown'); return; }
    setStatus('checking');
    try {
      const client = TcpSocket.createConnection({ host: ip, port }, () => {
        setStatus('online');
        client.destroy();
      });
      client.on('error', () => { setStatus('offline'); client.destroy(); });
      setTimeout(() => {
        try { client.destroy(); } catch {}
        setStatus(s => s === 'checking' ? 'offline' : s);
      }, 3000);
    } catch {
      setStatus('offline');
    }
  };

  const modelLabel = (m: string) => {
    if (m === 'sunmi') return 'SUNMI Built-in';
    if (m === 'epson') return 'Epson TM (Windows TCP)';
    if (m === 'generic') return 'Generic ESC/POS';
    return m || 'Not configured';
  };

  const statusColor = status === 'online' ? '#16a34a' : status === 'offline' ? '#e74c3c' : status === 'checking' ? '#f59e0b' : '#999';
  const statusLabel = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : status === 'checking' ? 'Checking...' : 'Unknown';
  const statusBg = status === 'online' ? '#e8fdf2' : status === 'offline' ? '#fef2f2' : status === 'checking' ? '#fffbeb' : '#f5f5f5';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>PRINTER</Text>
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Ionicons name="print-outline" size={18} color={PRIMARY} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>Model</Text>
            <Text style={styles.infoValue}>{modelLabel(printerModel)}</Text>
          </View>
        </View>
        {printerIp ? (
          <View style={styles.infoRow}>
            <Ionicons name="wifi-outline" size={18} color={PRIMARY} />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.infoValue}>{printerIp}:{printerPort}</Text>
            </View>
            <TouchableOpacity
              style={{ backgroundColor: statusBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 }}
              onPress={() => checkStatus(printerIp, parseInt(printerPort))}
            >
              {status === 'checking'
                ? <ActivityIndicator size="small" color={statusColor} />
                : <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: statusColor }} />
              }
              <Text style={{ fontSize: 12, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.infoRow}>
            <Ionicons name="alert-circle-outline" size={18} color="#999" />
            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>Not configured</Text>
              <Text style={{ fontSize: 12, color: '#aaa' }}>Set printer IP in WordPress plugin</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const [restaurantCode, setRestaurantCode] = useState('');
  const [restaurantName, setRestaurantName] = useState('');
  const [loading, setLoading] = useState(true);
  const [pinModal, setPinModal] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changingPin, setChangingPin] = useState(false);
  const [logoutModal, setLogoutModal] = useState(false);
  const [reopenModal, setReopenModal] = useState(false);
  const [aboutModal, setAboutModal] = useState(false);

  useEffect(() => { loadData(); }, []);
  useFocusEffect(useCallback(() => { loadData(); }, []));

  const loadData = async () => {
    try {
      const code = await AsyncStorage.getItem('restaurant_code') || '';
      const name = await AsyncStorage.getItem('restaurant_name') || '';
      setRestaurantCode(code);
      setRestaurantName(name);
    } catch (e) {} finally {
      setLoading(false);
    }
  };

  const handleChangePin = async () => {
    if (!currentPin || !newPin || !confirmPin) {
      alert('Please fill in all fields'); return;
    }
    if (newPin !== confirmPin) {
      alert('New PIN and confirmation do not match'); return;
    }
    if (newPin.length < 4) {
      alert('PIN must be at least 4 characters'); return;
    }
    setChangingPin(true);
    try {
      const res = await fetch(`${BACKEND}/change-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_code: restaurantCode, current_pin: currentPin, new_pin: newPin }),
      });
      const data = await res.json();
      if (data.success) {
        await AsyncStorage.setItem('owner_pin', newPin);
        setPinModal(false);
        setCurrentPin(''); setNewPin(''); setConfirmPin('');
        alert('PIN changed successfully');
      } else {
        alert(data.message || 'Current PIN is incorrect');
      }
    } catch (e) {
      alert('Failed to change PIN');
    } finally {
      setChangingPin(false);
    }
  };

  const confirmLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/');
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={PRIMARY} /></View>;
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t.settings}</Text>
        </View>

        <View style={styles.contentInner}>

          {/* Restaurant Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RESTAURANT</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Ionicons name="storefront-outline" size={18} color={PRIMARY} />
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>{t.restaurantCode}</Text>
                  <Text style={styles.infoValue}>{restaurantCode}</Text>
                </View>
              </View>
              {restaurantName ? (
                <View style={styles.infoRow}>
                  <Ionicons name="business-outline" size={18} color={PRIMARY} />
                  <View style={styles.infoText}>
                    <Text style={styles.infoLabel}>Restaurant Name</Text>
                    <Text style={styles.infoValue}>{restaurantName}</Text>
                  </View>
                </View>
              ) : null}
              <View style={styles.infoRow}>
                <Ionicons name="key-outline" size={18} color={PRIMARY} />
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>PIN</Text>
                  <Text style={styles.infoValue}>••••</Text>
                </View>
                <TouchableOpacity
                  style={{ backgroundColor: PRIMARY, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7 }}
                  onPress={() => setPinModal(true)}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{t.changePin}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Day Management */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>DAY MANAGEMENT</Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
                onPress={async () => {
                  await AsyncStorage.removeItem('day_closed_date');
                  setReopenModal(true);
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#e8fdf2', justifyContent: 'center', alignItems: 'center' }}>
                  <Ionicons name="refresh-circle-outline" size={20} color="#16a34a" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>{t.reopenDay}</Text>
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Remove day close status</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
              </TouchableOpacity>
            </View>
          </View>
          <PrinterStatusCard />

          {/* Language */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.language}</Text>
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', padding: 14, gap: 10 }}>
                {(['de', 'en'] as const).map(lang => {
                  return (
                    <TouchableOpacity
                      key={lang}
                      style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: language === lang ? PRIMARY : '#f5f5f5', alignItems: 'center' }}
                      onPress={() => setLanguage(lang)}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: language === lang ? '#fff' : '#555' }}>
                        {lang === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Logout */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutModal(true)}>
              <Ionicons name="log-out-outline" size={18} color="#e74c3c" />
              <Text style={styles.logoutText}>{t.logout}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.footer} onPress={() => setAboutModal(true)}>
            <Ionicons name="hand-left-outline" size={14} color="#bbb" />
            <Text style={styles.footerText}>Powered by FoodUp.ch</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
{/* Reopen Modal */}
      {reopenModal && (
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setReopenModal(false)}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.reopenDay}</Text>
              <TouchableOpacity onPress={() => setReopenModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={{ fontSize: 15, color: '#555', marginBottom: 20 }}>The day has been reopened successfully.</Text>
              <TouchableOpacity style={styles.saveBtn} onPress={() => setReopenModal(false)}>
                <Text style={styles.saveBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
      {/* Logout Modal */}
      {logoutModal && (
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setLogoutModal(false)}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.logout}</Text>
              <TouchableOpacity onPress={() => setLogoutModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={{ fontSize: 15, color: '#555', marginBottom: 20 }}>{t.logoutConfirm}</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.saveBtn, { flex: 1, backgroundColor: '#f5f5f5', marginTop: 0 }]}
                  onPress={() => setLogoutModal(false)}
                >
                  <Text style={[styles.saveBtnText, { color: '#555' }]}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { flex: 1, backgroundColor: '#e74c3c', marginTop: 0 }]}
                  onPress={confirmLogout}
                >
                  <Text style={styles.saveBtnText}>{t.logout}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Change PIN Modal */}
      {pinModal && (
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => { setPinModal(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); }}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.changePin}</Text>
              <TouchableOpacity onPress={() => { setPinModal(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); }} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>{t.currentPin}</Text>
              <TextInput style={styles.pinInput} placeholder={t.currentPin} placeholderTextColor="#bbb" value={currentPin} onChangeText={setCurrentPin} secureTextEntry keyboardType="number-pad" />
              <Text style={styles.fieldLabel}>{t.newPin}</Text>
              <TextInput style={styles.pinInput} placeholder={t.newPin} placeholderTextColor="#bbb" value={newPin} onChangeText={setNewPin} secureTextEntry keyboardType="number-pad" />
              <Text style={styles.fieldLabel}>{t.confirmPin}</Text>
              <TextInput style={styles.pinInput} placeholder={t.confirmPin} placeholderTextColor="#bbb" value={confirmPin} onChangeText={setConfirmPin} secureTextEntry keyboardType="number-pad" />
              <TouchableOpacity style={[styles.saveBtn, changingPin && styles.saveBtnDisabled]} onPress={handleChangePin} disabled={changingPin}>
                {changingPin ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>{t.newPin}</Text>}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* About FoodUp Modal */}
      {aboutModal && (
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setAboutModal(false)}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>FoodUp</Text>
              <TouchableOpacity onPress={() => setAboutModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Image source={require('../../assets/FoodupPOS-logo.png')} style={{ width: 160, height: 60, alignSelf: 'center', marginBottom: 20 }} resizeMode="contain" />
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' }} onPress={() => Linking.openURL('mailto:info@foodup.ch')}>
                <Ionicons name="mail-outline" size={20} color={PRIMARY} />
                <Text style={{ fontSize: 14, color: '#333', fontWeight: '600' }}>info@foodup.ch</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' }} onPress={() => Linking.openURL('https://wa.me/41783222292')}>
                <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                <Text style={{ fontSize: 14, color: '#333', fontWeight: '600' }}>+41 78 322 22 92</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }} onPress={() => Linking.openURL('https://foodup.ch')}>
                <Ionicons name="globe-outline" size={20} color={PRIMARY} />
                <Text style={{ fontSize: 14, color: '#333', fontWeight: '600' }}>foodup.ch</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F4F8' },
  content: { paddingBottom: 40, alignItems: 'center' },
  contentInner: { width: '45%', alignSelf: 'center', minWidth: 320 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { width: '100%', paddingTop: 14, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', marginBottom: 16, alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111', marginTop: 1 },
  section: { paddingHorizontal: 16, marginBottom: 16, width: '100%' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#666', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#eee', overflow: 'hidden' },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 12, color: '#666', fontWeight: '600', marginBottom: 2 },
  infoValue: { fontSize: 15, color: '#111', fontWeight: '600' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: '#fde8e8' },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#e74c3c' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingHorizontal: 16 },
  footerText: { fontSize: 13, color: '#999' },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, width: 380, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },
  modalBody: { padding: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#444', marginBottom: 6, marginTop: 12 },
  pinInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 15, color: '#111', backgroundColor: '#fafafa' },
  saveBtn: { backgroundColor: PRIMARY, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
  saveBtnDisabled: { backgroundColor: '#ccc' },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});