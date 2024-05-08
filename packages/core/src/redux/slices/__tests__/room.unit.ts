import { roomSlice, selectScreenshares } from "../room";
import { signalEvents } from "../signalConnection/actions";
import { randomRemoteParticipant, randomMediaStream } from "../../../__mocks__/appMocks";

describe("roomSlice", () => {
    describe("reducers", () => {
        it("signalEvents.roomJoined", () => {
            const result = roomSlice.reducer(
                undefined,
                signalEvents.roomJoined({
                    selfId: "selfId",
                    clientClaim: "clientClaim",
                    isLocked: true,
                }),
            );
            expect(result.isLocked).toEqual(true);
        });

        it("signalEvents.roomLocked", () => {
            const result = roomSlice.reducer(
                undefined,
                signalEvents.roomLocked({
                    isLocked: true,
                }),
            );
            expect(result.isLocked).toEqual(true);
        });
    });

    describe("selectors", () => {
        const client1 = randomRemoteParticipant();
        const client2 = randomRemoteParticipant({
            presentationStream: randomMediaStream(),
        });
        const client3 = randomRemoteParticipant({
            presentationStream: randomMediaStream(),
        });

        describe("selectScreenshares", () => {
            const localScreenshareStream = randomMediaStream();

            it.each`
                localScreenshareStream    | remoteParticipants    | expected
                ${null}                   | ${[]}                 | ${[]}
                ${null}                   | ${[client1, client2]} | ${[{ id: `pres-${client2.id}`, hasAudioTrack: false, isLocal: false, participantId: client2.id, stream: client2.presentationStream }]}
                ${localScreenshareStream} | ${[]}                 | ${[{ id: "local-screenshare", hasAudioTrack: false, isLocal: true, participantId: "local", stream: localScreenshareStream }]}
                ${localScreenshareStream} | ${[client3]}          | ${[{ id: "local-screenshare", hasAudioTrack: false, isLocal: true, participantId: "local", stream: localScreenshareStream }, { id: `pres-${client3.id}`, hasAudioTrack: false, isLocal: false, participantId: client3.id, stream: client3.presentationStream }]}
            `(
                "should return $expected when localScreenshareStream=$localScreenshareStream, remoteParticipants=$remoteParticipants",
                ({ localScreenshareStream, remoteParticipants, expected }) => {
                    expect(selectScreenshares.resultFunc(localScreenshareStream, remoteParticipants)).toEqual(expected);
                },
            );
        });
    });
});
