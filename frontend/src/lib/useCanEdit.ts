import { useMe } from "../api/accounts";

/** Whether the signed-in person may change household data (Gardeners and Admins). */
export function useCanEdit(): boolean {
  const role = useMe().data?.role;
  return role === "gardener" || role === "admin";
}
