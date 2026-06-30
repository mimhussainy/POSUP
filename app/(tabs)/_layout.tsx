import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useLanguage } from '../../lib/LanguageContext';
import { appFont } from '../../lib/fonts';

const PRIMARY = '#8B38CB';
const PRIMARY_SOFT = '#F5ECFF';
const TEXT = '#17172A';
const MUTED = '#7B7F8C';
const BORDER = '#E7E8EE';

export default function TabsLayout() {
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarActiveTintColor: PRIMARY,
        tabBarInactiveTintColor: MUTED,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="orders"
        options={{
          title: t.newOrder,
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons
                name={focused ? 'add-circle' : 'add-circle-outline'}
                size={22}
                color={color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: t.orders,
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons
                name={focused ? 'receipt' : 'receipt-outline'}
                size={21}
                color={color}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: t.settings,
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
              <Ionicons
                name={focused ? 'settings' : 'settings-outline'}
                size={21}
                color={color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 78,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 14 : 10,
    paddingHorizontal: 18,

    shadowColor: '#111827',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },

  tabBarItem: {
    height: 58,
    borderRadius: 18,
    paddingVertical: 4,
  },

  tabBarLabel: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: appFont,
    textAlign: 'center',
    marginTop: 2,
  },

  iconWrap: {
    width: 38,
    height: 30,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconWrapActive: {
    backgroundColor: PRIMARY_SOFT,
    borderWidth: 1,
    borderColor: '#E8D6FF',
  },
});