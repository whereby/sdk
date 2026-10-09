export const MEDIA_JITTER_BUFFER_TARGET = 400; // milliseconds;

// the spatial layer a new consumer is assumed to start at. There's deliberately no initial temporal layer: it starts
// unset, so the first updateStreamResolution() always sends the preferred layers and the client takes control of them
export const INITIAL_CONSUMER_SPATIAL_LAYER = 1;

// the webcam starts capped at this layer until the SFU reports what its consumers actually demand
export const INITIAL_HIGHEST_PREFERRED_LAYER = 1;

export const LOWEST_SVC_LAYER_MAX_BITRATE = 100_000;
export const MIDDLE_SVC_LAYER_MAX_BITRATE = 500_000;

export const PREFERRED_LAYER_SWITCH_POLL_INTERVAL_MS = 100;
export const PREFERRED_LAYER_SWITCH_WATCH_TIMEOUT_MS = 10_000;
// a layout change can switch every consumer's layer at once, and each watch polls getStats(), so only this many are
// measured at a time
export const MAX_CONCURRENT_PREFERRED_LAYER_SWITCH_WATCHES = 5;

// a sample (one per stats poll with new remote reports) counts the cam upload as congested when its round-trip time is
// this far above the lowest seen (time queued on the way), or more than this fraction of packets is lost. Being held
// back by the bandwidth estimate doesn't count: that's demand above the estimate, not congestion, and it's reported on
// its own by the IssueMonitor's quality-limitation-bandwidth issue
export const CONGESTED_RTT_INFLATION_MS = 100;
export const CONGESTED_FRACTION_LOST = 0.02;

// after a candidate pair change the first reports may still have come over, or be measured partly over, the old
// route (a receiver report answering a sender report sent before the switch), so don't let them into the new path
export const CAM_SAMPLES_SKIPPED_AFTER_CANDIDATE_PAIR_CHANGE = 2;
