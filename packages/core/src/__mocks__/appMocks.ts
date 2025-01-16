import { Credentials } from "../api";
import Organization from "../api/models/Organization";
import { SignalClient } from "@whereby.com/media";
import { LocalParticipantState } from "../redux/slices/localParticipant";
import { RemoteParticipant } from "../RoomParticipant";
import * as uuidPkg from "uuid";
import MockMediaStream from "./MediaStream";

const uuid = uuidPkg.v4;

// eslint-disable-next-line @typescript-eslint/no-empty-function
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
    displayName = randomString(),
    id = randomString(),
    deviceId = randomString(),
    streams = [],
    isAudioEnabled = true,
    isVideoEnabled = true,
    breakoutGroup = null,
    role = { roleName: "visitor" },
    startedCloudRecordingAt = null,
    externalId = null,
    isDialIn = false,
}: Partial<SignalClient> = {}): SignalClient => {
    return {
        displayName,
        id,
        deviceId,
        streams,
        isAudioEnabled,
        isVideoEnabled,
        breakoutGroup,
        role,
        startedCloudRecordingAt,
        externalId,
        isDialIn,
    };
};

export const randomLocalParticipant = ({
    id = randomString(),
    displayName = randomString(),
    stream = undefined,
    isAudioEnabled = true,
    isVideoEnabled = true,
    breakoutGroup = null,
    clientClaim = randomString(),
    isScreenSharing = false,
    roleName = "visitor",
    stickyReaction = undefined,
    isDialIn = false,
}: Partial<LocalParticipantState> = {}): LocalParticipantState => {
    return {
        id,
        displayName,
        stream,
        isAudioEnabled,
        isVideoEnabled,
        breakoutGroup,
        isLocalParticipant: true,
        clientClaim,
        isScreenSharing,
        roleName,
        stickyReaction,
        isDialIn,
        breakoutGroupAssigned: "",
    };
};

export const randomRemoteParticipant = ({
    id = randomString(),
    displayName = randomString(),
    deviceId = randomString(),
    roleName = "visitor",
    isAudioEnabled = true,
    isVideoEnabled = true,
    breakoutGroup = null,
    isLocalParticipant = false,
    stream = null,
    streams = [],
    newJoiner = false,
    presentationStream = null,
    externalId = null,
    isDialIn = false,
}: Partial<RemoteParticipant> = {}): RemoteParticipant => {
    return {
        id,
        displayName,
        deviceId,
        roleName,
        isAudioEnabled,
        isVideoEnabled,
        breakoutGroup,
        isLocalParticipant,
        stream,
        streams,
        newJoiner,
        presentationStream,
        externalId,
        isDialIn,
    };
};

export const randomMediaStream = (): MediaStream => {
    return new MockMediaStream();
};
