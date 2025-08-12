import "@whereby.com/assistant-sdk/polyfills";
import express, { type Request, type Response } from "express";
import bodyParser from "body-parser";
import { Assistant } from "@whereby.com/assistant-sdk";
import { ChatGPTAudioSession } from "./chatgpt_audio.js";

const createRouter = () => {
    const router = express.Router();

    const jsonParser = bodyParser.json();

    router.get("/", (_, res) => {
        res.status(200);
        res.end();
    });

    router.post("/", jsonParser, async (req: Request, res: Response) => {
        const assistant = new Assistant();
        await assistant.joinRoom(
            "https://embedded-ip-192-168-1-167.hereby.dev:4443/5541af68-a8d4-4f19-a277-a9af4bb26082",
        );
        let didJoin = false;

        assistant.getRoomConnection().on("remote-participants:changed", (remoteParticipants) => {
            console.log("This is the beginning");
            if (didJoin) {
                return;
            }
            const participant = remoteParticipants[0];

            if (!participant?.stream) {
                return;
            }

            const audioTrack = participant.stream.getTracks().find((t) => t.kind === "audio");

            const isAudioEnabled = participant.isAudioEnabled;

            if (!audioTrack || !isAudioEnabled) {
                console.log("No audio track or audio is disabled for the participant");
                return;
            }

            console.log("Starting");

            startChatGpt(assistant);
            didJoin = true;
        });

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

function startChatGpt(assistant: Assistant) {
    const localMediaStream = assistant.getLocalMediaStream();
    const audioSource = assistant.getLocalAudioSource();
    // obviously change this

    // const participantStream = assistant
    //     .getRoomConnection()
    //     .getState()
    //     .remoteParticipants[0]?.stream?.getAudioTracks()[0];

    // console.log("participantStream", participantStream);

    // console.log("REMOTE PARTICIPANTS", assistant.getRoomConnection().getState().remoteParticipants);
    // console.log("streamS", assistant.getRoomConnection().getState().remoteParticipants?.[0]?.stream);

    const remoteParticipants = assistant.getRoomConnection().getState().remoteParticipants;

    console.log("remoteParticipants", remoteParticipants);
    const participantStream = remoteParticipants[0]?.stream?.getTracks().find((t) => t.kind === "audio");

    const chatGptSession = new ChatGPTAudioSession(audioSource!);
    chatGptSession
        // pls fix
        .startSession(participantStream!, "ash")
        .then(({ dataChannel }) => {
            dataChannel.addEventListener("open", () => {
                // Give some system context on start
                dataChannel.send(
                    JSON.stringify({
                        type: "conversation.item.create",
                        previous_item_id: null,
                        item: {
                            id: null,
                            type: "message",
                            role: "system",
                            content: [
                                {
                                    type: "input_text",
                                    text: `You are ChatBot. The user is called Thomas. Respond to what the user said in a creative and helpful way. Keep your responses short and aim to ask a follow-up question. Let the user lead the conversation when possible.`,
                                },
                            ],
                        },
                    }),
                );

                // dataChannel.addEventListener("message", (event) => {
                //     console.log("oai-events event received", event);
                // });
            });
        })
        .catch((error) => {
            console.error("ChatGPT setup error:", error);
            chatGptSession.stopSession();
        });
}
process.on("SIGTERM", () => {
    server.close();
});
