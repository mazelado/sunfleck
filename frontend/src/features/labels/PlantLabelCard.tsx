import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconNfc, IconPrinter } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { Plant } from "../../api/plants";
import { QrCode } from "../../components/QrCode";
import { canWriteNfc, writeUrlToTag } from "./nfc";
import { usePlantUrl } from "./plantUrl";

/** The plant's QR code, a link to print it as a label, and writing it to an NFC tag. */
export function PlantLabelCard({ plant }: { plant: Plant }) {
  const { t } = useTranslation();
  const url = usePlantUrl()(plant.id);
  const [writing, setWriting] = useState(false);

  async function writeTag() {
    setWriting(true);
    try {
      await writeUrlToTag(url);
      notifications.show({ message: t("labels.nfcWritten", { name: plant.nickname }) });
    } catch {
      notifications.show({ color: "red", message: t("labels.nfcFailed") });
    } finally {
      setWriting(false);
    }
  }

  return (
    <Paper withBorder radius="lg" p="lg">
      <Group align="flex-start" wrap="nowrap" gap="md">
        <QrCode value={url} size="88px" label={t("labels.codeFor", { name: plant.nickname })} />
        <Stack gap="xs" align="flex-start" style={{ minWidth: 0 }}>
          <Title order={2} fz="h4">
            {t("labels.cardTitle")}
          </Title>
          <Text size="sm" c="dimmed">
            {t("labels.cardHelp")}
          </Text>
          <Group gap="xs">
            <Button
              component={Link}
              to={`/plants/labels?plant=${String(plant.id)}`}
              size="xs"
              variant="light"
              leftSection={<IconPrinter size={14} />}
            >
              {t("labels.printOne")}
            </Button>
            {canWriteNfc() && (
              <Button
                size="xs"
                variant="light"
                leftSection={<IconNfc size={14} />}
                loading={writing}
                onClick={() => {
                  void writeTag();
                }}
              >
                {t("labels.writeNfc")}
              </Button>
            )}
          </Group>
          {writing && (
            <Text size="sm" role="status">
              {t("labels.nfcHold")}
            </Text>
          )}
        </Stack>
      </Group>
    </Paper>
  );
}
