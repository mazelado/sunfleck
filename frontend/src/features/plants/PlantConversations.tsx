import { Anchor, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { IconMessageQuestion } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { useConversations } from "../../api/conversations";
import { useSuggestAvailable } from "../../api/taxonomy";
import { relativeDay } from "../../lib/relativeTime";

/**
 * "Ask about this plant": the plant's conversations with the household's AI plugin, for
 * everyone to read, and starting a new one. Hidden when there are none and no AI plugin is on.
 */
export function PlantConversations({
  plantId,
  plantName,
  canEdit,
}: {
  plantId: number;
  plantName: string;
  canEdit: boolean;
}) {
  const { t, i18n } = useTranslation();
  const available = useSuggestAvailable().data?.available ?? false;
  const conversations = useConversations(plantId).data ?? [];
  const canAsk = canEdit && available;
  if (!canAsk && conversations.length === 0) {
    return null;
  }
  return (
    <Paper withBorder radius="lg" p="lg">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={2} fz="h4">
            {t("conversations.title")}
          </Title>
          {canAsk && (
            <Button
              component={Link}
              to={`/plants/${String(plantId)}/conversations/new`}
              size="xs"
              variant="light"
              color="grape"
              leftSection={<IconMessageQuestion size={14} />}
            >
              {t("conversations.ask", { name: plantName })}
            </Button>
          )}
        </Group>
        {conversations.length === 0 ? (
          <Text size="sm" c="dimmed">
            {t("conversations.empty", { name: plantName })}
          </Text>
        ) : (
          <Stack gap="xs">
            {conversations.map((conversation) => (
              <Stack key={conversation.id} gap={0}>
                <Anchor
                  component={Link}
                  to={`/plants/${String(plantId)}/conversations/${String(conversation.id)}`}
                >
                  {conversation.title}
                </Anchor>
                <Text size="xs" c="dimmed">
                  {[
                    conversation.started_by,
                    relativeDay(conversation.updated_at, i18n.language),
                    t("conversations.questions", { count: conversation.questions }),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </Stack>
            ))}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
