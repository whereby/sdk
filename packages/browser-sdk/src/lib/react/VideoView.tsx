import * as React from "react";
import { debounce } from "@whereby.com/core";
import { createSelector } from "@reduxjs/toolkit";
import { WherebyContext } from "./Provider";
import { observeStore, selectCurrentSpeakerDeviceId } from "@whereby.com/core";

interface VideoViewState {
    speakerId: string;
}

const initialState = {
    speakerId: "",
};

const selectVideoViewState = createSelector(selectCurrentSpeakerDeviceId, (speakerId) => {
    const state: VideoViewState = {
        speakerId: speakerId || "default",
    };
    return state;
});

interface VideoViewSelfProps {
    stream: MediaStream;
    muted?: boolean;
    mirror?: boolean;
    style?: React.CSSProperties;
    onResize?: ({ width, height, stream }: { width: number; height: number; stream: MediaStream }) => void;
    onSetAspectRatio?: ({ aspectRatio }: { aspectRatio: number }) => void;
}

type VideoViewProps = VideoViewSelfProps &
    React.DetailedHTMLProps<React.VideoHTMLAttributes<HTMLVideoElement>, HTMLVideoElement>;

type AudioElement = HTMLAudioElement & { setSinkId?: (deviceId: string) => void };

export default ({ muted, mirror = false, stream, onResize, onSetAspectRatio, ...rest }: VideoViewProps) => {
    const store = React.useContext(WherebyContext);

    if (!store) {
        throw new Error("VideoView must be used within a WherebyProvider");
    }

    const [videoViewState, setVideoViewState] = React.useState(initialState);
    const videoEl = React.useRef<HTMLVideoElement>(null);
    const audioEl = React.useRef<AudioElement>(null);

    React.useEffect(() => {
        const unsubscribe = observeStore(store, selectVideoViewState, setVideoViewState);

        return () => {
            unsubscribe();
        };
    }, [store]);

    React.useEffect(() => {
        if (!videoEl.current) {
            return;
        }

        const resizeObserver = new ResizeObserver(
            debounce(
                () => {
                    if (videoEl.current && stream?.id) {
                        if (onResize) {
                            onResize({
                                width: videoEl.current.clientWidth,
                                height: videoEl.current.clientHeight,
                                stream,
                            });
                        }
                        const h = videoEl.current.videoHeight;
                        const w = videoEl.current.videoWidth;

                        if (onSetAspectRatio && w && h && w + h > 20) {
                            onSetAspectRatio({ aspectRatio: w / h });
                        }
                    }
                },
                { delay: 1000, edges: true },
            ),
        );

        resizeObserver.observe(videoEl.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, [stream]);

    React.useEffect(() => {
        if (!videoEl.current) {
            return;
        }

        if (videoEl.current.srcObject !== stream) {
            videoEl.current.srcObject = stream;
        }

        // Handle muting programatically, not as video attribute
        // https://stackoverflow.com/questions/14111917/html5-video-muted-but-still-playing
        if (videoEl.current.muted !== muted) {
            videoEl.current.muted = Boolean(muted);
        }
    }, [muted, stream, videoEl]);

    React.useEffect(() => {
        if (!audioEl.current || muted || !stream || !videoViewState.speakerId) {
            return;
        }

        if (audioEl.current.srcObject !== stream) {
            audioEl.current.srcObject = stream;
        }

        if (audioEl.current.setSinkId) {
            audioEl.current.setSinkId(videoViewState.speakerId);
        }
    }, [stream, audioEl, videoViewState.speakerId, muted]);

    return (
        <>
            <video
                ref={videoEl}
                autoPlay
                playsInline
                {...rest}
                style={{ transform: mirror ? "scaleX(-1)" : "none", width: "100%", height: "100%", ...rest.style }}
            />
            <audio ref={audioEl} autoPlay playsInline />
        </>
    );
};
