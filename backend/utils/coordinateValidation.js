export const hasValue = (value) => value !== undefined && value !== null && value !== '';

export const parseCoordinate = (value) => {
  if (!hasValue(value)) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};