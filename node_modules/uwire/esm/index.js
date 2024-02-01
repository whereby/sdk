import {slice} from 'uarray';

const ELEMENT_NODE = 1;
const nodeType = 111;

const remove = ({firstChild, lastChild}) => {
  const range = document.createRange();
  range.setStartAfter(firstChild);
  range.setEndAfter(lastChild);
  range.deleteContents();
  return firstChild;
};

export const diffable = (node, operation) => node.nodeType === nodeType ?
  ((1 / operation) < 0 ?
    (operation ? remove(node) : node.lastChild) :
    (operation ? node.valueOf() : node.firstChild)) :
  node
;

export const persistent = fragment => {
  const {childNodes} = fragment;
  const {length} = childNodes;
  if (length < 2)
    return length ? childNodes[0] : fragment;
  const nodes = slice.call(childNodes, 0);
  const firstChild = nodes[0];
  const lastChild = nodes[length - 1];
  return {
    ELEMENT_NODE,
    nodeType,
    firstChild,
    lastChild,
    valueOf() {
      if (childNodes.length !== length) {
        let i = 0;
        while (i < length)
          fragment.appendChild(nodes[i++]);
      }
      return fragment;
    }
  };
};
