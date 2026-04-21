import * as cameraEffectsSlice from "../../slices/cameraEffects";
import { doAppStart, doAppStop } from "../../slices/app";
import { createStore } from "../store.setup";

jest.mock("@whereby.com/media", () => ({
    __esModule: true,
    getStream: jest.fn(() => Promise.resolve()),
    getUpdatedDevices: jest.fn(() => Promise.resolve({ addedDevices: {}, changedDevices: {} })),
}));

describe("cameraEffectsSlice", () => {
    describe("reactors", () => {
        it("does not clear the effect when it is applied before the app becomes active (pre-call)", () => {
            const store = createStore();
            const stop = jest.fn();

            store.dispatch(
                cameraEffectsSlice.cameraEffectsUpdated({
                    effectId: "image-blur",
                    raw: { stop },
                }),
            );

            const state = store.getState().cameraEffects;
            expect(state.currentEffectId).toBe("image-blur");
            expect(state.raw.stop).toBe(stop);
            expect(stop).not.toHaveBeenCalled();
        });

        it("clears the effect when the app stops", () => {
            const store = createStore();
            const stop = jest.fn();

            store.dispatch(
                doAppStart({
                    displayName: "Test",
                    externalId: null,
                    roomKey: null,
                    roomUrl: "https://example.whereby.com/test",
                }),
            );
            store.dispatch(
                cameraEffectsSlice.cameraEffectsUpdated({
                    effectId: "image-blur",
                    raw: { stop },
                }),
            );

            expect(store.getState().cameraEffects.currentEffectId).toBe("image-blur");

            store.dispatch(doAppStop());

            const state = store.getState().cameraEffects;
            expect(state.currentEffectId).toBeNull();
            expect(state.raw).toEqual({});
        });
    });
});
