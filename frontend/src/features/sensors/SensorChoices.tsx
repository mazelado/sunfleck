import { Button, Group, Loader, Radio, Stack, Text } from "@mantine/core";
import type { UseQueryResult } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import type { SensorChoice } from "../../api/sensors";
import { ErrorAlert } from "../../components/ErrorAlert";
import { kindInSentence } from "./sensorKinds";

interface SensorChoicesProps {
  kind: string;
  choices: UseQueryResult<SensorChoice[]>;
  value: string;
  keyOf: (choice: SensorChoice) => string;
  onChange: (value: string) => void;
}

/** The sensors of a kind the plugins offer, asked for now: while asking, none, or a problem. */
export function SensorChoices({ kind, choices, value, keyOf, onChange }: SensorChoicesProps) {
  const { t } = useTranslation();
  const name = kindInSentence(kind, t);
  if (choices.isFetching) {
    return (
      <Group gap="sm" role="status">
        <Loader size="sm" />
        <Text size="sm">{t("sensors.asking")}</Text>
      </Group>
    );
  }
  if (choices.isError) {
    return (
      <Stack gap="xs" align="flex-start">
        <ErrorAlert error={choices.error} />
        <Button variant="default" onClick={() => void choices.refetch()}>
          {t("sensors.tryAgain")}
        </Button>
      </Stack>
    );
  }
  const items = choices.data ?? [];
  if (items.length === 0) {
    return (
      <Stack gap={4}>
        <Text size="sm" fw={600}>
          {t("sensors.noChoices", { kind: name })}
        </Text>
        <Text size="sm" c="dimmed">
          {t("sensors.noChoicesHelp")}
        </Text>
      </Stack>
    );
  }
  return (
    <Radio.Group label={t("sensors.whichSensor", { kind: name })} value={value} onChange={onChange}>
      <Stack gap="sm" mt="xs">
        {items.map((choice) => (
          <Radio
            key={keyOf(choice)}
            value={keyOf(choice)}
            label={choice.name}
            description={choice.sensor_id}
          />
        ))}
      </Stack>
    </Radio.Group>
  );
}
