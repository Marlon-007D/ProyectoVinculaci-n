import { useLocation, useParams } from "react-router-dom";
import { computeBasePath } from "../utils/basePath";

export function useBasePath(): string {
  const { pathname } = useLocation();
  const splat = useParams()["*"];
  return computeBasePath(pathname, splat);
}