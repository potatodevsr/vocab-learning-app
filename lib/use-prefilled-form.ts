"use client";

import { useEffect, type RefObject } from "react";

/**
 * Adopt anything that was typed before React was listening.
 *
 * Both auth forms are controlled: the input shows `value={state}` and every keystroke goes
 * through `onChange`. Between first paint and hydration there is no `onChange` — the
 * markup is real HTML, the fields accept typing, and none of it reaches React. The DOM
 * keeps the characters and the component's state stays empty, which on the register form
 * means five visibly filled fields above a permanently disabled submit button, with
 * nothing on screen to explain why.
 *
 * Measured on this app: with script delivery delayed by 6s — an ordinary mid-range Android
 * on a slow connection — a form filled during that window still reported
 * `isFormValid === false` twelve seconds later. The same gap swallows a password
 * manager's autofill, which lands before hydration by design.
 *
 * So on mount, read what the DOM already holds and hand it to the component. Fields are
 * keyed by `name`, falling back to `id`, because the login form labels its inputs with
 * `id` alone.
 */
export function usePrefilledForm(
    formRef: RefObject<HTMLFormElement | null>,
    adopt: (values: Record<string, string>) => void,
) {
    useEffect(() => {
        const form = formRef.current;
        if (!form) return;

        const values: Record<string, string> = {};
        for (const field of form.querySelectorAll("input")) {
            const key = field.name || field.id;
            if (key && field.value) values[key] = field.value;
        }

        if (Object.keys(values).length > 0) adopt(values);
        // Once, on mount: this exists to close the pre-hydration gap, and re-running it
        // would fight the very state it seeded.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
}
