import { selectShouldFetchOrganization } from "../organization";
import { oneOf, randomOrganization } from "../../../__mocks__/appMocks";

describe("deviceCredentialsSlice", () => {
    describe("reactors", () => {
        describe("selectShouldFetchOrganization", () => {
            const organization = randomOrganization();
            const x = () => oneOf(true, false);

            it.each`
                appIsActive | organizationData | isFetchingOrganization | organizationError | isFetchingDeviceCredentials | expected
                ${true}     | ${undefined}     | ${false}               | ${false}          | ${false}                    | ${true}
                ${true}     | ${null}          | ${false}               | ${false}          | ${false}                    | ${true}
                ${x()}      | ${organization}  | ${x()}                 | ${x()}            | ${x()}                      | ${false}
                ${x()}      | ${organization}  | ${true}                | ${x()}            | ${x()}                      | ${false}
                ${x()}      | ${organization}  | ${x()}                 | ${true}           | ${x()}                      | ${false}
                ${x()}      | ${organization}  | ${x()}                 | ${x()}            | ${true}                     | ${false}
            `(
                "should return $expected when appIsActive=$appIsActive, organizationData=$organizationData, isFetchingOrganization=$isFetchingOrganization, organizationError=$organizationError, isFetchingDeviceCredentials=$isFetchingDeviceCredentials",
                ({
                    appIsActive,
                    organizationData,
                    isFetchingOrganization,
                    organizationError,
                    isFetchingDeviceCredentials,
                    expected,
                }) => {
                    const organizationRaw = {
                        data: organizationData,
                        isFetching: isFetchingOrganization,
                        error: organizationError,
                        fetchedAt: 0,
                    };
                    const deviceCredentialsRaw = {
                        isFetching: isFetchingDeviceCredentials,
                    };

                    expect(
                        selectShouldFetchOrganization.resultFunc(appIsActive, organizationRaw, deviceCredentialsRaw),
                    ).toEqual(expected);
                },
            );
        });
    });
});
