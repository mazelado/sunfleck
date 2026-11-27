import { Alert, Button, Group, Modal, Radio, Stack, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { ApiError } from "../../api/errors";
import {
  type PlantSensor,
  type SensorChoice,
  useChooseSensor,
  useSensorChoices,
} from "../../api/sensors";
import { ErrorAlert } from "../../components/ErrorAlert";
import { SensorChoices } from "./SensorChoices";
import { kindInSentence, kindName } from "./sensorKinds";

interface SensorDialogProps {
  plantId: number;
  plantName: string;
  /** The sensor to change; none to add one, of one of `freeKinds`. */
  current?: PlantSensor;
  freeKinds: string[];
  onClose: () => void;
}

// A radio button's value for a sensor: which plugin, and its id there.
const keyOf = (sensor: Pick<SensorChoice, "plugin_id" | "sensor_id">) =>
  JSON.stringify([sensor.plugin_id, sensor.sensor_id]);

/**
 * Choose a sensor for a plant: what it measures (when adding one), then which of the sensors
 * the plugins offer for that. Choosing another than the plant has is asked first, since the
 * readings kept so far are forgotten.
 */
export function SensorDialog({
  plantId,
  plantName,
  current,
  freeKinds,
  onClose,
}: SensorDialogProps) {
  const { t } = useTranslation();
  const [kind, setKind] = useState<string | null>(
    current?.kind ?? (freeKinds.length === 1 ? (freeKinds[0] ?? null) : null),
  );
  const [chosen, setChosen] = useState(current ? keyOf(current) : "");
  const [confirming, setConfirming] = useState(false);
  const [stale, setStale] = useState(false);
  const choices = useSensorChoices(kind);
  const choose = useChooseSensor(plantId);
  const choice = choices.data?.find((each) => keyOf(each) === chosen);

  async function save() {
    if (!kind || !choice) return;
    if (current && keyOf(current) === chosen) {
      onClose();
      return;
    }
    if (current && !confirming) {
      setConfirming(true);
      return;
    }
    try {
      await choose.mutateAsync({
        kind,
        body: { plugin_id: choice.plugin_id, sensor_id: choice.sensor_id },
      });
    } catch (error) {
      if (error instanceof ApiError && error.code === "sensor_not_a_choice") {
        // The plugins offer other sensors than when the list was fetched.
        choose.reset();
        setConfirming(false);
        setChosen("");
        setStale(true);
        void choices.refetch();
      }
      return; // anything else is shown below
    }
    notifications.show({
      message: t("sensors.chosen", { kind: kindInSentence(kind, t), plant: plantName }),
    });
    onClose();
  }

  const title = current
    ? t("sensors.changeTitle", { kind: kindInSentence(current.kind, t) })
    : t("sensors.add");
  return (
    <Modal opened onClose={onClose} title={title}>
      <Stack gap="md">
        {confirming && current && choice ? (
          <Text size="sm">
            {t("sensors.replaceMessage", { old: current.name, new: choice.name })}
          </Text>
        ) : (
          <>
            {!current && (
              <Radio.Group
                label={t("sensors.whichKind")}
                value={kind ?? ""}
                onChange={(value) => {
                  setKind(value);
                  setChosen("");
                  setStale(false);
                }}
              >
                <Stack gap="xs" mt="xs">
                  {freeKinds.map((each) => (
                    <Radio key={each} value={each} label={kindName(each, t)} />
                  ))}
                </Stack>
              </Radio.Group>
            )}
            {stale && (
              <Alert color="yellow" role="status">
                {t("sensors.choicesChanged")}
              </Alert>
            )}
            {kind && (
              <SensorChoices
                kind={kind}
                choices={choices}
                value={chosen}
                keyOf={keyOf}
                onChange={setChosen}
              />
            )}
          </>
        )}
        <ErrorAlert error={choose.error} />
        <Group justify="flex-end">
          <Button
            variant="default"
            onClick={() => {
              if (confirming) setConfirming(false);
              else onClose();
            }}
          >
            {confirming ? t("common.back") : t("common.cancel")}
          </Button>
          <Button
            color={confirming ? "red" : undefined}
            disabled={!choice}
            loading={choose.isPending}
            onClick={() => void save()}
          >
            {confirming ? t("sensors.replace") : t("sensors.use")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
