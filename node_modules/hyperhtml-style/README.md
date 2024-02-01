# hyperHTML Style

[![Build Status](https://travis-ci.com/WebReflection/hyperhtml-style.svg?branch=master)](https://travis-ci.com/WebReflection/hyperhtml-style) [![Coverage Status](https://coveralls.io/repos/github/WebReflection/hyperhtml-style/badge.svg?branch=master)](https://coveralls.io/github/WebReflection/hyperhtml-style?branch=master) [![Greenkeeper badge](https://badges.greenkeeper.io/WebReflection/hyperhtml-style.svg)](https://greenkeeper.io/) ![WebReflection status](https://offline.report/status/webreflection.svg)

The [hyperHTML](https://github.com/WebReflection/hyperHTML#hyperhtml)'s html/svg style updater.

  * CDN as global utility, via https://unpkg.com/hyperhtml-style
  * ESM via `import hyperStyle from 'hyperhtml-style'`
  * CJS via `const hyperStyle = require('hyperhtml-style')`

[Live test](https://webreflection.github.io/hyperhtml-style/test/)

### Example

The tagger accepts a node and returns a function that can be used to update the node style either via an object or a string.

```js
var bodyStyle = hyperhtmlStyle(document.body);
bodyStyle({
  fontFamily: 'sans-serif',
  fontSize: 16,
  '--cssProperty': 'value'
});

console.log(document.body.style.cssText);

// font-family: sans-serif;
// font-size: 16px;
// --cssProperty:value;
```
