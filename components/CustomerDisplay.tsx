// components/CustomerDisplay.tsx
//
// Renders on the customer-facing second screen. Shows an idle/promo
// screen (logo, welcome message, live clock) when the cart is empty,
// and switches to a live order summary as items are added.

import { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors, radii, fontSizes, fontWeights } from '../lib/theme';
import { appFont } from '../lib/fonts';
import { subscribeDisplayState, DisplayState } from '../lib/customerDisplayStore';

function formatTime(date: Date) {
  return date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(date: Date) {
  return date.toLocaleDateString('de-CH', { weekday: 'long', day: '2-digit', month: 'long' });
}

export default function CustomerDisplay() {
  const [state, setState] = useState<DisplayState>({
    restaurantName: '',
    logoUrl: '',
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
  });

  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const unsubscribe = subscribeDisplayState(setState);
    return unsubscribe;
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const hasOrder = state.items.length > 0;

  if (!hasOrder) {
    return (
      <View style={styles.idleRoot}>
        <View style={styles.idleCenter}>
          {state.logoUrl ? (
            <Image source={{ uri: state.logoUrl }} style={styles.idleLogo} resizeMode="contain" />
          ) : (
            <Text style={styles.idleRestaurantName}>{state.restaurantName}</Text>
          )}

          <Text style={styles.idleWelcome}>Willkommen!</Text>
        </View>

        <View style={styles.idleClockBox}>
          <Text style={styles.idleClock}>{formatTime(now)}</Text>
          <Text style={styles.idleDate}>{formatDate(now)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.orderRoot}>
      <View style={styles.orderHeader}>
        {state.logoUrl ? (
          <Image source={{ uri: state.logoUrl }} style={styles.orderLogo} resizeMode="contain" />
        ) : (
          <Text style={styles.orderRestaurantName}>{state.restaurantName}</Text>
        )}
        <Text style={styles.orderClock}>{formatTime(now)}</Text>
      </View>

      <View style={styles.itemsList}>
        {state.items.map(item => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemQtyBadge}>
              <Text style={styles.itemQtyText}>{item.quantity}</Text>
            </View>

            <View style={styles.itemInfo}>
              <Text style={styles.itemName} numberOfLines={1}>
                {item.name}{item.variationName ? ` — ${item.variationName}` : ''}
              </Text>

              {item.addons?.map((a, i) => (
                <Text key={i} style={styles.itemAddon} numberOfLines={1}>
                  + {a.name}
                </Text>
              ))}
            </View>

            <Text style={styles.itemPrice}>
              CHF {(item.price * item.quantity).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.totalsBox}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Zwischensumme</Text>
          <Text style={styles.totalValue}>CHF {state.subtotal.toFixed(2)}</Text>
        </View>

        {state.discount > 0 && (
          <View style={styles.totalRow}>
            <Text style={[styles.totalLabel, styles.discountText]}>Rabatt</Text>
            <Text style={[styles.totalValue, styles.discountText]}>
              - CHF {state.discount.toFixed(2)}
            </Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.totalRow}>
          <Text style={styles.grandLabel}>Total</Text>
          <Text style={styles.grandValue}>CHF {state.total.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  idleRoot: {
    flex: 1,
    backgroundColor: colors.dark,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
  },

  idleCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },

  idleLogo: {
    width: 260,
    height: 100,
  },

  idleRestaurantName: {
    fontSize: fontSizes.giant,
    fontWeight: fontWeights.black,
    color: '#fff',
    fontFamily: appFont,
  },

  idleWelcome: {
    fontSize: fontSizes.xxxl,
    fontWeight: fontWeights.medium,
    color: colors.primary,
    fontFamily: appFont,
  },

  idleClockBox: {
    alignItems: 'center',
    gap: 6,
  },

  idleClock: {
    fontSize: 64,
    fontWeight: fontWeights.black,
    color: '#fff',
    fontFamily: appFont,
  },

  idleDate: {
    fontSize: fontSizes.lgl,
    fontWeight: fontWeights.medium,
    color: '#B5B5C8',
    fontFamily: appFont,
    textTransform: 'capitalize',
  },

  orderRoot: {
    flex: 1,
    backgroundColor: colors.dark,
    padding: 32,
  },

  orderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },

  orderLogo: {
    width: 140,
    height: 50,
  },

  orderRestaurantName: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.black,
    color: '#fff',
    fontFamily: appFont,
  },

  orderClock: {
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    color: '#B5B5C8',
    fontFamily: appFont,
  },

  itemsList: {
    flex: 1,
    gap: 14,
  },

  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    backgroundColor: colors.darkCard,
    borderRadius: radii.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },

  itemQtyBadge: {
    width: 40,
    height: 40,
    borderRadius: radii.smd,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  itemQtyText: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.black,
    color: '#fff',
    fontFamily: appFont,
  },

  itemInfo: {
    flex: 1,
  },

  itemName: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.bold,
    color: '#fff',
    fontFamily: appFont,
  },

  itemAddon: {
    fontSize: fontSizes.md,
    color: '#9999AD',
    marginTop: 2,
    fontFamily: appFont,
  },

  itemPrice: {
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.black,
    color: '#fff',
    fontFamily: appFont,
  },

  totalsBox: {
    backgroundColor: colors.darkCard,
    borderRadius: radii.lg,
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.darkBorder,
  },

  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },

  totalLabel: {
    fontSize: fontSizes.lgl,
    color: '#B9B9CB',
    fontWeight: fontWeights.medium,
    fontFamily: appFont,
  },

  totalValue: {
    fontSize: fontSizes.lgl,
    color: '#D6D6E2',
    fontWeight: fontWeights.bold,
    fontFamily: appFont,
  },

  discountText: {
    color: colors.successLight,
  },

  divider: {
    height: 1,
    backgroundColor: colors.darkBorder,
    marginVertical: 10,
  },

  grandLabel: {
    fontSize: fontSizes.giant,
    fontWeight: fontWeights.black,
    color: '#fff',
    fontFamily: appFont,
  },

  grandValue: {
    fontSize: fontSizes.giant,
    fontWeight: fontWeights.black,
    color: colors.primary,
    fontFamily: appFont,
  },
});
