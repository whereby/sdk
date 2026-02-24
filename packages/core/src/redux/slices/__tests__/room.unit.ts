import { roomSlice, roomSliceInitialState, selectScreenshares } from "../room";
import { signalEvents } from "../signalConnection/actions";
import { randomRemoteParticipant, randomMediaStream, randomLocalParticipant } from "../../../__mocks__/appMocks";
import { SignalRoom } from "@whereby.com/media";

describe("roomSlice", () => {
    describe("reducers", () => {
        describe("signalEvents.roomJoined", () => {
            describe("on error", () => {
                it("should return default state", () => {
                    const result = roomSlice.reducer(
                        undefined,
                        signalEvents.roomJoined({
                            error: "internal_server_error",
                        }),
                    );
                    expect(result).toEqual(roomSliceInitialState);
                });
            });

            describe("on success", () => {
                it("should update state", () => {
                    const result = roomSlice.reducer(
                        undefined,
                        signalEvents.roomJoined({
                            selfId: "selfId",
                            breakoutGroup: "",
                            clientClaim: "clientClaim",
                            eventClaim: "",
                            room: {
                                mode: "normal",
                                clients: [],
                                knockers: [],
                                spotlights: [],
                                session: null,
                                isClaimed: true,
                                isLocked: true,
                            } as unknown as SignalRoom,
                        }),
                    );
                    expect(result.isLocked).toEqual(true);
                });
            });
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
            breakoutGroup: "a",
        });

        describe("selectScreenshares", () => {
            const breakoutGroup = "b";
            const localParticipant = randomLocalParticipant({
                roleName: "viewer",
                breakoutGroup,
            });

            const localScreenshareStream = randomMediaStream();

            it.each`
                localScreenshareStream    | remoteParticipants    | expected
                ${null}                   | ${[]}                 | ${[]}
                ${null}                   | ${[client1, client2]} | ${[{ id: `pres-${client2.id}`, hasAudioTrack: false, breakoutGroup: null, isLocal: false, participantId: client2.id, stream: client2.presentationStream }]}
                ${localScreenshareStream} | ${[]}                 | ${[{ id: "local-screenshare", hasAudioTrack: false, breakoutGroup, isLocal: true, participantId: "local", stream: localScreenshareStream }]}
                ${localScreenshareStream} | ${[client3]}          | ${[{ id: "local-screenshare", hasAudioTrack: false, breakoutGroup, isLocal: true, participantId: "local", stream: localScreenshareStream }, { id: `pres-${client3.id}`, hasAudioTrack: false, breakoutGroup: "a", isLocal: false, participantId: client3.id, stream: client3.presentationStream }]}
            `(
                "should return $expected when localScreenshareStream=$localScreenshareStream, remoteParticipants=$remoteParticipants",
                ({ localScreenshareStream, remoteParticipants, expected }) => {
                    expect(
                        selectScreenshares.resultFunc(localScreenshareStream, localParticipant, remoteParticipants),
                    ).toEqual(expected);
                },
            );
        });
    });
});
