import { Button, Paper, Select, Stack, Text, TextInput } from "@mantine/core";
import { isEmail, useForm } from "@mantine/form";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type InvitationCreated, type Role, useCreateInvitation } from "../../api/accounts";
import { CopyableLink } from "../../components/CopyableLink";
import { ErrorAlert } from "../../components/ErrorAlert";
import { useRoleOptions } from "./useRoleOptions";

export function InviteForm() {
  const { t } = useTranslation();
  const roleOptions = useRoleOptions();
  const createInvitation = useCreateInvitation();
  const [created, setCreated] = useState<InvitationCreated | null>(null);
  const form = useForm<{ email: string; role: Role }>({
    initialValues: { email: "", role: "gardener" },
    validate: { email: isEmail(t("validation.email")) },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      setCreated(await createInvitation.mutateAsync(values));
      form.reset();
    } catch {
      // The error is shown by ErrorAlert.
    }
  });

  return (
    <Stack gap="sm">
      <form onSubmit={handleSubmit} noValidate>
        <Stack gap="sm">
          <ErrorAlert error={createInvitation.error} />
          <TextInput
            label={t("household.inviteEmail")}
            type="email"
            required
            {...form.getInputProps("email")}
          />
          <Select
            label={t("household.role")}
            data={roleOptions}
            allowDeselect={false}
            description={t(`roles.${form.getValues().role}Description`)}
            {...form.getInputProps("role")}
          />
          <Button
            type="submit"
            loading={createInvitation.isPending}
            style={{ alignSelf: "flex-start" }}
          >
            {t("household.sendInvitation")}
          </Button>
        </Stack>
      </form>
      {created && (
        <Paper withBorder radius="md" p="md" bg="var(--mantine-color-green-light)" role="status">
          <Stack gap="xs">
            <Text fw={500}>{t("household.invitationCreated")}</Text>
            <Text size="sm">
              {created.email_sent
                ? t("household.invitationEmailed", { email: created.email })
                : t("household.invitationNotEmailed", { email: created.email })}
            </Text>
            <CopyableLink url={created.url} label={t("household.invitationCreated")} />
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
