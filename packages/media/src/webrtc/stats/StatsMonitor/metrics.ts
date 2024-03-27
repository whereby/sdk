export function captureCandidatePairInfoMetrics(
    cpMetrics: any,
    currentCptats: any,
    prevCptats: any,
    timeDiff: any,
    report: any
) {
    const bytesReceivedDiff = currentCptats.bytesReceived - (prevCptats?.bytesReceived || 0);
    const bytesSentDiff = currentCptats.bytesSent - (prevCptats?.bytesSent || 0);

    cpMetrics.bitrateIn = (8000 * bytesReceivedDiff) / timeDiff;
    cpMetrics.bitrateOut = (8000 * bytesSentDiff) / timeDiff;

    cpMetrics.state = currentCptats.state;
    cpMetrics.roundTripTime = currentCptats.currentRoundTripTime;

    cpMetrics.requestsSent = currentCptats.requestsSent;
    cpMetrics.responsesReceived = currentCptats.responsesReceived;
    cpMetrics.requestsReceived = currentCptats.requestsReceived;
    cpMetrics.responsesSent = currentCptats.responsesSent;
    cpMetrics.availableOutgoingBitrate = currentCptats.availableOutgoingBitrate;
    cpMetrics.availableIncomingBitrate = currentCptats.availableIncomingBitrate;

    const remote = report.get(currentCptats.remoteCandidateId);
    const local = report.get(currentCptats.localCandidateId);

    if (remote && local) {
        cpMetrics.localEp = `${local.protocol}:${local.address || local.ip}:${local.port} ${local.candidateType} (${
            local.networkType
        })`;
        cpMetrics.remoteEp = `${remote.protocol}:${remote.address || remote.ip}:${remote.port} ${remote.candidateType}`;
    }
}

export function captureSsrcInfo(
    ssrcMetrics: any,
    currentSsrcStats: any,
    prevSsrcStats: any,
    timeDiff: any,
    report: any
) {
    // we only update this until we receive codec stats
    if (ssrcMetrics.codec) return;

    ssrcMetrics.kind = currentSsrcStats.kind || currentSsrcStats.mediaType;
    ssrcMetrics.ssrc = currentSsrcStats.ssrc;
    ssrcMetrics.direction = currentSsrcStats.type === "inbound-rtp" ? "in" : "out";

    const codecStats = currentSsrcStats.codecId && report.get(currentSsrcStats.codecId);
    ssrcMetrics.codec =
        codecStats &&
        [
            codecStats.mimeType,
            codecStats.channels && `${codecStats.channels}ch`,
            codecStats.clockRate,
            codecStats.payloadType,
            currentSsrcStats.encoderImplementation || currentSsrcStats.decoderImplementation,
            codecStats.sdpFmtpLine,
        ]
            .filter(Boolean)
            .join(" ");

    ssrcMetrics.mid = currentSsrcStats.mid;
    ssrcMetrics.rid = currentSsrcStats.rid;
}

