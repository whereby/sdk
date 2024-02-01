# <em>µ</em>wire

[![Build Status](https://travis-ci.com/WebReflection/uwire.svg?branch=master)](https://travis-ci.com/WebReflection/uwire) [![Coverage Status](https://coveralls.io/repos/github/WebReflection/uwire/badge.svg?branch=master)](https://coveralls.io/github/WebReflection/uwire?branch=master)

A way to create persistent "_wired_" fragments that can be moved around when diffed through _[µdomdiff](https://github.com/WebReflection/udomdiff#readme)_.

```js
import {diffable, persistent} from 'uwire';

const wire = persistent(fragment);
diffable(wire, 1);  // repopulate all nodes, if gone, returns the fragment
diffable(wire, 0);  // return the initial fragment firstChild
diffable(wire, -0); // return the initial fragment lastChild
diffable(wire, -1); // remove all nodes and return the firstChild
```

If the fragment has only one child node, the `diffable` will always return that child node instead, making it a no-op.

### Why it this called _wire_?

It's like attaching, via strings (_wires_), the behavior of a _fragment_ that cannot be used to obtain the same result.

A _wire_ is not really a fragment per se, but it carries with it all it's needed to reuse, move, remove, re-append, such fragment.

```
      ┌--------▶[fragment]
◀---[wire]        |
        ├--------▶├ firstChild
        |         ├ ...
        └--------▶└ lastChild
```
