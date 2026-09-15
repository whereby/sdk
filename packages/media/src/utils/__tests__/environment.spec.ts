import { anyWindow, browserDocument, browserWindow } from "../environment";

const originalWindow = global.window;

const setWindow = (value: unknown) => {
    Object.defineProperty(global, "window", { value, configurable: true, writable: true });
};

const polyfilledWindow = {
    location: { pathname: "/room" },
    screen: { width: 0 },
    setInterval: global.setInterval,
} as unknown as Window & typeof globalThis;

describe("environment", () => {
    afterEach(() => {
        setWindow(originalWindow);
    });

    describe("browserWindow", () => {
        it("returns the window in a real browsing context", () => {
            expect(browserWindow()).toBe(originalWindow);
        });

        it("returns undefined for the window the Node SDK polyfills", () => {
            setWindow(polyfilledWindow);

            expect(browserWindow()).toBeUndefined();
        });

        it("returns undefined when there is no window", () => {
            setWindow(undefined);

            expect(browserWindow()).toBeUndefined();
        });

        it("does not hand out a window whose methods are missing", () => {
            setWindow(polyfilledWindow);

            expect(polyfilledWindow.addEventListener).toBeUndefined();
            expect(() => browserWindow()?.addEventListener("offline", () => {})).not.toThrow();
        });
    });

    describe("anyWindow", () => {
        it("accepts the window the Node SDK polyfills, unlike browserWindow", () => {
            setWindow(polyfilledWindow);

            expect(anyWindow()).toBe(polyfilledWindow);
            expect(browserWindow()).toBeUndefined();
        });

        it("returns undefined when there is no window", () => {
            setWindow(undefined);

            expect(anyWindow()).toBeUndefined();
        });
    });

    describe("browserDocument", () => {
        it("returns the document in a real browsing context", () => {
            expect(browserDocument()).toBe(originalWindow.document);
        });

        it("returns undefined for the window the Node SDK polyfills", () => {
            setWindow(polyfilledWindow);

            expect(browserDocument()).toBeUndefined();
        });

        it("returns undefined when there is no window", () => {
            setWindow(undefined);

            expect(browserDocument()).toBeUndefined();
        });
    });
});
