import { statSync } from "node:fs";

/**
 * Does this path exist — or could we not tell?
 *
 * `existsSync` swallows **every** error and answers `false`, so "the file is not there" and
 * "the process could not look" are the same answer. Under load they are not the same thing
 * at all: a saturated machine running Chromium, a Worker and a dev server can hit `EMFILE`,
 * and a structural assertion then reports a missing route boundary that is sitting on disk.
 * That happened — `admin/(protected)/letters has error.tsx` failed in a full run and passed
 * on the same tree seconds later.
 *
 * `ENOENT` is the only answer that means absent. Anything else is a failure to observe, and
 * is raised so it reads as the infrastructure problem it is instead of a fabricated finding.
 */
export const fileExists = (path: string): boolean => {
    try {
        statSync(path);
        return true;
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "ENOTDIR") return false;

        throw new Error(
            `Could not determine whether ${path} exists (${code ?? "unknown error"}). ` +
                "This is an environment failure, not a missing file.",
        );
    }
};
