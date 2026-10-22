---
"@whereby.com/media": patch
---

media: Make the preferred layer switch metrics more accurate. A switch of a paused consumer (e.g. one whose camera is
off), a switch while the tab is hidden, a switch within 10 s of the consumer's previous switch up (1 s once that one has
landed), within 2 s of its previous switch down or within 1 s of it resuming, and a switch whose first getStats() is
slow aren't measured. A switch whose later polls were held up (a slow getStats() or a gap between polls, e.g. a briefly
hidden tab) records no latency, but still counts as a timeout if it doesn't land and a poll got through close to the
end. A switch up only counts once the frame area has grown by a whole layer for each layer asked for, and a switch down
once it has shrunk by at least one layer, within 2 s. Only a switch up that doesn't land counts as a timeout.
