import { SignalRoom } from "@whereby.com/media";
import {
    doFetchRoom,
    roomSlice,
    setRequestedRoomUrl,
    roomSliceInitialState,
    selectRemoteScreenshareVideoTrackIds,
    selectScreenshares,
} from "../room";
import { appSlice } from "../app";
import { signalEvents } from "../signalConnection/actions";
import { randomRemoteParticipant, randomMediaStream, randomLocalParticipant } from "../../../__mocks__/appMocks";
import { Screenshare } from "../../../RoomParticipant";

describe("roomSlice", () => {
    describe("reducers", () => {
        const inRoomState = { ...roomSliceInitialState, isInRoom: true };

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
                        inRoomState,
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
                    expect(result.lockStateSource).toEqual("signal");
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
                inRoomState,
                signalEvents.roomLocked({
                    isLocked: true,
                }),
            );
            expect(result.isLocked).toEqual(true);
            expect(result.lockStateSource).toEqual("signal");
        });

        it.each`
            event            | action
            ${"room_locked"} | ${signalEvents.roomLocked({ isLocked: true })}
            ${"room_joined"} | ${signalEvents.roomJoined({ error: "room_locked", isClaimed: true, isLocked: true, selfId: "selfId" })}
        `("ignores $event outside a room, as it's from one already left", ({ action }) => {
            expect(roomSlice.reducer(roomSliceInitialState, action)).toBe(roomSliceInitialState);
        });

        it("tracks whether the app is in a room, from joining until leaving", () => {
            const started = roomSlice.reducer(
                roomSliceInitialState,
                appSlice.actions.doAppStart({
                    roomUrl: "https://example.whereby.com/test",
                    displayName: "Guest",
                    roomKey: null,
                    externalId: null,
                }),
            );
            const stopped = roomSlice.reducer(started, appSlice.actions.doAppStop());

            expect(started.isInRoom).toEqual(true);
            expect(stopped.isInRoom).toEqual(false);
        });

        describe("setRequestedRoomUrl", () => {
            const roomUrl = "https://example.whereby.com/test";

            it("keeps the same state when the room url hasn't changed", () => {
                const state = { ...roomSliceInitialState, requestedRoomUrl: roomUrl };

                expect(roomSlice.reducer(state, setRequestedRoomUrl(roomUrl))).toBe(state);
            });

            it("lets a room whose fetch failed be fetched again", () => {
                const result = roomSlice.reducer(
                    { ...roomSliceInitialState, requestedRoomUrl: roomUrl, roomFetchStatus: "failed" },
                    setRequestedRoomUrl(roomUrl),
                );

                expect(result.roomFetchStatus).toEqual("idle");
            });
        });

        describe("doFetchRoom", () => {
            const roomUrl = "https://example.whereby.com/test";

            it("forgets any earlier lock state when a fetch starts", () => {
                const result = roomSlice.reducer(
                    {
                        ...roomSliceInitialState,
                        isLocked: true,
                        lockStateSource: "signal",
                        lockStateRoomUrl: "https://example.whereby.com/other",
                    },
                    doFetchRoom.pending("requestId", roomUrl),
                );

                expect(result).toEqual(
                    expect.objectContaining({
                        isLocked: false,
                        lockStateSource: null,
                        lockStateRoomUrl: roomUrl,
                        roomFetchStatus: "fetching",
                    }),
                );
            });

            it("stores the fetched lock state", () => {
                const result = [
                    doFetchRoom.pending("requestId", roomUrl),
                    doFetchRoom.fulfilled({ isLocked: true }, "requestId", roomUrl),
                ].reduce(roomSlice.reducer, roomSliceInitialState);

                expect(result).toEqual(
                    expect.objectContaining({ isLocked: true, lockStateSource: "fetch", roomFetchStatus: "fetched" }),
                );
            });

            it("has no lock state for a room that doesn't exist", () => {
                const result = [
                    doFetchRoom.pending("requestId", roomUrl),
                    doFetchRoom.fulfilled({ isLocked: null }, "requestId", roomUrl),
                ].reduce(roomSlice.reducer, roomSliceInitialState);

                expect(result).toEqual(expect.objectContaining({ lockStateSource: null, roomFetchStatus: "fetched" }));
            });

            it("records a failed fetch", () => {
                const result = [
                    doFetchRoom.pending("requestId", roomUrl),
                    doFetchRoom.rejected(new Error("Network error"), "requestId", roomUrl),
                ].reduce(roomSlice.reducer, roomSliceInitialState);

                expect(result.roomFetchStatus).toEqual("failed");
            });

            it.each`
                outcome       | action
                ${"succeeds"} | ${doFetchRoom.fulfilled({ isLocked: true }, "first", roomUrl)}
                ${"fails"}    | ${doFetchRoom.rejected(new Error("Network error"), "first", roomUrl)}
            `("ignores a fetch that $outcome after a newer one started", ({ action }) => {
                const result = [
                    doFetchRoom.pending("first", roomUrl),
                    doFetchRoom.pending("second", "https://example.whereby.com/other"),
                    action,
                ].reduce(roomSlice.reducer, roomSliceInitialState);

                expect(result).toEqual(expect.objectContaining({ lockStateSource: null, roomFetchStatus: "fetching" }));
            });

            it.each`
                event                         | action
                ${"room_locked"}              | ${signalEvents.roomLocked({ isLocked: false })}
                ${"a room_locked join error"} | ${signalEvents.roomJoined({ error: "room_locked", isClaimed: true, isLocked: false, selfId: "selfId" })}
            `("keeps the lock state from $event when the fetch finishes after it", ({ action }) => {
                const result = [
                    doFetchRoom.pending("requestId", roomUrl),
                    action,
                    doFetchRoom.fulfilled({ isLocked: true }, "requestId", roomUrl),
                ].reduce(roomSlice.reducer, inRoomState);

                expect(result).toEqual(expect.objectContaining({ isLocked: false, lockStateSource: "signal" }));
            });
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
