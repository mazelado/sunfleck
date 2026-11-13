import { Button, Container, Group, Paper, Stack, Text } from "@mantine/core";
import type { ReactNode, SyntheticEvent } from "react";
import { useTranslation } from "react-i18next";

import { PageHeader } from "../../components/PageHeader";

interface WelcomeStepProps {
  /** 1 to `of`. */
  step: number;
  of: number;
  /** The step's one question, the page's h1. */
  question: string;
  /** One line on why it's asked. */
  why?: string;
  /** The primary button, named for what comes next ("Next: the room"). */
  next: string;
  saving: boolean;
  onSubmit: (event?: SyntheticEvent<HTMLFormElement>) => void;
  onBack?: () => void;
  children: ReactNode;
}

/** One screen of the first-run flow: its question, the fields, Back, and the next step. */
export function WelcomeStep({
  step,
  of,
  question,
  why,
  next,
  saving,
  onSubmit,
  onBack,
  children,
}: WelcomeStepProps) {
  const { t } = useTranslation();
  return (
    <Container size="reading" px={0}>
      <Stack gap="lg">
        <PageHeader
          title={question}
          eyebrow={
            <Text className="sunfleck-card-label" size="xs">
              {t("welcome.stepOf", { step, of })}
            </Text>
          }
          subtitle={why}
        />
        <Paper withBorder radius="lg" p="lg">
          <form onSubmit={onSubmit} noValidate>
            <Stack gap="md">
              {children}
              <Group justify="space-between" className="sunfleck-form-actions">
                {onBack ? (
                  <Button variant="default" onClick={onBack}>
                    {t("common.back")}
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="submit" loading={saving}>
                  {next}
                </Button>
              </Group>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </Container>
  );
}
