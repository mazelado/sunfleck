import { ActionIcon, CopyButton, Group, TextInput, Tooltip } from "@mantine/core";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

interface CopyableLinkProps {
  url: string;
  label: string;
}

/** A read-only link with a copy button, for links an Admin passes on themselves. */
export function CopyableLink({ url, label }: CopyableLinkProps) {
  const { t } = useTranslation();
  return (
    <Group gap="xs" wrap="nowrap">
      <TextInput value={url} readOnly aria-label={label} style={{ flex: 1 }} />
      <CopyButton value={url}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? t("common.copied") : t("common.copy")}>
            <ActionIcon
              variant="light"
              size="lg"
              onClick={copy}
              aria-label={copied ? t("common.copied") : t("common.copy")}
            >
              {copied ? <IconCheck size={18} /> : <IconCopy size={18} />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  );
}
