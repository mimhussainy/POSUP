import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import { Platform } from 'react-native';

const receiptTranslations: { [key: string]: { total: string; payment: string; cash: string; card: string; note: string; thank: string; subtotal: string; discount: string; table: string; } } = {
  de: { total: 'TOTAL', payment: 'Zahlung', cash: 'Bar', card: 'Karte', note: 'Notiz', thank: 'Danke & auf Wiedersehen!', subtotal: 'Zwischensumme', discount: 'Rabatt', table: 'Tisch' },
  en: { total: 'TOTAL', payment: 'Payment', cash: 'Cash', card: 'Card', note: 'Note', thank: 'Thank you & come again!', subtotal: 'Subtotal', discount: 'Discount', table: 'Table' },
  fr: { total: 'TOTAL', payment: 'Paiement', cash: 'Espèces', card: 'Carte', note: 'Note', thank: 'Merci & à bientôt!', subtotal: 'Sous-total', discount: 'Remise', table: 'Table' },
  it: { total: 'TOTALE', payment: 'Pagamento', cash: 'Contanti', card: 'Carta', note: 'Nota', thank: 'Grazie & arrivederci!', subtotal: 'Subtotale', discount: 'Sconto', table: 'Tavolo' },
};

function buildReceiptHTML(order: any, restaurantName: string, logoUrl?: string, language: string = 'de'): string {
  const tr = receiptTranslations[language] || receiptTranslations['de'];
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString('de-CH');
  const timeStr = date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });

  let lastCategory = '';
  const itemsHTML = (order.items || []).map((item: any) => {
    let categoryHeader = '';
    if (item.category && item.category !== lastCategory) {
      lastCategory = item.category;
      categoryHeader = `<tr><td colspan="3" class="cat-header">${item.category}</td></tr>`;
    }
    const addonsRows = item.addons && item.addons.length > 0
      ? item.addons.map((a: any) => `<tr><td class="qty"></td><td class="name sub" style="padding-top:2px;padding-bottom:2px;">+ ${a.label || a.name}</td></tr>`).join('')
      : '';
    return `
      ${categoryHeader}
      <tr>
        <td class="qty">${item.quantity}x</td>
        <td class="name">${item.name}${item.variation ? ` (${item.variation})` : ''}</td>
        <td class="price">CHF ${parseFloat(item.total).toFixed(2)}</td>
      </tr>
      ${addonsRows}
      <tr><td colspan="3" class="item-divider"></td></tr>
    `;
  }).join('');

  const discountHTML = order.discount && parseFloat(order.discount) > 0 ? `
    <tr class="subtotal"><td colspan="2">${tr.subtotal}</td><td>CHF ${parseFloat(order.subtotal).toFixed(2)}</td></tr>
    <tr class="discount"><td colspan="2">${tr.discount}</td><td>- CHF ${parseFloat(order.discount).toFixed(2)}</td></tr>
  ` : '';

  const logoHTML = logoUrl ? `<img src="${logoUrl}" style="max-height:60px;max-width:160px;margin-bottom:8px;" />` : '';

  return `<!DOCTYPE html>
    <html><head><meta charset="utf-8">
    <style>
      @page { margin: 0; size: 80mm auto; }
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; width: 80mm; margin: 0 auto; padding: 8px; color: #000; }
      .header { text-align: center; margin-bottom: 10px; }
      .restaurant { font-size: 23px; font-weight: 900; letter-spacing: 1px; }
      .order-num { font-size: 18px; font-weight: 800; margin: 4px 0; }
      .meta { font-size: 14px; margin-top: 2px; }
      .divider { border-top: 1px dashed #000; margin: 8px 0; }
      table { width: 100%; border-collapse: collapse; }
      td { padding: 4px 2px; vertical-align: top; }
      .qty { width: 25px; font-weight: 800; font-size: 15px; }
      .name { flex: 1; font-weight: 600; font-size: 15px; }
      .price { text-align: right; white-space: nowrap; font-weight: 700; font-size: 15px; }
      .sub { font-size: 15px; font-weight: 400; }
      .subtotal td, .discount td { font-size: 14px; }
      .discount td { font-weight: 600; }
      .total-row td { font-size: 16px; font-weight: 900; padding-top: 8px; }
      .total-row td:last-child { text-align: right; }
      .payment td { font-size: 18px; padding-top: 4px; font-weight: 700; }
      .payment td:last-child { text-align: right; }
      .footer { text-align: center; margin-top: 10px; font-size: 13px; font-weight: 600; }
      .note-box { padding: 6px; margin: 6px 0; font-size: 13px; border: 1px solid #000; border-radius: 4px; }
      .cat-header { font-size: 12px; font-style: italic; padding-top: 14px; padding-bottom: 2px; }
      .item-divider { border-bottom: 2px solid #000; padding: 0; height: 1px; }
    </style></head>
    <body>
      <div class="header">
        ${logoHTML ? `<div>${logoHTML}</div>` : `<div class="restaurant">${restaurantName.toUpperCase()}</div>`}
        <div class="order-num">${order.order_number || order.order_id || ''}</div>
        <div class="meta">${dateStr} ${timeStr}</div>
        ${order.table && order.table !== 'Walk-in' ? `<div class="meta">${tr.table}: ${order.table}</div>` : ''}
      </div>
      <div class="divider"></div>
      <table>${itemsHTML}</table>
      <table>
        ${discountHTML}
        <tr class="total-row"><td colspan="2">${tr.total}</td><td>CHF ${parseFloat(order.total).toFixed(2)}</td></tr>
        <tr class="payment"><td colspan="2">${tr.payment}</td><td>${order.payment_method === 'cash' ? tr.cash : tr.card}</td></tr>
      </table>
      ${order.note ? `<div class="note-box">${tr.note}: ${order.note}</div>` : ''}
      <div class="divider"></div>
      <div class="footer">${tr.thank}</div>
      <div class="divider"></div>
      <div class="footer" style="font-size:10px;font-weight:400;">Powered by: FoodUp.ch</div>
    </body></html>`;
}

