import { randomString } from "./appMocks";
import MockMediaStream from "./MediaStream";

export const createMockedMediaDevice = (kind: MediaDeviceKind, options = {
    deviceId: randomString(),
    label: randomString(),
}) => {
   return { kind, ...options } as MediaDeviceInfo
}

export const mockMediaDevices = {
    addEventListener: jest.fn(),
    enumerateDevices: jest.fn().mockResolvedValue(Object.values([createMockedMediaDevice("videoinput"), createMockedMediaDevice("audioinput")])),
    getUserMedia: jest.fn().mockResolvedValue(new MockMediaStream()),
};
