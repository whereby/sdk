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

    const organizationServiceCaches = new Map<string, OrganizationServiceCache>();

    const fetchOrganizationFromRoomUrl = (roomUrl: string) => {
        const roomUrlObj = new URL(roomUrl);
        const { subdomain } = fromLocation({ host: roomUrlObj.host });

        let organizationServiceCache = organizationServiceCaches.get(subdomain);

        if (!organizationServiceCache) {
            organizationServiceCache = new OrganizationServiceCache({ organizationService, subdomain });
            organizationServiceCaches.set(subdomain, organizationServiceCache);
        }

        return organizationServiceCache.fetchOrganization().then(
            (organization) => {
                if (!organization) {
                    organizationServiceCaches.delete(subdomain);
                }

                return organization;
            },
            (error) => {
                organizationServiceCaches.delete(subdomain);
                throw error;
            },
        );
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
