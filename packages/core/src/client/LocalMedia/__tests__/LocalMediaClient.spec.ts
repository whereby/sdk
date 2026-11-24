import { createStore } from "../../../redux/tests/store.setup";
import { LocalMediaClient } from "..";
import { CAMERA_PERMISSION_CHANGED, MICROPHONE_PERMISSION_CHANGED } from "../events";

class MockPermissionStatus extends EventTarget {
    constructor(public state: PermissionState) {
        super();
    }

    change(state: PermissionState) {
        this.state = state;
        this.dispatchEvent(new Event("change"));
    }
}

const flushPromises = async () => {
    for (let i = 0; i < 5; i++) {
        await Promise.resolve();
    }
};

describe("LocalMediaClient", () => {
    let camera: MockPermissionStatus;
    let microphone: MockPermissionStatus;
    let client: LocalMediaClient;

    beforeEach(() => {
        camera = new MockPermissionStatus("prompt");
        microphone = new MockPermissionStatus("granted");
        Object.defineProperty(navigator, "permissions", {
            configurable: true,
            writable: true,
            value: {
                query: jest.fn(async ({ name }: PermissionDescriptor) => (name === "camera" ? camera : microphone)),
            },
        });
    });

    const createClient = () => {
        client = new LocalMediaClient(createStore());
        return client;
    };

    afterEach(() => {
        client.destroy();
        Object.defineProperty(navigator, "permissions", { configurable: true, writable: true, value: undefined });
    });

    describe("device permissions", () => {
        it("reads the permission state without starting media", async () => {
            createClient();
            expect(client.getState()).toEqual(
                expect.objectContaining({ cameraPermission: null, microphonePermission: null }),
            );

            await flushPromises();

            expect(client.getState()).toEqual(
                expect.objectContaining({
                    cameraPermission: "prompt",
                    microphonePermission: "granted",
                    isStarting: false,
                }),
            );
        });

        it("tells subscribers when the camera permission changes", async () => {
            createClient();
            const callback = jest.fn();
            const unsubscribe = client.subscribeCameraPermission(callback);
            await flushPromises();
            expect(callback).toHaveBeenCalledWith("prompt");

            camera.change("granted");
            expect(callback).toHaveBeenLastCalledWith("granted");

            unsubscribe();
            camera.change("denied");
            expect(callback).toHaveBeenCalledTimes(2);
        });

        it("tells subscribers when the microphone permission changes", async () => {
            createClient();
            const callback = jest.fn();
            client.subscribeMicrophonePermission(callback);
            await flushPromises();

            microphone.change("denied");

            expect(callback).toHaveBeenLastCalledWith("denied");
        });

        it.each`
            event                            | status
            ${CAMERA_PERMISSION_CHANGED}     | ${() => camera}
            ${MICROPHONE_PERMISSION_CHANGED} | ${() => microphone}
        `("emits $event", async ({ event, status }) => {
            createClient();
            await flushPromises();
            const callback = jest.fn();
            client.on(event, callback);

            status().change("denied");

            expect(callback).toHaveBeenCalledWith("denied");
        });

        it("stops following the browser when destroyed", async () => {
            createClient();
            await flushPromises();
            const removeEventListener = jest.spyOn(camera, "removeEventListener");

            client.destroy();

            expect(removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
        });
    });
});
