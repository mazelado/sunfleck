import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router";
import {
  type Conversation,
  useAskAgain,
  useConversation,
  useDeleteConversation,
  useStartConversation,
} from "../../api/conversations";
import { usePlant } from "../../api/plants";
import { useSuggestAvailable } from "../../api/taxonomy";
import { ConfirmDeleteButton } from "../../components/ConfirmDeleteButton";
import { PageHeader } from "../../components/PageHeader";
import { ErrorAlert } from "../../components/ErrorAlert";
import { FullPageLoader } from "../../components/FullPageLoader";
import { useCanEdit } from "../../lib/useCanEdit";
import { formatDateTime } from "./dates";
import { MessageBubble } from "./MessageBubble";
import { Composer } from "./Composer";

/**
 * A conversation with the household's AI plugin about one plant, kept on the plant: everyone
 * can read it, and Gardeners and Admins can ask further questions. `new` starts one.
 */
export function ConversationPage() {
  const params = useParams();
  const plantId = Number(params.plantId);
  const conversationId = params.conversationId === "new" ? null : Number(params.conversationId);
  const plant = usePlant(plantId);
  const conversation = useConversation(conversationId);

  if (plant.isPending || (conversationId !== null && conversation.isPending)) {
    return <FullPageLoader />;
  }
  if (!plant.data) {
    return <ErrorAlert error={plant.error} />;
  }
  if (conversationId !== null && !conversation.data) {
    return <ErrorAlert error={conversation.error} />;
  }
  const name = plant.data.nickname;
  return (
    <Stack gap="lg">
      {conversation.data ? (
        <Thread key={conversation.data.id} conversation={conversation.data} plantName={name} />
      ) : (
        <NewConversation plantId={plantId} plantName={name} />
      )}
    </Stack>
  );
}

function NewConversation({ plantId, plantName }: { plantId: number; plantName: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const start = useStartConversation(plantId);
  const canAsk = useCanAsk();
  return (
    <>
      <PageHeader
        title={t("conversations.ask", { name: plantName })}
        back={{ to: `/plants/${String(plantId)}`, label: plantName }}
      />
      {canAsk ? (
        <Composer
          label={t("conversations.question")}
          pending={start.isPending}
          error={start.error}
          starters
          onAsk={async (question) => {
            const conversation = await start.mutateAsync(question);
            await navigate(`/plants/${String(plantId)}/conversations/${String(conversation.id)}`, {
              replace: true,
            });
          }}
        />
      ) : (
        <CantAsk />
      )}
    </>
  );
}

function Thread({ conversation, plantName }: { conversation: Conversation; plantName: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const ask = useAskAgain(conversation.id);
  const remove = useDeleteConversation(conversation.plant_id);
  const canEdit = useCanEdit();
  const canAsk = useCanAsk();
  const latest = useRef<HTMLDivElement>(null);
  const count = conversation.messages.length;

  // After a further answer, show it from its question.
  const shown = useRef(count);
  useEffect(() => {
    if (count > shown.current) {
      latest.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    shown.current = count;
  }, [count]);

  return (
    <>
      <PageHeader
        title={conversation.title}
        back={{ to: `/plants/${String(conversation.plant_id)}`, label: plantName }}
        subtitle={
          conversation.started_by
            ? t("conversations.startedBy", {
                name: conversation.started_by,
                date: formatDateTime(conversation.created_at, i18n.language),
              })
            : formatDateTime(conversation.created_at, i18n.language)
        }
      />
      <Stack gap="sm">
        {conversation.messages.map((message, index) => (
          <div key={message.id} ref={index === count - 2 ? latest : undefined}>
            <MessageBubble message={message} />
          </div>
        ))}
      </Stack>
      {conversation.can_continue ? (
        canAsk ? (
          <Composer
            label={t("conversations.followUp")}
            pending={ask.isPending}
            error={ask.error}
            onAsk={async (question) => {
              await ask.mutateAsync(question);
            }}
          />
        ) : (
          canEdit && <CantAsk />
        )
      ) : (
        <Alert color="gray">
          <Stack gap="xs" align="flex-start">
            <Text size="sm">{t("conversations.tooLong")}</Text>
            {canAsk && (
              <Button
                component={Link}
                to={`/plants/${String(conversation.plant_id)}/conversations/new`}
                size="xs"
                variant="light"
              >
                {t("conversations.ask", { name: plantName })}
              </Button>
            )}
          </Stack>
        </Alert>
      )}
      {canEdit && (
        <Group>
          <ConfirmDeleteButton
            label={t("conversations.delete")}
            title={t("conversations.deleteTitle")}
            message={t("conversations.deleteMessage", { name: plantName })}
            onConfirm={async () => {
              await remove.mutateAsync(conversation.id);
              await navigate(`/plants/${String(conversation.plant_id)}`, { replace: true });
            }}
          />
        </Group>
      )}
    </>
  );
}

function CantAsk() {
  const { t } = useTranslation();
  return (
    <Text size="sm" c="dimmed">
      {t("conversations.noAi")}
    </Text>
  );
}

/** Gardeners and Admins can ask, when an AI plugin is on. */
function useCanAsk(): boolean {
  const canEdit = useCanEdit();
  const available = useSuggestAvailable().data?.available ?? false;
  return canEdit && available;
}
