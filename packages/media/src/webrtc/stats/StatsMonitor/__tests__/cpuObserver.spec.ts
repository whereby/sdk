import { startCpuObserver } from "../cpuObserver";
import { OriginTrial, registerOriginTrials } from "../../../../utils/originTrial";

jest.mock("../../../../utils/originTrial");

describe("startCpuObserver", () => {
    let cb: jest.Mock;
    let sampleRate: number;
    let window: any;

    beforeEach(() => {
        cb = jest.fn();
        sampleRate = 1;
        window = {};
    });

    describe("when PressureObserver is not available", () => {
        it("should return undefined", () => {
            const result = startCpuObserver(cb, { sampleRate }, window);

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
            window.PressureObserver.knownSources = ["cpu"];
        });

        it("should observe cpu pressure", () => {
            const observer = startCpuObserver(cb, { sampleRate }, window);

            expect(observer).toBeDefined();
            expect(window.PressureObserver).toHaveBeenCalled();
            expect(observe).toHaveBeenCalledWith("cpu", { sampleInterval: sampleRate * 1000 });
        });

        it("should return stop function", () => {
            const cpuObserver = startCpuObserver(cb, { sampleRate }, window);

            cpuObserver?.stop();

            expect(unobserve).toHaveBeenCalledWith("cpu");
        });
    });
});
