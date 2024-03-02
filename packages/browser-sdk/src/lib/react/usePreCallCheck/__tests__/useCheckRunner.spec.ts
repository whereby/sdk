import { renderHook, waitFor } from "@testing-library/react";
import { CheckMock } from "../../../__mocks__/checkMock";
import { useCheckFactory } from "../useCheck";
import { CheckRunnerRef, useCheckRunnerFactory } from "../useCheckRunner";

const checkDefinitions = {
    firstCheck: useCheckFactory("firstCheck", new CheckMock({ success: true })),
    secondCheck: useCheckFactory("secondCheck", new CheckMock({ success: true })),
    thirdCheck: useCheckFactory("thirdCheck", new CheckMock({ success: true })),
};

describe("useCheckRunnerFactory", () => {
    it("should return a hook function", () => {
        const useCheckRunner = useCheckRunnerFactory(checkDefinitions);

        expect(typeof useCheckRunner).toBe("function");
    });

    describe("useCheckRunner hook", () => {
        let useCheckRunner: () => CheckRunnerRef;

        beforeEach(() => {
            useCheckRunner = useCheckRunnerFactory(checkDefinitions);
        });

        it("should run first check", () => {
            const { result } = renderHook(() => useCheckRunner());

            waitFor(() => {
                const { state } = result.current;

                expect(state.checks[0].state.status).toEqual("running");
            });
        });

        it('should enter "running" status', () => {
            const { result } = renderHook(() => useCheckRunner());

            waitFor(() => {
                const { state } = result.current;

                expect(state.status).toEqual("running");
            });
        });

        describe("when one check fails", () => {
            beforeEach(() => {
                useCheckRunner = useCheckRunnerFactory({
                    ...checkDefinitions,
                    failingCheck: useCheckFactory("failingCheck", new CheckMock({ success: false })),
                });
            });

            it("should enter 'failed' status", async () => {
                const { result } = renderHook(() => useCheckRunner());

                await waitFor(() => {
                    const { state } = result.current;

                    expect(state.status).toEqual("failed");
                });
            });
        });

        describe("when all checks succeed", () => {
            it("should enter 'succeeded' status", async () => {
                const { result } = renderHook(() => useCheckRunner());

                await waitFor(() => {
                    const { state } = result.current;

                    expect(state.status).toEqual("succeeded");
                });
            });
        });
    });
});
