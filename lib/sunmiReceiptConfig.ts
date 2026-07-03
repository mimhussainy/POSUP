export const sunmiReceiptConfig = {
  logo: {
    enabled: true,
    mode: 'height' as 'height' | 'width',
    width: 180,
    height: 185,
    preserveAspect: true,
    gapAfter: 12,
  },

  font: {
    restaurant: 30,
    header: 30,
    meta: 24,
    body: 27,
    addon: 25,
    total: 33,
    payment: 29,
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
    product: [1, 6, 3],
    addon: [1, 8, 1],
    total: [1, 1],
    payment: [1, 1],
  },
};