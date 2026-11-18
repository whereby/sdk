/**
 * Whether two arrays have the same length and each pair of items has the same keys with identical values.
 * For a selector's resultEqualityCheck, so it keeps its previous result when it builds an equal one.
 */
export default function haveShallowEqualItems<TItem extends object>(a: TItem[], b: TItem[]): boolean {
    return (
        a.length === b.length &&
        a.every((item, i) => {
            const other = b[i];
            const keys = Object.keys(item) as (keyof TItem)[];
            return (
                keys.length === Object.keys(other).length &&
                keys.every((key) => Object.prototype.hasOwnProperty.call(other, key) && item[key] === other[key])
            );
        })
    );
}
