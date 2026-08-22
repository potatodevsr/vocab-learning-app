/**
 * Where a word's pre-generated speech lives, from the browser's point of view.
 *
 * The stored value is an R2 object key (`audio/en/{wordId}.mp3`) and the browser reaches
 * it through the same-origin `/api/*` forwarder, so there is no second hostname, no CORS
 * preflight on a media request, and nothing to keep in sync when the api Worker moves.
 *
 * Empty key means the clip has not been generated yet — the caller renders no player at
 * all rather than a control that 404s. That is the only audio state the UI branches on.
 */

const AUDIO_PREFIX = "audio/";

export const audioUrl = (key: string | null | undefined): string | null => {
    const trimmed = (key ?? "").trim();

    // A key from outside the audio namespace is not ours to serve. Cheap, but it means a
    // corrupted row can never turn this helper into an open proxy to the API.
    if (!trimmed || !trimmed.startsWith(AUDIO_PREFIX)) return null;

    return `/api/${trimmed}`;
};
