export function fetchJoke(): Promise<string> {
    return fetch("https://sv443.net/jokeapi/v2/joke/Programming")
        .then((response) => response.json())
        .then((data) => {
            if (data.type === "single") {
                return data.joke;
            } else if (data.type === "twopart") {
                return `${data.setup}\n${data.delivery}`;
            } else {
                throw new Error("Unexpected joke format");
            }
        });
}
