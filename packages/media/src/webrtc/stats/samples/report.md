### media-playout

| Property                   | chrome_139_macos_15 | firefox_141_macos_15 | safari_18_macos_15 |
| -------------------------- | ------------------- | -------------------- | ------------------ |
| id                         | ✅                  | ❌                   | ❌                 |
| timestamp                  | ✅                  | ❌                   | ❌                 |
| type                       | ✅                  | ❌                   | ❌                 |
| kind                       | ✅                  | ❌                   | ❌                 |
| synthesizedSamplesDuration | ✅                  | ❌                   | ❌                 |
| synthesizedSamplesEvents   | ✅                  | ❌                   | ❌                 |
| totalPlayoutDelay          | ✅                  | ❌                   | ❌                 |
| totalSamplesCount          | ✅                  | ❌                   | ❌                 |
| totalSamplesDuration       | ✅                  | ❌                   | ❌                 |

### certificate

| Property             | chrome_139_macos_15 | firefox_141_macos_15 | safari_18_macos_15 |
| -------------------- | ------------------- | -------------------- | ------------------ |
| id                   | ✅                  | ❌                   | ✅                 |
| timestamp            | ✅                  | ❌                   | ✅                 |
| type                 | ✅                  | ❌                   | ✅                 |
| base64Certificate    | ✅                  | ❌                   | ✅                 |
| fingerprint          | ✅                  | ❌                   | ✅                 |
| fingerprintAlgorithm | ✅                  | ❌                   | ✅                 |

### codec

| Property    | chrome_139_macos_15 | firefox_141_macos_15 | safari_18_macos_15 |
| ----------- | ------------------- | -------------------- | ------------------ |
| id          | ✅                  | ✅                   | ✅                 |
| timestamp   | ✅                  | ✅                   | ✅                 |
| type        | ✅                  | ✅                   | ✅                 |
| channels    | ✅                  | ✅                   | ✅                 |
| clockRate   | ✅                  | ✅                   | ✅                 |
| mimeType    | ✅                  | ✅                   | ✅                 |
| payloadType | ✅                  | ✅                   | ✅                 |
| sdpFmtpLine | ✅                  | ✅                   | ✅                 |
| transportId | ✅                  | ✅                   | ✅                 |
| codecType   | ❌                  | ✅                   | ❌                 |

### candidate-pair

| Property                    | chrome_139_macos_15 | firefox_141_macos_15 | safari_18_macos_15 |
| --------------------------- | ------------------- | -------------------- | ------------------ |
| id                          | ✅                  | ✅                   | ✅                 |
| timestamp                   | ✅                  | ✅                   | ✅                 |
| type                        | ✅                  | ✅                   | ✅                 |
| availableOutgoingBitrate    | ✅                  | ❌                   | ✅                 |
| bytesDiscardedOnSend        | ✅                  | ❌                   | ✅                 |
| bytesReceived               | ✅                  | ✅                   | ✅                 |
| bytesSent                   | ✅                  | ✅                   | ✅                 |
| consentRequestsSent         | ✅                  | ❌                   | ✅                 |
| currentRoundTripTime        | ✅                  | ❌                   | ✅                 |
| lastPacketReceivedTimestamp | ✅                  | ✅                   | ✅                 |
| lastPacketSentTimestamp     | ✅                  | ✅                   | ✅                 |
| localCandidateId            | ✅                  | ✅                   | ✅                 |
| nominated                   | ✅                  | ✅                   | ✅                 |
| packetsDiscardedOnSend      | ✅                  | ❌                   | ✅                 |
| packetsReceived             | ✅                  | ❌                   | ✅                 |
| packetsSent                 | ✅                  | ❌                   | ✅                 |
| priority                    | ✅                  | ✅                   | ❌                 |
| remoteCandidateId           | ✅                  | ✅                   | ✅                 |
| requestsReceived            | ✅                  | ❌                   | ✅                 |
| requestsSent                | ✅                  | ❌                   | ✅                 |
| responsesReceived           | ✅                  | ❌                   | ✅                 |
| responsesSent               | ✅                  | ❌                   | ✅                 |
| state                       | ✅                  | ✅                   | ✅                 |
| totalRoundTripTime          | ✅                  | ❌                   | ✅                 |
| transportId                 | ✅                  | ✅                   | ✅                 |
| writable                    | ✅                  | ✅                   | ❌                 |
| readable                    | ❌                  | ✅                   | ❌                 |
| selected                    | ❌                  | ✅                   | ❌                 |

