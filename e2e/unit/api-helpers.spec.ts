import { expect, test } from "@playwright/test";

import {
  deriveFetchQueryKey,
  deriveKey,
  deriveModelKey,
  encodeParams,
  extractErrorMessage,
  fetchAPI,
  getErrorData,
  getErrorResponse,
  getFetchVariant,
  getHeaderValue,
} from "../../lib/api";
import { extractWords } from "../../lib/oxford-words";

const API = "http://localhost:4100";

test.describe("encodeParams", () => {
  test("skips undefined but keeps null as a literal", () => {
    expect(encodeParams({ a: undefined, b: null })).toEqual({ b: "null" });
  });

  test("stringifies primitives", () => {
    expect(encodeParams({ n: 5, s: "x", bool: true })).toEqual({
      n: "5",
      s: "x",
      bool: "true",
    });
  });

  test("serialises bigints without throwing", () => {
    expect(encodeParams({ big: BigInt(10) })).toEqual({ big: "10" });
  });

  test("JSON-encodes objects and arrays", () => {
    expect(encodeParams({ where: { level: "A1" }, ids: [1, 2] })).toEqual({
      where: '{"level":"A1"}',
      ids: "[1,2]",
    });
  });

  test("JSON-encodes bigints nested inside objects", () => {
    expect(encodeParams({ nested: { big: BigInt(7) } })).toEqual({
      nested: '{"big":"7"}',
    });
  });

  test("an empty object produces no params", () => {
    expect(encodeParams({})).toEqual({});
  });
});

test.describe("error helpers", () => {
  const axiosLike = (data: unknown, statusText = "Bad Request") => ({
    isAxiosError: true,
    response: { data, statusText },
    message: "Request failed with status code 400",
  });

  test("getErrorResponse returns undefined for a plain Error", () => {
    expect(getErrorResponse(new Error("nope"))).toBeUndefined();
  });

  test("getErrorData reaches into the axios response", () => {
    expect(getErrorData(axiosLike({ message: "boom" }))).toEqual({
      message: "boom",
    });
  });

  test("extractErrorMessage prefers the API's message", () => {
    expect(extractErrorMessage(axiosLike({ message: "too many" }))).toBe(
      "too many",
    );
  });

  test("extractErrorMessage falls back to error", () => {
    expect(extractErrorMessage(axiosLike({ error: "denied" }))).toBe("denied");
  });

  test("extractErrorMessage falls back to statusText", () => {
    expect(extractErrorMessage(axiosLike({}, "Teapot"))).toBe("Teapot");
  });

  test("extractErrorMessage handles a plain Error", () => {
    expect(extractErrorMessage(new Error("plain"))).toBe("plain");
  });

  test("extractErrorMessage handles a non-error value", () => {
    expect(extractErrorMessage("just a string")).toBe("Request failed");
  });

  test("extractErrorMessage truncates very long messages", () => {
    expect(extractErrorMessage(new Error("x".repeat(500)))).toHaveLength(300);
  });
});

test.describe("getHeaderValue", () => {
  test("returns undefined without headers", () => {
    expect(getHeaderValue(undefined, "x-api-variant")).toBeUndefined();
  });

  test("reads a plain object case-insensitively", () => {
    expect(getHeaderValue({ "X-Api-Variant": "admin" }, "x-api-variant")).toBe(
      "admin",
    );
  });

  test("uses a Headers-like get() when present", () => {
    const headers = { get: (name: string) => `via-get:${name}` } as never;

    expect(getHeaderValue(headers, "x-api-variant")).toBe(
      "via-get:x-api-variant",
    );
  });

  test("returns undefined for an absent key", () => {
    expect(getHeaderValue({ other: "1" }, "x-api-variant")).toBeUndefined();
  });
});

test.describe("getFetchVariant", () => {
  test("falls back to the pathname when no header is set", () => {
    expect(getFetchVariant({ url: "/vocabword" }, "/vocabword")).toBe(
      "/vocabword",
    );
  });

  test("prefers an explicit variant header", () => {
    expect(
      getFetchVariant(
        { url: "/vocabword", headers: { "x-api-variant": "admin" } },
        "/vocabword",
      ),
    ).toBe("admin");
  });
});

test.describe("query key helpers", () => {
  test("deriveKey splits the path and drops the leading slash", () => {
    expect(deriveKey("/vocabword/paginated")).toEqual([
      "vocabword",
      "paginated",
    ]);
  });

  test("deriveKey appends params and searchParams when given", () => {
    expect(deriveKey("/a", { id: 1 }, { take: 2 })).toEqual([
      "a",
      { id: 1 },
      { take: 2 },
    ]);
  });

  test("deriveFetchQueryKey tags the variant", () => {
    expect(deriveFetchQueryKey("/a", "admin")).toEqual(["a", { variant: "admin" }]);
  });

  test("deriveModelKey keeps two segments for admin paths", () => {
    expect(deriveModelKey("/admin/vocabword")).toEqual(["admin", "vocabword"]);
  });

  test("deriveModelKey keeps the first segment otherwise", () => {
    expect(deriveModelKey("/vocabword/paginated")).toEqual(["vocabword"]);
  });

  test("deriveModelKey handles an empty path", () => {
    expect(deriveModelKey("/")).toEqual([]);
  });
});

test.describe("fetchAPI", () => {
  test("returns data on success", async () => {
    const words = await fetchAPI<unknown[]>(
      { url: `${API}/vocabword`, params: { take: 1 } },
      { throwOnError: true },
    );

    expect(Array.isArray(words)).toBeTruthy();
  });

  test("calls setData when provided", async () => {
    let captured: unknown = null;

    await fetchAPI<unknown[]>(
      { url: `${API}/vocabword`, params: { take: 1 } },
      { throwOnError: true, setData: (value) => (captured = value) },
    );

    expect(Array.isArray(captured)).toBeTruthy();
  });

  test("throws when throwOnError is set", async () => {
    await expect(
      fetchAPI({ url: `${API}/definitely-not-a-route` }, { throwOnError: true }),
    ).rejects.toBeTruthy();
  });

  test("swallows the error and returns undefined by default", async () => {
    const result = await fetchAPI({ url: `${API}/definitely-not-a-route` });

    expect(result).toBeUndefined();
  });

  test("invokes catchCb with the error payload", async () => {
    let called = false;

    await fetchAPI({
      url: `${API}/definitely-not-a-route`,
      catchCb: () => (called = true),
    });

    expect(called).toBeTruthy();
  });

  test("merges params and searchParams", async () => {
    const words = await fetchAPI<unknown[]>(
      {
        url: `${API}/vocabword`,
        params: { where: { level: "A1" } },
        searchParams: { take: 2 },
      },
      { throwOnError: true },
    );

    expect(words).toHaveLength(2);
  });
});

test.describe("extractWords", () => {
  test("accepts a bare array", () => {
    expect(extractWords([{ id: "a" }] as never)).toHaveLength(1);
  });

  test("accepts a paginated envelope", () => {
    expect(extractWords({ data: [{ id: "a" }] } as never)).toHaveLength(1);
  });

  test("accepts an empty array", () => {
    expect(extractWords([])).toEqual([]);
  });

  test("throws on an unexpected shape rather than returning nothing silently", () => {
    expect(() => extractWords({ items: [] } as never)).toThrow(
      /unexpected response format/i,
    );
  });

  test("throws when data is not an array", () => {
    expect(() => extractWords({ data: "nope" } as never)).toThrow();
  });
});
