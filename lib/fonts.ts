import { Platform } from 'react-native';

export const appFont = Platform.OS === 'web'
  ? 'Segoe UI, Arial, sans-serif'
  : undefined;