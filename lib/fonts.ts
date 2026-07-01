import { Platform } from 'react-native';

export const appFont = Platform.OS === 'web'
  ? 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  : undefined;