### local-candidate

| Property         | chrome_139_macos_15 | firefox_141_macos_15 | safari_18_macos_15 |
| ---------------- | ------------------- | -------------------- | ------------------ |
| id               | ✅                  | ✅                   | ✅                 |
| timestamp        | ✅                  | ✅                   | ✅                 |
| type             | ✅                  | ✅                   | ✅                 |
| address          | ✅                  | ✅                   | ❌                 |
| candidateType    | ✅                  | ✅                   | ✅                 |
| foundation       | ✅                  | ❌                   | ✅                 |
| ip               | ✅                  | ❌                   | ❌                 |
| isRemote         | ✅                  | ❌                   | ❌                 |
| networkType      | ✅                  | ❌                   | ❌                 |
| port             | ✅                  | ✅                   | ✅                 |
| priority         | ✅                  | ✅                   | ✅                 |
| protocol         | ✅                  | ✅                   | ✅                 |
| transportId      | ✅                  | ❌                   | ✅                 |
| usernameFragment | ✅                  | ❌                   | ✅                 |

### inbound-rtp

| Property                           | chrome_139_macos_15 | firefox_141_macos_15 | safari_18_macos_15 |
| ---------------------------------- | ------------------- | -------------------- | ------------------ |
| id                                 | ✅                  | ✅                   | ✅                 |
| timestamp                          | ✅                  | ✅                   | ✅                 |
| type                               | ✅                  | ✅                   | ✅                 |
| codecId                            | ✅                  | ✅                   | ✅                 |
| kind                               | ✅                  | ✅                   | ✅                 |
| mediaType                          | ✅                  | ✅                   | ❌                 |
| ssrc                               | ✅                  | ✅                   | ✅                 |
| transportId                        | ✅                  | ❌                   | ✅                 |
| jitter                             | ✅                  | ✅                   | ✅                 |
| packetsLost                        | ✅                  | ✅                   | ✅                 |
| packetsReceived                    | ✅                  | ✅                   | ✅                 |
| audioLevel                         | ✅                  | ✅                   | ✅                 |
| bytesReceived                      | ✅                  | ✅                   | ✅                 |
| concealedSamples                   | ✅                  | ✅                   | ✅                 |
| concealmentEvents                  | ✅                  | ✅                   | ✅                 |
| estimatedPlayoutTimestamp          | ✅                  | ❌                   | ✅                 |
| fecPacketsDiscarded                | ✅                  | ✅                   | ✅                 |
| fecPacketsReceived                 | ✅                  | ✅                   | ✅                 |
| headerBytesReceived                | ✅                  | ✅                   | ✅                 |
| insertedSamplesForDeceleration     | ✅                  | ✅                   | ✅                 |
| jitterBufferDelay                  | ✅                  | ✅                   | ✅                 |
| jitterBufferEmittedCount           | ✅                  | ✅                   | ✅                 |
| jitterBufferMinimumDelay           | ✅                  | ❌                   | ✅                 |
| jitterBufferTargetDelay            | ✅                  | ❌                   | ✅                 |
| lastPacketReceivedTimestamp        | ✅                  | ✅                   | ✅                 |
| mid                                | ✅                  | ✅                   | ✅                 |
| packetsDiscarded                   | ✅                  | ✅                   | ✅                 |
| playoutId                          | ✅                  | ❌                   | ❌                 |
| remoteId                           | ✅                  | ✅                   | ✅                 |
| removedSamplesForAcceleration      | ✅                  | ✅                   | ✅                 |
| silentConcealedSamples             | ✅                  | ✅                   | ✅                 |
| totalAudioEnergy                   | ✅                  | ✅                   | ✅                 |
| totalProcessingDelay               | ✅                  | ✅                   | ✅                 |
| totalSamplesDuration               | ✅                  | ✅                   | ✅                 |
| totalSamplesReceived               | ✅                  | ✅                   | ✅                 |
| trackIdentifier                    | ✅                  | ✅                   | ✅                 |
| decoderImplementation              | ✅                  | ❌                   | ❌                 |
| firCount                           | ✅                  | ✅                   | ✅                 |
| frameHeight                        | ✅                  | ✅                   | ✅                 |
| frameWidth                         | ✅                  | ✅                   | ✅                 |
| framesAssembledFromMultiplePackets | ✅                  | ❌                   | ✅                 |
| framesDecoded                      | ✅                  | ✅                   | ✅                 |
| framesDropped                      | ✅                  | ✅                   | ✅                 |
| framesPerSecond                    | ✅                  | ✅                   | ✅                 |
| framesReceived                     | ✅                  | ✅                   | ✅                 |
| freezeCount                        | ✅                  | ❌                   | ✅                 |
| googTimingFrameInfo                | ✅                  | ❌                   | ❌                 |
| keyFramesDecoded                   | ✅                  | ❌                   | ✅                 |
| nackCount                          | ✅                  | ✅                   | ✅                 |
| pauseCount                         | ✅                  | ❌                   | ✅                 |
| pliCount                           | ✅                  | ✅                   | ✅                 |
| powerEfficientDecoder              | ✅                  | ❌                   | ❌                 |
| retransmittedBytesReceived         | ✅                  | ❌                   | ✅                 |
| retransmittedPacketsReceived       | ✅                  | ❌                   | ✅                 |
| rtxSsrc                            | ✅                  | ❌                   | ✅                 |
| totalAssemblyTime                  | ✅                  | ❌                   | ✅                 |
| totalDecodeTime                    | ✅                  | ✅                   | ✅                 |
| totalFreezesDuration               | ✅                  | ❌                   | ✅                 |
| totalInterFrameDelay               | ✅                  | ✅                   | ✅                 |
| totalPausesDuration                | ✅                  | ❌                   | ✅                 |
| totalSquaredInterFrameDelay        | ✅                  | ✅                   | ✅                 |
| discardedPackets                   | ❌                  | ✅                   | ❌                 |
| qpSum                              | ❌                  | ✅                   | ❌                 |

