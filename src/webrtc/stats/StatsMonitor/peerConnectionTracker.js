let peerConnections = [];
let peerConnectionCounter = 0;
const peerConnectionData = new WeakMap();

export const removePeerConnection = pc => {
    peerConnections = peerConnections.filter(old => old !== pc);
};

if (window.RTCPeerConnection) {
    const OriginalRTCPeerConnection = window.RTCPeerConnection;
    function PatchedRTCPeerConnection(rtcConfig) {
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
    window.RTCPeerConnection = PatchedRTCPeerConnection;
}

export const getCurrentPeerConnections = () => peerConnections;

export const getPeerConnectionIndex = pc => peerConnectionData.get(pc)?.index;

export const setPeerConnectionsForTests = pcs => (peerConnections = pcs);
