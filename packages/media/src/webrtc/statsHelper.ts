export function isRelayed(pc: any) {
    return pc.getStats(null).then((result: any) => {
        let localCandidateType;
        let remoteCandidateType;
        result.forEach((report: any) => {
            // Chrome 58+ / spec
            if (report.type === "transport" && report.selectedCandidatePairId) {
                const transport = result.get(report.selectedCandidatePairId);
                if (!transport) {
                    return;
                }
                localCandidateType = result.get(transport.localCandidateId).candidateType;
                remoteCandidateType = result.get(transport.remoteCandidateId).candidateType;
                return;
            }
            // Firefox (missing type=transport)
            if (report.type === "candidate-pair" && report.selected) {
                localCandidateType = result.get(report.localCandidateId).candidateType;
                remoteCandidateType = result.get(report.remoteCandidateId).candidateType;
            }
        });
        return (
            localCandidateType === "relay" ||
            localCandidateType === "relayed" || // relay: spec-stats; relayed: Firefox (bug)
            remoteCandidateType === "relay" ||
            remoteCandidateType === "relayed"
        );
    });
}
