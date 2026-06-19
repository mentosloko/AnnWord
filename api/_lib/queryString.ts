type QueryValue = string | number | boolean | null | QueryValue[] | { [key: string]: QueryValue };

type QueryRecord = Record<string, QueryValue | undefined>;

const isObject = (value: unknown): value is Record<string, QueryValue> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const append = (params: URLSearchParams, key: string, value: QueryValue | undefined): void => {
  if (typeof value === 'undefined' || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => append(params, `${key}[${index}]`, item));
    return;
  }
  if (isObject(value)) {
    Object.entries(value).forEach(([childKey, childValue]) => append(params, `${key}[${childKey}]`, childValue));
    return;
  }
  params.append(key, String(value));
};

export const toQuery = (payload: QueryRecord): string => {
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => append(params, key, value));
  return params.toString();
};
