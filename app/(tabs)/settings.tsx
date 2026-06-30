import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, TextInput, Platform, Image, Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useLanguage } from '../../lib/LanguageContext';
import { appFont } from '../../lib/fonts';

const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';
const PRIMARY = '#8B38CB';

import TcpSocket from 'react-native-tcp-socket';

function PrinterStatusCard({ t, printerIp, printerPort, printerModel }: { t: any, printerIp: string, printerPort: string, printerModel: string }) {
  const printerModelLabel = t?.printerModel || 'Modell';
  const printerNotConfiguredLabel = t?.printerNotConfigured || 'Nicht konfiguriert';
  const printerSetIpLabel = t?.printerSetIp || 'Drucker-IP im WordPress-Plugin setzen';
  const [status, setStatus] = useState<'checking' | 'online' | 'offline' | 'unknown'>('unknown');

  useEffect(() => {
    if (printerIp) checkStatus(printerIp, parseInt(printerPort || '9100'));
  }, [printerIp]);

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
    if (m === 'wifi') return 'WiFi Network Printer';
    if (m === 'generic') return 'Generic ESC/POS';
    return m || t.printerNotConfigured;
  };

  const statusColor = status === 'online' ? '#16a34a' : status === 'offline' ? '#e74c3c' : status === 'checking' ? '#f59e0b' : '#999';
  const statusLabel = status === 'online' ? 'Online' : status === 'offline' ? 'Offline' : status === 'checking' ? 'Checking...' : 'Unknown';
  const statusBg = status === 'online' ? '#e8fdf2' : status === 'offline' ? '#fef2f2' : status === 'checking' ? '#fffbeb' : '#f5f5f5';

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{t?.printerSection || 'PRINTER'}</Text>
      <View style={styles.card}>
        <View style={styles.infoRow}>
          <Ionicons name="print-outline" size={18} color={PRIMARY} />
          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>{printerModelLabel}</Text>
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
              <Text style={styles.infoLabel}>{printerNotConfiguredLabel}</Text>
              <Text style={styles.infoLabel} numberOfLines={2}>{printerSetIpLabel}</Text>
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
  const [printerIp, setPrinterIp] = useState('');
  const [printerPort, setPrinterPort] = useState('');
  const [printerModel, setPrinterModel] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const code = await AsyncStorage.getItem('restaurant_code') || '';
      const name = await AsyncStorage.getItem('restaurant_name') || '';
      setRestaurantCode(code);
      setRestaurantName(name);
      if (code) {
        const { fetchAndSaveProfile } = await import('../../lib/api');
        const profile = await fetchAndSaveProfile(code);
        if (profile.printer_ip) setPrinterIp(profile.printer_ip);
        if (profile.printer_port) setPrinterPort(profile.printer_port);
        if (profile.printer_model) setPrinterModel(profile.printer_model);
      }
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
          <Text style={styles.headerSub}>{restaurantName}</Text>
        </View>

        <View style={styles.contentInner}>

          {/* Restaurant Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t.restaurantSection}</Text>
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
                    <Text style={styles.infoLabel}>{t.restaurantNameLabel}</Text>
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
            <Text style={styles.sectionTitle}>{t.dayManagementSection}</Text>
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
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{t.removeDayCloseStatus}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
              </TouchableOpacity>
            </View>
          </View>
          <PrinterStatusCard t={t} printerIp={printerIp} printerPort={printerPort} printerModel={printerModel} />

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
                        {Platform.OS === 'web' ? (lang === 'de' ? 'Deutsch' : 'English') : (lang === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English')}
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
  header: { width: '100%', height: Platform.OS === 'web' ? 70 : 58, paddingHorizontal: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eeeeee', marginBottom: 16, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#111', fontFamily: appFont, textAlign: 'center' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 2, fontWeight: '400', fontFamily: appFont, textAlign: 'center' },
  section: { paddingHorizontal: 16, marginBottom: 16, width: '100%' },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: '#888', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginLeft: 4, fontFamily: appFont },
  card: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e2e2e8' },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  infoText: { flex: 1, marginLeft: 4 },
  infoLabel: { fontSize: 11, color: '#888', fontWeight: '500', marginBottom: 2, fontFamily: appFont },
  infoValue: { fontSize: 14, color: '#222', fontWeight: '600', fontFamily: appFont },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 14, gap: 10, borderWidth: 1, borderColor: '#fde8e8' },
  logoutText: { fontSize: 14, fontWeight: '600', color: '#e74c3c', fontFamily: appFont },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingHorizontal: 16 },
  footerText: { fontSize: 12, color: '#999', fontFamily: appFont },
  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { backgroundColor: '#fff', borderRadius: 16, width: 380, overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 16, fontWeight: '600', color: '#111', fontFamily: appFont },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFEFF2', justifyContent: 'center', alignItems: 'center' },
  modalBody: { padding: 16 },
  fieldLabel: { fontSize: 12, fontWeight: '500', color: '#555', marginBottom: 6, marginTop: 12, fontFamily: appFont },
  pinInput: { borderWidth: 1, borderColor: '#d8d8d8', borderRadius: 10, padding: 12, fontSize: 15, color: '#111', backgroundColor: '#fafafa', fontFamily: appFont },
  saveBtn: { backgroundColor: PRIMARY, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20 },
  saveBtnDisabled: { backgroundColor: '#ccc' },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: appFont },
});