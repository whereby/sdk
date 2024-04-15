/**
 * Parse the raw data contained in a roomKey JWT token without verifying if the token is
 * valid (i.e. we do not have the JWT signing keys in this environment)
 */
export default function parseUnverifiedRoomKeyData(roomKey: string) {
    const [, roomKeyData] = /\.(.*)\./i.exec(roomKey) || [];

    if (!roomKeyData) {
        return {};
    } else {
        try {
            const base64DecodedJwtData = atob(roomKeyData);
            return JSON.parse(base64DecodedJwtData);
        } catch (e) {
            return {};
        }
    }
}
