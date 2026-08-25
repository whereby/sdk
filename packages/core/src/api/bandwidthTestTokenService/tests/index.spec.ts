import BandwidthTestTokenService from "../index";
import ApiClient from "../../ApiClient";
import BandwidthTestToken from "../../BandwidthTestToken";
import Response from "../../Response";
import { ForbiddenError, RateLimitError } from "../../errors";

jest.mock("../../ApiClient");

const bandwidthTestTokenResponse = {
    bandwidthTestToken: "12345",
};

describe("BandwidthTestTokenService", () => {
    let apiClient: jest.Mocked<ApiClient>;
    let bandwidthTestTokenService: BandwidthTestTokenService;

    beforeEach(() => {
        apiClient = new ApiClient() as jest.Mocked<ApiClient>;
        bandwidthTestTokenService = new BandwidthTestTokenService({ apiClient });
    });

    describe("getToken", () => {
        const roomUrl = "testRoomUrl";

        const url = "/bandwidth-test-token";
        const method = "post";

        beforeEach(() => {
            apiClient.request.mockResolvedValue(new Response({ data: bandwidthTestTokenResponse }));
        });

        it("should call request with correct params", async () => {
            await bandwidthTestTokenService.getToken(roomUrl);

            expect(apiClient.request).toBeCalledWith(url, {
                method,
                data: { roomUrl },
            });
        });

        it("should be fulfilled with the token success", async () => {
            const result = await bandwidthTestTokenService.getToken(roomUrl);

            expect(result).toEqual(new BandwidthTestToken(bandwidthTestTokenResponse.bandwidthTestToken));
        });

        it("should fail if the request failed", async () => {
            const error = new Error("some error");
            apiClient.request.mockRejectedValue(error);

            await expect(bandwidthTestTokenService.getToken(roomUrl)).rejects.toThrow(error);
        });

        it("should return forbidden error if the request was not allowed", async () => {
            const response = new Response({ status: 403 });
            apiClient.request.mockRejectedValue(response);

            await expect(bandwidthTestTokenService.getToken(roomUrl)).rejects.toThrow(ForbiddenError);
        });

        it("should return rate limit error if the request was rate limited", async () => {
            const response = new Response({ status: 429 });
            apiClient.request.mockRejectedValue(response);

            await expect(bandwidthTestTokenService.getToken(roomUrl)).rejects.toThrow(RateLimitError);
        });
    });
});
