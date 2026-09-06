import { expect, test } from "@playwright/test";

import { readJsonBody } from "../../backend/src/helpers/json-body";

/**
 * The request-body reader four gameplay handlers share.
 *
 * They each wrote it inline as `c.req.json<{ level?: string }>().catch(() => ({}))`, and
 * every one of them was a type error under the Workers runtime types: the `catch` widens
 * the result to `T | {}`, and `{}` has no `level`. That was the whole of `todo.md`'s
 * "backend src typecheck has 11 errors" — three in `checkpoint.ts`, three in
 * `practice.ts`, one in `progress.ts`, four in `session.ts`.
 *
 * The behaviour that has to survive the fix is the reason the `catch` was there: a request
 * with no body, a truncated body, or a body that is not JSON must read as "none of the
 * fields I wanted", never as a 500. `Partial<T>` says that in the type system; these say
 * it at runtime.
 */
const withBody = (json: () => Promise<unknown>) =>
  ({ req: { json } }) as Parameters<typeof readJsonBody>[0];

test.describe("readJsonBody", () => {
  for (const value of [null, [], ["A1"], "A1", 1, true]) {
    test(`non-object JSON ${JSON.stringify(value)} reads as no fields`, async () => {
      await expect(readJsonBody(withBody(async () => value))).resolves.toEqual({});
    });
  }

  test("returns the parsed body when there is one", async () => {
    const body = await readJsonBody<{ level: string; unit: number }>(
      withBody(async () => ({ level: "A2", unit: 4 })),
    );

    expect(body.level).toBe("A2");
    expect(body.unit).toBe(4);
  });

  test("a request with no body reads as no fields, not as a throw", async () => {
    const body = await readJsonBody<{ level: string }>(
      withBody(async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      }),
    );

    expect(body).toEqual({});
    expect(body.level).toBeUndefined();
  });

  test("a rejected parse never escapes to the handler", async () => {
    await expect(
      readJsonBody<{ days: number }>(
        withBody(() => Promise.reject(new Error("connection reset"))),
      ),
    ).resolves.toEqual({});
  });

  test("fields the caller omitted stay undefined for the handler's typeof checks", async () => {
    // Every caller guards with `typeof body.x === "string"` before use, so a partially
    // filled body has to arrive intact rather than being replaced wholesale.
    const body = await readJsonBody<{ level: string; unit: unknown; mode: unknown }>(
      withBody(async () => ({ level: "A1" })),
    );

    expect(body.level).toBe("A1");
    expect(body.unit).toBeUndefined();
    expect(body.mode).toBeUndefined();
  });
});
