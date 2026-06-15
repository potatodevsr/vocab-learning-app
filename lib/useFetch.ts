'use client';

import { Dispatch, SetStateAction, useEffect, useState } from 'react';

import { usePathname } from 'next/navigation';
import { enqueueSnackbar } from 'notistack';

import {
  QueryFunctionContext,
  useMutation,
  UseMutationOptions,
  UseMutationResult,
  useQuery,
  useQueryClient,
  UseQueryOptions,
  UseQueryResult,
} from '@tanstack/react-query';

import { API_URL } from '../constants/config';
import {
  deriveFetchQueryKey,
  deriveModelKey,
  extractErrorMessage,
  ExtraOptions,
  fetchAPI,
  getFetchVariant,
  Options,
} from './api';

type FetchQueryMeta = {
  options: Options;
  useLocalToken?: boolean;
  variant: string;
};

interface SnackbarPropsExtended extends React.HTMLAttributes<HTMLDivElement> {
  'data-testid'?: string;
}

type ClientExtraOptions<T> = Omit<ExtraOptions<T>, 'setData'> & {
  setData?: Dispatch<SetStateAction<T | undefined>>;
};

export async function fetchAPIWithSnackbar<T>(
  options: Options,
  extra?: ClientExtraOptions<T>,
): Promise<T> {
  return fetchAPI<T>(options, {
    ...extra,
    setData: extra?.setData as ((value: T) => void) | undefined,
    showErrors: false,
  }).catch((err) => {
    if (extra?.showErrors) {
      enqueueSnackbar(extractErrorMessage(err), {
        autoHideDuration: 3000,
        variant: 'error',
      });
    }
    if (extra?.throwOnError) throw err;
    return undefined as T;
  });
}

export function useFetch<T>(options?: Options, extra?: ClientExtraOptions<T>) {
  const [data, setData] = useState<T>();

  useEffect(() => {
    if (options) {
      fetchAPI<T>(options, {
        ...extra,
        setData: (value) => setData(value),
      });
    }
  }, [extra, options]);

  return { data } as { data: null | T };
}

async function fetchQueryFn<T>(context: QueryFunctionContext): Promise<T> {
  const meta = context.meta as FetchQueryMeta | undefined;

  if (!meta) {
    throw new Error('Missing fetch query metadata');
  }

  const { options, variant } = meta;

  return fetchAPI<T>(
    {
      ...options,
      headers: { 'x-api-variant': variant, ...options.headers },
      signal: context.signal,
      url: `${API_URL}${options.url}`,
    },
    {
      throwOnError: true,
    },
  );
}

export function useFetchQuery<T>(
  options: Options,
  queryOptions?: Omit<UseQueryOptions<T>, 'meta' | 'queryFn' | 'queryKey'> & {
    messageFail?: null | string;
  },
): UseQueryResult<T> {
  const pathname = usePathname();
  const { messageFail, ...restQueryOptions } = queryOptions || {};
  const variant = getFetchVariant(options, pathname);

  const result = useQuery<T>({
    ...restQueryOptions,
    meta: {
      options,
      variant,
    },
    queryFn: fetchQueryFn<T>,
    queryKey: deriveFetchQueryKey(options.url, variant, options.params, options.searchParams),
  });

  useEffect(() => {
    if (result.error && messageFail !== null) {
      enqueueSnackbar(messageFail || extractErrorMessage(result.error), {
        autoHideDuration: 3000,
        SnackbarProps: { 'data-testid': 'snackbar-error' } as SnackbarPropsExtended,
        variant: 'error',
      });
    }
  }, [result.error, messageFail]);

  return result;
}

export function useFetchMutation<T, V = unknown>(
  options: Omit<Options, 'data'>,
  mutationOptions?: Omit<UseMutationOptions<T, Error, V>, 'mutationFn' | 'mutationKey'> & {
    messageFail?: null | string;
    messageSuccess?: null | string;
  },
): UseMutationResult<T, Error, V> {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const method = options.method || 'POST';
  const variant = getFetchVariant(options, pathname);

  const {
    messageFail,
    messageSuccess,
    onError: callerOnError,
    onSuccess: callerOnSuccess,
    ...restMutationOptions
  } = mutationOptions || {};

  return useMutation<T, Error, V>({
    ...restMutationOptions,
    mutationFn: (data: V) =>
      fetchAPI<T>(
        {
          ...options,
          data,
          headers: { 'x-api-variant': variant, ...options.headers },
          method,
          url: `${API_URL}${options.url}`,
        },
        {
          throwOnError: true,
        },
      ),
    mutationKey: deriveFetchQueryKey(options.url, variant),
    onError: (...args) => {
      const [error] = args;
      if (messageFail !== null) {
        enqueueSnackbar(messageFail || extractErrorMessage(error), {
          autoHideDuration: 3000,
          SnackbarProps: { 'data-testid': 'snackbar-error' } as SnackbarPropsExtended,
          variant: 'error',
        });
      }

      callerOnError?.(...args);
    },
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({ queryKey: deriveModelKey(options.url) });

      if (messageSuccess) {
        enqueueSnackbar(messageSuccess, {
          autoHideDuration: 3000,
          SnackbarProps: { 'data-testid': 'snackbar-success' } as SnackbarPropsExtended,
          variant: 'success',
        });
      }

      await callerOnSuccess?.(...args);
    },
  });
}