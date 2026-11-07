import { Button, Chip, Group, Modal, Radio, Stack, Text, TextInput } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { CareType } from "../../api/care";
import { useSnooze } from "../../api/today";
import { ErrorAlert } from "../../components/ErrorAlert";
import { formatDate } from "../plants/dates";
import { addDays } from "../today/grouping";
import { useCareTypeName } from "./useCareTypeName";

/** Care that can be put off: a schedule, from a plant's page or from Today. */
export interface PutOffCare {
  /** The schedule's id. */
  id: number;
  care_type: CareType;
  /** When it's due, after any snooze; none when it isn't due. */
  due_on: string | null;
}

// The furthest a snooze may go, as the server allows.
const MAX_DAYS = 60;

/** Today on this device, as "YYYY-MM-DD". */
function localToday(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${String(now.getFullYear())}-${month}-${day}`;
}

interface PutOffDialogProps {
  plantName: string;
  /** The plant's care that's due, or will be. */
  care: PutOffCare[];
  /** The care to start with; the first otherwise. */
  initialId?: number;
  onClose: () => void;
}

/** Put a plant's care off until a day: so it isn't due, or reminded of, before then. */
export function PutOffDialog({ plantName, care, initialId, onClose }: PutOffDialogProps) {
  const { t, i18n } = useTranslation();
  const { name } = useCareTypeName();
  const snooze = useSnooze();
  const [chosen, setChosen] = useState(String(initialId ?? care[0]?.id ?? ""));
  const today = localToday();
  const [until, setUntil] = useState(addDays(today, 1));
  const item = care.find((each) => String(each.id) === chosen);
  const quick = [
    [addDays(today, 1), t("putOff.tomorrow")],
    [addDays(today, 3), t("putOff.inDays", { count: 3 })],
    [addDays(today, 7), t("putOff.week")],
  ] as const;

  async function handleSave() {
    if (!item) return;
    try {
      await snooze.mutateAsync({ scheduleId: item.id, until });
    } catch {
      return; // shown by the ErrorAlert below
    }
    notifications.show({
      message: t("putOff.done", {
        care: name(item.care_type),
        plant: plantName,
        date: formatDate(until, i18n.language),
      }),
    });
    onClose();
  }

  return (
    <Modal opened onClose={onClose} title={t("putOff.title", { plant: plantName })}>
      <Stack gap="md">
        {care.length === 0 ? (
          <Text size="sm">{t("putOff.nothing")}</Text>
        ) : (
          <>
            {care.length > 1 && (
              <Radio.Group label={t("putOff.which")} value={chosen} onChange={setChosen}>
                <Stack gap="xs" mt="xs">
                  {care.map((each) => (
                    <Radio
                      key={each.id}
                      value={String(each.id)}
                      label={
                        each.due_on
                          ? t("putOff.careDue", {
                              care: name(each.care_type),
                              date: formatDate(each.due_on, i18n.language),
                            })
                          : name(each.care_type)
                      }
                    />
                  ))}
                </Stack>
              </Radio.Group>
            )}
            <Stack gap="xs">
              <TextInput
                type="date"
                label={t("putOff.until")}
                description={t("putOff.untilHelp")}
                value={until}
                min={addDays(today, 1)}
                max={addDays(today, MAX_DAYS)}
                onChange={(event) => {
                  setUntil(event.currentTarget.value);
                }}
              />
              <Group gap={6}>
                {quick.map(([day, label]) => (
                  <Chip
                    key={day}
                    size="xs"
                    checked={until === day}
                    onChange={() => {
                      setUntil(day);
                    }}
                  >
                    {label}
                  </Chip>
                ))}
              </Group>
            </Stack>
          </>
        )}
        <ErrorAlert error={snooze.error} />
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          {care.length > 0 && (
            <Button
              onClick={() => void handleSave()}
              loading={snooze.isPending}
              disabled={!item || !until}
            >
              {t("putOff.save")}
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}
