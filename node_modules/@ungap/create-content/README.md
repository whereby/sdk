# createContent

[![Build Status](https://travis-ci.com/ungap/create-content.svg?branch=master)](https://travis-ci.com/ungap/create-content) [![Coverage Status](https://coveralls.io/repos/github/ungap/create-content/badge.svg?branch=master)](https://coveralls.io/github/ungap/create-content?branch=master) [![Greenkeeper badge](https://badges.greenkeeper.io/ungap/create-content.svg)](https://greenkeeper.io/) ![WebReflection status](https://offline.report/status/webreflection.svg)

A cross browser utility to create HTML or SVG runtime content, as lightweight alternative to what a [HTMLTemplateElement](https://developer.mozilla.org/en-US/docs/Web/API/HTMLTemplateElement) polyfill could do through its `content` accessor.

  * CDN global utility via https://unpkg.com/@ungap/create-content
  * ESM via `import createContent from '@ungap/create-content'`
  * CJS via `const createContent = require('@ungap/create-content')`


### Example

```js
// createContent(markup[, type = 'html'])
const htmlContent = createContent('<td>any content</td>');
const svgContent = createContent('<rect x=1 y=2 />', 'svg');
```

[Live test](https://ungap.github.io/create-content/test/)
