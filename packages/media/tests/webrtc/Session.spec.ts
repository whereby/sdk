import { CustomMediaStreamTrack, Session } from "../../src";
import { createMockedMediaStream } from "./webRtcHelpers";

describe("Session", () => {
    const mockRTCRtpSender = {
        prototype: {
            replaceTrack: jest.fn(),
        },
    } as unknown as RTCRtpSender;

    // @ts-ignore
    window.RTCRtpSender = mockRTCRtpSender;
    const peerConnectionId = "id";
    let session: Session;
    let bandwidth: number;

    beforeEach(() => {
        bandwidth = 1;
        session = new Session({
            peerConnectionId,
            bandwidth,
            deprioritizeH264Encoding: false,
            incrementAnalyticMetric: jest.fn(),
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

            session.pc = pc;
            const spyAddTrack = jest.spyOn(pc, "addTrack");
            const stream = createMockedMediaStream();
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
            };
            const replaceTrackSpy = jest.spyOn(sender, "replaceTrack");
            session.pc = {
                getSenders: () => [sender],
                addTrack: (track: CustomMediaStreamTrack) => tracksAddedToPC.push(track),
            };
            session.streams.push(createMockedMediaStream());

            session.replaceTrack(oldTrack, newTrack);

            expect(tracksAddedToPC.includes(newTrack)).toBe(true);
            expect(replaceTrackSpy).toHaveBeenLastCalledWith(newTrack);
        });

        it("Should not replace any screenshare track of same kind if oldTrack is not found in RTPSender", () => {
            const tracksAddedToPC = [] as CustomMediaStreamTrack[];
            const oldTrack = { id: "oldId" } as CustomMediaStreamTrack;
            const screenshareTrackOfSameKind = { id: "otherId", sourceKind: "screenshare" } as CustomMediaStreamTrack;
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
            const stream = createMockedMediaStream();
            stream.addTrack(newTrack);
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
            };
            const replaceTrackSpy = jest.spyOn(sender, "replaceTrack");
            session.pc = {
                getSenders: () => [sender],
                addTrack: (track: CustomMediaStreamTrack) => tracksAddedToPC.push(track),
            };
            session.streams.push(createMockedMediaStream());

            session.replaceTrack(oldTrack, newTrack);

            expect(tracksAddedToPC.includes(newTrack)).toBe(true);
            expect(replaceTrackSpy).toHaveBeenLastCalledWith(newTrack);
        });
    });
});
