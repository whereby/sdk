---
"@whereby.com/browser-sdk": patch
---

VideoGrid: draw subgrid tiles as squares of the avatar size, inside the cell padding. Subgrid tiles no longer touch
their neighbours or change size with the participant's camera shape, with the default renderer or
`renderSubgridParticipant`. Camera video in the subgrid is cropped to fill the square.
