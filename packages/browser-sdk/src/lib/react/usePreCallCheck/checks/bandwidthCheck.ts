import { BandwidthTester } from "@whereby.com/core/media";

export class BandwidthCheck extends EventTarget {
    run(): Promise<void> {
        return new Promise((resolve) => {
            const bandwidthTester = new BandwidthTester();

            bandwidthTester.on("result", () => {
                resolve();
            });
            bandwidthTester.start();
        });
    }
}
