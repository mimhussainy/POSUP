// lib/sunmiPrinter.ts
//
// Native-only Sunmi printer implementation.
// Web uses lib/sunmiPrinter.web.ts, so this native import never enters Vercel/web.
//
// Goal: match printer.ts HTML receipt as closely as text-mode Sunmi printing allows:
// logo/name header, compact layout, no category headers, bold item rows,
// addons below, dividers after each item, strong total/payment, footer, paper feed.

import * as SunmiPrinterLibrary from '@mitsuharu/react-native-sunmi-printer-library';
import * as FileSystem from 'expo-file-system/legacy';

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
  if (width <= 1) return clean.slice(0, width);
  return clean.slice(0, width - 1) + '…';
}

function wrapText(text: string, width: number): string[] {
  const clean = safeText(text);
  if (!clean) return [''];

  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if ((current + ' ' + word).length <= width) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  return lines.length ? lines : [''];
}

function row(left: string, right: string, width = RECEIPT_WIDTH): string {
  const cleanRight = safeText(right);
  const leftWidth = Math.max(1, width - cleanRight.length);
  return fitText(left, leftWidth).padEnd(leftWidth) + cleanRight;
}

async function setPrintStyle(
  align: 'left' | 'center' | 'right',
  bold: boolean,
  fontSize: number
): Promise<void> {
  await SunmiPrinterLibrary.setAlignment(align);
  await SunmiPrinterLibrary.setTextStyle('bold', bold);
  await SunmiPrinterLibrary.setFontSize(fontSize);
}

async function printText(
  text: string,
  options?: {
    align?: 'left' | 'center' | 'right';
    bold?: boolean;
    fontSize?: number;
  }
): Promise<void> {
  await setPrintStyle(
    options?.align || 'left',
    options?.bold || false,
    options?.fontSize || 20
  );

  await SunmiPrinterLibrary.printText(text + '\n');
}

async function printDivider(solid = false): Promise<void> {
  await printText(solid ? '-'.repeat(RECEIPT_WIDTH) : '-'.repeat(RECEIPT_WIDTH), {
    align: 'left',
    bold: solid,
    fontSize: 18,
  });
}

async function printLogoImage(logoUrl: string): Promise<boolean> {
  try {
    const fileUri = FileSystem.cacheDirectory + `receipt-logo-${Date.now()}.png`;

    await FileSystem.downloadAsync(logoUrl, fileUri);

    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    await SunmiPrinterLibrary.setAlignment('center');

    try {
      await SunmiPrinterLibrary.printImage(base64, 384, 'binary');
    } catch {
      await SunmiPrinterLibrary.printImage(`data:image/png;base64,${base64}`, 384, 'binary');
    }

    await SunmiPrinterLibrary.lineWrap(1);
    return true;
  } catch (e) {
    console.log('Sunmi logo print failed, using restaurant name instead:', e);
    return false;
  }
}

async function printItem(item: any): Promise<void> {
  const quantity = safeText(item.quantity) || '1';
  const variation = safeText(item.variation);
  const name = variation ? `${safeText(item.name)} (${variation})` : safeText(item.name);
  const price = formatCHF(item.total);

  const label = `${quantity}x ${name}`;
  const priceWidth = price.length;
  const firstLineWidth = RECEIPT_WIDTH - priceWidth;
  const wrapped = wrapText(label, firstLineWidth);

  await printText(wrapped[0].padEnd(firstLineWidth) + price, {
    align: 'left',
    bold: true,
    fontSize: 21,
  });

  for (let i = 1; i < wrapped.length; i++) {
    await printText(`   ${fitText(wrapped[i], RECEIPT_WIDTH - 3)}`, {
      align: 'left',
      bold: true,
      fontSize: 21,
    });
  }

  for (const addon of item.addons || []) {
    const addonText = `+ ${safeText(addon.label || addon.name)}`;
    await printText(`   ${fitText(addonText, RECEIPT_WIDTH - 3)}`, {
      align: 'left',
      bold: true,
      fontSize: 19,
    });
  }

  await printDivider(true);
}

export async function printReceiptViaSunmi(
  order: any,
  restaurantName: string,
  tr: ReceiptTranslation,
  logoUrl?: string
): Promise<void> {
  await SunmiPrinterLibrary.prepare();

  const createdAt = order.created_at ? new Date(order.created_at) : new Date();
  const date = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;

  const dateStr = date.toLocaleDateString('de-CH');
  const timeStr = date.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const orderNumber = safeText(order.order_number || order.order_id || '');
  const table = safeText(order.table);

  let logoPrinted = false;

  if (logoUrl) {
    logoPrinted = await printLogoImage(logoUrl);
  }

  if (!logoPrinted) {
    await printText(restaurantName.toUpperCase(), {
      align: 'center',
      bold: true,
      fontSize: 30,
    });
  }

  await printText(orderNumber, {
    align: 'center',
    bold: true,
    fontSize: 26,
  });

  await printText(`${dateStr} ${timeStr}`, {
    align: 'center',
    bold: true,
    fontSize: 20,
  });

  if (
    table &&
    table.toLowerCase() !== 'walk-in' &&
    table.toLowerCase() !== 'not specified'
  ) {
    await printText(`${tr.table}: ${table}`, {
      align: 'center',
      bold: true,
      fontSize: 20,
    });
  }

  await printDivider(false);

  for (const item of order.items || []) {
    await printItem(item);
  }

  if (order.discount && parseAmount(order.discount) > 0) {
    await printText(row(tr.subtotal, formatCHF(order.subtotal)), {
      align: 'left',
      bold: false,
      fontSize: 20,
    });

    await printText(row(tr.discount, `- CHF ${parseAmount(order.discount).toFixed(2)}`), {
      align: 'left',
      bold: true,
      fontSize: 20,
    });
  }

  await printText(row(tr.total, formatCHF(order.total)), {
    align: 'left',
    bold: true,
    fontSize: 26,
  });

  const paymentValue = order.payment_method === 'cash' ? tr.cash : tr.card;

  await printText(row(tr.payment, paymentValue), {
    align: 'left',
    bold: true,
    fontSize: 24,
  });

  if (order.note) {
    await printDivider(false);

    await printText(`${tr.note}: ${safeText(order.note)}`, {
      align: 'left',
      bold: true,
      fontSize: 19,
    });
  }

  await printDivider(false);

  await printText(tr.thank, {
    align: 'center',
    bold: true,
    fontSize: 19,
  });

  await printDivider(false);

  await printText('Powered by: FoodUp.ch', {
    align: 'center',
    bold: true,
    fontSize: 16,
  });

  await SunmiPrinterLibrary.lineWrap(5);
}