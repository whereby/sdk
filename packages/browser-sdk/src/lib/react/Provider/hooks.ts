import { RootState, AppDispatch } from "@whereby.com/core";
import { useDispatch, useSelector } from ".";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
