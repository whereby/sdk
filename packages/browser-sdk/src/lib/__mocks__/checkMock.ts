export class CheckMock extends EventTarget {
    private _success: boolean;

    constructor({ success }: { success: boolean } = { success: Math.random() > 0.5 }) {
        super();
        this._success = success;
    }

    run(): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this._success) {
                resolve();
            } else {
                reject();
            }
        });
    }
}
