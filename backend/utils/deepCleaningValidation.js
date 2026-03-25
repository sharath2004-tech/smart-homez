const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const normalizeDurationMinutes = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 180;
  }

  return Math.max(15, Math.round(numericValue));
};

export const buildBookingDateTime = (dateValue, timeValue) => {
  if (!TIME_PATTERN.test(String(timeValue || ''))) {
    return null;
  }

  const [hours, minutes] = String(timeValue).split(':').map(Number);
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(hours, minutes, 0, 0);
  return date;
};

export const buildVerifiedCartItems = (cartItems, config) => {
  let calculatedTotal = 0;
  const invalidItems = [];

  const verifiedCartItems = (cartItems || []).map((item) => {
    const configItem = config.items.find((configuredItem) => configuredItem.id === item.itemId);
    if (!configItem) {
      invalidItems.push({ itemId: item?.itemId || null, reason: 'Unknown service item selected' });
      return null;
    }

    let totalPrice = 0;
    const qty = Math.max(1, Number(item.qty) || 1);
    const parsedAreaValue = item.areaValue != null ? Number(item.areaValue) : null;
    const areaValue = parsedAreaValue != null && Number.isFinite(parsedAreaValue)
      ? Math.max(0, parsedAreaValue)
      : null;

    if (configItem.maxQty && qty > configItem.maxQty) {
      invalidItems.push({ itemId: configItem.id, reason: `${configItem.name} supports a maximum quantity of ${configItem.maxQty}` });
      return null;
    }

    if (configItem.pricingType === 'per_sqft') {
      if (!Number.isFinite(areaValue) || areaValue <= 0) {
        invalidItems.push({ itemId: configItem.id, reason: `${configItem.name} requires a valid area value greater than 0` });
        return null;
      }
      totalPrice = configItem.price * areaValue;
    } else if (configItem.pricingType === 'tiered') {
      const tier = configItem.tiers?.find((configuredTier) => configuredTier.label === item.selectedTier);
      if (!tier) {
        invalidItems.push({ itemId: configItem.id, reason: `${configItem.name} requires a valid tier selection` });
        return null;
      }
      totalPrice = tier.price * qty;
    } else {
      totalPrice = configItem.price * qty;
    }

    calculatedTotal += totalPrice;

    return {
      itemId: configItem.id,
      name: configItem.pricingType === 'per_sqft' && areaValue
        ? `${configItem.name} (${areaValue} ${configItem.unit || 'sqft'})`
        : configItem.name,
      category: configItem.category,
      qty,
      durationMinutes: normalizeDurationMinutes(configItem.durationMinutes),
      unitPrice: configItem.price,
      totalPrice,
      selectedTier: configItem.pricingType === 'tiered'
        ? (item.selectedTier || null)
        : configItem.pricingType === 'per_sqft' && areaValue
          ? `${areaValue} ${configItem.unit || 'sqft'}`
          : item.selectedTier || null,
      areaValue,
    };
  }).filter(Boolean);

  return { verifiedCartItems, calculatedTotal, invalidItems };
};