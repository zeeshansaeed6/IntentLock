export type MinorUnits = number & { readonly __brand: 'MinorUnits' };

export function minor(value: number): MinorUnits {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Minor units must be a non-negative safe integer');
  return value as MinorUnits;
}

export function fromMajorUnits(value: string | number): MinorUnits {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) throw new Error(`Invalid major-unit amount: ${text}`);
  const [whole, fraction = ''] = text.split('.');
  return minor(Number(whole) * 100 + Number(fraction.padEnd(2, '0')));
}

/** Airwallex expects major units; every conversion belongs at this boundary. */
export function toMajorUnits(value: MinorUnits): number {
  return value / 100;
}

export function addMinor(...values: MinorUnits[]): MinorUnits {
  return minor(values.reduce((total, value) => total + value, 0));
}

export function formatMinor(value: MinorUnits, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(toMajorUnits(value));
}
