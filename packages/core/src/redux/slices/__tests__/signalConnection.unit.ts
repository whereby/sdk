import { oneOf } from "../../../__mocks__/appMocks";
import { selectShouldConnectSignal, selectShouldIdentifyDevice, signalConnectionSlice } from "../signalConnection";
import { createSignalDisconnectEvent, signalEvents } from "../signalConnection/actions";

describe("createSignalDisconnectEvent", () => {
    it.each(["ping timeout", "transport close", "transport error", "parse error"])(
        "will reconnect after %s",
        (reason) => {
            expect(createSignalDisconnectEvent(reason)).toEqual({ willReconnect: true });
        },
    );

    it.each(["io server disconnect", "io client disconnect"])("won't reconnect after %s", (reason) => {
        expect(createSignalDisconnectEvent(reason)).toEqual({ willReconnect: false });
    });

    it("won't reconnect without a reason", () => {
        expect(createSignalDisconnectEvent()).toEqual({ willReconnect: false });
    });
});

describe("signalConnectionSlice", () => {
    describe("reducers", () => {
        describe("signalEvents.disconnect", () => {
            it("should set status to disconnected", () => {
                const result = signalConnectionSlice.reducer(
                    undefined,
                    signalEvents.disconnect({ willReconnect: true }),
                );

                expect(result).toEqual({
                    deviceIdentified: false,
                    isIdentifyingDevice: false,
                    socket: null,
                    status: "disconnected",
                });
            });
        });
    });
    describe("reactors", () => {
        describe("selectShouldConnectSignal", () => {
            const x = () => oneOf(true, false);

            it.each`
                appIsActive | signalStatus   | expected
                ${true}     | ${"ready"}     | ${true}
                ${false}    | ${"ready"}     | ${false}
                ${x()}      | ${"connected"} | ${false}
            `(
                "should return $expected when appIsActive=$appIsActive, signalStatus=$signalStatus",
                ({ appIsActive, signalStatus, expected }) => {
                    expect(selectShouldConnectSignal.resultFunc(appIsActive, signalStatus)).toEqual(expected);
                },
            );
        });

        describe("selectShouldIdentifyDevice", () => {
            const x = () => oneOf(true, false);

            it.each`
                deviceCredentialsData | signalStatus   | deviceIdentified | isIdentifyingDevice | expected
                ${undefined}          | ${"connected"} | ${x()}           | ${x()}              | ${false}
                ${{}}                 | ${"connected"} | ${true}          | ${x()}              | ${false}
                ${{}}                 | ${"connected"} | ${false}         | ${true}             | ${false}
                ${{}}                 | ${"connected"} | ${false}         | ${false}            | ${true}
                ${undefined}          | ${"ready"}     | ${x()}           | ${x()}              | ${false}
                ${{}}                 | ${"ready"}     | ${true}          | ${x()}              | ${false}
                ${{}}                 | ${"ready"}     | ${false}         | ${true}             | ${false}
                ${{}}                 | ${"ready"}     | ${false}         | ${false}            | ${false}
            `(
                "should return $expected when deviceCredentialsData=$deviceCredentialsData, signalStatus=$signalStatus, deviceIdentified=$deviceIdentified, isIdentifyingDevice=$isIdentifyingDevice",
                ({ deviceCredentialsData, signalStatus, deviceIdentified, isIdentifyingDevice, expected }) => {
                    const deviceCredentialsRaw = {
                        isFetching: false,
                        data: deviceCredentialsData,
                    };

                    expect(
                        selectShouldIdentifyDevice.resultFunc(
                            deviceCredentialsRaw,
                            signalStatus,
                            deviceIdentified,
                            isIdentifyingDevice,
                        ),
                    ).toEqual(expected);
                },
            );
        });
    });
});
