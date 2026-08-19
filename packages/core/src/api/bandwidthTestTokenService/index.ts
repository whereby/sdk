import ApiClient from "../ApiClient";
import BandwidthTestToken from "../BandwidthTestToken";
import Response from "../Response";
import { RateLimitError } from "../errors";
/**
 * Related to device calls needed to obtain credentials
 */
export default class BandwidthTestTokenService {
    _apiClient: ApiClient;

    constructor({ apiClient }: { apiClient: ApiClient }) {
        this._apiClient = apiClient;
    }

    static create({ baseUrl }: { baseUrl: string }): BandwidthTestTokenService {
        return new BandwidthTestTokenService({
            apiClient: new ApiClient({ baseUrl }),
        });
    }

    /**
     * Get's a bandwidth test token needed to run a bandwidth test
     *
     * @return {Promise} A promise which is fulfilled or failed based on the
     * response.
     */
    getToken(): Promise<BandwidthTestToken> {
        return this._apiClient
            .request("/bandwidth-test-token", {
                method: "get",
            })
            .then(({ data }) => {
                return BandwidthTestToken.fromJson(data);
            })
            .catch((res) => {
                if (res instanceof Response) {
                    if (res.status === 429) {
                        throw new RateLimitError(res.statusText);
                    }

                    throw new Error(res.statusText);
                }

                throw res;
            });
    }
}
