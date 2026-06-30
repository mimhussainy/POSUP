import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useLanguage } from '../../lib/LanguageContext';
import { appFont } from '../../lib/fonts';

export default function TabsLayout() {
  const { t } = useLanguage();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
          height: 90,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: '#8B38CB',
        tabBarInactiveTintColor: '#555',
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '700',
          fontFamily: appFont,
          textAlign: 'center',
        },
      }}
    >
      <Tabs.Screen
        name="orders"
        options={{
          title: t.newOrder,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t.orders,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t.settings,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}