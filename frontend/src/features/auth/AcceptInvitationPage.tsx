import { Alert, Anchor, Button, Stack, Text, TextInput } from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";

import { useAcceptInvitation, useInvitationPreview } from "../../api/accounts";
import { AuthCard } from "../../components/AuthCard";
import { PasswordField } from "../../components/PasswordField";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { useApplyFieldErrors } from "./serverErrors";

export function AcceptInvitationPage() {
  const { t } = useTranslation();
  const applyFieldErrors = useApplyFieldErrors();
  const navigate = useNavigate();
  const { token = "" } = useParams();
  const preview = useInvitationPreview(token);
  const accept = useAcceptInvitation(token);
  const form = useForm({
    initialValues: { display_name: "", password: "" },
    validate: {
      display_name: isNotEmpty(t("validation.required")),
      password: isNotEmpty(t("validation.required")),
    },
  });

  if (preview.isPending) {
    return <FullPageLoader />;
  }
  if (preview.isError) {
    return (
      <AuthCard title={t("app.name")}>
        <Alert color="orange" role="alert">
          {t("invite.invalid")}
        </Alert>
        <Anchor component={Link} to="/sign-in" size="sm">
          {t("common.backToSignIn")}
        </Anchor>
      </AuthCard>
    );
  }

  const invitation = preview.data;
  const role = t(`roles.${invitation.role}`);
  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await accept.mutateAsync(values);
      await navigate("/", { replace: true });
    } catch (error) {
      applyFieldErrors(form, error);
    }
  });

  return (
    <AuthCard title={t("invite.title", { household: invitation.household_name })}>
      <Text c="dimmed">
        {invitation.invited_by
          ? t("invite.intro", { inviter: invitation.invited_by, role })
          : t("invite.introNoInviter", { role })}
      </Text>
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={accept.error} />
          <TextInput label={t("common.email")} value={invitation.email} readOnly disabled />
          <TextInput
            label={t("common.displayName")}
            autoComplete="name"
            required
            {...form.getInputProps("display_name")}
          />
          <PasswordField
            label={t("common.password")}
            autoComplete="new-password"
            required
            {...form.getInputProps("password")}
          />
          <Button type="submit" loading={accept.isPending}>
            {t("invite.submit")}
          </Button>
        </Stack>
      </form>
    </AuthCard>
  );
}
