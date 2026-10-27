import { PasswordInput, type PasswordInputProps } from "@mantine/core";
import { useTranslation } from "react-i18next";

/** Mantine's PasswordInput, with its show/hide button labeled in the person's language. */
export function PasswordField(props: PasswordInputProps) {
  const { t } = useTranslation();
  return (
    <PasswordInput
      visibilityToggleButtonProps={{ "aria-label": t("common.togglePasswordVisibility") }}
      {...props}
    />
  );
}
