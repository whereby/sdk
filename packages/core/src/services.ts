import { fromLocation } from "@whereby.com/media";
import {
    ApiClient,
    CredentialsService,
    OrganizationService,
    OrganizationServiceCache,
    RoomIntegrationService,
} from "./api";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const SIGNAL_BASE_URL = process.env.REACT_APP_SIGNAL_BASE_URL;

/**
 * Base URL overrides for `WherebyClient` and `createServices`.
 *
 * @internal For Whereby's own development. May change without notice.
 */
export interface ServicesOptions {
    /** Base URL of the Whereby API. Defaults to the URL the SDK was built with. */
    apiBaseUrl?: string;
    /** Base URL of the signal server. Defaults to the URL the SDK was built with. */
    signalBaseUrl?: string;
}

export function createServices({ apiBaseUrl, signalBaseUrl }: ServicesOptions = {}) {
    const resolvedApiBaseUrl = apiBaseUrl || API_BASE_URL;
    const credentialsService = CredentialsService.create({
        baseUrl: resolvedApiBaseUrl || "https://api.whereby.dev",
    });
    const apiClient = new ApiClient({
        fetchDeviceCredentials: credentialsService.getCredentials.bind(credentialsService),
        baseUrl: resolvedApiBaseUrl,
    });
    const organizationService = new OrganizationService({ apiClient });
    const roomIntegrationService = new RoomIntegrationService({ apiClient });

    const fetchOrganizationFromRoomUrl = (roomUrl: string) => {
        const roomUrlObj = new URL(roomUrl);
        const urls = fromLocation({ host: roomUrlObj.host });

        const organizationServiceCache = new OrganizationServiceCache({
            organizationService,
            subdomain: urls.subdomain,
        });

        return organizationServiceCache.fetchOrganization();
    };

    return {
        credentialsService,
        apiClient,
        organizationService,
        roomIntegrationService,
        fetchOrganizationFromRoomUrl,
        signalBaseUrl: signalBaseUrl || SIGNAL_BASE_URL || "wss://signal.appearin.net",
    };
}
