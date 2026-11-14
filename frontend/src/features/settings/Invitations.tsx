import { ActionIcon, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useInvitations, useRevokeInvitation } from "../../api/accounts";
import { ErrorAlert } from "../../components/ErrorAlert";

// --- Invitations ------------------------------------------------------------------------------

export function Invitations() {
  const { t, i18n } = useTranslation();
  const invitations = useInvitations(true);
  const revoke = useRevokeInvitation();
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });

  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="md">
        <Title order={2} fz="h4">
          {t("household.invitations")}
        </Title>
        <ErrorAlert error={invitations.error ?? revoke.error} />
        {invitations.data?.length === 0 && (
          <Text size="sm" c="dimmed">
            {t("household.noInvitations")}
          </Text>
        )}
        {invitations.data?.map((invitation) => (
          <Group key={invitation.id} justify="space-between" wrap="nowrap">
            <Stack gap={0} style={{ minWidth: 0 }}>
              <Text truncate>{invitation.email}</Text>
              <Text size="sm" c="dimmed">
                {t(`roles.${invitation.role}`)} ·{" "}
                {t("household.invitationExpires", {
                  date: dateFormat.format(new Date(invitation.expires_at)),
                })}
              </Text>
            </Stack>
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label={t("household.revoke", { email: invitation.email })}
              onClick={() => {
                revoke.mutate(invitation.id);
              }}
            >
              <IconX size={18} />
            </ActionIcon>
          </Group>
        ))}
      </Stack>
    </Paper>
  );
}
