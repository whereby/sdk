export interface OriginTrial {
    hostnamePattern: RegExp;
    token: string;
}

interface RegisteredTrials {
    [hostnameAndToken: string]: true;
}

const REGISTERED_TRIALS: RegisteredTrials = {};

export function registerOriginTrials(
    trials: OriginTrial[],
    registeredTrials: RegisteredTrials = REGISTERED_TRIALS,
    document: Document = window.document,
) {
    trials.forEach(({ hostnamePattern, token }) => {
        const key = `${hostnamePattern}-${token}`;
        if (registeredTrials[key]) {
            return;
        }

        if (hostnamePattern.test(document.location.hostname)) {
            const otMeta = document.createElement("meta");
            otMeta.httpEquiv = "origin-trial";
            otMeta.content = token;
            document.head.append(otMeta);

            registeredTrials[key] = true;
        }
    });
}
