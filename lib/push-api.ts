import { API_URL } from "@/constants/config";

/**
 * Web push subscription, from the browser.
 *
 * Everything here is best-effort by design: push is a second delivery channel for a
 * reminder that already works over email (`backend/src/reminders.ts`), so every failure
 * path — no support, permission denied, keys not configured — leaves the learner exactly
 * where they were rather than surfacing an error about a feature they did not ask for.
 */

export const pushSupported = () =>
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

/** base64url (what a VAPID key is) → the Uint8Array `subscribe()` insists on. */
const toApplicationServerKey = (base64Url: string) => {
    const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

/**
 * Asks for permission, subscribes, and registers the subscription with the API.
 *
 * The permission prompt fires inside the click that called this — browsers require a user
 * gesture, and more importantly a prompt that appears unprompted is the single most
 * reliable way to be blocked permanently.
 */
export const enablePush = async (): Promise<boolean> => {
    if (!pushSupported()) return false;

    try {
        const keyResponse = await fetch(`${API_URL}/push/key`);
        if (!keyResponse.ok) return false;

        const { key } = (await keyResponse.json()) as { key: string };

        const permission = await Notification.requestPermission();
        if (permission !== "granted") return false;

        const registration = await navigator.serviceWorker.ready;

        // An existing subscription is reused rather than replaced: re-subscribing the same
        // browser returns the same endpoint anyway, and `userVisibleOnly` cannot be changed
        // on an existing one.
        const subscription =
            (await registration.pushManager.getSubscription()) ??
            (await registration.pushManager.subscribe({
                // Required by every browser that implements push, and honest: every message
                // this app sends results in a visible notification.
                userVisibleOnly: true,
                applicationServerKey: toApplicationServerKey(key),
            }));

        const response = await fetch(`${API_URL}/push/subscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(subscription.toJSON()),
        });

        return response.ok;
    } catch {
        return false;
    }
};

/** Removes the subscription from this browser and from the API. */
export const disablePush = async (): Promise<void> => {
    if (!pushSupported()) return;

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;

        await fetch(`${API_URL}/push/unsubscribe`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        await subscription.unsubscribe();
    } catch {
        // Nothing to tell the learner: the reminder still arrives by email.
    }
};

/** Whether this browser currently holds a subscription. */
export const pushEnabled = async (): Promise<boolean> => {
    if (!pushSupported() || Notification.permission !== "granted") return false;

    try {
        const registration = await navigator.serviceWorker.ready;
        return Boolean(await registration.pushManager.getSubscription());
    } catch {
        return false;
    }
};
