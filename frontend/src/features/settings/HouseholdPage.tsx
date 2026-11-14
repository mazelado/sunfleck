import { Button, Group, Paper, Stack, TextInput, Title } from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { useMe, useUpdateHousehold } from "../../api/accounts";
import { PageHeader } from "../../components/PageHeader";
import { ErrorAlert } from "../../components/ErrorAlert";
import { MembersList } from "./MembersList";
import { Invitations } from "./Invitations";
import { InviteForm } from "./InviteForm";

export function HouseholdPage() {
  const { t } = useTranslation();
  const me = useMe().data;
  const { hash } = useLocation();
  const loaded = Boolean(me?.household);
  // From "Invite someone" on the Settings page: straight to the email field.
  useEffect(() => {
    if (!loaded || hash !== "#invite") return;
    const card = document.getElementById("invite");
    card?.scrollIntoView({ block: "start" });
    card?.querySelector<HTMLInputElement>('input[type="email"]')?.focus();
  }, [hash, loaded]);
  if (!me?.household) {
    return null;
  }
  const isAdmin = me.role === "admin";
  return (
    <Stack gap="lg">
      <PageHeader
        title={t("household.title")}
        back={{ to: "/settings", label: t("settings.title") }}
        subtitle={isAdmin ? undefined : me.household.name}
      />
      {/* Inviting someone first, in a card of its own: it's what people come here to do, and
          the household's name has its own Save. */}
      {isAdmin && (
        <Paper withBorder radius="lg" p="lg" id="invite">
          <Stack gap="sm">
            <Title order={2} fz="h4">
              {t("household.inviteSomeone")}
            </Title>
            <InviteForm />
          </Stack>
        </Paper>
      )}
      <MembersList me={me} isAdmin={isAdmin} />
      {isAdmin && <Invitations />}
      {isAdmin && <HouseholdNameForm name={me.household.name} />}
    </Stack>
  );
}

function HouseholdNameForm({ name }: { name: string }) {
  const { t } = useTranslation();
  const updateHousehold = useUpdateHousehold();
  const form = useForm({
    initialValues: { name },
    validate: { name: isNotEmpty(t("validation.required")) },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      await updateHousehold.mutateAsync(values.name);
      notifications.show({ color: "green", message: t("common.saved") });
    } catch {
      // The error is shown by ErrorAlert.
    }
  });

  return (
    <Paper withBorder radius="lg" p="lg">
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <Title order={2} fz="h4">
            {t("household.name")}
          </Title>
          <ErrorAlert error={updateHousehold.error} />
          <Group align="flex-end" wrap="nowrap">
            <TextInput
              aria-label={t("household.name")}
              style={{ flex: 1 }}
              {...form.getInputProps("name")}
            />
            <Button type="submit" loading={updateHousehold.isPending}>
              {t("common.save")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
