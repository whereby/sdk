export default function decodeRoomName(roomName: string | null): string | null {
    if (!roomName) {
        return null;
    }
    try {
        return decodeURIComponent(roomName);
    } catch {
        return roomName;
    }
}
