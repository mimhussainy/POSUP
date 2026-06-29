const BACKEND = 'https://foodup-order-alerts-backend.onrender.com';

export async function fetchRestaurantData(code: string) {
  const res = await fetch(`${BACKEND}/posup/products/${code}`);
  if (!res.ok) throw new Error('Failed to fetch products');
  return res.json();
}

export async function fetchProfile(code: string) {
  const res = await fetch(`${BACKEND}/posup/profile/${code}`);
  if (!res.ok) throw new Error('Failed to fetch profile');
  return res.json();
}

export async function fetchAndSaveProfile(code: string) {
  const res = await fetch(`${BACKEND}/posup/profile/${code}`);
  if (!res.ok) throw new Error('Failed to fetch profile');
  const data = await res.json();
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  if (data.logo_url) await AsyncStorage.setItem('restaurant_logo', data.logo_url);
  if (data.name) await AsyncStorage.setItem('restaurant_name', data.name);
  if (data.printer_ip) await AsyncStorage.setItem('printer_ip', data.printer_ip);
  if (data.printer_port) await AsyncStorage.setItem('printer_port', data.printer_port);
  if (data.printer_model) await AsyncStorage.setItem('printer_model', data.printer_model);
  return data;
}