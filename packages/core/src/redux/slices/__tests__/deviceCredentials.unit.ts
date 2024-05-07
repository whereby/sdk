import { randomDeviceCredentials } from "../../../__mocks__/appMocks";
import { selectShouldFetchDeviceCredentials } from "../deviceCredentials";

describe("deviceCredentialsSlice", () => {
    describe("reactors", () => {
        describe("selectShouldFetchDeviceCredentials", () => {
            const credentials = randomDeviceCredentials();

            it.each`
                appIsActive | isFetching | deviceCredentialsData | expected
                ${true}     | ${false}   | ${undefined}          | ${true}
                ${true}     | ${false}   | ${null}               | ${true}
                ${true}     | ${false}   | ${credentials}        | ${false}
                ${true}     | ${true}    | ${undefined}          | ${false}
                ${true}     | ${true}    | ${null}               | ${false}
                ${true}     | ${true}    | ${credentials}        | ${false}
            `(
                "expected $expected when appIsActive=$appIsActive, isFetching=$isFetching, deviceCredentialsData=$deviceCredentialsData",
                ({ appIsActive, isFetching, deviceCredentialsData, expected }) => {
                    const deviceCredentials = {
                        isFetching,
                        data: deviceCredentialsData,
                    };

                    expect(selectShouldFetchDeviceCredentials.resultFunc(appIsActive, deviceCredentials)).toBe(
                        expected,
                    );
                },
            );
        });
    });
});
