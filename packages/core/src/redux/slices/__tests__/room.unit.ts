import { SignalRoom } from "@whereby.com/media";
import { roomSlice, roomSliceInitialState, selectRemoteScreenshareVideoTrackIds, selectScreenshares } from "../room";
import { signalEvents } from "../signalConnection/actions";
import { randomRemoteParticipant, randomMediaStream, randomLocalParticipant } from "../../../__mocks__/appMocks";
import { Screenshare } from "../../../RoomParticipant";

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
                                iceServers: {
                                    iceServers: [],
                                },
                                mediaserverConfigTtlSeconds: 0,
                                name: "",
                                organizationId: "",
                                turnServers: [],
                            },
                        }),
                    );
                    expect(result.isLocked).toEqual(true);
                });

                describe("room mode", () => {
                    const roomJoined = (room: Partial<SignalRoom>) =>
                        roomSlice.reducer(
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
                                    isLocked: false,
                                    iceServers: { iceServers: [] },
                                    mediaserverConfigTtlSeconds: 0,
                                    name: "",
                                    organizationId: "",
                                    turnServers: [],
                                    ...room,
                                },
                            }),
                        );

                    it("should use the room mode", () => {
                        expect(roomJoined({ mode: "group" }).mode).toEqual("group");
                        expect(roomJoined({ mode: "normal" }).mode).toEqual("normal");
                    });

                    it("should fall back to the presence of an sfu server", () => {
                        expect(
                            roomJoined({
                                mode: undefined as unknown as SignalRoom["mode"],
                                sfuServer: { url: "" } as SignalRoom["sfuServer"],
                            }).mode,
                        ).toEqual("group");
                        expect(roomJoined({ mode: undefined as unknown as SignalRoom["mode"] }).mode).toEqual("normal");
                    });
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

        describe("selectRemoteScreenshareVideoTrackIds", () => {
            const createScreenshare = ({ isLocal, trackIds }: { isLocal: boolean; trackIds: string[] }) => {
                const stream = randomMediaStream();
                trackIds.forEach((id) => stream.addTrack({ id, kind: "video" } as MediaStreamTrack));
                stream.addTrack({ id: `${trackIds[0]}-audio`, kind: "audio" } as MediaStreamTrack);

                return { id: stream.id, participantId: "p", hasAudioTrack: true, isLocal, stream } as Screenshare;
            };

            it("should return the video track ids of remote screenshares only", () => {
                const screenshares = [
                    createScreenshare({ isLocal: true, trackIds: ["local-video"] }),
                    createScreenshare({ isLocal: false, trackIds: ["remote-video-1"] }),
                    createScreenshare({ isLocal: false, trackIds: ["remote-video-2"] }),
                ];

                expect(selectRemoteScreenshareVideoTrackIds.resultFunc(screenshares)).toEqual([
                    "remote-video-1",
                    "remote-video-2",
                ]);
            });

            it("should return the same array when the track ids have not changed", () => {
                const remoteScreenshare = createScreenshare({ isLocal: false, trackIds: ["remote-video"] });

                const first = selectRemoteScreenshareVideoTrackIds.memoizedResultFunc([remoteScreenshare]);
                const second = selectRemoteScreenshareVideoTrackIds.memoizedResultFunc([{ ...remoteScreenshare }]);

                expect(second).toBe(first);
            });
        });
    });
});
