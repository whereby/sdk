import { RoomIntegrationPickerOutcome, subscribeToRoomIntegrationPicker } from "..";

describe("subscribeToRoomIntegrationPicker", () => {
    const PICKER_ORIGIN = "https://integrations.whereby.dev";
    const submission = {
        tagName: "youtube-integration-contentframe",
        shareUrl: "https://youtu.be/dQw4w9WgXcQ",
        props: { videoref: "dQw4w9WgXcQ" },
    };

    function post({
        type,
        payload,
        source,
        origin = PICKER_ORIGIN,
    }: {
        type: string;
        payload?: unknown;
        source: unknown;
        origin?: string;
    }) {
        window.dispatchEvent(new MessageEvent("message", { data: { type, payload }, origin, source: source as never }));
    }

    function listen(getSource: () => unknown) {
        const outcomes: RoomIntegrationPickerOutcome[] = [];
        const unsubscribe = subscribeToRoomIntegrationPicker({
            pickerOrigin: PICKER_ORIGIN,
            getSource: () => getSource() as Window,
            onOutcome: (outcome) => outcomes.push(outcome),
        });
        return { outcomes, unsubscribe };
    }

    const picker = { name: "picker" };
    const listenTo = (source: unknown = picker) => listen(() => source);

    it("reports a submission with the content the picker built", () => {
        const { outcomes } = listenTo();

        post({ type: "whereby:formSubmit", payload: submission, source: picker });

        expect(outcomes).toEqual([{ type: "submitted", content: submission }]);
    });

    it("reports a cancellation", () => {
        const { outcomes } = listenTo();

        post({ type: "whereby:formClose", source: picker });

        expect(outcomes).toEqual([{ type: "cancelled" }]);
    });

    it("reports the message the picker failed with", () => {
        const { outcomes } = listenTo();

        post({ type: "whereby:bootstrapError", payload: { message: "Miro said no" }, source: picker });

        expect(outcomes).toEqual([{ type: "error", error: new Error("Miro said no") }]);
    });

    it("ignores anything from another origin", () => {
        const { outcomes } = listenTo();

        post({
            type: "whereby:formSubmit",
            payload: submission,
            source: picker,
            origin: "https://evil.example.com",
        });

        expect(outcomes).toEqual([]);
    });

    it("ignores anything from another window", () => {
        const { outcomes } = listenTo();

        post({ type: "whereby:formSubmit", payload: submission, source: { name: "someone else" } });

        expect(outcomes).toEqual([]);
    });

    it("ignores messages until the picker window exists", () => {
        let source: unknown = null;
        const { outcomes } = listen(() => source);

        post({ type: "whereby:formSubmit", payload: submission, source: null });
        expect(outcomes).toEqual([]);

        source = picker;
        post({ type: "whereby:formSubmit", payload: submission, source: picker });
        expect(outcomes).toHaveLength(1);
    });

    it("answers once and then stops listening", () => {
        const { outcomes } = listenTo();

        post({ type: "whereby:formClose", source: picker });
        post({ type: "whereby:formSubmit", payload: submission, source: picker });

        expect(outcomes).toEqual([{ type: "cancelled" }]);
    });

    it("stops listening when the caller gives up first", () => {
        const { outcomes, unsubscribe } = listenTo();

        unsubscribe();
        post({ type: "whereby:formSubmit", payload: submission, source: picker });

        expect(outcomes).toEqual([]);
    });
});
