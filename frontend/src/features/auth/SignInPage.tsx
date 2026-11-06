import { Anchor, Button, Stack, Text, TextInput } from "@mantine/core";
import { isEmail, isNotEmpty, useForm } from "@mantine/form";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";

import { useMe, useSignIn } from "../../api/accounts";
import { AuthCard } from "../../components/AuthCard";
import { PasswordField } from "../../components/PasswordField";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { safeNextPath } from "../layout/safeNextPath";

export function SignInPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  // The Django admin site sends people here to sign in; it's served by the server, not the app.
  const serverPage = next.startsWith("/admin/");
  const me = useMe();
  const signIn = useSignIn();
  const form = useForm({
    initialValues: { email: "", password: "" },
    validate: {
      email: isEmail(t("validation.email")),
      password: isNotEmpty(t("validation.required")),
    },
  });

  useEffect(() => {
    if (me.data && serverPage) window.location.replace(next);
  }, [me.data, serverPage, next]);

  if (me.isPending || (me.data && serverPage)) {
    return <FullPageLoader />;
  }
  if (me.data && !signIn.isPending) {
    return <Navigate to={next} replace />;
  }

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await signIn.mutateAsync(values);
      if (serverPage) {
        window.location.replace(next);
      } else {
        await navigate(next, { replace: true });
      }
    } catch {
      // The error is shown by ErrorAlert.
    }
  });

  return (
    <AuthCard title={t("signIn.title")}>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={signIn.error} />
          <TextInput
            label={t("common.email")}
            type="email"
            autoComplete="email"
            required
            {...form.getInputProps("email")}
          />
          <PasswordField
            label={t("common.password")}
            autoComplete="current-password"
            required
            {...form.getInputProps("password")}
          />
          <Anchor component={Link} to="/forgot-password" size="sm">
            {t("signIn.forgotPassword")}
          </Anchor>
          <Button type="submit" loading={signIn.isPending}>
            {t("signIn.submit")}
          </Button>
          <Text size="sm" c="dimmed">
            {t("signIn.noAccount")}
          </Text>
        </Stack>
      </form>
    </AuthCard>
  );
}
