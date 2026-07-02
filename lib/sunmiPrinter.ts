// lib/sunmiPrinter.ts
//
// Native-only (Android) Sunmi built-in printer support. Paired with
// lib/sunmiPrinter.web.ts (Metro auto-picks the .web.ts for web builds,
// so the native import below never reaches the web bundle).
//
// Layout mirrors buildReceiptHTML() in printer.ts: logo/name header,
// one divider, one bold row per item (qty+name left, price right),
// addons indented, thin divider after each item, totals, footer.
// Everything except the logo prints as native thermal TEXT commands
// (printText/setAlignment/setTextStyle/setFontSize) -- no full-receipt
// bitmap rendering.

import * as SunmiPrinterLibrary from '@mitsuharu/react-native-sunmi-printer-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';

const RECEIPT_WIDTH = 42;

interface ReceiptTranslation {
  total: string;
  payment: string;
  cash: string;
  card: string;
  note: string;
  thank: string;
  subtotal: string;
  discount: string;
  table: string;
}

function safeText(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function parseAmount(value: any): number {
  const n = parseFloat(String(value ?? '0'));
  return Number.isFinite(n) ? n : 0;
}

function formatCHF(value: any): string {
  return `CHF ${parseAmount(value).toFixed(2)}`;
}

function fitText(text: string, width: number): string {
  const clean = safeText(text);
  if (clean.length <= width) return clean;
  return clean.slice(0, Math.max(0, width - 1)) + '…';
}

function amountRow(label: string, amount: string): string {
  const cleanAmount = safeText(amount);
  const leftWidth = Math.max(1, RECEIPT_WIDTH - cleanAmount.length);
  return fitText(label, leftWidth).padEnd(leftWidth) + cleanAmount;
}

function itemRow(qty: any, name: string, price: string): string {
  const cleanPrice = safeText(price);
  const leftWidth = Math.max(1, RECEIPT_WIDTH - cleanPrice.length);
  const label = `${safeText(qty) || '1'}x ${safeText(name)}`;
  return fitText(label, leftWidth).padEnd(leftWidth) + cleanPrice;
}

// ---------------------------------------------------------------------
// Style-tracking printer -- only re-issues alignment/bold/fontSize
// native calls when the style actually changes from the previous line,
// cutting most of the redundant round-trips without touching call
// ordering (every call is still awaited, in sequence).
// ---------------------------------------------------------------------

class ThermalPrinter {
  private currentAlign: 'left' | 'center' | null = null;
  private currentBold: boolean | null = null;
  private currentFontSize: number | null = null;

  async line(text: string, opts: { align?: 'left' | 'center'; bold?: boolean; fontSize?: number } = {}) {
    const align = opts.align ?? 'left';
    const bold = opts.bold ?? false;
    const fontSize = opts.fontSize ?? 20;

    if (align !== this.currentAlign) {
      await SunmiPrinterLibrary.setAlignment(align);
      this.currentAlign = align;
    }

    if (bold !== this.currentBold) {
      await SunmiPrinterLibrary.setTextStyle('bold', bold);
      this.currentBold = bold;
    }

    if (fontSize !== this.currentFontSize) {
      await SunmiPrinterLibrary.setFontSize(fontSize);
      this.currentFontSize = fontSize;
    }

    await SunmiPrinterLibrary.printText(text + '\n');
  }

  async divider() {
    await this.line('-'.repeat(RECEIPT_WIDTH), { align: 'left', bold: false, fontSize: 18 });
  }
}

async function printLogoImage(logoUrl: string): Promise<boolean> {
  try {
    const fileUri = FileSystem.cacheDirectory + 'receipt-logo.png';
    await FileSystem.downloadAsync(logoUrl, fileUri);

    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await SunmiPrinterLibrary.printImage(`data:image/png;base64,${base64}`, 384, 'binary');
    return true;
  } catch (e) {
    console.log('Sunmi logo print failed, falling back to text:', e);
    return false;
  }
}

export async function printReceiptViaSunmi(
  order: any,
  restaurantName: string,
  tr: ReceiptTranslation,
  logoUrl?: string
): Promise<void> {
  await SunmiPrinterLibrary.prepare();

  const p = new ThermalPrinter();

  const createdAt = order.created_at ? new Date(order.created_at) : new Date();
  const isValidDate = !Number.isNaN(createdAt.getTime());
  const date = isValidDate ? createdAt : new Date();
  const dateStr = date.toLocaleDateString('de-CH');
  const timeStr = date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });

  let logoPrinted = false;
  if (logoUrl) {
    logoPrinted = await printLogoImage(logoUrl);
  }

  if (!logoPrinted) {
    await p.line(restaurantName.toUpperCase(), { align: 'center', bold: true, fontSize: 30 });
  }

  await p.line(safeText(order.order_number || order.order_id || ''), { align: 'center', bold: true, fontSize: 24 });
  await p.line(`${dateStr} ${timeStr}`, { align: 'center', bold: false, fontSize: 20 });

  if (order.table && order.table !== 'Walk-in' && order.table !== 'Not specified') {
    await p.line(`${tr.table}: ${order.table}`, { align: 'center', bold: false, fontSize: 20 });
  }

  await p.divider();

  for (const item of order.items || []) {
    const variation = safeText(item.variation);
    const itemName = variation ? `${safeText(item.name)} (${variation})` : safeText(item.name);

    await p.line(itemRow(item.quantity, itemName, formatCHF(item.total)), { bold: true, fontSize: 22 });

    const addonLines = (item.addons || [])
      .map((a: any) => `   + ${safeText(a.label || a.name)}`)
      .join('\n');

    if (addonLines) {
      await p.line(addonLines, { bold: false, fontSize: 18 });
    }

    await p.divider();
  }

  if (order.discount && parseAmount(order.discount) > 0) {
    await p.line(amountRow(tr.subtotal, formatCHF(order.subtotal)), { bold: false, fontSize: 20 });
    await p.line(amountRow(tr.discount, `- ${formatCHF(order.discount)}`), { bold: true, fontSize: 20 });
  }

  await p.line(amountRow(tr.total, formatCHF(order.total)), { bold: true, fontSize: 28 });

  const paymentValue = order.payment_method === 'cash' ? tr.cash : tr.card;
  await p.line(amountRow(tr.payment, paymentValue), { bold: true, fontSize: 22 });

  if (order.note) {
    await p.line(`${tr.note}: ${safeText(order.note)}`, { bold: false, fontSize: 18 });
  }

  await p.divider();
  await p.line(tr.thank, { align: 'center', bold: false, fontSize: 20 });
  await p.divider();
  await p.line('Powered by: FoodUp.ch', { align: 'center', bold: false, fontSize: 16 });

  await SunmiPrinterLibrary.lineWrap(5);
}

// ---------------------------------------------------------------------
// Diagnostic test print -- no logo, no image, plain bold text only.
// Use this to isolate whether faintness/slowness is a printer
// hardware/density/paper issue vs. something in the receipt code.
// ---------------------------------------------------------------------

export async function printSunmiDiagnosticTest(): Promise<void> {
  await SunmiPrinterLibrary.prepare();

  const p = new ThermalPrinter();

  await p.divider();
  await p.line('TEST BLACK TEXT', { align: 'center', bold: true, fontSize: 32 });
  await p.divider();
  await p.line('If this is faint or slow,', { align: 'center', bold: false, fontSize: 20 });
  await p.line('it is a hardware/density issue,', { align: 'center', bold: false, fontSize: 20 });
  await p.line('not the app.', { align: 'center', bold: false, fontSize: 20 });
  await p.divider();

  await SunmiPrinterLibrary.lineWrap(5);
}