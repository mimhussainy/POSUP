import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  ActivityIndicator,
  StyleSheet,
  TextInput,
  Dimensions,
  Platform,
  Animated,
  Alert,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fetchRestaurantData } from '../../lib/api';
import { printOrder } from '../../lib/printer';
import { useLanguage } from '../../lib/LanguageContext';
import { appFont } from '../../lib/fonts';
import { colors, borders, radii, fontSizes, fontWeights } from '../../lib/theme';
import { publishDisplayState } from '../../lib/customerDisplayStore';

const PRIMARY = colors.primary;
const PRIMARY_SOFT = colors.primarySoft;

const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';

const APP_BG = colors.appBg;
const CARD_BG = colors.cardBg;
const BORDER = colors.borderStrong;
const TEXT = colors.text;
const MUTED = colors.muted;

const DARK = colors.dark;
const DARK_CARD = colors.darkCard;
const DARK_CARD_2 = colors.darkCard2;
const DARK_BORDER = colors.darkBorder;

const CATEGORY_COLORS = [
  '#EF4444',
  '#F97316',
  '#EAB308',
  '#22C55E',
  '#06B6D4',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F59E0B',
  '#84CC16',
  '#64748B',
  '#A855F7',
  '#F43F5E',
  '#10B981',
];

const getLayout = (width: number) => {
  const isCompact = width < 900;
  const isLarge = width > 1440;

  const catSidebar = isCompact
  ? Math.max(133, Math.min(157, width * 0.15 + 25))
  : Math.max(167, Math.min(209, width * 0.115 + 25));

  const orderPanel = isCompact
    ? Math.max(292, Math.min(344, width * 0.34))
    : isLarge
      ? Math.max(380, Math.min(430, width * 0.21))
      : Math.max(340, Math.min(398, width * 0.27));

  const productArea = width - orderPanel - catSidebar;

  const numColumns =
    productArea > 1650 ? 5 :
    productArea > 1050 ? 4 :
    productArea > 720 ? 3 :
    2;

  const gapPercent = 1;
  const totalGap = gapPercent * (numColumns - 1);
  const cardWidth = (100 - totalGap) / numColumns;

  const addonModalWidth = isCompact
    ? Math.min(width - 32, 560)
    : Math.min(760, width * 0.52);

  const discountModalWidth = Math.min(width - 32, 390);

  return {
    isCompact,
    isLarge,
    orderPanel,
    catSidebar,
    productArea,
    numColumns,
    cardWidth,
    addonModalWidth,
    discountModalWidth,
  };
};

// getCatColor now imported from lib/theme

