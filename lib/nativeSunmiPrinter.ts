
import { NativeModules, Platform } from 'react-native';

const { SunmiPrinterModule } = NativeModules;

export async function printSunmiReceiptNative(order: any, restaurant: any): Promise<boolean> {
  if (Platform.OS !== 'android' || !SunmiPrinterModule) return false;
  return SunmiPrinterModule.printSunmiReceipt(JSON.stringify(order), JSON.stringify(restaurant));
}