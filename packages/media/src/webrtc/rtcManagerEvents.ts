import { RtcEvents } from "./types";

const events: Record<string, keyof RtcEvents> = {
    CAMERA_NOT_WORKING: "camera_not_working",
    CONNECTION_BLOCKED_BY_NETWORK: "connection_blocked_by_network",
    ICE_IPV6_SEEN: "ice_ipv6_seen",
    ICE_MDNS_SEEN: "ice_mdns_seen",
    ICE_NO_PUBLIC_IP_GATHERED: "ice_no_public_ip_gathered",
    ICE_NO_PUBLIC_IP_GATHERED_3SEC: "ice_no_public_ip_gathered_3sec",
    ICE_RESTART: "ice_restart",
    MICROPHONE_NOT_WORKING: "microphone_not_working",
    MICROPHONE_STOPPED_WORKING: "microphone_stopped_working",
    CAMERA_STOPPED_WORKING: "camera_stopped_working",
    NEW_PC: "new_pc",
    SFU_CONNECTION_OPEN: "sfu_connection_open",
    SFU_CONNECTION_CLOSED: "sfu_connection_closed",
    SFU_CONNECTION_INFO: "sfu_connection_info",
    COLOCATION_SPEAKER: "colocation_speaker",
    DOMINANT_SPEAKER: "dominant_speaker",
    PC_SLD_FAILURE: "pc_sld_failure",
    PC_ON_ANSWER_FAILURE: "pc_on_answer_failure",
    PC_ON_OFFER_FAILURE: "pc_on_offer_failure",
};

export default events;
