const fs = require("node:fs");
const path = require("node:path");

/*
 * This is a CLI tool to create a summary report of which getStats properties the
 * different browsers implement.
 *
 * Accepts a single argument <sampleDirectory> where it is expected to find JSON
 * files gathered from the browsers to compare
 *
 * Example: node sampleCollector.js <sampleDirectory>
 *
 * The directory given as arument must have the following structure:
 *
 * <sampleDirectory> - root directory, `browsers/` here in this repo
 *     - <browser_version_os_version> - directory naming the browser+version/os+version
 *         - <webrtc-construct>.json - eg peer-connection.json
 *
 *  The JSON files are manually collected from each browser during a Whereby P2P session with
 *  two participants, and are expected to be an array of reports which is the return type of
 *  getStats on the supported constructs.
 */

async function main(sampleDirectory) {
    if (!sampleDirectory) throw new Error("Sample directory must be supplied");

    const SUMMARY = {};
    const browsers = fs.readdirSync(sampleDirectory);

    browsers.forEach((browser) => {
        // Second level will be one JSON file per WebRTC contruct which implements `getStats`,
        // eg. peer-connection.json
        const constructs = fs.readdirSync(path.join(sampleDirectory, browser));

        constructs.forEach((construct) => {
            const reports = require(path.join(__dirname, sampleDirectory, browser, construct));
            reports.forEach((report) => {
                let byReportType = SUMMARY[report.type];

                if (!byReportType) {
                    byReportType = {};
                    SUMMARY[report.type] = byReportType;
                }

                Object.keys(report).forEach((reportKey) => {
                    let browserSupport = byReportType[reportKey];

                    if (!browserSupport) {
                        browserSupport = Object.fromEntries(browsers.map((b) => [b, false]));
                        byReportType[reportKey] = browserSupport;
                    }

                    browserSupport[browser] = true;
                });
            });
        });
    });

    // Generate report in human-readable format
    Object.entries(SUMMARY).forEach(([reportType, properties]) => {
        const PROPERTY_COLUMN = "Property";
        const maxLength = [PROPERTY_COLUMN, ...Object.keys(properties)].reduce((maxLength, currentString) => {
            return Math.max(maxLength, currentString.length);
        }, 0);

        const header = `| ${PROPERTY_COLUMN.padEnd(maxLength)} | ${browsers.join(" | ")} |`;
        const sep = ["".padEnd(maxLength, "?"), ...browsers].map((e) => "".padEnd(e.length, "-")).join(" | ");
        const separator = `| ${sep} |`;
        const rows = [];

        Object.entries(properties).forEach(([statName, browserSupport]) => {
            const row = [];
            row.push(statName.padEnd(maxLength));
            browsers.forEach((b) => {
                row.push((browserSupport[b] ? "✅" : "❌").padEnd(b.length - 1));
            });

            rows.push(`| ${row.join(" | ")} |`);
        });

        /* eslint-disable no-console */
        console.log(`### ${reportType}`);
        console.log("");

        console.log(header);
        console.log(separator);

        rows.forEach((row) => {
            console.log(row);
        });

        console.log("");
        /* eslint-enable no-console */
    });
}

main(process.argv[2]);
