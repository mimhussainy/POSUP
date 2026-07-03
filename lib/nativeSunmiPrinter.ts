import { NativeModules, Platform } from 'react-native';

const { SunmiPrinterModule } = NativeModules;

export async function printSunmiReceiptNative(order: any, restaurant: any): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (!SunmiPrinterModule) {
    throw new Error('SunmiPrinterModule is not registered in NativeModules. Check SunmiPrinterPackage registration in MainApplication and the config plugin.');
  }

  return SunmiPrinterModule.printSunmiReceipt(JSON.stringify(order), JSON.stringify(restaurant));
}