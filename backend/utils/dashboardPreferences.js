export const normalizeMaxServices = (value) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 1;
  }

  return Math.min(Math.max(Math.trunc(numericValue), 1), 8);
};