import { createStore, mockSignalEmit } from "../store.setup";
import { doKnockRoom, doConnectRoom, roomRejoined } from "../../slices/roomConnection";
import { initialState as appInitialState } from "../../slices/app";
import { localParticipantSliceInitialState } from "../../slices/localParticipant";
import { signalEvents } from "../../slices/signalConnection/actions";
import { addAppListener } from "../../listenerMiddleware";
import { diff } from "deep-object-diff";
import { randomSignalClient } from "../../../__mocks__/appMocks";
import { hasGetDisplayMedia } from "@whereby.com/media";

jest.mock("@whereby.com/media", () => ({
    ...jest.requireActual("@whereby.com/media"),
    hasGetDisplayMedia: jest.fn(),
}));

const mockHasGetDisplayMedia = hasGetDisplayMedia as jest.MockedFunction<typeof hasGetDisplayMedia>;

describe("actions", () => {
    describe("doKnockRoom", () => {
        it("should knock if room is locked", async () => {
            const store = createStore({
                withSignalConnection: true,
                initialState: {
                    roomConnection: {
                        status: "room_locked",
                        session: null,
                        error: null,
                        knockResponse: null,
                        isRejoining: false,
                    },
                },
            });

            const before = store.getState().roomConnection;

            store.dispatch(doKnockRoom());

            const after = store.getState().roomConnection;

            expect(mockSignalEmit).toHaveBeenCalledWith("knock_room", expect.any(Object));
            expect(diff(before, after)).toEqual({
                status: "knocking",
            });
        });

        it.each([true, false])("should report canScreenshare: %s from device support", (canScreenshare) => {
            mockHasGetDisplayMedia.mockReturnValue(canScreenshare);
            const store = createStore({
                withSignalConnection: true,
                initialState: {
                    roomConnection: {
                        status: "room_locked",
                        session: null,
                        error: null,
                        knockResponse: null,
                        isRejoining: false,
                    },
                },
            });

            store.dispatch(doKnockRoom());

            expect(mockSignalEmit).toHaveBeenCalledWith(
                "knock_room",
                expect.objectContaining({ deviceCapabilities: { canScreenshare } }),
            );
        });

        it("should abort knocking if room is not locked", async () => {
            const store = createStore({ withSignalConnection: true });

            expect(() => store.dispatch(doKnockRoom())).toThrow("Room is not locked, knock aborted");
            expect(mockSignalEmit).not.toHaveBeenCalled();
        });
    });

    describe("signalEvents.clientKicked", () => {
        it("should stop the app so local media and connections are cleaned up", () => {
            const store = createStore({
                withSignalConnection: true,
                connectToRoom: true,
                initialState: {
                    app: { ...appInitialState, isActive: true },
                },
            });

            store.dispatch(signalEvents.clientKicked({ clientId: "self-client-id" }));

            expect(store.getState().roomConnection.status).toEqual("kicked");
            expect(store.getState().app.isActive).toEqual(false);
        });
    });

    describe("signalEvents.knockHandled", () => {
        const selfId = "self-client-id";

        const createKnockingStore = () =>
            createStore({
                withSignalConnection: true,
                initialState: {
                    localParticipant: { ...localParticipantSliceInitialState, id: selfId },
                    roomConnection: {
                        status: "knocking",
                        session: null,
                        error: null,
                        knockResponse: null,
                        isRejoining: false,
                    },
                },
            });

        it("stores the message and moves to knock_on_hold when put on hold", () => {
            const store = createKnockingStore();

            store.dispatch(
                signalEvents.knockHandled({
                    clientId: selfId,
                    resolution: "on_hold",
                    knockResponse: { message: "Please wait", sender: { displayName: "Host" } },
                }),
            );

            const { status, knockResponse } = store.getState().roomConnection;
            expect(status).toEqual("knock_on_hold");
            expect(knockResponse).toEqual({ message: "Please wait", sender: { displayName: "Host" } });
        });

        it("stores the message and moves to knock_rejected when rejected", () => {
            const store = createKnockingStore();

            store.dispatch(
                signalEvents.knockHandled({
                    clientId: selfId,
                    resolution: "rejected",
                    knockResponse: { message: "Not this time", sender: {} },
                }),
            );

            const { status, knockResponse } = store.getState().roomConnection;
            expect(status).toEqual("knock_rejected");
            expect(knockResponse).toEqual({ message: "Not this time", sender: {} });
        });

        it("ignores events targeting another client", () => {
            const store = createKnockingStore();

            store.dispatch(
                signalEvents.knockHandled({
                    clientId: "someone-else",
                    resolution: "rejected",
                    knockResponse: { message: "Not this time", sender: {} },
                }),
            );

            const { status, knockResponse } = store.getState().roomConnection;
            expect(status).toEqual("knocking");
            expect(knockResponse).toBeNull();
        });
    });

    describe("signalEvents.roomJoined after a disconnect", () => {
        const roomJoined = (selfId: string) =>
            signalEvents.roomJoined({
                selfId,
                clientClaim: "client-claim",
                eventClaim: "",
                room: {
                    mode: "group",
                    clients: [randomSignalClient({ id: selfId })],
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
                },
            });

        it("dispatches roomRejoined with the previous selfId", () => {
            const store = createStore({ withSignalConnection: true });
            const onRejoined = jest.fn();
            store.dispatch(addAppListener({ actionCreator: roomRejoined, effect: onRejoined }));

            store.dispatch(roomJoined("first-id"));
            expect(onRejoined).not.toHaveBeenCalled();

            store.dispatch(signalEvents.disconnect({ willReconnect: true }));
            expect(store.getState().roomConnection.status).toEqual("reconnecting");

            store.dispatch(roomJoined("second-id"));

            expect(store.getState().roomConnection.status).toEqual("connected");
            expect(onRejoined).toHaveBeenCalledWith(
                roomRejoined({ selfId: "second-id", previousSelfId: "first-id" }),
                expect.anything(),
            );
        });
    });

    it("doConnectRoom", async () => {
        const store = createStore({ withSignalConnection: true });

        const before = store.getState().roomConnection;

        store.dispatch(doConnectRoom());

        const after = store.getState().roomConnection;

        expect(mockSignalEmit).toHaveBeenCalledWith("join_room", expect.any(Object));
        expect(diff(before, after)).toEqual({
            status: "connecting",
        });
    });

    it.each([true, false])("doConnectRoom should report canScreenshare: %s from device support", (canScreenshare) => {
        mockHasGetDisplayMedia.mockReturnValue(canScreenshare);
        const store = createStore({ withSignalConnection: true });

        store.dispatch(doConnectRoom());

        expect(mockSignalEmit).toHaveBeenCalledWith(
            "join_room",
            expect.objectContaining({ deviceCapabilities: { canScreenshare } }),
        );
    });
});
