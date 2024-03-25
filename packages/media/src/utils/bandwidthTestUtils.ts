export const createWorker = (fn: Function) => {
    return new Worker(URL.createObjectURL(new Blob(["self.onmessage = ", fn.toString()], { type: "text/javascript" })));
};

export const generateByteString = (count: number) => {
    if (count === 0) {
        return "";
    }

    const count2 = count / 2;
    let result = "F";

    while (result.length <= count2) {
        result += result;
    }

    return result + result.substring(0, count - result.length);
};
