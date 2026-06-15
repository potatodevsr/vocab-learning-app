import axios, { AxiosError, AxiosRequestConfig, isAxiosError } from 'axios';

export type SearchParams = Record<string, unknown>;

export type Options = Omit<AxiosRequestConfig, 'url'> & {
    catchCb?: (data: unknown) => void;
    searchParams?: SearchParams;
    url: string;
};

export type ExtraOptions<T> = {
    setData?: (value: T) => void;
    showErrors?: boolean;
    throwOnError?: boolean;
    useLocalToken?: boolean;
};

export function encodeParams(params: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;

        if (value === null) {
            result[key] = 'null';
            continue;
        }

        if (typeof value === 'bigint') {
            result[key] = value.toString();
            continue;
        }

        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
            result[key] = JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v));
            continue;
        }

        result[key] = String(value);
    }

    return result;
}

export function getErrorResponse(err: unknown): AxiosError['response'] | undefined {
    return isAxiosError(err) ? err.response : undefined;
}

export function getErrorData(err: unknown): unknown {
    return getErrorResponse(err)?.data;
}

export function extractErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        const data = error.response?.data as { error?: string; message?: string } | undefined;
        const axiosMessage = data?.message || data?.error || error.response?.statusText;
        if (axiosMessage) return String(axiosMessage).substring(0, 300);
        if (error.message) return error.message.substring(0, 300);
    } else if (error instanceof Error) {
        return error.message.substring(0, 300);
    }

    return 'Request failed';
}

type HeadersLike = AxiosRequestConfig['headers'];

export function getHeaderValue(headers: HeadersLike | undefined, name: string): unknown {
    if (!headers) return undefined;

    const possibleHeaders = headers as { get?: (n: string) => unknown } & Record<string, unknown>;

    if (typeof possibleHeaders.get === 'function') {
        return possibleHeaders.get(name);
    }

    const lowerName = name.toLowerCase();
    const entries = Object.entries(possibleHeaders as Record<string, unknown>);

    for (const [key, value] of entries) {
        if (key.toLowerCase() === lowerName) return value;
    }

    return undefined;
}

export function getFetchVariant(options: Options, pathname: string): string {
    const variant = getHeaderValue(options.headers, 'x-api-variant');
    return String(variant ?? pathname);
}

export function deriveKey(url: string, params?: unknown, searchParams?: unknown): unknown[] {
    const key: unknown[] = url.replace(/^\//, '').split('/').filter(Boolean);

    if (params !== undefined) key.push(params);
    if (searchParams !== undefined) key.push(searchParams);

    return key;
}

export function deriveFetchQueryKey(
    url: string,
    variant: string,
    params?: unknown,
    searchParams?: unknown,
): unknown[] {
    return [...deriveKey(url, params, searchParams), { variant }];
}

export function deriveModelKey(url: string): string[] {
    const segments = url.replace(/^\//, '').split('/').filter(Boolean);

    if (segments.length >= 2 && segments[0] === 'admin') {
        return [segments[0], segments[1]];
    }

    return segments.length > 0 ? [segments[0]] : [];
}

export async function fetchAPI<T>(options: Options, extra?: ExtraOptions<T>): Promise<T> {
    const { catchCb, data, method = 'GET' } = options;

    const headers = {
        ...options.headers,
    };

    const rawParams = { ...options.params, ...options.searchParams };
    const encodedParams = Object.keys(rawParams).length > 0 ? encodeParams(rawParams) : undefined;

    const config = {
        ...options,
        data,
        headers,
        method,
        params: encodedParams,
    };

    try {
        const response = await axios(config);

        if (typeof extra?.setData === 'function') {
            extra.setData(response.data);
        }

        return response.data as T;
    } catch (err: unknown) {
        if (extra?.throwOnError) {
            throw err;
        }

        if (catchCb) catchCb(getErrorData(err));

        if (extra?.showErrors) {
            const response = getErrorResponse(err);
            const responseData = response?.data as { message?: string } | undefined;
            const message = response?.statusText || responseData?.message?.substring(0, 300);
            console.error(message);
        }

        return undefined as T;
    }
}