let instance;
let heapFloat32;

class DenoiserProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super({
            ...options,
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [1],
        });

        this.alive = true;

        (async () => {
            try {
                if (!instance) {
                    const wasmModule = (await WebAssembly.instantiate(options.processorOptions.wasmBuffer)).module;
                    instance = new WebAssembly.Instance(wasmModule).exports;
                    heapFloat32 = new Float32Array(instance.memory.buffer);
                }
                this.state = instance.newState();
                this.active = true;
                this.port.onmessage = ({ data: keepalive }) => {
                    if (this.alive) {
                        if (!keepalive) {
                            this.active = false;
                            this.alive = false;
                            instance.deleteState(this.state);
                            this.state = undefined;
                        }
                    }
                };
            } catch (ex) {
                this.port.postMessage({ error: ex.toString() });
            }
        })();
    }

    process([input], [output]) {
        if (this.active) {
            if (!input.length) {
                return true;
            }
            // ensure the state is truthy before proceeding, otherwise just passthrough audio
            if (!this.state) {
                try {
                    output[0].set(input[0]);
                } catch (_) {}
                return true;
            }

            heapFloat32.set(input[0], instance.getInput(this.state) / 4);
            const o = output[0];
            const ptr4 = instance.pipe(this.state, o.length) / 4;
            if (ptr4) o.set(heapFloat32.subarray(ptr4, ptr4 + o.length));
            return true;
        }
        if (this.alive) {
            // not yet loaded, or error initalizing wasm, so try to passthrough audio
            try {
                output[0].set(input[0]);
            } catch (_) {}
            return true;
        }
        return false; // we signal it is ok to destroy the processor
    }
}

registerProcessor("denoiser", DenoiserProcessor);
