import { NativeModules, Platform } from 'react-native';

const { SunmiPrinterModule } = NativeModules;

export async function printSunmiInstructionsNative(instructions: any[]): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  if (!SunmiPrinterModule) {
    throw new Error('SunmiPrinterModule is not registered in NativeModules. Check SunmiPrinterPackage registration in MainApplication and the config plugin.');
  }

  return SunmiPrinterModule.printInstructions(JSON.stringify(instructions));
}