### remote-candidate

| Property         | chrome_139_macos_15 | firefox_141_macos_15 | safari_18_macos_15 |
| ---------------- | ------------------- | -------------------- | ------------------ |
| id               | ✅                  | ✅                   | ✅                 |
| timestamp        | ✅                  | ✅                   | ✅                 |
| type             | ✅                  | ✅                   | ✅                 |
| address          | ✅                  | ✅                   | ❌                 |
| candidateType    | ✅                  | ✅                   | ✅                 |
| foundation       | ✅                  | ❌                   | ✅                 |
| ip               | ✅                  | ❌                   | ❌                 |
| isRemote         | ✅                  | ❌                   | ❌                 |
| port             | ✅                  | ✅                   | ✅                 |
| priority         | ✅                  | ✅                   | ✅                 |
| protocol         | ✅                  | ✅                   | ✅                 |
| transportId      | ✅                  | ❌                   | ✅                 |
| usernameFragment | ✅                  | ❌                   | ✅                 |

### outbound-rtp

| Property                           | chrome_139_macos_15 | firefox_141_macos_15 | safari_18_macos_15 |
| ---------------------------------- | ------------------- | -------------------- | ------------------ |
| id                                 | ✅                  | ✅                   | ✅                 |
| timestamp                          | ✅                  | ✅                   | ✅                 |
| type                               | ✅                  | ✅                   | ✅                 |
| codecId                            | ✅                  | ✅                   | ✅                 |
| kind                               | ✅                  | ✅                   | ✅                 |
| mediaType                          | ✅                  | ✅                   | ❌                 |
| ssrc                               | ✅                  | ✅                   | ✅                 |
| transportId                        | ✅                  | ❌                   | ✅                 |
| bytesSent                          | ✅                  | ✅                   | ✅                 |
| packetsSent                        | ✅                  | ✅                   | ✅                 |
| active                             | ✅                  | ❌                   | ✅                 |
| headerBytesSent                    | ✅                  | ✅                   | ✅                 |
| mediaSourceId                      | ✅                  | ❌                   | ✅                 |
| mid                                | ✅                  | ✅                   | ✅                 |
| nackCount                          | ✅                  | ✅                   | ✅                 |
| remoteId                           | ✅                  | ✅                   | ✅                 |
| retransmittedBytesSent             | ✅                  | ✅                   | ✅                 |
| retransmittedPacketsSent           | ✅                  | ✅                   | ✅                 |
| targetBitrate                      | ✅                  | ❌                   | ✅                 |
| totalPacketSendDelay               | ✅                  | ❌                   | ✅                 |
| encoderImplementation              | ✅                  | ❌                   | ❌                 |
| encodingIndex                      | ✅                  | ❌                   | ❌                 |
| firCount                           | ✅                  | ✅                   | ✅                 |
| frameHeight                        | ✅                  | ✅                   | ✅                 |
| frameWidth                         | ✅                  | ✅                   | ✅                 |
| framesEncoded                      | ✅                  | ✅                   | ✅                 |
| framesPerSecond                    | ✅                  | ✅                   | ✅                 |
| framesSent                         | ✅                  | ✅                   | ✅                 |
| hugeFramesSent                     | ✅                  | ✅                   | ✅                 |
| keyFramesEncoded                   | ✅                  | ❌                   | ✅                 |
| pliCount                           | ✅                  | ✅                   | ✅                 |
| powerEfficientEncoder              | ✅                  | ❌                   | ❌                 |
| qpSum                              | ✅                  | ✅                   | ✅                 |
| qualityLimitationDurations         | ✅                  | ❌                   | ✅                 |
| qualityLimitationReason            | ✅                  | ❌                   | ✅                 |
| qualityLimitationResolutionChanges | ✅                  | ❌                   | ✅                 |
| rtxSsrc                            | ✅                  | ❌                   | ✅                 |
| scalabilityMode                    | ✅                  | ❌                   | ✅                 |
| totalEncodeTime                    | ✅                  | ✅                   | ✅                 |
| totalEncodedBytesTarget            | ✅                  | ✅                   | ✅                 |

