import { useState, useEffect, useCallback } from 'react';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fetchRestaurantData } from '../../lib/api';
import { printOrder } from '../../lib/printer';
import { useLanguage } from '../../lib/LanguageContext';
import { appFont } from '../../lib/fonts';

const PRIMARY = '#8B38CB';
const PRIMARY_SOFT = '#F6EEFF';

const APP_BG = '#F7F8FB';
const CARD_BG = '#FFFFFF';
const BORDER = '#E7EAF1';
const TEXT = '#151521';
const MUTED = '#7B7F8C';

const DARK = '#17172A';
const DARK_CARD = '#24243E';
const DARK_CARD_2 = '#2B2B49';
const DARK_BORDER = '#33334F';

const getLayout = (width: number) => {
  const isCompact = width < 900;
  const isLarge = width > 1440;

  const catSidebar = isCompact
    ? Math.max(108, Math.min(132, width * 0.15))
    : Math.max(142, Math.min(184, width * 0.115));

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

function getCatColor(name: string): string {
  const colors = [
    '#FF6B6B',
    '#F97316',
    '#FACC15',
    '#22C55E',
    '#14B8A6',
    '#38BDF8',
    '#8B5CF6',
    '#EC4899',
    '#06B6D4',
    '#F59E0B',
    '#84CC16',
    '#64748B',
    '#A855F7',
    '#FB7185',
    '#2DD4BF',
  ];

  let hash = 0;

  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

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
  const [orderType, setOrderType] = useState<'walkIn' | 'table' | null>(null);

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

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
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
      showToast('Failed to load products', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const normalizeText = (v: string) =>
    (v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

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

    setCart(prev => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        product: selectedProduct,
        variation: selectedVariation,
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

  const orderTotal = subtotal - discountAmount();

  function clearOrder() {
    setClearModal(true);
  }

  async function placeOrder() {
    if (cart.length === 0) return;

    const dayClosedDate = await AsyncStorage.getItem('day_closed_date');
    const todayStr = new Date().toLocaleDateString('de-CH', { timeZone: 'Europe/Zurich' });

    if (dayClosedDate === todayStr) {
      showToast(t.dayClosedCannotOrder, 'error');
      return;
    }

    setPlacingOrder(true);

    try {
      const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';

      const order = {
        restaurant_code: restaurantCode,
        table: selectedTable ? `Table ${selectedTable}` : orderType === 'walkIn' ? 'Walk-in' : 'Not specified',
        order_type: orderType || 'walkIn',
        items: cart.map(i => ({
          name: i.product.name,
          quantity: i.quantity,
          price: money(i.price).toFixed(2),
          total: (money(i.price) * i.quantity).toFixed(2),
          variation: i.variation?.name || '',
          addons: i.addons.map(a => ({
            label: a.name,
            price: money(a.price),
          })),
        })),
        subtotal: subtotal.toFixed(2),
        discount: discountAmount().toFixed(2),
        discount_type: discountType,
        discount_value: discount,
        total: orderTotal.toFixed(2),
        currency: 'CHF',
        payment_method: paymentMethod,
        note,
        source: 'posup',
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

        setCart([]);
        setNote('');
        setDiscount('');

        showToast(`✓ Order ${data.order_id} placed`);

        try {
          await printOrder(placedOrder, restaurantCode);
        } catch (printErr: any) {
          console.log('Print failed:', printErr?.message);
        }
      } else {
        showToast('Failed to place order', 'error');
      }
    } catch (e: any) {
      showToast('Failed to place order', 'error');
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
          {categories.map(cat => {
            const active = selectedCategory === cat.id && !searchQuery;
            const letter = cat.name.trim()[0]?.toUpperCase() || '?';
            const color = getCatColor(cat.name);

            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catItem,
                  active && styles.catItemActive,
                ]}
                onPress={() => {
                  setSelectedCategory(cat.id);
                  setSearchQuery('');
                }}
                activeOpacity={0.78}
              >
                {active && <View style={styles.catActiveBar} />}

                <View
                  style={[
                    styles.catBadge,
                    {
                      backgroundColor: active ? PRIMARY : `${color}16`,
                      borderColor: active ? PRIMARY : `${color}28`,
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
                </View>

                <Text
                  style={[
                    styles.catItemText,
                    active && styles.catItemTextActive,
                  ]}
                  numberOfLines={2}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
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
                  <Text style={styles.productPriceLabel}>Preis</Text>
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
              <Text style={styles.emptyTitle}>Keine Produkte gefunden</Text>
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

          <TouchableOpacity
            style={styles.tableSelector}
            onPress={() => setTableModal(true)}
            activeOpacity={0.78}
          >
            <View style={styles.tableIconWrap}>
              <Ionicons
                name={selectedTable ? 'grid-outline' : orderType === 'walkIn' ? 'walk-outline' : 'albums-outline'}
                size={15}
                color={PRIMARY}
              />
            </View>

            <Text
              style={[
                styles.tableSelectorText,
                (selectedTable || orderType) && styles.tableSelectorTextActive,
              ]}
              numberOfLines={1}
            >
              {selectedTable
                ? `${t.table} ${selectedTable}`
                : orderType === 'walkIn'
                  ? `🚶 ${t.walkIn}`
                  : `${t.walkIn} / ${t.table}`}
            </Text>

            <Ionicons name="chevron-down" size={15} color="#A8A8BC" />
          </TouchableOpacity>
        </View>

        {cart.length === 0 ? (
          <View style={styles.emptyOrder}>
            <View style={styles.emptyCartCircle}>
              <Ionicons name="cart-outline" size={42} color="#5A5A78" />
            </View>
            <Text style={styles.emptyOrderTitle}>{t.addItemsToStart}</Text>
            <Text style={styles.emptyOrderSub}>
              Wähle Produkte aus der Liste links.
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.itemsList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.itemsListContent}
          >
            <View style={styles.itemsHeader}>
              <Text style={[styles.itemsHeaderText, { width: 74 }]}>Qty</Text>
              <Text style={[styles.itemsHeaderText, { flex: 1 }]}>Product</Text>
              <Text style={[styles.itemsHeaderText, { width: 74, textAlign: 'right' }]}>Price</Text>
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

            {discountAmount() > 0 && (
              <View style={styles.totalRow}>
                <Text style={[styles.totalRowLabel, styles.discountTotalLabel]}>
                  {t.discount} {discountType === 'percent' ? `(${discount}%)` : '(Fixed)'}
                </Text>
                <Text style={[styles.totalRowVal, styles.discountTotalValue]}>
                  - CHF {discountAmount().toFixed(2)}
                </Text>
              </View>
            )}

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
                (cart.length === 0 || placingOrder) && styles.placeBtnDisabled,
              ]}
              onPress={placeOrder}
              disabled={cart.length === 0 || placingOrder}
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
                <Text style={styles.modalSubtitleLight}>Diese Bestellung zurücksetzen</Text>
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
                <Text style={styles.modalTitle}>{t.orderType}</Text>
                <Text style={styles.modalSubtitleLight}>Walk-in oder Tisch auswählen</Text>
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
              <Text style={styles.addonSectionTitle}>{t.orderType}</Text>

              <View style={styles.tableTypeRow}>
                <TouchableOpacity
                  style={[
                    styles.tableTypeBtn,
                    orderType === 'walkIn' && styles.tableTypeBtnActive,
                  ]}
                  onPress={() => {
                    setOrderType('walkIn');
                    setSelectedTable(null);
                    setTableModal(false);
                  }}
                  activeOpacity={0.78}
                >
                  <Ionicons
                    name="walk-outline"
                    size={22}
                    color={orderType === 'walkIn' ? '#fff' : '#6F7280'}
                  />
                  <Text
                    style={[
                      styles.tableTypeBtnText,
                      orderType === 'walkIn' && styles.tableTypeBtnTextActive,
                    ]}
                  >
                    {t.walkIn}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.tableTypeBtn,
                    orderType === 'table' && styles.tableTypeBtnActive,
                  ]}
                  onPress={() => setOrderType('table')}
                  activeOpacity={0.78}
                >
                  <Ionicons
                    name="grid-outline"
                    size={22}
                    color={orderType === 'table' ? '#fff' : '#6F7280'}
                  />
                  <Text
                    style={[
                      styles.tableTypeBtnText,
                      orderType === 'table' && styles.tableTypeBtnTextActive,
                    ]}
                  >
                    {t.table}
                  </Text>
                </TouchableOpacity>
              </View>

              {orderType === 'table' && (
                <>
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
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={discountModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.discountModalBox, { width: layout.discountModalWidth }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t.applyDiscount}</Text>
                <Text style={styles.modalSubtitleLight}>Rabatt zur Bestellung hinzufügen</Text>
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
                placeholder={discountType === 'percent' ? 'Custom %...' : 'Custom CHF...'}
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
                    - CHF {discountAmount().toFixed(2)}
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

const thinBorder = StyleSheet.hairlineWidth;

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
    borderRadius: 16,
    paddingHorizontal: 26,
    paddingVertical: 22,
    alignItems: 'center',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  loadingText: {
    marginTop: 12,
    color: MUTED,
    fontSize: 14,
    fontWeight: '500',
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
    fontSize: 16,
    fontWeight: '700',
    fontFamily: appFont,
  },

  emptyText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '500',
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
    borderRadius: 13,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  catLogoText: {
    fontSize: 15,
    fontWeight: '800',
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
    borderRadius: 14,
    position: 'relative',
    marginBottom: 6,
    minHeight: 54,
    overflow: 'visible',
  },

  catItemActive: {
    backgroundColor: PRIMARY_SOFT,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },

  catBadge: {
    width: 36,
    height: 36,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: thinBorder,
  },

  catBadgeLetter: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: appFont,
  },

  catItemText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '700',
    color: '#4A4D58',
    textAlign: 'left',
    lineHeight: 16,
    fontFamily: appFont,
  },

  catItemTextActive: {
    color: PRIMARY,
  },

  catActiveBar: {
    position: 'absolute',
    left: -8,
    top: 6,
    bottom: 6,
    width: 4,
    backgroundColor: PRIMARY,
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },

  middle: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 8 : 10,
    paddingBottom: 10,
    backgroundColor: APP_BG,
  },

  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 15,
    paddingHorizontal: 14,
    gap: 9,
    borderWidth: thinBorder,
    borderColor: BORDER,
    height: 46,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT,
    padding: 0,
    fontFamily: appFont,
    fontWeight: '500',
  },

  syncBtn: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: PRIMARY,
    justifyContent: 'center',
    alignItems: 'center',
  },

  grid: {
    paddingHorizontal: 14,
    paddingTop: 0,
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
    borderRadius: 15,
    padding: 14,
    minHeight: 104,
    justifyContent: 'space-between',
    borderWidth: thinBorder,
    borderColor: BORDER,
  },

  productName: {
    fontSize: 14,
    fontWeight: '700',
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
    fontSize: 10,
    fontWeight: '800',
    color: '#A4A8B2',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
    fontFamily: appFont,
  },

  productPrice: {
    fontSize: 16,
    fontWeight: '900',
    color: PRIMARY,
    fontFamily: appFont,
  },

  productAddBtn: {
    width: 34,
    height: 34,
    borderRadius: 13,
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
    fontSize: 10,
    fontWeight: '900',
    color: PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: appFont,
  },

  orderTitle: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: appFont,
  },

  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,107,107,0.12)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: thinBorder,
    borderColor: 'rgba(255,107,107,0.20)',
  },

  clearBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FF8A8A',
    fontFamily: appFont,
  },

  tableSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    backgroundColor: DARK_CARD,
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: thinBorder,
    borderColor: DARK_BORDER,
  },

  tableIconWrap: {
    width: 27,
    height: 27,
    borderRadius: 10,
    backgroundColor: 'rgba(139,56,203,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tableSelectorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#B5B5C8',
    fontFamily: appFont,
  },

  tableSelectorTextActive: {
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
    borderRadius: 30,
    backgroundColor: DARK_CARD,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: thinBorder,
    borderColor: DARK_BORDER,
  },

  emptyOrderTitle: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
    color: '#C9C9D8',
    textAlign: 'center',
    fontFamily: appFont,
  },

  emptyOrderSub: {
    fontSize: 12,
    fontWeight: '500',
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
    fontSize: 10,
    fontWeight: '900',
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
    borderRadius: 8,
    backgroundColor: DARK_CARD_2,
    justifyContent: 'center',
    alignItems: 'center',
  },

  qtyTrashBtn: {
    backgroundColor: 'rgba(239,68,68,0.35)',
  },

  orderItemQty: {
    fontSize: 13,
    fontWeight: '900',
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
    fontSize: 13,
    fontWeight: '700',
    color: '#F1F1F6',
    lineHeight: 18,
    flex: 1,
    fontFamily: appFont,
  },

  orderItemPrice: {
    fontSize: 13,
    fontWeight: '900',
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
    fontSize: 11,
    color: '#9999AD',
    fontWeight: '500',
    fontFamily: appFont,
  },

  orderFooter: {
    paddingTop: 8,
  },

  noteInput: {
    backgroundColor: DARK_CARD,
    borderRadius: 13,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 13,
    color: '#F1F1F6',
    minHeight: 36,
    maxHeight: 68,
    textAlignVertical: 'top',
    marginBottom: 8,
    borderWidth: thinBorder,
    borderColor: DARK_BORDER,
    fontFamily: appFont,
    fontWeight: '500',
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
    borderRadius: 12,
    backgroundColor: DARK_CARD,
    borderWidth: thinBorder,
    borderColor: DARK_BORDER,
  },

  payBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  payEmoji: {
    fontSize: 14,
  },

  payBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B5B5C8',
    fontFamily: appFont,
  },

  payBtnTextActive: {
    color: '#fff',
  },

  totalsBox: {
    backgroundColor: DARK_CARD,
    borderRadius: 14,
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
    fontSize: 12,
    color: '#B9B9CB',
    fontWeight: '600',
    fontFamily: appFont,
  },

  totalRowVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#D6D6E2',
    fontFamily: appFont,
  },

  discountTotalLabel: {
    color: '#4ADE80',
  },

  discountTotalValue: {
    color: '#4ADE80',
  },

  totalDivider: {
    height: thinBorder,
    backgroundColor: DARK_BORDER,
    marginVertical: 7,
  },

  grandTotalLabel: {
    fontSize: 17,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: appFont,
  },

  grandTotalAmt: {
    fontSize: 18,
    fontWeight: '900',
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
    borderRadius: 13,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderWidth: thinBorder,
    borderColor: 'rgba(245,158,11,0.32)',
  },

  discountBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#F59E0B',
    fontFamily: appFont,
  },

  placeBtn: {
    flex: 1,
    backgroundColor: PRIMARY,
    borderRadius: 13,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },

  placeBtnDisabled: {
    backgroundColor: '#33334E',
  },

  placeBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: appFont,
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
    fontSize: 17,
    fontWeight: '900',
    color: TEXT,
    fontFamily: appFont,
  },

  modalSubtitle: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: '800',
    marginTop: 3,
    fontFamily: appFont,
  },

  modalSubtitleLight: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '600',
    marginTop: 3,
    fontFamily: appFont,
  },

  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 14,
    backgroundColor: '#F0F1F5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  discountModalBox: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
  },

  discountBody: {
    padding: 16,
  },

  confirmText: {
    fontSize: 14,
    color: '#555B66',
    lineHeight: 20,
    fontWeight: '500',
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
    borderRadius: 13,
    backgroundColor: '#F0F1F5',
    alignItems: 'center',
    borderWidth: thinBorder,
    borderColor: '#E2E4EA',
  },

  discountTypeBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  discountTypeBtnText: {
    fontSize: 13,
    fontWeight: '800',
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
    borderRadius: 999,
    borderWidth: thinBorder,
    borderColor: '#D9DCE4',
    backgroundColor: '#FAFAFB',
  },

  presetBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  presetBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#4B5563',
    fontFamily: appFont,
  },

  presetBtnTextActive: {
    color: '#fff',
  },

  discountInput: {
    borderWidth: thinBorder,
    borderColor: '#D9DCE4',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 16,
    color: TEXT,
    marginBottom: 12,
    backgroundColor: '#FAFAFB',
    fontFamily: appFont,
    fontWeight: '700',
  },

  discountPreview: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    padding: 13,
    marginBottom: 12,
    gap: 3,
    borderWidth: thinBorder,
    borderColor: '#BBF7D0',
  },

  discountPreviewLabel: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '700',
    fontFamily: appFont,
  },

  discountPreviewAmt: {
    fontSize: 20,
    fontWeight: '900',
    color: '#16A34A',
    fontFamily: appFont,
  },

  discountPreviewTotal: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '700',
    fontFamily: appFont,
  },

  discountActions: {
    flexDirection: 'row',
    gap: 8,
  },

  discountClearBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    borderWidth: thinBorder,
    borderColor: '#FECACA',
  },

  discountClearBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#EF4444',
    fontFamily: appFont,
  },

  discountApplyBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
  },

  discountApplyBtnText: {
    fontSize: 13,
    fontWeight: '900',
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
    borderRadius: 16,
    backgroundColor: '#F0F1F5',
    gap: 7,
    borderWidth: thinBorder,
    borderColor: '#E2E4EA',
  },

  tableTypeBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  tableTypeBtnText: {
    fontSize: 13,
    fontWeight: '800',
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
    borderRadius: 18,
    backgroundColor: '#F0F1F5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: thinBorder,
    borderColor: '#E2E4EA',
  },

  tableCardActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  tableCardNum: {
    fontSize: 21,
    fontWeight: '900',
    color: TEXT,
    fontFamily: appFont,
  },

  tableCardNumActive: {
    color: '#fff',
  },

  tableCardText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6F7280',
    fontFamily: appFont,
  },

  tableCardTextActive: {
    color: '#fff',
  },

  addonModalBox: {
    backgroundColor: '#fff',
    borderRadius: 24,
    maxHeight: '84%',
    overflow: 'hidden',
  },

  addonScroll: {
    padding: 18,
    maxHeight: 420,
  },

  addonSection: {
    marginBottom: 18,
  },

  addonSectionTitle: {
    fontSize: 11,
    fontWeight: '900',
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
    borderRadius: 999,
    borderWidth: thinBorder,
    borderColor: '#D9DCE4',
    backgroundColor: '#FAFAFB',
  },

  chipActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  chipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '800',
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
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    fontFamily: appFont,
  },

  addToOrderBtn: {
    backgroundColor: PRIMARY,
    margin: 18,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },

  addToOrderBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
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
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  toastSuccess: {
    backgroundColor: '#17172A',
    borderLeftWidth: 4,
    borderLeftColor: PRIMARY,
  },

  toastError: {
    backgroundColor: '#17172A',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },

  toastText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
    fontFamily: appFont,
  },
});