function money(value: any): number {
  const n = parseFloat(String(value ?? 0).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

interface CartItem {
  id: string;
  product: any;
  variation: any | null;
  addons: any[];
  note: string;
  price: number;
  quantity: number;
}

type PhoneOrderMode = 'pickup' | 'delivery';

type PhoneCustomer = {
  first_name: string;
  last_name: string;
  phone: string;
  street: string;
  zip: string;
  city: string;
  id?: string;
  order_count?: number;
  last_order_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const emptyPhoneCustomer: PhoneCustomer = {
  first_name: '',
  last_name: '',
  phone: '',
  street: '',
  zip: '',
  city: '',
};

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function CategoryButton({
  cat,
  active,
  letter,
  color,
  onPress,
}: {
  cat: any;
  active: boolean;
  letter: string;
  color: string;
  onPress: () => void;
}) {
  const activeAnim = useRef(new Animated.Value(active ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(activeAnim, {
      toValue: active ? 1 : 0,
      speed: 18,
      bounciness: 6,
      useNativeDriver: false,
    }).start();
  }, [active, activeAnim]);

  const backgroundColor = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#FFFFFF', PRIMARY_SOFT],
  });

  const barOpacity = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const barScaleY = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  const badgeScale = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  return (
    <AnimatedTouchable
      style={[
        styles.catItem,
        active && styles.catItemActive,
        { backgroundColor },
      ]}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Animated.View
        style={[
          styles.catActiveBar,
          {
            opacity: barOpacity,
            transform: [{ scaleY: barScaleY }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.catBadge,
          {
            backgroundColor: active ? PRIMARY : `${color}24`,
            borderColor: active ? PRIMARY : `${color}55`,
            borderWidth: 1,
            transform: [{ scale: badgeScale }],
          },
        ]}
      >
        <Text
          style={[
            styles.catBadgeLetter,
            {
              color: active ? '#fff' : color,
            },
          ]}
        >
          {letter}
        </Text>
      </Animated.View>

      <Text
        style={[
          styles.catItemText,
          active && styles.catItemTextActive,
        ]}
        numberOfLines={2}
      >
        {cat.name}
      </Text>
    </AnimatedTouchable>
  );
}
export default function NewOrderScreen() {
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [categories, setCategories] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [addons, setAddons] = useState<any[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'twint'>('cash');

  const [note, setNote] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');

  const [discountModal, setDiscountModal] = useState(false);
  const [tableModal, setTableModal] = useState(false);
  const [clearModal, setClearModal] = useState(false);
  const [addonModal, setAddonModal] = useState(false);

  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'takeaway' | 'table' | 'phone' | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [selectedVariation, setSelectedVariation] = useState<any>(null);
  const [selectedAddonOptions, setSelectedAddonOptions] = useState<Record<string, string[]>>({});
  const [addonError, setAddonError] = useState('');
  const [productAddons, setProductAddons] = useState<any[]>([]);

  const [placingOrder, setPlacingOrder] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [restaurantCode, setRestaurantCode] = useState('');
  const [restaurantLogo, setRestaurantLogo] = useState('');

  const [layout, setLayout] = useState(getLayout(Dimensions.get('window').width));

  const [phoneModal, setPhoneModal] = useState(false);
  const [addressBookModal, setAddressBookModal] = useState(false);
  const [phoneOrderMode, setPhoneOrderMode] = useState<PhoneOrderMode>('pickup');
  const [phoneCustomer, setPhoneCustomer] = useState<PhoneCustomer>(emptyPhoneCustomer);
  const [phoneCustomers, setPhoneCustomers] = useState<PhoneCustomer[]>([]);
  const [phoneCustomerSearch, setPhoneCustomerSearch] = useState('');
  const [phoneCustomerError, setPhoneCustomerError] = useState('');

  const phoneFirstNameRef = useRef<TextInput>(null);
  const phoneLastNameRef = useRef<TextInput>(null);
  const phoneNumberRef = useRef<TextInput>(null);
  const phoneStreetRef = useRef<TextInput>(null);
  const phoneZipRef = useRef<TextInput>(null);
  const phoneCityRef = useRef<TextInput>(null);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setLayout(getLayout(window.width));
    });

    return () => sub?.remove();
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(useCallback(() => {
    if (!restaurantCode) loadData();
  }, [restaurantCode]));

  useEffect(() => {
    if (restaurantCode) {
      loadPhoneCustomers(restaurantCode);
    }
  }, [restaurantCode]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  
  const switchCategory = (categoryId: string) => {
    if (selectedCategory === categoryId && !searchQuery) return;

    setSelectedCategory(categoryId);
    setSearchQuery('');
  };

  async function loadData(force = false) {
    if (force) setRefreshing(true);
    else setLoading(true);

    try {
      const code = await AsyncStorage.getItem('restaurant_code') || '';
      setRestaurantCode(code);

      const savedLogo = await AsyncStorage.getItem('restaurant_logo');
      if (savedLogo) setRestaurantLogo(savedLogo);

      const data = await fetchRestaurantData(code);

      if (data.restaurant?.logo_url) {
        setRestaurantLogo(data.restaurant.logo_url);
        await AsyncStorage.setItem('restaurant_logo', data.restaurant.logo_url);
      }

      if (data.restaurant?.name) {
        await AsyncStorage.setItem('restaurant_name', data.restaurant.name);
      }

      const { fetchAndSaveProfile } = await import('../../lib/api');
      const profile = await fetchAndSaveProfile(code);

      if (profile.printer_ip) await AsyncStorage.setItem('printer_ip', profile.printer_ip);
      if (profile.printer_port) await AsyncStorage.setItem('printer_port', profile.printer_port);
      if (profile.printer_model) await AsyncStorage.setItem('printer_model', profile.printer_model);

      const cats = data.categories || [];
      const prods = data.products || [];

      setCategories(cats);
      setProducts(prods);
      setAddons(data.addons || []);

      setSelectedCategory(prev => {
        if (prev && cats.some((c: any) => c.id === prev)) return prev;
        return cats.length > 0 ? cats[0].id : null;
      });
    } catch (e) {
      showToast(t.failedToLoadProducts, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const normalizeText = (v: string) =>
    (v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const phoneCustomersStorageKey = (code: string) =>
    `posup_phone_customers_${code || 'default'}`;

  function cleanPhoneCustomer(customer: PhoneCustomer): PhoneCustomer {
    return {
      first_name: String(customer.first_name || '').trim(),
      last_name: String(customer.last_name || '').trim(),
      phone: String(customer.phone || '').trim(),
      street: String(customer.street || '').trim(),
      zip: String(customer.zip || '').trim(),
      city: String(customer.city || '').trim(),
      id: customer.id,
      order_count: customer.order_count,
      last_order_at: customer.last_order_at,
      created_at: customer.created_at,
      updated_at: customer.updated_at,
    };
  }

  function normalizedPhone(value: string) {
    return String(value || '').replace(/\D/g, '');
  }

  function phoneCustomerKey(customer: PhoneCustomer) {
    const phone = normalizedPhone(customer.phone);

    if (phone) {
      return `phone:${phone}`;
    }

    const nameStreet = normalizeText(
      `${customer.first_name} ${customer.last_name} ${customer.street}`
    ).trim();

    return nameStreet ? `name:${nameStreet}` : '';
  }

  function mergePhoneCustomerData(primary: PhoneCustomer, secondary: PhoneCustomer): PhoneCustomer {
    return {
      ...secondary,
      ...primary,
      first_name: primary.first_name || secondary.first_name || '',
      last_name: primary.last_name || secondary.last_name || '',
      phone: primary.phone || secondary.phone || '',
      street: primary.street || secondary.street || '',
      zip: primary.zip || secondary.zip || '',
      city: primary.city || secondary.city || '',
      order_count: primary.order_count ?? secondary.order_count,
      last_order_at: primary.last_order_at || secondary.last_order_at || null,
      updated_at: primary.updated_at || secondary.updated_at || null,
      created_at: primary.created_at || secondary.created_at || null,
    };
  }

  function mergePhoneCustomers(primary: PhoneCustomer[], secondary: PhoneCustomer[]) {
    const merged: PhoneCustomer[] = [];

    const upsert = (customer: PhoneCustomer, preferNewCustomer: boolean) => {
      const cleaned = cleanPhoneCustomer(customer);
      const key = phoneCustomerKey(cleaned);

      if (!key) {
        return;
      }

      const existingIndex = merged.findIndex(c => phoneCustomerKey(c) === key);

      if (existingIndex >= 0) {
        merged[existingIndex] = preferNewCustomer
          ? mergePhoneCustomerData(cleaned, merged[existingIndex])
          : mergePhoneCustomerData(merged[existingIndex], cleaned);
      } else {
        merged.push(cleaned);
      }
    };

    primary.forEach(customer => upsert(customer, true));
    secondary.forEach(customer => upsert(customer, false));

    return merged.slice(0, 200);
  }

  async function loadPhoneCustomers(code: string) {
    try {
      const raw = await AsyncStorage.getItem(phoneCustomersStorageKey(code));
      const parsed = raw ? JSON.parse(raw) : [];
      const localCustomers = Array.isArray(parsed) ? parsed : [];

      let backendCustomers: PhoneCustomer[] = [];

      try {
        const res = await fetch(`${BACKEND}/posup/customers/${code}`);
        const data = await res.json();

        if (res.ok && data.success && Array.isArray(data.customers)) {
          backendCustomers = data.customers;
        }
      } catch (e) {
        console.log('Failed to load backend phone customers', e);
      }

      const merged = mergePhoneCustomers(backendCustomers, localCustomers);

      setPhoneCustomers(merged);
      await AsyncStorage.setItem(phoneCustomersStorageKey(code), JSON.stringify(merged));
    } catch (e) {
      setPhoneCustomers([]);
    }
  }

  async function savePhoneCustomer(customer: PhoneCustomer) {
    const cleaned = cleanPhoneCustomer(customer);

    if (!cleaned.phone && !cleaned.first_name && !cleaned.last_name) {
      return;
    }

    const updated = mergePhoneCustomers([cleaned], phoneCustomers);
    setPhoneCustomers(updated);
    await AsyncStorage.setItem(phoneCustomersStorageKey(restaurantCode), JSON.stringify(updated));
  }

  async function savePhoneCustomerOrderHistory(customer: PhoneCustomer) {
    const cleaned = cleanPhoneCustomer(customer);

    if (!cleaned.phone) {
      await savePhoneCustomer(cleaned);
      return;
    }

    try {
      const res = await fetch(`${BACKEND}/posup/customers/${restaurantCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: cleaned.first_name,
          last_name: cleaned.last_name,
          phone: cleaned.phone,
          street: cleaned.street,
          zip: cleaned.zip,
          city: cleaned.city,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.customer) {
        await savePhoneCustomer({
          ...cleaned,
          ...data.customer,
          first_name: data.customer.first_name || cleaned.first_name,
          last_name: data.customer.last_name || cleaned.last_name,
          phone: data.customer.phone || cleaned.phone,
          street: data.customer.street || cleaned.street,
          zip: data.customer.zip || cleaned.zip,
          city: data.customer.city || cleaned.city,
        });
        return;
      }

      console.log('Failed to update customer order history', data?.error || data?.message);
    } catch (e) {
      console.log('Failed to update customer order history', e);
    }

    await savePhoneCustomer(cleaned);
  }

  function updatePhoneCustomerField(field: keyof PhoneCustomer, value: string) {
    setPhoneCustomer(prev => ({
      ...prev,
      [field]: value,
    }));
    setPhoneCustomerError('');
  }

  function selectPhoneCustomer(customer: PhoneCustomer) {
    setPhoneCustomer(cleanPhoneCustomer(customer));
    setPhoneCustomerError('');
    setAddressBookModal(false);
  }

  function buildPhoneOrderNote(customer: PhoneCustomer, mode: PhoneOrderMode) {
    const name = `${customer.first_name} ${customer.last_name}`.trim();
    const address = `${customer.street}, ${customer.zip} ${customer.city}`.replace(/^,\s*/, '').trim();

    return [
      mode === 'delivery' ? t.notePhoneDelivery : t.notePhonePickup,
      name ? `${t.noteName}: ${name}` : '',
      customer.phone ? `${t.notePhone}: ${customer.phone}` : '',
      mode === 'delivery' && address ? `${t.noteAddress}: ${address}` : '',
    ].filter(Boolean).join('\n');
  }

  function confirmPhoneOrder() {
    const cleaned = cleanPhoneCustomer(phoneCustomer);

    if (phoneOrderMode === 'delivery') {
      const missingDeliveryField =
        !cleaned.first_name ||
        !cleaned.last_name ||
        !cleaned.street ||
        !cleaned.zip ||
        !cleaned.city ||
        !cleaned.phone;

      if (missingDeliveryField) {
        setPhoneCustomerError(t.missingDeliveryFields);
        return;
      }
    }

    if (phoneOrderMode === 'pickup' && !cleaned.phone) {
      setPhoneCustomerError(t.missingPhoneNumber);
      return;
    }

    setPhoneCustomer(cleaned);
    setOrderType('phone');
    setSelectedTable(null);
    setPhoneModal(false);
    setTableModal(false);
  }

  const filteredPhoneCustomers = phoneCustomers.filter(customer => {
    const q = normalizeText(phoneCustomerSearch.trim());

    if (!q) {
      return true;
    }

    const haystack = normalizeText(
      `${customer.phone} ${customer.first_name} ${customer.last_name} ${customer.street} ${customer.zip} ${customer.city}`
    );

    return haystack.includes(q);
  });

  const filteredProducts = products.filter(p => {
    if (!p.active) return false;

    if (searchQuery.trim()) {
      return normalizeText(p.name).includes(normalizeText(searchQuery));
    }

    return selectedCategory ? (p.category_ids || []).includes(selectedCategory) : true;
  });

  function productDisplayPrice(product: any) {
    if (product.type === 'variable' && product.variations?.length > 0) {
      return money(product.variations[0].price);
    }

    return money(product.price);
  }

  function getProductAddons(product: any) {
    return addons.filter(a =>
      (a.assigned_category_ids || []).some((id: string) => (product.category_ids || []).includes(id)) ||
      (a.assigned_product_ids || []).includes(product.id)
    );
  }

  function addProductDirectly(product: any) {
    const price = money(product.price);

    setCart(prev => {
      const idx = prev.findIndex(i =>
        i.product.id === product.id &&
        i.addons.length === 0 &&
        !i.variation
      );

      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        return updated;
      }

      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          product,
          variation: null,
          addons: [],
          note: '',
          price,
          quantity: 1,
        },
      ];
    });

    showToast(`${product.name} added`);
  }

  function openProductModal(product: any) {
    const pAddons = getProductAddons(product);
    const hasVariations = product.variations?.length > 0;

    if (!hasVariations && pAddons.length === 0) {
      addProductDirectly(product);
      return;
    }

    setSelectedProduct(product);
    setSelectedVariation(null);
    setSelectedAddonOptions({});
    setProductAddons(pAddons);
    setAddonError('');
    setAddonModal(true);
  }

  function toggleAddonOption(groupId: string, optionId: string, type: string) {
    setAddonError('');

    setSelectedAddonOptions(prev => {
      const current = prev[groupId] || [];

      if (type === 'visual_radio' || type === 'radio') {
        return { ...prev, [groupId]: [optionId] };
      }

      if (current.includes(optionId)) {
        return {
          ...prev,
          [groupId]: current.filter(id => id !== optionId),
        };
      }

      return {
        ...prev,
        [groupId]: [...current, optionId],
      };
    });
  }

  function addToCart() {
    if (!selectedProduct) return;

    if (selectedProduct.variations?.length > 0 && !selectedVariation) {
      setAddonError(t.selectSizeVariation);
      return;
    }

    for (const group of productAddons) {
      const isRequired =
        group.required ||
        (group.options || []).some((o: any) => o.required);

      if (isRequired && !(selectedAddonOptions[group.id]?.length > 0)) {
        setAddonError(`${t.pleaseSelect}: ${group.name}`);
        return;
      }
    }

    const chosenAddons: any[] = [];
    let addonTotal = 0;

    productAddons.forEach(group => {
      const selected = selectedAddonOptions[group.id] || [];

      selected.forEach(optId => {
        const opt = (group.options || []).find((o: any) => o.id === optId);

        if (opt) {
          addonTotal += money(opt.price);
          chosenAddons.push({
            ...opt,
            price: money(opt.price),
          });
        }
      });
    });

    const basePrice = selectedVariation
      ? money(selectedVariation.price)
      : money(selectedProduct.price);

    const totalPrice = basePrice + addonTotal;

    const cleanedVariation = selectedVariation
      ? { ...selectedVariation, name: selectedVariation.name.replace(/^.*?-\s*-\s*-\s*/, '').trim() }
      : null;

    setCart(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        product: selectedProduct,
        variation: cleanedVariation,
        addons: chosenAddons,
        note: '',
        price: totalPrice,
        quantity: 1,
      },
    ]);

    setAddonModal(false);
    showToast(`${selectedProduct.name} added`);
  }

  function removeItem(id: string) {
    setCart(prev => prev.filter(i => i.id !== id));
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => prev.map(i => {
      if (i.id !== id) return i;

      const newQty = i.quantity + delta;
      if (newQty <= 0) return null as any;

      return { ...i, quantity: newQty };
    }).filter(Boolean));
  }

  const subtotal = cart.reduce((s, i) => s + money(i.price) * i.quantity, 0);

  const discountAmount = () => {
    if (!discount || parseFloat(discount) === 0) return 0;

    if (discountType === 'percent') {
      return subtotal * (Math.min(100, money(discount)) / 100);
    }

    return Math.min(money(discount), subtotal);
  };

  const currentDiscount = discountAmount();
  const orderTotal = subtotal - currentDiscount;

  function getVatRateForCartItem(item: CartItem) {
    if (!orderType) {
      return 0;
    }

    if (orderType === 'table') {
      return 8.1;
    }

    return item.product?.is_alcohol === true ? 8.1 : 2.6;
  }

  function getVatTypeForCartItem(item: CartItem) {
    return item.product?.is_alcohol === true ? 'alcohol' : 'food';
  }

  function getDiscountedLineGross(item: CartItem) {
    const lineGross = money(item.price) * item.quantity;

    if (!currentDiscount || subtotal <= 0) {
      return lineGross;
    }

    const discountShare = lineGross / subtotal;

    return Math.max(0, lineGross - currentDiscount * discountShare);
  }

  function getVatAmountFromGross(gross: number, rate: number) {
    return gross - (gross / (1 + rate / 100));
  }

  const taxGroups = [
    {
      type: 'food',
      label: (t as any).foodTotal || 'Food total',
      isMatch: (item: CartItem) => item.product?.is_alcohol !== true,
    },
    {
      type: 'alcohol',
      label: (t as any).alcoholTotal || 'Alcohol total',
      isMatch: (item: CartItem) => item.product?.is_alcohol === true,
    },
  ];

  const taxSummary = taxGroups
    .map(group => {
      const matchingItems = cart.filter(group.isMatch);
      const rate = matchingItems.length > 0 ? getVatRateForCartItem(matchingItems[0]) : 0;

      const gross = matchingItems.reduce((sum, item) => {
        return sum + getDiscountedLineGross(item);
      }, 0);

      const tax = getVatAmountFromGross(gross, rate);
      const net = gross - tax;

      return {
        type: group.type,
        label: group.label,
        rate,
        gross,
        net,
        tax,
      };
    })
    .filter(row => row.gross > 0.004 && row.rate > 0);

  const taxTotal = taxSummary.reduce((sum, row) => sum + row.tax, 0);

  useEffect(() => {
    publishDisplayState({
      restaurantName: restaurantCode,
      logoUrl: restaurantLogo,
      items: cart.map(i => ({
        id: i.id,
        name: i.product.name,
        variationName: i.variation?.name,
        quantity: i.quantity,
        price: money(i.price),
        addons: i.addons.map(a => ({ name: a.name, price: money(a.price) })),
      })),
      subtotal,
      discount: currentDiscount,
      total: orderTotal,
    });
  }, [cart, subtotal, currentDiscount, orderTotal, restaurantCode, restaurantLogo]);

  function clearOrder() {
    setClearModal(true);
  }

  async function placeOrder() {
    if (cart.length === 0) return;

    if (!orderType) {
      showToast((t as any).selectOrderTypeRequired || `${t.orderType} auswählen`, 'error');
      return;
    }

    if (orderType === 'table' && !selectedTable) {
      setTableModal(true);
      showToast(t.selectTable, 'error');
      return;
    }

    const dayClosedDate = await AsyncStorage.getItem('day_closed_date');
    const todayStr = new Date().toLocaleDateString('de-CH', { timeZone: 'Europe/Zurich' });

    if (dayClosedDate === todayStr) {
      showToast(t.dayClosedCannotOrder, 'error');
      return;
    }

    const cleanedPhoneCustomer = cleanPhoneCustomer(phoneCustomer);

    if (orderType === 'phone') {
      if (phoneOrderMode === 'delivery') {
        const missingDeliveryField =
          !cleanedPhoneCustomer.first_name ||
          !cleanedPhoneCustomer.last_name ||
          !cleanedPhoneCustomer.street ||
          !cleanedPhoneCustomer.zip ||
          !cleanedPhoneCustomer.city ||
          !cleanedPhoneCustomer.phone;

        if (missingDeliveryField) {
          setPhoneCustomerError(t.missingDeliveryFields);
          setPhoneModal(true);
          showToast(t.deliveryInfoMissing, 'error');
          return;
        }
      }

      if (phoneOrderMode === 'pickup' && !cleanedPhoneCustomer.phone) {
        setPhoneCustomerError(t.missingPhoneNumber);
        setPhoneModal(true);
        showToast(t.phoneNumberMissing, 'error');
        return;
      }
    }

    setPlacingOrder(true);

    try {
      const order = {
        restaurant_code: restaurantCode,
        table: selectedTable
          ? `${t.table} ${selectedTable}`
          : orderType === 'phone'
            ? phoneOrderMode === 'delivery' ? t.phoneDelivery : t.phonePickup
            : t.walkIn,
        order_type: orderType === 'phone' ? phoneOrderMode : orderType,
        phone_order: orderType === 'phone',
        phone_order_mode: orderType === 'phone' ? phoneOrderMode : null,
        customer: orderType === 'phone' ? cleanedPhoneCustomer : null,
        items: cart.map(i => {
          const firstCategoryId = (i.product.category_ids || [])[0];
          const category = categories.find(c => c.id === firstCategoryId);

          const taxRate = getVatRateForCartItem(i);
          const taxType = getVatTypeForCartItem(i);
          const discountedLineGross = getDiscountedLineGross(i);
          const lineTax = getVatAmountFromGross(discountedLineGross, taxRate);
          const lineNet = discountedLineGross - lineTax;

          return {
            name: i.product.name,
            quantity: i.quantity,
            price: money(i.price).toFixed(2),
            total: (money(i.price) * i.quantity).toFixed(2),
            discounted_total: discountedLineGross.toFixed(2),
            net_total: lineNet.toFixed(2),
            tax_type: taxType,
            tax_rate: taxRate.toFixed(1),
            tax_total: lineTax.toFixed(2),
            variation: i.variation?.name || '',
            category: category?.name || '',
            is_alcohol: i.product.is_alcohol === true,
            addons: i.addons.map(a => ({
              label: a.name,
              price: money(a.price),
            })),
          };
        }),
        subtotal: subtotal.toFixed(2),
        discount: currentDiscount.toFixed(2),
        discount_type: discountType,
        discount_value: discount,
        total: orderTotal.toFixed(2),
        tax_total: taxTotal.toFixed(2),
        tax_summary: taxSummary.map(row => ({
          type: row.type,
          label: row.label,
          rate: row.rate.toFixed(1),
          gross: row.gross.toFixed(2),
          net: row.net.toFixed(2),
          tax: row.tax.toFixed(2),
        })),
        tax_rule:
          orderType === 'table'
            ? 'table_food_and_alcohol_8_1'
            : 'takeaway_food_2_6_alcohol_8_1',
        currency: 'CHF',
        payment_method: paymentMethod,
        note: note.trim(),
        pos_note: note.trim(),
        source: orderType === 'phone' ? 'posup_phone' : 'posup',
        created_at: new Date().toISOString(),
      };

      const res = await fetch(`${BACKEND}/posup/orders/${restaurantCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      });

      const data = await res.json();

      if (data.success) {
        const placedOrder = {
          ...order,
          order_number: data.order_id,
          order_id: data.order_id,
        };

        if (orderType === 'phone') {
          await savePhoneCustomerOrderHistory(cleanedPhoneCustomer);
        }

        setCart([]);
        setNote('');
        setDiscount('');
        setSelectedTable(null);
        setOrderType(null);
        setPhoneOrderMode('pickup');
        setPhoneCustomer(emptyPhoneCustomer);
        setPhoneCustomerError('');

        showToast(`${t.orderPlaced} ${data.order_id}`);

        try {
          await printOrder(placedOrder, restaurantCode);
          const { lastSunmiError } = await import('../../lib/printer');

          if (lastSunmiError) {
            Alert.alert('SUNMI Print Warning', lastSunmiError);
          }
        } catch (printErr: any) {
          console.log('Print failed:', printErr?.message);
          const { lastSunmiError } = await import('../../lib/printer');

          Alert.alert(
            'SUNMI Print Failed',
            `Sunmi error: ${lastSunmiError || String(printErr?.message || printErr)}`
          );
        }
      } else {
        showToast(t.failedToPlaceOrder, 'error');
      }
    } catch (e: any) {
      showToast(t.failedToPlaceOrder, 'error');
    } finally {
      setPlacingOrder(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>{t.loadingMenu}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      <View style={[styles.catSidebar, { width: layout.catSidebar }]}>
        <View style={styles.catLogoWrap}>
          {restaurantLogo ? (
            <Image
              source={{ uri: restaurantLogo }}
              style={{
                width: Math.max(76, layout.catSidebar - 26),
                height: 40,
              }}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.logoFallback}>
              <Text style={styles.catLogoText}>
                {restaurantCode?.toUpperCase()?.slice(0, 2)}
              </Text>
            </View>
          )}
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.catSidebarContent}
        >
          {categories.map((cat, index) => {
            const active = selectedCategory === cat.id && !searchQuery;
            const letter = cat.name.trim()[0]?.toUpperCase() || '?';
            const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

            return (
              <CategoryButton
                key={cat.id}
                cat={cat}
                active={active}
                letter={letter}
                color={color}
                onPress={() => switchCategory(cat.id)}
              />
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.middle}>
        <View style={styles.topBar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder={t.searchProducts}
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />

            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={19} color="#B8BBC4" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.syncBtn}
            onPress={() => loadData(true)}
            disabled={refreshing}
            activeOpacity={0.8}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="sync-outline" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredProducts}
          keyExtractor={p => p.id}
          numColumns={layout.numColumns}
          key={layout.numColumns}
          contentContainerStyle={[
            styles.grid,
            filteredProducts.length === 0 && styles.gridEmpty,
          ]}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.productCard,
                { width: `${layout.cardWidth}%` as any },
              ]}
              onPress={() => openProductModal(item)}
              activeOpacity={0.72}
            >
              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>

              <View style={styles.productBottomRow}>
                <View>
                  <Text style={styles.productPriceLabel}>{t.price}</Text>
                  <Text style={styles.productPrice}>
                    CHF {productDisplayPrice(item).toFixed(2)}
                  </Text>
                </View>

                <View style={styles.productAddBtn}>
                  <Ionicons name="add" size={20} color="#fff" />
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="search-outline" size={34} color="#C7CBD4" />
              </View>
              <Text style={styles.emptyTitle}>{t.noProductsFound}</Text>
              <Text style={styles.emptyText}>{t.searchProducts}</Text>
            </View>
          }
        />
      </View>

      <View style={[styles.orderPanel, { width: layout.orderPanel }]}>
        <View>
          <View style={styles.orderHeader}>
            <View>
              <Text style={styles.orderKicker}>POSUP</Text>
              <Text style={styles.orderTitle}>{t.order}</Text>
            </View>

            {cart.length > 0 && (
              <TouchableOpacity
                onPress={clearOrder}
                style={styles.clearBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="trash-outline" size={14} color="#FF8A8A" />
                <Text style={styles.clearBtnText}>{t.clear}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.orderTypeDirectWrap}>
            <Text style={styles.orderTypeDirectLabel}>
              {t.orderType}
            </Text>

            <View style={styles.orderTypeDirectRow}>
              <TouchableOpacity
                style={[
                  styles.orderTypeDirectBtn,
                  orderType === 'takeaway' && styles.orderTypeDirectBtnActive,
                ]}
                onPress={() => {
                  setOrderType('takeaway');
                  setSelectedTable(null);
                  setPhoneModal(false);
                  setTableModal(false);
                }}
                activeOpacity={0.78}
              >
                <Ionicons
                  name="bag-handle-outline"
                  size={16}
                  color={orderType === 'takeaway' ? '#fff' : '#B5B5C8'}
                />
                <Text
                  style={[
                    styles.orderTypeDirectBtnText,
                    orderType === 'takeaway' && styles.orderTypeDirectBtnTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {t.takeaway}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.orderTypeDirectBtn,
                  orderType === 'phone' && styles.orderTypeDirectBtnActive,
                ]}
                onPress={() => {
                  setOrderType(null);
                  setSelectedTable(null);
                  setPhoneCustomer(emptyPhoneCustomer);
                  setPhoneCustomerError('');
                  setPhoneOrderMode('pickup');
                  setTableModal(false);
                  setPhoneModal(true);
                }}
                activeOpacity={0.78}
              >
                <Ionicons
                  name="call-outline"
                  size={16}
                  color={orderType === 'phone' ? '#fff' : '#B5B5C8'}
                />
                <Text
                  style={[
                    styles.orderTypeDirectBtnText,
                    orderType === 'phone' && styles.orderTypeDirectBtnTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {t.phone}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.orderTypeDirectBtn,
                  orderType === 'table' && styles.orderTypeDirectBtnActive,
                ]}
                onPress={() => {
                  setOrderType(null);
                  setSelectedTable(null);
                  setPhoneModal(false);
                  setTableModal(true);
                }}
                activeOpacity={0.78}
              >
                <Ionicons
                  name="grid-outline"
                  size={16}
                  color={orderType === 'table' ? '#fff' : '#B5B5C8'}
                />
                <Text
                  style={[
                    styles.orderTypeDirectBtnText,
                    orderType === 'table' && styles.orderTypeDirectBtnTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {selectedTable ? `${t.table} ${selectedTable}` : t.table}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {cart.length === 0 ? (
          <View style={styles.emptyOrder}>
            <View style={styles.emptyCartCircle}>
              <Ionicons name="cart-outline" size={42} color="#5A5A78" />
            </View>
            <Text style={styles.emptyOrderTitle}>{t.addItemsToStart}</Text>
            <Text style={styles.emptyOrderSub}>
              {t.chooseProductsFromLeft}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.itemsList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.itemsListContent}
          >
            <View style={styles.itemsHeader}>
              <Text style={[styles.itemsHeaderText, { width: 74 }]}>{t.qty}</Text>
              <Text style={[styles.itemsHeaderText, { flex: 1 }]}>{t.product}</Text>
              <Text style={[styles.itemsHeaderText, { width: 74, textAlign: 'right' }]}>{t.price}</Text>
            </View>

            {cart.map(item => (
              <View key={item.id} style={styles.orderItem}>
                <View style={styles.orderItemRow}>
                  <View style={styles.qtyInline}>
                    <TouchableOpacity
                      onPress={() => item.quantity === 1 ? removeItem(item.id) : updateQty(item.id, -1)}
                      style={[
                        styles.qtyMiniBtn,
                        item.quantity === 1 && styles.qtyTrashBtn,
                      ]}
                      activeOpacity={0.75}
                    >
                      <Ionicons
                        name={item.quantity === 1 ? 'trash-outline' : 'remove'}
                        size={item.quantity === 1 ? 12 : 11}
                        color="#fff"
                      />
                    </TouchableOpacity>

                    <Text style={styles.orderItemQty}>{item.quantity}</Text>

                    <TouchableOpacity
                      onPress={() => updateQty(item.id, 1)}
                      style={styles.qtyMiniBtn}
                      activeOpacity={0.75}
                    >
                      <Ionicons name="add" size={11} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.orderItemMid}>
                    <View style={styles.orderItemNameRow}>
                      <Text style={styles.orderItemName} numberOfLines={2}>
                        {item.product.name}{item.variation ? ` — ${item.variation.name}` : ''}
                      </Text>

                      <Text style={styles.orderItemPrice}>
                        CHF {(money(item.price) * item.quantity).toFixed(2)}
                      </Text>
                    </View>

                    {item.addons.map((a: any, i: number) => (
                      <View key={i} style={styles.addonLine}>
                        <Text style={styles.orderItemSub} numberOfLines={1}>
                          + {a.name}
                        </Text>

                        {money(a.price) > 0 && (
                          <Text style={styles.orderItemSub}>
                            CHF {money(a.price).toFixed(2)}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <View style={styles.orderFooter}>
          <TextInput
            style={styles.noteInput}
            placeholder={t.orderNote}
            placeholderTextColor="#8E8EA8"
            value={note}
            onChangeText={setNote}
            multiline
          />

          <View style={styles.payRow}>
            <TouchableOpacity
              style={[
                styles.payBtn,
                paymentMethod === 'cash' && styles.payBtnActive,
              ]}
              onPress={() => setPaymentMethod('cash')}
              activeOpacity={0.75}
            >
              <Text style={styles.payEmoji}>💵</Text>
              <Text
                style={[
                  styles.payBtnText,
                  paymentMethod === 'cash' && styles.payBtnTextActive,
                ]}
              >
                {t.cash}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.payBtn,
                paymentMethod === 'card' && styles.payBtnActive,
              ]}
              onPress={() => setPaymentMethod('card')}
              activeOpacity={0.75}
            >
              <Text style={styles.payEmoji}>💳</Text>
              <Text
                style={[
                  styles.payBtnText,
                  paymentMethod === 'card' && styles.payBtnTextActive,
                ]}
              >
                {t.card}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.payBtn,
                paymentMethod === 'twint' && styles.payBtnActive,
              ]}
              onPress={() => setPaymentMethod('twint')}
              activeOpacity={0.75}
            >
              <Text style={styles.payEmoji}>📱</Text>
              <Text
                style={[
                  styles.payBtnText,
                  paymentMethod === 'twint' && styles.payBtnTextActive,
                ]}
              >
                Twint
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalRowLabel}>{t.subtotal}</Text>
              <Text style={styles.totalRowVal}>CHF {subtotal.toFixed(2)}</Text>
            </View>

            {currentDiscount > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalRowLabel, styles.discountTotalLabel]}>
                  {t.discount} {discountType === 'percent' ? `(${discount}%)` : `(${t.fixedChf})`}
                </Text>
                <Text style={[styles.totalRowVal, styles.discountTotalValue]}>
                  - CHF {currentDiscount.toFixed(2)}
                </Text>
              </View>
            )}

            {taxSummary.map(row => (
              <View key={row.type}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalRowLabel}>{row.label}</Text>
                  <Text style={styles.totalRowVal}>CHF {row.gross.toFixed(2)}</Text>
                </View>

                <View style={styles.totalRow}>
                  <Text style={styles.totalRowLabel}>
                    {(t as any).vat || 'VAT'} {row.rate.toFixed(1)}%
                  </Text>
                  <Text style={styles.totalRowVal}>CHF {row.tax.toFixed(2)}</Text>
                </View>
              </View>
            ))}

            <View style={styles.totalDivider} />

            <View style={styles.totalRow}>
              <Text style={styles.grandTotalLabel}>{t.total}</Text>
              <Text style={styles.grandTotalAmt}>CHF {orderTotal.toFixed(2)}</Text>
            </View>
          </View>

          <View style={styles.actionBtns}>
            <TouchableOpacity
              style={styles.discountBtn}
              onPress={() => setDiscountModal(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="pricetag-outline" size={15} color="#F59E0B" />
              <Text style={styles.discountBtnText}>
                {discount ? `${discount}${discountType === 'percent' ? '%' : ' CHF'}` : t.discount}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.placeBtn,
                (cart.length === 0 || !orderType || (orderType === 'table' && !selectedTable) || placingOrder) && styles.placeBtnDisabled,
              ]}
              onPress={placeOrder}
              disabled={cart.length === 0 || !orderType || (orderType === 'table' && !selectedTable) || placingOrder}
              activeOpacity={0.82}
            >
              {placingOrder ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.placeBtnText}>{t.placeOrder}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal visible={clearModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.discountModalBox, { width: layout.discountModalWidth }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t.clearOrder}</Text>
                <Text style={styles.modalSubtitleLight}>{t.resetOrderSubtitle}</Text>
              </View>

              <TouchableOpacity
                onPress={() => setClearModal(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.discountBody}>
              <Text style={styles.confirmText}>{t.clearOrderConfirm}</Text>

              <View style={styles.discountActions}>
                <TouchableOpacity
                  style={styles.discountClearBtn}
                  onPress={() => setClearModal(false)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.discountClearBtnText}>{t.cancel}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.discountApplyBtn}
                  onPress={() => {
                    setCart([]);
                    setNote('');
                    setDiscount('');
                    setSelectedTable(null);
                    setOrderType(null);
                    setPhoneOrderMode('pickup');
                    setPhoneCustomer(emptyPhoneCustomer);
                    setPhoneCustomerError('');
                    setClearModal(false);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.discountApplyBtnText}>{t.clear}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={tableModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.addonModalBox, { width: layout.addonModalWidth }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t.selectTable}</Text>
                <Text style={styles.modalSubtitleLight}>{t.table}</Text>
              </View>

              <TouchableOpacity
                onPress={() => setTableModal(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.tableModalScroll}>
              <Text style={styles.addonSectionTitle}>{t.selectTable}</Text>

              <View style={styles.tableGrid}>
                {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(tNum => (
                  <TouchableOpacity
                    key={tNum}
                    style={[
                      styles.tableCard,
                      selectedTable === tNum && styles.tableCardActive,
                    ]}
                    onPress={() => {
                      setOrderType('table');
                      setSelectedTable(tNum);
                      setTableModal(false);
                    }}
                    activeOpacity={0.78}
                  >
                    <Text
                      style={[
                        styles.tableCardNum,
                        selectedTable === tNum && styles.tableCardNumActive,
                      ]}
                    >
                      {tNum}
                    </Text>
                    <Text
                      style={[
                        styles.tableCardText,
                        selectedTable === tNum && styles.tableCardTextActive,
                      ]}
                    >
                      {t.table}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={phoneModal} transparent animationType="fade">
        <KeyboardAvoidingView
          style={styles.modalKeyboardView}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.addonModalBox, { width: layout.addonModalWidth }]}>
              <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t.phoneOrder}</Text>
                <Text style={styles.modalSubtitleLight}>{t.phoneOrderChooseMode}</Text>
              </View>

              <TouchableOpacity
                onPress={() => setPhoneModal(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.phoneModalScroll}
              contentContainerStyle={styles.phoneModalScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.addonSectionTitle}>{t.phoneOrderMode}</Text>

              <View style={styles.phoneModeRow}>
                <TouchableOpacity
                  style={[
                    styles.phoneModeBtn,
                    phoneOrderMode === 'pickup' && styles.phoneModeBtnActive,
                  ]}
                  onPress={() => {
                    setPhoneOrderMode('pickup');
                    setPhoneCustomerError('');
                  }}
                  activeOpacity={0.78}
                >
                  <Ionicons
                    name="bag-handle-outline"
                    size={19}
                    color={phoneOrderMode === 'pickup' ? '#fff' : '#6F7280'}
                  />
                  <Text
                    style={[
                      styles.phoneModeBtnText,
                      phoneOrderMode === 'pickup' && styles.phoneModeBtnTextActive,
                    ]}
                  >
                    {t.pickup}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.phoneModeBtn,
                    phoneOrderMode === 'delivery' && styles.phoneModeBtnActive,
                  ]}
                  onPress={() => {
                    setPhoneOrderMode('delivery');
                    setPhoneCustomerError('');
                  }}
                  activeOpacity={0.78}
                >
                  <Ionicons
                    name="bicycle-outline"
                    size={19}
                    color={phoneOrderMode === 'delivery' ? '#fff' : '#6F7280'}
                  />
                  <Text
                    style={[
                      styles.phoneModeBtnText,
                      phoneOrderMode === 'delivery' && styles.phoneModeBtnTextActive,
                    ]}
                  >
                    {t.delivery}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addressBookModeBtn}
                  onPress={() => {
                    setPhoneCustomerSearch('');
                    setAddressBookModal(true);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="book-outline" size={18} color="#D97706" />
                  <Text style={styles.addressBookModeBtnText}>{t.addressBook}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.addonSectionTitle}>{t.customer}</Text>

              <View style={styles.phoneFormGrid}>
                <View style={styles.phoneNameRow}>
                  <TextInput
                    ref={phoneFirstNameRef}
                    style={[styles.phoneInput, styles.phoneNameInput]}
                    placeholder={t.firstName}
                    placeholderTextColor="#A8ACB7"
                    value={phoneCustomer.first_name}
                    onChangeText={v => updatePhoneCustomerField('first_name', v)}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => phoneLastNameRef.current?.focus()}
                  />

                  <TextInput
                    ref={phoneLastNameRef}
                    style={[styles.phoneInput, styles.phoneNameInput]}
                    placeholder={t.lastName}
                    placeholderTextColor="#A8ACB7"
                    value={phoneCustomer.last_name}
                    onChangeText={v => updatePhoneCustomerField('last_name', v)}
                    returnKeyType="next"
                    blurOnSubmit={false}
                    onSubmitEditing={() => phoneNumberRef.current?.focus()}
                  />
                </View>

                <TextInput
                  ref={phoneNumberRef}
                  style={styles.phoneInput}
                  placeholder={t.phone}
                  placeholderTextColor="#A8ACB7"
                  value={phoneCustomer.phone}
                  onChangeText={v => updatePhoneCustomerField('phone', v)}
                  keyboardType="phone-pad"
                  returnKeyType={phoneOrderMode === 'delivery' ? 'next' : 'done'}
                  blurOnSubmit={phoneOrderMode !== 'delivery'}
                  onSubmitEditing={() => {
                    if (phoneOrderMode === 'delivery') {
                      phoneStreetRef.current?.focus();
                    }
                  }}
                />

                {phoneOrderMode === 'delivery' && (
                  <View style={styles.phoneAddressRow}>
                    <TextInput
                      ref={phoneStreetRef}
                      style={[styles.phoneInput, styles.phoneStreetInput]}
                      placeholder={t.street}
                      placeholderTextColor="#A8ACB7"
                      value={phoneCustomer.street}
                      onChangeText={v => updatePhoneCustomerField('street', v)}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => phoneZipRef.current?.focus()}
                    />

                    <TextInput
                      ref={phoneZipRef}
                      style={[styles.phoneInput, styles.phoneZipInput]}
                      placeholder={t.zip}
                      placeholderTextColor="#A8ACB7"
                      value={phoneCustomer.zip}
                      onChangeText={v => updatePhoneCustomerField('zip', v)}
                      keyboardType="number-pad"
                      maxLength={4}
                      returnKeyType="next"
                      blurOnSubmit={false}
                      onSubmitEditing={() => phoneCityRef.current?.focus()}
                    />

                    <TextInput
                      ref={phoneCityRef}
                      style={[styles.phoneInput, styles.phoneCityInput]}
                      placeholder={t.city}
                      placeholderTextColor="#A8ACB7"
                      value={phoneCustomer.city}
                      onChangeText={v => updatePhoneCustomerField('city', v)}
                      returnKeyType="done"
                      onSubmitEditing={confirmPhoneOrder}
                    />
                  </View>
                )}
              </View>

              {phoneCustomerError ? (
                <View style={styles.addonErrorBox}>
                  <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                  <Text style={styles.addonErrorText}>{phoneCustomerError}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.phoneActions}>
              <TouchableOpacity
                style={styles.discountClearBtn}
                onPress={() => setPhoneModal(false)}
                activeOpacity={0.75}
              >
                <Text style={styles.discountClearBtnText}>{t.cancel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.discountApplyBtn}
                onPress={confirmPhoneOrder}
                activeOpacity={0.8}
              >
                <Text style={styles.discountApplyBtnText}>{t.confirmPhoneOrder}</Text>
              </TouchableOpacity>
            </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={addressBookModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.addonModalBox, { width: layout.addonModalWidth }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t.addressBook}</Text>
                <Text style={styles.modalSubtitleLight}>{t.addressBookSearchSubtitle}</Text>
              </View>

              <TouchableOpacity
                onPress={() => setAddressBookModal(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.addressBookBody}>
              <View style={styles.addressBookSearchWrap}>
                <Ionicons name="search-outline" size={18} color="#9CA3AF" />
                <TextInput
                  style={styles.addressBookSearchInput}
                  placeholder={t.addressBookSearchPlaceholder}
                  placeholderTextColor="#9CA3AF"
                  value={phoneCustomerSearch}
                  onChangeText={setPhoneCustomerSearch}
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>

              <ScrollView style={styles.addressBookList}>
                {filteredPhoneCustomers.length === 0 ? (
                  <View style={styles.addressBookEmpty}>
                    <Ionicons name="person-circle-outline" size={42} color="#C7CBD4" />
                    <Text style={styles.addressBookEmptyText}>{t.noSavedCustomers}</Text>
                  </View>
                ) : (
                  filteredPhoneCustomers.map((customer, index) => {
                    const name = `${customer.first_name} ${customer.last_name}`.trim() || t.unknownCustomer;
                    const address = `${customer.street}, ${customer.zip} ${customer.city}`.replace(/^,\s*/, '').trim();

                    return (
                      <TouchableOpacity
                        key={`${customer.phone}-${customer.street}-${index}`}
                        style={styles.customerCard}
                        onPress={() => selectPhoneCustomer(customer)}
                        activeOpacity={0.75}
                      >
                        <View style={styles.customerAvatar}>
                          <Text style={styles.customerAvatarText}>
                            {name.trim()[0]?.toUpperCase() || '?'}
                          </Text>
                        </View>

                        <View style={styles.customerCardTextWrap}>
                          <Text style={styles.customerName} numberOfLines={1}>
                            {name}
                          </Text>
                          <Text style={styles.customerMeta} numberOfLines={1}>
                            {customer.phone || t.noPhone}
                          </Text>
                          {address ? (
                            <Text style={styles.customerAddress} numberOfLines={1}>
                              {address}
                            </Text>
                          ) : null}
                        </View>

                        <Ionicons name="chevron-forward" size={18} color="#A8ACB7" />
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={discountModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.discountModalBox, { width: layout.discountModalWidth }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t.applyDiscount}</Text>
                <Text style={styles.modalSubtitleLight}>{t.discountModalSubtitle}</Text>
              </View>

              <TouchableOpacity
                onPress={() => setDiscountModal(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.discountBody}>
              <View style={styles.discountTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.discountTypeBtn,
                    discountType === 'percent' && styles.discountTypeBtnActive,
                  ]}
                  onPress={() => {
                    setDiscountType('percent');
                    setDiscount('');
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.discountTypeBtnText,
                      discountType === 'percent' && styles.discountTypeBtnTextActive,
                    ]}
                  >
                    {t.percentage}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.discountTypeBtn,
                    discountType === 'fixed' && styles.discountTypeBtnActive,
                  ]}
                  onPress={() => {
                    setDiscountType('fixed');
                    setDiscount('');
                  }}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.discountTypeBtnText,
                      discountType === 'fixed' && styles.discountTypeBtnTextActive,
                    ]}
                  >
                    {t.fixedChf}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.discountPresets}>
                {discountType === 'percent'
                  ? ['5', '10', '15', '20', '25', '50'].map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[
                          styles.presetBtn,
                          discount === v && styles.presetBtnActive,
                        ]}
                        onPress={() => setDiscount(v)}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.presetBtnText,
                            discount === v && styles.presetBtnTextActive,
                          ]}
                        >
                          {v}%
                        </Text>
                      </TouchableOpacity>
                    ))
                  : ['1', '2', '5', '10', '20', '50'].map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[
                          styles.presetBtn,
                          discount === v && styles.presetBtnActive,
                        ]}
                        onPress={() => setDiscount(v)}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.presetBtnText,
                            discount === v && styles.presetBtnTextActive,
                          ]}
                        >
                          CHF {v}
                        </Text>
                      </TouchableOpacity>
                    ))}
              </View>

              <TextInput
                style={styles.discountInput}
                placeholder={discountType === 'percent' ? t.percentage : t.fixedChf}
                placeholderTextColor="#A8ACB7"
                value={discount}
                onChangeText={v => {
                  const c = v.replace(',', '.');

                  if (discountType === 'percent') {
                    const n = parseFloat(c);
                    setDiscount(!c ? '' : !isNaN(n) ? String(Math.min(100, Math.max(0, n))) : discount);
                  } else {
                    setDiscount(c);
                  }
                }}
                keyboardType="numeric"
              />

              {discount ? (
                <View style={styles.discountPreview}>
                  <Text style={styles.discountPreviewLabel}>{t.discountAmount}</Text>
                  <Text style={styles.discountPreviewAmt}>
                    - CHF {currentDiscount.toFixed(2)}
                  </Text>
                  <Text style={styles.discountPreviewTotal}>
                    {t.newTotal}: CHF {orderTotal.toFixed(2)}
                  </Text>
                </View>
              ) : null}

              <View style={styles.discountActions}>
                <TouchableOpacity
                  style={styles.discountClearBtn}
                  onPress={() => {
                    setDiscount('');
                    setDiscountModal(false);
                  }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.discountClearBtnText}>{t.removeDiscount}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.discountApplyBtn}
                  onPress={() => setDiscountModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.discountApplyBtnText}>{t.apply}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={addonModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.addonModalBox, { width: layout.addonModalWidth }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {selectedProduct?.name}
                </Text>

                <Text style={styles.modalSubtitle}>
                  CHF {selectedVariation
                    ? money(selectedVariation.price).toFixed(2)
                    : money(selectedProduct?.price).toFixed(2)}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setAddonError('');
                  setAddonModal(false);
                }}
                style={styles.modalCloseBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.addonScroll}>
              {selectedProduct?.variations?.length > 0 && (
                <View style={styles.addonSection}>
                  <Text style={styles.addonSectionTitle}>{t.sizeVariation} *</Text>

                  <View style={styles.chipsRow}>
                    {selectedProduct.variations.map((v: any) => (
                      <TouchableOpacity
                        key={v.id}
                        style={[
                          styles.chip,
                          selectedVariation?.id === v.id && styles.chipActive,
                        ]}
                        onPress={() => setSelectedVariation(v)}
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            selectedVariation?.id === v.id && styles.chipTextActive,
                          ]}
                        >
                          {v.name.replace(/^.*?-\s*-\s*-\s*/, '').trim()} — CHF {money(v.price).toFixed(2)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {productAddons.map(group => (
                <View key={group.id} style={styles.addonSection}>
                  <Text style={styles.addonSectionTitle}>
                    {group.name}{(group.options || []).some((o: any) => o.required) ? ' *' : ''}
                  </Text>

                  <View style={styles.chipsRow}>
                    {(group.options || []).map((opt: any) => {
                      const isSelected = (selectedAddonOptions[group.id] || []).includes(opt.id);

                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[
                            styles.chip,
                            isSelected && styles.chipActive,
                          ]}
                          onPress={() => toggleAddonOption(group.id, opt.id, opt.type || 'checkbox')}
                          activeOpacity={0.75}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextActive,
                            ]}
                          >
                            {opt.name}{money(opt.price) > 0 ? ` +${money(opt.price).toFixed(2)}` : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>

            {addonError ? (
              <View style={styles.addonErrorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={styles.addonErrorText}>{addonError}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.addToOrderBtn}
              onPress={addToCart}
              activeOpacity={0.82}
            >
              <Text style={styles.addToOrderBtnText}>{t.addToOrder}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {toast && (
        <View
          style={[
            styles.toast,
            toast.type === 'error' ? styles.toastError : styles.toastSuccess,
          ]}
        >
          <Ionicons
            name={toast.type === 'error' ? 'alert-circle-outline' : 'checkmark-circle-outline'}
            size={18}
            color="#fff"
          />
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </View>
  );
}

const thinBorder = borders.thin;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: APP_BG,
    paddingTop: 0,
    paddingBottom: 0,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_BG,
  },

  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: radii.xl,
    paddingHorizontal: 26,
    paddingVertical: 22,
    alignItems: 'center',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  loadingText: {
    marginTop: 12,
    color: MUTED,
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.medium,
    fontFamily: appFont,
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 44,
    gap: 8,
  },

  emptyIconCircle: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#EEF0F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  emptyTitle: {
    color: TEXT,
    fontSize: fontSizes.lgl,
    fontWeight: fontWeights.bold,
    fontFamily: appFont,
  },

  emptyText: {
    color: MUTED,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    fontFamily: appFont,
    textAlign: 'center',
  },

  catSidebar: {
    backgroundColor: '#FFFFFF',
    borderRightWidth: thinBorder,
    borderRightColor: BORDER,
  },

  catLogoWrap: {
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: thinBorder,
    borderBottomColor: BORDER,
    paddingHorizontal: 10,
    paddingTop: Platform.OS === 'android' ? 4 : 8,
  },

  logoFallback: {
    width: 44,
    height: 44,
    borderRadius: radii.mdl,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  catLogoText: {
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.extrabold,
    color: PRIMARY,
    fontFamily: appFont,
  },

  catSidebarContent: {
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 8,
  },

  catItem: {
  flexDirection: 'row',
  alignItems: 'center',
  paddingVertical: 9,
  paddingHorizontal: 8,
  borderRadius: radii.lg,
  position: 'relative',
  marginBottom: 6,
  minHeight: 54,
  overflow: 'hidden',
},

    catItemActive: {
  backgroundColor: PRIMARY_SOFT,
  borderTopLeftRadius: 0,
  borderBottomLeftRadius: 0,
  borderTopRightRadius: 8,
  borderBottomRightRadius: 8,
  paddingLeft: 16,
  marginLeft: -8,
},

  catBadge: {
  width: 36,
  height: 36,
  borderRadius: radii.mdl,
  justifyContent: 'center',
  alignItems: 'center',
  marginRight: 8,
  borderWidth: thinBorder,
  borderColor: BORDER,
},

  catBadgeLetter: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  catItemText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: fontWeights.bold,
    color: '#4A4D58',
    textAlign: 'left',
    lineHeight: 16,
    fontFamily: appFont,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },

  catItemTextActive: {
    color: PRIMARY,
    fontWeight: fontWeights.black,
  },

  catActiveBar: {
  position: 'absolute',
  left: 0,
  top: 10,
  bottom: 10,
  width: 5,
  backgroundColor: PRIMARY,
  borderTopRightRadius: 8,
  borderBottomRightRadius: 8,
},

  middle: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  topBar: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: APP_BG,
    borderBottomWidth: thinBorder,
    borderBottomColor: BORDER,
  },

  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: radii.lgl,
    paddingHorizontal: 14,
    gap: 9,
    borderWidth: thinBorder,
    borderColor: BORDER,
    height: 46,
  },

  searchInput: {
    flex: 1,
    fontSize: fontSizes.mdl,
    color: TEXT,
    padding: 0,
    fontFamily: appFont,
    fontWeight: fontWeights.medium,
  },

  syncBtn: {
    width: 46,
    height: 46,
    borderRadius: radii.lgl,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },

  productGridWrap: {
  flex: 1,
},

  grid: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 18,
  },

  gridEmpty: {
    flexGrow: 1,
  },

  gridRow: {
    gap: '1%' as any,
    marginBottom: 10,
    justifyContent: 'flex-start',
  },

  productCard: {
    backgroundColor: CARD_BG,
    borderRadius: radii.lgl,
    padding: 14,
    minHeight: 104,
    justifyContent: 'space-between',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  productName: {
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.bold,
    color: TEXT,
    lineHeight: 19,
    fontFamily: appFont,
  },

  productBottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
  },

    productPriceLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.semibold,
    color: '#B8BBC4',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
    fontFamily: appFont,
  },

  productPrice: {
    fontSize: fontSizes.lgl,
    fontWeight: fontWeights.bold,
    color: PRIMARY,
    fontFamily: appFont,
  },

  productAddBtn: {
    width: 34,
    height: 34,
    borderRadius: radii.mdl,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },

  orderPanel: {
    backgroundColor: DARK,
    padding: 12,
        paddingTop: Platform.OS === 'android' ? 10 : 12,
    paddingBottom: 12,
    justifyContent: 'space-between',
    borderLeftWidth: thinBorder,
    borderLeftColor: DARK_BORDER,
  },

  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },

  orderKicker: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: appFont,
  },

  orderTitle: {
    marginTop: 2,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.black,
    color: '#FFFFFF',
    fontFamily: appFont,
  },

  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderRadius: radii.smd,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: thinBorder,
    borderColor: 'rgba(255,107,107,0.20)',
  },

  clearBtnText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    color: '#FF8A8A',
    fontFamily: appFont,
  },

  tableSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: DARK_CARD,
    borderRadius: radii.mdl,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: thinBorder,
    borderColor: DARK_BORDER,
  },

  tableIconWrap: {
    width: 27,
    height: 27,
    borderRadius: radii.smd,
    backgroundColor: 'rgba(139,56,203,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tableSelectorText: {
    flex: 1,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: '#B5B5C8',
    fontFamily: appFont,
  },

  tableSelectorTextActive: {
    color: '#FFFFFF',
  },

  orderTypeDirectWrap: {
    marginTop: 10,
    marginBottom: 10,
  },

  orderTypeDirectLabel: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.black,
    color: '#85859B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 7,
    fontFamily: appFont,
  },

  orderTypeDirectRow: {
    flexDirection: 'row',
    gap: 7,
  },

  orderTypeDirectBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.mdl,
    backgroundColor: DARK_CARD,
    borderWidth: thinBorder,
    borderColor: DARK_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    gap: 4,
  },

  orderTypeDirectBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  orderTypeDirectBtnText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.black,
    color: '#B5B5C8',
    fontFamily: appFont,
  },

  orderTypeDirectBtnTextActive: {
    color: '#FFFFFF',
  },

  emptyOrder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },

  emptyCartCircle: {
    width: 86,
    height: 86,
    borderRadius: radii.giant2,
    backgroundColor: DARK_CARD,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: thinBorder,
    borderColor: DARK_BORDER,
  },

  emptyOrderTitle: {
    marginTop: 4,
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.extrabold,
    color: '#C9C9D8',
    textAlign: 'center',
    fontFamily: appFont,
  },

  emptyOrderSub: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.medium,
    color: '#777792',
    textAlign: 'center',
    fontFamily: appFont,
  },

  itemsList: {
    flex: 1,
    marginTop: 10,
  },

  itemsListContent: {
    paddingBottom: 8,
  },

  itemsHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: thinBorder,
    borderBottomColor: DARK_BORDER,
    marginBottom: 6,
  },

  itemsHeaderText: {
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.black,
    color: '#85859B',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontFamily: appFont,
  },

  orderItem: {
    paddingVertical: 9,
    borderBottomWidth: thinBorder,
    borderBottomColor: '#282845',
  },

  orderItemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },

  qtyInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
    width: 74,
  },

  qtyMiniBtn: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    backgroundColor: DARK_CARD_2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  qtyTrashBtn: {
    backgroundColor: 'rgba(239,68,68,0.35)',
  },

  orderItemQty: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.black,
    color: '#fff',
    minWidth: 14,
    textAlign: 'center',
    fontFamily: appFont,
  },

  orderItemMid: {
    flex: 1,
  },

  orderItemNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },

  orderItemName: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.bold,
    color: '#F1F1F6',
    lineHeight: 18,
    flex: 1,
    fontFamily: appFont,
  },

  orderItemPrice: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.black,
    color: '#FFFFFF',
    marginTop: 1,
    fontFamily: appFont,
  },

  addonLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },

  orderItemSub: {
    fontSize: fontSizes.sm,
    color: '#9999AD',
    fontWeight: fontWeights.medium,
    fontFamily: appFont,
  },

  orderFooter: {
    paddingTop: 8,
  },

  noteInput: {
    backgroundColor: DARK_CARD,
    borderRadius: radii.mdl,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: fontSizes.md,
    color: '#F1F1F6',
    minHeight: 36,
    maxHeight: 68,
    textAlignVertical: 'top',
    marginBottom: 8,
    borderWidth: thinBorder,
    borderColor: DARK_BORDER,
    fontFamily: appFont,
    fontWeight: fontWeights.medium,
  },

  payRow: {
    flexDirection: 'row',
    gap: 7,
    marginBottom: 8,
  },

  payBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: DARK_CARD,
    borderWidth: thinBorder,
    borderColor: DARK_BORDER,
  },

  payBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  payEmoji: {
    fontSize: fontSizes.mdl,
  },

  payBtnText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    color: '#B5B5C8',
    fontFamily: appFont,
  },

  payBtnTextActive: {
    color: '#fff',
  },

  totalsBox: {
    backgroundColor: DARK_CARD,
    borderRadius: radii.lg,
    padding: 11,
    marginBottom: 9,
    borderWidth: thinBorder,
    borderColor: DARK_BORDER,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 12,
  },

  totalRowLabel: {
    fontSize: fontSizes.smd,
    color: '#B9B9CB',
    fontWeight: fontWeights.semibold,
    fontFamily: appFont,
  },

  totalRowVal: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.extrabold,
    color: '#D6D6E2',
    fontFamily: appFont,
  },

  discountTotalLabel: {
    color: colors.successLight,
  },

  discountTotalValue: {
    color: colors.successLight,
  },

  totalDivider: {
    height: thinBorder,
    backgroundColor: DARK_BORDER,
    marginVertical: 7,
  },

  grandTotalLabel: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.black,
    color: '#FFFFFF',
    fontFamily: appFont,
  },

  grandTotalAmt: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.black,
    color: '#FFFFFF',
    fontFamily: appFont,
  },

  actionBtns: {
    flexDirection: 'row',
    gap: 7,
  },

  discountBtn: {
    minWidth: 84,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: radii.mdl,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderWidth: thinBorder,
    borderColor: 'rgba(245,158,11,0.32)',
  },

  discountBtnText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.black,
    color: colors.warning,
    fontFamily: appFont,
  },

  placeBtn: {
    flex: 1,
    backgroundColor: PRIMARY,
    borderRadius: radii.mdl,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeBtnDisabled: {
    backgroundColor: '#33334E',
  },

  placeBtnText: {
    color: '#fff',
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
  },

  modalKeyboardView: {
    flex: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10,10,18,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: thinBorder,
    borderBottomColor: BORDER,
    gap: 14,
  },

  modalTitle: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  modalSubtitle: {
    fontSize: fontSizes.md,
    color: PRIMARY,
    fontWeight: fontWeights.extrabold,
    marginTop: 3,
    fontFamily: appFont,
  },

  modalSubtitleLight: {
    fontSize: fontSizes.smd,
    color: MUTED,
    fontWeight: fontWeights.semibold,
    marginTop: 3,
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

  discountModalBox: {
  backgroundColor: '#fff',
  borderRadius: radii.massive,
  overflow: 'hidden',
  borderWidth: thinBorder,
  borderColor: BORDER,
},

  discountBody: {
    padding: 16,
  },

  confirmText: {
    fontSize: fontSizes.mdl,
    color: '#555B66',
    lineHeight: 20,
    fontWeight: fontWeights.medium,
    marginBottom: 18,
    fontFamily: appFont,
  },

  discountTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },

  discountTypeBtn: {
  flex: 1,
  paddingVertical: 11,
  borderRadius: radii.mdl,
  backgroundColor: '#F0F1F5',
  alignItems: 'center',
  borderWidth: thinBorder,
  borderColor: BORDER,
},

  discountTypeBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  discountTypeBtnText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.extrabold,
    color: '#555B66',
    fontFamily: appFont,
  },

  discountTypeBtnTextActive: {
    color: '#fff',
  },

  discountPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },

  presetBtn: {
  paddingHorizontal: 14,
  paddingVertical: 8,
  borderRadius: radii.full,
  borderWidth: thinBorder,
  borderColor: BORDER,
  backgroundColor: '#FAFAFB',
},

  presetBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  presetBtnText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.extrabold,
    color: '#4B5563',
    fontFamily: appFont,
  },

  presetBtnTextActive: {
    color: '#fff',
  },

  discountInput: {
  borderWidth: thinBorder,
  borderColor: BORDER,
  borderRadius: radii.lg,
  paddingHorizontal: 13,
  paddingVertical: 12,
  fontSize: fontSizes.lgl,
  color: TEXT,
  marginBottom: 12,
  backgroundColor: '#FAFAFB',
  fontFamily: appFont,
  fontWeight: fontWeights.bold,
},

  discountPreview: {
    backgroundColor: '#ECFDF5',
    borderRadius: radii.lg,
    padding: 13,
    marginBottom: 12,
    gap: 3,
    borderWidth: thinBorder,
    borderColor: '#BBF7D0',
  },

  discountPreviewLabel: {
    fontSize: fontSizes.smd,
    color: '#047857',
    fontWeight: fontWeights.bold,
    fontFamily: appFont,
  },

  discountPreviewAmt: {
    fontSize: fontSizes.xxxl,
    fontWeight: fontWeights.black,
    color: colors.success,
    fontFamily: appFont,
  },

  discountPreviewTotal: {
    fontSize: fontSizes.md,
    color: '#166534',
    fontWeight: fontWeights.bold,
    fontFamily: appFont,
  },

  discountActions: {
    flexDirection: 'row',
    gap: 8,
  },

  discountClearBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.lg,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    borderWidth: thinBorder,
    borderColor: '#FECACA',
  },

  discountClearBtnText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.black,
    color: colors.danger,
    fontFamily: appFont,
  },

  discountApplyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.lg,
    backgroundColor: PRIMARY,
    alignItems: 'center',
  },

  discountApplyBtnText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.black,
    color: '#fff',
    fontFamily: appFont,
  },

  tableModalScroll: {
    padding: 16,
    maxHeight: 460,
  },

  tableTypeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },

  tableTypeBtn: {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  paddingVertical: 16,
  borderRadius: radii.xl,
  backgroundColor: '#F0F1F5',
  gap: 7,
  borderWidth: thinBorder,
  borderColor: BORDER,
},

  tableTypeBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  tableTypeBtnText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.extrabold,
    color: '#6F7280',
    fontFamily: appFont,
  },

  tableTypeBtnTextActive: {
    color: '#fff',
  },

  tableGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 18,
  },

  tableCard: {
  width: 76,
  height: 76,
  borderRadius: radii.xxl,
  backgroundColor: '#F0F1F5',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  borderWidth: thinBorder,
  borderColor: BORDER,
},

  tableCardActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  tableCardNum: {
    fontSize: fontSizes.huge,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  tableCardNumActive: {
    color: '#fff',
  },

  tableCardText: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.extrabold,
    color: '#6F7280',
    fontFamily: appFont,
  },

  tableCardTextActive: {
    color: '#fff',
  },

  phoneModalScroll: {
    padding: 16,
    maxHeight: 460,
  },

  phoneModalScrollContent: {
    paddingBottom: 18,
  },

  phoneModeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },

  phoneModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: radii.xl,
    backgroundColor: '#F0F1F5',
    gap: 7,
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  phoneModeBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  phoneModeBtnText: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.extrabold,
    color: '#6F7280',
    fontFamily: appFont,
  },

  phoneModeBtnTextActive: {
    color: '#fff',
  },

  phoneBookHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  addressBookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: PRIMARY_SOFT,
    borderWidth: thinBorder,
    borderColor: 'rgba(139,56,203,0.18)',
  },

  addressBookBtnText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    fontFamily: appFont,
  },

  addressBookModeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(245,158,11,0.14)',
    borderWidth: thinBorder,
    borderColor: 'rgba(245,158,11,0.36)',
  },

  addressBookModeBtnText: {
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.black,
    color: '#D97706',
    fontFamily: appFont,
  },

  phoneFormGrid: {
    gap: 8,
  },

  phoneNameRow: {
    flexDirection: 'row',
    gap: 8,
  },

  phoneAddressRow: {
    flexDirection: 'row',
    gap: 8,
  },

  phoneInput: {
    width: '100%',
    borderWidth: thinBorder,
    borderColor: BORDER,
    borderRadius: radii.lg,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: fontSizes.md,
    color: TEXT,
    backgroundColor: '#FAFAFB',
    fontFamily: appFont,
    fontWeight: fontWeights.bold,
  },

  phoneNameInput: {
    flex: 1,
    width: undefined,
  },

  phoneStreetInput: {
    flex: 2.1,
    width: undefined,
  },

  phoneZipInput: {
    width: 82,
    textAlign: 'center',
  },

  phoneCityInput: {
    flex: 1.1,
    width: undefined,
  },

  phoneInputHalf: {
    flex: 1,
    minWidth: 120,
    borderWidth: thinBorder,
    borderColor: BORDER,
    borderRadius: radii.lg,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: fontSizes.md,
    color: TEXT,
    backgroundColor: '#FAFAFB',
    fontFamily: appFont,
    fontWeight: fontWeights.bold,
  },

  phoneActions: {
    flexDirection: 'row',
    gap: 8,
    padding: 16,
    borderTopWidth: thinBorder,
    borderTopColor: BORDER,
  },

  addressBookBody: {
    padding: 16,
  },

  addressBookSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFB',
    borderRadius: radii.lg,
    paddingHorizontal: 13,
    gap: 8,
    borderWidth: thinBorder,
    borderColor: BORDER,
    height: 44,
    marginBottom: 12,
  },

  addressBookSearchInput: {
    flex: 1,
    fontSize: fontSizes.md,
    color: TEXT,
    padding: 0,
    fontFamily: appFont,
    fontWeight: fontWeights.medium,
  },

  addressBookList: {
    maxHeight: 390,
  },

  addressBookEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 34,
    gap: 8,
  },

  addressBookEmptyText: {
    fontSize: fontSizes.md,
    color: MUTED,
    fontWeight: fontWeights.bold,
    fontFamily: appFont,
  },

  customerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 12,
    borderRadius: radii.lg,
    backgroundColor: '#FAFAFB',
    borderWidth: thinBorder,
    borderColor: BORDER,
    marginBottom: 8,
  },

  customerAvatar: {
    width: 38,
    height: 38,
    borderRadius: radii.lg,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  customerAvatarText: {
    fontSize: fontSizes.lgl,
    fontWeight: fontWeights.black,
    color: PRIMARY,
    fontFamily: appFont,
  },

  customerCardTextWrap: {
    flex: 1,
  },

  customerName: {
    fontSize: fontSizes.md,
    fontWeight: fontWeights.black,
    color: TEXT,
    fontFamily: appFont,
  },

  customerMeta: {
    marginTop: 2,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.bold,
    color: PRIMARY,
    fontFamily: appFont,
  },

  customerAddress: {
    marginTop: 2,
    fontSize: fontSizes.smd,
    fontWeight: fontWeights.medium,
    color: MUTED,
    fontFamily: appFont,
  },

 addonModalBox: {
  backgroundColor: '#fff',
  borderRadius: radii.massive,
  maxHeight: '84%',
  overflow: 'hidden',
  borderWidth: thinBorder,
  borderColor: BORDER,
},

  addonScroll: {
    padding: 18,
    maxHeight: 420,
  },

  addonSection: {
    marginBottom: 18,
  },

  addonSectionTitle: {
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.black,
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    fontFamily: appFont,
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  chip: {
  paddingHorizontal: 14,
  paddingVertical: 9,
  borderRadius: radii.full,
  borderWidth: thinBorder,
  borderColor: BORDER,
  backgroundColor: '#FAFAFB',
},

  chipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  chipText: {
    fontSize: fontSizes.md,
    color: '#374151',
    fontWeight: fontWeights.extrabold,
    fontFamily: appFont,
  },

  chipTextActive: {
    color: '#fff',
  },

  addonErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FEF2F2',
    borderWidth: thinBorder,
    borderColor: '#FECACA',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 18,
    marginTop: 4,
  },

  addonErrorText: {
    color: colors.danger,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.extrabold,
    flex: 1,
    fontFamily: appFont,
  },

  addToOrderBtn: {
    backgroundColor: PRIMARY,
    margin: 18,
    borderRadius: radii.xl,
    paddingVertical: 14,
    alignItems: 'center',
  },

  addToOrderBtnText: {
    color: '#fff',
    fontSize: fontSizes.mdl,
    fontWeight: fontWeights.black,
    fontFamily: appFont,
  },

  toast: {
    position: 'absolute',
    bottom: 30,
    left: '50%',
    transform: [{ translateX: -170 }],
    width: 340,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderRadius: radii.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  toastSuccess: {
    backgroundColor: DARK,
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
  },

  toastError: {
    backgroundColor: DARK,
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },

  toastText: {
    color: '#fff',
    fontSize: fontSizes.md,
    fontWeight: fontWeights.extrabold,
    flex: 1,
    fontFamily: appFont,
  },
});