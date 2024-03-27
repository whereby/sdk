/**
 * Creates test cases for argument validation.
 *
 * @param {string} missingPropertyName - Name of the property to test, use an empty string to test the lack of all arguments.
 * @param {function} fn - Wrapper function that executes the test subject.
 */
export function itShouldThrowIfMissing(missingPropertyName: any, fn: any) {
    const testingNoArguments = !missingPropertyName;
    const scenario = testingNoArguments ? "arguments are missing" : `${missingPropertyName} is missing`;
    const expectedException = testingNoArguments ? undefined : new RegExp(`${missingPropertyName}.*(is|are) required`);

    it(`should throw if ${scenario}`, () => {
        expect(() => {
            fn();
        }).toThrow(expectedException);
    });
}

export function clearCookie(name: string) {
    const yesterday = new Date();
    yesterday.setTime(yesterday.getTime() + -1 * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=; expires=${yesterday.toString()}; path=/`;
}
