import React from "react";
import { VideoView } from "../../lib/react";
import { UseLocalMediaResult } from "../../lib/react/useLocalMedia/types";

interface PrecallExperienceProps extends UseLocalMediaResult {
    hideVideoPreview?: boolean;
}

export default function PrecallExperience(props: PrecallExperienceProps) {
    const { state, actions, hideVideoPreview } = props;

    const {
        currentCameraDeviceId,
        currentMicrophoneDeviceId,
        currentSpeakerDeviceId,
        cameraDevices,
        isCameraEnabled,
        isMicrophoneEnabled,
        localStream,
        microphoneDevices,
        speakerDevices,
    } = state;
    const { setCameraDevice, setMicrophoneDevice, setSpeakerDevice, toggleCameraEnabled, toggleMicrophoneEnabled } =
        actions;

    return (
        <div>
            <div style={{ display: "flex" }}>
                <div style={{ border: "1px solid grey" }}>
                    <label>Camera devices:</label>
                    {cameraDevices.map((d) => (
                        <p
                            style={{ backgroundColor: d.deviceId === currentCameraDeviceId ? "green" : "inherit" }}
                            key={d.deviceId}
                            onClick={() => {
                                if (d.deviceId !== currentCameraDeviceId) {
                                    setCameraDevice(d.deviceId);
                                }
                            }}
                        >
                            {d.label}
                        </p>
                    ))}
                </div>

                <div style={{ border: "1px solid grey" }}>
                    <label>Microphone devices:</label>
                    {microphoneDevices.map((d) => (
                        <p
                            style={{ backgroundColor: d.deviceId === currentMicrophoneDeviceId ? "green" : "inherit" }}
                            key={d.deviceId}
                            onClick={() => {
                                if (d.deviceId !== currentMicrophoneDeviceId) {
                                    setMicrophoneDevice(d.deviceId);
                                }
                            }}
                        >
                            {d.label}
                        </p>
                    ))}
                </div>

                <div style={{ border: "1px solid grey" }}>
                    <label>Speaker devices:</label>
                    {speakerDevices.map((d) => (
                        <p
                            style={{ backgroundColor: d.deviceId === currentSpeakerDeviceId ? "green" : "inherit" }}
                            key={d.deviceId}
                            onClick={() => {
                                if (d.deviceId !== currentSpeakerDeviceId) {
                                    setSpeakerDevice(d.deviceId);
                                }
                            }}
                        >
                            {d.label}
                        </p>
                    ))}
                </div>
            </div>
            <div className="controls">
                <strong>Camera: {isCameraEnabled ? "on" : "off"}</strong>
                <button onClick={() => toggleCameraEnabled()}>Toggle camera</button>
                <button onClick={() => toggleCameraEnabled(false)}>Camera off</button>
                <button onClick={() => toggleCameraEnabled(true)}>Camera on</button>
            </div>
            <div className="controls">
                <strong>Microphone: {isMicrophoneEnabled ? "on" : "off"}</strong>
                <button onClick={() => toggleMicrophoneEnabled()}>Toggle microphone</button>
                <button onClick={() => toggleMicrophoneEnabled(false)}>Microphone off</button>
                <button onClick={() => toggleMicrophoneEnabled(true)}>Microphone on</button>
            </div>
            {!hideVideoPreview && <div>{localStream && <VideoView muted stream={localStream} />}</div>}
        </div>
    );
}
