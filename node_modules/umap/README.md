# <em>µ</em>map 🗺

[![Build Status](https://travis-ci.com/WebReflection/umap.svg?branch=master)](https://travis-ci.com/WebReflection/umap) [![Coverage Status](https://coveralls.io/repos/github/WebReflection/umap/badge.svg?branch=master)](https://coveralls.io/github/WebReflection/umap?branch=master)

The smallest, yet handy, `Map` and `WeakMap` utility ever.

```js
import umap from 'umap';
// const umap = require('umap');

const map = umap(new Map);
console.assert(
  (map.get(1) || map.set(1, Math.random())) ===
  (map.get(1) || map.set(1, Math.random())),
  'a very common pattern I have with Map instances'
);

const weakMap = umap(new WeakMap);
console.assert(
  (weakMap.get(map) || weakMap.set(map, Math.random())) ===
  (weakMap.get(map) || weakMap.set(map, Math.random())),
  'which I use even more with WeakMap instances'
);
```

### 🤔 Reason

I am super tired of creating workarounds for the fact `map.set(key, value)` doesn't return value but the `map` itself, and so does the _WeakMap_.

This module will help, at least me, dropping all one-off helpers, here and there, to always do the same thing:

```js
// before 😢
const cache = new WeakMap;
const setThing = (key, value) => {
  cache.set(key, value);
  return value;
};
const thing = cache.get(key) || setThing(key, value);

// with umap 🎉
const cache = umap(new WeakMap);
const thing = cache.get(key) || cache.set(key, value);
```

### 🌈 It's Done!

This module is meant to solve one pattern only, and it does exactly that, so that if you store _falsy_ values in _Maps_ or _WeakMaps_, it is not a concern of this module.
