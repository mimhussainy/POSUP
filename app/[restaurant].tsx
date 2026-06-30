import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RestaurantRedirect() {
  const { restaurant } = useLocalSearchParams<{ restaurant: string }>();

  useEffect(() => {
    async function redirect() {
      if (restaurant) {
        await AsyncStorage.setItem('prefill_restaurant_code', restaurant.toLowerCase());
      }
      router.replace('/');
    }
    redirect();
  }, [restaurant]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#8B38CB" />
    </View>
  );
}