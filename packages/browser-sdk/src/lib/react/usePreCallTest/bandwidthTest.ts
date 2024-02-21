import { BandwidthTester } from "@whereby.com/core/media";

export class BandwidthTest extends EventTarget {
    run(): Promise<void> {
        return new Promise((resolve, reject) => {
            const bandwidthTester = new BandwidthTester();

            bandwidthTester.on("result", (result) => {
                console.log("Bandwidth test result", result);
                resolve();
            });
            bandwidthTester.start();
        });
    }
}
