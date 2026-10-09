import * as React from "react";
import { render, act, waitFor } from "@testing-library/react";
import { RoomIntegrationSessionView } from "@whereby.com/core";

import { useRoomIntegrationView, UseRoomIntegrationViewOptions } from "..";
import { WherebyContext } from "../../Provider";

interface Handle {
    getVolume: () => Promise<number>;
    setVolume: (volume: number) => void;
}

function Harness({ handleRef, ...options }: UseRoomIntegrationViewOptions & { handleRef?: React.Ref<Handle> }) {
    const { iframeProps, getVolume, setVolume } = useRoomIntegrationView(options);

    React.useImperativeHandle(handleRef, () => ({ getVolume, setVolume }), [getVolume, setVolume]);

    return iframeProps ? <iframe {...iframeProps} /> : null;
}

const WEBVIEW = "https://integrations.whereby.dev/youtube/index.2ad4b051.html";
const FRAME_ORIGIN = "https://integrations.whereby.dev";

const session: RoomIntegrationSessionView = {
    roomIntegrationSessionId: "session-1",
    roomIntegrationId: "5",
    breakoutGroupId: "",
    tagName: "youtube-integration-contentframe",
    shareUrl: "https://youtu.be/dQw4w9WgXcQ",
    props: { videoref: "dQw4w9WgXcQ", seek: 0, paused: false },
    clientId: "client-1",
    roomIntegrationSessionStartedAt: null,
    isPresenter: true,
    presenterDisplayName: null,
    canStop: true,
    integration: {
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
    },
};

function setup(overrides: Partial<UseRoomIntegrationViewOptions> = {}) {
    const roomConnection = {
        updateRoomIntegrationProps: jest.fn(),
        stopRoomIntegration: jest.fn(),
    };
    const client = { getRoomConnection: () => roomConnection } as never;
    const ref = React.createRef<Handle>();

    const utils = render(
        <WherebyContext.Provider value={client}>
            <Harness handleRef={ref} session={session} {...overrides} />
        </WherebyContext.Provider>,
    );

    const iframe = utils.container.querySelector("iframe") as HTMLIFrameElement;
    const postMessage = jest.fn();
    Object.defineProperty(iframe, "contentWindow", { value: { postMessage }, configurable: true });

    const fromFrame = (type: string, payload?: unknown, origin = FRAME_ORIGIN) =>
        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", { data: { type, payload }, origin, source: iframe.contentWindow }),
            );
        });

    const sent = (type: string) =>
        postMessage.mock.calls.map(([message]) => message).filter((message) => message.type === type);

    return { ...utils, iframe, postMessage, fromFrame, sent, roomConnection, ref };
}

