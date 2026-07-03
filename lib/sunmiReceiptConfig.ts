export const sunmiReceiptConfig = {
  logo: {
    enabled: true,
    mode: 'height' as 'height' | 'width',
    width: 180,
    height: 60,
    preserveAspect: true,
    gapAfter: 12,
  },

  font: {
    restaurant: 30,
    header: 30,
    meta: 24,
    body: 25,
    addon: 22,
    total: 30,
    payment: 26,
    thank: 22,
    footer: 18,
  },

  spacing: {
    gapSmall: 10,
    gap: 18,
    lineAir: 7,
    dividerGapTop: 18,
    dividerGapBottom: 18,
    sectionGap: 12,
    bottomFeedLines: 4,
    bottomFeedSize: 24,
    totalToPaymentGap: 16,
  },

  columns: {
    product: [1, 7, 2],
    addon: [1, 8, 1],
    total: [1, 1],
    payment: [1, 1],
  },
};