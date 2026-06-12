import { LiveCaptionEvent } from "@whereby.com/media";

export interface LiveCaptionPart {
    resultId: string;
    text: string;
}

export default class LiveCaption {
    shouldShowSenderDetails: boolean;
    clientId: string;
    parts: Array<LiveCaptionPart>;
    timestamp: number;

    constructor({ senderId, resultId, text }: LiveCaptionEvent) {
        this.shouldShowSenderDetails = Boolean(senderId);
        this.clientId = senderId ?? resultId;
        this.parts = [
            {
                resultId,
                text,
            },
        ];
        this.timestamp = Date.now();
    }
}
