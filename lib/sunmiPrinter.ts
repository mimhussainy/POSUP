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

export async function printReceiptViaSunmi(
  order: any,
  restaurantName: string,
  tr: ReceiptTranslation
): Promise<void> {
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString('de-CH');
  const timeStr = date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });

  await SunmiPrinterLibrary.prepare();

  await SunmiPrinterLibrary.setAlignment('center');
  await SunmiPrinterLibrary.setTextStyle('bold', true);
  await SunmiPrinterLibrary.setFontSize(32);
  await SunmiPrinterLibrary.printText(restaurantName.toUpperCase() + '\n');
  await SunmiPrinterLibrary.setFontSize(24);
  await SunmiPrinterLibrary.printText((order.order_number || '') + '\n');
  await SunmiPrinterLibrary.setTextStyle('bold', false);
  await SunmiPrinterLibrary.setFontSize(20);
  await SunmiPrinterLibrary.printText(`${dateStr} ${timeStr}\n`);
  if (order.table && order.table !== 'Walk-in') {
    await SunmiPrinterLibrary.printText(`${tr.table}: ${order.table}\n`);
  }

  await SunmiPrinterLibrary.setAlignment('left');
  await SunmiPrinterLibrary.printText('--------------------------------\n');

  for (const item of order.items || []) {
    const left = `${item.quantity}x ${item.name}`;
    const right = `CHF ${parseFloat(item.total).toFixed(2)}`;
    await SunmiPrinterLibrary.printText(left.padEnd(32 - right.length) + right + '\n');

    if (item.variation) {
      await SunmiPrinterLibrary.printText(`   -> ${item.variation}\n`);
    }

    for (const addon of item.addons || []) {
      await SunmiPrinterLibrary.printText(`   + ${addon.label || addon.name}\n`);
    }
  }

  await SunmiPrinterLibrary.printText('--------------------------------\n');

  if (order.discount && parseFloat(order.discount) > 0) {
    const sub = `CHF ${parseFloat(order.subtotal).toFixed(2)}`;
    await SunmiPrinterLibrary.printText(`${tr.subtotal.padEnd(32 - sub.length)}${sub}\n`);
    const disc = `-CHF ${parseFloat(order.discount).toFixed(2)}`;
    await SunmiPrinterLibrary.printText(`${tr.discount.padEnd(32 - disc.length)}${disc}\n`);
  }

  const total = `CHF ${parseFloat(order.total).toFixed(2)}`;
  await SunmiPrinterLibrary.setTextStyle('bold', true);
  await SunmiPrinterLibrary.printText(`${tr.total.padEnd(32 - total.length)}${total}\n`);
  await SunmiPrinterLibrary.setTextStyle('bold', false);
  await SunmiPrinterLibrary.printText(`${tr.payment}: ${order.payment_method === 'cash' ? tr.cash : tr.card}\n`);

  if (order.note) {
    await SunmiPrinterLibrary.printText(`${tr.note}: ${order.note}\n`);
  }

  await SunmiPrinterLibrary.printText('--------------------------------\n');
  await SunmiPrinterLibrary.setAlignment('center');
  await SunmiPrinterLibrary.printText(tr.thank + '\n');
  await SunmiPrinterLibrary.setFontSize(16);
  await SunmiPrinterLibrary.printText('Powered by FoodUp.ch\n\n\n');
}