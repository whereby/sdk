import * as React from "react";
import { debounce, doRtcReportStreamResolution } from "@whereby.com/core";
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
    onVideoResize?: ({ width, height, stream }: { width: number; height: number; stream: MediaStream }) => void;
}

export type WherebyVideoElement = HTMLVideoElement & {
    captureAspectRatio: () => number;
    onVideoResize: ({ width, height, stream }: { width: number; height: number; stream: MediaStream }) => void;
};

type VideoViewProps = VideoViewSelfProps &
    React.DetailedHTMLProps<React.VideoHTMLAttributes<WherebyVideoElement>, WherebyVideoElement>;

type AudioElement = HTMLAudioElement & { setSinkId?: (deviceId: string) => void };

export const VideoView = React.forwardRef<WherebyVideoElement, VideoViewProps>(
    ({ muted, mirror = false, stream, onVideoResize, ...rest }, ref) => {
        const store = React.useContext(WherebyContext);

        if (!store) {
            throw new Error("VideoView must be used within a WherebyProvider");
        }

        const [videoViewState, setVideoViewState] = React.useState(initialState);
        const videoEl = React.useRef<WherebyVideoElement>(null);
        const audioEl = React.useRef<AudioElement>(null);

        React.useImperativeHandle(ref, () => {
            return Object.assign(videoEl.current!, {
                captureAspectRatio: () => {
                    if (!videoEl.current) {
                        return null;
                    }

                    const h = videoEl.current.clientHeight;
                    const w = videoEl.current.clientWidth;

                    if (w && h && w + h > 20) {
                        return w / h;
                    }
                    return null;
                },
            });
        });

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
                            const width = videoEl.current.clientWidth;
                            const height = videoEl.current.clientHeight;
                            store.dispatch(
                                doRtcReportStreamResolution({
                                    streamId: stream.id,
                                    width,
                                    height,
                                }),
                            );
                            if (onVideoResize) {
                                onVideoResize({
                                    width,
                                    height,
                                    stream,
                                });
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
    },
);

VideoView.displayName = "VideoView";
