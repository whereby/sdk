import { doRequestAudioEnable } from "../../slices/remoteParticipants";
import { createStore, mockSignalEmit } from "../store.setup";
import { randomString } from "../../../__mocks__/appMocks";

describe("actions", () => {
    describe("when authorized", () => {
        it("should request audio enable", () => {
            const store = createStore({
                initialState: { authorization: { roomKey: null, roleName: "host" } },
                withSignalConnection: true,
            });
            const clientId = randomString();

            store.dispatch(doRequestAudioEnable({ clientIds: [clientId], enable: false }));

            expect(mockSignalEmit).toHaveBeenCalledWith("request_audio_enable", {
                clientIds: [clientId],
                enable: false,
            });
        });
    });

    describe("when not authorized", () => {
        it("should not request audio enable", () => {
            const store = createStore({
                initialState: { authorization: { roomKey: null, roleName: "visitor" } },
                withSignalConnection: true,
            });
            const clientId = randomString();

            expect(() => store.dispatch(doRequestAudioEnable({ clientIds: [clientId], enable: false }))).toThrow(
                `Not authorized to perform this action`,
            );

            expect(mockSignalEmit).not.toHaveBeenCalled();
        });
    });
});
