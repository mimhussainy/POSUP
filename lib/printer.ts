import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import { Platform } from 'react-native';
import { sunmiReceiptConfig } from './sunmiReceiptConfig';

export let lastSunmiError: string | null = null;
// Sunmi printing now goes through the native PrinterX module (lib/nativeSunmiPrinter.ts)

const receiptTranslations: { [key: string]: { total: string; payment: string; cash: string; card: string; note: string; thank: string; subtotal: string; discount: string; table: string; } } = {
  de: { total: 'TOTAL', payment: 'Zahlung', cash: 'Bar', card: 'Karte', note: 'Notiz', thank: 'Danke & auf Wiedersehen!', subtotal: 'Zwischensumme', discount: 'Rabatt', table: 'Tisch' },
  en: { total: 'TOTAL', payment: 'Payment', cash: 'Cash', card: 'Card', note: 'Note', thank: 'Thank you & come again!', subtotal: 'Subtotal', discount: 'Discount', table: 'Table' },
  fr: { total: 'TOTAL', payment: 'Paiement', cash: 'Espèces', card: 'Carte', note: 'Note', thank: 'Merci & à bientôt!', subtotal: 'Sous-total', discount: 'Remise', table: 'Table' },
  it: { total: 'TOTALE', payment: 'Pagamento', cash: 'Contanti', card: 'Carta', note: 'Nota', thank: 'Grazie & arrivederci!', subtotal: 'Subtotale', discount: 'Sconto', table: 'Tavolo' },
};

const zReportTranslations: { [key: string]: { title: string; period: string; from: string; to: string; orders: string; revenue: string; cash: string; card: string; avgOrder: string; discounts: string; printedBy: string; closedBy: string; } } = {
  de: { title: 'TAGESABSCHLUSS', period: 'ZEITRAUM', from: 'Von', to: 'Bis', orders: 'Bestellungen', revenue: 'Umsatz', cash: 'Bar', card: 'Karte', avgOrder: 'Ø Bestellung', discounts: 'Rabatte', printedBy: 'Gedruckt von', closedBy: 'Geschlossen von' },
  en: { title: 'DAY CLOSE REPORT', period: 'PERIOD', from: 'From', to: 'To', orders: 'Orders', revenue: 'Revenue', cash: 'Cash', card: 'Card', avgOrder: 'Avg. Order', discounts: 'Discounts', printedBy: 'Printed by', closedBy: 'Closed by' },
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
      ? item.addons.map((a: any) => `
        <tr>
          <td class="qty"></td>
          <td class="name sub" style="padding-top:2px;padding-bottom:2px;">+ ${a.label || a.name}</td>
        </tr>
      `).join('')
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
    <tr class="subtotal">
      <td colspan="2">${tr.subtotal}</td>
      <td>CHF ${parseFloat(order.subtotal).toFixed(2)}</td>
    </tr>
    <tr class="discount">
      <td colspan="2">${tr.discount}</td>
      <td>- CHF ${parseFloat(order.discount).toFixed(2)}</td>
    </tr>
  ` : '';

  const logoHTML = logoUrl ? `<img src="${logoUrl}" style="max-height:60px;max-width:160px;margin-bottom:8px;" />` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { margin: 0; size: 80mm auto; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; width: 80mm; margin: 0 auto; padding: 8px; color: #000; }
        .header { text-align: center; margin-bottom: 10px; }
        .logo { margin-bottom: 6px; }
        .restaurant { font-size: 23px; font-weight: 900; letter-spacing: 1px; color: #000; }
        .order-num { font-size: 18px; font-weight: 800; margin: 4px 0; color: #000; }
        .meta { font-size: 14px; color: #000; margin-top: 2px; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 4px 2px; vertical-align: top; }
        .qty { width: 25px; font-weight: 800; color: #000; font-size: 15px; }
        .name { flex: 1; font-weight: 600; font-size: 15px; }
        .price { text-align: right; white-space: nowrap; font-weight: 700; font-size: 15px; }
        .sub { font-size: 15px; color: #000; font-weight: 400; }
        .subtotal td, .discount td { font-size: 14px; color: #000; }
        .discount td { font-weight: 600; }
        .total-row td { font-size: 16px; font-weight: 900; padding-top: 8px; color: #000; }
        .total-row td:last-child { text-align: right; }
        .payment td { font-size: 18px; color: #000; padding-top: 4px; font-weight: 700; }
        .payment td:last-child { text-align: right; }
        .footer { text-align: center; margin-top: 10px; font-size: 13px; color: #000; font-weight: 600; }
        .note-box { padding: 6px; margin: 6px 0; font-size: 13px; border-radius: 4px; border: 1px solid #000; }
        .cat-header { font-size: 12px; font-style: italic; color: #000; padding-top: 14px; padding-bottom: 2px; }
        .item-divider { border-bottom: 2px solid #000; padding: 0; height: 1px; }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoHTML ? `<div class="logo">${logoHTML}</div>` : `<div class="restaurant">${restaurantName.toUpperCase()}</div>`}
        <div class="order-num">${order.order_number || order.order_id || ''}</div>
        <div class="meta">${dateStr} ${timeStr}</div>
        ${order.table && order.table !== 'Walk-in' ? `<div class="meta">${tr.table}: ${order.table}</div>` : ''}
        ${order.customer_name && order.customer_name !== 'Walk-in Customer' ? `<div class="meta">${order.customer_name}</div>` : ''}
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
    </body>
    </html>
  `;
}

