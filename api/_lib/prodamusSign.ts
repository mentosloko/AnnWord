import crypto from 'crypto';
import { optional } from './serverEnv';

type PlainValue = string | number | boolean | null | PlainValue[] | { [key: string]: PlainValue };
type PlainRecord = Record<string, PlainValue | undefined>;

const isObject = (value: unknown): value is Record<string, PlainValue> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const sortDeep = (value: PlainValue): PlainValue => {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (!isObject(value)) return value;
  return Object.keys(value).sort().reduce<Record<string, PlainValue>>((acc, key) => {
    const item = value[key];
    if (typeof item !== 'undefined') acc[key] = sortDeep(item);
    return acc;
  }, {});
};

export const signatureBody = (payload: PlainRecord): string => {
  const copy = { ...payload };
  delete copy.signature;
  delete copy.sign;
  return JSON.stringify(sortDeep(copy as Record<string, PlainValue>));
};

export const makeSignature = (payload: PlainRecord, key: string): string => {
  const digest = crypto.createHmac('sha256', key).update(signatureBody(payload)).digest();
  return optional('PRODAMUS_SIGNATURE_FORMAT', 'hex').toLowerCase() === 'base64' ? digest.toString('base64') : digest.toString('hex');
};

export const safeEqual = (left: string, right: string): boolean => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
