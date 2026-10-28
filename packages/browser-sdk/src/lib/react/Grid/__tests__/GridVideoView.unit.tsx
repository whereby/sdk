import * as React from "react";
import { act, render } from "@testing-library/react";

import { ClientView } from "@whereby.com/core";
import { GridVideoView } from "..";
import { GridCellContext, GridContext } from "../GridContext";

const participant: ClientView = {
    id: "remote-1",
    clientId: "remote-1",
    displayName: "Remote",
    isLocalClient: false,
    isAudioEnabled: true,
    isVideoEnabled: true,
    stream: { id: "stream-1" } as MediaStream,
};

function renderGridVideoView() {
    const onSetClientAspectRatio = jest.fn();

    function Harness() {
        const [clientAspectRatios, setClientAspectRatios] = React.useState<{ [key: string]: number }>({});
        const handleSetClientAspectRatio = React.useCallback(
            ({ aspectRatio, clientId }: { aspectRatio: number; clientId: string }) => {
                onSetClientAspectRatio({ aspectRatio, clientId });
                setClientAspectRatios((prev) => ({ ...prev, [clientId]: aspectRatio }));
            },
            [],
        );

        return (
            <GridContext.Provider
                value={
                    {
                        onSetClientAspectRatio: handleSetClientAspectRatio,
                        clientAspectRatios,
                    } as unknown as React.ContextType<typeof GridContext>
                }
            >
                <GridCellContext.Provider value={{ participant, isHovered: false }}>
                    <GridVideoView />
                </GridCellContext.Provider>
            </GridContext.Provider>
        );
    }

    const { container } = render(<Harness />);
    const video = container.querySelector("video")!;

    const setVideoSize = (width: number, height: number) => {
        Object.defineProperty(video, "videoWidth", { value: width, configurable: true });
        Object.defineProperty(video, "videoHeight", { value: height, configurable: true });
        act(() => {
            video.dispatchEvent(new Event("resize"));
        });
    };

    return { onSetClientAspectRatio, setVideoSize };
}

describe("GridVideoView", () => {
    const originalResizeObserver = global.ResizeObserver;

    beforeAll(() => {
        global.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        } as unknown as typeof ResizeObserver;
    });

    afterAll(() => {
        global.ResizeObserver = originalResizeObserver;
    });

    it("stores the aspect ratio once the first frame arrives", () => {
        const { onSetClientAspectRatio, setVideoSize } = renderGridVideoView();

        setVideoSize(1280, 720);

        expect(onSetClientAspectRatio).toHaveBeenCalledWith({ aspectRatio: 1280 / 720, clientId: "remote-1" });
    });

    it("updates the aspect ratio when the camera rotates", () => {
        const { onSetClientAspectRatio, setVideoSize } = renderGridVideoView();

        setVideoSize(720, 1280);
        setVideoSize(1280, 720);

        expect(onSetClientAspectRatio).toHaveBeenLastCalledWith({ aspectRatio: 1280 / 720, clientId: "remote-1" });
    });

    it("doesn't store the aspect ratio again when it hasn't changed", () => {
        const { onSetClientAspectRatio, setVideoSize } = renderGridVideoView();

        setVideoSize(1280, 720);
        setVideoSize(640, 360);

        expect(onSetClientAspectRatio).toHaveBeenCalledTimes(1);
    });
});
