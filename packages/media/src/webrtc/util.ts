import { AudioOnlyMode } from "./types";

export function resolveAudioOnlyModeChanges({
    previousAudioOnlyMode,
    nextAudioOnlyMode,
}: {
    previousAudioOnlyMode: AudioOnlyMode;
    nextAudioOnlyMode: AudioOnlyMode;
}) {
    const wasConsumingWebcam = previousAudioOnlyMode === "off";
    const wasConsumingScreenshare =
        previousAudioOnlyMode === "off" || previousAudioOnlyMode === "allowScreenshareVideo";

    const wantsWebcam = nextAudioOnlyMode === "off";
    const wantsScreenshare = nextAudioOnlyMode === "allowScreenshareVideo" || nextAudioOnlyMode === "off";

    return {
        startWebcam: !wasConsumingWebcam && wantsWebcam,
        startScreenshare: !wasConsumingScreenshare && wantsScreenshare,
        stopWebcam: wasConsumingWebcam && !wantsWebcam,
        stopScreenshare: wasConsumingScreenshare && !wantsScreenshare,
    };
}
