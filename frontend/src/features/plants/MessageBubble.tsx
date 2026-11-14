import { Paper, Text } from "@mantine/core";
import { type ChatMessage } from "../../api/conversations";

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "question") {
    return (
      <Paper radius="lg" p="sm" ml="xl" bg="var(--mantine-color-default-hover)">
        {message.asked_by && (
          <Text size="xs" fw={600} c="dimmed">
            {message.asked_by}
          </Text>
        )}
        <Text style={{ whiteSpace: "pre-wrap" }}>{message.text}</Text>
      </Paper>
    );
  }
  return (
    <Paper withBorder radius="lg" p="sm" mr="xl">
      <Text style={{ whiteSpace: "pre-wrap" }}>{message.text}</Text>
      <Text size="xs" c="dimmed" mt={6}>
        {message.attribution}
      </Text>
    </Paper>
  );
}
