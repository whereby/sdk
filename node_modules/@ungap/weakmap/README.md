# WeakMap

[![Build Status](https://travis-ci.com/ungap/weakmap.svg?branch=master)](https://travis-ci.com/ungap/weakmap) [![Coverage Status](https://coveralls.io/repos/github/ungap/weakmap/badge.svg?branch=master)](https://coveralls.io/github/ungap/weakmap?branch=master) [![Greenkeeper badge](https://badges.greenkeeper.io/ungap/weakmap.svg)](https://greenkeeper.io/) ![WebReflection status](https://offline.report/status/webreflection.svg)

An essential [WeakMap](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap) polyfill for legacy browsers (IE < 11).

  * CDN via https://unpkg.com/@ungap/weakmap
  * ESM via `import WeakMap from '@ungap/weakmap'`
  * CJS via `const WeakMap = require('@ungap/weakmap')`

Compatible down to IE9, works well with ES5 shim upfront in IE8 (and maybe lower too).

[Live test](https://ungap.github.io/weakmap/test/)

### Transpiled code and frozen objects in legacy browsers

If you need this module to work in IE < 11 too with frozen objects, or template literals frozen via Babel transpilation, you need to either nullify `Object.freeze` and others via something like `<script>this.WeakMap||(Object.freeze=Object);</script>` on top of your pages, or you can nullify only template literals through:

```html
<script>
this.WeakMap||(function(O,f){
  f=O.freeze||O;O.freeze=function(o){return'raw'in o?o:f(o)}
}(Object));
</script>
```
