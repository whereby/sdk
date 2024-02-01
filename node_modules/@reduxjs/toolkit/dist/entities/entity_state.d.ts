import type { EntityId, EntityState } from './models';
export declare function getInitialEntityState<T, Id extends EntityId>(): EntityState<T, Id>;
export declare function createInitialStateFactory<T, Id extends EntityId>(): {
    getInitialState: {
        (): EntityState<T, Id>;
        <S extends object>(additionalState: S): EntityState<T, Id> & S;
    };
};
