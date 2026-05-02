export const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value !== '';
};

export const isNullOrUndefined = (
  value: unknown,
): value is null | undefined => {
  return value === null || value === undefined;
};

export function isAllZero(bytes: Uint8Array): boolean {
  return bytes.every((b) => b === 0);
}
