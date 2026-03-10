import { Session } from "../../src";
import { trackAnnotations } from "../../src/utils/annotations";
import * as helpers from "./webRtcHelpers";

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
            incrementAnalyticMetric: jest.fn(),
            audioOnlyMode: "off",
        });
    });

    describe("Constructor", () => {
        it("should create RTCPeerConnection", () => {
            expect(session.pc).toBeInstanceOf(RtcPeerConnection);
        });
    });

    describe("ReplaceTrack", () => {
        it("Should add newTrack instead of replacing if oldTrack is undefined", () => {
            const tracksAddedToPC: MediaStreamTrack[] = [];
            const newTrack = helpers.createMockedMediaStreamTrack({ id: "id", kind: "video" });
            const pc = {
                getSenders: () => [],
                addTrack: (track: MediaStreamTrack) => tracksAddedToPC.push(track),
            };
            // @ts-ignore
            session.pc = pc;

            const spyAddTrack = jest.spyOn(pc, "addTrack");
            const stream = helpers.createMockedMediaStream();
            session.streams.push(stream);

            session.replaceTrack(undefined, newTrack);

            expect(tracksAddedToPC.includes(newTrack)).toBe(true);
            expect(spyAddTrack).toHaveBeenCalledWith(newTrack, stream);
        });

        it("Should replace any non-screenshare track of same kind if oldTrack is not found in RTPSender", () => {
            const tracksAddedToPC: MediaStreamTrack[] = [];
            const oldTrack = helpers.createMockedMediaStreamTrack({ id: "oldId", kind: "video" });
            const nonScreenshareTrackOfSameKind = helpers.createMockedMediaStreamTrack({
                id: "otherId",
                kind: "video",
            });
            const newTrack = helpers.createMockedMediaStreamTrack({ id: "newId", kind: "video" });

            const sender = {
                track: nonScreenshareTrackOfSameKind,
                replaceTrack: (track: MediaStreamTrack) => tracksAddedToPC.push(track),
            } as unknown as RTCRtpSender;
            const replaceTrackSpy = jest.spyOn(sender, "replaceTrack");
            session.pc = {
                getSenders: () => [sender],
                // @ts-ignore
                addTrack: (track) => tracksAddedToPC.push(track),
            };
            session.streams.push(helpers.createMockedMediaStream());

            session.replaceTrack(oldTrack, newTrack);

            expect(tracksAddedToPC.includes(newTrack)).toBe(true);
            expect(replaceTrackSpy).toHaveBeenLastCalledWith(newTrack);
        });

        it("Should not replace any screenshare track of same kind if oldTrack is not found in RTPSender", () => {
            const tracksAddedToPC: MediaStreamTrack[] = [];
            const oldTrack = helpers.createMockedMediaStreamTrack({ id: "oldId", kind: "video" });

            // Create and annotate screenshare track.
            const screenshareTrackOfSameKind = helpers.createMockedMediaStreamTrack({ id: "otherId", kind: "video" });
            trackAnnotations(screenshareTrackOfSameKind).fromGetDisplayMedia = true;

            const newTrack = helpers.createMockedMediaStreamTrack({ id: "newId", kind: "video" });
            const sender = {
                track: screenshareTrackOfSameKind,
                replaceTrack: (track: MediaStreamTrack) => tracksAddedToPC.push(track),
            };
            const replaceTrackSpy = jest.spyOn(sender, "replaceTrack");
            const pc = {
                getSenders: () => [sender],
                addTrack: (track: MediaStreamTrack) => tracksAddedToPC.push(track),
            };
            const addTrackSpy = jest.spyOn(pc, "addTrack");
            const stream = helpers.createMockedMediaStream();
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
            const tracksAddedToPC: MediaStreamTrack[] = [];
            const oldTrack = helpers.createMockedMediaStreamTrack({ id: "oldId", kind: "video" });
            const newTrack = helpers.createMockedMediaStreamTrack({ id: "newId", kind: "video" });
            const sender = {
                track: oldTrack,
                replaceTrack: (track: MediaStreamTrack) => tracksAddedToPC.push(track),
            } as unknown as RTCRtpSender;
            const replaceTrackSpy = jest.spyOn(sender, "replaceTrack");
            session.pc = {
                getSenders: () => [sender],
                // @ts-ignore
                addTrack: (track: MediaStreamTrack) => tracksAddedToPC.push(track),
            };
            session.streams.push(helpers.createMockedMediaStream());

            session.replaceTrack(oldTrack, newTrack);

            expect(tracksAddedToPC.includes(newTrack)).toBe(true);
            expect(replaceTrackSpy).toHaveBeenLastCalledWith(newTrack);
        });
    });
});
