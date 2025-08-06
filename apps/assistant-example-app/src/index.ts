// import "../node_modules/@whereby.com/assistant-sdk/dist/index.cjs";
import express, { type Request, type Response } from "express";
import bodyParser from "body-parser";
import { Assistant } from "@whereby.com/assistant-sdk";

const createRouter = () => {
    const router = express.Router();

    const jsonParser = bodyParser.json();

    router.get("/", (_, res) => {
        res.status(200);
        res.end();
    });

    router.post("/", jsonParser, (req: Request, res: Response) => {
        const assistant = new Assistant();
        assistant.joinRoom(
            "https://embedded-ip-10-173-97-238.hereby.dev:4443/browser-sdk-e2e-test-3a2fcb10-772c-495e-baeb-37242201aecb?roomKey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJtZWV0aW5nSWQiOiI1MDEiLCJyb29tUmVmZXJlbmNlIjp7InJvb21OYW1lIjoiL2Jyb3dzZXItc2RrLWUyZS10ZXN0LTNhMmZjYjEwLTc3MmMtNDk1ZS1iYWViLTM3MjQyMjAxYWVjYiIsIm9yZ2FuaXphdGlvbklkIjoiMTUifSwiaXNzIjoiaHR0cHM6Ly9hY2NvdW50cy1pcC0xMjctMC0wLTEuaGVyZWJ5LmRldjo0NDQzIiwiaWF0IjoxNzU0NDc5OTI4LCJyb29tS2V5VHlwZSI6Im1lZXRpbmdIb3N0In0.w8V3XrFc3X1YrdglaSdV65NmVx4jggC0I5KiN8hczTY",
        );

        res.status(200);
        res.end();
    });

    return router;
};

const app = express();
const router = createRouter();

app.use(router);

const port = process.env.PORT ?? 3000;

const server = app.listen(port, () => {
    console.log(`Assistant example server now running on port[${port}]`);
});

process.on("SIGTERM", () => {
    server.close();
});
