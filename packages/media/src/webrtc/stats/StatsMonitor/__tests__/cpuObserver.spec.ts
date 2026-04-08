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
        it("should return undefined", async () => {
            const result = await startCpuObserver(cb, { originTrials, sampleRate }, window);

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

        it("should observe cpu pressure", async () => {
            const observer = await startCpuObserver(cb, { originTrials, sampleRate }, window);

            expect(observer).toBeDefined();
            expect(window.PressureObserver).toHaveBeenCalled();
            expect(observe).toHaveBeenCalledWith("cpu", { sampleInterval: sampleRate * 1000 });
        });

        it("should return stop function", async () => {
            const cpuObserver = await startCpuObserver(cb, { originTrials, sampleRate }, window);

            cpuObserver?.stop();

            expect(unobserve).toHaveBeenCalledWith("cpu");
        });
    });
});
