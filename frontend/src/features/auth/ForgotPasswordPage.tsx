import { Alert, Anchor, Button, Stack, Text, TextInput } from "@mantine/core";
import { isEmail, useForm } from "@mantine/form";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useRequestPasswordReset } from "../../api/accounts";
import { AuthCard } from "../../components/AuthCard";
import { ErrorAlert } from "../../components/ErrorAlert";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const requestReset = useRequestPasswordReset();
  const form = useForm({
    initialValues: { email: "" },
    validate: { email: isEmail(t("validation.email")) },
  });

  const handleSubmit = form.onSubmit(async ({ email }) => {
    try {
      await requestReset.mutateAsync(email);
    } catch {
      // The error is shown by ErrorAlert.
    }
  });

  return (
    <AuthCard title={t("forgotPassword.title")}>
      {requestReset.isSuccess ? (
        <Alert color="green" role="status">
          {t("forgotPassword.sent", { email: form.getValues().email })}
        </Alert>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <Stack gap="sm">
            <Text c="dimmed">{t("forgotPassword.intro")}</Text>
            <ErrorAlert error={requestReset.error} />
            <TextInput
              label={t("common.email")}
              type="email"
              autoComplete="email"
              required
              {...form.getInputProps("email")}
            />
            <Button type="submit" loading={requestReset.isPending}>
              {t("forgotPassword.submit")}
            </Button>
          </Stack>
        </form>
      )}
      <Anchor component={Link} to="/sign-in" size="sm">
        {t("common.backToSignIn")}
      </Anchor>
    </AuthCard>
  );
}
