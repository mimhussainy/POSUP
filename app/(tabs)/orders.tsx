import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, FlatList,
  Modal, ActivityIndicator, StyleSheet, TextInput, Alert, Dimensions, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { fetchRestaurantData } from '../../lib/api';
import { printOrder } from '../../lib/printer';
import { useLanguage } from '../../lib/LanguageContext';

const getLayout = (width: number) => {
  const isSmall = width < 900;
  const isLarge = width > 1440;
  const orderPanel = isSmall ? Math.min(240, width * 0.28) : isLarge ? Math.max(380, width * 0.28) : Math.max(300, width * 0.28);
  const catSidebar = isSmall ? Math.min(80, width * 0.1) : Math.min(130, width * 0.13);
  const productArea = width - orderPanel - catSidebar;
  const numColumns = productArea > 700 ? 4 : productArea > 500 ? 3 : 2;
  const gap = 1;
  const totalGap = gap * (numColumns - 1);
  const cardWidth = (100 - totalGap) / numColumns;
  return { orderPanel, catSidebar, productArea, numColumns, cardWidth };
};

const PRIMARY = '#8B38CB';
const DARK = '#1A1A2E';
const DARK2 = '#252540';

function getCatColor(name: string): string {
  const colors = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63','#00bcd4','#ff5722','#8bc34a','#ff9800','#607d8b','#795548','#673ab7'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
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
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [note, setNote] = useState('');
  const [discount, setDiscount] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountModal, setDiscountModal] = useState(false);
  const [tableModal, setTableModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [orderType, setOrderType] = useState<'walkIn' | 'table' | null>(null);
  const [clearModal, setClearModal] = useState(false);
  const [addonModal, setAddonModal] = useState(false);
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
    const sub = Dimensions.addEventListener('change', ({ window }) => setLayout(getLayout(window.width)));
    return () => sub?.remove();
  }, []);

  useEffect(() => { loadData(); }, []);

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
      if (data.restaurant?.name) await AsyncStorage.setItem('restaurant_name', data.restaurant.name);

      // Fetch printer settings from profile endpoint
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
      if (cats.length > 0) setSelectedCategory(cats[0].id);
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
    if (searchQuery.trim()) return normalizeText(p.name).includes(normalizeText(searchQuery));
    return selectedCategory ? p.category_ids.includes(selectedCategory) : true;
  });

  function getProductAddons(product: any) {
    return addons.filter(a =>
      a.assigned_category_ids.some((id: string) => product.category_ids.includes(id)) ||
      a.assigned_product_ids.includes(product.id)
    );
  }

  function addProductDirectly(product: any) {
    const price = product.price || 0;
    setCart(prev => {
      const idx = prev.findIndex(i => i.product.id === product.id && i.addons.length === 0 && !i.variation);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], quantity: updated[idx].quantity + 1 };
        return updated;
      }
      return [...prev, { id: Date.now().toString(), product, variation: null, addons: [], note: '', price, quantity: 1 }];
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
      if (current.includes(optionId)) return { ...prev, [groupId]: current.filter(id => id !== optionId) };
      return { ...prev, [groupId]: [...current, optionId] };
    });
  }

  function addToCart() {
    if (!selectedProduct) return;
    if (selectedProduct.variations?.length > 0 && !selectedVariation) {
      setAddonError('Please select a size or variation');
      return;
    }
    for (const group of productAddons) {
      const isRequired = group.required || group.options.some((o: any) => o.required);
      if (isRequired && !(selectedAddonOptions[group.id]?.length > 0)) {
        setAddonError(`Please select: ${group.name}`);
        return;
      }
    }
    const chosenAddons: any[] = [];
    let addonTotal = 0;
    productAddons.forEach(group => {
      const selected = selectedAddonOptions[group.id] || [];
      selected.forEach(optId => {
        const opt = group.options.find((o: any) => o.id === optId);
        if (opt) { addonTotal += opt.price || 0; chosenAddons.push(opt); }
      });
    });
    const basePrice = selectedVariation ? selectedVariation.price : selectedProduct.price;
    const totalPrice = basePrice + addonTotal;
    setCart(prev => [...prev, {
      id: Date.now().toString(),
      product: selectedProduct,
      variation: selectedVariation,
      addons: chosenAddons,
      note: '',
      price: totalPrice,
      quantity: 1,
    }]);
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

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountAmount = () => {
    if (!discount || parseFloat(discount) === 0) return 0;
    if (discountType === 'percent') return subtotal * (Math.min(100, parseFloat(discount)) / 100);
    return Math.min(parseFloat(discount), subtotal);
  };
  const orderTotal = subtotal - discountAmount();

  function clearOrder() {
    if (Platform.OS === 'web') {
      if (window.confirm('Clear all items?')) { setCart([]); setNote(''); setDiscount(''); }
    } else {
      setClearModal(true);
    }
  }

  async function placeOrder() {
    if (cart.length === 0) return;
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
          price: (i.price).toFixed(2),
          total: (i.price * i.quantity).toFixed(2),
          variation: i.variation?.name || '',
          addons: i.addons.map(a => ({ label: a.name, price: a.price })),
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
        const placedOrder = { ...order, order_number: data.order_id, order_id: data.order_id };
        setCart([]); setNote(''); setDiscount('');
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
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={{ marginTop: 12, color: '#666', fontSize: 14 }}>{t.loadingMenu}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── CATEGORY SIDEBAR ── */}
      <View style={[styles.catSidebar, { width: layout.catSidebar }]}>
        <View style={styles.catLogoWrap}>
          {restaurantLogo ? (
            <Image source={{ uri: restaurantLogo }} style={{ width: layout.catSidebar - 20, height: 50 }} resizeMode="contain" />
          ) : (
            <Text style={styles.catLogoText}>{restaurantCode?.toUpperCase()?.slice(0, 2)}</Text>
          )}
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.catSidebarContent}>
          {categories.map(cat => {
            const active = selectedCategory === cat.id && !searchQuery;
            const letter = cat.name.trim()[0]?.toUpperCase() || '?';
            const color = getCatColor(cat.name);
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.catItem, active && styles.catItemActive]}
                onPress={() => { setSelectedCategory(cat.id); setSearchQuery(''); }}
              >
                <View style={[styles.catBadge, { backgroundColor: active ? PRIMARY : color + '22' }]}>
                  <Text style={[styles.catBadgeLetter, { color: active ? '#fff' : color }]}>{letter}</Text>
                </View>
                <Text style={[styles.catItemText, active && styles.catItemTextActive]} numberOfLines={2}>{cat.name}</Text>
                {active && <View style={styles.catActiveBar} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── MIDDLE PRODUCT AREA ── */}
      <View style={styles.middle}>
        <View style={styles.topBar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={16} color="#aaa" />
            <TextInput
              style={styles.searchInput}
              placeholder={t.searchProducts}
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color="#bbb" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity style={styles.syncBtn} onPress={() => loadData(true)} disabled={refreshing}>
            {refreshing ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="sync-outline" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>

        <FlatList
          data={filteredProducts}
          keyExtractor={p => p.id}
          numColumns={layout.numColumns}
          key={layout.numColumns}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.productCard, { width: `${layout.cardWidth}%` }]}
              onPress={() => openProductModal(item)}
              activeOpacity={0.75}
            >
              <Text style={styles.productName} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.productPrice}>
                CHF {item.type === 'variable' && item.variations?.length > 0
                  ? parseFloat(item.variations[0].price).toFixed(2)
                  : parseFloat(item.price).toFixed(2)}
              </Text>
              <View style={styles.productAddBtn}>
                <Ionicons name="add" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="search-outline" size={36} color="#ddd" />
              <Text style={styles.emptyText}>{t.searchProducts}</Text>
            </View>
          }
        />
      </View>

      {/* ── ORDER PANEL ── */}
      <View style={[styles.orderPanel, { width: layout.orderPanel }]}>
        <View style={styles.orderHeader}>
          <Text style={styles.orderTitle}>{t.order}</Text>
          {cart.length > 0 && (
            <TouchableOpacity onPress={clearOrder} style={styles.clearBtn}>
              <Ionicons name="trash-outline" size={13} color="#ff6b6b" />
              <Text style={styles.clearBtnText}>{t.clear}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Table / Walk-in selector */}
        <TouchableOpacity style={styles.tableSelector} onPress={() => setTableModal(true)}>
          <Ionicons name="grid-outline" size={14} color={selectedTable ? PRIMARY : '#666'} />
          <Text style={[styles.tableSelectorText, (selectedTable || orderType) && { color: PRIMARY }]}>
            {selectedTable ? `${t.table} ${selectedTable}` : orderType === 'walkIn' ? `🚶 ${t.walkIn}` : `${t.walkIn} / ${t.table}`}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#999" />
        </TouchableOpacity>

        {cart.length === 0 ? (
          <View style={styles.emptyOrder}>
            <Ionicons name="cart-outline" size={44} color="#333" />
            <Text style={styles.emptyText}>{t.addItemsToStart}</Text>
          </View>
        ) : (
          <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
            <View style={styles.itemsHeader}>
              <Text style={[styles.itemsHeaderText, { width: 32 }]}>Qty</Text>
              <Text style={[styles.itemsHeaderText, { flex: 1 }]}>Product</Text>
              <Text style={[styles.itemsHeaderText, { width: 70, textAlign: 'right' }]}>Price</Text>
            </View>
            {cart.map(item => (
              <View key={item.id} style={styles.orderItem}>
                <View style={styles.orderItemRow}>
                  <View style={styles.qtyInline}>
                    <TouchableOpacity onPress={() => updateQty(item.id, -1)} style={styles.qtyMiniBtn}>
                      <Ionicons name="remove" size={10} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.orderItemQty}>{item.quantity}</Text>
                    <TouchableOpacity onPress={() => updateQty(item.id, 1)} style={styles.qtyMiniBtn}>
                      <Ionicons name="add" size={10} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.orderItemMid}>
                    <View style={styles.orderItemNameRow}>
                      <Text style={styles.orderItemName} numberOfLines={1}>
                        {item.product.name}{item.variation ? ` — ${item.variation.name}` : ''}
                      </Text>
                      <TouchableOpacity onPress={() => removeItem(item.id)}>
                        <Ionicons name="close-circle" size={15} color="#333" />
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.orderItemPrice}>CHF {(item.price * item.quantity).toFixed(2)}</Text>
                    {item.addons.map((a: any, i: number) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={styles.orderItemSub}>+ {a.name}</Text>
                        {a.price > 0 && <Text style={styles.orderItemSub}>CHF {a.price.toFixed(2)}</Text>}
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        )}

        <TextInput
          style={styles.noteInput}
          placeholder={t.orderNote}
          placeholderTextColor="#888"
          value={note}
          onChangeText={setNote}
          multiline
        />

        <View style={styles.payRow}>
          <TouchableOpacity style={[styles.payBtn, paymentMethod === 'cash' && styles.payBtnActive]} onPress={() => setPaymentMethod('cash')}>
            <Text style={styles.payEmoji}>💵</Text>
            <Text style={[styles.payBtnText, paymentMethod === 'cash' && styles.payBtnTextActive]}>{t.cash}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.payBtn, paymentMethod === 'card' && styles.payBtnActive]} onPress={() => setPaymentMethod('card')}>
            <Text style={styles.payEmoji}>💳</Text>
            <Text style={[styles.payBtnText, paymentMethod === 'card' && styles.payBtnTextActive]}>{t.card}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.totalsBox}>
          <View style={styles.totalRow}>
            <Text style={styles.totalRowLabel}>{t.subtotal}</Text>
            <Text style={styles.totalRowVal}>CHF {subtotal.toFixed(2)}</Text>
          </View>
          {discountAmount() > 0 && (
            <View style={styles.totalRow}>
              <Text style={[styles.totalRowLabel, { color: '#22c55e' }]}>
                {t.discount} {discountType === 'percent' ? `(${discount}%)` : '(Fixed)'}
              </Text>
              <Text style={[styles.totalRowVal, { color: '#22c55e' }]}>- CHF {discountAmount().toFixed(2)}</Text>
            </View>
          )}
          <View style={[styles.totalRow, { marginTop: 6 }]}>
            <Text style={styles.grandTotalLabel}>{t.total}</Text>
            <Text style={styles.grandTotalAmt}>CHF {orderTotal.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.actionBtns}>
          <TouchableOpacity style={styles.discountBtn} onPress={() => setDiscountModal(true)}>
            <Ionicons name="pricetag-outline" size={14} color="#f59e0b" />
            <Text style={styles.discountBtnText}>
              {discount ? `${discount}${discountType === 'percent' ? '%' : ' CHF'}` : t.discount}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.placeBtn, (cart.length === 0 || placingOrder) && styles.placeBtnDisabled]}
            onPress={placeOrder}
            disabled={cart.length === 0 || placingOrder}
          >
            {placingOrder ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.placeBtnText}>{t.placeOrder}</Text>}
          </TouchableOpacity>
        </View>
      </View>
          {/* ── CLEAR MODAL ── */}
      <Modal visible={clearModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.discountModalBox, { width: 340 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.clearOrder}</Text>
              <TouchableOpacity onPress={() => setClearModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.discountBody}>
              <Text style={{ fontSize: 14, color: '#555', marginBottom: 20 }}>{t.clearOrderConfirm}</Text>
              <View style={styles.discountActions}>
                <TouchableOpacity style={styles.discountClearBtn} onPress={() => setClearModal(false)}>
                  <Text style={styles.discountClearBtnText}>{t.cancel}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.discountApplyBtn}
                  onPress={() => { setCart([]); setNote(''); setDiscount(''); setClearModal(false); }}
                >
                  <Text style={styles.discountApplyBtnText}>{t.clear}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
      
      {/* TABLE MODAL */}
      <Modal visible={tableModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.addonModalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.orderType}</Text>
              <TouchableOpacity onPress={() => setTableModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ padding: 16 }}>
              <Text style={styles.addonSectionTitle}>{t.orderType}</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                <TouchableOpacity
                  style={[styles.tableTypeBtn, orderType === 'walkIn' && styles.tableTypeBtnActive]}
                  onPress={() => { setOrderType('walkIn'); setSelectedTable(null); setTableModal(false); }}
                >
                  <Ionicons name="walk-outline" size={20} color={orderType === 'walkIn' ? '#fff' : '#666'} />
                  <Text style={[styles.tableTypeBtnText, orderType === 'walkIn' && { color: '#fff' }]}>{t.walkIn}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.tableTypeBtn, orderType === 'table' && styles.tableTypeBtnActive]}
                  onPress={() => setOrderType('table')}
                >
                  <Ionicons name="grid-outline" size={20} color={orderType === 'table' ? '#fff' : '#666'} />
                  <Text style={[styles.tableTypeBtnText, orderType === 'table' && { color: '#fff' }]}>{t.table}</Text>
                </TouchableOpacity>
              </View>

              {orderType === 'table' && (
                <>
                  <Text style={styles.addonSectionTitle}>{t.selectTable}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(tNum => (
                      <TouchableOpacity
                        key={tNum}
                        style={[styles.tableCard, selectedTable === tNum && styles.tableCardActive]}
                        onPress={() => { setSelectedTable(tNum); setTableModal(false); }}
                      >
                        <Text style={[styles.tableCardNum, selectedTable === tNum && { color: '#fff' }]}>{tNum}</Text>
                        <Text style={[styles.tableCardText, selectedTable === tNum && { color: '#fff' }]}>{t.table}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* ── DISCOUNT MODAL ── */}
      <Modal visible={discountModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.discountModalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t.applyDiscount}</Text>
              <TouchableOpacity onPress={() => setDiscountModal(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.discountBody}>
              {/* Tabs */}
              <View style={styles.discountTypeRow}>
                <TouchableOpacity
                  style={[styles.discountTypeBtn, discountType === 'percent' && styles.discountTypeBtnActive]}
                  onPress={() => { setDiscountType('percent'); setDiscount(''); }}
                >
                  <Text style={[styles.discountTypeBtnText, discountType === 'percent' && styles.discountTypeBtnTextActive]}>{t.percentage}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.discountTypeBtn, discountType === 'fixed' && styles.discountTypeBtnActive]}
                  onPress={() => { setDiscountType('fixed'); setDiscount(''); }}
                >
                  <Text style={[styles.discountTypeBtnText, discountType === 'fixed' && styles.discountTypeBtnTextActive]}>{t.fixedChf}</Text>
                </TouchableOpacity>
              </View>

              {/* Quick presets */}
              <View style={styles.discountPresets}>
                {discountType === 'percent'
                  ? ['5', '10', '15', '20', '25', '50'].map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.presetBtn, discount === v && styles.presetBtnActive]}
                        onPress={() => setDiscount(v)}
                      >
                        <Text style={[styles.presetBtnText, discount === v && styles.presetBtnTextActive]}>{v}%</Text>
                      </TouchableOpacity>
                    ))
                  : ['1', '2', '5', '10', '20', '50'].map(v => (
                      <TouchableOpacity
                        key={v}
                        style={[styles.presetBtn, discount === v && styles.presetBtnActive]}
                        onPress={() => setDiscount(v)}
                      >
                        <Text style={[styles.presetBtnText, discount === v && styles.presetBtnTextActive]}>CHF {v}</Text>
                      </TouchableOpacity>
                    ))
                }
              </View>

              {/* Custom input */}
              <TextInput
                style={styles.discountInput}
                placeholder={discountType === 'percent' ? 'Custom %...' : 'Custom CHF...'}
                placeholderTextColor="#bbb"
                value={discount}
                onChangeText={v => {
                  const c = v.replace(',', '.');
                  if (discountType === 'percent') {
                    const n = parseFloat(c);
                    setDiscount(!c ? '' : !isNaN(n) ? String(Math.min(100, Math.max(0, n))) : discount);
                  } else setDiscount(c);
                }}
                keyboardType="numeric"
              />

              {/* Preview */}
              {discount ? (
                <View style={styles.discountPreview}>
                  <Text style={styles.discountPreviewLabel}>{t.discountAmount}</Text>
                  <Text style={styles.discountPreviewAmt}>- CHF {discountAmount().toFixed(2)}</Text>
                  <Text style={styles.discountPreviewTotal}>{t.newTotal}: CHF {orderTotal.toFixed(2)}</Text>
                </View>
              ) : null}

              <View style={styles.discountActions}>
                <TouchableOpacity style={styles.discountClearBtn} onPress={() => { setDiscount(''); setDiscountModal(false); }}>
                  <Text style={styles.discountClearBtnText}>{t.removeDiscount}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.discountApplyBtn} onPress={() => setDiscountModal(false)}>
                  <Text style={styles.discountApplyBtnText}>{t.apply}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── ADDON MODAL ── */}
      <Modal visible={addonModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.addonModalBox}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{selectedProduct?.name}</Text>
                <Text style={styles.modalSubtitle}>
                  CHF {selectedVariation ? parseFloat(selectedVariation.price).toFixed(2) : parseFloat(selectedProduct?.price || 0).toFixed(2)}
                </Text>
              </View>
              <TouchableOpacity onPress={() => { setAddonError(''); setAddonModal(false); }} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.addonScroll}>
              {/* Variations */}
              {selectedProduct?.variations?.length > 0 && (
                <View style={styles.addonSection}>
                  <Text style={styles.addonSectionTitle}>Size / Variation *</Text>
                  <View style={styles.chipsRow}>
                    {selectedProduct.variations.map((v: any) => (
                      <TouchableOpacity
                        key={v.id}
                        style={[styles.chip, selectedVariation?.id === v.id && styles.chipActive]}
                        onPress={() => setSelectedVariation(v)}
                      >
                        <Text style={[styles.chipText, selectedVariation?.id === v.id && styles.chipTextActive]}>
                          {v.name.replace(/^.*?-\s*-\s*-\s*/,'').trim()} — CHF {parseFloat(v.price).toFixed(2)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Addons */}
              {productAddons.map(group => (
                <View key={group.id} style={styles.addonSection}>
                  <Text style={styles.addonSectionTitle}>
                    {group.name}{group.options.some((o: any) => o.required) ? ' *' : ''}
                  </Text>
                  <View style={styles.chipsRow}>
                    {group.options.map((opt: any) => {
                      const isSelected = (selectedAddonOptions[group.id] || []).includes(opt.id);
                      return (
                        <TouchableOpacity
                          key={opt.id}
                          style={[styles.chip, isSelected && styles.chipActive]}
                          onPress={() => toggleAddonOption(group.id, opt.id, opt.type || 'checkbox')}
                        >
                          <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                            {opt.name}{opt.price > 0 ? ` +${opt.price}` : ''}
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
                <Ionicons name="alert-circle-outline" size={16} color="#e74c3c" />
                <Text style={styles.addonErrorText}>{addonError}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.addToOrderBtn} onPress={addToCart}>
              <Text style={styles.addToOrderBtnText}>{t.addToOrder}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── TOAST ── */}
      {toast && (
        <View style={[styles.toast, toast.type === 'error' ? styles.toastError : styles.toastSuccess]}>
          <Text style={styles.toastText}>{toast.message}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, flexDirection: 'row', backgroundColor: '#f7f8fa' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyText: { color: '#bbb', fontSize: 14, fontWeight: '600' },

  // CATEGORY SIDEBAR
  catSidebar: { backgroundColor: '#fff', borderRightWidth: 1, borderRightColor: '#f0f0f0' },
  catLogoWrap: { height: 80, justifyContent: 'center', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#f0f0f0', padding: 10, paddingTop: 20 },
  catLogoText: { fontSize: 16, fontWeight: '900', color: PRIMARY },
  catSidebarContent: { paddingVertical: 8 },
  catItem: { alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, position: 'relative' },
  catItemActive: { backgroundColor: '#f5eeff' },
  catBadge: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  catBadgeLetter: { fontSize: 17, fontWeight: '800' },
  catItemText: { fontSize: 13, fontWeight: '700', color: '#666', textAlign: 'center', lineHeight: 16 },
  catItemTextActive: { color: PRIMARY },
  catActiveBar: { position: 'absolute', left: 0, top: 8, bottom: 8, width: 3, backgroundColor: PRIMARY, borderRadius: 2 },

  // MIDDLE
  middle: { flex: 1, backgroundColor: '#f7f8fa' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15, backgroundColor: '#f7f8fa', height: 70 },
  searchWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 50, paddingHorizontal: 14, gap: 8, borderWidth: 1, borderColor: '#e8e8e8', height: 44 },
  searchInput: { flex: 1, fontSize: 14, color: '#000', padding: 0 },
  syncBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center' },
    grid: { padding: 15, paddingTop: 8 },
  gridRow: { gap: '1%' as any, marginBottom: 10, justifyContent: 'flex-start' },
  productCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, minHeight: 100, justifyContent: 'space-between', borderWidth: 1, borderColor: '#efefef' },
  productName: { fontSize: 14, fontWeight: '700', color: '#111', lineHeight: 20, marginBottom: 6 },
  productPrice: { fontSize: 16, fontWeight: '900', color: PRIMARY },
  productAddBtn: { position: 'absolute', bottom: 10, right: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center' },

  // ORDER PANEL
  orderPanel: { backgroundColor: DARK, padding: 14, paddingTop: 16, justifyContent: 'space-between' },
  orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  orderTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,107,107,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  clearBtnText: { fontSize: 12, fontWeight: '700', color: '#ff6b6b' },
  emptyOrder: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  itemsList: { flex: 1 },
  itemsHeader: { flexDirection: 'row', paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: '#252540', marginBottom: 6 },
  itemsHeaderText: { fontSize: 11, fontWeight: '700', color: '#666', textTransform: 'uppercase' },
  orderItem: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e1e35' },
  orderItemRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  qtyInline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  qtyMiniBtn: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  orderItemQty: { fontSize: 13, fontWeight: '800', color: '#fff', minWidth: 14, textAlign: 'center' },
  orderItemMid: { flex: 1 },
  orderItemNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 },
  orderItemName: { fontSize: 13, fontWeight: '600', color: '#fff', lineHeight: 18, flex: 1 },
  orderItemPrice: { fontSize: 13, fontWeight: '800', color: PRIMARY, marginTop: 2 },
  orderItemSub: { fontSize: 12, color: '#888', marginTop: 1 },
  noteInput: { backgroundColor: DARK2, borderRadius: 8, padding: 8, fontSize: 13, color: '#fff', minHeight: 32, textAlignVertical: 'top', marginVertical: 8 },
  payRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  payBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, padding: 8, borderRadius: 8, backgroundColor: DARK2 },
  payBtnActive: { backgroundColor: PRIMARY },
  payEmoji: { fontSize: 14 },
  payBtnText: { fontSize: 13, fontWeight: '700', color: '#888' },
  payBtnTextActive: { color: '#fff' },
  totalsBox: { backgroundColor: DARK2, borderRadius: 10, padding: 10, marginBottom: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  totalRowLabel: { fontSize: 13, color: '#aaa' },
  totalRowVal: { fontSize: 13, fontWeight: '600', color: '#aaa' },
  grandTotalLabel: { fontSize: 19, fontWeight: '800', color: '#ccc' },
  grandTotalAmt: { fontSize: 19, fontWeight: '800', color: '#fff' },
  actionBtns: { flexDirection: 'row', gap: 8 },
  discountBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  discountBtnText: { fontSize: 12, fontWeight: '700', color: '#f59e0b' },
  placeBtn: { flex: 1, backgroundColor: PRIMARY, borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center' },
  placeBtnDisabled: { backgroundColor: '#2a2a40' },
  placeBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // MODALS
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  modalSubtitle: { fontSize: 14, color: PRIMARY, fontWeight: '700', marginTop: 2 },
  modalCloseBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#f5f5f5', justifyContent: 'center', alignItems: 'center' },

  // DISCOUNT MODAL
  discountModalBox: { backgroundColor: '#fff', borderRadius: 20, width: 380, overflow: 'hidden' },
  discountBody: { padding: 16 },
  discountTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  discountTypeBtn: { flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#f5f5f5', alignItems: 'center' },
  discountTypeBtnActive: { backgroundColor: PRIMARY },
  discountTypeBtnText: { fontSize: 14, fontWeight: '700', color: '#555' },
  discountTypeBtnTextActive: { color: '#fff' },
  discountInput: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 10, padding: 12, fontSize: 16, color: '#111', marginBottom: 12 },
  discountPreview: { backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12, marginBottom: 12, gap: 3 },
  discountPreviewLabel: { fontSize: 12, color: '#555' },
  discountPreviewAmt: { fontSize: 20, fontWeight: '800', color: '#16a34a' },
  discountPreviewTotal: { fontSize: 13, color: '#555' },
  discountActions: { flexDirection: 'row', gap: 8 },
  discountClearBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#fef2f2', alignItems: 'center' },
  discountClearBtnText: { fontSize: 14, fontWeight: '700', color: '#e74c3c' },
  discountApplyBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: PRIMARY, alignItems: 'center' },
  discountApplyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ADDON MODAL
  addonModalBox: { backgroundColor: '#fff', borderRadius: 20, width: '54%', maxHeight: '82%', overflow: 'hidden' },
  addonScroll: { padding: 16, maxHeight: 380 },
  addonSection: { marginBottom: 16 },
  addonSectionTitle: { fontSize: 12, fontWeight: '800', color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#fafafa' },
  chipActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 13, color: '#333', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  addToOrderBtn: { backgroundColor: PRIMARY, margin: 16, borderRadius: 12, padding: 14, alignItems: 'center' },
  addToOrderBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  addonErrorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 16, marginTop: 4 },
  addonErrorText: { color: '#e74c3c', fontSize: 13, fontWeight: '700', flex: 1 },


  discountPresets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  presetBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#e0e0e0', backgroundColor: '#fafafa' },
  presetBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  presetBtnText: { fontSize: 13, fontWeight: '700', color: '#555' },
  presetBtnTextActive: { color: '#fff' },


  // TOAST
  toast: { position: 'absolute', bottom: 30, left: '50%', transform: [{ translateX: -160 }], width: 320, padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  toastSuccess: { backgroundColor: '#1a1a2e', borderLeftWidth: 4, borderLeftColor: PRIMARY },
  toastError: { backgroundColor: '#1a1a2e', borderLeftWidth: 4, borderLeftColor: '#e74c3c' },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
  tableSelector: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: DARK2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10 },
  tableSelectorText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#aaa' },
  tableTypeBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 10, backgroundColor: DARK2, gap: 6 },
  tableTypeBtnActive: { backgroundColor: PRIMARY },
  tableTypeBtnText: { fontSize: 13, fontWeight: '700', color: '#666' },
  tableCard: { width: 70, height: 70, borderRadius: 10, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', gap: 2 },
  tableCardActive: { backgroundColor: PRIMARY },
  tableCardNum: { fontSize: 20, fontWeight: '900', color: '#333' },
  tableCardText: { fontSize: 11, fontWeight: '600', color: '#666' },
});