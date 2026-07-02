// app/display.tsx
//
// TEMPORARY test route — open this in a browser tab (npx expo start --web)
// to preview the customer display before the Sunmi device arrives.
// Once the native dual-screen module is wired in, this route can stay
// as a dev/debug preview or be removed.

import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomerDisplay from '../components/CustomerDisplay';
import { publishDisplayState } from '../lib/customerDisplayStore';

export default function DisplayScreen() {
  useEffect(() => {
    (async () => {
      const restaurantName = await AsyncStorage.getItem('restaurant_name') || '';
      const logoUrl = await AsyncStorage.getItem('restaurant_logo') || '';
      publishDisplayState({ restaurantName, logoUrl });
    })();
  }, []);

  return <CustomerDisplay />;
}
