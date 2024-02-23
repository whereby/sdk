import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { CheckMock } from "../../../__mocks__/checkMock";
import { UseCheckRef } from "../types";
import { useCheckFactory } from "../useCheck";

describe("useCheckFactory", () => {
    it("should return a hook function", () => {
        const useCheck = useCheckFactory("check", new CheckMock());

        expect(typeof useCheck).toBe("function");
    });

    describe("useCheck hook", () => {
        let useCheck: () => UseCheckRef;

        beforeEach(() => {
            useCheck = useCheckFactory("check", new CheckMock());
        });

        it("should have initial status of 'idle'", () => {
            const { result } = renderHook(() => useCheck());

            const { state } = result.current;

            expect(state.status).toEqual("idle");
        });

        describe("start", () => {
            it("should change status to 'running'", () => {
                const { result } = renderHook(() => useCheck());

                const { actions } = result.current;
                act(() => actions.start());

                waitFor(() => {
                    const { state } = result.current;

                    expect(state.status).toEqual("running");
                });
            });

            describe("when check is successful", () => {
                beforeEach(() => {
                    useCheck = useCheckFactory("check", new CheckMock({ success: true }));
                });

                it("should change status to 'completed'", () => {
                    const { result } = renderHook(() => useCheck());

                    const { actions } = result.current;
                    actions.start();

                    waitFor(() => {
                        const { state } = result.current;

                        expect(state.status).toEqual("completed");
                    });
                });
            });

            describe("when check fails", () => {
                beforeEach(() => {
                    useCheck = useCheckFactory("check", new CheckMock({ success: false }));
                });

                it("should change status to 'failed'", () => {
                    const { result } = renderHook(() => useCheck());

                    const { actions } = result.current;
                    actions.start();

                    waitFor(() => {
                        const { state } = result.current;

                        expect(state.status).toEqual("failed");
                    });
                });
            });
        });
    });
});
