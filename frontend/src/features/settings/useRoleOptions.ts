import { useTranslation } from "react-i18next";
import { type Role } from "../../api/accounts";

const ROLES: Role[] = ["admin", "gardener", "viewer"];

export function useRoleOptions() {
  const { t } = useTranslation();
  return ROLES.map((role) => ({ value: role, label: t(`roles.${role}`) }));
}
