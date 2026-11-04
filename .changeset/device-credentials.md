---
"@whereby.com/core": minor
"@whereby.com/browser-sdk": minor
---

core: Add `WherebyClient.getDeviceCredentials()`, for apps that call the Whereby API as the same device as the SDK. It
returns the device's `{ deviceId, hmac }` as a plain object, or `null`, and registers the device on its first call, as
joining a room does. The app builds the `Authorization: Basic base64(deviceId:hmac)` header itself. The
`DeviceCredentials` type is exported from `@whereby.com/core` and `@whereby.com/browser-sdk/react`.
