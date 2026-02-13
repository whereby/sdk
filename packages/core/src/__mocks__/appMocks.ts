import { Credentials } from "../api";
import Organization from "../api/models/Organization";
import { ChatMessage, SignalClient } from "@whereby.com/media";
import { LocalParticipantState } from "../redux/slices/localParticipant";
import { RemoteParticipant } from "../RoomParticipant";
import * as uuidPkg from "uuid";
import MockMediaStream from "./MediaStream";

const uuid = uuidPkg.v4;

export const noop = () => {};

export function oneOf<T>(...array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

export const randomString = (prefix?: string, suffix?: string): string => {
    return (prefix || "") + uuid() + (suffix || "");
};

export const randomOrganization = ({
    organizationId = randomString(),
    organizationName = randomString(),
    subdomain = randomString(),
    logoImageUrl = null,
    permissions = {},
    roomBackgroundImageUrl = null,
    roomBackgroundThumbnailUrl = null,
    roomKnockPageBackgroundImageUrl = null,
    roomKnockPageBackgroundThumbnailUrl = null,
    limits = {
        includedUnits: null,
        maxNumberOfClaimedRooms: null,
        maxNumberOfInvitationsAndUsers: null,
        maxRoomLimitPerOrganization: null,
        trialMinutesLimit: null,
    },
    account = null,
    preferences = {},
    onboardingSurvey = null,
    type = null,
}: Partial<Organization> = {}): Organization => {
    return {
        account,
        limits,
        logoImageUrl,
        onboardingSurvey,
        organizationId,
        organizationName,
        permissions,
        preferences,
        roomBackgroundImageUrl,
        roomBackgroundThumbnailUrl,
        roomKnockPageBackgroundImageUrl,
        roomKnockPageBackgroundThumbnailUrl,
        subdomain,
        type,
    };
};

export const randomDeviceCredentials = ({
    credentials = {
        uuid: randomString(),
    },
    hmac = randomString(),
    userId = randomString(),
    toJson = () => "",
}: Partial<Credentials> = {}): Credentials => {
    return {
        credentials,
        hmac,
        userId,
        toJson,
    };
};

export const randomSignalClient = ({
    breakoutGroup = null,
    deviceId = randomString(),
    displayName = randomString(),
    externalId = null,
    id = randomString(),
    isAudioEnabled = true,
    isAudioRecorder = false,
    isDialIn = false,
    isVideoEnabled = true,
    role = { roleName: "visitor" },
    startedCloudRecordingAt = null,
    streams = [],
}: Partial<SignalClient> = {}): SignalClient => {
    return {
        breakoutGroup,
        deviceId,
        displayName,
        externalId,
        id,
        isAudioEnabled,
        isAudioRecorder,
        isDialIn,
        isVideoEnabled,
        role,
        startedCloudRecordingAt,
        streams,
    };
};

export const randomChatMessage = ({
    text = randomString(),
    id = randomString(),
    messageType = "text",
    senderId = randomString(),
    sig = randomString(),
    timestamp = new Date().toDateString(),
    roomName = randomString(),
    userId = randomString(),
}: Partial<ChatMessage> = {}): ChatMessage => {
    return {
        text,
        id,
        messageType,
        senderId,
        sig,
        timestamp,
        roomName,
        userId,
    };
};

export const randomLocalParticipant = ({
    breakoutGroup = null,
    clientClaim = randomString(),
    displayName = randomString(),
    id = randomString(),
    isAudioEnabled = true,
    isAudioRecorder = false,
    isDialIn = false,
    isScreenSharing = false,
    isVideoEnabled = true,
    roleName = "visitor",
    stickyReaction = undefined,
    stream = undefined,
}: Partial<LocalParticipantState> = {}): LocalParticipantState => {
    return {
        breakoutGroup,
        breakoutGroupAssigned: "",
        clientClaim,
        displayName,
        id,
        isAudioEnabled,
        isAudioRecorder,
        isDialIn,
        isLocalParticipant: true,
        isScreenSharing,
        isVideoEnabled,
        roleName,
        stickyReaction,
        stream,
    };
};

export const randomRemoteParticipant = ({
    breakoutGroup = null,
    deviceId = randomString(),
    displayName = randomString(),
    externalId = null,
    id = randomString(),
    isAudioEnabled = true,
    isAudioRecorder = false,
    isDialIn = false,
    isLocalParticipant = false,
    isVideoEnabled = true,
    newJoiner = false,
    presentationStream = null,
    roleName = "visitor",
    stream = null,
    streams = [],
}: Partial<RemoteParticipant> = {}): RemoteParticipant => {
    return {
        breakoutGroup,
        deviceId,
        displayName,
        externalId,
        id,
        isAudioEnabled,
        isAudioRecorder,
        isDialIn,
        isLocalParticipant,
        isVideoEnabled,
        newJoiner,
        presentationStream,
        roleName,
        stream,
        streams,
    };
};

export const randomMediaStream = (): MediaStream => {
    return new MockMediaStream();
};
