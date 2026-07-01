import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Modal,
  RefreshControl,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useLanguage } from '../../lib/LanguageContext';
import { appFont } from '../../lib/fonts';
import { printOrder, printZReport } from '../../lib/printer';

const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';

const PRIMARY = '#8B38CB';
const PRIMARY_SOFT = '#F6EEFF';
const PRIMARY_BORDER = '#E9D5FF';

const APP_BG = '#F5F5F5';
const CARD_BG = '#FFFFFF';
const BORDER = '#ECEEF3';
const BORDER_SOFT = '#F1F3F8';
const TEXT = '#111827';
const MUTED = '#6B7280';
const SOFT_TEXT = '#4B5563';

const GREEN = '#16A34A';
const BLUE = '#2563EB';
const ORANGE = '#F97316';
const RED = '#EF4444';

const PAGE_PADDING = 16;
const MAX_CONTENT_WIDTH = 1480;
const ANALYTICS_PANEL_RATIO = 0.35;

interface POSOrder {
  id: string;
  order_number: string;
  items: {
    name: string;
    quantity: number;
    price: string;
    total: string;
    variation: string;
    addons: any[];
  }[];
  subtotal: string;
  discount: string;
  total: string;
  currency: string;
  payment_method: string;
  note: string;
  created_at: string;
}

type ListItem = POSOrder | { id: string; placeholder: true };

const getNumColumns = (width: number) => {
  if (width >= 1050) return 3;
  if (width >= 660) return 2;
  return 1;
};

export default function HistoryScreen() {
  const { t } = useLanguage();
  const historyTitle = (t as any).history || 'History';

  const [restaurantCode, setRestaurantCode] = useState('');
  const [orders, setOrders] = useState<POSOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filter, setFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'card' | 'twint'>('all');

  const [selectedOrder, setSelectedOrder] = useState<POSOrder | null>(null);
  const [dayClosed, setDayClosed] = useState(false);
  const [zReportModal, setZReportModal] = useState(false);

  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);

  const contentWidth = Math.min(windowWidth - PAGE_PADDING * 2, MAX_CONTENT_WIDTH);
const showAnalyticsPanel = windowWidth >= 1100;
const splitGap = showAnalyticsPanel ? PAGE_PADDING : 0;

const analyticsPanelWidth = showAnalyticsPanel
  ? Math.floor((contentWidth - splitGap) * 0.35)
  : 0;

const listWidth = showAnalyticsPanel
  ? contentWidth - splitGap - analyticsPanelWidth
  : contentWidth;

