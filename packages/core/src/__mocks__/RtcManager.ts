import { RtcManager } from "@whereby/jslib-media";

export default jest.fn(function (this: RtcManager): RtcManager {
    this.acceptNewStream = jest.fn();
    return this;
});
