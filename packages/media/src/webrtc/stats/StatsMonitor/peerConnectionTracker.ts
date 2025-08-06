let peerConnections: RTCPeerConnection[] = [];
let peerConnectionCounter = 0;
const peerConnectionData = new WeakMap<RTCPeerConnection, { index: number }>();

export const removePeerConnection = (pc: RTCPeerConnection) => {
    peerConnections = peerConnections.filter((old) => old !== pc);
};

if (window.RTCPeerConnection) {
    const OriginalRTCPeerConnection = window.RTCPeerConnection;
    function PatchedRTCPeerConnection(rtcConfig?: RTCConfiguration) {
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

export const getPeerConnectionIndex = (pc: RTCPeerConnection) => peerConnectionData.get(pc)?.index;

export const setPeerConnectionsForTests = (pcs: RTCPeerConnection[]) => (peerConnections = pcs);