export function captureCommonSsrcMetrics(
    ssrcMetrics: any,
    currentSsrcStats: any,
    prevSsrcStats: any,
    timeDiff: any,
    report: any
) {
    const nackCountDiff = (currentSsrcStats.nackCount || 0) - (prevSsrcStats?.nackCount || 0);
    ssrcMetrics.nackCount = (ssrcMetrics.nackCount || 0) + nackCountDiff;
    ssrcMetrics.nackRate = (1000 * nackCountDiff) / timeDiff;

    if (ssrcMetrics.direction === "in") {
        const packetCountDiff = currentSsrcStats.packetsReceived - (prevSsrcStats?.packetsReceived || 0);
        ssrcMetrics.packetCount = (ssrcMetrics.packetCount || 0) + packetCountDiff;
        ssrcMetrics.packetRate = (1000 * packetCountDiff) / timeDiff;

        const packetLossCountDiff = currentSsrcStats.packetsLost - (prevSsrcStats?.packetsLost || 0);
        ssrcMetrics.packetLossCount = (ssrcMetrics.packetLossCount || 0) + packetLossCountDiff;
        ssrcMetrics.packetLossRate = (1000 * packetLossCountDiff) / timeDiff;
        ssrcMetrics.lossRatio = (1000 * (packetLossCountDiff / (packetLossCountDiff + packetCountDiff))) / timeDiff;

        const byteCountDiff = currentSsrcStats.bytesReceived - (prevSsrcStats?.bytesReceived || 0);
        ssrcMetrics.byteCount = (ssrcMetrics.byteCount || 0) + byteCountDiff;
        const headerByteCountDiff = currentSsrcStats.headerBytesReceived - (prevSsrcStats?.headerBytesReceived || 0);
        ssrcMetrics.headerByteCount = (ssrcMetrics.headerByteCount || 0) + headerByteCountDiff;
        const totalBytesDiff = byteCountDiff + headerByteCountDiff;
        ssrcMetrics.bitrate = (8000 * totalBytesDiff) / timeDiff;
        ssrcMetrics.mediaRatio = byteCountDiff / totalBytesDiff;

        if (currentSsrcStats.kind === "audio") {
            const fecBytesDiff = (currentSsrcStats.fecBytesReceived || 0) - (prevSsrcStats?.fecBytesReceived || 0);
            ssrcMetrics.fecRatio = fecBytesDiff / byteCountDiff;
        }

        const jitterBufferDelayDiff =
            (currentSsrcStats.jitterBufferDelay || 0) - (prevSsrcStats?.jitterBufferDelay || 0);
        const jitterBufferEmittedDiff =
            (currentSsrcStats.jitterBufferEmittedCount || 0) - (prevSsrcStats?.jitterBufferEmittedCount || 0);
        ssrcMetrics.jitter = jitterBufferEmittedDiff ? jitterBufferDelayDiff / jitterBufferEmittedDiff : 0;
    } else {
        const packetCountDiff = currentSsrcStats.packetsSent - (prevSsrcStats?.packetsSent || 0);
        ssrcMetrics.packetCount = (ssrcMetrics.packetCount || 0) + packetCountDiff;
        ssrcMetrics.packetRate = (1000 * packetCountDiff) / timeDiff;

        const byteCountDiff = currentSsrcStats.bytesSent - (prevSsrcStats?.bytesSent || 0);
        ssrcMetrics.byteCount = (ssrcMetrics.byteCount || 0) + byteCountDiff;
        const headerByteCountDiff = currentSsrcStats.headerBytesSent - (prevSsrcStats?.headerBytesSent || 0);
        ssrcMetrics.headerByteCount = (ssrcMetrics.headerByteCount || 0) + headerByteCountDiff;
        const totalBytesDiff = byteCountDiff + headerByteCountDiff;
        ssrcMetrics.bitrate = (8000 * totalBytesDiff) / timeDiff;
        ssrcMetrics.mediaRatio = byteCountDiff / totalBytesDiff;

        const sendDelayDiff = currentSsrcStats.totalPacketSendDelay - (prevSsrcStats?.totalPacketSendDelay || 0);
        ssrcMetrics.sendDelay = sendDelayDiff / packetCountDiff;

        const retransDiff = currentSsrcStats.retransmittedPacketsSent - (prevSsrcStats?.retransmittedPacketsSent || 0);
        ssrcMetrics.retransRatio = (1000 * (retransDiff / packetCountDiff)) / timeDiff;

        if (currentSsrcStats.remoteId) {
            const remoteReport = report.get(currentSsrcStats.remoteId);

            if (remoteReport) {
                ssrcMetrics.roundTripTime = remoteReport.roundTripTime || 0;
                ssrcMetrics.jitter = remoteReport.jitter || 0;
                ssrcMetrics.fractionLost = remoteReport.fractionLost || 0;
            }
        }
    }
}

export function captureAudioSsrcMetrics(
    ssrcMetrics: any,
    currentSsrcStats: any,
    prevSsrcStats: any,
    timeDiff: any,
    report: any
) {
    const packetsDiscardedDiff = currentSsrcStats.packetsDiscarded - (prevSsrcStats?.packetsDiscarded || 0);
    ssrcMetrics.packetsDiscarded = (ssrcMetrics.packetsDiscarded || 0) + packetsDiscardedDiff;

    if (ssrcMetrics.direction === "in") {
        const totalAudioEnergyDiff = currentSsrcStats.totalAudioEnergy - (prevSsrcStats?.totalAudioEnergy || 0);
        const totalSamplesDurationDiff =
            currentSsrcStats.totalSamplesDuration - (prevSsrcStats?.totalSamplesDuration || 0);
        ssrcMetrics.audioLevel = Math.sqrt(totalAudioEnergyDiff / totalSamplesDurationDiff);

        const samples = currentSsrcStats.totalSamplesReceived || 0;
        const concealmentEvents = currentSsrcStats.concealmentEvents || 0;
        const samplesDiff = samples - (prevSsrcStats?.totalSamplesReceived || 0);
        const concealedSamples = currentSsrcStats.concealedSamples || 0;
        const concealedDiff = concealedSamples - (prevSsrcStats?.concealedSamples || 0);
        const silentConcealedDiff =
            (currentSsrcStats.silentConcealedSamples || 0) - (prevSsrcStats?.silentConcealedSamples || 0);
        const insDiff =
            (currentSsrcStats.insertedSamplesForDeceleration || 0) -
            (prevSsrcStats?.insertedSamplesForDeceleration || 0);
        const remDiff =
            (currentSsrcStats.removedSamplesForAcceleration || 0) - (prevSsrcStats?.removedSamplesForAcceleration || 0);

        ssrcMetrics.audioSamples = samples;
        ssrcMetrics.audioConcealmentEvents = concealmentEvents;
        ssrcMetrics.audioConcealedSamples = concealedSamples;
        ssrcMetrics.audioConcealment = concealedDiff ? concealedDiff / samplesDiff : 0;
        ssrcMetrics.audioSilentConcealment = silentConcealedDiff ? silentConcealedDiff / samplesDiff : 0;
        ssrcMetrics.audioAcceleration = remDiff ? remDiff / samplesDiff : 0;
        ssrcMetrics.audioDeceleration = insDiff ? insDiff / samplesDiff : 0;
    }
}

