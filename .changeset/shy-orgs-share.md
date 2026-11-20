---
"@whereby.com/core": patch
---

`createServices().fetchOrganizationFromRoomUrl` reuses an organization it has already fetched for the subdomain.
A failed lookup isn't kept, so the next call tries again.
