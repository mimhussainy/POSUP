// lib/sunmiPrinter.web.ts
//
// Web stub. This keeps Vercel/web builds safe.
// The real Sunmi printer code only exists in lib/sunmiPrinter.ts.

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