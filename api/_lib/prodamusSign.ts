import crypto from 'crypto';

type PlainValue = string | number | boolean | null | PlainValue[] | { [key: string]: PlainValue | undefined };
type PlainRecord = Record<string, PlainValue | undefined>;

const isObject = (value: unknown): value is Record<string, PlainValue | undefined> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeForSignature = (value: PlainValue | undefined): PlainValue => {
  if (Array.isArray(value)) return value.map(normalizeForSignature);
  if (isObject(value)) {
    return Object.keys(value).sort().reduce<Record<string, PlainValue>>((acc, key) => {
      const item = value[key];
      if (key !== 'signature' && key !== 'sign' && typeof item !== 'undefined') acc[key] = normalizeForSignature(item);
      return acc;
    }, {});
  }
  return String(value ?? '');
};

export const signatureBody = (payload: PlainRecord): string =>
  JSON.stringify(normalizeForSignature(payload) as Record<string, PlainValue>).replace(/\//g, '\\/');

export const makeSignature = (payload: PlainRecord, key: string): string =>
  crypto.createHmac('sha256', key).update(signatureBody(payload)).digest('hex');

export const safeEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
