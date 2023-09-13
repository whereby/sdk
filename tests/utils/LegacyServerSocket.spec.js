import LegacyServerSocket from "../../src/utils/LegacyServerSocket";

describe("LegacyServerSocket", () => {
    describe("on", () => {
        let serverSocket;

        beforeEach(() => {
            serverSocket = new LegacyServerSocket("https://localhost");
            sinon.stub(serverSocket._socket, "on");
            sinon.stub(serverSocket._socket, "off");
        });

        afterEach(() => {
            serverSocket._socket.on.restore();
            serverSocket._socket.off.restore();
        });

        it("should attach an event listener to the internal socket", () => {
            const eventName = "some event";
            const handler = sinon.stub();

            serverSocket.on(eventName, handler);

            expect(serverSocket._socket.on).to.be.calledWithExactly(eventName, handler);
        });

        it("should return a deregistering function", () => {
            const deregisterHandler = serverSocket.on("event", () => {});

            expect(deregisterHandler).to.be.instanceOf(Function);
        });

        it("should return a deregistering function which will remove the listener", () => {
            const eventName = "some event";
            const handler = sinon.stub();

            const deregisterHandler = serverSocket.on(eventName, handler);
            deregisterHandler();

            expect(serverSocket._socket.off).to.be.calledWithExactly(eventName, handler);
        });
    });
});
