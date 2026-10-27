import { randomDeviceCredentials } from "../../../__mocks__/appMocks";
import { selectShouldFetchDeviceCredentials } from "../deviceCredentials";

describe("deviceCredentialsSlice", () => {
    describe("reactors", () => {
        describe("selectShouldFetchDeviceCredentials", () => {
            const credentials = randomDeviceCredentials();

            it.each`
                appIsActive | isFetching | error    | deviceCredentialsData | expected
                ${true}     | ${false}   | ${false} | ${undefined}          | ${true}
                ${true}     | ${false}   | ${false} | ${null}               | ${true}
                ${true}     | ${false}   | ${false} | ${credentials}        | ${false}
                ${true}     | ${true}    | ${false} | ${undefined}          | ${false}
                ${true}     | ${true}    | ${false} | ${null}               | ${false}
                ${true}     | ${true}    | ${false} | ${credentials}        | ${false}
                ${true}     | ${false}   | ${true}  | ${null}               | ${false}
            `(
                "expected $expected when appIsActive=$appIsActive, isFetching=$isFetching, error=$error, deviceCredentialsData=$deviceCredentialsData",
                ({ appIsActive, isFetching, error, deviceCredentialsData, expected }) => {
                    const deviceCredentials = {
                        isFetching,
                        error,
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