const numColumns = getNumColumns(listWidth);
  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }) => {
      setWindowWidth(window.width);
    });

    return () => sub?.remove();
  }, []);

  const checkDayClose = useCallback(async () => {
    const closed = await AsyncStorage.getItem('day_closed_date');
    const today = new Date().toLocaleDateString('de-CH', {
      timeZone: 'Europe/Zurich',
    });

    if (closed === today) {
      setDayClosed(true);
    } else {
      setDayClosed(false);
      await AsyncStorage.removeItem('day_closed_date');
    }
  }, []);

  const fetchOrders = useCallback(async (code: string, isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const res = await fetch(`${BACKEND}/posup/orders/${code}`);
      const data = await res.json();

      if (data.success) {
        setOrders(data.orders || []);
      }
    } catch (e) {
      console.log('Failed to fetch orders', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('restaurant_code').then(code => {
      if (code) {
        setRestaurantCode(code);
        fetchOrders(code);
      } else {
        setLoading(false);
      }
    });

    checkDayClose();
  }, [fetchOrders, checkDayClose]);

  useFocusEffect(
    useCallback(() => {
      if (restaurantCode) fetchOrders(restaurantCode);
      checkDayClose();
    }, [restaurantCode, fetchOrders, checkDayClose])
  );

  const isToday = (dateStr: string) => {
    const toSwiss = (d: Date) =>
      d.toLocaleDateString('de-CH', { timeZone: 'Europe/Zurich' });

    return toSwiss(new Date(dateStr)) === toSwiss(new Date());
  };

  const parseAmount = (value: string | number | undefined | null) => {
    const num = parseFloat(String(value || '0').replace(',', '.'));
    return Number.isFinite(num) ? num : 0;
  };

  const formatMoney = (value: number) => `CHF ${value.toFixed(2)}`;

  const getPaymentType = (method: string) => {
    const normalized = String(method || '').toLowerCase();

    if (normalized.includes('cash')) return 'cash';
    if (normalized.includes('twint')) return 'twint';

    return 'card';
  };

  const getPaymentLabel = (method: string) => {
    const paymentType = getPaymentType(method);

    if (paymentType === 'cash') return t.cash;
    if (paymentType === 'twint') return 'Twint';

    return t.card;
  };

  const getPaymentIcon = (method: string) => {
    const paymentType = getPaymentType(method);

    if (paymentType === 'cash') return 'cash-outline';
    if (paymentType === 'twint') return 'phone-portrait-outline';

    return 'card-outline';
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const date = new Date(order.created_at);
      const now = new Date();

      let matchesDate = true;

      if (filter === 'today') {
        matchesDate = isToday(order.created_at);
      } else if (filter === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        matchesDate = date >= weekAgo;
      } else if (filter === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setDate(now.getDate() - 30);
        matchesDate = date >= monthAgo;
      }

      if (!matchesDate) return false;

      if (paymentFilter !== 'all') {
        return getPaymentType(order.payment_method) === paymentFilter;
      }

      return true;
    });
  }, [orders, filter, paymentFilter]);

  const paddedOrders = useMemo<ListItem[]>(() => {
    const data: ListItem[] = [...filteredOrders];

    if (numColumns <= 1) return data;

    const remainder = data.length % numColumns;

    if (remainder !== 0) {
      const missing = numColumns - remainder;

      for (let i = 0; i < missing; i++) {
        data.push({
          id: `placeholder-${i}`,
          placeholder: true,
        });
      }
    }

    return data;
  }, [filteredOrders, numColumns]);

  const todayOrders = useMemo(() => {
    return orders.filter(order => isToday(order.created_at));
  }, [orders]);

  const revenue = useMemo(() => {
    return filteredOrders.reduce((sum, order) => sum + parseAmount(order.total), 0);
  }, [filteredOrders]);

  const cashRev = useMemo(() => {
    return filteredOrders
      .filter(order => getPaymentType(order.payment_method) === 'cash')
      .reduce((sum, order) => sum + parseAmount(order.total), 0);
  }, [filteredOrders]);

  const cardRev = useMemo(() => {
    return filteredOrders
      .filter(order => getPaymentType(order.payment_method) === 'card')
      .reduce((sum, order) => sum + parseAmount(order.total), 0);
  }, [filteredOrders]);

  const twintRev = useMemo(() => {
    return filteredOrders
      .filter(order => getPaymentType(order.payment_method) === 'twint')
      .reduce((sum, order) => sum + parseAmount(order.total), 0);
  }, [filteredOrders]);

  const discountTotal = useMemo(() => {
    return filteredOrders.reduce((sum, order) => sum + parseAmount(order.discount), 0);
  }, [filteredOrders]);

  const avgOrder = filteredOrders.length > 0 ? revenue / filteredOrders.length : 0;

  const topProducts = useMemo(() => {
    const productMap: {
      [name: string]: {
        count: number;
        revenue: number;
      };
    } = {};

    filteredOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productMap[item.name]) {
          productMap[item.name] = {
            count: 0,
            revenue: 0,
          };
        }

        productMap[item.name].count += item.quantity;
        productMap[item.name].revenue += parseAmount(item.total);
      });
    });

    return Object.entries(productMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8);
  }, [filteredOrders]);

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('de-CH', {
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('de-CH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const confirmDayClose = async () => {
    const today = new Date().toLocaleDateString('de-CH', {
      timeZone: 'Europe/Zurich',
    });

    const dayRevenue = todayOrders.reduce((sum, order) => sum + parseAmount(order.total), 0);
    const dayCash = todayOrders
      .filter(order => getPaymentType(order.payment_method) === 'cash')
      .reduce((sum, order) => sum + parseAmount(order.total), 0);
    const dayCard = todayOrders
      .filter(order => getPaymentType(order.payment_method) === 'card')
      .reduce((sum, order) => sum + parseAmount(order.total), 0);
    const dayDiscount = todayOrders.reduce((sum, order) => sum + parseAmount(order.discount), 0);
    const dayAvg = todayOrders.length > 0 ? dayRevenue / todayOrders.length : 0;

    const firstOrder = todayOrders.length > 0
      ? [...todayOrders].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0]
      : null;

    const lastOrder = todayOrders.length > 0
      ? [...todayOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null;

    try {
      await printZReport({
        fromLabel: firstOrder ? formatTime(firstOrder.created_at) : '—',
        toLabel: lastOrder ? formatTime(lastOrder.created_at) : '—',
        orderCount: todayOrders.length,
        totalRevenue: dayRevenue,
        cashRevenue: dayCash,
        cardRevenue: dayCard,
        avgOrder: dayAvg,
        totalDiscount: dayDiscount,
      });
    } catch (e) {
      console.log('Z-Report print failed', e);
    }

    await AsyncStorage.setItem('day_closed_date', today);
    setDayClosed(true);
    setZReportModal(false);
  };

  const totalItemCount = (order: POSOrder) => {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const renderStatCard = (
    label: string,
    value: string,
    icon: keyof typeof Ionicons.glyphMap,
    color: string,
    active: boolean,
    onPress: () => void
  ) => {
    return (
      <TouchableOpacity
        style={[styles.statCard, active && styles.statCardActive]}
        onPress={onPress}
        activeOpacity={0.78}
      >
        <View style={[styles.statIconBox, { backgroundColor: `${color}12` }]}>
          <Ionicons name={icon} size={17} color={color} />
        </View>

        <View style={styles.statTextBox}>
          <Text style={[styles.statValue, { color }]} numberOfLines={1}>
            {value}
          </Text>
          <Text style={styles.statLabel} numberOfLines={1}>
            {label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderListHeader = () => {
    return (
      <View style={styles.listHeader}>
        <View style={styles.statsGrid}>
          
          {renderStatCard(
            t.revenue,
            formatMoney(revenue),
            'trending-up-outline',
            PRIMARY,
            paymentFilter === 'all',
            () => setPaymentFilter('all')
          )}

          {renderStatCard(
            t.cash,
            formatMoney(cashRev),
            'cash-outline',
            GREEN,
            paymentFilter === 'cash',
            () => setPaymentFilter(paymentFilter === 'cash' ? 'all' : 'cash')
          )}

          {renderStatCard(
            t.card,
            formatMoney(cardRev),
            'card-outline',
            BLUE,
            paymentFilter === 'card',
            () => setPaymentFilter(paymentFilter === 'card' ? 'all' : 'card')
          )}

          {renderStatCard(
            'Twint',
            formatMoney(twintRev),
            'phone-portrait-outline',
            ORANGE,
            paymentFilter === 'twint',
            () => setPaymentFilter(paymentFilter === 'twint' ? 'all' : 'twint')
          )}
        </View>

        <View style={styles.filtersCard}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            {(
              [
                { key: 'today', label: `${t.today} (${todayOrders.length})` },
                { key: 'week', label: t.sevenDays },
                { key: 'month', label: t.thirtyDays },
                { key: 'all', label: `${t.all} (${orders.length})` },
              ] as const
            ).map(item => (
              <TouchableOpacity
                key={item.key}
                style={[
                  styles.filterTab,
                  filter === item.key && styles.filterTabActive,
                ]}
                onPress={() => setFilter(item.key)}
                activeOpacity={0.78}
              >
                <Text
                  style={[
                    styles.filterTabText,
                    filter === item.key && styles.filterTabTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    );
  };

  const renderAnalyticsFooter = () => {
    const maxProductCount = topProducts[0]?.[1]?.count || 1;

    return (
      <View style={styles.analyticsFooter}>
        <View style={styles.analyticsCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Top Products</Text>
            </View>

            <View style={styles.sectionIconBox}>
              <Ionicons name="bar-chart-outline" size={18} color={PRIMARY} />
            </View>
          </View>

          {topProducts.length === 0 ? (
            <View style={styles.noProductsBox}>
              <View style={styles.noProductsIcon}>
                <Ionicons name="bar-chart-outline" size={34} color="#C6CBD6" />
              </View>
              <Text style={styles.noProductsText}>{t.noOrders}</Text>
            </View>
          ) : (
            <View style={styles.topProductsGrid}>
              {topProducts.map(([name, data], index) => {
                const width = `${Math.max(8, (data.count / maxProductCount) * 100)}%`;

                return (
                  <View key={name} style={styles.topProductRow}>
                    <View style={[
                      styles.topProductRankBox,
                      index === 0 && styles.topProductRankBoxFirst,
                    ]}>
                      <Text style={[
                        styles.topProductRank,
                        index === 0 && styles.topProductRankFirst,
                      ]}>
                        {index + 1}
                      </Text>
                    </View>

                    <View style={styles.topProductMiddle}>
                      <Text style={styles.topProductName} numberOfLines={1}>
                        {name}
                      </Text>

                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: width as any }]} />
                      </View>
                    </View>

                    <View style={styles.topProductRight}>
                      <Text style={styles.topProductCount}>{data.count}x</Text>
                      <Text style={styles.topProductRevenue}>
                        {formatMoney(data.revenue)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Summary</Text>
            </View>

            <View style={styles.sectionIconBox}>
              <Ionicons name="analytics-outline" size={18} color={PRIMARY} />
            </View>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>{t.orders}</Text>
              <Text style={styles.summaryValue}>{filteredOrders.length}</Text>
            </View>

            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>{t.revenue}</Text>
              <Text style={[styles.summaryValue, styles.summaryValuePrimary]}>
                {formatMoney(revenue)}
              </Text>
            </View>

            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>{t.orders} Ø</Text>
              <Text style={styles.summaryValue}>{formatMoney(avgOrder)}</Text>
            </View>

            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>{t.discount}</Text>
              <Text style={[styles.summaryValue, discountTotal > 0 && styles.summaryValueDanger]}>
                {formatMoney(discountTotal)}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderOrderCard = (item: ListItem) => {
    if ('placeholder' in item) {
      return <View style={[styles.orderCard, styles.orderCardPlaceholder]} />;
    }

    const paymentType = getPaymentType(item.payment_method);
    const itemCount = totalItemCount(item);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => setSelectedOrder(item)}
        activeOpacity={0.84}
      >
        <View style={styles.orderCardTop}>
          <View style={styles.orderNumberBadge}>
            <Ionicons name="receipt-outline" size={13} color={PRIMARY} />
            <Text style={styles.orderNumberText}>{item.order_number}</Text>
          </View>

          <Text style={styles.orderTotal}>
            {formatMoney(parseAmount(item.total))}
          </Text>
        </View>

        <View style={styles.orderInfoRow}>
          <View style={styles.orderMetaWrap}>
            <Ionicons name="time-outline" size={13} color={MUTED} />
            <Text style={styles.orderMeta} numberOfLines={1}>
              {formatTime(item.created_at)} · {formatDate(item.created_at)}
            </Text>
          </View>

          <View
            style={[
              styles.payBadge,
              paymentType === 'cash'
                ? styles.payBadgeCash
                : paymentType === 'twint'
                  ? styles.payBadgeTwint
                  : styles.payBadgeCard,
            ]}
          >
            <Ionicons
              name={getPaymentIcon(item.payment_method)}
              size={11}
              color={
                paymentType === 'cash'
                  ? GREEN
                  : paymentType === 'twint'
                    ? ORANGE
                    : BLUE
              }
            />
            <Text
              style={[
                styles.payBadgeText,
                paymentType === 'cash'
                  ? styles.payBadgeTextCash
                  : paymentType === 'twint'
                    ? styles.payBadgeTextTwint
                    : styles.payBadgeTextCard,
              ]}
            >
              {getPaymentLabel(item.payment_method)}
            </Text>
          </View>
        </View>

        <View style={styles.orderBottomRow}>
          <Text style={styles.orderPreview} numberOfLines={1}>
            {item.items.map(i => i.name).join(', ')}
          </Text>

          <View style={styles.itemCountPill}>
            <Text style={styles.orderItemCount}>
              {itemCount} {itemCount === 1 ? t.item : t.items}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>{t.orders}...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerOuter}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>{historyTitle}</Text>
        </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => restaurantCode && fetchOrders(restaurantCode, true)}
              disabled={refreshing}
              activeOpacity={0.78}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={PRIMARY} />
              ) : (
                <Ionicons name="sync-outline" size={17} color={PRIMARY} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.zReportBtn, dayClosed && styles.zReportBtnClosed]}
              onPress={() => !dayClosed && setZReportModal(true)}
              activeOpacity={dayClosed ? 1 : 0.78}
            >
              <Ionicons
                name="lock-closed-outline"
                size={14}
                color={dayClosed ? '#8E929D' : '#fff'}
              />
              <Text style={[styles.zReportBtnText, dayClosed && styles.zReportBtnTextClosed]}>
                {dayClosed ? t.dayClosed : t.zReport}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {dayClosed && (
        <View style={styles.dayClosedBannerOuter}>
          <View style={styles.dayClosedBanner}>
            <Ionicons name="lock-closed" size={15} color="#6B4BB8" />
            <Text style={styles.dayClosedText}>
              {t.dayClosed} — {t.reopensAutomatically}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.bodyOuter}>
        <View style={[styles.bodyShell, showAnalyticsPanel && styles.bodyShellSplit]}>
          <View style={[styles.leftPane, showAnalyticsPanel && { width: listWidth }]}>
            <FlatList
              data={paddedOrders}
              keyExtractor={(item, index) =>
                'placeholder' in item ? item.id : item.id || `${item.order_number}-${index}`
              }
              numColumns={numColumns}
              key={numColumns}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => restaurantCode && fetchOrders(restaurantCode, true)}
                  colors={[PRIMARY]}
                />
              }
              contentContainerStyle={[
                styles.listContent,
                paddedOrders.length === 0 && styles.listContentEmpty,
              ]}
              columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
              showsVerticalScrollIndicator={false}
              ListHeaderComponent={renderListHeader}
              ListEmptyComponent={
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="receipt-outline" size={42} color="#AEB6C4" />
                  </View>
                  <Text style={styles.emptyTitle}>{t.noOrders}</Text>
                </View>
              }
              ListFooterComponent={!showAnalyticsPanel ? renderAnalyticsFooter : null}
              renderItem={({ item }) => renderOrderCard(item)}
            />
          </View>

          {showAnalyticsPanel && (
            <ScrollView
              style={[styles.rightPane, { width: analyticsPanelWidth }]}
              contentContainerStyle={styles.rightPaneContent}
              showsVerticalScrollIndicator={false}
            >
              {renderAnalyticsFooter()}
            </ScrollView>
          )}
        </View>
      </View>

      <Modal
        visible={!!selectedOrder}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedOrder(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSelectedOrder(null)}
        >
          <TouchableOpacity
            style={styles.modalBox}
            activeOpacity={1}
            onPress={e => e.stopPropagation()}
          >
            {selectedOrder && (
              <>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalKicker}>Bestellung</Text>
                    <Text style={styles.modalOrderNumber}>
                      {selectedOrder.order_number}
                    </Text>

                    <Text style={styles.modalMeta}>
                      {formatTime(selectedOrder.created_at)} ·{' '}
                      {formatDate(selectedOrder.created_at)} ·{' '}
                      {getPaymentLabel(selectedOrder.payment_method)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSelectedOrder(null)}
                    style={styles.modalCloseBtn}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="close" size={18} color="#5B5F6B" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  {selectedOrder.items.map((item, index) => (
                    <View key={index} style={styles.itemRow}>
                      <View style={styles.itemQtyBadge}>
                        <Text style={styles.itemQtyText}>{item.quantity}</Text>
                      </View>

                      <View style={styles.itemInfo}>
                        <Text style={styles.itemName}>{item.name}</Text>

                        {item.variation ? (
                          <Text style={styles.itemSub}>↳ {item.variation}</Text>
                        ) : null}

                        {item.addons?.map((addon: any, addonIndex: number) => (
                          <Text key={addonIndex} style={styles.itemSub}>
                            + {addon.label || addon.name}
                          </Text>
                        ))}
                      </View>

                      <Text style={styles.itemTotal}>
                        {formatMoney(parseAmount(item.total))}
                      </Text>
                    </View>
                  ))}

                  {selectedOrder.note ? (
                    <View style={styles.noteBox}>
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={14}
                        color="#F59E0B"
                      />
                      <Text style={styles.noteText}>{selectedOrder.note}</Text>
                    </View>
                  ) : null}

                  <View style={styles.divider} />

                  {parseAmount(selectedOrder.discount) > 0 && (
                    <>
                      <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>{t.subtotal}</Text>
                        <Text style={styles.totalValue}>
                          {formatMoney(
                            parseAmount(
                              selectedOrder.subtotal || selectedOrder.total
                            )
                          )}
                        </Text>
                      </View>

                      <View style={styles.totalRow}>
                        <Text style={[styles.totalLabel, styles.discountText]}>
                          {t.discount}
                        </Text>
                        <Text style={[styles.totalValue, styles.discountText]}>
                          - {formatMoney(parseAmount(selectedOrder.discount))}
                        </Text>
                      </View>
                    </>
                  )}

                  <View style={styles.finalTotalBox}>
                    <Text style={styles.finalTotalLabel}>{t.total}</Text>
                    <Text style={styles.finalTotalValue}>
                      {formatMoney(parseAmount(selectedOrder.total))}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.reprintBtn}
                    onPress={() => selectedOrder && printOrder(selectedOrder, restaurantCode)}
                    activeOpacity={0.78}
                  >
                    <Ionicons name="print-outline" size={16} color={PRIMARY} />
                    <Text style={styles.reprintBtnText}>{t.reprint}</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={zReportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setZReportModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setZReportModal(false)}
        >
          <TouchableOpacity
            style={[styles.modalBox, styles.zModalBox]}
            activeOpacity={1}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalKicker}>Z-Report</Text>
                <Text style={styles.modalOrderNumber}>{t.dayClose}</Text>
              </View>

              <TouchableOpacity
                onPress={() => setZReportModal(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.75}
              >
                <Ionicons name="close" size={18} color="#5B5F6B" />
              </TouchableOpacity>
            </View>

            <View style={styles.zModalContent}>
              <View style={styles.zIconCircle}>
                <Ionicons name="lock-closed-outline" size={28} color={PRIMARY} />
              </View>

              <Text style={styles.zModalTitle}>
                {t.dayClose} — {t.zReport}?
              </Text>

              <Text style={styles.zModalSummary}>
                {t.today}: {todayOrders.length} {t.orders} ·{' '}
                {formatMoney(
                  todayOrders.reduce((sum, order) => sum + parseAmount(order.total), 0)
                )}
              </Text>

              <Text style={styles.zModalNote}>
                {t.dayCloseNote}
              </Text>

              <View style={styles.zModalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setZReportModal(false)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.cancelBtnText}>{t.cancel}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.closeDayBtn}
                  onPress={confirmDayClose}
                  activeOpacity={0.8}
                >
                  <Text style={styles.closeDayBtnText}>{t.dayClose}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_BG,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: APP_BG,
  },

  loadingCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    paddingHorizontal: 28,
    paddingVertical: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },

  loadingText: {
    marginTop: 12,
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: appFont,
  },

  headerOuter: {
  height: 75,
  backgroundColor: CARD_BG,
  paddingHorizontal: PAGE_PADDING,
  borderBottomWidth: 1,
  borderBottomColor: BORDER,
  justifyContent: 'center',
},

  header: {
  width: '100%',
  maxWidth: MAX_CONTENT_WIDTH,
  alignSelf: 'center',
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
    fontSize: 10,
    fontWeight: '800',
    color: PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: appFont,
  },

  headerTitle: {
  fontSize: 22,
  fontWeight: '700',
  color: TEXT,
  fontFamily: appFont,
},

  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    color: MUTED,
    fontFamily: appFont,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },

  refreshBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },

  zReportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },

  zReportBtnClosed: {
    backgroundColor: '#ECEEF3',
    borderWidth: 1,
    borderColor: BORDER,
  },

  zReportBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    fontFamily: appFont,
  },

  zReportBtnTextClosed: {
    color: '#8E929D',
  },

  dayClosedBannerOuter: {
    backgroundColor: APP_BG,
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 8,
  },

  dayClosedBanner: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    backgroundColor: '#F4EEFF',
    borderWidth: 1,
    borderColor: PRIMARY_BORDER,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  dayClosedText: {
    color: '#5B3AA8',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: appFont,
  },

  bodyOuter: {
    flex: 1,
    paddingHorizontal: PAGE_PADDING,
  },

  bodyShell: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
  },

  bodyShellSplit: {
    flexDirection: 'row',
    gap: PAGE_PADDING,
  },

  leftPane: {
  minWidth: 0,
},

  rightPane: {},

  rightPaneContent: {
  paddingTop: 16,
  paddingBottom: 110,
},

  listContent: {
  paddingTop: 16,
  paddingBottom: 110,
},

  listContentEmpty: {
    flexGrow: 1,
  },

  listHeader: {
    marginBottom: 12,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },

  statCard: {
    flexGrow: 1,
    flexBasis: 180,
    minHeight: 64,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  statCardActive: {
    borderColor: PRIMARY_BORDER,
    backgroundColor: PRIMARY_SOFT,
  },

  statIconBox: {
    width: 34,
    height: 34,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statTextBox: {
    flex: 1,
    minWidth: 0,
  },

  statValue: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
    lineHeight: 18,
    fontFamily: appFont,
  },

  statLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: '700',
    lineHeight: 14,
    fontFamily: appFont,
  },

  filtersCard: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 6,

  },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingRight: 4,
  },

  filterTab: {
    minHeight: 34,
    minWidth: 76,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#EEF1F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterTabActive: {
    backgroundColor: PRIMARY,
  },

  filterTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555B66',
    fontFamily: appFont,
  },

  filterTabTextActive: {
    color: '#fff',
  },

  columnWrapper: {
  gap: 12,
  alignItems: 'stretch',
},

  emptyCard: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 10,
  },

  emptyIconCircle: {
    width: 76,
    height: 76,
    borderRadius: 28,
    backgroundColor: '#EEF0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: MUTED,
    fontFamily: appFont,
  },

  orderCard: {
    flex: 1,
    minHeight: 112,
    backgroundColor: CARD_BG,
    borderRadius: 18,
    padding: 13,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,

  },

  orderCardPlaceholder: {
    opacity: 0,
  },

  orderCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },

  orderNumberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: PRIMARY_BORDER,
  },

  orderNumberText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRIMARY,
    fontFamily: appFont,
  },

  orderTotal: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT,
    fontFamily: appFont,
  },

  orderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
    gap: 8,
  },

  orderMetaWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },

  orderMeta: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '600',
    fontFamily: appFont,
  },

  payBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  payBadgeCash: {
    backgroundColor: '#EAFBF1',
  },

  payBadgeCard: {
    backgroundColor: '#EEF4FF',
  },

  payBadgeTwint: {
    backgroundColor: '#FFF1E8',
  },

  payBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: appFont,
  },

  payBadgeTextCash: {
    color: GREEN,
  },

  payBadgeTextCard: {
    color: BLUE,
  },

  payBadgeTextTwint: {
    color: ORANGE,
  },

  orderBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  orderPreview: {
    flex: 1,
    fontSize: 12,
    color: SOFT_TEXT,
    fontWeight: '600',
    fontFamily: appFont,
  },

  itemCountPill: {
    backgroundColor: '#EEF1F6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  orderItemCount: {
    fontSize: 11,
    color: '#555B66',
    fontWeight: '800',
    fontFamily: appFont,
  },

  analyticsFooter: {
    gap: 12,
    marginTop: 0,
  },

  analyticsCard: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,

  },

  summaryCard: {
    backgroundColor: CARD_BG,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,

  },

  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },

  sectionKicker: {
    fontSize: 10,
    fontWeight: '800',
    color: PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: appFont,
  },

  sectionTitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '800',
    color: '#8B38CB',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: appFont,
  },

  sectionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: PRIMARY_SOFT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  noProductsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 34,
    gap: 9,
  },

  noProductsIcon: {
    width: 68,
    height: 68,
    borderRadius: 25,
    backgroundColor: '#EEF0F5',
    alignItems: 'center',
    justifyContent: 'center',
  },

  noProductsText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: appFont,
  },

  topProductsGrid: {
    gap: 12,
  },

  topProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  topProductRankBox: {
    width: 28,
    height: 28,
    borderRadius: 11,
    backgroundColor: '#F2F3F7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  topProductRankBoxFirst: {
    backgroundColor: PRIMARY,
  },

  topProductRank: {
    fontSize: 12,
    fontWeight: '800',
    color: '#777D8A',
    fontFamily: appFont,
  },

  topProductRankFirst: {
    color: '#fff',
  },

  topProductMiddle: {
    flex: 1,
    minWidth: 0,
  },

  topProductName: {
    fontSize: 12,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 6,
    fontFamily: appFont,
  },

  barTrack: {
    height: 6,
    backgroundColor: '#EEF0F5',
    borderRadius: 999,
    overflow: 'hidden',
  },

  barFill: {
    height: 6,
    backgroundColor: PRIMARY,
    borderRadius: 999,
  },

  topProductRight: {
    alignItems: 'flex-end',
    minWidth: 72,
  },

  topProductCount: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
    fontFamily: appFont,
  },

  topProductRevenue: {
    fontSize: 10,
    color: MUTED,
    fontWeight: '600',
    marginTop: 2,
    fontFamily: appFont,
  },

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  summaryTile: {
    flexGrow: 1,
    flexBasis: 130,
    minHeight: 68,
    backgroundColor: '#F5F7FA',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: BORDER_SOFT,
  },

  summaryLabel: {
    fontSize: 12,
    color: MUTED,
    fontWeight: '700',
    marginBottom: 6,
    fontFamily: appFont,
  },

  summaryValue: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT,
    fontFamily: appFont,
  },

  summaryValuePrimary: {
    color: PRIMARY,
  },

  summaryValueDanger: {
    color: RED,
  },

  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginVertical: 16,
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
    borderRadius: 24,
    width: '92%',
    maxWidth: 500,
    maxHeight: '82%',
    overflow: 'hidden',
  },

  zModalBox: {
    maxWidth: 460,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 14,
  },

  modalKicker: {
    fontSize: 10,
    fontWeight: '800',
    color: PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    fontFamily: appFont,
  },

  modalOrderNumber: {
    marginTop: 3,
    fontSize: 18,
    fontWeight: '800',
    color: TEXT,
    fontFamily: appFont,
  },

  modalMeta: {
    fontSize: 12,
    color: MUTED,
    marginTop: 4,
    fontWeight: '600',
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

  modalBody: {
    padding: 18,
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    marginBottom: 12,
  },

  itemQtyBadge: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: PRIMARY_SOFT,
    borderWidth: 1,
    borderColor: PRIMARY_BORDER,
    justifyContent: 'center',
    alignItems: 'center',
  },

  itemQtyText: {
    fontSize: 12,
    fontWeight: '800',
    color: PRIMARY,
    fontFamily: appFont,
  },

  itemInfo: {
    flex: 1,
  },

  itemName: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT,
    fontFamily: appFont,
  },

  itemSub: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
    fontWeight: '600',
    fontFamily: appFont,
  },

  itemTotal: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT,
    fontFamily: appFont,
  },

  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 11,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },

  noteText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    fontWeight: '700',
    fontFamily: appFont,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  totalLabel: {
    fontSize: 13,
    color: MUTED,
    fontWeight: '700',
    fontFamily: appFont,
  },

  totalValue: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT,
    fontFamily: appFont,
  },

  discountText: {
    color: RED,
  },

  finalTotalBox: {
    backgroundColor: PRIMARY_SOFT,
    borderWidth: 1,
    borderColor: PRIMARY_BORDER,
    borderRadius: 16,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  finalTotalLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: TEXT,
    fontFamily: appFont,
  },

  finalTotalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: PRIMARY,
    fontFamily: appFont,
  },

  reprintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: PRIMARY_SOFT,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: PRIMARY_BORDER,
  },

  reprintBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: PRIMARY,
    fontFamily: appFont,
  },

  zModalContent: {
    padding: 20,
    alignItems: 'center',
  },

  zIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 26,
    backgroundColor: PRIMARY_SOFT,
    borderWidth: 1,
    borderColor: PRIMARY_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },

  zModalTitle: {
    fontSize: 17,
    color: TEXT,
    marginBottom: 7,
    fontWeight: '800',
    textAlign: 'center',
    fontFamily: appFont,
  },

  zModalSummary: {
    fontSize: 13,
    color: '#555B66',
    marginBottom: 10,
    fontWeight: '700',
    textAlign: 'center',
    fontFamily: appFont,
  },

  zModalNote: {
    fontSize: 12,
    color: MUTED,
    marginBottom: 20,
    fontWeight: '600',
    lineHeight: 18,
    textAlign: 'center',
    fontFamily: appFont,
  },

  zModalActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },

  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 15,
    backgroundColor: '#ECEEF3',
    alignItems: 'center',
  },

  cancelBtnText: {
    fontWeight: '800',
    color: '#555B66',
    fontFamily: appFont,
  },

  closeDayBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 15,
    backgroundColor: PRIMARY,
    alignItems: 'center',
  },

  closeDayBtnText: {
    fontWeight: '800',
    color: '#fff',
    fontFamily: appFont,
  },
});