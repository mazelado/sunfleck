import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ErrorAlert } from "./ErrorAlert";

interface ConfirmDeleteButtonProps {
  label: string;
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
}

/** A delete button that asks for confirmation first, and shows any error in the dialog. */
export function ConfirmDeleteButton({
  label,
  title,
  message,
  onConfirm,
}: ConfirmDeleteButtonProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      setOpened(false);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="subtle"
        color="red"
        leftSection={<IconTrash size={16} />}
        onClick={() => {
          setOpened(true);
        }}
      >
        {label}
      </Button>
      <Modal
        opened={opened}
        onClose={() => {
          setOpened(false);
        }}
        title={title}
      >
        <Stack gap="md">
          <Text size="sm">{message}</Text>
          <ErrorAlert error={error} />
          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => {
                setOpened(false);
              }}
            >
              {t("common.cancel")}
            </Button>
            <Button color="red" loading={busy} onClick={() => void confirm()}>
              {label}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