### peer-connection

| Property           | chrome_139_macos_15 | firefox_141_macos_15 | safari_18_macos_15 |
| ------------------ | ------------------- | -------------------- | ------------------ |
| id                 | ✅                  | ✅                   | ✅                 |
| timestamp          | ✅                  | ✅                   | ✅                 |
| type               | ✅                  | ✅                   | ✅                 |
| dataChannelsClosed | ✅                  | ✅                   | ✅                 |
| dataChannelsOpened | ✅                  | ✅                   | ✅                 |

### remote-inbound-rtp

| Property                  | chrome_139_macos_15 | firefox_141_macos_15 | safari_18_macos_15 |
| ------------------------- | ------------------- | -------------------- | ------------------ |
| id                        | ✅                  | ✅                   | ✅                 |
| timestamp                 | ✅                  | ✅                   | ✅                 |
| type                      | ✅                  | ✅                   | ✅                 |
| codecId                   | ✅                  | ✅                   | ✅                 |
| kind                      | ✅                  | ✅                   | ✅                 |
| mediaType                 | ✅                  | ✅                   | ❌                 |
| ssrc                      | ✅                  | ✅                   | ✅                 |
| transportId               | ✅                  | ❌                   | ✅                 |
| jitter                    | ✅                  | ✅                   | ✅                 |
| packetsLost               | ✅                  | ✅                   | ✅                 |
| fractionLost              | ✅                  | ✅                   | ✅                 |
| localId                   | ✅                  | ✅                   | ✅                 |
| roundTripTime             | ✅                  | ✅                   | ✅                 |
| roundTripTimeMeasurements | ✅                  | ✅                   | ✅                 |
| totalRoundTripTime        | ✅                  | ✅                   | ✅                 |
| packetsReceived           | ❌                  | ✅                   | ❌                 |

