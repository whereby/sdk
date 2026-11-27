// simple worker that is used as a setTimeout() that isn't throttled/paused when tab/window
// is inactive or hidden
let timer: NodeJS.Timeout | null = null;

onmessage = function (request) {
    const time = request.data;
    if (time >= 0) timer = setTimeout(() => postMessage(""), time);
    else if (timer) clearTimeout(timer);
};
