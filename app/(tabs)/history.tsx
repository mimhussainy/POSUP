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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useLanguage } from '../../lib/LanguageContext';
import { appFont } from '../../lib/fonts';

const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';
const PRIMARY = '#8B38CB';
const RIGHT_PANEL_WIDTH = 270;
const PAGE_PADDING = 12;

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

const getNumColumns = (leftWidth: number) => {
  if (leftWidth >= 820) return 3;
  return 2;
};

export default function HistoryScreen() {
  const { t } = useLanguage();
  const [restaurantCode, setRestaurantCode] = useState('');
  const [orders, setOrders] = useState<POSOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [selectedOrder, setSelectedOrder] = useState<POSOrder | null>(null);
  const [dayClosed, setDayClosed] = useState(false);
  const [zReportModal, setZReportModal] = useState(false);
  const [windowWidth, setWindowWidth] = useState(Dimensions.get('window').width);

  const isCompact = windowWidth < 900;
  const showSidePanel = !isCompact;

  const leftAvailableWidth = showSidePanel
    ? windowWidth - RIGHT_PANEL_WIDTH - PAGE_PADDING * 3
    : windowWidth - PAGE_PADDING * 2;

  const numColumns = getNumColumns(leftAvailableWidth);

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
    const num = parseFloat(String(value || '0'));
    return Number.isFinite(num) ? num : 0;
  };

  const getPaymentType = (method: string) => {
    const normalized = String(method || '').toLowerCase();
    return normalized.includes('cash') ? 'cash' : 'card';
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const date = new Date(order.created_at);
      const now = new Date();

      if (filter === 'today') return isToday(order.created_at);

      if (filter === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(now.getDate() - 7);
        return date >= weekAgo;
      }

      if (filter === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setDate(now.getDate() - 30);
        return date >= monthAgo;
      }

      return true;
    });
  }, [orders, filter]);

  const paddedOrders = useMemo<ListItem[]>(() => {
    const data: ListItem[] = [...filteredOrders];
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

    await AsyncStorage.setItem('day_closed_date', today);
    setDayClosed(true);
    setZReportModal(false);
  };

  const totalItemCount = (order: POSOrder) => {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const renderTopProductsPanel = (compact = false) => {
    const maxProductCount = topProducts[0]?.[1]?.count || 1;

    return (
      <View style={[styles.sidePanel, compact && styles.sidePanelCompact]}>
        <Text style={styles.sidePanelTitle}>Top Products</Text>

        {topProducts.length === 0 ? (
          <View style={styles.noProductsBox}>
            <Ionicons name="bar-chart-outline" size={36} color="#ddd" />
            <Text style={styles.noProductsText}>{t.noOrders}</Text>
          </View>
        ) : (
          topProducts.map(([name, data], index) => {
            const width = `${Math.max(8, (data.count / maxProductCount) * 100)}%`;

            return (
              <View key={name} style={styles.topProductRow}>
                <View style={styles.topProductRankBox}>
                  <Text style={styles.topProductRank}>{index + 1}</Text>
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
                    CHF {data.revenue.toFixed(2)}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        <View style={styles.divider} />

        <Text style={styles.sidePanelTitle}>Summary</Text>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t.orders} Ø</Text>
          <Text style={styles.summaryValue}>CHF {avgOrder.toFixed(2)}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t.orders}</Text>
          <Text style={styles.summaryValue}>{filteredOrders.length}</Text>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>{t.revenue}</Text>
          <Text style={[styles.summaryValue, styles.summaryValuePrimary]}>
            CHF {revenue.toFixed(2)}
          </Text>
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
        activeOpacity={0.85}
      >
        <View style={styles.orderCardTop}>
          <View style={styles.orderNumberBadge}>
            <Text style={styles.orderNumberText}>{item.order_number}</Text>
          </View>

          <Text style={styles.orderTotal}>
            CHF {parseAmount(item.total).toFixed(2)}
          </Text>
        </View>

        <View style={styles.orderInfoRow}>
          <Text style={styles.orderMeta}>
            {formatTime(item.created_at)} · {formatDate(item.created_at)}
          </Text>

          <View
            style={[
              styles.payBadge,
              paymentType === 'cash' ? styles.payBadgeCash : styles.payBadgeCard,
            ]}
          >
            <Text style={styles.payBadgeText}>
              {paymentType === 'cash' ? t.cash : t.card}
            </Text>
          </View>
        </View>

        <View style={styles.orderBottomRow}>
          <Text style={styles.orderPreview} numberOfLines={1}>
            {item.items.map(i => i.name).join(', ')}
          </Text>

          <Text style={styles.orderItemCount}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={PRIMARY} />
        <Text style={styles.loadingText}>{t.orders}...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t.orders}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.zReportBtn, dayClosed && styles.zReportBtnClosed]}
            onPress={() => !dayClosed && setZReportModal(true)}
          >
            <Ionicons name="lock-closed-outline" size={14} color={dayClosed ? '#999' : '#fff'} />
            <Text style={[styles.zReportBtnText, dayClosed && { color: '#999' }]}>
              {dayClosed ? t.dayClosed : t.zReport}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {dayClosed && (
        <View style={styles.dayClosedBanner}>
          <Ionicons name="lock-closed" size={16} color="#fff" />
          <Text style={styles.dayClosedText}>
            {t.dayClosed} — reopens automatically tomorrow
          </Text>
        </View>
      )}

      <View style={styles.shell}>
        <View style={styles.leftPane}>
          <View style={[styles.statsRow, isCompact && styles.statsRowCompact]}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{filteredOrders.length}</Text>
              <Text style={styles.statLabel}>{t.orders}</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={[styles.statValue, styles.statValuePrimary]}>
                CHF {revenue.toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>{t.revenue}</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={[styles.statValue, styles.statValueCash]}>
                CHF {cashRev.toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>{t.cash}</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={[styles.statValue, styles.statValueCard]}>
                CHF {cardRev.toFixed(2)}
              </Text>
              <Text style={styles.statLabel}>{t.card}</Text>
            </View>
          </View>

          <View style={styles.filtersLine}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {(
                [
                  { key: 'today', label: `${t.today} (${todayOrders.length})` },
                  { key: 'week', label: '7 days' },
                  { key: 'month', label: '30 days' },
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
                onRefresh={() => fetchOrders(restaurantCode, true)}
                colors={[PRIMARY]}
              />
            }
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.columnWrapper}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <Ionicons name="receipt-outline" size={42} color="#ddd" />
                <Text style={styles.emptyTitle}>{t.noOrders}</Text>
              </View>
            }
            ListFooterComponent={!showSidePanel ? renderTopProductsPanel(true) : null}
            renderItem={({ item }) => renderOrderCard(item)}
          />
        </View>

        {showSidePanel && renderTopProductsPanel(false)}
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
                  <View>
                    <Text style={styles.modalOrderNumber}>
                      {selectedOrder.order_number}
                    </Text>

                    <Text style={styles.modalMeta}>
                      {formatTime(selectedOrder.created_at)} ·{' '}
                      {formatDate(selectedOrder.created_at)} ·{' '}
                      {getPaymentType(selectedOrder.payment_method) === 'cash'
                        ? t.cash
                        : t.card}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setSelectedOrder(null)}
                    style={styles.modalCloseBtn}
                  >
                    <Ionicons name="close" size={18} color="#666" />
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
                        CHF {parseAmount(item.total).toFixed(2)}
                      </Text>
                    </View>
                  ))}

                  {selectedOrder.note ? (
                    <View style={styles.noteBox}>
                      <Ionicons
                        name="chatbubble-ellipses-outline"
                        size={12}
                        color="#f59e0b"
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
                          CHF{' '}
                          {parseAmount(
                            selectedOrder.subtotal || selectedOrder.total
                          ).toFixed(2)}
                        </Text>
                      </View>

                      <View style={styles.totalRow}>
                        <Text style={[styles.totalLabel, styles.discountText]}>
                          {t.discount}
                        </Text>
                        <Text style={[styles.totalValue, styles.discountText]}>
                          - CHF {parseAmount(selectedOrder.discount).toFixed(2)}
                        </Text>
                      </View>
                    </>
                  )}

                  <View style={styles.totalRow}>
                    <Text style={styles.finalTotalLabel}>{t.total}</Text>
                    <Text style={styles.finalTotalValue}>
                      CHF {parseAmount(selectedOrder.total).toFixed(2)}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.reprintBtn}
                    onPress={() => {}}
                  >
                    <Ionicons name="print-outline" size={15} color={PRIMARY} />
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
              <Text style={styles.modalOrderNumber}>{t.dayClose}</Text>

              <TouchableOpacity
                onPress={() => setZReportModal(false)}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={18} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.zModalContent}>
              <Text style={styles.zModalTitle}>{t.dayClose} — {t.zReport}?</Text>

              <Text style={styles.zModalSummary}>
                {t.today}: {todayOrders.length} {t.orders} · CHF{' '}
                {todayOrders
                  .reduce((sum, order) => sum + parseAmount(order.total), 0)
                  .toFixed(2)}
              </Text>

              <Text style={styles.zModalNote}>
                After closing, no new orders can be added today.
              </Text>

              <View style={styles.zModalActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setZReportModal(false)}
                >
                  <Text style={styles.cancelBtnText}>{t.cancel}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.closeDayBtn} onPress={confirmDayClose}>
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
    backgroundColor: '#F4F4F8',
  },

  shell: {
    flex: 1,
    flexDirection: 'row',
    padding: PAGE_PADDING,
    gap: PAGE_PADDING,
  },

  leftPane: {
    flex: 1,
    minWidth: 0,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F4F4F8',
  },

  loadingText: {
    marginTop: 12,
    color: '#888',
    fontSize: 13,
    fontFamily: appFont,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    height: 58,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    fontFamily: appFont,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statsToggleBtn: {},
  statsToggleText: {},

  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },

  statsRowCompact: {
    gap: 8,
  },

  statCard: {
    flex: 1,
    height: 58,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ECECF2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },

  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginBottom: 3,
    lineHeight: 20,
    fontFamily: appFont,
  },

  statLabel: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
    lineHeight: 14,
    fontFamily: appFont,
  },

  statValuePrimary: {
    color: PRIMARY,
  },

  statValueCash: {
    color: '#16a34a',
  },

  statValueCard: {
    color: '#2563eb',
  },

  filtersLine: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },

  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },

  filterTab: {
    height: 28,
    minWidth: 68,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ECECF2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  filterTabActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },

  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    fontFamily: appFont,
  },

  filterTabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },

  zReportBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PRIMARY, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  zReportBtnClosed: { backgroundColor: '#f0f0f0' },
  zReportBtnText: { fontSize: 12, fontWeight: '600', color: '#fff', fontFamily: appFont },

  dayClosedBanner: {
    backgroundColor: '#1a1a2e',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },

  dayClosedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
    fontFamily: appFont,
  },

  listContent: {
    paddingBottom: 100,
  },

  columnWrapper: {
    gap: 10,
    marginBottom: 10,
    alignItems: 'stretch',
  },

  emptyCard: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 8,
  },

  emptyTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#bbb',
    fontFamily: appFont,
  },

  orderCard: {
    flex: 1,
    minHeight: 82,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECECF2',
  },

  orderCardPlaceholder: {
    opacity: 0,
  },

  orderCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },

  orderNumberBadge: {
    backgroundColor: '#F5EEFF',
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },

  orderNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
    fontFamily: appFont,
  },

  orderTotal: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111',
    fontFamily: appFont,
  },

  orderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
    gap: 8,
  },

  orderMeta: {
    fontSize: 11,
    color: '#888',
    fontWeight: '400',
    fontFamily: appFont,
  },

  payBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },

  payBadgeCash: {
    backgroundColor: '#E8FDF2',
  },

  payBadgeCard: {
    backgroundColor: '#EEF4FF',
  },

  payBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    fontFamily: appFont,
  },

  orderBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },

  orderPreview: {
    flex: 1,
    fontSize: 11,
    color: '#aaa',
    fontWeight: '400',
    fontFamily: appFont,
  },

  orderItemCount: {
    fontSize: 11,
    color: '#888',
    fontWeight: '500',
    fontFamily: appFont,
  },

  sidePanel: {
    width: RIGHT_PANEL_WIDTH,
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ECECF2',
    padding: 16,
  },

  sidePanelCompact: {
    width: '100%',
    marginTop: 12,
  },

  sidePanelTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 14,
    fontFamily: appFont,
  },

  noProductsBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 38,
    gap: 8,
  },

  noProductsText: {
    color: '#bbb',
    fontSize: 13,
    fontWeight: '400',
    fontFamily: appFont,
  },

  topProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    marginBottom: 13,
  },

  topProductRankBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F4F4F8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  topProductRank: {
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
    fontFamily: appFont,
  },

  topProductMiddle: {
    flex: 1,
    minWidth: 0,
  },

  topProductName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111',
    marginBottom: 5,
    fontFamily: appFont,
  },

  barTrack: {
    height: 4,
    backgroundColor: '#F0F0F4',
    borderRadius: 3,
    overflow: 'hidden',
  },

  barFill: {
    height: 4,
    backgroundColor: PRIMARY,
    borderRadius: 3,
  },

  topProductRight: {
    alignItems: 'flex-end',
    minWidth: 56,
  },

  topProductCount: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
    fontFamily: appFont,
  },

  topProductRevenue: {
    fontSize: 10,
    color: '#aaa',
    fontWeight: '400',
    marginTop: 2,
    fontFamily: appFont,
  },

  divider: {
    height: 1,
    backgroundColor: '#EFEFF4',
    marginVertical: 14,
  },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },

  summaryLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '400',
    fontFamily: appFont,
  },

  summaryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111',
    fontFamily: appFont,
  },

  summaryValuePrimary: {
    color: PRIMARY,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },

  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '92%',
    maxWidth: 460,
    maxHeight: '80%',
    overflow: 'hidden',
  },

  zModalBox: {
    padding: 0,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  modalOrderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY,
    fontFamily: appFont,
  },

  modalMeta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    fontFamily: appFont,
  },

  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalBody: {
    padding: 16,
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },

  itemQtyBadge: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F5EEFF',
    justifyContent: 'center',
    alignItems: 'center',
  },

  itemQtyText: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
    fontFamily: appFont,
  },

  itemInfo: {
    flex: 1,
  },

  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111',
    fontFamily: appFont,
  },

  itemSub: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 1,
    fontFamily: appFont,
  },

  itemTotal: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    fontFamily: appFont,
  },

  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },

  noteText: {
    fontSize: 12,
    color: '#92400E',
    flex: 1,
    fontWeight: '500',
    fontFamily: appFont,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
  },

  totalLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
    fontFamily: appFont,
  },

  totalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    fontFamily: appFont,
  },

  discountText: {
    color: '#E74C3C',
  },

  finalTotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111',
    fontFamily: appFont,
  },

  finalTotalValue: {
    fontSize: 19,
    fontWeight: '700',
    color: PRIMARY,
    fontFamily: appFont,
  },

  zModalContent: {
    padding: 20,
  },

  zModalTitle: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
    fontWeight: '600',
    fontFamily: appFont,
  },

  zModalSummary: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
    fontWeight: '400',
    fontFamily: appFont,
  },

  zModalNote: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 20,
    fontWeight: '400',
    fontFamily: appFont,
  },

  zModalActions: {
    flexDirection: 'row',
    gap: 10,
  },

  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },

  cancelBtnText: {
    fontWeight: '600',
    color: '#555',
    fontFamily: appFont,
  },

  closeDayBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    backgroundColor: PRIMARY,
    alignItems: 'center',
  },

  closeDayBtnText: {
    fontWeight: '600',
    color: '#fff',
    fontFamily: appFont,
  },

  reprintBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f5eeff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
  },

  reprintBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
    fontFamily: appFont,
  },
});