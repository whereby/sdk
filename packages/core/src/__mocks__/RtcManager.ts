import { RtcManager } from "@whereby.com/media";

export default jest.fn(function (this: RtcManager): RtcManager {
    this.acceptNewStream = jest.fn();
    return this;
});
