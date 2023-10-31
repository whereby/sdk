import ServerSocket from "../../src/utils/ServerSocket";

describe("ServerSocket", () => {
    describe("on", () => {
        let serverSocket;

        beforeEach(() => {
            serverSocket = new ServerSocket("https://localhost");
            jest.spyOn(serverSocket._socket, "on");
            jest.spyOn(serverSocket._socket, "off");
        });

        afterEach(() => {
            jest.clearAllMocks();
        });

        it("should attach an event listener to the internal socket", () => {
            const eventName = "some event";
            const handler = jest.fn();

            serverSocket.on(eventName, handler);

            expect(serverSocket._socket.on).toHaveBeenCalledWith(eventName, handler);
        });

        it("should return a deregistering function", () => {
            const deregisterHandler = serverSocket.on("event", () => {});

            expect(deregisterHandler).toBeInstanceOf(Function);
        });

        it("should return a deregistering function which will remove the listener", () => {
            const eventName = "some event";
            const handler = jest.fn();

            const deregisterHandler = serverSocket.on(eventName, handler);
            deregisterHandler();

            expect(serverSocket._socket.off).toHaveBeenCalledWith(eventName, handler);
        });
    });
});
