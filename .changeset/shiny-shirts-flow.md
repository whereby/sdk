---
"@whereby.com/browser-sdk": minor
"@whereby.com/media": minor
"@whereby.com/core": minor
---

Add waiting room message support for on-hold and reject knocks. Hosts can now
put a waiting participant on hold or reject them with an optional message via
`holdWaitingParticipant(participantId, message?)` and
`rejectWaitingParticipant(participantId, message?)`. Knockers receive the
message and, when put on hold, a new `knock_on_hold` connection status, both
exposed through the `knockResponse` field on the room connection state.