function buildZReportHTML(data: any, restaurantName: string, logoUrl: string, language: string = 'de'): string {
  const tr = zReportTranslations[language] || zReportTranslations['de'];
  const now = new Date();
  const dateStr = now.toLocaleDateString('de-CH');
  const timeStr = now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });

  const logoHTML = logoUrl ? `<img src="${logoUrl}" style="max-height:50px;max-width:150px;margin-bottom:6px;" />` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { margin: 0; size: 80mm auto; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; font-size: 12px; width: 80mm; margin: 0 auto; padding: 8px; color: #000; }
        .header { text-align: center; margin-bottom: 10px; }
        .restaurant { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
        .title { font-size: 15px; font-weight: 800; margin-top: 4px; }
        .meta { font-size: 12px; margin-top: 2px; }
        .divider { border-top: 1px dashed #000; margin: 8px 0; }
        .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 10px 0 4px; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 3px 0; font-size: 14px; }
        td:last-child { text-align: right; font-weight: 600; }
        .total-row td { font-size: 17px; font-weight: 900; padding-top: 6px; }
        .footer { text-align: center; margin-top: 10px; font-size: 11px; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoHTML}
        <div class="restaurant">${restaurantName.toUpperCase()}</div>
        <div class="title">${tr.title}</div>
        <div class="meta">${dateStr} ${timeStr}</div>
      </div>
      <div class="divider"></div>
      <div class="section-label">${tr.period}</div>
      <table>
        <tr><td>${tr.from}</td><td>${data.fromLabel}</td></tr>
        <tr><td>${tr.to}</td><td>${data.toLabel}</td></tr>
      </table>
      <div class="divider"></div>
      <table>
        <tr><td>${tr.orders}</td><td>${data.orderCount}</td></tr>
        <tr><td>${tr.avgOrder}</td><td>CHF ${data.avgOrder.toFixed(2)}</td></tr>
        <tr><td>${tr.cash}</td><td>CHF ${data.cashRevenue.toFixed(2)}</td></tr>
        <tr><td>${tr.card}</td><td>CHF ${data.cardRevenue.toFixed(2)}</td></tr>
        ${data.totalDiscount > 0 ? `<tr><td>${tr.discounts}</td><td>- CHF ${data.totalDiscount.toFixed(2)}</td></tr>` : ''}
      </table>
      <div class="divider"></div>
      <table>
        <tr class="total-row"><td>${tr.revenue}</td><td>CHF ${data.totalRevenue.toFixed(2)}</td></tr>
      </table>
      <div class="divider"></div>
      <div class="footer">Powered by: FoodUp.ch</div>
    </body>
    </html>
  `;
}

// All Sunmi receipt layout lives here.
// Sunmi D3 layout: native text + native columns.
// No bitmap logo for now, because bitmap/image printing was the slow/light part.
const SUNMI_SIZE_RESTAURANT = sunmiReceiptConfig.font.restaurant;
const SUNMI_SIZE_HEADER = sunmiReceiptConfig.font.header;
const SUNMI_SIZE_META = sunmiReceiptConfig.font.meta;
const SUNMI_SIZE_BODY = sunmiReceiptConfig.font.body;
const SUNMI_SIZE_ADDON = sunmiReceiptConfig.font.addon;
const SUNMI_SIZE_TOTAL = sunmiReceiptConfig.font.total;
const SUNMI_SIZE_PAYMENT = sunmiReceiptConfig.font.payment;
const SUNMI_SIZE_THANK = sunmiReceiptConfig.font.thank;
const SUNMI_SIZE_FOOTER = sunmiReceiptConfig.font.footer;

const SUNMI_GAP_SMALL = sunmiReceiptConfig.spacing.gapSmall;
const SUNMI_GAP = sunmiReceiptConfig.spacing.gap;
const SUNMI_LINE_AIR = sunmiReceiptConfig.spacing.lineAir;
const SUNMI_DIVIDER_GAP_TOP = sunmiReceiptConfig.spacing.dividerGapTop;
const SUNMI_DIVIDER_GAP_BOTTOM = sunmiReceiptConfig.spacing.dividerGapBottom;
const SUNMI_SECTION_GAP = sunmiReceiptConfig.spacing.sectionGap;
const SUNMI_TOTAL_PAYMENT_GAP = sunmiReceiptConfig.spacing.totalToPaymentGap;

function sunmiClean(value: any): string {
  if (value === null || value === undefined) return '';

  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function sunmiMoney(value: any): string {
  const n = parseFloat(String(value || '0'));
  return `CHF ${Number.isFinite(n) ? n.toFixed(2) : '0.00'}`;
}

function sunmiNumber(value: any): number {
  const n = parseFloat(String(value || '0'));
  return Number.isFinite(n) ? n : 0;
}

function sunmiTaxIncluded(grossAmount: number, rate: number): number {
  if (!Number.isFinite(grossAmount) || grossAmount <= 0) return 0;
  return grossAmount - grossAmount / (1 + rate / 100);
}

function isSunmiDineInOrder(order: any): boolean {
  const typeText = [
    order.order_type,
    order.type,
    order.service_type,
    order.fulfillment_type,
    order.delivery_type,
    order.order_method,
  ]
    .map((v) => sunmiClean(v).toLowerCase())
    .join(' ');

  if (
    typeText.includes('dine') ||
    typeText.includes('eat in') ||
    typeText.includes('table') ||
    typeText.includes('restaurant')
  ) {
    return true;
  }

  const table = sunmiClean(order.table).toLowerCase();
  return !!table && table !== 'walk-in' && table !== 'not specified';
}

function buildSunmiTaxRows(order: any): { label: string; amount: number }[] {
  const items = Array.isArray(order.items) ? order.items : [];
  const orderTotal = sunmiNumber(order.total);

  if (orderTotal <= 0) return [];

  if (isSunmiDineInOrder(order)) {
    return [
      {
        label: 'MWST inkl. 8.1%',
        amount: sunmiTaxIncluded(orderTotal, 8.1),
      },
    ];
  }

  const itemGrossTotal = items.reduce((sum: number, item: any) => {
    return sum + sunmiNumber(item.total);
  }, 0);

  const alcoholGrossTotal = items.reduce((sum: number, item: any) => {
    return item.is_alcohol === true ? sum + sunmiNumber(item.total) : sum;
  }, 0);

  if (itemGrossTotal <= 0) {
    return [
      {
        label: 'MWST inkl. 2.6%',
        amount: sunmiTaxIncluded(orderTotal, 2.6),
      },
    ];
  }

  const foodGrossTotal = Math.max(0, itemGrossTotal - alcoholGrossTotal);
  const adjustmentFactor = orderTotal / itemGrossTotal;

  const foodAdjustedTotal = foodGrossTotal * adjustmentFactor;
  const alcoholAdjustedTotal = alcoholGrossTotal * adjustmentFactor;

  const rows: { label: string; amount: number }[] = [];

  if (foodAdjustedTotal > 0.005) {
    rows.push({
      label: 'MWST inkl. 2.6%',
      amount: sunmiTaxIncluded(foodAdjustedTotal, 2.6),
    });
  }

  if (alcoholAdjustedTotal > 0.005) {
    rows.push({
      label: 'MWST inkl. 8.1%',
      amount: sunmiTaxIncluded(alcoholAdjustedTotal, 8.1),
    });
  }

  return rows;
}

function buildSunmiInstructions(
  order: any,
  restaurantName: string,
  logoBase64: string,
  language: string
): any[] {
  const hasLogo = !!logoBase64 && sunmiReceiptConfig.logo.enabled;

  const tr = receiptTranslations[language] || receiptTranslations['de'];

  const rawDate = order.created_at || new Date().toISOString();
  const date = new Date(rawDate);
  const dateTimeLabel = Number.isNaN(date.getTime())
    ? sunmiClean(rawDate)
    : `${date.toLocaleDateString('de-CH')} ${date.toLocaleTimeString('de-CH', {
        hour: '2-digit',
        minute: '2-digit',
      })}`;

  const paymentValueLabel = order.payment_method === 'cash' ? tr.cash : tr.card;

  const instructions: any[] = [];

  const pushText = (
    content: any,
    bold = false,
    size = SUNMI_SIZE_BODY,
    align: 'left' | 'center' | 'right' = 'left'
  ) => {
    const text = sunmiClean(content);
    if (!text) return;

    instructions.push({
      type: 'text',
      content: text,
      bold,
      size,
      align,
    });

    pushBlank(SUNMI_LINE_AIR, align);
  };

  const pushBlank = (
    size = SUNMI_GAP,
    align: 'left' | 'center' | 'right' = 'left'
  ) => {
    instructions.push({
      type: 'text',
      content: ' ',
      bold: false,
      size,
      align,
    });
  };

  const pushDivider = () => {
    pushBlank(SUNMI_DIVIDER_GAP_TOP, 'left');

    instructions.push({
      type: 'divider',
    });

    pushBlank(SUNMI_DIVIDER_GAP_BOTTOM, 'left');
  };

  const pushColumns = (
    content: any[],
    widths: number[],
    aligns: ('left' | 'center' | 'right')[],
    bold = false,
    size = SUNMI_SIZE_BODY
  ) => {
    instructions.push({
      type: 'columns',
      content: content.map(sunmiClean),
      widths,
      aligns,
      bold,
      size,
    });

    pushBlank(SUNMI_LINE_AIR, 'left');
  };

  if (hasLogo) {
    const logoInstruction: any = {
      type: 'bitmap',
      base64: logoBase64,
      align: 'center',
      preserveAspect: sunmiReceiptConfig.logo.preserveAspect,
      fallbackText: restaurantName.toUpperCase(),
      fallbackBold: true,
      fallbackSize: SUNMI_SIZE_RESTAURANT,
    };

    if (sunmiReceiptConfig.logo.mode === 'height') {
      logoInstruction.height = sunmiReceiptConfig.logo.height;
    } else {
      logoInstruction.width = sunmiReceiptConfig.logo.width;
    }

    instructions.push(logoInstruction);
    pushBlank(sunmiReceiptConfig.logo.gapAfter, 'center');
  } else {
    pushText(restaurantName.toUpperCase(), true, SUNMI_SIZE_RESTAURANT, 'center');
  }

  pushText(order.order_number || order.order_id || '', true, SUNMI_SIZE_HEADER + 4, 'center');

  if (dateTimeLabel) {
    pushText(dateTimeLabel, false, SUNMI_SIZE_META + 4, 'center');
  }

  if (order.table && order.table !== 'Walk-in' && order.table !== 'Not specified') {
    pushText(`${tr.table}: ${order.table}`, false, SUNMI_SIZE_META, 'center');
  }

  if (order.customer_name && order.customer_name !== 'Walk-in Customer') {
    pushText(order.customer_name, false, SUNMI_SIZE_META, 'center');
  }

  pushDivider();

  const items = order.items || [];

  items.forEach((item: any, index: number) => {
    let name = sunmiClean(item.name || 'Item');

    if (item.variation) {
      name = `${name} (${sunmiClean(item.variation)})`;
    }

    pushColumns(
      [`${item.quantity || 1}x`, name, sunmiMoney(item.total)],
      sunmiReceiptConfig.columns.product,
      ['left', 'left', 'right'],
      true,
      SUNMI_SIZE_BODY + 3
    );

    (item.addons || []).forEach((addon: any) => {
      const addonName = sunmiClean(addon.label || addon.name);
      if (!addonName) return;

      pushColumns(
        ['', `+ ${addonName}`, ''],
        sunmiReceiptConfig.columns.addon,
        ['left', 'left', 'right'],
        false,
        SUNMI_SIZE_ADDON
      );
    });

    if (index < items.length - 1) {
      pushBlank(SUNMI_GAP_SMALL, 'left');
    }
  });

  pushDivider();

  const discount = parseFloat(order.discount || '0');

  if (discount > 0) {
    pushColumns(
      [tr.subtotal, sunmiMoney(order.subtotal)],
      [1, 1],
      ['left', 'right'],
      false,
      SUNMI_SIZE_BODY
    );

    pushColumns(
      [tr.discount, `- CHF ${discount.toFixed(2)}`],
      [1, 1],
      ['left', 'right'],
      true,
      SUNMI_SIZE_BODY
    );
  }

  const taxRows = buildSunmiTaxRows(order);

  taxRows.forEach((row) => {
    pushColumns(
      [row.label, sunmiMoney(row.amount)],
      sunmiReceiptConfig.columns.total,
      ['left', 'right'],
      false,
      SUNMI_SIZE_BODY
    );
  });

  if (taxRows.length > 0) {
    pushBlank(SUNMI_GAP_SMALL, 'left');
  }

  pushColumns(
    [tr.total, sunmiMoney(order.total)],
    sunmiReceiptConfig.columns.total,
    ['left', 'right'],
    true,
    SUNMI_SIZE_TOTAL
  );

  pushBlank(SUNMI_TOTAL_PAYMENT_GAP, 'left');

  pushColumns(
    [tr.payment, paymentValueLabel],
    sunmiReceiptConfig.columns.payment,
    ['left', 'right'],
    true,
    SUNMI_SIZE_PAYMENT
  );

  if (order.note) {
    pushBlank(SUNMI_GAP_SMALL, 'left');
    pushText(`${tr.note}: ${order.note}`, false, SUNMI_SIZE_BODY, 'left');
  }

  pushDivider();

  pushText(tr.thank, true, SUNMI_SIZE_THANK, 'center');

  pushDivider();

  pushBlank(SUNMI_SECTION_GAP, 'center');
  pushText('Powered by: FoodUp.ch', false, SUNMI_SIZE_FOOTER, 'center');

  for (let i = 0; i < sunmiReceiptConfig.spacing.bottomFeedLines; i++) {
    pushBlank(sunmiReceiptConfig.spacing.bottomFeedSize, 'left');
  }

  return instructions;
}

function buildSunmiZReportInstructions(
  data: any,
  restaurantName: string,
  logoBase64: string,
  language: string
): any[] {
  const tr = zReportTranslations[language] || zReportTranslations['de'];
  const now = new Date();

  const dateTimeLabel = `${now.toLocaleDateString('de-CH')} ${now.toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

  const instructions: any[] = [];

  const pushBlank = (
    size = SUNMI_GAP,
    align: 'left' | 'center' | 'right' = 'left'
  ) => {
    instructions.push({
      type: 'text',
      content: ' ',
      bold: false,
      size,
      align,
    });
  };

  const pushText = (
    content: any,
    bold = false,
    size = SUNMI_SIZE_BODY,
    align: 'left' | 'center' | 'right' = 'left'
  ) => {
    const text = sunmiClean(content);
    if (!text) return;

    instructions.push({
      type: 'text',
      content: text,
      bold,
      size,
      align,
    });

    pushBlank(SUNMI_LINE_AIR, align);
  };

  const pushDivider = () => {
    pushBlank(SUNMI_DIVIDER_GAP_TOP, 'left');

    instructions.push({
      type: 'divider',
    });

    pushBlank(SUNMI_DIVIDER_GAP_BOTTOM, 'left');
  };

  const pushColumns = (
    content: any[],
    widths: number[],
    aligns: ('left' | 'center' | 'right')[],
    bold = false,
    size = SUNMI_SIZE_BODY
  ) => {
    instructions.push({
      type: 'columns',
      content: content.map(sunmiClean),
      widths,
      aligns,
      bold,
      size,
    });

    pushBlank(SUNMI_LINE_AIR, 'left');
  };

  if (logoBase64 && sunmiReceiptConfig.logo.enabled) {
    const logoInstruction: any = {
      type: 'bitmap',
      base64: logoBase64,
      align: 'center',
      preserveAspect: sunmiReceiptConfig.logo.preserveAspect,
      fallbackText: restaurantName.toUpperCase(),
      fallbackBold: true,
      fallbackSize: SUNMI_SIZE_RESTAURANT,
    };

    if (sunmiReceiptConfig.logo.mode === 'height') {
      logoInstruction.height = sunmiReceiptConfig.logo.height;
    } else {
      logoInstruction.width = sunmiReceiptConfig.logo.width;
    }

    instructions.push(logoInstruction);
    pushBlank(sunmiReceiptConfig.logo.gapAfter, 'center');
  } else {
    pushText(restaurantName.toUpperCase(), true, SUNMI_SIZE_RESTAURANT, 'center');
  }

  pushText(tr.title, true, SUNMI_SIZE_HEADER, 'center');
  pushText(dateTimeLabel, false, SUNMI_SIZE_META, 'center');

  pushDivider();

  pushText(tr.period, true, SUNMI_SIZE_BODY, 'left');

  pushColumns(
    [tr.from, data.fromLabel],
    [1, 2],
    ['left', 'right'],
    false,
    SUNMI_SIZE_BODY
  );

  pushColumns(
    [tr.to, data.toLabel],
    [1, 2],
    ['left', 'right'],
    false,
    SUNMI_SIZE_BODY
  );

  pushDivider();

  pushColumns(
    [tr.orders, String(data.orderCount)],
    [1, 1],
    ['left', 'right'],
    true,
    SUNMI_SIZE_BODY
  );

  pushColumns(
    [tr.avgOrder, `CHF ${data.avgOrder.toFixed(2)}`],
    [1, 1],
    ['left', 'right'],
    false,
    SUNMI_SIZE_BODY
  );

  pushColumns(
    [tr.cash, `CHF ${data.cashRevenue.toFixed(2)}`],
    [1, 1],
    ['left', 'right'],
    false,
    SUNMI_SIZE_BODY
  );

  pushColumns(
    [tr.card, `CHF ${data.cardRevenue.toFixed(2)}`],
    [1, 1],
    ['left', 'right'],
    false,
    SUNMI_SIZE_BODY
  );

  if (data.totalDiscount > 0) {
    pushColumns(
      [tr.discounts, `- CHF ${data.totalDiscount.toFixed(2)}`],
      [1, 1],
      ['left', 'right'],
      true,
      SUNMI_SIZE_BODY
    );
  }

  pushDivider();

  pushColumns(
    [tr.revenue, `CHF ${data.totalRevenue.toFixed(2)}`],
    [1, 1],
    ['left', 'right'],
    true,
    SUNMI_SIZE_TOTAL
  );

  pushDivider();

  pushText('Powered by: FoodUp.ch', false, SUNMI_SIZE_FOOTER, 'center');

  for (let i = 0; i < sunmiReceiptConfig.spacing.bottomFeedLines; i++) {
    pushBlank(sunmiReceiptConfig.spacing.bottomFeedSize, 'left');
  }

  return instructions;
}

async function printViaTCP(order: any, restaurantName: string, logoUrl: string, language: string): Promise<void> {
  const printerIp = await AsyncStorage.getItem('printer_ip');
  const printerPort = parseInt(await AsyncStorage.getItem('printer_port') || '9100');

  if (!printerIp) throw new Error('No printer IP configured');

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
  let data = ESC + '@';
  data += ESC + 'a' + '\x01';
  data += ESC + 'E' + '\x01';
  data += lines[0] + '\n';
  data += ESC + 'E' + '\x00';
  data += ESC + 'a' + '\x00';

  for (let i = 1; i < lines.length; i++) {
    data += lines[i] + '\n';
  }

  data += GS + 'V' + '\x00';

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

async function printZReportViaTCP(data: any, restaurantName: string, language: string): Promise<void> {
  const printerIp = await AsyncStorage.getItem('printer_ip');
  const printerPort = parseInt(await AsyncStorage.getItem('printer_port') || '9100');

  if (!printerIp) throw new Error('No printer IP configured');

  const tr = zReportTranslations[language] || zReportTranslations['de'];
  const now = new Date();
  const dateStr = now.toLocaleDateString('de-CH');
  const timeStr = now.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' });

  const lines: string[] = [];
  lines.push(restaurantName.toUpperCase());
  lines.push(tr.title);
  lines.push(`${dateStr} ${timeStr}`);
  lines.push('--------------------------------');
  lines.push(`${tr.from}: ${data.fromLabel}`);
  lines.push(`${tr.to}: ${data.toLabel}`);
  lines.push('--------------------------------');

  const orderLine = `${tr.orders}`;
  lines.push(orderLine.padEnd(32 - String(data.orderCount).length) + data.orderCount);

  const avgStr = `CHF ${data.avgOrder.toFixed(2)}`;
  lines.push(tr.avgOrder.padEnd(32 - avgStr.length) + avgStr);

  const cashStr = `CHF ${data.cashRevenue.toFixed(2)}`;
  lines.push(tr.cash.padEnd(32 - cashStr.length) + cashStr);

  const cardStr = `CHF ${data.cardRevenue.toFixed(2)}`;
  lines.push(tr.card.padEnd(32 - cardStr.length) + cardStr);

  if (data.totalDiscount > 0) {
    const discStr = `-CHF ${data.totalDiscount.toFixed(2)}`;
    lines.push(tr.discounts.padEnd(32 - discStr.length) + discStr);
  }

  lines.push('--------------------------------');
  const totalStr = `CHF ${data.totalRevenue.toFixed(2)}`;
  lines.push(tr.revenue.padEnd(32 - totalStr.length) + totalStr);
  lines.push('--------------------------------');
  lines.push('Powered by FoodUp.ch');
  lines.push('', '', '');

  const ESC = '\x1b';
  const GS = '\x1d';
  let pdata = ESC + '@';
  pdata += ESC + 'a' + '\x01';
  pdata += ESC + 'E' + '\x01';
  pdata += lines[0] + '\n';
  pdata += lines[1] + '\n';
  pdata += ESC + 'E' + '\x00';
  pdata += ESC + 'a' + '\x00';

  for (let i = 2; i < lines.length; i++) {
    pdata += lines[i] + '\n';
  }

  pdata += GS + 'V' + '\x00';

  const TcpSocket = require('react-native-tcp-socket');
  return new Promise((resolve, reject) => {
    const client = TcpSocket.createConnection({ host: printerIp, port: printerPort }, () => {
      client.write(pdata, 'binary');
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
  const printerModel = (await AsyncStorage.getItem('printer_model') || '').toLowerCase();

  if (Platform.OS === 'web') {
    const html = buildReceiptHTML(order, restaurantName, logoUrl, language);
    const win = (window as any).open('', '_blank', 'width=800,height=900');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); win.close(); }, 500);
    }
    return;
  }

  if (printerModel.includes('sunmi')) {
    try {
      let logoBase64 = '';

      if (logoUrl) {
        try {
          const FileSystem = await import('expo-file-system/legacy');
          const fileUri = FileSystem.cacheDirectory + 'receipt-logo.png';

          await FileSystem.downloadAsync(logoUrl, fileUri);

          logoBase64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (e) {
          console.log('Logo download failed for native Sunmi print:', e);
        }
      }

      const instructions = buildSunmiInstructions(order, restaurantName, logoBase64, language);
      const { printSunmiInstructionsNative } = await import('./nativeSunmiPrinter');
      const ok = await printSunmiInstructionsNative(instructions);
      if (ok) return;
    } catch (e: any) {
      console.log('Sunmi native print failed:', e);
      lastSunmiError = String(e?.message || e);
      throw e;
    }
  }

  if (printerIp && !printerModel.includes('sunmi')) {
    await printViaTCP(order, restaurantName, logoUrl, language);
  } else {
    const html = buildReceiptHTML(order, restaurantName, logoUrl, language);
    await Print.printAsync({ html });
  }
}

export async function printZReport(zData: {
  fromLabel: string;
  toLabel: string;
  orderCount: number;
  totalRevenue: number;
  cashRevenue: number;
  cardRevenue: number;
  avgOrder: number;
  totalDiscount: number;
}): Promise<void> {
  const restaurantName = await AsyncStorage.getItem('restaurant_name') || 'Restaurant';
  const logoUrl = await AsyncStorage.getItem('restaurant_logo') || '';
  const language = await AsyncStorage.getItem('app_language') || 'de';
  const printerIp = await AsyncStorage.getItem('printer_ip');
  const printerModel = (await AsyncStorage.getItem('printer_model') || '').toLowerCase();

  if (Platform.OS === 'web') {
    const html = buildZReportHTML(zData, restaurantName, logoUrl, language);
    const win = (window as any).open('', '_blank', 'width=400,height=600');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => { win.print(); win.close(); }, 500);
    }
    return;
  }

  if (printerModel.includes('sunmi')) {
    try {
      let logoBase64 = '';

      if (logoUrl) {
        try {
          const FileSystem = await import('expo-file-system/legacy');
          const fileUri = FileSystem.cacheDirectory + 'z-report-logo.png';

          await FileSystem.downloadAsync(logoUrl, fileUri);

          logoBase64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch (e) {
          console.log('Logo download failed for native Sunmi Z-report:', e);
        }
      }

      const instructions = buildSunmiZReportInstructions(zData, restaurantName, logoBase64, language);
      const { printSunmiInstructionsNative } = await import('./nativeSunmiPrinter');
      const ok = await printSunmiInstructionsNative(instructions);
      if (ok) return;
    } catch (e: any) {
      console.log('Sunmi native Z-report print failed:', e);
      lastSunmiError = String(e?.message || e);
      throw e;
    }
  }

  if (printerIp && !printerModel.includes('sunmi')) {
    await printZReportViaTCP(zData, restaurantName, language);
  } else {
    const html = buildZReportHTML(zData, restaurantName, logoUrl, language);
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