export function buildRoomUrl(roomPath: string, wherebySubdomain: string, baseDomain: string = "whereby.com"): string {
    const wherebyDomain = `${wherebySubdomain}.${baseDomain}`;

    return `https://${wherebyDomain}${roomPath}`;
}