export function captureVideoSsrcMetrics(
    ssrcMetrics: any,
    currentSsrcStats: any,
    prevSsrcStats: any,
    timeDiff: any,
    report: any
) {
    ssrcMetrics.width = currentSsrcStats.frameWidth;
    ssrcMetrics.height = currentSsrcStats.frameHeight;

    ssrcMetrics.qualityLimitationReason = currentSsrcStats.qualityLimitationReason || "";

    const pliCountDiff = currentSsrcStats.pliCount - (prevSsrcStats?.pliCount || 0);
    ssrcMetrics.pliCount = (ssrcMetrics.pliCount || 0) + pliCountDiff;
    ssrcMetrics.pliRate = (1000 * pliCountDiff) / timeDiff;
    const firCountDiff = currentSsrcStats.firCount - (prevSsrcStats?.firCount || 0);
    ssrcMetrics.firCount = (ssrcMetrics.firCount || 0) + firCountDiff;
    ssrcMetrics.firRate = (1000 * firCountDiff) / timeDiff;

    if (ssrcMetrics.direction === "in") {
        const kfCountDiff = currentSsrcStats.keyFramesDecoded - (prevSsrcStats?.keyFramesDecoded || 0);
        ssrcMetrics.kfCount = (ssrcMetrics.kfCount || 0) + kfCountDiff;
        ssrcMetrics.kfRate = (1000 * kfCountDiff) / timeDiff;

        const frameCountDiff = currentSsrcStats.framesDecoded - (prevSsrcStats?.framesDecoded || 0);
        ssrcMetrics.frameCount = (ssrcMetrics.frameCount || 0) + frameCountDiff;
        const qpsumDiff = currentSsrcStats.qpSum - (prevSsrcStats?.qpSum || 0);
        ssrcMetrics.qpf = qpsumDiff / frameCountDiff;
        ssrcMetrics.fps = (frameCountDiff * 1000) / timeDiff;
    } else {
        const kfCountDiff = currentSsrcStats.keyFramesEncoded - (prevSsrcStats?.keyFramesEncoded || 0);

        ssrcMetrics.kfCount = (ssrcMetrics.kfCount || 0) + kfCountDiff;
        ssrcMetrics.kfRate = (1000 * kfCountDiff) / timeDiff;

        const frameCountDiff = currentSsrcStats.framesEncoded - (prevSsrcStats?.framesEncoded || 0);
        ssrcMetrics.frameCount = (ssrcMetrics.frameCount || 0) + frameCountDiff;
        const qpsumDiff = currentSsrcStats.qpSum - (prevSsrcStats?.qpSum || 0);
        ssrcMetrics.qpf = qpsumDiff / frameCountDiff;
        ssrcMetrics.fps = (frameCountDiff * 1000) / timeDiff;

        const encodeTimeDiff = currentSsrcStats.totalEncodeTime - (prevSsrcStats?.totalEncodeTime || 0);
        ssrcMetrics.encodeTime = encodeTimeDiff / frameCountDiff;

        if (currentSsrcStats.mediaSourceId) {
            const mediaSourceReport = report.get(currentSsrcStats.mediaSourceId);

            if (mediaSourceReport) {
                ssrcMetrics.sourceWidth = mediaSourceReport.width || 0;
                ssrcMetrics.sourceHeight = mediaSourceReport.height || 0;
                ssrcMetrics.sourceFps = mediaSourceReport.framesPerSecond || 0;
            }
        }
    }
}
