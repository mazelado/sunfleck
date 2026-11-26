import { Button, Group, Paper, Stack, TextInput, Title } from "@mantine/core";
import { isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router";
import { useMe, useUpdateHousehold } from "../../api/accounts";
import { PageHeader } from "../../components/PageHeader";
import { ErrorAlert } from "../../components/ErrorAlert";
import { HouseholdAreas } from "./HouseholdAreas";
import { MembersList } from "./MembersList";
import { Invitations } from "./Invitations";
import { InviteForm } from "./InviteForm";

export function HouseholdPage() {
  const { t } = useTranslation();
  const me = useMe().data;
  const { hash } = useLocation();
  const loaded = Boolean(me?.household);
  // From "Invite someone" on the Settings page: straight to the email field. From a part of
  // the app that's turned off: to its switch.
  useEffect(() => {
    if (!loaded || (hash !== "#invite" && hash !== "#areas")) return;
    const card = document.getElementById(hash.slice(1));
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
      {isAdmin && <HouseholdAreas household={me.household} />}
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
      await updateHousehold.mutateAsync({ name: values.name });
      form.resetDirty();
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
            {/* Off until the name changes: in the usability test, people typed an invitee's
                email, then pressed this Save, the last on the page, instead of inviting. */}
            <Button type="submit" loading={updateHousehold.isPending} disabled={!form.isDirty()}>
              {t("common.save")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
