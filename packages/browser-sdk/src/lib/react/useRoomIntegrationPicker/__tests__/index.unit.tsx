import * as React from "react";
import { render, act } from "@testing-library/react";
import { RoomIntegration } from "@whereby.com/core";

import { useRoomIntegrationPicker, UseRoomIntegrationPickerOptions } from "..";

function Harness(options: UseRoomIntegrationPickerOptions) {
    const { iframeProps } = useRoomIntegrationPicker(options);

    return iframeProps ? <iframe {...iframeProps} /> : null;
}

const WEBVIEW = "https://integrations.whereby.dev/youtube/index.2ad4b051.html";
const PICKER_ORIGIN = "https://integrations.whereby.dev";

const integration: RoomIntegration = {
    roomIntegrationId: "5",
    name: "youtube",
    title: "YouTube",
    description: "",
    type: "video",
    contentTagName: "youtube-integration-contentframe",
    icons: { small: "s.svg", large: "l.svg" },
    link: { href: "", text: "" },
    entrypoint: "https://integrations.whereby.dev/youtube/index.mjs",
    webview: WEBVIEW,
    matcher: /youtu\.be/i,
    isEmbeddable: true,
};

const submission = {
    tagName: "youtube-integration-contentframe",
    shareUrl: "https://youtu.be/dQw4w9WgXcQ",
    props: { videoref: "dQw4w9WgXcQ", seek: 0 },
};

function setup(overrides: Partial<UseRoomIntegrationPickerOptions> = {}) {
    const onPicked = jest.fn();
    const onCancel = jest.fn();
    const onError = jest.fn();

    const utils = render(
        <Harness integration={integration} onPicked={onPicked} onCancel={onCancel} onError={onError} {...overrides} />,
    );

    const iframe = utils.container.querySelector("iframe") as HTMLIFrameElement | null;

    if (iframe) {
        Object.defineProperty(iframe, "contentWindow", { value: { name: "picker" }, configurable: true });
    }

    const fromPicker = (type: string, payload?: unknown, source: unknown = iframe?.contentWindow) =>
        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type, payload },
                    origin: PICKER_ORIGIN,
                    source: source as never,
                }),
            );
        });

    const fromOrigin = (origin: string) =>
        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: "whereby:formSubmit", payload: submission },
                    origin,
                    source: iframe?.contentWindow as never,
                }),
            );
        });

    return { ...utils, iframe, fromPicker, fromOrigin, onPicked, onCancel, onError };
}

describe("useRoomIntegrationPicker", () => {
    it("loads bootstrap.html, carrying the parent origin", () => {
        const { iframe } = setup();
        const url = new URL((iframe as HTMLIFrameElement).src);

        expect(url.origin + url.pathname).toEqual(`${PICKER_ORIGIN}/youtube/bootstrap.html`);
        expect(url.searchParams.get("parentOrigin")).toEqual(window.location.origin);
    });

    it("carries the feature source when given one", () => {
        const { iframe } = setup({ featureSource: "toolbar" });

        expect(new URL((iframe as HTMLIFrameElement).src).searchParams.get("featuresource")).toEqual("toolbar");
    });

    it("hands back what the user picked, without sharing it", () => {
        const { fromPicker, onPicked, onCancel } = setup();

        fromPicker("whereby:formSubmit", submission);

        expect(onPicked).toHaveBeenCalledWith(submission);
        expect(onCancel).not.toHaveBeenCalled();
    });

    it("reports a cancellation", () => {
        const { fromPicker, onPicked, onCancel } = setup();

        fromPicker("whereby:formClose");

        expect(onPicked).not.toHaveBeenCalled();
        expect(onCancel).toHaveBeenCalled();
    });

    it("reports an error from the picker", () => {
        const { fromPicker, onError } = setup();

        fromPicker("whereby:bootstrapError", { message: "Miro said no" });

        expect(onError).toHaveBeenCalledWith(new Error("Miro said no"));
    });

    it("ignores a submission from another origin", () => {
        const { fromOrigin, onPicked } = setup();

        fromOrigin("https://evil.example.com");

        expect(onPicked).not.toHaveBeenCalled();
    });

    it("ignores a submission from a window that is not the picker", () => {
        const { fromPicker, onPicked } = setup();

        fromPicker("whereby:formSubmit", submission, { name: "someone else" });

        expect(onPicked).not.toHaveBeenCalled();
    });

    // the consumer unmounts on the first answer, but the frame lives on for a tick
    it("answers once", () => {
        const { fromPicker, onPicked, onCancel } = setup();

        fromPicker("whereby:formClose");
        fromPicker("whereby:formSubmit", submission);

        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onPicked).not.toHaveBeenCalled();
    });

    it("stops listening once unmounted", () => {
        const { fromPicker, unmount, onPicked } = setup();

        unmount();
        fromPicker("whereby:formSubmit", submission);

        expect(onPicked).not.toHaveBeenCalled();
    });

    // going headless hands the consumer the element, and with it two ways to break the hook into
    // a frame that loads and then silently does nothing
    describe("development warnings", () => {
        function warnings() {
            const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
            return {
                warn,
                messages: () => warn.mock.calls.map(([message]) => String(message)),
            };
        }

        it("warns when iframeProps.ref was never attached", () => {
            jest.useFakeTimers();
            const { warn, messages } = warnings();

            function Forgetful() {
                const { iframeProps } = useRoomIntegrationPicker({ integration, onPicked: jest.fn() });
                // the mistake this guards against: rendering the frame but not spreading the props
                return iframeProps ? <iframe src={iframeProps.src} /> : null;
            }
            render(<Forgetful />);
            act(() => {
                jest.advanceTimersByTime(0);
            });

            expect(messages().some((message) => /ref was never attached/.test(message))).toBe(true);
            warn.mockRestore();
            jest.useRealTimers();
        });

        it("warns when the frame has a sandbox attribute", () => {
            jest.useFakeTimers();
            const { warn, messages } = warnings();

            function Sandboxed() {
                const { iframeProps } = useRoomIntegrationPicker({ integration, onPicked: jest.fn() });
                return iframeProps ? <iframe {...iframeProps} sandbox="allow-scripts" /> : null;
            }
            render(<Sandboxed />);
            act(() => {
                jest.advanceTimersByTime(0);
            });

            expect(messages().some((message) => /sandbox/.test(message))).toBe(true);
            warn.mockRestore();
            jest.useRealTimers();
        });

        it("stays quiet when the frame is wired up correctly", () => {
            jest.useFakeTimers();
            const { warn, messages } = warnings();

            render(<Harness integration={integration} onPicked={jest.fn()} />);
            act(() => {
                jest.advanceTimersByTime(0);
            });

            expect(messages()).toEqual([]);
            warn.mockRestore();
            jest.useRealTimers();
        });
    });

    it("renders nothing for an integration with an unusable webview url", () => {
        jest.spyOn(console, "warn").mockImplementation(() => {});
        const { container } = setup({ integration: { ...integration, webview: "not a url" } });

        expect(container.querySelector("iframe")).toBeNull();
        (console.warn as jest.Mock).mockRestore();
    });
});
