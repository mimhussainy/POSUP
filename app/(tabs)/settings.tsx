import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Platform,
  Image,
  Linking,
  Modal,
  Dimensions,
  Alert,

} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useLanguage } from '../../lib/LanguageContext';
import { appFont } from '../../lib/fonts';
import { colors, borders, radii, fontSizes, fontWeights } from '../../lib/theme';
import {
  type PhoneCustomer,
  deletePhoneCustomer,
  loadPhoneCustomers,
  searchPhoneCustomers,
} from '../../lib/phoneCustomers';

import TcpSocket from 'react-native-tcp-socket';

const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';

const PRIMARY = colors.primary;
const PRIMARY_SOFT = colors.primarySoft;
const PRIMARY_BORDER = colors.primaryBorder;

const APP_BG = colors.appBg;
const CARD_BG = colors.cardBg;
const BORDER = colors.borderStrong;
const TEXT = colors.text;
const MUTED = colors.muted;
const SOFT_TEXT = colors.softText;

const GREEN = colors.success;
const RED = colors.danger;
const ORANGE = colors.warning;

const PAGE_PADDING = 16;
const MAX_CONTENT_WIDTH = 760;
const thinBorder = borders.thin;


function PrinterStatusCard({
  t,
  language,
  printerIp,
  printerPort,
  printerModel,
}: {
  t: any;
  language: string;
  printerIp: string;
  printerPort: string;
  printerModel: string;
}) {
  const isGerman = language === 'de';
  const tr = (key: string, en: string, de: string) => t?.[key] || (isGerman ? de : en);

  const printerModelLabel = tr('printerModel', 'Model', 'Modell');
  const printerNotConfiguredLabel = tr('printerNotConfigured', 'Not configured', 'Nicht konfiguriert');
  const printerSetIpLabel = tr('printerSetIp', 'Set printer IP in the WordPress plugin', 'Drucker-IP im WordPress-Plugin setzen');

  const [status, setStatus] = useState<'checking' | 'online' | 'offline' | 'unknown'>('unknown');

  const modelLabel = (model: string) => {
    if (model === 'sunmi') return 'SUNMI Built-in';
    if (model === 'epson') return 'Epson TM (Windows TCP)';
    if (model === 'wifi') return 'WiFi Network Printer';
    if (model === 'generic') return 'Generic ESC/POS';

    return model || printerNotConfiguredLabel;
  };

  const checkStatus = useCallback((ip: string, port: number) => {
    if (!ip) {
      setStatus('unknown');
      return;
    }

    if (Platform.OS === 'web') {
      setStatus('unknown');
      return;
    }

    setStatus('checking');

    try {
      const client = TcpSocket.createConnection({ host: ip, port }, () => {
        setStatus('online');
        client.destroy();
      });

      client.on('error', () => {
        setStatus('offline');
        client.destroy();
      });

      setTimeout(() => {
        try {
          client.destroy();
        } catch {}

        setStatus(currentStatus => currentStatus === 'checking' ? 'offline' : currentStatus);
      }, 3000);
    } catch {
      setStatus('offline');
    }
  }, []);

  useEffect(() => {
    if (printerIp) {
      checkStatus(printerIp, parseInt(printerPort || '9100'));
    } else {
      setStatus('unknown');
    }
  }, [printerIp, printerPort, checkStatus]);

  const statusColor =
    status === 'online'
      ? GREEN
      : status === 'offline'
        ? RED
        : status === 'checking'
          ? ORANGE
          : '#9CA3AF';

  const statusLabel =
    status === 'online'
      ? tr('online', 'Online', 'Online')
      : status === 'offline'
        ? tr('offline', 'Offline', 'Offline')
        : status === 'checking'
          ? tr('checking', 'Checking...', 'Wird geprüft...')
          : tr('unknown', 'Unknown', 'Unbekannt');

  const statusBg =
    status === 'online'
      ? '#EAFBF1'
      : status === 'offline'
        ? '#FEF2F2'
        : status === 'checking'
          ? '#FFFBEB'
          : '#F2F3F7';

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{tr('printerStatus', 'Printer Status', 'Druckerstatus')}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.infoRow}>
          <View style={styles.iconBox}>
            <Ionicons name="print-outline" size={19} color={PRIMARY} />
          </View>

          <View style={styles.infoText}>
            <Text style={styles.infoLabel}>{printerModelLabel}</Text>
            <Text style={styles.infoValue}>{modelLabel(printerModel)}</Text>
          </View>
        </View>

        {printerIp ? (
          <View style={Platform.OS !== 'web' ? styles.infoRow : [styles.infoRow, styles.infoRowLast]}>
            <View style={styles.iconBox}>
              <Ionicons name="wifi-outline" size={19} color={PRIMARY} />
            </View>

            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>{tr('address', 'Address', 'Adresse')}</Text>
              <Text style={styles.infoValue}>{printerIp}:{printerPort || '9100'}</Text>
            </View>

            <TouchableOpacity
              style={[styles.statusPill, { backgroundColor: statusBg }]}
              onPress={() => checkStatus(printerIp, parseInt(printerPort || '9100'))}
              activeOpacity={0.75}
            >
              {status === 'checking' ? (
                <ActivityIndicator size="small" color={statusColor} />
              ) : (
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              )}

              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={Platform.OS !== 'web' ? styles.infoRow : [styles.infoRow, styles.infoRowLast]}>
            <View style={[styles.iconBox, styles.iconBoxMuted]}>
              <Ionicons name="alert-circle-outline" size={19} color="#9CA3AF" />
            </View>

            <View style={styles.infoText}>
              <Text style={styles.infoLabel}>{printerNotConfiguredLabel}</Text>
              <Text style={styles.infoSubValue} numberOfLines={2}>
                {printerSetIpLabel}
              </Text>
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

  const [addressBookModal, setAddressBookModal] = useState(false);
  const [addressBookCustomers, setAddressBookCustomers] = useState<PhoneCustomer[]>([]);
  const [addressBookSearch, setAddressBookSearch] = useState('');

  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);

  const isNarrow = windowWidth < 760;
  const contentWidthStyle = isNarrow ? styles.contentInnerMobile : null;

  const isGerman = language === 'de';

  const labels = {
    restaurantSection: isGerman ? 'RESTAURANT' : 'RESTAURANT',
    restaurantTitle: isGerman ? 'Restaurant' : 'Restaurant',
    dayManagementSection: isGerman ? 'TAG' : 'DAY',
    dayManagementTitle: isGerman ? 'Tagesverwaltung' : 'Day Management',
    languageSection: isGerman ? 'APP' : 'APP',
    languageTitle: isGerman ? 'Sprache' : 'Language',
    account: isGerman ? 'Konto' : 'Account',
    security: isGerman ? 'Sicherheit' : 'Security',
    poweredBy: isGerman ? 'Powered by' : 'Powered by',
    fillAllFields: isGerman ? 'Bitte alle Felder ausfüllen' : 'Please fill in all fields',
    pinMismatch: isGerman ? 'Neue PIN und Bestätigung stimmen nicht überein' : 'New PIN and confirmation do not match',
    pinTooShort: isGerman ? 'PIN muss mindestens 4 Zeichen lang sein' : 'PIN must be at least 4 characters',
    pinChanged: isGerman ? 'PIN erfolgreich geändert' : 'PIN changed successfully',
    pinIncorrect: isGerman ? 'Aktuelle PIN ist falsch' : 'Current PIN is incorrect',
    pinChangeFailed: isGerman ? 'PIN konnte nicht geändert werden' : 'Failed to change PIN',
    dayReopened: isGerman ? 'Der Tag wurde erfolgreich wieder geöffnet.' : 'The day has been reopened successfully.',
    ok: isGerman ? 'OK' : 'OK',
  };

  const tr = (key: string, fallback: string) => ((t as any)?.[key] || fallback);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });

    return () => sub?.remove();
  }, []);

  const openAddressBook = async () => {
    const code = await AsyncStorage.getItem('restaurant_code') || '';

    const customers = await loadPhoneCustomers(code);
    setAddressBookCustomers(customers);
    setAddressBookSearch('');
    setAddressBookModal(true);
  };

  const handleDeleteAddressBookCustomer = async (customer: PhoneCustomer) => {
    const code = await AsyncStorage.getItem('restaurant_code') || '';
    const name = `${customer.first_name} ${customer.last_name}`.trim() || ((t as any).unknownCustomer || 'Unknown customer');

    Alert.alert(
      (t as any).deleteCustomer || (language === 'de' ? 'Kunde löschen' : 'Delete customer'),
      (t as any).deleteCustomerConfirm || (language === 'de' ? `${name} aus dem Adressbuch löschen?` : `Delete ${name} from the address book?`),
      [
        {
          text: t.cancel,
          style: 'cancel',
        },
        {
          text: (t as any).deleteCustomer || (language === 'de' ? 'Löschen' : 'Delete'),
          style: 'destructive',
          onPress: async () => {
            const updated = await deletePhoneCustomer(code, customer);
            setAddressBookCustomers(updated);
          },
        },
      ]
    );
  };

  const filteredAddressBookCustomers = searchPhoneCustomers(addressBookCustomers, addressBookSearch);

  const loadData = useCallback(async () => {
    try {
      const code = await AsyncStorage.getItem('restaurant_code') || '';
      const name = await AsyncStorage.getItem('restaurant_name') || '';

      const savedPrinterIp = await AsyncStorage.getItem('printer_ip') || '';
      const savedPrinterPort = await AsyncStorage.getItem('printer_port') || '';
      const savedPrinterModel = await AsyncStorage.getItem('printer_model') || '';

      setRestaurantCode(code);
      setRestaurantName(name);
      setPrinterIp(savedPrinterIp);
      setPrinterPort(savedPrinterPort);
      setPrinterModel(savedPrinterModel);

      if (code) {
        const { fetchAndSaveProfile } = await import('../../lib/api');
        const profile = await fetchAndSaveProfile(code);

        if (profile.printer_ip) setPrinterIp(profile.printer_ip);
        if (profile.printer_port) setPrinterPort(profile.printer_port);
        if (profile.printer_model) setPrinterModel(profile.printer_model);
      }
    } catch (e) {
      console.log('Failed to load settings', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const resetPinForm = () => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
  };

  const closePinModal = () => {
    setPinModal(false);
    resetPinForm();
  };

  const handleChangePin = async () => {
    if (!currentPin || !newPin || !confirmPin) {
      alert(tr('fillAllFields', labels.fillAllFields));
      return;
    }

    if (newPin !== confirmPin) {
      alert(tr('pinMismatch', labels.pinMismatch));
      return;
    }

    if (newPin.length < 4) {
      alert(tr('pinTooShort', labels.pinTooShort));
      return;
    }

    setChangingPin(true);

    try {
      const res = await fetch(`${BACKEND}/change-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurant_code: restaurantCode,
          current_pin: currentPin,
          new_pin: newPin,
        }),
      });

      const data = await res.json();

      if (data.success) {
        await AsyncStorage.setItem('owner_pin', newPin);
        closePinModal();
        alert(tr('pinChanged', labels.pinChanged));
      } else {
        alert(data.message || tr('pinIncorrect', labels.pinIncorrect));
      }
    } catch (e) {
      alert(tr('pinChangeFailed', labels.pinChangeFailed));
    } finally {
      setChangingPin(false);
    }
  };

  const confirmLogout = async () => {
    await AsyncStorage.clear();
    router.replace('/');
  };

  const reopenDay = async () => {
    await AsyncStorage.removeItem('day_closed_date');
    setReopenModal(true);
  };

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>{t.settings}...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.headerOuter}>
        <View style={styles.headerInner}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{t.settings}</Text>
            </View>

            <TouchableOpacity
              style={styles.aboutHeaderBtn}
              onPress={() => setAboutModal(true)}
              activeOpacity={0.75}
            >
              <Image
                source={require('../../assets/favicon-dashboard.png')}
                style={styles.aboutHeaderIcon}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contentInner, contentWidthStyle]}>
          <View style={styles.sectionsGrid}>
            <View style={styles.section}>
              {renderSectionHeader(tr('restaurantTitle', labels.restaurantTitle))}

              <View style={styles.card}>
                <View style={styles.infoRow}>
                  <View style={styles.iconBox}>
                    <Ionicons name="storefront-outline" size={19} color={PRIMARY} />
                  </View>

                  <View style={styles.infoText}>
                    <Text style={styles.infoLabel}>{t.restaurantCode}</Text>
                    <Text style={styles.infoValue}>{restaurantCode || '—'}</Text>
                  </View>
                </View>

                {restaurantName ? (
                  <View style={styles.infoRow}>
                    <View style={styles.iconBox}>
                      <Ionicons name="business-outline" size={19} color={PRIMARY} />
                    </View>

                    <View style={styles.infoText}>
                      <Text style={styles.infoLabel}>{t.restaurantNameLabel}</Text>
                      <Text style={styles.infoValue}>{restaurantName}</Text>
                    </View>
                  </View>
                ) : null}

                <View style={[styles.infoRow, styles.infoRowLast]}>
                  <View style={styles.iconBox}>
                    <Ionicons name="key-outline" size={19} color={PRIMARY} />
                  </View>

                  <View style={styles.infoText}>
                    <Text style={styles.infoLabel}>PIN</Text>
                    <Text style={styles.infoValue}>••••</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.primarySmallBtn}
                    onPress={() => setPinModal(true)}
                    activeOpacity={0.78}
                  >
                    <Text style={styles.primarySmallBtnText}>{t.changePin}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              {renderSectionHeader((t as any).savedCustomers || (language === 'de' ? 'Gespeicherte Kunden' : 'Saved customers'))}

              <TouchableOpacity
                style={styles.addressBookSettingsCard}
                onPress={openAddressBook}
                activeOpacity={0.78}
              >
                <View style={styles.addressBookSettingsIcon}>
                  <Ionicons name="book-outline" size={22} color="#D97706" />
                </View>

                <View style={styles.addressBookSettingsTextWrap}>
                  <Text style={styles.addressBookSettingsTitle}>
                    {(t as any).addressBook || 'Address book'}
                  </Text>
                  <Text style={styles.addressBookSettingsSub}>
                    {(t as any).addressBookSettingsSubtitle || (language === 'de' ? 'Gespeicherte Telefonkunden anzeigen' : 'View saved phone customers')}
                  </Text>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#A8ACB7" />
              </TouchableOpacity>
            </View>

            <PrinterStatusCard
              t={t}
              language={language}
              printerIp={printerIp}
              printerPort={printerPort}
              printerModel={printerModel}
            />

            <View style={styles.section}>
              {renderSectionHeader(tr('dayManagementTitle', labels.dayManagementTitle))}

              <View style={styles.card}>
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={reopenDay}
                  activeOpacity={0.78}
                >
                  <View style={styles.greenIconBox}>
                    <Ionicons name="refresh-circle-outline" size={21} color={GREEN} />
                  </View>

                  <View style={styles.infoText}>
                    <Text style={styles.actionTitle}>{t.reopenDay}</Text>
                    <Text style={styles.actionSub}>{t.removeDayCloseStatus}</Text>
                  </View>

                  <Ionicons name="chevron-forward" size={17} color="#C0C4CE" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              {renderSectionHeader(tr('languageTitle', labels.languageTitle))}

              <View style={styles.card}>
                <View style={styles.languageRow}>
                  {(['de', 'en'] as const).map(lang => {
                    const active = language === lang;

                    return (
                      <TouchableOpacity
                        key={lang}
                        style={[
                          styles.languageBtn,
                          active && styles.languageBtnActive,
                        ]}
                        onPress={() => setLanguage(lang)}
                        activeOpacity={0.78}
                      >
                        <Text
                          style={[
                            styles.languageText,
                            active && styles.languageTextActive,
                          ]}
                        >
                          {Platform.OS === 'web'
                            ? lang === 'de' ? 'Deutsch' : 'English'
                            : lang === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <TouchableOpacity
                style={styles.logoutBtn}
                onPress={() => setLogoutModal(true)}
                activeOpacity={0.78}
              >
                <View style={styles.logoutIconBox}>
                  <Ionicons name="log-out-outline" size={19} color={RED} />
                </View>

                <View style={styles.infoText}>
                  <Text style={styles.logoutTitle}>{t.logout}</Text>
                </View>

                <Ionicons name="chevron-forward" size={17} color="#FCA5A5" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.footer}
            onPress={() => setAboutModal(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="hand-left-outline" size={14} color="#B8BBC4" />
            <Text style={styles.footerText}>Powered by FoodUp.ch</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={reopenModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setReopenModal(false)}
        >
          <TouchableOpacity
            style={styles.modalBox}
            activeOpacity={1}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t.reopenDay}</Text>
              </View>

              <TouchableOpacity
                onPress={() => setReopenModal(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark-circle-outline" size={34} color={GREEN} />
              </View>

              <Text style={styles.modalMessage}>
                {tr('dayReopened', labels.dayReopened)}
              </Text>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => setReopenModal(false)}
                activeOpacity={0.78}
              >
                <Text style={styles.saveBtnText}>{tr('ok', labels.ok)}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={logoutModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLogoutModal(false)}
        >
          <TouchableOpacity
            style={styles.modalBox}
            activeOpacity={1}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t.logout}</Text>
              </View>

              <TouchableOpacity
                onPress={() => setLogoutModal(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalMessage}>{t.logoutConfirm}</Text>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setLogoutModal(false)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.cancelBtnText}>{t.cancel}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dangerBtn}
                  onPress={confirmLogout}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dangerBtnText}>{t.logout}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={pinModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closePinModal}
        >
          <TouchableOpacity
            style={styles.modalBox}
            activeOpacity={1}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t.changePin}</Text>
              </View>

              <TouchableOpacity
                onPress={closePinModal}
                style={styles.modalCloseBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>{t.currentPin}</Text>
              <TextInput
                style={styles.pinInput}
                placeholder={t.currentPin}
                placeholderTextColor="#A8ACB7"
                value={currentPin}
                onChangeText={setCurrentPin}
                secureTextEntry
                keyboardType="number-pad"
              />

              <Text style={styles.fieldLabel}>{t.newPin}</Text>
              <TextInput
                style={styles.pinInput}
                placeholder={t.newPin}
                placeholderTextColor="#A8ACB7"
                value={newPin}
                onChangeText={setNewPin}
                secureTextEntry
                keyboardType="number-pad"
              />

              <Text style={styles.fieldLabel}>{t.confirmPin}</Text>
              <TextInput
                style={styles.pinInput}
                placeholder={t.confirmPin}
                placeholderTextColor="#A8ACB7"
                value={confirmPin}
                onChangeText={setConfirmPin}
                secureTextEntry
                keyboardType="number-pad"
              />

              <TouchableOpacity
                style={[styles.saveBtn, changingPin && styles.saveBtnDisabled]}
                onPress={handleChangePin}
                disabled={changingPin}
                activeOpacity={0.8}
              >
                {changingPin ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>{t.changePin}</Text>
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={addressBookModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAddressBookModal(false)}
        >
          <TouchableOpacity
            style={styles.addressBookModalBox}
            activeOpacity={1}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.addressBookModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.addressBookModalTitle}>
                  {(t as any).addressBook || 'Address book'}
                </Text>
                <Text style={styles.addressBookModalSub}>
                  {(t as any).addressBookSearchSubtitle || (language === 'de' ? 'Suche nach Telefon, Name, Nachname oder Strasse' : 'Search by phone, name, last name or street')}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setAddressBookModal(false)}
                style={styles.addressBookCloseBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.addressBookSearchWrap}>
              <Ionicons name="search-outline" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.addressBookSearchInput}
                placeholder={(t as any).addressBookSearchPlaceholder || (language === 'de' ? 'Telefon, Name, Nachname, Strasse suchen...' : 'Search phone, name, last name, street...')}
                placeholderTextColor="#9CA3AF"
                value={addressBookSearch}
                onChangeText={setAddressBookSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>

            <ScrollView
              style={styles.addressBookList}
              contentContainerStyle={filteredAddressBookCustomers.length === 0 ? styles.addressBookListEmpty : undefined}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredAddressBookCustomers.length === 0 ? (
                <View style={styles.addressBookEmpty}>
                  <Ionicons name="person-circle-outline" size={48} color="#C7CBD4" />
                  <Text style={styles.addressBookEmptyText}>
                    {(t as any).noSavedCustomers || (language === 'de' ? 'Noch keine Kunden gespeichert' : 'No saved customers yet')}
                  </Text>
                </View>
              ) : (
                filteredAddressBookCustomers.map((customer, index) => {
                  const name = `${customer.first_name} ${customer.last_name}`.trim() || ((t as any).unknownCustomer || 'Unknown customer');
                  const address = `${customer.street}, ${customer.zip} ${customer.city}`.replace(/^,\s*/, '').trim();

                  return (
                    <View
                      key={`${customer.phone}-${customer.street}-${index}`}
                      style={styles.addressBookCustomerCard}
                    >
                      <View style={styles.addressBookAvatar}>
                        <Text style={styles.addressBookAvatarText}>
                          {name.trim()[0]?.toUpperCase() || '?'}
                        </Text>
                      </View>

                      <View style={styles.addressBookCustomerInfo}>
                        <Text style={styles.addressBookCustomerName} numberOfLines={1}>
                          {name}
                        </Text>

                        <Text style={styles.addressBookCustomerPhone} numberOfLines={1}>
                          {customer.phone || ((t as any).noPhone || 'No phone')}
                        </Text>

                        <Text style={styles.addressBookCustomerAddress} numberOfLines={1}>
                          {address || ((t as any).noAddress || (language === 'de' ? 'Keine Adresse' : 'No address'))}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.addressBookDeleteBtn}
                        onPress={() => handleDeleteAddressBookCustomer(customer)}
                        activeOpacity={0.75}
                      >
                        <Ionicons name="trash-outline" size={17} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal visible={aboutModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setAboutModal(false)}
        >
          <TouchableOpacity
            style={styles.modalBox}
            activeOpacity={1}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>FoodUp</Text>
              </View>

              <TouchableOpacity
                onPress={() => setAboutModal(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Image
                source={require('../../assets/FoodupPOS-logo.png')}
                style={styles.aboutLogo}
                resizeMode="contain"
              />

              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => Linking.openURL('mailto:info@foodup.ch')}
                activeOpacity={0.75}
              >
                <View style={styles.contactIconBox}>
                  <Ionicons name="mail-outline" size={20} color={PRIMARY} />
                </View>
                <Text style={styles.contactText}>info@foodup.ch</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.contactRow}
                onPress={() => Linking.openURL('https://wa.me/41783222292')}
                activeOpacity={0.75}
              >
                <View style={[styles.contactIconBox, styles.whatsappIconBox]}>
                  <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                </View>
                <Text style={styles.contactText}>+41 78 322 22 92</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.contactRow, styles.contactRowLast]}
                onPress={() => Linking.openURL('https://foodup.ch')}
                activeOpacity={0.75}
              >
                <View style={styles.contactIconBox}>
                  <Ionicons name="globe-outline" size={20} color={PRIMARY} />
                </View>
                <Text style={styles.contactText}>foodup.ch</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  container: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  content: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: 14,
    paddingBottom: Platform.OS === 'android' ? 150 : 130,
  },

  contentInner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },

  contentInnerMobile: {
    maxWidth: '100%',
  },

  sectionsGrid: {
    flexDirection: 'column',
    gap: 14,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_BG,
  },

  loadingCard: {
    backgroundColor: CARD_BG,
    borderRadius: radii.xxxl,
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: 'center',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  loadingText: {
    marginTop: 12,
    color: MUTED,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
  },

  headerOuter: {
    height: 75,
    backgroundColor: CARD_BG,
    paddingHorizontal: PAGE_PADDING,
    borderBottomWidth: thinBorder,
    borderBottomColor: BORDER,
    justifyContent: 'center',
  },

  headerInner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },

  header: {
    width: '100%',
    height: 75,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  headerLeft: {
    flex: 1,
    minWidth: 0,
  },

  headerKicker: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.extrabold,
    color: PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: appFont,
  },

  headerTitle: {
    fontSize: fontSizes.massive,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  headerSub: {
    marginTop: 2,
    fontSize: fontSizes.smd,
    color: MUTED,
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
  },

  aboutHeaderIcon: {
    width: 24,
    height: 24,
    borderRadius: 0,
  },

  aboutHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: CARD_BG,
    borderWidth: thinBorder,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: {
    width: '100%',
  },

  sectionHeader: {
    marginBottom: 8,
    paddingHorizontal: 3,
  },

  sectionTitle: {
    marginTop: 2,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    color: '#555B66',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: appFont,
  },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: radii.xxxl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    overflow: 'hidden',
  },

  infoRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    borderBottomWidth: thinBorder,
    borderBottomColor: BORDER,
  },

  infoRowLast: {
    borderBottomWidth: 0,
  },

  iconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconBoxMuted: {
    backgroundColor: '#F2F3F7',
  },

  greenIconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  logoutIconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },

  infoText: {
    flex: 1,
    minWidth: 0,
  },

  infoLabel: {
    fontSize: fontSizes.sm,
    color: MUTED,
    fontWeight: fontWeights.bold,
    marginBottom: 3,
    fontFamily: appFont,
  },

  infoValue: {
    fontSize: fontSizes.mdl,
    color: TEXT,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },

  infoSubValue: {
    fontSize: fontSizes.smd,
    color: MUTED,
    fontWeight: fontWeights.semibold,
    lineHeight: 16,
    fontFamily: appFont,
  },

  primarySmallBtn: {
    backgroundColor: PRIMARY,
    borderRadius: radii.mdl,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },

  primarySmallBtnText: {
    color: '#fff',
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },

  statusPill: {
    borderRadius: radii.full,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: radii.xs,
  },

  statusText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },

  actionTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.extrabold,
    color: TEXT,
    fontFamily: appFont,
  },

  actionSub: {
    fontSize: fontSizes.smd,
    color: MUTED,
    marginTop: 3,
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
  },

  languageRow: {
    flexDirection: 'row',
    padding: 14,
    gap: 10,
  },

  languageBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: radii.lg,
    backgroundColor: '#F3F4F8',
    alignItems: 'center',
  },

  languageBtnActive: {
    backgroundColor: PRIMARY,
  },

  languageText: {
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.extrabold,
    color: '#555B66',
    fontFamily: appFont,
  },

  languageTextActive: {
    color: '#fff',
  },

  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: radii.xxxl,
    padding: 14,
    gap: 12,
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  logoutTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.extrabold,
    color: RED,
    fontFamily: appFont,
  },

  logoutSub: {
    fontSize: fontSizes.smd,
    color: '#B45353',
    marginTop: 3,
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  footerText: {
    fontSize: fontSizes.smd,
    color: '#9CA3AF',
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,10,18,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },

  modalBox: {
    backgroundColor: '#fff',
    borderRadius: radii.massive,
    width: '92%',
    maxWidth: 430,
    overflow: 'hidden',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    gap: 14,
  },

  modalTitle: {
    marginTop: 3,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.extrabold,
    color: TEXT,
    fontFamily: appFont,
  },

  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.lg,
    backgroundColor: '#F7F8FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  modalBody: {
    padding: 18,
  },

  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: colors.successSoft,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  modalMessage: {
    fontSize: fontSizes.mdl,
    color: SOFT_TEXT,
    marginBottom: 20,
    lineHeight: 20,
    fontWeight: fontWeights.semibold,
    textAlign: 'center',
    fontFamily: appFont,
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },

  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.lgl,
    backgroundColor: colors.border,
    alignItems: 'center',
  },

  cancelBtnText: {
    fontWeight: fontWeights.extrabold,
    color: '#555B66',
    fontFamily: appFont,
  },

  dangerBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.lgl,
    backgroundColor: RED,
    alignItems: 'center',
  },

  dangerBtnText: {
    fontWeight: fontWeights.extrabold,
    color: '#fff',
    fontFamily: appFont,
  },

  fieldLabel: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.bold,
    color: '#555B66',
    marginBottom: 7,
    marginTop: 12,
    fontFamily: appFont,
  },

  pinInput: {
    borderWidth: thinBorder,
    borderColor: BORDER,
    borderRadius: radii.lg,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: fontSizes.lg,
    color: TEXT,
    backgroundColor: '#FAFAFB',
    fontFamily: appFont,
    fontWeight: fontWeights.semibold,
  },

  saveBtn: {
    backgroundColor: PRIMARY,
    borderRadius: radii.lgl,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },

addressBookSettingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: radii.xxxl,
    padding: 14,
    gap: 12,
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  addressBookSettingsIcon: {
    width: 42,
    height: 42,
    borderRadius: radii.lg,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: thinBorder,
    borderColor: '#FED7AA',
  },

  addressBookSettingsTextWrap: {
    flex: 1,
  },

  addressBookSettingsTitle: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.extrabold,
    color: TEXT,
    fontFamily: appFont,
  },

  addressBookSettingsSub: {
    fontSize: fontSizes.smd,
    color: MUTED,
    marginTop: 3,
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
  },

  addressBookModalBox: {
    backgroundColor: '#fff',
    borderRadius: radii.massive,
    width: '94%',
    maxWidth: 720,
    maxHeight: '84%',
    overflow: 'hidden',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  addressBookModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    gap: 14,
  },

  addressBookModalTitle: {
    marginTop: 3,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.extrabold,
    color: TEXT,
    fontFamily: appFont,
  },

  addressBookModalSub: {
    fontSize: fontSizes.smd,
    color: MUTED,
    fontWeight: fontWeights.semibold,
    marginTop: 3,
    fontFamily: appFont,
  },

  addressBookCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.lg,
    backgroundColor: '#F7F8FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  addressBookSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFB',
    borderRadius: radii.lg,
    margin: 16,
    marginBottom: 10,
    paddingHorizontal: 13,
    gap: 9,
    borderWidth: thinBorder,
    borderColor: BORDER,
    height: 46,
  },

  addressBookSearchInput: {
    flex: 1,
    fontSize: fontSizes.mdl,
    color: TEXT,
    padding: 0,
    fontFamily: appFont,
    fontWeight: fontWeights.medium,
  },

  addressBookList: {
    paddingHorizontal: 16,
    maxHeight: 420,
  },

  addressBookListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  addressBookEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 38,
    gap: 8,
  },

  addressBookEmptyText: {
    fontSize: fontSizes.md,
    color: MUTED,
    fontWeight: fontWeights.bold,
    fontFamily: appFont,
    textAlign: 'center',
  },

  addressBookCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFB',
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 10,
    gap: 11,
  },

  addressBookAvatar: {
    width: 42,
    height: 42,
    borderRadius: radii.full,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addressBookAvatarText: {
    fontSize: fontSizes.lgl,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    fontFamily: appFont,
  },

  addressBookCustomerInfo: {
    flex: 1,
  },

  addressBookCustomerName: {
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  addressBookCustomerPhone: {
    marginTop: 2,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.bold,
    color: '#4B5563',
    fontFamily: appFont,
  },

  addressBookCustomerAddress: {
    marginTop: 2,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.medium,
    color: MUTED,
    fontFamily: appFont,
  },

  addressBookDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.lg,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: thinBorder,
    borderColor: '#FECACA',
  },

  saveBtnDisabled: {
    backgroundColor: '#C7CBD4',
  },

  saveBtnText: {
    color: '#fff',
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },

  aboutLogo: {
    width: 170,
    height: 64,
    alignSelf: 'center',
    marginBottom: 18,
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F1F5',
  },

  contactRowLast: {
    borderBottomWidth: 0,
  },

  contactIconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  whatsappIconBox: {
    backgroundColor: '#ECFDF5',
  },

  contactText: {
    fontSize: fontSizes.mdl,
    color: TEXT,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },
});