import { Button, Stack, Text, TextInput } from "@mantine/core";
import { isEmail, isNotEmpty, useForm } from "@mantine/form";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";

import { useSetup } from "../../api/accounts";
import { AuthCard } from "../../components/AuthCard";
import { PasswordField } from "../../components/PasswordField";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useApplyFieldErrors } from "./serverErrors";

export function SetupPage() {
  const { t } = useTranslation();
  const applyFieldErrors = useApplyFieldErrors();
  const navigate = useNavigate();
  const setup = useSetup();
  const form = useForm({
    initialValues: { display_name: "", email: "", password: "", household_name: "" },
    validate: {
      display_name: isNotEmpty(t("validation.required")),
      email: isEmail(t("validation.email")),
      password: isNotEmpty(t("validation.required")),
      household_name: isNotEmpty(t("validation.required")),
    },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await setup.mutateAsync(values);
      await navigate("/", { replace: true });
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <AuthCard title={t("setup.title")}>
      <Text c="dimmed">{t("setup.intro")}</Text>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={setup.error} />
          <TextInput
            label={t("common.displayName")}
            autoComplete="name"
            required
            {...form.getInputProps("display_name")}
          />
          <TextInput
            label={t("common.email")}
            type="email"
            autoComplete="email"
            required
            {...form.getInputProps("email")}
          />
          <PasswordField
            label={t("common.password")}
            autoComplete="new-password"
            required
            {...form.getInputProps("password")}
          />
          <TextInput
            label={t("setup.householdName")}
            placeholder={t("setup.householdNamePlaceholder")}
            required
            {...form.getInputProps("household_name")}
          />
          <Button type="submit" loading={setup.isPending} mt="xs">
            {t("setup.submit")}
          </Button>
        </Stack>
      </form>
    </AuthCard>
  );
}
