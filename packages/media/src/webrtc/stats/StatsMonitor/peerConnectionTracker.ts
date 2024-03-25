let peerConnections: any = [];
let peerConnectionCounter = 0;
const peerConnectionData = new WeakMap();

export const removePeerConnection = (pc: any) => {
    peerConnections = peerConnections.filter((old: any) => old !== pc);
};

if (window.RTCPeerConnection) {
    const OriginalRTCPeerConnection = window.RTCPeerConnection;
    function PatchedRTCPeerConnection(rtcConfig: any) {
        const pc = new OriginalRTCPeerConnection(rtcConfig);
        peerConnections.push(pc);
        peerConnectionData.set(pc, { index: peerConnectionCounter++ });
        const onConnectionStateChange = () => {
            if (pc.connectionState === "closed") {
                removePeerConnection(pc);
                pc.removeEventListener("connectionstatechange", onConnectionStateChange);
            }
        };
        pc.addEventListener("connectionstatechange", onConnectionStateChange);
        return pc;
    }
    PatchedRTCPeerConnection.prototype = OriginalRTCPeerConnection.prototype;
    (window.RTCPeerConnection as any) = PatchedRTCPeerConnection;
}

export const getCurrentPeerConnections = () => peerConnections;

export const getPeerConnectionIndex = (pc: any) => peerConnectionData.get(pc)?.index;

export const setPeerConnectionsForTests = (pcs: any) => (peerConnections = pcs);
