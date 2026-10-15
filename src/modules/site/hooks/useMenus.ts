import { useAsync } from "./useAsync";
import { useInstitution } from "../context/InstitutionContext";
import { getMenuTree } from "../services/menus";

export function useMenus() {
  const { institutionId } = useInstitution();
  return useAsync(() => getMenuTree(institutionId), [institutionId]);
}
