import { Button, Paper, Stack, Title } from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { useChangePassword } from "../../api/accounts";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PasswordField } from "../../components/PasswordField";
import { useApplyFieldErrors } from "../auth/serverErrors";

export function ChangePasswordForm() {
  const { t } = useTranslation();
  const applyFieldErrors = useApplyFieldErrors();
  const changePassword = useChangePassword();
  const form = useForm({
    // Field names match allauth's, so its error messages land on the right field.
    initialValues: { current_password: "", new_password: "" },
    validate: {
      current_password: isNotEmpty(t("validation.required")),
      new_password: isNotEmpty(t("validation.required")),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await changePassword.mutateAsync({
        current: values.current_password,
        next: values.new_password,
      });
      form.reset();
      notifications.show({ color: "green", message: t("profile.passwordChanged") });
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <Paper withBorder radius="lg" p="lg">
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <Title order={2} fz="h4">
            {t("profile.changePassword")}
          </Title>
          <ErrorAlert error={changePassword.error} />
          <PasswordField
            label={t("profile.currentPassword")}
            autoComplete="current-password"
            required
            {...form.getInputProps("current_password")}
          />
          <PasswordField
            label={t("profile.newPassword")}
            autoComplete="new-password"
            required
            {...form.getInputProps("new_password")}
          />
          <Button
            type="submit"
            variant="light"
            loading={changePassword.isPending}
            style={{ alignSelf: "flex-start" }}
          >
            {t("profile.changePassword")}
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
