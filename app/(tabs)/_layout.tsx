import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet } from 'react-native';
import { useLanguage } from '../../lib/LanguageContext';
import { appFont } from '../../lib/fonts';

const PRIMARY = '#8B38CB';
const MUTED = '#7B7F8C';
const BORDER = '#D8DCE5';

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
              size={24}
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
              size={23}
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
              size={23}
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
    height: Platform.OS === 'ios' ? 78 : 80,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    paddingTop: Platform.OS === 'ios' ? 6 : 6,
    paddingBottom: Platform.OS === 'ios' ? 14 : 14,
    paddingHorizontal: 8,

    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },

  tabBarItem: {
    height: Platform.OS === 'ios' ? 56 : 52,
    paddingTop: 0,
    paddingBottom: 0,
    justifyContent: 'center',
  },

  tabBarLabel: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: appFont,
    textAlign: 'center',
    marginTop: 1,
    paddingBottom: 0,
  },
});