async function printViaTCP(order: any, restaurantName: string, logoUrl: string, language: string): Promise<void> {
  const printerIp = await AsyncStorage.getItem('printer_ip');
  const printerPort = parseInt(await AsyncStorage.getItem('printer_port') || '9100');

  if (!printerIp) throw new Error('No printer IP configured');

  // Build ESC/POS commands
  const lines: string[] = [];
  const tr = receiptTranslations[language] || receiptTranslations['de'];
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString('de-CH');
  const timeStr = date.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });

  lines.push(restaurantName.toUpperCase());
  lines.push(order.order_number || '');
  lines.push(`${dateStr} ${timeStr}`);
  if (order.table && order.table !== 'Walk-in') lines.push(`${tr.table}: ${order.table}`);
  lines.push('--------------------------------');

  for (const item of order.items || []) {
    const left = `${item.quantity}x ${item.name}`;
    const right = `CHF ${parseFloat(item.total).toFixed(2)}`;
    lines.push(left.padEnd(32 - right.length) + right);
    if (item.variation) lines.push(`   -> ${item.variation}`);
    for (const addon of item.addons || []) {
      lines.push(`   + ${addon.label || addon.name}`);
    }
  }

  lines.push('--------------------------------');

  if (order.discount && parseFloat(order.discount) > 0) {
    const sub = `CHF ${parseFloat(order.subtotal).toFixed(2)}`;
    lines.push(`${tr.subtotal.padEnd(32 - sub.length)}${sub}`);
    const disc = `-CHF ${parseFloat(order.discount).toFixed(2)}`;
    lines.push(`${tr.discount.padEnd(32 - disc.length)}${disc}`);
  }

  const total = `CHF ${parseFloat(order.total).toFixed(2)}`;
  lines.push(`${tr.total.padEnd(32 - total.length)}${total}`);
  lines.push(`${tr.payment}: ${order.payment_method === 'cash' ? tr.cash : tr.card}`);

  if (order.note) lines.push(`${tr.note}: ${order.note}`);

  lines.push('--------------------------------');
  lines.push(tr.thank);
  lines.push('Powered by FoodUp.ch');
  lines.push('', '', '');

  const ESC = '\x1b';
  const GS = '\x1d';
  let data = ESC + '@'; // reset
  data += ESC + 'a' + '\x01'; // center
  data += ESC + 'E' + '\x01'; // bold on
  data += lines[0] + '\n';
  data += ESC + 'E' + '\x00'; // bold off
  data += ESC + 'a' + '\x00'; // left align

  for (let i = 1; i < lines.length; i++) {
    data += lines[i] + '\n';
  }

  data += GS + 'V' + '\x00'; // cut

  const TcpSocket = require('react-native-tcp-socket');
  return new Promise((resolve, reject) => {
    const client = TcpSocket.createConnection({ host: printerIp, port: printerPort }, () => {
      client.write(data, 'binary');
      setTimeout(() => { client.destroy(); resolve(); }, 1500);
    });
    client.on('error', (err: any) => { client.destroy(); reject(err); });
    setTimeout(() => { client.destroy(); reject(new Error('Print timeout')); }, 6000);
  });
}

export async function printOrder(order: any, restaurantCode: string): Promise<void> {
  const restaurantName = await AsyncStorage.getItem('restaurant_name') || restaurantCode;
  const logoUrl = await AsyncStorage.getItem('restaurant_logo') || '';
  const language = await AsyncStorage.getItem('app_language') || 'de';
  const printerIp = await AsyncStorage.getItem('printer_ip');

  // Web — use popup
  if (Platform.OS === 'web') {
    const html = buildReceiptHTML(order, restaurantName, logoUrl, language);
    const win = (window as any).open('', '_blank', 'width=400,height=600');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); win.close(); }, 500);
    }
    return;
  }

  // Native — use TCP if printer IP is set, otherwise expo-print
  if (printerIp) {
    await printViaTCP(order, restaurantName, logoUrl, language);
  } else {
    const html = buildReceiptHTML(order, restaurantName, logoUrl, language);
    await Print.printAsync({ html });
  }
}

export async function testPrintReceipt(restaurantCode: string): Promise<void> {
  await printOrder({
    order_number: 'TEST-001',
    created_at: new Date().toISOString(),
    table: null,
    items: [{ quantity: 1, name: 'Test Product', total: '10.00', variation: '', addons: [], category: '' }],
    subtotal: '10.00',
    discount: '0',
    total: '10.00',
    payment_method: 'cash',
    note: '',
  }, restaurantCode);
}