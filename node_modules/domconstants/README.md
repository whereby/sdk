# domconstants

Commonly used DOM constants for various projects.

```js
export {
  UID,                      // a unique ID usable as attribute too
  UIDC,                     // a unique ID wrapped as comment node
  UID_IE,                   // a boolean indicating IE was detected
  COMMENT_NODE,             // Node.COMMENT_NODE
  DOCUMENT_FRAGMENT_NODE,   // Node.DOCUMENT_FRAGMENT_NODE
  ELEMENT_NODE,             // Node.ELEMENT_NODE
  TEXT_NODE,                // Node.TEXT_NODE
  SHOULD_USE_TEXT_CONTENT,  // a RegExp matching nodes that need textContent
  VOID_ELEMENTS             // a RegExp of all void elements (i.e. img, input, etc...)
};
```
