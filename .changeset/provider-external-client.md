---
"@whereby.com/browser-sdk": minor
---

browser-sdk: Let `WherebyProvider` accept an external `WherebyClient` through an optional `client` prop. The provider
uses that client and doesn't destroy it on unmount, since the caller owns it. Without the prop, the provider creates
and destroys its own client as before. `WherebyClient` is now exported from `@whereby.com/browser-sdk/react`.
