import { BandwidthCheck } from "./checks/bandwidthCheck";
import { CameraCheck } from "./checks/cameraCheck";
import { MicrophoneCheck } from "./checks/microphoneCheck";
import { useCheckFactory } from "./useCheck";
import { useCheckRunnerFactory } from "./useCheckRunner";

const useBandwidthCheck = useCheckFactory("bandwidth", new BandwidthCheck(), {
    description: "Checks whether your connection has enough bandwidth for a satisfactory call experience",
});
const useCameraCheck = useCheckFactory("camera", new CameraCheck(), {
    description: "Tries to get access to your local camera and verify the ability to retrieve a video track",
});
const useMicrophoneCheck = useCheckFactory("microphone", new MicrophoneCheck(), {
    description: "Checks whether you have or are able to give microphone permissions",
});

export const usePreCallCheck = useCheckRunnerFactory({
    camera: useCameraCheck,
    microphone: useMicrophoneCheck,
    bandwidth: useBandwidthCheck,
});
