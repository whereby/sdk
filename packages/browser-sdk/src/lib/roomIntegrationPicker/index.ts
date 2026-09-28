import { ROOM_INTEGRATION_PICKER_MESSAGES, RoomIntegrationPickerResult } from "@whereby.com/core";

export type RoomIntegrationPickerOutcome =
    | { type: "submitted"; content: RoomIntegrationPickerResult }
    | { type: "cancelled" }
    | { type: "error"; error: Error };

/**
 * Listens for the one answer a picker gives, then stops listening.
 *
 * The picker is served by the integration, on the integration's origin, so both checks here matter:
 * `event.origin` keeps other frames from answering for it, and `event.source` keeps a second frame
 * on the *same* origin from doing so. `getSource` is read per message rather than captured once,
 * because an iframe's `contentWindow` is null until the frame attaches and is a different object
 * after a reload.
 * @returns an unsubscribe function, for when the consumer gives up first (an unmount, say).
 */
export function subscribeToRoomIntegrationPicker({
    pickerOrigin,
    getSource,
    onOutcome,
}: {
    pickerOrigin: string;
    getSource: () => Window | null | undefined;
    onOutcome: (outcome: RoomIntegrationPickerOutcome) => void;
}): () => void {
    let settled = false;

    function handleMessage(event: MessageEvent) {
        if (settled || event.origin !== pickerOrigin || !event.source || event.source !== getSource()) {
            return;
        }

        const { type, payload } = event.data || {};

        if (type === ROOM_INTEGRATION_PICKER_MESSAGES.FORM_SUBMIT) {
            settle({ type: "submitted", content: payload as RoomIntegrationPickerResult });
        } else if (type === ROOM_INTEGRATION_PICKER_MESSAGES.FORM_CLOSE) {
            settle({ type: "cancelled" });
        } else if (type === ROOM_INTEGRATION_PICKER_MESSAGES.ERROR) {
            settle({
                type: "error",
                error: new Error(payload?.message || "The room integration picker failed"),
            });
        }
    }

    const unsubscribe = () => {
        settled = true;
        window.removeEventListener("message", handleMessage);
    };

    const settle = (outcome: RoomIntegrationPickerOutcome) => {
        unsubscribe();
        onOutcome(outcome);
    };

    window.addEventListener("message", handleMessage);

    return unsubscribe;
}
