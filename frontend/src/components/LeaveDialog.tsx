import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import type { useBlocker } from "react-router";

interface Props {
  blocker: ReturnType<typeof useBlocker>;
  /** Instead of "Leave without saving?" and its message, for a form that isn't saved. */
  title?: string;
  message?: string;
}

/** "Leave without saving?", for a form's `useLeaveGuard`. */
export function LeaveDialog({ blocker, title, message }: Props) {
  const { t } = useTranslation();
  const blocked = blocker.state === "blocked";
  return (
    <Modal
      opened={blocked}
      onClose={() => {
        if (blocker.state === "blocked") blocker.reset();
      }}
      title={title ?? t("leave.title")}
    >
      <Stack gap="md">
        <Text size="sm">{message ?? t("leave.message")}</Text>
        <Group justify="flex-end" gap="xs">
          <Button
            variant="default"
            onClick={() => {
              if (blocker.state === "blocked") blocker.proceed();
            }}
          >
            {t("leave.leave")}
          </Button>
          <Button
            data-autofocus
            onClick={() => {
              if (blocker.state === "blocked") blocker.reset();
            }}
          >
            {t("leave.stay")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
