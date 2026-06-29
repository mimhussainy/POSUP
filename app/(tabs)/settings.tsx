import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, TextInput, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';

const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';
const PRIMARY = '#8B38CB';

export default function Settings() {
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
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <View style={styles.contentInner}>

          {/* Restaurant Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>RESTAURANT</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Ionicons name="storefront-outline" size={18} color={PRIMARY} />
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>Restaurant Code</Text>
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
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Change PIN</Text>
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
                  <Text style={{ fontSize: 15, fontWeight: '600', color: '#111' }}>Reopen Day</Text>
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Remove day close status</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#ccc" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PRINTER</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Ionicons name="print-outline" size={18} color={PRIMARY} />
                <View style={styles.infoText}>
                  <Text style={styles.infoLabel}>Coming soon</Text>
                  <Text style={styles.infoValue}>TCP/ESC-POS silent printing</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Logout */}
          <View style={styles.section}>
            <TouchableOpacity style={styles.logoutBtn} onPress={() => setLogoutModal(true)}>
              <Ionicons name="log-out-outline" size={18} color="#e74c3c" />
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Powered by FoodUp.ch</Text>
          </View>

        </View>
      </ScrollView>
{/* Reopen Modal */}
      {reopenModal && (
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setReopenModal(false)}>
          <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Day Reopened</Text>
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
              <Text style={styles.modalTitle}>Logout</Text>
              <TouchableOpacity onPress={() => setLogoutModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={{ fontSize: 15, color: '#555', marginBottom: 20 }}>Are you sure you want to logout?</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.saveBtn, { flex: 1, backgroundColor: '#f5f5f5', marginTop: 0 }]}
                  onPress={() => setLogoutModal(false)}
                >
                  <Text style={[styles.saveBtnText, { color: '#555' }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { flex: 1, backgroundColor: '#e74c3c', marginTop: 0 }]}
                  onPress={confirmLogout}
                >
                  <Text style={styles.saveBtnText}>Logout</Text>
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
              <Text style={styles.modalTitle}>Change PIN</Text>
              <TouchableOpacity onPress={() => { setPinModal(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); }} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Current PIN</Text>
              <TextInput style={styles.pinInput} placeholder="Current PIN" placeholderTextColor="#bbb" value={currentPin} onChangeText={setCurrentPin} secureTextEntry keyboardType="number-pad" />
              <Text style={styles.fieldLabel}>New PIN</Text>
              <TextInput style={styles.pinInput} placeholder="New PIN" placeholderTextColor="#bbb" value={newPin} onChangeText={setNewPin} secureTextEntry keyboardType="number-pad" />
              <Text style={styles.fieldLabel}>Confirm PIN</Text>
              <TextInput style={styles.pinInput} placeholder="Confirm PIN" placeholderTextColor="#bbb" value={confirmPin} onChangeText={setConfirmPin} secureTextEntry keyboardType="number-pad" />
              <TouchableOpacity style={[styles.saveBtn, changingPin && styles.saveBtnDisabled]} onPress={handleChangePin} disabled={changingPin}>
                {changingPin ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save New PIN</Text>}
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
  footer: { alignItems: 'center', marginTop: 8, paddingHorizontal: 16 },
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