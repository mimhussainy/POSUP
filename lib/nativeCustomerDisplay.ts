// lib/nativeCustomerDisplay.ts
//
// Thin wrapper around the native CustomerDisplayModule (Android/Sunmi
// D3 only). No-ops safely on web/iOS or if the native module isn't
// present in the current build (e.g. before a fresh EAS build/prebuild
// has run with the config plugin applied).

import { NativeModules, Platform } from 'react-native';

const { CustomerDisplayModule } = NativeModules;

export async function showCustomerDisplay(): Promise<boolean> {
  if (Platform.OS !== 'android' || !CustomerDisplayModule) return false;

  try {
    return await CustomerDisplayModule.show();
  } catch (e) {
    console.log('showCustomerDisplay failed', e);
    return false;
  }
}

export async function hideCustomerDisplay(): Promise<void> {
  if (Platform.OS !== 'android' || !CustomerDisplayModule) return;

  try {
    await CustomerDisplayModule.hide();
  } catch (e) {
    console.log('hideCustomerDisplay failed', e);
  }
}

export async function isCustomerDisplayAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android' || !CustomerDisplayModule) return false;

  try {
    return await CustomerDisplayModule.isAvailable();
  } catch (e) {
    return false;
  }
}