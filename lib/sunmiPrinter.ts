// lib/sunmiPrinter.ts
//
// Native-only (Android) implementation of Sunmi built-in printer support.
// This file is paired with lib/sunmiPrinter.web.ts -- Metro automatically
// picks the .web.ts version when bundling for web, so the native library
// import below is NEVER statically included in the web build.
//
// Do not import '@mitsuharu/react-native-sunmi-printer-library' anywhere
// outside this file (and its .web.ts counterpart).

import * as SunmiPrinterLibrary from '@mitsuharu/react-native-sunmi-printer-library';
import * as FileSystem from 'expo-file-system/legacy';
import { Buffer } from 'buffer';

const RECEIPT_WIDTH = 42;
const PRICE_WIDTH = 10;
const QTY_WIDTH = 4;

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

function line(char = '-'): string {
  return char.repeat(RECEIPT_WIDTH);
}

function centerText(text: string): string {
  const clean = safeText(text);
  if (clean.length >= RECEIPT_WIDTH) return clean;
  const left = Math.floor((RECEIPT_WIDTH - clean.length) / 2);
  return ' '.repeat(left) + clean;
}

function fitText(text: string, width: number): string {
  const clean = safeText(text);
  if (clean.length <= width) return clean;
  return clean.slice(0, Math.max(0, width - 1)) + '…';
}

function wrapText(text: string, width: number): string[] {
  const clean = safeText(text).replace(/\s+/g, ' ');
  if (!clean) return [''];

  const words = clean.split(' ');
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

  const finalLines: string[] = [];
  for (const l of lines) {
    if (l.length <= width) {
      finalLines.push(l);
    } else {
      for (let i = 0; i < l.length; i += width) {
        finalLines.push(l.slice(i, i + width));
      }
    }
  }

  return finalLines.length ? finalLines : [''];
}

function makeAmountRow(label: string, amount: string): string {
  const cleanLabel = safeText(label);
  const cleanAmount = safeText(amount);
  const leftWidth = Math.max(1, RECEIPT_WIDTH - cleanAmount.length);
  return fitText(cleanLabel, leftWidth).padEnd(leftWidth) + cleanAmount;
}

function makeItemFirstRow(qty: any, name: string, price: string): string {
  const qtyText = `${safeText(qty) || '1'}x`;
  const safeQty = fitText(qtyText, QTY_WIDTH).padEnd(QTY_WIDTH);
  const safePrice = fitText(price, PRICE_WIDTH).padStart(PRICE_WIDTH);
  const nameWidth = RECEIPT_WIDTH - QTY_WIDTH - PRICE_WIDTH;

  return safeQty + fitText(name, nameWidth).padEnd(nameWidth) + safePrice;
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

async function printCentered(
  text: string,
  options?: {
    bold?: boolean;
    fontSize?: number;
  }
): Promise<void> {
  await SunmiPrinterLibrary.setAlignment('center');
  await SunmiPrinterLibrary.setTextStyle('bold', !!options?.bold);
  await SunmiPrinterLibrary.setFontSize(options?.fontSize ?? 20);
  await SunmiPrinterLibrary.printText(text + '\n');
}

async function printLeft(
  text: string,
  options?: {
    bold?: boolean;
    fontSize?: number;
  }
): Promise<void> {
  await SunmiPrinterLibrary.setAlignment('left');
  await SunmiPrinterLibrary.setTextStyle('bold', !!options?.bold);
  await SunmiPrinterLibrary.setFontSize(options?.fontSize ?? 20);
  await SunmiPrinterLibrary.printText(text + '\n');
}

async function printWrappedLeft(
  text: string,
  width = RECEIPT_WIDTH,
  indent = '',
  options?: {
    bold?: boolean;
    fontSize?: number;
  }
): Promise<void> {
  const lines = wrapText(text, width);

  for (const l of lines) {
    await printLeft(indent + l, options);
  }
}

async function printHeader(
  order: any,
  restaurantName: string,
  tr: ReceiptTranslation,
  logoUrl?: string
): Promise<void> {
  const createdAt = order.created_at ? new Date(order.created_at) : new Date();
  const isValidDate = !Number.isNaN(createdAt.getTime());

  const date = isValidDate ? createdAt : new Date();
  const dateStr = date.toLocaleDateString('de-CH');
  const timeStr = date.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
  });

  await SunmiPrinterLibrary.setAlignment('center');

  let logoPrinted = false;
  if (logoUrl) {
    logoPrinted = await printLogoImage(logoUrl);
  }

  if (!logoPrinted) {
    await printCentered(restaurantName.toUpperCase(), {
      bold: true,
      fontSize: 32,
    });
  }

  await printCentered(safeText(order.order_number || order.order_id || ''), {
    bold: true,
    fontSize: 26,
  });

  await printCentered(`${dateStr} ${timeStr}`, {
    bold: false,
    fontSize: 20,
  });

  if (order.table && order.table !== 'Walk-in') {
    await printCentered(`${tr.table}: ${order.table}`, {
      bold: false,
      fontSize: 20,
    });
  }

  if (order.customer_name && order.customer_name !== 'Walk-in Customer') {
    await printCentered(safeText(order.customer_name), {
      bold: false,
      fontSize: 20,
    });
  }
}

