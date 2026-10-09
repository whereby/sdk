import { getSelectedCandidatePairId } from "../metrics";

describe("getSelectedCandidatePairId", () => {
    it("returns the candidate pair selected on the rtp stream's transport (Chrome, Safari)", () => {
        const report = new Map<string, any>([
            ["T01", { type: "transport", selectedCandidatePairId: "CP1" }],
            ["CP1", { type: "candidate-pair", id: "CP1", nominated: true }],
            ["CP2", { type: "candidate-pair", id: "CP2" }],
        ]);

        expect(getSelectedCandidatePairId(report, "T01")).toBe("CP1");
    });

    it("returns the candidate pair marked as selected without transport stats (Firefox)", () => {
        const report = new Map<string, any>([
            ["cp1", { type: "candidate-pair", id: "cp1", selected: false }],
            ["cp2", { type: "candidate-pair", id: "cp2", selected: true }],
        ]);

        expect(getSelectedCandidatePairId(report, undefined)).toBe("cp2");
    });

    it("only looks through a report once for its selected candidate pair", () => {
        const report = new Map<string, any>([["cp1", { type: "candidate-pair", id: "cp1", selected: true }]]);
        const forEach = jest.spyOn(report, "forEach");

        getSelectedCandidatePairId(report, undefined);
        getSelectedCandidatePairId(report, undefined);

        expect(forEach).toHaveBeenCalledTimes(1);
    });

    it("returns undefined when no candidate pair is selected yet", () => {
        const report = new Map<string, any>([["cp1", { type: "candidate-pair", id: "cp1", state: "inprogress" }]]);

        expect(getSelectedCandidatePairId(report, undefined)).toBeUndefined();
    });
});
