import ApiClient from "../ApiClient";
import { Json } from "../Response";

export interface RoomIntegrationResponse {
    roomIntegrationId: number | string;
    name: string;
    title: string;
    description: string;
    type: string;
    icons: { small: string; large: string };
    link: { href: string; text: string };
    entrypoint: string;
    webview: string;
    matcher: string;
    version?: string;
    isEmbeddable?: boolean;
}

export interface FindRoomIntegrationsResponse {
    enabledRoomIntegrations: RoomIntegrationResponse[];
    disabledRoomIntegrations: RoomIntegrationResponse[];
    unavailableRoomIntegrations: RoomIntegrationResponse[];
}

function roomPath(organizationId: string, roomName: string, suffix = "") {
    const encodedRoomName = encodeURIComponent(roomName.replace(/^\//, ""));
    return `/organizations/${encodeURIComponent(organizationId)}/room/${encodedRoomName}${suffix}`;
}

function asArray(value: Json | undefined): RoomIntegrationResponse[] {
    return Array.isArray(value) ? (value as unknown as RoomIntegrationResponse[]) : [];
}

export default class RoomIntegrationService {
    private _apiClient: ApiClient;

    constructor({ apiClient }: { apiClient: ApiClient }) {
        this._apiClient = apiClient;
    }

    async findRoomIntegrations({
        organizationId,
        roomName,
    }: {
        organizationId: string;
        roomName: string;
    }): Promise<FindRoomIntegrationsResponse> {
        const response = await this._apiClient.request(roomPath(organizationId, roomName, "/room-integrations"), {
            method: "GET",
        });

        const data = (response.data || {}) as { [key: string]: Json };

        return {
            enabledRoomIntegrations: asArray(data.enabledRoomIntegrations),
            disabledRoomIntegrations: asArray(data.disabledRoomIntegrations),
            unavailableRoomIntegrations: asArray(data.unavailableRoomIntegrations),
        };
    }

    async toggleRoomIntegration({
        organizationId,
        roomName,
        roomIntegrationId,
        enable,
    }: {
        organizationId: string;
        roomName: string;
        roomIntegrationId: number;
        enable: boolean;
    }): Promise<void> {
        await this._apiClient.request(roomPath(organizationId, roomName, `/room-integrations/${roomIntegrationId}`), {
            method: "PUT",
            data: { enable },
        });
    }
}
