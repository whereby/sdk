import { LiveCaptionEvent } from "@whereby.com/media";

export default class LiveCaption {
    resultId: string;
    participantId: string;
    text: string;
    timestamp: number;

    constructor({ resultId, senderId, text }: LiveCaptionEvent) {
        this.resultId = resultId;
        this.participantId = senderId;
        this.text = text;
        this.timestamp = Date.now();
    }
}
