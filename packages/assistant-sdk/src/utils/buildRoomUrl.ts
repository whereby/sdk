import { networkInterfaces } from "os";
import * as dotenv from "dotenv";

dotenv.config();

const { IS_LOCAL = "false", BIND_INTERFACE = "en0" } = process.env;

export function buildRoomUrl(roomPath: string, wherebySubdomain: string, baseDomain: string = "whereby.com"): string {
    let wherebyDomain;

    if (!IS_LOCAL) {
        wherebyDomain = `${wherebySubdomain}.${baseDomain}`;
    } else {
        const ifaceAddrs = networkInterfaces()[BIND_INTERFACE];

        if (!ifaceAddrs) {
            throw new Error(`Unknown interface ${BIND_INTERFACE}`);
        }

        const [bindAddr] = ifaceAddrs.filter((iface) => iface.family === "IPv4");

        if (!bindAddr) {
            throw new Error(`No IPv4 address found for interface ${BIND_INTERFACE}`);
        }

        wherebyDomain = `${wherebySubdomain}-ip-${bindAddr.address.replace(/[.]/g, "-")}.hereby.dev:4443`;
    }

    return `https://${wherebyDomain}${roomPath}`;
}
