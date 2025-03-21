import {
    selectShouldConnectRtc,
    selectShouldInitializeRtc,
    selectShouldDisconnectRtc,
    selectStreamsToAccept,
} from "../rtcConnection";
import { oneOf, randomRemoteParticipant } from "../../../__mocks__/appMocks";
import { StreamState } from "../../../RoomParticipant";

describe("rtcConnectionSlice", () => {
    describe("reactors", () => {
        describe("selectShouldConnectRtc", () => {
            const x = () => oneOf(true, false);

            it.each`
                rtcStatus     | appIsActive | dispatcherCreated | isCreatingDispatcher | signalSocket | expected
                ${"inactive"} | ${true}     | ${true}           | ${x()}               | ${{}}        | ${false}
                ${"inactive"} | ${true}     | ${x()}            | ${true}              | ${{}}        | ${false}
                ${"inactive"} | ${true}     | ${x()}            | ${x()}               | ${undefined} | ${false}
                ${"active"}   | ${true}     | ${false}          | ${false}             | ${{}}        | ${false}
                ${"inactive"} | ${false}    | ${false}          | ${false}             | ${{}}        | ${false}
                ${"inactive"} | ${true}     | ${false}          | ${false}             | ${{}}        | ${true}
            `(
                "should return $expected when rtcStatus=$rtcStatus, appIsActive=$appIsActive dispatcherCreated=$dispatcherCreated, isCreatingDispatcher=$isCreatingDispatcher, signalSocket=$signalSocket",
                ({ rtcStatus, appIsActive, dispatcherCreated, isCreatingDispatcher, signalSocket, expected }) => {
                    expect(
                        selectShouldConnectRtc.resultFunc(
                            rtcStatus,
                            appIsActive,
                            dispatcherCreated,
                            isCreatingDispatcher,
                            signalSocket,
                        ),
                    ).toEqual(expected);
                },
            );
        });

        describe("selectShouldInitializeRtc", () => {
            const x = () => oneOf(true, false);

            it.each`
                rtcManager   | rtcManagerInitialized | localMediaStatus | expected
                ${undefined} | ${x()}                | ${"started"}     | ${false}
                ${{}}        | ${true}               | ${"started"}     | ${false}
                ${{}}        | ${false}              | ${"started"}     | ${true}
                ${{}}        | ${x()}                | ${"starting"}    | ${false}
            `(
                "should return $expected when rtcManager=$rtcManager, rtcManagerInitialized=$rtcManagerInitialized, localMediaStatus=$localMediaStatus",
                ({ rtcManager, rtcManagerInitialized, localMediaStatus, expected }) => {
                    expect(
                        selectShouldInitializeRtc.resultFunc(rtcManager, rtcManagerInitialized, localMediaStatus),
                    ).toEqual(expected);
                },
            );
        });

        describe("selectShouldDisconnectRtc", () => {
            const x = () => oneOf(true, false);

            it.each`
                rtcStatus         | appIsActive | expected
                ${"ready"}        | ${true}     | ${false}
                ${"ready"}        | ${false}    | ${true}
                ${"inactive"}     | ${x()}      | ${false}
                ${"disconnected"} | ${x()}      | ${false}
            `(
                "should return $expected when rtcStatus=$rtcStatus, appIsActive=$appIsActive",
                ({ rtcStatus, appIsActive, expected }) => {
                    expect(selectShouldDisconnectRtc.resultFunc(rtcStatus, appIsActive)).toEqual(expected);
                },
            );
        });

        describe("selectStreamsToAccept", () => {
            const x = () => oneOf<{ id: number } | "x" | null | undefined>({ id: 1 }, "x", null, undefined);
            const c = (id: string, streamStates: StreamState[], breakoutGroup = "") =>
                randomRemoteParticipant({
                    id,
                    streams: streamStates.map((s, i) => ({ id: `${i}`, state: s })),
                    breakoutGroup,
                });

            it.each`
                breakoutCurrentId | rtcStatus     | remoteParticipants                                                | appIgnoreBreakoutGroups | expected
                ${""}             | ${"inactive"} | ${[x(), x()]}                                                     | ${false}                | ${[]}
                ${""}             | ${"ready"}    | ${[c("id0", ["to_accept"])]}                                      | ${false}                | ${[{ clientId: "id0", streamId: "0", state: "to_accept" }]}
                ${""}             | ${"inactive"} | ${[c("id1", ["to_accept"])]}                                      | ${false}                | ${[]}
                ${""}             | ${"ready"}    | ${[c("id2", ["to_unaccept"])]}                                    | ${false}                | ${[{ clientId: "id2", streamId: "0", state: "to_accept" }]}
                ${""}             | ${"ready"}    | ${[c("id3", ["done_accept"])]}                                    | ${false}                | ${[]}
                ${""}             | ${"ready"}    | ${[c("id4", ["to_accept", "done_accept"])]}                       | ${false}                | ${[{ clientId: "id4", streamId: "0", state: "to_accept" }]}
                ${""}             | ${"ready"}    | ${[c("id5", ["to_accept"]), c("id6", ["done_accept"])]}           | ${false}                | ${[{ clientId: "id5", streamId: "0", state: "to_accept" }]}
                ${""}             | ${"ready"}    | ${[c("id7", ["to_accept", "to_accept"])]}                         | ${false}                | ${[{ clientId: "id7", streamId: "0", state: "to_accept" }, { clientId: "id7", streamId: "1", state: "to_accept" }]}
                ${"b"}            | ${"ready"}    | ${[c("id8", ["to_accept"], "a"), c("id9", ["to_accept"], "b")]}   | ${false}                | ${[{ clientId: "id8", streamId: "0", state: "to_unaccept" }, { clientId: "id9", streamId: "0", state: "to_accept" }]}
                ${"b"}            | ${"ready"}    | ${[c("id8", ["done_accept"], "a"), c("id9", ["to_accept"], "b")]} | ${false}                | ${[{ clientId: "id8", streamId: "0", state: "to_unaccept" }, { clientId: "id9", streamId: "0", state: "to_accept" }]}
                ${"b"}            | ${"ready"}    | ${[c("id8", ["to_accept"], "a"), c("id9", ["to_unaccept"], "b")]} | ${false}                | ${[{ clientId: "id8", streamId: "0", state: "to_unaccept" }, { clientId: "id9", streamId: "0", state: "to_accept" }]}
                ${""}             | ${"ready"}    | ${[c("id10", ["to_accept"], "a"), c("id11", ["to_accept"], "b")]} | ${true}                 | ${[{ clientId: "id10", streamId: "0", state: "to_accept" }, { clientId: "id11", streamId: "0", state: "to_accept" }]}
            `(
                "should return $expected when breakoutCurrentId=$breakoutCurrentId, rtcStatus=$rtcStatus, remoteParticipants=$remoteParticipants, appIgnoreBreakoutGroups=$appIgnoreBreakoutGroups",
                ({ breakoutCurrentId, rtcStatus, remoteParticipants, appIgnoreBreakoutGroups, expected }) => {
                    expect(
                        selectStreamsToAccept.resultFunc(
                            rtcStatus,
                            remoteParticipants,
                            breakoutCurrentId,
                            [],
                            appIgnoreBreakoutGroups,
                        ),
                    ).toEqual(expected);
                },
            );
        });
    });
});
