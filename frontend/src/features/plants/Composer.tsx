import { Button, Group, Loader, Paper, Stack, Text, Textarea } from "@mantine/core";
import { IconSend } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorAlert } from "../../components/ErrorAlert";

/** Questions to start from, for a new conversation. */
const STARTERS = ["water", "light", "repot", "grow"] as const;

interface ComposerProps {
  label: string;
  pending: boolean;
  error: unknown;
  starters?: boolean;
  /** Ask; the question is cleared once it's answered, and kept if it fails. */
  onAsk: (question: string) => Promise<void>;
}

export function Composer({ label, pending, error, starters = false, onAsk }: ComposerProps) {
  const { t } = useTranslation();
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState<string | null>(null);

  async function submit() {
    const text = question.trim();
    if (!text || pending) return;
    setAsking(text);
    try {
      await onAsk(text);
      setQuestion("");
    } catch {
      // Shown from `error`; the question stays to try again.
    } finally {
      setAsking(null);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <Stack gap="sm">
        {pending && asking && (
          <>
            <Paper radius="lg" p="sm" ml="xl" bg="var(--mantine-color-default-hover)">
              <Text style={{ whiteSpace: "pre-wrap" }}>{asking}</Text>
            </Paper>
            <Group gap="xs" role="status">
              <Loader size="xs" type="dots" />
              <Text size="sm" c="dimmed">
                {t("conversations.thinking")}
              </Text>
            </Group>
          </>
        )}
        {starters && !pending && (
          <Group gap="xs">
            {STARTERS.map((key) => (
              <Button
                key={key}
                size="compact-sm"
                radius="xl"
                variant="default"
                fw={400}
                onClick={() => {
                  setQuestion(t(`conversations.starters.${key}`));
                }}
              >
                {t(`conversations.starters.${key}`)}
              </Button>
            ))}
          </Group>
        )}
        <Textarea
          label={label}
          value={question}
          onChange={(event) => {
            setQuestion(event.currentTarget.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              void submit();
            }
          }}
          maxLength={2000}
          autosize
          minRows={2}
          maxRows={8}
          disabled={pending}
        />
        <ErrorAlert error={error} />
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Text size="xs" c="dimmed">
            {t("conversations.privacy")}
          </Text>
          <Button
            type="submit"
            loading={pending}
            disabled={!question.trim()}
            leftSection={<IconSend size={16} />}
            style={{ flexShrink: 0 }}
          >
            {t("conversations.send")}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