async function printItems(order: any): Promise<void> {
  let lastCategory = '';

  for (const item of order.items || []) {
    const category = safeText(item.category);

    if (category && category !== lastCategory) {
      lastCategory = category;

      await printLeft('');
      await printLeft(fitText(category, RECEIPT_WIDTH).toUpperCase(), {
        bold: true,
        fontSize: 18,
      });
      await printLeft(line('-'), {
        bold: false,
        fontSize: 18,
      });
    }

    const variation = safeText(item.variation);
    const itemName = variation
      ? `${safeText(item.name)} (${variation})`
      : safeText(item.name);

    const price = formatCHF(item.total);
    const qtyText = `${safeText(item.quantity) || '1'}x`;
    const nameWidth = RECEIPT_WIDTH - QTY_WIDTH - PRICE_WIDTH;

    const wrappedName = wrapText(itemName, nameWidth);

    await printLeft(makeItemFirstRow(item.quantity, wrappedName[0], price), {
      bold: true,
      fontSize: 20,
    });

    for (let i = 1; i < wrappedName.length; i++) {
      await printLeft(' '.repeat(QTY_WIDTH) + wrappedName[i], {
        bold: true,
        fontSize: 20,
      });
    }

    for (const addon of item.addons || []) {
      const addonText = `+ ${safeText(addon.label || addon.name)}`;
      await printWrappedLeft(addonText, RECEIPT_WIDTH - QTY_WIDTH, ' '.repeat(QTY_WIDTH), {
        bold: false,
        fontSize: 20,
      });
    }

    await printLeft(line('-'), {
      bold: false,
      fontSize: 18,
    });
  }
}

async function printTotals(order: any, tr: ReceiptTranslation): Promise<void> {
  if (order.discount && parseAmount(order.discount) > 0) {
    await printLeft(makeAmountRow(tr.subtotal, formatCHF(order.subtotal)), {
      bold: false,
      fontSize: 20,
    });

    await printLeft(makeAmountRow(tr.discount, `- ${formatCHF(order.discount)}`), {
      bold: true,
      fontSize: 20,
    });
  }

  await printLeft(line('='), {
    bold: true,
    fontSize: 20,
  });

  await printLeft(makeAmountRow(tr.total, formatCHF(order.total)), {
    bold: true,
    fontSize: 26,
  });

  await printLeft(line('='), {
    bold: true,
    fontSize: 20,
  });

  const paymentLabel = tr.payment;
  const paymentValue = order.payment_method === 'cash' ? tr.cash : tr.card;

  await printLeft(makeAmountRow(paymentLabel, paymentValue), {
    bold: true,
    fontSize: 24,
  });
}

async function printNote(order: any, tr: ReceiptTranslation): Promise<void> {
  const note = safeText(order.note);
  if (!note) return;

  await printLeft('');
  await printLeft(line('='), {
    bold: true,
    fontSize: 18,
  });

  await printLeft(tr.note.toUpperCase(), {
    bold: true,
    fontSize: 20,
  });

  await printWrappedLeft(note, RECEIPT_WIDTH - 4, '  ', {
    bold: false,
    fontSize: 20,
  });

  await printLeft(line('='), {
    bold: true,
    fontSize: 18,
  });
}

async function printFooter(tr: ReceiptTranslation): Promise<void> {
  await printLeft(line('-'), {
    bold: false,
    fontSize: 18,
  });

  await printCentered(tr.thank, {
    bold: true,
    fontSize: 20,
  });

  await printLeft(line('-'), {
    bold: false,
    fontSize: 18,
  });

  await printCentered('Powered by: FoodUp.ch', {
    bold: false,
    fontSize: 16,
  });

  await SunmiPrinterLibrary.lineWrap(5);
}

export async function printReceiptViaSunmi(
  order: any,
  restaurantName: string,
  tr: ReceiptTranslation,
  logoUrl?: string
): Promise<void> {
  await SunmiPrinterLibrary.prepare();

  await printHeader(order, restaurantName, tr, logoUrl);

  await printLeft(line('-'), {
    bold: false,
    fontSize: 18,
  });

  await printItems(order);

  await printTotals(order, tr);

  await printNote(order, tr);

  await printFooter(tr);

  const cutCommand = new Uint8Array([0x1d, 0x56, 0x00]);
  const cutCommandBase64 = Buffer.from(cutCommand).toString('base64');
  await SunmiPrinterLibrary.sendRAWData(cutCommandBase64);
}