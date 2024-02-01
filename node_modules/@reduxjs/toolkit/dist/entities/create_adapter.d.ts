import type { Comparer, IdSelector, EntityAdapter, EntityId } from './models';
export interface EntityAdapterOptions<T, Id extends EntityId> {
    selectId?: IdSelector<T, Id>;
    sortComparer?: false | Comparer<T>;
}
export declare function createEntityAdapter<T, Id extends EntityId>(options: {
    selectId: IdSelector<T, Id>;
    sortComparer?: false | Comparer<T>;
}): EntityAdapter<T, Id>;
export declare function createEntityAdapter<T extends {
    id: EntityId;
}>(options?: {
    sortComparer?: false | Comparer<T>;
}): EntityAdapter<T, T['id']>;
