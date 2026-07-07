import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  KeyboardAvoidingView,

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
import StaffHoursCard from '../../components/StaffHoursCard';

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

type SectionKey = 'restaurant' | 'addressBook' | 'printer' | 'staffHours' | 'dayManagement' | 'language';

type AddressBookDraft = {
  first_name: string;
  last_name: string;
  phone: string;
  street: string;
  zip: string;
  city: string;
};

type AddressBookInfoMode = 'total' | 'withAddress' | 'repeat' | 'top';

type CustomerToast = {
  type: 'success' | 'error';
  message: string;
} | null;


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
    <View>
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
          <View style={[styles.infoRow, styles.infoRowLast]}>
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
          <View style={[styles.infoRow, styles.infoRowLast]}>
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

  const [addressBookCustomers, setAddressBookCustomers] = useState<PhoneCustomer[]>([]);
  const [addressBookSearch, setAddressBookSearch] = useState('');
  const [refreshingAddressBook, setRefreshingAddressBook] = useState(false);
  const [customerDraft, setCustomerDraft] = useState<AddressBookDraft>({
    first_name: '',
    last_name: '',
    phone: '',
    street: '',
    zip: '',
    city: '',
  });
  const [editingCustomerKey, setEditingCustomerKey] = useState<string | null>(null);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerFormModal, setCustomerFormModal] = useState(false);
  const [customerFormError, setCustomerFormError] = useState('');
  const [customerToast, setCustomerToast] = useState<CustomerToast>(null);
  const [addressBookInfoMode, setAddressBookInfoMode] = useState<AddressBookInfoMode>('total');

  const addressBookFirstNameRef = useRef<TextInput>(null);
  const addressBookLastNameRef = useRef<TextInput>(null);
  const addressBookPhoneRef = useRef<TextInput>(null);
  const addressBookStreetRef = useRef<TextInput>(null);
  const addressBookZipRef = useRef<TextInput>(null);
  const addressBookCityRef = useRef<TextInput>(null);

  const currentPinRef = useRef<TextInput>(null);
  const newPinRef = useRef<TextInput>(null);
  const confirmPinRef = useRef<TextInput>(null);

  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);

  const isNarrow = windowWidth < 760;
  const effectiveSection: SectionKey = activeSection ?? 'restaurant';
  const contentWidthStyle =
    effectiveSection === 'staffHours' || effectiveSection === 'addressBook'
      ? styles.contentInnerFull
      : isNarrow
        ? styles.contentInnerMobile
        : styles.contentInnerFixed;
  const showSidebar = !isNarrow || activeSection === null;
  const showContent = !isNarrow || activeSection !== null;

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
    addCustomer: isGerman ? 'Kunde hinzufügen' : 'Add customer',
    newCustomer: isGerman ? 'Neuer Kunde' : 'New customer',
    editCustomer: isGerman ? 'Kunde bearbeiten' : 'Edit customer',
    saveCustomer: isGerman ? 'Kunde speichern' : 'Save customer',
    customerSaved: isGerman ? 'Kunde gespeichert' : 'Customer saved',
    customerPhoneRequired: isGerman ? 'Telefonnummer ist erforderlich' : 'Phone number is required',
    bestCustomers: isGerman ? 'Beste Kunden' : 'Best customers',
    customerInsights: isGerman ? 'Kundenübersicht' : 'Customer insights',
    totalCustomers: isGerman ? 'Kunden' : 'Customers',
    repeatCustomers: isGerman ? 'Stammkunden' : 'Repeat customers',
    withAddress: isGerman ? 'Mit Adresse' : 'With address',
    topCustomer: isGerman ? 'Bester Kunde' : 'Top customer',
    noCustomerSelected: isGerman ? 'Wähle einen Kunden oder füge einen neuen hinzu.' : 'Select a customer or add a new one.',
    lastOrder: isGerman ? 'Letzte Bestellung' : 'Last order',
    ordersCount: isGerman ? 'Bestellungen' : 'Orders',
    customerSavedToast: isGerman ? 'Kunde wurde gespeichert' : 'Customer saved successfully',
    customerSaveFailed: isGerman ? 'Kunde konnte nicht gespeichert werden' : 'Failed to save customer',
    refresh: isGerman ? 'Aktualisieren' : 'Refresh',
    addressBookRefreshed: isGerman ? 'Adressbuch aktualisiert' : 'Address book refreshed',
    addressBookRefreshFailed: isGerman ? 'Adressbuch konnte nicht aktualisiert werden' : 'Failed to refresh address book',
    editCustomerDetails: isGerman ? 'Kundendetails bearbeiten' : 'Edit customer details',
    close: isGerman ? 'Schliessen' : 'Close',
    customersWithAddressesInfo: isGerman ? 'Kunden mit gespeicherter Lieferadresse.' : 'Customers with a saved delivery address.',
    repeatCustomersInfo: isGerman ? 'Kunden mit mehr als einer Bestellung.' : 'Customers with more than one order.',
    topCustomerInfo: isGerman ? 'Der Kunde mit den meisten gespeicherten Bestellungen.' : 'The customer with the highest saved order count.',
    totalCustomersInfo: isGerman ? 'Alle gespeicherten Kunden im Adressbuch.' : 'All saved customers in the address book.',
  };

  const tr = (key: string, fallback: string) => ((t as any)?.[key] || fallback);

  const sidebarItems: { key: SectionKey; label: string; icon: any }[] = [
    { key: 'restaurant', label: tr('restaurantTitle', labels.restaurantTitle), icon: 'storefront-outline' },
    { key: 'addressBook', label: (t as any).addressBook || (isGerman ? 'Adressbuch' : 'Address book'), icon: 'book-outline' },
    { key: 'printer', label: (t as any)?.printerStatus || (isGerman ? 'Druckerstatus' : 'Printer Status'), icon: 'print-outline' },
    { key: 'staffHours', label: (t as any).staffHours || (isGerman ? 'Arbeitszeiten' : 'Staff Hours'), icon: 'people-outline' },
    { key: 'dayManagement', label: tr('dayManagementTitle', labels.dayManagementTitle), icon: 'refresh-circle-outline' },
    { key: 'language', label: tr('languageTitle', labels.languageTitle), icon: 'language-outline' },
  ];

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });

    return () => sub?.remove();
  }, []);

  const addressBookStorageKey = (code: string) => `posup_phone_customers_${code}`;

  const getCustomerKey = (customer: Partial<PhoneCustomer>) => [
    customer.phone || '',
    customer.first_name || '',
    customer.last_name || '',
    customer.street || '',
    customer.zip || '',
    customer.city || '',
  ].join('|');

  const emptyCustomerDraft = (): AddressBookDraft => ({
    first_name: '',
    last_name: '',
    phone: '',
    street: '',
    zip: '',
    city: '',
  });

  const loadAddressBook = useCallback(async () => {
    const code = restaurantCode || await AsyncStorage.getItem('restaurant_code') || '';
    const customers = await loadPhoneCustomers(code);
    setAddressBookCustomers(customers);
  }, [restaurantCode]);

  useEffect(() => {
    if (effectiveSection !== 'addressBook') return;
    loadAddressBook();
  }, [effectiveSection, loadAddressBook]);

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

            if (editingCustomerKey === getCustomerKey(customer)) {
              handleNewAddressBookCustomer();
            }
          },
        },
      ]
    );
  };

  const filteredAddressBookCustomers = searchPhoneCustomers(addressBookCustomers, addressBookSearch);

  const addressBookStats = useMemo(() => {
    const total = addressBookCustomers.length;
    const withAddress = addressBookCustomers.filter(customer =>
      `${customer.street || ''}${customer.zip || ''}${customer.city || ''}`.trim().length > 0
    ).length;
    const repeatCustomers = addressBookCustomers.filter(customer => Number((customer as any).order_count || 0) > 1).length;
    const sorted = [...addressBookCustomers].sort((a, b) => Number((b as any).order_count || 0) - Number((a as any).order_count || 0));
    const topCustomer = sorted[0] || null;

    return {
      total,
      withAddress,
      repeatCustomers,
      topCustomer,
    };
  }, [addressBookCustomers]);

  const topAddressBookCustomers = useMemo(() => {
    return [...addressBookCustomers]
      .filter(customer => Number((customer as any).order_count || 0) > 0)
      .sort((a, b) => Number((b as any).order_count || 0) - Number((a as any).order_count || 0))
      .slice(0, 8);
  }, [addressBookCustomers]);

  const selectedCustomer = useMemo(() => {
    if (!editingCustomerKey) return null;
    return addressBookCustomers.find(customer => getCustomerKey(customer) === editingCustomerKey) || null;
  }, [addressBookCustomers, editingCustomerKey]);

  const formatCustomerName = (customer: Partial<PhoneCustomer>) => {
    return `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || ((t as any).unknownCustomer || 'Unknown customer');
  };

  const formatCustomerAddress = (customer: Partial<PhoneCustomer>) => {
    return `${customer.street || ''}, ${customer.zip || ''} ${customer.city || ''}`.replace(/^,\s*/, '').trim();
  };

  const formatCustomerDate = (value: any) => {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return date.toLocaleDateString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const showCustomerToast = (type: 'success' | 'error', message: string) => {
    setCustomerToast({ type, message });

    setTimeout(() => {
      setCustomerToast(null);
    }, 2400);
  };

  const openCustomerForm = (customer?: PhoneCustomer) => {
    setCustomerFormError('');

    if (customer) {
      setEditingCustomerKey(getCustomerKey(customer));
      setCustomerDraft({
        first_name: customer.first_name || '',
        last_name: customer.last_name || '',
        phone: customer.phone || '',
        street: customer.street || '',
        zip: customer.zip || '',
        city: customer.city || '',
      });
    } else {
      setEditingCustomerKey(null);
      setCustomerDraft(emptyCustomerDraft());
    }

    setCustomerFormModal(true);

    setTimeout(() => {
      addressBookFirstNameRef.current?.focus();
    }, 280);
  };

  const closeCustomerForm = () => {
    setCustomerFormModal(false);
    setCustomerFormError('');
  };

  const handleNewAddressBookCustomer = () => {
    openCustomerForm();
  };

  const handleRefreshAddressBook = async () => {
    setRefreshingAddressBook(true);

    try {
      await loadAddressBook();
      showCustomerToast('success', tr('addressBookRefreshed', labels.addressBookRefreshed));
    } catch (e) {
      showCustomerToast('error', tr('addressBookRefreshFailed', labels.addressBookRefreshFailed));
    } finally {
      setRefreshingAddressBook(false);
    }
  };

  const handleSelectAddressBookCustomer = (customer: PhoneCustomer) => {
    setEditingCustomerKey(getCustomerKey(customer));
  };

  const handleEditSelectedCustomer = () => {
    if (selectedCustomer) {
      openCustomerForm(selectedCustomer);
    }
  };

  const getAddressBookInsight = () => {
    if (addressBookInfoMode === 'withAddress') {
      return {
        title: tr('withAddress', labels.withAddress),
        value: String(addressBookStats.withAddress),
        text: tr('customersWithAddressesInfo', labels.customersWithAddressesInfo),
      };
    }

    if (addressBookInfoMode === 'repeat') {
      return {
        title: tr('repeatCustomers', labels.repeatCustomers),
        value: String(addressBookStats.repeatCustomers),
        text: tr('repeatCustomersInfo', labels.repeatCustomersInfo),
      };
    }

    if (addressBookInfoMode === 'top') {
      return {
        title: tr('topCustomer', labels.topCustomer),
        value: addressBookStats.topCustomer ? formatCustomerName(addressBookStats.topCustomer) : '—',
        text: tr('topCustomerInfo', labels.topCustomerInfo),
      };
    }

    return {
      title: tr('totalCustomers', labels.totalCustomers),
      value: String(addressBookStats.total),
      text: tr('totalCustomersInfo', labels.totalCustomersInfo),
    };
  };

  const renderAddressBookStatCard = (
    mode: AddressBookInfoMode,
    label: string,
    value: string,
    icon: keyof typeof Ionicons.glyphMap
  ) => {
    const active = addressBookInfoMode === mode;

    return (
      <TouchableOpacity
        style={[styles.addressBookStatCard, active && styles.addressBookStatCardActive]}
        onPress={() => setAddressBookInfoMode(mode)}
        activeOpacity={0.78}
      >
        <View style={styles.addressBookStatTopRow}>
          <View style={[styles.addressBookStatIcon, active && styles.addressBookStatIconActive]}>
            <Ionicons name={icon} size={19} color={PRIMARY} />
          </View>

          <Text style={styles.addressBookStatValue} numberOfLines={1}>
            {value}
          </Text>
        </View>

        <Text style={styles.addressBookStatLabel} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const updateCustomerDraft = (field: keyof AddressBookDraft, value: string) => {
    setCustomerDraft(current => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSaveAddressBookCustomer = async () => {
    const phone = customerDraft.phone.trim();

    if (!phone) {
      setCustomerFormError(tr('customerPhoneRequired', labels.customerPhoneRequired));
      addressBookPhoneRef.current?.focus();
      return;
    }

    setSavingCustomer(true);
    setCustomerFormError('');

    try {
      const code = restaurantCode || await AsyncStorage.getItem('restaurant_code') || '';
      const currentCustomers = await loadPhoneCustomers(code);
      const existingByPhone = currentCustomers.find(customer => String(customer.phone || '').trim() === phone);
      const sourceCustomer = selectedCustomer || existingByPhone || {};

      const draftCustomer: PhoneCustomer = {
        ...sourceCustomer,
        first_name: customerDraft.first_name.trim(),
        last_name: customerDraft.last_name.trim(),
        phone,
        street: customerDraft.street.trim(),
        zip: customerDraft.zip.trim(),
        city: customerDraft.city.trim(),
        order_count: (sourceCustomer as any).order_count || 0,
        last_order_at: (sourceCustomer as any).last_order_at || null,
      } as PhoneCustomer;

      const nextCustomers = [
        draftCustomer,
        ...currentCustomers.filter(customer => {
          if (editingCustomerKey && getCustomerKey(customer) === editingCustomerKey) return false;
          return String(customer.phone || '').trim() !== phone;
        }),
      ];

      await AsyncStorage.setItem(addressBookStorageKey(code), JSON.stringify(nextCustomers));
      setAddressBookCustomers(nextCustomers);
      setEditingCustomerKey(getCustomerKey(draftCustomer));
      setCustomerFormModal(false);
      showCustomerToast('success', tr('customerSavedToast', labels.customerSavedToast));
    } catch (e) {
      const message = tr('customerSaveFailed', labels.customerSaveFailed);
      setCustomerFormError(message);
      showCustomerToast('error', message);
    } finally {
      setSavingCustomer(false);
    }
  };

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

      setLoading(false);

            setLoading(false);

      if (code && effectiveSection === 'printer') {
        const { fetchAndSaveProfile } = await import('../../lib/api');

        fetchAndSaveProfile(code)
          .then(profile => {
            if (profile.printer_ip) setPrinterIp(profile.printer_ip);
            if (profile.printer_port) setPrinterPort(profile.printer_port);
            if (profile.printer_model) setPrinterModel(profile.printer_model);
          })
          .catch(e => {
            console.log('Failed to refresh printer profile', e);
          });
      }
    } catch (e) {
      console.log('Failed to load settings', e);
      setLoading(false);
    }
  }, [effectiveSection]);

  useFocusEffect(
    useCallback(() => {
      loadData();

      if (effectiveSection === 'addressBook') {
        loadAddressBook();
      }
    }, [loadData, effectiveSection, loadAddressBook])
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
  const allKeys = await AsyncStorage.getAllKeys();
  const keysToPreserve = allKeys.filter(k => k.startsWith('posup_phone_customers_'));
  const keysToRemove = allKeys.filter(k => !k.startsWith('posup_phone_customers_'));
  await AsyncStorage.multiRemove(keysToRemove);
  router.replace('/');
};

  const reopenDay = async () => {
    await AsyncStorage.removeItem('day_closed_date');
    setReopenModal(true);
  };

  const ContentHeader = ({ title }: { title: string }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const renderContent = () => {
    switch (effectiveSection) {
      case 'restaurant':
        return (
          <>
            <ContentHeader title={tr('restaurantTitle', labels.restaurantTitle)} />
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
          </>
        );

      case 'addressBook': {
        const maxOrders = topAddressBookCustomers.length > 0
          ? Math.max(...topAddressBookCustomers.map(customer => Number((customer as any).order_count || 0)), 1)
          : 1;
        const insight = getAddressBookInsight();

        return (
          <>
            <View style={styles.addressBookHeaderRow}>
              <View style={styles.addressBookHeaderTextWrap}>
                <Text style={styles.sectionTitle}>{(t as any).addressBook || (isGerman ? 'Adressbuch' : 'Address book')}</Text>
                <Text style={styles.addressBookHeaderSubVisible}>
                  {isGerman ? 'Kunden, Adressen und Stammkunden' : 'Customers, addresses and regulars'}
                </Text>
              </View>

              <View style={styles.addressBookHeaderActions}>
                <TouchableOpacity
                  style={styles.addressBookRefreshBtn}
                  onPress={handleRefreshAddressBook}
                  activeOpacity={0.78}
                  disabled={refreshingAddressBook}
                >
                  {refreshingAddressBook ? (
                    <ActivityIndicator size="small" color={PRIMARY} />
                  ) : (
                    <Ionicons name="refresh-outline" size={18} color={PRIMARY} />
                  )}
                  <Text style={styles.addressBookRefreshBtnText}>{tr('refresh', labels.refresh)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addressBookAddBtn}
                  onPress={handleNewAddressBookCustomer}
                  activeOpacity={0.78}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.addressBookAddBtnText}>{tr('newCustomer', labels.newCustomer)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {customerToast ? (
              <View style={[styles.customerToast, customerToast.type === 'error' && styles.customerToastError]}>
                <Ionicons
                  name={customerToast.type === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                  size={18}
                  color={customerToast.type === 'error' ? RED : GREEN}
                />
                <Text style={[styles.customerToastText, customerToast.type === 'error' && styles.customerToastTextError]}>
                  {customerToast.message}
                </Text>
              </View>
            ) : null}

            <View style={[styles.addressBookLayout, isNarrow && styles.addressBookLayoutMobile]}>
              <View style={[styles.addressBookListCard, isNarrow && styles.addressBookColumnMobile]}>
                <View style={styles.addressBookPanelHeaderCompact}>
                  <View style={styles.addressBookHeaderTextWrap}>
                    <Text style={styles.addressBookPanelTitle}>{isGerman ? 'Kundenliste' : 'Customer list'}</Text>
                    <Text style={styles.addressBookPanelSub}>{isGerman ? 'Suchen, öffnen, bearbeiten' : 'Search, open, edit'}</Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.addressBookCountBox, addressBookInfoMode === 'total' && styles.addressBookCountBoxActive]}
                    onPress={() => setAddressBookInfoMode('total')}
                    activeOpacity={0.78}
                  >
                    <Ionicons name="people-outline" size={18} color={PRIMARY} />
                    <Text style={styles.addressBookCountBoxText}>{addressBookStats.total}</Text>
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
                    returnKeyType="search"
                  />
                </View>

                <ScrollView
                  style={styles.addressBookListScroll}
                  contentContainerStyle={styles.addressBookListInline}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredAddressBookCustomers.length === 0 ? (
                    <View style={styles.addressBookEmpty}>
                      <Ionicons name="person-circle-outline" size={46} color="#C7CBD4" />
                      <Text style={styles.addressBookEmptyText}>
                        {(t as any).noSavedCustomers || (language === 'de' ? 'Noch keine Kunden gespeichert' : 'No saved customers yet')}
                      </Text>
                      <Text style={styles.addressBookEmptySubText}>
                        {isGerman ? 'Tippe auf Neuer Kunde oder Aktualisieren.' : 'Tap New customer or Refresh.'}
                      </Text>
                    </View>
                  ) : (
                    filteredAddressBookCustomers.map((customer, index) => {
                      const name = formatCustomerName(customer);
                      const address = formatCustomerAddress(customer);
                      const activeCustomer = editingCustomerKey === getCustomerKey(customer);
                      const orderCount = Number((customer as any).order_count || 0);

                      return (
                        <TouchableOpacity
                          key={`${customer.phone}-${customer.street}-${index}`}
                          style={[styles.addressBookCustomerCard, activeCustomer && styles.addressBookCustomerCardActive]}
                          onPress={() => handleSelectAddressBookCustomer(customer)}
                          activeOpacity={0.78}
                        >
                          <View style={styles.addressBookAvatar}>
                            <Text style={styles.addressBookAvatarText}>
                              {name.trim()[0]?.toUpperCase() || '?'}
                            </Text>
                          </View>

                          <View style={styles.addressBookCustomerInfo}>
                            <View style={styles.addressBookCustomerTopLine}>
                              <Text style={styles.addressBookCustomerName} numberOfLines={1}>
                                {name}
                              </Text>

                              {orderCount > 0 ? (
                                <View style={styles.addressBookOrderPill}>
                                  <Text style={styles.addressBookOrderPillText}>{orderCount}x</Text>
                                </View>
                              ) : null}
                            </View>

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
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>

              <View style={[styles.addressBookRightColumn, isNarrow && styles.addressBookColumnMobile]}>
                <View style={styles.addressBookInsightsCard}>
                  <View style={styles.addressBookPanelHeaderNoPadding}>
                    <View style={styles.addressBookInsightTitleWrap}>
                      <Text style={styles.addressBookPanelTitle}>
                        {selectedCustomer ? formatCustomerName(selectedCustomer) : tr('customerInsights', labels.customerInsights)}
                      </Text>
                      <Text style={styles.addressBookPanelSub}>
                        {selectedCustomer
                          ? `${Number((selectedCustomer as any).order_count || 0)} ${tr('ordersCount', labels.ordersCount).toLowerCase()} · ${tr('lastOrder', labels.lastOrder)} ${formatCustomerDate((selectedCustomer as any).last_order_at)}`
                          : insight.text}
                      </Text>
                    </View>

                    {selectedCustomer ? (
                      <TouchableOpacity style={styles.addressBookMiniBtn} onPress={handleEditSelectedCustomer} activeOpacity={0.75}>
                        <Ionicons name="create-outline" size={17} color={PRIMARY} />
                        <Text style={styles.addressBookMiniBtnText}>{isGerman ? 'Bearbeiten' : 'Edit'}</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.addressBookInsightValueBox}>
                        <Text style={styles.addressBookInsightValue} numberOfLines={1}>{insight.value}</Text>
                      </View>
                    )}
                  </View>

                  {selectedCustomer ? (
                    <View style={styles.addressBookSelectedSummaryClean}>
                      <View style={styles.addressBookDetailRow}>
                        <Ionicons name="call-outline" size={16} color={MUTED} />
                        <Text style={styles.addressBookSelectedLine}>{selectedCustomer.phone || '—'}</Text>
                      </View>
                      <View style={styles.addressBookDetailRow}>
                        <Ionicons name="location-outline" size={16} color={MUTED} />
                        <Text style={styles.addressBookSelectedLine}>{formatCustomerAddress(selectedCustomer) || '—'}</Text>
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.addressBookQuickStatsRow}>
                    {renderAddressBookStatCard('total', tr('totalCustomers', labels.totalCustomers), String(addressBookStats.total), 'people-outline')}
                    {renderAddressBookStatCard('repeat', tr('repeatCustomers', labels.repeatCustomers), String(addressBookStats.repeatCustomers), 'repeat-outline')}
                    {renderAddressBookStatCard('top', tr('topCustomer', labels.topCustomer), addressBookStats.topCustomer ? String(Number((addressBookStats.topCustomer as any).order_count || 0)) : '0', 'star-outline')}
                  </View>
                </View>

                <View style={styles.addressBookInsightsCard}>
                  <View style={styles.addressBookPanelHeaderNoPadding}>
                    <View>
                      <Text style={styles.addressBookPanelTitle}>{tr('bestCustomers', labels.bestCustomers)}</Text>
                      <Text style={styles.addressBookPanelSub}>
                        {isGerman ? 'Kunden mit den meisten Bestellungen' : 'Customers with the most orders'}
                      </Text>
                    </View>

                    <View style={styles.addressBookInsightIcon}>
                      <Ionicons name="bar-chart-outline" size={19} color={PRIMARY} />
                    </View>
                  </View>

                  {topAddressBookCustomers.length === 0 ? (
                    <View style={styles.addressBookEmptyChart}>
                      <Ionicons name="analytics-outline" size={40} color="#C7CBD4" />
                      <Text style={styles.addressBookEmptyText}>
                        {isGerman ? 'Noch keine Bestellhistorie' : 'No customer order history yet'}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.addressBookChartList}>
                      {topAddressBookCustomers.map(customer => {
                        const orderCount = Number((customer as any).order_count || 0);
                        const width = `${Math.max(8, (orderCount / maxOrders) * 100)}%`;

                        return (
                          <TouchableOpacity
                            key={getCustomerKey(customer)}
                            style={styles.addressBookChartRow}
                            onPress={() => handleSelectAddressBookCustomer(customer)}
                            activeOpacity={0.78}
                          >
                            <View style={styles.addressBookChartRowTop}>
                              <Text style={styles.addressBookChartName} numberOfLines={1}>{formatCustomerName(customer)}</Text>
                              <Text style={styles.addressBookChartCount}>{orderCount}x</Text>
                            </View>

                            <View style={styles.addressBookChartTrack}>
                              <View style={[styles.addressBookChartFill, { width: width as any }]} />
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            </View>
          </>
        );
      }


      case 'printer':
        return (
          <PrinterStatusCard
            t={t}
            language={language}
            printerIp={printerIp}
            printerPort={printerPort}
            printerModel={printerModel}
          />
        );

      case 'staffHours':
        return <StaffHoursCard restaurantCode={restaurantCode} language={language} />;

      case 'dayManagement':
        return (
          <>
            <ContentHeader title={tr('dayManagementTitle', labels.dayManagementTitle)} />
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
          </>
        );

      case 'language':
        return (
          <>
            <ContentHeader title={tr('languageTitle', labels.languageTitle)} />
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
          </>
        );

      default:
        return null;
    }
  };

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
      <View style={styles.splitContainer}>
        {showSidebar && (
          <View style={[styles.sidebar, isNarrow && styles.sidebarNarrow]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {sidebarItems.map(item => {
                const active = !isNarrow && effectiveSection === item.key;

                return (
                  <TouchableOpacity
                    key={item.key}
                    style={[styles.sidebarItem, active && styles.sidebarItemActive]}
                    onPress={() => setActiveSection(item.key)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.sidebarIconBox, active && styles.sidebarIconBoxActive]}>
                      <Ionicons name={item.icon} size={18} color={active ? PRIMARY : '#6B7280'} />
                    </View>
                    <Text style={[styles.sidebarLabel, active && styles.sidebarLabelActive]}>
                      {item.label}
                    </Text>

                    {item.key === 'staffHours' ? (
                      <Ionicons
                        name="lock-closed-outline"
                        size={15}
                        color={active ? PRIMARY : '#9CA3AF'}
                      />
                    ) : isNarrow ? (
                      <Ionicons name="chevron-forward" size={16} color="#C0C4CE" />
                    ) : null}
                  </TouchableOpacity>
                );
              })}

              <View style={styles.sidebarDivider} />

              <TouchableOpacity
                style={styles.sidebarItem}
                onPress={() => setLogoutModal(true)}
                activeOpacity={0.75}
              >
                <View style={[styles.sidebarIconBox, { backgroundColor: colors.dangerSoft }]}>
                  <Ionicons name="log-out-outline" size={18} color={RED} />
                </View>
                <Text style={[styles.sidebarLabel, styles.sidebarLabelDanger]}>{t.logout}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sidebarItem}
                onPress={() => setAboutModal(true)}
                activeOpacity={0.75}
              >
                <View style={styles.sidebarIconBox}>
                  <Ionicons name="information-circle-outline" size={18} color="#6B7280" />
                </View>
                <Text style={styles.sidebarLabel}>
                  {isGerman ? 'Über FoodUp' : 'About FoodUp'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}

        {showContent && (
          <ScrollView
            style={styles.contentPane}
            contentContainerStyle={[styles.contentInnerPane, contentWidthStyle]}
            showsVerticalScrollIndicator={false}
          >
            {isNarrow && (
              <TouchableOpacity style={styles.backRow} onPress={() => setActiveSection(null)} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={20} color={PRIMARY} />
                <Text style={styles.backText}>{t.settings}</Text>
              </TouchableOpacity>
            )}

            {renderContent()}
          </ScrollView>
        )}
      </View>

      <Modal visible={customerFormModal} transparent animationType="fade" onRequestClose={closeCustomerForm}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'android' ? 24 : 0}
        >
          <TouchableOpacity
            style={styles.customerModalBackdropTouch}
            activeOpacity={1}
            onPress={closeCustomerForm}
          >
            <TouchableOpacity
              style={[styles.modalBox, styles.customerFormModalBox]}
              activeOpacity={1}
              onPress={e => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>
                    {editingCustomerKey ? tr('editCustomer', labels.editCustomer) : tr('newCustomer', labels.newCustomer)}
                  </Text>
                  <Text style={styles.customerModalSubText}>
                    {isGerman ? 'Kundendetails schnell speichern.' : 'Quickly save customer details.'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={closeCustomerForm}
                  style={styles.modalCloseBtn}
                  activeOpacity={0.75}
                >
                  <Ionicons name="close" size={18} color="#5B5F6B" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.customerFormScroll}
                contentContainerStyle={styles.customerFormModalContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {customerFormError ? (
                  <View style={styles.customerFormErrorBox}>
                    <Ionicons name="alert-circle-outline" size={18} color={RED} />
                    <Text style={styles.customerFormErrorText}>{customerFormError}</Text>
                  </View>
                ) : null}

                <View style={styles.addressBookFormGrid}>
                  <View style={styles.addressBookFieldHalf}>
                    <TextInput
                      ref={addressBookFirstNameRef}
                      style={styles.addressBookInput}
                      value={customerDraft.first_name}
                      onChangeText={value => updateCustomerDraft('first_name', value)}
                      placeholder={isGerman ? 'Vorname' : 'First name'}
                      placeholderTextColor="#A8ACB7"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => addressBookLastNameRef.current?.focus()}
                    />
                  </View>

                  <View style={styles.addressBookFieldHalf}>
                    <TextInput
                      ref={addressBookLastNameRef}
                      style={styles.addressBookInput}
                      value={customerDraft.last_name}
                      onChangeText={value => updateCustomerDraft('last_name', value)}
                      placeholder={isGerman ? 'Nachname' : 'Last name'}
                      placeholderTextColor="#A8ACB7"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => addressBookPhoneRef.current?.focus()}
                    />
                  </View>
                </View>

                <TextInput
                  ref={addressBookPhoneRef}
                  style={styles.addressBookInput}
                  value={customerDraft.phone}
                  onChangeText={value => {
                    updateCustomerDraft('phone', value);
                    if (customerFormError) setCustomerFormError('');
                  }}
                  placeholder={isGerman ? 'Telefonnummer' : 'Phone number'}
                  placeholderTextColor="#A8ACB7"
                  keyboardType="phone-pad"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => addressBookStreetRef.current?.focus()}
                />

                <TextInput
                  ref={addressBookStreetRef}
                  style={styles.addressBookInput}
                  value={customerDraft.street}
                  onChangeText={value => updateCustomerDraft('street', value)}
                  placeholder={isGerman ? 'Strasse und Hausnummer' : 'Street and house number'}
                  placeholderTextColor="#A8ACB7"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => addressBookZipRef.current?.focus()}
                />

                <View style={styles.addressBookFormGrid}>
                  <View style={styles.addressBookZipField}>
                    <TextInput
                      ref={addressBookZipRef}
                      style={styles.addressBookInput}
                      value={customerDraft.zip}
                      onChangeText={value => updateCustomerDraft('zip', value)}
                      placeholder={isGerman ? 'PLZ' : 'ZIP'}
                      placeholderTextColor="#A8ACB7"
                      keyboardType="number-pad"
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => addressBookCityRef.current?.focus()}
                    />
                  </View>

                  <View style={styles.addressBookCityField}>
                    <TextInput
                      ref={addressBookCityRef}
                      style={styles.addressBookInput}
                      value={customerDraft.city}
                      onChangeText={value => updateCustomerDraft('city', value)}
                      placeholder={isGerman ? 'Ort' : 'City'}
                      placeholderTextColor="#A8ACB7"
                      returnKeyType="done"
                      blurOnSubmit={false}
                      onSubmitEditing={handleSaveAddressBookCustomer}
                    />
                  </View>
                </View>

                <View style={styles.customerFormActions}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={closeCustomerForm}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.cancelBtnText}>{tr('close', labels.close)}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.customerFormSaveBtn, savingCustomer && styles.saveBtnDisabled]}
                    onPress={handleSaveAddressBookCustomer}
                    disabled={savingCustomer}
                    activeOpacity={0.8}
                  >
                    {savingCustomer ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="save-outline" size={18} color="#fff" />
                        <Text style={styles.addressBookSaveBtnText}>{tr('saveCustomer', labels.saveCustomer)}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

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
                ref={currentPinRef}
                style={styles.pinInput}
                placeholder={t.currentPin}
                placeholderTextColor="#A8ACB7"
                value={currentPin}
                onChangeText={setCurrentPin}
                secureTextEntry
                keyboardType="number-pad"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => newPinRef.current?.focus()}
              />

              <Text style={styles.fieldLabel}>{t.newPin}</Text>
              <TextInput
                ref={newPinRef}
                style={styles.pinInput}
                placeholder={t.newPin}
                placeholderTextColor="#A8ACB7"
                value={newPin}
                onChangeText={setNewPin}
                secureTextEntry
                keyboardType="number-pad"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => confirmPinRef.current?.focus()}
              />

              <Text style={styles.fieldLabel}>{t.confirmPin}</Text>
              <TextInput
                ref={confirmPinRef}
                style={styles.pinInput}
                placeholder={t.confirmPin}
                placeholderTextColor="#A8ACB7"
                value={confirmPin}
                onChangeText={setConfirmPin}
                secureTextEntry
                keyboardType="number-pad"
                returnKeyType="done"
                blurOnSubmit={false}
                onSubmitEditing={handleChangePin}
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

  splitContainer: {
    flex: 1,
    flexDirection: 'row',
  },

  sidebar: {
    width: 260,
    backgroundColor: CARD_BG,
    borderRightWidth: thinBorder,
    borderRightColor: BORDER,
  },

  sidebarNarrow: {
    width: '100%',
    borderRightWidth: 0,
  },

  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  sidebarItemActive: {
    backgroundColor: PRIMARY_SOFT,
  },

  sidebarIconBox: {
    width: 34,
    height: 34,
    borderRadius: radii.lg,
    backgroundColor: '#F2F3F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sidebarIconBoxActive: {
    backgroundColor: '#fff',
  },

  sidebarLabel: {
    flex: 1,
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.bold,
    color: TEXT,
    fontFamily: appFont,
  },

  sidebarLabelActive: {
    color: PRIMARY,
    fontWeight: fontWeights.extrabold,
  },

  sidebarLabelDanger: {
    color: RED,
  },

  sidebarDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginVertical: 8,
    marginHorizontal: 16,
  },

  contentPane: {
    flex: 1,
    backgroundColor: APP_BG,
  },

    contentInnerPane: {
    padding: 12,
    paddingBottom: Platform.OS === 'android' ? 150 : 130,
  },

  contentInnerFixed: {
    width: 500,
    maxWidth: 500,
    alignSelf: 'flex-start',
  },

  contentInnerFull: {
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'stretch',
  },

  contentInnerMobile: {
    width: '100%',
    maxWidth: '100%',
  },

  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },

  backText: {
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.bold,
    color: PRIMARY,
    fontFamily: appFont,
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

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    gap: 10,
  },

  modalTitle: {
    marginTop: 0,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.extrabold,
    color: TEXT,
    fontFamily: appFont,
  },

  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.lg,
    backgroundColor: '#F7F8FA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  modalBody: {
    padding: 14,
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
    minHeight: 40,
    paddingVertical: 10,
    borderRadius: radii.mdl,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
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

  addressBookHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },

  addressBookHeaderRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },

  addressBookHeaderSub: {
    display: 'none',
    marginTop: 0,
    fontSize: fontSizes.smd,
    color: MUTED,
    fontWeight: fontWeights.semibold,
    lineHeight: 16,
    fontFamily: appFont,
  },

  addressBookHeaderSubVisible: {
    marginTop: 1,
    fontSize: fontSizes.smd,
    color: MUTED,
    fontWeight: fontWeights.semibold,
    lineHeight: 16,
    fontFamily: appFont,
  },

  addressBookHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },

  addressBookRefreshBtn: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: CARD_BG,
    borderRadius: radii.mdl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  addressBookRefreshBtnText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    color: PRIMARY,
    fontFamily: appFont,
  },

  addressBookAddBtn: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    borderRadius: radii.mdl,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },

  addressBookAddBtnText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    color: '#fff',
    fontFamily: appFont,
  },

  addressBookStatsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginBottom: 8,
  },

  addressBookQuickStatsRow: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 10,
  },

  addressBookStatCard: {
    flex: 1,
    minHeight: 54,
    backgroundColor: '#FAFAFB',
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: BORDER,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },

  addressBookStatCardWide: {
    flexGrow: 2,
    flexBasis: 180,
    minHeight: 58,
    backgroundColor: PRIMARY_SOFT,
    borderRadius: radii.lg,
    borderWidth: thinBorder,
    borderColor: PRIMARY_BORDER,
    paddingHorizontal: 9,
    paddingVertical: 8,
    justifyContent: 'center',
  },

  addressBookStatIcon: {
    width: 26,
    height: 26,
    borderRadius: radii.sm,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addressBookStatValue: {
    fontSize: fontSizes.lgl,
    fontWeight: fontWeights.black,
    color: TEXT,
    lineHeight: 21,
    fontFamily: appFont,
  },

  addressBookStatLabel: {
    marginTop: 1,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.extrabold,
    color: MUTED,
    fontFamily: appFont,
  },

  addressBookTopCustomerName: {
    marginTop: 4,
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    fontFamily: appFont,
  },

  addressBookTopCustomerSub: {
    marginTop: 2,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: SOFT_TEXT,
    fontFamily: appFont,
  },

  addressBookLayout: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  addressBookLayoutMobile: {
    flexDirection: 'column',
  },

  addressBookColumnMobile: {
    width: '100%',
    minWidth: 0,
  },

  addressBookListCard: {
    flex: 1.05,
    minWidth: 310,
    backgroundColor: CARD_BG,
    borderRadius: radii.xl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    overflow: 'hidden',
  },

  addressBookRightColumn: {
    flex: 0.95,
    minWidth: 300,
    gap: 10,
  },

  addressBookInsightsCard: {
    backgroundColor: CARD_BG,
    borderRadius: radii.xl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    padding: 12,
  },

  addressBookPanelHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    paddingBottom: 12,
  },

  addressBookFormCard: {
    backgroundColor: CARD_BG,
    borderRadius: radii.xxxl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    padding: 16,
  },

  addressBookFormCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },

  addressBookPanelTitle: {
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  addressBookPanelSub: {
    marginTop: 1,
    fontSize: fontSizes.smd,
    color: MUTED,
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
  },

  addressBookMiniBtn: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    backgroundColor: PRIMARY_SOFT,
    borderWidth: thinBorder,
    borderColor: PRIMARY_BORDER,
  },

  addressBookMiniBtnText: {
    fontSize: fontSizes.sm,
    color: PRIMARY,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },

  addressBookSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFB',
    borderRadius: radii.mdl,
    marginHorizontal: 10,
    marginBottom: 8,
    paddingHorizontal: 10,
    gap: 7,
    borderWidth: thinBorder,
    borderColor: BORDER,
    height: 40,
  },

  addressBookSearchInput: {
    flex: 1,
    fontSize: fontSizes.mdl,
    color: TEXT,
    padding: 0,
    fontFamily: appFont,
    fontWeight: fontWeights.medium,
  },

  addressBookListInline: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    maxHeight: 520,
  },

  addressBookEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 22,
    gap: 6,
  },

  addressBookEmptyText: {
    fontSize: fontSizes.mdl,
    color: MUTED,
    fontWeight: fontWeights.bold,
    fontFamily: appFont,
    textAlign: 'center',
  },

  addressBookEmptySubText: {
    fontSize: fontSizes.smd,
    color: MUTED,
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
    textAlign: 'center',
  },

  addressBookCustomerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFB',
    borderRadius: radii.mdl,
    borderWidth: thinBorder,
    borderColor: BORDER,
    paddingHorizontal: 9,
    paddingVertical: 8,
    marginBottom: 7,
    gap: 8,
  },

  addressBookCustomerCardActive: {
    backgroundColor: PRIMARY_SOFT,
    borderColor: PRIMARY_BORDER,
  },

  addressBookAvatar: {
    width: 34,
    height: 34,
    borderRadius: radii.full,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addressBookAvatarText: {
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    fontFamily: appFont,
  },

  addressBookCustomerInfo: {
    flex: 1,
    minWidth: 0,
  },

  addressBookCustomerTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  addressBookCustomerName: {
    flex: 1,
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  addressBookOrderPill: {
    borderRadius: radii.full,
    backgroundColor: '#fff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: thinBorder,
    borderColor: PRIMARY_BORDER,
  },

  addressBookOrderPillText: {
    fontSize: 10,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    fontFamily: appFont,
  },

  addressBookCustomerPhone: {
    marginTop: 1,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.bold,
    color: '#4B5563',
    fontFamily: appFont,
  },

  addressBookCustomerAddress: {
    marginTop: 1,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.medium,
    color: MUTED,
    fontFamily: appFont,
  },

  addressBookDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: radii.mdl,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: thinBorder,
    borderColor: '#FECACA',
  },

  addressBookFormGrid: {
    flexDirection: 'row',
    gap: 7,
  },

  addressBookFieldHalf: {
    flex: 1,
  },

  addressBookZipField: {
    width: 88,
  },

  addressBookCityField: {
    flex: 1,
  },

  addressBookInput: {
    height: 40,
    borderWidth: thinBorder,
    borderColor: BORDER,
    borderRadius: radii.mdl,
    paddingHorizontal: 10,
    paddingVertical: 0,
    fontSize: fontSizes.mdl,
    color: TEXT,
    backgroundColor: '#FAFAFB',
    fontFamily: appFont,
    fontWeight: fontWeights.semibold,
  },

  addressBookSaveBtn: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: radii.lgl,
    marginTop: 18,
  },

  addressBookSaveBtnText: {
    color: '#fff',
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },

  addressBookInsightIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.mdl,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addressBookEmptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },

  addressBookChartList: {
    gap: 8,
  },

  addressBookChartRow: {
    gap: 4,
  },

  addressBookChartRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },

  addressBookChartName: {
    flex: 1,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.bold,
    color: TEXT,
    fontFamily: appFont,
  },

  addressBookChartCount: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    fontFamily: appFont,
  },

  addressBookChartTrack: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: '#EEF0F5',
    overflow: 'hidden',
  },

  addressBookChartFill: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: PRIMARY,
  },

  addressBookSelectedSummary: {
    marginTop: 16,
    padding: 13,
    borderRadius: radii.lg,
    backgroundColor: '#FAFAFB',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  addressBookSelectedTitle: {
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  addressBookSelectedLine: {
    flex: 1,
    marginTop: 0,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.semibold,
    color: MUTED,
    fontFamily: appFont,
  },


  addressBookCountBox: {
    minWidth: 62,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radii.mdl,
    backgroundColor: PRIMARY_SOFT,
    borderWidth: thinBorder,
    borderColor: PRIMARY_BORDER,
    paddingHorizontal: 10,
  },

  addressBookCountBoxActive: {
    backgroundColor: PRIMARY_SOFT,
    borderColor: PRIMARY,
  },

  addressBookCountBoxText: {
    fontSize: fontSizes.lgl,
    color: PRIMARY,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
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

  customerToast: {
    width: '100%',
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: colors.successSoft,
    borderRadius: radii.mdl,
    borderWidth: thinBorder,
    borderColor: '#BBF7D0',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },

  customerToastError: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#FECACA',
  },

  customerToastText: {
    flex: 1,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    color: GREEN,
    fontFamily: appFont,
  },

  customerToastTextError: {
    color: RED,
  },

  customerModalBackdropTouch: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 10 : 18,
    paddingBottom: 12,
  },

  customerFormModalBox: {
    maxWidth: 520,
    maxHeight: '78%',
  },

  customerModalSubText: {
    display: 'none',
    marginTop: 0,
    fontSize: fontSizes.xs,
    color: MUTED,
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
  },

  customerFormScroll: {
    maxHeight: 360,
  },

  customerFormModalContent: {
    padding: 12,
    gap: 8,
    paddingBottom: Platform.OS === 'android' ? 34 : 16,
  },

  customerFormErrorBox: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerSoft,
    borderWidth: thinBorder,
    borderColor: '#FECACA',
    borderRadius: radii.mdl,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },

  customerFormErrorText: {
    flex: 1,
    fontSize: fontSizes.smd,
    color: RED,
    fontWeight: fontWeights.bold,
    fontFamily: appFont,
  },

  customerFormActions: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 2,
  },

  customerFormSaveBtn: {
    flex: 1.25,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: PRIMARY,
    borderRadius: radii.mdl,
  },

  addressBookHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
  },

  addressBookStatCardActive: {
    backgroundColor: PRIMARY_SOFT,
    borderColor: PRIMARY_BORDER,
  },

  addressBookStatTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginBottom: 4,
  },

  addressBookStatIconActive: {
    backgroundColor: '#fff',
  },

  addressBookPanelHeaderCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },

  addressBookPanelHeaderNoPadding: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },

  addressBookListScroll: {
    maxHeight: 540,
  },

  addressBookInsightTitleWrap: {
    flex: 1,
    minWidth: 0,
  },

  addressBookInsightValueBox: {
    minWidth: 48,
    maxWidth: 150,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_SOFT,
    borderRadius: radii.mdl,
    borderWidth: thinBorder,
    borderColor: PRIMARY_BORDER,
    paddingHorizontal: 9,
  },

  addressBookInsightValue: {
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    fontFamily: appFont,
  },

  addressBookSelectedSummaryClean: {
    gap: 6,
  },

  addressBookDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 2,
  },

});
