---
"@whereby.com/media": minor
---

Emit STREAM_ADDED from P2PRtcManager each time a remote stream gains a track, so a late audio track is played. Remove
`Session.streamIds`, the `streamIds` field of the CLIENT_CONNECTION_STATUS_CHANGED payload and the unused
REMOTE_STREAM_TRACK_ADDED and REMOTE_STREAM_TRACK_REMOVED events.
