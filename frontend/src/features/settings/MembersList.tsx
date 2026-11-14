import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Menu,
  Modal,
  Paper,
  Select,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDots, IconKey, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type Me,
  type Member,
  useChangeRole,
  useCreatePasswordResetLink,
  useMembers,
  useRemoveMember,
} from "../../api/accounts";
import { useErrorMessage } from "../../api/useErrorMessage";
import { CopyableLink } from "../../components/CopyableLink";
import { ErrorAlert } from "../../components/ErrorAlert";
import { PersonAvatar } from "../../components/PersonAvatar";
import { useRoleOptions } from "./useRoleOptions";

// --- Members ----------------------------------------------------------------------------------

export function MembersList({ me, isAdmin }: { me: Me; isAdmin: boolean }) {
  const { t } = useTranslation();
  const members = useMembers();
  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Title order={2} fz="h4">
          {t("household.members")}
        </Title>
        <ErrorAlert error={members.error} />
        {members.data?.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            isMe={member.user_id === me.id}
            isAdmin={isAdmin}
          />
        ))}
      </Stack>
    </Paper>
  );
}

function memberName(member: Member): string {
  return member.display_name || member.email;
}

function MemberRow({ member, isMe, isAdmin }: { member: Member; isMe: boolean; isAdmin: boolean }) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const roleOptions = useRoleOptions();
  const changeRole = useChangeRole();
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const createResetLink = useCreatePasswordResetLink();
  const removeMember = useRemoveMember();
  const name = memberName(member);

  function showError(error: unknown) {
    notifications.show({ color: "red", message: errorMessage(error) });
  }

  return (
    <Group justify="space-between" wrap="nowrap" gap="sm">
      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
        <PersonAvatar url={member.avatar_url} size="md" />
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text fw={500} truncate>
            {name}{" "}
            {isMe && (
              <Text span c="dimmed">
                ({t("household.you")})
              </Text>
            )}
          </Text>
          <Text size="sm" c="dimmed" truncate>
            {member.email}
          </Text>
        </Stack>
      </Group>
      {isAdmin ? (
        <Group gap="xs" wrap="nowrap">
          <Select
            aria-label={`${t("household.role")}: ${name}`}
            data={roleOptions}
            value={member.role}
            allowDeselect={false}
            w={130}
            onChange={(role) => {
              if (role && role !== member.role) {
                changeRole.mutateAsync({ memberId: member.id, role: role }).catch(showError);
              }
            }}
          />
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon variant="subtle" aria-label={t("household.actions", { name })}>
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                leftSection={<IconKey size={16} />}
                onClick={() => {
                  createResetLink.mutateAsync(member.id).then(setResetLink).catch(showError);
                }}
              >
                {t("household.resetLink")}
              </Menu.Item>
              <Menu.Item
                color="red"
                leftSection={<IconTrash size={16} />}
                onClick={() => {
                  setConfirmingRemoval(true);
                }}
              >
                {t("household.remove")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Group>
      ) : (
        <Badge variant="light">{t(`roles.${member.role}`)}</Badge>
      )}

      <Modal
        opened={resetLink !== null}
        onClose={() => {
          setResetLink(null);
        }}
        title={t("household.resetLinkTitle", { name })}
      >
        <Stack gap="sm">
          <Text size="sm">{t("household.resetLinkHelp", { name })}</Text>
          {resetLink && <CopyableLink url={resetLink} label={t("household.resetLink")} />}
        </Stack>
      </Modal>

      <Modal
        opened={confirmingRemoval}
        onClose={() => {
          setConfirmingRemoval(false);
        }}
        title={t("household.removeTitle", { name })}
      >
        <Stack gap="md">
          <Text size="sm">{t("household.removeConfirm")}</Text>
          <ErrorAlert error={removeMember.error} />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setConfirmingRemoval(false);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button
              color="red"
              loading={removeMember.isPending}
              onClick={() => {
                removeMember
                  .mutateAsync(member.id)
                  .then(() => {
                    setConfirmingRemoval(false);
                    notifications.show({ message: t("household.removed", { name }) });
                  })
                  .catch(() => undefined); // shown by ErrorAlert
              }}
            >
              {t("household.remove")}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Group>
  );
}
