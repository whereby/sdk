let localStorage;
try {
    // eslint-disable-next-line no-restricted-syntax
    localStorage = self.localStorage;
} catch {
    localStorage = {
        getItem: (): undefined => undefined,
        key: (): undefined => undefined,
        setItem: (): undefined => undefined,
        removeItem: (): undefined => undefined,
        hasOwnProperty: (): undefined => undefined,
        length: 0,
    };
}

export default localStorage as Storage;
