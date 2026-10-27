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
  TextInput,
  Title,
} from "@mantine/core";
import { isEmail, isNotEmpty, useForm } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { IconDots, IconKey, IconTrash, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import {
  type InvitationCreated,
  type Me,
  type Member,
  type Role,
  useChangeRole,
  useCreateInvitation,
  useCreatePasswordResetLink,
  useInvitations,
  useMe,
  useMembers,
  useRemoveMember,
  useRevokeInvitation,
  useUpdateHousehold,
} from "../../api/accounts";
import { useErrorMessage } from "../../api/useErrorMessage";
import { CopyableLink } from "../../components/CopyableLink";
import { ErrorAlert } from "../../components/ErrorAlert";

const ROLES: Role[] = ["admin", "gardener", "viewer"];

function useRoleOptions() {
  const { t } = useTranslation();
  return ROLES.map((role) => ({ value: role, label: t(`roles.${role}`) }));
}

export function HouseholdPage() {
  const { t } = useTranslation();
  const me = useMe().data;
  if (!me?.household) {
    return null;
  }
  const isAdmin = me.role === "admin";
  return (
    <Stack gap="lg">
      <Title order={1} fz="h2">
        {t("household.title")}
      </Title>
      {isAdmin ? (
        <HouseholdNameForm name={me.household.name} />
      ) : (
        <Text fz="lg">{me.household.name}</Text>
      )}
      <MembersList me={me} isAdmin={isAdmin} />
      {isAdmin && <Invitations />}
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
          <ErrorAlert error={updateHousehold.error} />
          <Group align="flex-end" wrap="nowrap">
            <TextInput
              label={t("household.name")}
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

// --- Members ----------------------------------------------------------------------------------

function MembersList({ me, isAdmin }: { me: Me; isAdmin: boolean }) {
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

// --- Invitations ------------------------------------------------------------------------------

function Invitations() {
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
        <InviteForm />
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

function InviteForm() {
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
          <Text fw={500}>{t("household.inviteSomeone")}</Text>
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
