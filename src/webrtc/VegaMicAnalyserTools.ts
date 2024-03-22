export class KalmanFilter {
    R: number;
    Q: number;
    A: number;
    C: number;
    B: number;
    cov: number;
    x: number;

    /**
     * Create 1-dimensional kalman filter
     * @param  {Number} options.R Process noise
     * @param  {Number} options.Q Measurement noise
     * @param  {Number} options.A State vector
     * @param  {Number} options.B Control vector
     * @param  {Number} options.C Measurement vector
     * @return {KalmanFilter}
     */
    constructor({ R = 0.01, Q = 2, A = 1.1, B = 1, C = 1.2 } = { R: 0.01, Q: 2, A: 1.1, B: 1, C: 1.2 }) {
        this.R = R; // noise power desirable
        this.Q = Q; // noise power estimated

        this.A = A;
        this.C = C;
        this.B = B;
        this.cov = NaN;
        this.x = NaN; // estimated signal without noise
    }

    /**
     * Filter a new value
     * @param  {Number} z Measurement
     * @param  {Number} u Control
     * @return {Number}
     */
    filter(z: number, u: number = 0) {
        if (isNaN(this.x)) {
            this.x = (1 / this.C) * z;
            this.cov = (1 / this.C) * this.Q * (1 / this.C);
        } else {
            // Compute prediction
            const predX = this.predict(u);
            const predCov = this.uncertainty();

            // Kalman gain
            const K = predCov * this.C * (1 / (this.C * predCov * this.C + this.Q));

            // Correction
            this.x = predX + K * (z - this.C * predX);
            this.cov = predCov - K * this.C * predCov;
        }

        return this.x;
    }

    /**
     * Predict next value
     * @param  {Number} [u] Control
     * @return {Number}
     */
    predict(u = 0) {
        return this.A * this.x + this.B * u;
    }

    /**
     * Return uncertainty of filter
     * @return {Number}
     */
    uncertainty() {
        return this.A * this.cov * this.A + this.R;
    }

    /**
     * Return the last filtered measurement
     * @return {Number}
     */
    lastMeasurement() {
        return this.x;
    }

    /**
     * Set measurement noise Q
     * @param {Number} noise
     */
    setMeasurementNoise(noise: number) {
        this.Q = noise;
    }

    /**
     * Set the process noise R
     * @param {Number} noise
     */
    setProcessNoise(noise: number) {
        this.R = noise;
    }
}

export const createACFCalculator = () => {
    let ewma = -1;
    let lastMax = 0;
    let counter = 0;
    return (arr: any[]) => {
        const max = arr.reduce((acc, val) => acc + val, 0) / arr.length;
        // const max = Math.max(...arr);
        if (ewma < 0) {
            ewma = max;
        } else {
            ewma = ewma * 0.95 + max * 0.05;
        }
        if (++counter < 2) {
            lastMax = max;
            return 0;
        }
        // const acf = ((max - ewma) * (lastMax - ewma)) / ((max - ewma) ** 2);
        const acf = (max - ewma) * (lastMax - ewma);
        lastMax = max;
        return acf;
    };
};

export const calculateStd = (arr: any[]) => {
    const mean = arr.reduce((acc, val) => acc + val, 0) / arr.length;
    return (
        arr.reduce((acc, val) => acc.concat((val - mean) ** 2), []).reduce((acc: number, val: number) => acc + val, 0) /
        arr.length
    );
};

export const standardDeviation = (arr: any[] /*, usePopulation = false*/) => {
    const mean = arr.reduce((acc, val) => acc + val, 0) / arr.length;
    return {
        mean,
        SD: Math.sqrt(arr.reduce((acc, val) => acc + (val - mean) ** 2, 0) / arr.length),
    };
};

export const variance = (arr: any[], usePopulation = false) => {
    const mean = arr.reduce((acc, val) => acc + val, 0) / arr.length;
    return (
        arr.reduce((acc, val) => acc.concat((val - mean) ** 2), []).reduce((acc: number, val: number) => acc + val, 0) /
        (arr.length - (usePopulation ? 0 : 1))
    );
};
