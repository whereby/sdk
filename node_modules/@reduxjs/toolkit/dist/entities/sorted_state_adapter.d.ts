import type { IdSelector, Comparer, EntityStateAdapter, EntityId } from './models';
export declare function createSortedStateAdapter<T, Id extends EntityId>(selectId: IdSelector<T, Id>, sort: Comparer<T>): EntityStateAdapter<T, Id>;
