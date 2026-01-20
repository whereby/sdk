import { MediaSourceKind } from "../webrtc";

type TrackAnnotation = {
    sourceKind: MediaSourceKind;
};

const _trackAnnotations = new WeakMap();

export function trackAnnotations(o: MediaStreamTrack): TrackAnnotation {
    let props = _trackAnnotations.get(o);
    if (!props) {
        props = {};
        _trackAnnotations.set(o, props);
    }
    return props;
}