describe("useRoomIntegrationView", () => {
    it("points the iframe at the webview with the parent origin and session id", () => {
        const { iframe } = setup();
        const url = new URL(iframe.src);

        expect(url.origin + url.pathname).toEqual(WEBVIEW);
        expect(url.searchParams.get("parentOrigin")).toEqual(window.location.origin);
        expect(url.searchParams.get("roomintegrationsessionid")).toEqual("session-1");
    });

    it("sends the full prop set once the frame announces itself", () => {
        const { fromFrame, sent } = setup();

        fromFrame("whereby:frameReady");

        expect(sent("whereby:props")).toHaveLength(1);
        expect(sent("whereby:props")[0].payload).toEqual(
            expect.objectContaining({ videoref: "dQw4w9WgXcQ", seek: 0, paused: false }),
        );
    });

    it("injects ispresenter, which the signal server does not send", () => {
        const { fromFrame, sent } = setup();

        fromFrame("whereby:frameReady");

        expect(sent("whereby:props")[0].payload).toEqual(
            expect.objectContaining({
                ispresenter: true,
                roomintegrationsessionid: "session-1",
                breakoutgroupid: "",
            }),
        );
    });

    it("does not post before the frame is ready", () => {
        const { postMessage } = setup();
        expect(postMessage).not.toHaveBeenCalled();
    });

    it("sends only changed props on update, so unchanged values are not re-applied", () => {
        const { fromFrame, sent, rerender } = setup();
        fromFrame("whereby:frameReady");

        const client = { getRoomConnection: () => ({}) } as never;
        rerender(
            <WherebyContext.Provider value={client}>
                <Harness session={{ ...session, props: { ...session.props, paused: true } }} />
            </WherebyContext.Provider>,
        );

        const updates = sent("whereby:props");
        expect(updates).toHaveLength(2);
        expect(updates[1].payload).toEqual({ paused: true });
    });

    it("forwards updateProps from the frame to the room", () => {
        const { fromFrame, roomConnection } = setup();

        fromFrame("whereby:updateProps", { props: { paused: true, seek: 12 } });

        expect(roomConnection.updateRoomIntegrationProps).toHaveBeenCalledWith({
            roomIntegrationSessionId: "session-1",
            props: { paused: true, seek: 12 },
        });
    });

    it("stops the integration when the frame closes itself", () => {
        const { fromFrame, roomConnection } = setup();

        fromFrame("whereby:close");

        expect(roomConnection.stopRoomIntegration).toHaveBeenCalledWith({
            roomIntegrationSessionId: "session-1",
            intent: "end",
        });
    });

    it("does not ask to stop when the local participant is not allowed to", () => {
        const { fromFrame, roomConnection } = setup({ session: { ...session, canStop: false } });

        fromFrame("whereby:close");

        expect(roomConnection.stopRoomIntegration).not.toHaveBeenCalled();
    });

    it("surfaces audio override requests", () => {
        const onAudioOverride = jest.fn();
        const { fromFrame } = setup({ onAudioOverride });

        fromFrame("whereby:audioOverride", { enabled: false });
        expect(onAudioOverride).toHaveBeenCalledWith(false);

        fromFrame("whereby:audioOverride", { enabled: null });
        expect(onAudioOverride).toHaveBeenCalledWith(null);
    });

    it("surfaces content ready", () => {
        const onContentReady = jest.fn();
        const { fromFrame } = setup({ onContentReady });

        fromFrame("whereby:contentReady");

        expect(onContentReady).toHaveBeenCalled();
    });

    it("ignores messages from another origin", () => {
        const { fromFrame, roomConnection } = setup();

        fromFrame("whereby:close", undefined, "https://evil.example.com");

        expect(roomConnection.stopRoomIntegration).not.toHaveBeenCalled();
    });

    it("ignores messages from a window that is not the frame", () => {
        const { roomConnection } = setup();

        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: "whereby:close" },
                    origin: FRAME_ORIGIN,
                    source: window,
                }),
            );
        });

        expect(roomConnection.stopRoomIntegration).not.toHaveBeenCalled();
    });

    it("resolves getVolume with the frame's answer", async () => {
        const { ref, sent, fromFrame } = setup();

        const pending = ref.current!.getVolume();
        const [request] = sent("whereby:getVolume");
        fromFrame("whereby:volume", { requestId: request.payload.requestId, volume: 0.4 });

        await expect(pending).resolves.toEqual(0.4);
    });

    it("rejects getVolume when the frame never answers", async () => {
        jest.useFakeTimers();
        const { ref } = setup();

        const pending = ref.current!.getVolume();
        const assertion = expect(pending).rejects.toThrow(/Timed out/);
        await act(async () => {
            jest.advanceTimersByTime(2000);
        });
        await assertion;

        jest.useRealTimers();
    });

    it("sets volume as a message, since it is a property on the element", () => {
        const { ref, sent } = setup();

        act(() => ref.current!.setVolume(0.7));

        expect(sent("whereby:setVolume")[0].payload).toEqual({ volume: 0.7 });
    });

    it("renders nothing when the webview url is unusable", () => {
        jest.spyOn(console, "warn").mockImplementation(() => {});
        const broken = { ...session, integration: { ...session.integration, webview: "not-a-url" } };
        const { container } = render(<Harness session={broken} />);

        expect(container.querySelector("iframe")).toBeNull();
        (console.warn as jest.Mock).mockRestore();
    });

    it("re-sends the full prop set to a frame that reloaded for a new session", async () => {
        const { rerender, container } = setup();

        const client = { getRoomConnection: () => ({}) } as never;
        rerender(
            <WherebyContext.Provider value={client}>
                <Harness session={{ ...session, roomIntegrationSessionId: "session-2" }} />
            </WherebyContext.Provider>,
        );

        const iframe = container.querySelector("iframe") as HTMLIFrameElement;
        expect(new URL(iframe.src).searchParams.get("roomintegrationsessionid")).toEqual("session-2");

        const postMessage = jest.fn();
        Object.defineProperty(iframe, "contentWindow", { value: { postMessage }, configurable: true });
        act(() => {
            window.dispatchEvent(
                new MessageEvent("message", {
                    data: { type: "whereby:frameReady" },
                    origin: FRAME_ORIGIN,
                    source: iframe.contentWindow,
                }),
            );
        });

        await waitFor(() => expect(postMessage).toHaveBeenCalled());
        expect(postMessage.mock.calls[0][0].payload).toEqual(
            expect.objectContaining({ roomintegrationsessionid: "session-2", videoref: "dQw4w9WgXcQ" }),
        );
    });
});
