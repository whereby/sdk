import { BandwidthCheck } from "../bandwidthCheck";
import { BandwidthTester } from "@whereby.com/core/media";

jest.mock("@whereby.com/core/media", () => {
    return {
        BandwidthTester: jest.fn().mockImplementation(() => {
            return {
                on: jest.fn(),
                start: jest.fn(),
            };
        }),
    };
});

const MockedBandwidthTester = BandwidthTester as jest.Mock<BandwidthTester>;

describe("bandwidthCheck", () => {
    let bandwidthCheck: BandwidthCheck;

    beforeEach(() => {
        bandwidthCheck = new BandwidthCheck();
    });

    describe("run", () => {
        it("should initialize and start new BandwithTester", () => {
            bandwidthCheck.run();

            expect(MockedBandwidthTester).toHaveBeenCalledTimes(1);

            const bandwidthTester = MockedBandwidthTester.mock.results[0].value;
            expect(bandwidthTester.start).toHaveBeenCalledTimes(1);
        });

        describe("when bandwidthTester emits 'result' event", () => {
            beforeEach(() => {
                MockedBandwidthTester.mockImplementationOnce(() => {
                    let resultCallback: () => void;

                    return {
                        on: jest.fn().mockImplementation((event, cb) => {
                            if (event === "result") {
                                resultCallback = cb;
                            }
                        }),
                        start: jest.fn().mockImplementation(() => {
                            setTimeout(resultCallback, 1);
                        }),
                    };
                });
            });

            it("should resolve", async () => {
                await bandwidthCheck.run();

                expect(true).toBe(true);
            });
        });
    });
});