### remote-outbound-rtp

| Property                  | chrome_139_macos_15 | firefox_141_macos_15 | safari_18_macos_15 |
| ------------------------- | ------------------- | -------------------- | ------------------ |
| id                        | ✅                  | ✅                   | ✅                 |
| timestamp                 | ✅                  | ✅                   | ✅                 |
| type                      | ✅                  | ✅                   | ✅                 |
| codecId                   | ✅                  | ✅                   | ✅                 |
| kind                      | ✅                  | ✅                   | ✅                 |
| mediaType                 | ✅                  | ✅                   | ❌                 |
| ssrc                      | ✅                  | ✅                   | ✅                 |
| transportId               | ✅                  | ❌                   | ✅                 |
| bytesSent                 | ✅                  | ✅                   | ✅                 |
| packetsSent               | ✅                  | ✅                   | ✅                 |
| localId                   | ✅                  | ✅                   | ✅                 |
| remoteTimestamp           | ✅                  | ✅                   | ✅                 |
| reportsSent               | ✅                  | ❌                   | ✅                 |
| roundTripTimeMeasurements | ✅                  | ❌                   | ✅                 |
| totalRoundTripTime        | ✅                  | ❌                   | ✅                 |

### media-source

| Property                  | chrome_139_macos_15 | firefox_141_macos_15 | safari_18_macos_15 |
| ------------------------- | ------------------- | -------------------- | ------------------ |
| id                        | ✅                  | ✅                   | ✅                 |
| timestamp                 | ✅                  | ✅                   | ✅                 |
| type                      | ✅                  | ✅                   | ✅                 |
| kind                      | ✅                  | ✅                   | ✅                 |
| trackIdentifier           | ✅                  | ✅                   | ✅                 |
| audioLevel                | ✅                  | ❌                   | ✅                 |
| echoReturnLoss            | ✅                  | ❌                   | ❌                 |
| echoReturnLossEnhancement | ✅                  | ❌                   | ❌                 |
| totalAudioEnergy          | ✅                  | ❌                   | ✅                 |
| totalSamplesDuration      | ✅                  | ❌                   | ✅                 |
| frames                    | ✅                  | ✅                   | ✅                 |
| framesPerSecond           | ✅                  | ✅                   | ✅                 |
| height                    | ✅                  | ✅                   | ❌                 |
| width                     | ✅                  | ✅                   | ❌                 |

### transport

| Property                     | chrome_139_macos_15 | firefox_141_macos_15 | safari_18_macos_15 |
| ---------------------------- | ------------------- | -------------------- | ------------------ |
| id                           | ✅                  | ❌                   | ✅                 |
| timestamp                    | ✅                  | ❌                   | ✅                 |
| type                         | ✅                  | ❌                   | ✅                 |
| bytesReceived                | ✅                  | ❌                   | ✅                 |
| bytesSent                    | ✅                  | ❌                   | ✅                 |
| dtlsCipher                   | ✅                  | ❌                   | ✅                 |
| dtlsRole                     | ✅                  | ❌                   | ✅                 |
| dtlsState                    | ✅                  | ❌                   | ✅                 |
| iceLocalUsernameFragment     | ✅                  | ❌                   | ✅                 |
| iceRole                      | ✅                  | ❌                   | ✅                 |
| iceState                     | ✅                  | ❌                   | ✅                 |
| localCertificateId           | ✅                  | ❌                   | ✅                 |
| packetsReceived              | ✅                  | ❌                   | ✅                 |
| packetsSent                  | ✅                  | ❌                   | ✅                 |
| remoteCertificateId          | ✅                  | ❌                   | ✅                 |
| selectedCandidatePairChanges | ✅                  | ❌                   | ✅                 |
| selectedCandidatePairId      | ✅                  | ❌                   | ✅                 |
| srtpCipher                   | ✅                  | ❌                   | ✅                 |
| tlsVersion                   | ✅                  | ❌                   | ✅                 |

