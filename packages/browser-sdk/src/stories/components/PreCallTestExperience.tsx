import * as React from "react";
import { PRE_CALL_TEST_DURATION_S, usePreCallTest } from "../../lib/react";
import type { PreCallTestDetails, PreCallTestResult } from "../../lib/react";

function Verdict({ result }: { result: PreCallTestResult }) {
    if (result.success) {
        return <strong className="preCallTestVerdictSuccess">Connection looks good</strong>;
    }

    if (result.warning) {
        return <strong className="preCallTestVerdictWarning">Connection is degraded</strong>;
    }

    return <strong className="preCallTestVerdictFailure">Connection is too poor for a call</strong>;
}

function Details({ details }: { details: PreCallTestDetails }) {
    const rows: Array<[string, string, boolean]> = [
        ["Test time", `${(details.testTime / 1000).toFixed(1)} s`, false],
        [
            "Available downstream bitrate",
            `${details.recvAvailableBitrate.toFixed(2)} Mbps`,
            details.lowRecvAvailableBitrate,
        ],
        ["Upstream packet loss", `${(details.sendLoss * 100).toFixed(1)} %`, details.highSendLoss],
        ["Downstream packet loss", `${(details.recvLoss * 100).toFixed(1)} %`, details.highRecvLoss],
    ];

    return (
        <table className="preCallTestDetails">
            <tbody>
                {rows.map(([label, value, isBad]) => (
                    <tr key={label}>
                        <td>{label}</td>
                        <td className={isBad ? "preCallTestVerdictWarning" : undefined}>{value}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export default function PreCallTestExperience({ roomUrl }: { roomUrl: string }) {
    const {
        state: { status, result, error },
        actions: { startTest, stopTest },
    } = usePreCallTest(roomUrl);

    const isRunning = status === "running";

    return (
        <div>
            <h3>Pre-call test</h3>
            <p>
                Measures the connection between this client and the Whereby media servers. It needs no room and no local
                media, but it competes for bandwidth with any call in progress - run it before joining.
            </p>
            <div className="controls">
                <button onClick={() => startTest()} disabled={isRunning}>
                    Start test
                </button>
                <button onClick={() => stopTest()} disabled={!isRunning}>
                    Stop test
                </button>
            </div>
            <p>
                Status: <code>{status}</code>
                {isRunning && ` (running for up to ${PRE_CALL_TEST_DURATION_S} s)`}
            </p>
            {error && (
                <p className="preCallTestVerdictFailure">
                    Test failed ({error.reason}): {error.message}
                </p>
            )}
            {result && (
                <div>
                    <Verdict result={result} />
                    <Details details={result.details} />
                </div>
            )}
        </div>
    );
}
