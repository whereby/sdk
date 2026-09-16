import { browserWindow } from "../../../utils/environment";

let peerConnections: RTCPeerConnection[] = [];
let peerConnectionCounter = 0;
const peerConnectionData = new WeakMap<RTCPeerConnection, { index: number }>();

export const removePeerConnection = (pc: RTCPeerConnection) => {
    peerConnections = peerConnections.filter((old) => old !== pc);
};

const trackedWindow = browserWindow();
if (trackedWindow?.RTCPeerConnection) {
    const OriginalRTCPeerConnection = trackedWindow.RTCPeerConnection;
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
    (trackedWindow.RTCPeerConnection as any) = PatchedRTCPeerConnection;
}

export const getCurrentPeerConnections = () => peerConnections.filter((p) => p.connectionState !== "closed");
export const getPeerConnectionIndex = (pc: RTCPeerConnection) => peerConnectionData.get(pc)?.index;
export const setPeerConnectionsForTests = (pcs: RTCPeerConnection[]) => (peerConnections = pcs);
