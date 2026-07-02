// lib/sunmiPrinter.web.ts
//
// Web build stub. Metro's platform-extension resolution automatically
// uses THIS file instead of sunmiPrinter.ts when bundling for web, so
// the native '@mitsuharu/react-native-sunmi-printer-library' import
// never gets pulled into the web bundle at all.

export async function printReceiptViaSunmi(
  _order: any,
  _restaurantName: string,
  _tr: any,
  _logoUrl?: string
): Promise<void> {
  throw new Error('Sunmi built-in printer is not available on web');
}

export async function printSunmiDiagnosticTest(): Promise<void> {
  throw new Error('Sunmi built-in printer is not available on web');
}