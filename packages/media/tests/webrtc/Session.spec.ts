import { CustomMediaStreamTrack, Session } from "../../src";
import { trackAnnotations } from "../../src/utils/annotations";
import { createMockedMediaStream } from "./webRtcHelpers";

class RtcPeerConnection {
    addEventListener = jest.fn();
    getSenders = jest.fn().mockReturnValue([]);
    addTrack = jest.fn();
}

describe("Session", () => {
    const mockRTCRtpSender = {
        prototype: {
            replaceTrack: jest.fn(),
        },
    } as unknown as RTCRtpSender;

    // @ts-ignore
    window.RTCRtpSender = mockRTCRtpSender;
    const peerConnectionId = "id";
    const clientId = "id";
    let session: Session;
    let bandwidth: number;
    let peerConnectionConfig: RTCConfiguration;

    beforeEach(() => {
        // @ts-ignore
        window.globalThis.RTCPeerConnection = RtcPeerConnection;
        bandwidth = 1;
        peerConnectionConfig = {};
        session = new Session({
            peerConnectionId,
            clientId,
            peerConnectionConfig,
            bandwidth,
            deprioritizeH264Encoding: false,
            shouldAddLocalVideo: false,
            incrementAnalyticMetric: jest.fn(),
        });
    });

    describe("Constructor", () => {
        it("should create RTCPeerConnection", () => {
            expect(session.pc).toBeInstanceOf(RtcPeerConnection);
        });
    });

    describe("ReplaceTrack", () => {
        it("Should add newTrack instead of replacing if oldTrack is undefined", () => {
            const tracksAddedToPC = [] as CustomMediaStreamTrack[];
            const newTrack = { id: "newId" } as CustomMediaStreamTrack;
            const pc = {
                getSenders: () => [],
                addTrack: (track: CustomMediaStreamTrack) => tracksAddedToPC.push(track),
            };
            // @ts-ignore
            session.pc = pc;

            const spyAddTrack = jest.spyOn(pc, "addTrack");
            const stream = createMockedMediaStream() as unknown as MediaStream;
            session.streams.push(stream);

            session.replaceTrack(undefined, newTrack);

            expect(tracksAddedToPC.includes(newTrack)).toBe(true);
            expect(spyAddTrack).toHaveBeenCalledWith(newTrack, stream);
        });

        it("Should replace any non-screenshare track of same kind if oldTrack is not found in RTPSender", () => {
            const tracksAddedToPC = [] as CustomMediaStreamTrack[];
            const oldTrack = { id: "oldId" } as CustomMediaStreamTrack;
            const nonScreenshareTrackOfSameKind = { id: "otherId" } as CustomMediaStreamTrack;
            const newTrack = { id: "newId" } as CustomMediaStreamTrack;
            const sender = {
                track: nonScreenshareTrackOfSameKind,
                replaceTrack: (track: CustomMediaStreamTrack) => tracksAddedToPC.push(track),
            } as unknown as RTCRtpSender;
            const replaceTrackSpy = jest.spyOn(sender, "replaceTrack");
            session.pc = {
                getSenders: () => [sender],
                // @ts-ignore
                addTrack: (track: CustomMediaStreamTrack) => tracksAddedToPC.push(track),
            };
            session.streams.push(createMockedMediaStream() as unknown as MediaStream);

            session.replaceTrack(oldTrack, newTrack);

            expect(tracksAddedToPC.includes(newTrack)).toBe(true);
            expect(replaceTrackSpy).toHaveBeenLastCalledWith(newTrack);
        });

        it("Should not replace any screenshare track of same kind if oldTrack is not found in RTPSender", () => {
            const tracksAddedToPC = [] as CustomMediaStreamTrack[];
            const oldTrack = { id: "oldId" } as CustomMediaStreamTrack;

            // Create and annotate screenshare track.
            const screenshareTrackOfSameKind = { id: "otherId" } as CustomMediaStreamTrack;
            trackAnnotations(screenshareTrackOfSameKind).sourceKind = "screenshare";

            const newTrack = { id: "newId" } as CustomMediaStreamTrack;
            const sender = {
                track: screenshareTrackOfSameKind,
                replaceTrack: (track: CustomMediaStreamTrack) => tracksAddedToPC.push(track),
            };
            const replaceTrackSpy = jest.spyOn(sender, "replaceTrack");
            const pc = {
                getSenders: () => [sender],
                addTrack: (track: CustomMediaStreamTrack) => tracksAddedToPC.push(track),
            };
            const addTrackSpy = jest.spyOn(pc, "addTrack");
            const stream = createMockedMediaStream() as unknown as MediaStream;
            stream.addTrack(newTrack);
            // @ts-ignore
            session.pc = pc;
            session.streams.push(stream);

            session.replaceTrack(oldTrack, newTrack);

            expect(tracksAddedToPC.includes(newTrack)).toBe(true);
            expect(addTrackSpy).toHaveBeenLastCalledWith(newTrack, stream);
            expect(replaceTrackSpy).not.toHaveBeenCalled();
        });

        it("Should replace oldTrack if it's found in RTPSender", () => {
            const tracksAddedToPC = [] as CustomMediaStreamTrack[];
            const oldTrack = { id: "oldId" } as CustomMediaStreamTrack;
            const newTrack = { id: "newId" } as CustomMediaStreamTrack;
            const sender = {
                track: oldTrack,
                replaceTrack: (track: CustomMediaStreamTrack) => tracksAddedToPC.push(track),
            } as unknown as RTCRtpSender;
            const replaceTrackSpy = jest.spyOn(sender, "replaceTrack");
            session.pc = {
                getSenders: () => [sender],
                // @ts-ignore
                addTrack: (track: CustomMediaStreamTrack) => tracksAddedToPC.push(track),
            };
            session.streams.push(createMockedMediaStream() as unknown as MediaStream);

            session.replaceTrack(oldTrack, newTrack);

            expect(tracksAddedToPC.includes(newTrack)).toBe(true);
            expect(replaceTrackSpy).toHaveBeenLastCalledWith(newTrack);
        });
    });
});
