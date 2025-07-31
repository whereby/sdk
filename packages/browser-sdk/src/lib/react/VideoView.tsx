import * as React from "react";
import { debounce } from "@whereby.com/core";
import { useAudioElement } from "./hooks/useAudioElement";
import { WherebyContext } from "./Provider";

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

export type VideoViewProps = VideoViewSelfProps &
    React.DetailedHTMLProps<React.VideoHTMLAttributes<WherebyVideoElement>, WherebyVideoElement>;

export const VideoView = React.forwardRef<WherebyVideoElement, VideoViewProps>(
    ({ muted, mirror = false, stream, onVideoResize, ...rest }, ref) => {
        const client = React.useContext(WherebyContext)?.getRoomConnectionClient();

        const videoEl = React.useRef<WherebyVideoElement>(null);
        const audioEl = useAudioElement({ muted, stream });

        React.useImperativeHandle(ref, () => {
            return Object.assign(videoEl.current!, {
                captureAspectRatio: () => {
                    if (!videoEl.current) {
                        return null;
                    }

                    const h = videoEl.current.videoHeight;
                    const w = videoEl.current.videoWidth;

                    if (w && h && w + h > 20) {
                        return w / h;
                    }
                    return null;
                },
            });
        });

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

                            client?.reportStreamResolution(stream.id, width, height);

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
