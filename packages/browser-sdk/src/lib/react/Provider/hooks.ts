import { useDispatch, useSelector } from "react-redux";
import { RootState, AppDispatch } from "@whereby.com/core";

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
