## Samples

All these samples have been collected using our own PWA in P2P mode by defining the peerConnections in `peerConnectionTracker` as global.

### inbound-rtp

| Chrome 139 (MacOS Sequoia 15.0)                           | Safari 18 (MacOS Sequoia 15.0)                            | Firefox 141                                                 |
|-----------------------------------------------------------|-----------------------------------------------------------|-------------------------------------------------------------|
| "audioLevel": 0                                           | "audioLevel": 0.00003051850947599719                      | "audioLevel": 0,                                            |
| "bytesReceived": 26981,                                   | "bytesReceived": 1136866                                  | "bytesReceived": 3693,                                      |
| "codecId": "CIT01_111_minptime=10;useinbandfec=1",        | "codecId": "CIT01_111_minptime=10;useinbandfec=1"         | "codecId": "f616fb56",                                      |
| "concealedSamples": 0                                     | "concealedSamples": 10080                                 | "concealedSamples": 1440,                                   |
| "concealmentEvents": 0                                    | "concealmentEvents": 11                                   | "concealmentEvents": 1,                                     |
| "estimatedPlayoutTimestamp": 3964058305647,               | "estimatedPlayoutTimestamp": 3964059897904                | <MISSING>                                                   |
| "fecPacketsDiscarded": 0,                                 | "fecPacketsDiscarded": 0,                                 | "fecPacketsDiscarded": 0,                                   |
| "fecPacketsReceived": 0,                                  | "fecPacketsReceived": 0,                                  | "fecPacketsReceived": 0,                                    |
| "headerBytesReceived": 21588,                             | "headerBytesReceived": 909496,                            | "headerBytesReceived": 24620,                               |
| "id": "IT01A2116713204",                                  | "id": "IT01A2641277155",                                  | "id": "9c17f05a",                                           |
| "insertedSamplesForDeceleration": 1080,                   | "insertedSamplesForDeceleration": 1200,                   | "insertedSamplesForDeceleration": 1200,                     |
| "jitter": 0,                                              | "jitter": 0.001,                                          | "jitter": 0.002,                                            |
| "jitterBufferDelay": 21772.8,                             | "jitterBufferDelay": 1699344,                             | "jitterBufferDelay": 46262.4,                               |
| "jitterBufferEmittedCount": 739200,                       | "jitterBufferEmittedCount": 31179840,                     | "jitterBufferEmittedCount": 1179840,                        |
| "jitterBufferMinimumDelay": 16339.2,                      | "jitterBufferMinimumDelay": 1264473.6,                    | <MISSING>                                                   |
| "jitterBufferTargetDelay": 16339.2,                       | "jitterBufferTargetDelay": 1264627.2,                     | <MISSING>                                                   |
| "kind": "audio",                                          | "kind": "audio",                                          | "kind": "audio",                                            |
| "lastPacketReceivedTimestamp": 1755069505714.066,         | "lastPacketReceivedTimestamp": 1755071097965.287,         | "lastPacketReceivedTimestamp": 1755090103944,               |
| "mediaType": "audio",                                     | <MISSING>                                                 | "mediaType": "audio",                                       |
| "mid": "0",                                               | "mid": "0",                                               | "mid": "0",                                                 |
| "packetsDiscarded": 0,                                    | "packetsDiscarded": 0,                                    | "packetsDiscarded": 0,                                      |
| "packetsLost": 0,                                         | "packetsLost": 0,                                         | "packetsLost": 0,                                           |
| "packetsReceived": 771,                                   | "packetsReceived": 32482,                                 | "packetsReceived": 1231,                                    |
| "playoutId": "AP",                                        | <MISSING>                                                 | <MISSING>                                                   |
| "remoteId": "ROA2116713204",                              | "remoteId": "ROA2641277155",                              | "remoteId": "28544a3e",                                     |
| "removedSamplesForAcceleration": 0,                       | "removedSamplesForAcceleration": 6600,                    | "removedSamplesForAcceleration": 1200,                      |
| "silentConcealedSamples": 0,                              | "silentConcealedSamples": 2280,                           | "silentConcealedSamples": 0,                                |
| "ssrc": 2116713204,                                       | "ssrc": 2641277155,                                       | "ssrc": 821510199,                                          |
| "timestamp": 1755069505730.393,                           | "timestamp": 1755071098018.0002,                          | "timestamp": 1755090103946,                                 |
| "totalAudioEnergy": 1.0245173627001832e-10,               | "totalAudioEnergy": 6.05303485471877e-7,                  | "totalAudioEnergy": 0,                                      |
| "totalProcessingDelay": 20626.09728,                      | <MISSING>                                                 | <MISSING>                                                   |
| "totalSamplesDuration": 15.449999999999715,               | "totalSamplesDuration": 649.6699999995542,                | "totalSamplesDuration": 24.640000000001052,                 |
| "totalSamplesReceived": 740160,                           | "totalSamplesReceived": 31184160,                         | "totalSamplesReceived": 1180800,                            |
| "trackIdentifier": "de37781a-a495-41e7-8150-3d32b3d9c1cf" | "trackIdentifier": "6b084027-fb90-4baa-a795-0b26b501b124" | "trackIdentifier": "{514026b4-a61e-4833-93a9-0f489c80a142}" |
| "transportId": "T01",                                     | "transportId": "T01",                                     | <MISSING>                                                   |
| "type": "inbound-rtp",                                    | "type": "inbound-rtp",                                    | "type": "inbound-rtp",                                      |

