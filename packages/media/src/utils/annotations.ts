const annotations = new WeakMap();

export function getAnnotations(o: any) {
    let props = annotations.get(o);
    if (!props) {
        props = {};
        annotations.set(o, props);
    }
    return props;
}
