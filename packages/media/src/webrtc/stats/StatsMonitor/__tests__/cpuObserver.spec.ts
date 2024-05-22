import { startCpuObserver } from "../cpuObserver";
import { OriginTrial, registerOriginTrials } from "../../../../utils/originTrial";

jest.mock("../../../../utils/originTrial");

describe("startCpuObserver", () => {
    let cb: jest.Mock;
    let originTrials: OriginTrial[];
    let sampleRate: number;
    let window: any;

    beforeEach(() => {
        cb = jest.fn();
        originTrials = [{ hostnamePattern: /hostname\.com/, token: "token" }];
        sampleRate = 1;
        window = {};
    });

    it("should register origin trials", () => {
        startCpuObserver(cb, { originTrials, sampleRate }, window);

        expect(registerOriginTrials).toHaveBeenCalledWith(originTrials);
    });

    describe("when PressureObserver is not available", () => {
        it("should return undefined", () => {
            const result = startCpuObserver(cb, { originTrials, sampleRate }, window);

            expect(result).toBeUndefined();
        });
    });

    describe("when PressureObserver is available", () => {
        let observe: jest.Mock;
        let unobserve: jest.Mock;

        beforeEach(() => {
            observe = jest.fn();
            unobserve = jest.fn();

            window.PressureObserver = jest.fn(() => ({
                observe,
                unobserve,
            }));
        });

        it("should observe cpu pressure", () => {
            startCpuObserver(cb, { originTrials, sampleRate }, window);

            expect(window.PressureObserver).toHaveBeenCalled();
            expect(observe).toHaveBeenCalledWith("cpu", { sampleInterval: sampleRate * 1000 });
        });

        it("should return stop function", () => {
            const cpuObserver = startCpuObserver(cb, { originTrials, sampleRate }, window);

            cpuObserver?.stop();

            expect(unobserve).toHaveBeenCalledWith("cpu");
        });
    });
});
