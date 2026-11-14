---
"@whereby.com/media": patch
---

Replace check-ip with ip-address 10.7.3's isGlobal() for IPv4 ICE candidate classification. Globally reachable exceptions such as 192.0.0.9 and 192.0.0.10 are now classified as public.
