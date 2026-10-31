import { Alert, Anchor, Button, Group, Stack, Text } from "@mantine/core";
import { IconSparkles } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import {
  type SuggestionRequest,
  useSuggestAvailable,
  useSuggestCareProfile,
} from "../../api/taxonomy";
import { ErrorAlert } from "../../components/ErrorAlert";

/**
 * "Suggest with AI": for a plant with no care profile from its species, ask the household's AI
 * plugin which built-in profile fits best. It's only shown, with its reason: the person chooses
 * whether to use it. Hidden when no AI plugin is on.
 */
export function SuggestCareProfile({
  request,
  onUse,
}: {
  request: SuggestionRequest | null;
  onUse: (key: string) => void;
}) {
  const { t } = useTranslation();
  const available = useSuggestAvailable().data?.available ?? false;
  const suggest = useSuggestCareProfile();
  if (!available) {
    return null;
  }
  const suggestion = suggest.data;
  return (
    <Stack gap="xs">
      <Group>
        <Button
          variant="light"
          size="xs"
          leftSection={<IconSparkles size={14} />}
          disabled={!request}
          loading={suggest.isPending}
          onClick={() => {
            if (request) suggest.mutate(request);
          }}
        >
          {t("suggest.button")}
        </Button>
        {!request && (
          <Text size="xs" c="dimmed">
            {t("suggest.needName")}
          </Text>
        )}
      </Group>
      <ErrorAlert error={suggest.error} />
      {suggestion && (
        <Alert variant="light" color="grape" icon={<IconSparkles />}>
          <Stack gap={6}>
            <Text size="sm">
              {t("suggest.result", {
                name: suggestion.profile.name,
                confidence: t(`suggest.confidence.${suggestion.confidence as "high"}`),
              })}
            </Text>
            <Text size="sm">{suggestion.reason}</Text>
            <Text size="xs" c="dimmed">
              {suggestion.attribution} · {t("suggest.check")}{" "}
              <Anchor
                component={Link}
                to={`/guide/profiles/${suggestion.profile.key}`}
                target="_blank"
                size="xs"
              >
                {t("suggest.inGuide")}
              </Anchor>
            </Text>
            <Group>
              <Button
                size="xs"
                onClick={() => {
                  onUse(suggestion.profile.key);
                  suggest.reset();
                }}
              >
                {t("suggest.use", { name: suggestion.profile.name })}
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}
    </Stack>
  );
}
