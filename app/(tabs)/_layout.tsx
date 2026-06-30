import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { useLanguage } from '../../lib/LanguageContext';
import { appFont } from '../../lib/fonts';

const PRIMARY = '#8B38CB';
const MUTED = '#7B7F8C';
const BORDER = '#ECEEF3';

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
            <Ionicons
              name={focused ? 'add-circle' : 'add-circle-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: t.orders,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'receipt' : 'receipt-outline'}
              size={25}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: t.settings,
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'settings' : 'settings-outline'}
              size={25}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: Platform.OS === 'ios' ? 82 : 74,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 16 : 8,
    paddingHorizontal: 10,

    shadowColor: '#111827',
    shadowOpacity: 0.045,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 6,
  },

  tabBarItem: {
    height: 60,
    paddingTop: 0,
    paddingBottom: 4,
    justifyContent: 'center',
  },

  tabBarLabel: {
    fontSize: 13,
    fontWeight: '800',
    fontFamily: appFont,
    textAlign: 'center',
    marginTop: 2,
    paddingBottom: 2,
  },
});