import * as React from "react";

import { ClientView, WherebyClient } from "@whereby.com/core";
import { WherebyContext } from "../../lib/react/Provider";
import { NAMES, sampleNameForIndex } from "./VideoGridTestData";

const COLORS = ["#4a90d9", "#d94a6a", "#4ad98f", "#d9b34a", "#8f4ad9", "#4ad9d9", "#d97a4a", "#7ad94a"];

type FakeStream = MediaStream & { __stopDrawing?: () => void };

function createFakeVideoStream(label: string, color: string): FakeStream {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d")!;

    const start = performance.now();
    const draw = () => {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Moving dot so the stream is visibly live
        const t = (performance.now() - start) / 1000;
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.beginPath();
        ctx.arc(320 + Math.cos(t) * 200, 240 + Math.sin(t) * 120, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 40px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    };

    draw();
    const interval = setInterval(draw, 100);
    const stream = canvas.captureStream(10) as FakeStream;
    stream.__stopDrawing = () => clearInterval(interval);
    return stream;
}

function makeFakeParticipants({ count, videosOff }: { count: number; videosOff: number }): ClientView[] {
    return Array.from({ length: count }, (_, i): ClientView => {
        const displayName = `${sampleNameForIndex(i)}${i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ""}`;
        const isVideoEnabled = i < count - videosOff;

        return {
            id: `fake-${i}`,
            clientId: `fake-${i}`,
            displayName,
            isLocalClient: i === 0,
            isAudioEnabled: i % 2 === 0,
            isVideoEnabled,
            stream: isVideoEnabled ? createFakeVideoStream(displayName, COLORS[i % COLORS.length]) : null,
        };
    });
}

function stopFakeParticipants(participants: ClientView[]) {
    participants.forEach((p) => {
        (p.stream as FakeStream | null)?.__stopDrawing?.();
        p.stream?.getTracks().forEach((t) => t.stop());
    });
}

/**
 * Implements the subset of GridClient the Grid component tree uses
 * (useGridParticipants + ParticipantMenu), backed by fake participants
 * instead of a room connection.
 */
export class FakeGridClient {
    private clientViews: ClientView[] = [];
    private spotlighted: ClientView[] = [];
    private clientViewSubscribers = new Set<(clientViews: ClientView[]) => void>();
    private spotlightedSubscribers = new Set<(spotlighted: ClientView[]) => void>();
    private numberOfClientViewsSubscribers = new Set<(num: number) => void>();

    public setClientViews(clientViews: ClientView[]) {
        this.clientViews = clientViews;
        // Re-map spotlights to the new view objects (subgrid calculation relies on identity)
        this.spotlighted = this.spotlighted
            .map((s) => clientViews.find((c) => c.id === s.id))
            .filter((c): c is ClientView => Boolean(c));
        this.emit();
    }

    private emit() {
        this.clientViewSubscribers.forEach((cb) => cb(this.clientViews));
        this.spotlightedSubscribers.forEach((cb) => cb(this.spotlighted));
        this.numberOfClientViewsSubscribers.forEach((cb) => cb(this.clientViews.length));
    }

    public subscribeClientViews(callback: (clientViews: ClientView[]) => void): () => void {
        this.clientViewSubscribers.add(callback);
        callback(this.clientViews);
        return () => this.clientViewSubscribers.delete(callback);
    }

    public subscribeSpotlightedParticipants(callback: (spotlighted: ClientView[]) => void): () => void {
        this.spotlightedSubscribers.add(callback);
        callback(this.spotlighted);
        return () => this.spotlightedSubscribers.delete(callback);
    }

    public subscribeNumberOfClientViews(callback: (num: number) => void): () => void {
        this.numberOfClientViewsSubscribers.add(callback);
        callback(this.clientViews.length);
        return () => this.numberOfClientViewsSubscribers.delete(callback);
    }

    public spotlightParticipant(id: string) {
        const view = this.clientViews.find((c) => c.id === id);
        if (view && !this.spotlighted.includes(view)) {
            this.spotlighted = [...this.spotlighted, view];
            this.emit();
        }
    }

    public removeSpotlight(id: string) {
        this.spotlighted = this.spotlighted.filter((c) => c.id !== id);
        this.emit();
    }
}

/**
 * Provides a WherebyContext backed by fake participants, letting the Grid
 * render (including subgrid behaviour) without joining a room.
 */
export function FakeParticipantsProvider({
    numParticipants,
    numVideosOff,
    children,
}: {
    numParticipants: number;
    numVideosOff: number;
    children: React.ReactNode;
}) {
    const fakeGrid = React.useMemo(() => new FakeGridClient(), []);
    const fakeClient = React.useMemo(
        () =>
            ({
                getGrid: () => fakeGrid,
                // VideoView reports stream resolutions through the room connection — no-op here
                getRoomConnection: () => ({ reportStreamResolution: () => {} }),
                // useAudioElement tracks the current speaker device — static stub
                getLocalMedia: () => ({
                    getState: () => ({ currentSpeakerDeviceId: "default" }),
                    addListener: () => {},
                    removeListener: () => {},
                }),
            }) as unknown as WherebyClient,
        [fakeGrid],
    );

    React.useEffect(() => {
        const participants = makeFakeParticipants({
            count: numParticipants,
            videosOff: Math.min(numVideosOff, numParticipants),
        });
        fakeGrid.setClientViews(participants);

        return () => stopFakeParticipants(participants);
    }, [fakeGrid, numParticipants, numVideosOff]);

    return <WherebyContext.Provider value={fakeClient}>{children}</WherebyContext.Provider>;
}
