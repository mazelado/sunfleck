import { Anchor, Button, Stack } from "@mantine/core";
import { isNotEmpty, matchesField, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";

import { useResetPassword } from "../../api/accounts";
import { AuthCard } from "../../components/AuthCard";
import { PasswordField } from "../../components/PasswordField";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useApplyFieldErrors } from "./serverErrors";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const applyFieldErrors = useApplyFieldErrors();
  const navigate = useNavigate();
  const { key = "" } = useParams();
  const resetPassword = useResetPassword();
  const form = useForm({
    initialValues: { password: "", confirm: "" },
    validate: {
      password: isNotEmpty(t("validation.required")),
      confirm: matchesField("password", t("validation.passwordsDiffer")),
    },
  });

  const handleSubmit = form.onSubmit(async ({ password }) => {
    try {
      await resetPassword.mutateAsync({ key, password });
      notifications.show({ color: "green", message: t("resetPassword.done") });
      await navigate("/", { replace: true });
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <AuthCard title={t("resetPassword.title")}>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={resetPassword.error} />
          <PasswordField
            label={t("resetPassword.newPassword")}
            autoComplete="new-password"
            required
            {...form.getInputProps("password")}
          />
          <PasswordField
            label={t("resetPassword.confirmPassword")}
            autoComplete="new-password"
            required
            {...form.getInputProps("confirm")}
          />
          <Button type="submit" loading={resetPassword.isPending}>
            {t("resetPassword.submit")}
          </Button>
        </Stack>
      </form>
      <Anchor component={Link} to="/sign-in" size="sm">
        {t("common.backToSignIn")}
      </Anchor>
    </AuthCard>
  );
}
