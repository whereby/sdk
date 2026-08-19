import { extractString } from "./extractUtils";
import { Json } from "./Response";

export default class BandwidthTestToken {
    token: string;

    constructor(token: string) {
        this.token = token;
    }

    static fromJson(json: Json): BandwidthTestToken {
        return new BandwidthTestToken(extractString(json, "bandwidthTestToken"));
    }
}
