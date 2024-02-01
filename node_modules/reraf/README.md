# reraf

[![Build Status](https://travis-ci.com/WebReflection/reraf.svg?branch=master)](https://travis-ci.com/WebReflection/reraf) [![Coverage Status](https://coveralls.io/repos/github/WebReflection/reraf/badge.svg?branch=master)](https://coveralls.io/github/WebReflection/reraf?branch=master)

<sup>**Social Media Photo by [Hans Eiskonen](https://unsplash.com/@eiskonen) on [Unsplash](https://unsplash.com/)**</sup>

A super light and simple way to reschedule animation frames, compatible with every browser and Node.js through a `setTimeout` and `clearTimeout` fallback.

```js
import reraf from 'reraf';
// or const reraf = require('reraf');
// or <script src="//unpkg.com/reraf">

const reschedule = reraf(/* optional integer limit */);

reschedule(console.log, null, ['first']);
reschedule(console.log, null, ['second']);
// will log "second", but never "first"
```

The `reschedule(...)` returns a function to be able to `stop()` the scheduled animation frame, in case it's needed.

If a `truthy` value is passed to `stop(truthy)`, the callback will be "flushed" (invoked) if it didn't flush already.

The `stop(...)` function returns a boolean value, indicating the stop actually stopped the execution of the callback, or it didn't, 'cause it happened before.
