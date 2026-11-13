import { Button, Group, Menu } from "@mantine/core";
import { IconChevronDown, IconHistory, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useCareTypes } from "../../api/care";
import type { Schedule } from "../../api/schedules";
import { CareEventDialog } from "./CareEventDialog";
import { CareIcon } from "./icons";
import { useCareTypeName } from "./useCareTypeName";
import { useQuickLog } from "./useQuickLog";

const MAIN_KEYS = ["water", "fertilize"];

interface CareFooterProps {
  plantId: number;
  plantName: string;
  /** Care with a row of its own above, so not offered again here. */
  scheduled: Schedule[];
  onAddSchedule: () => void;
}

/** Under a plant's care: other care in one tap, care done earlier, and a new schedule. */
export function CareFooter({ plantId, plantName, scheduled, onAddSchedule }: CareFooterProps) {
  const { t } = useTranslation();
  const { name } = useCareTypeName();
  const careTypes = useCareTypes().data ?? [];
  const quick = useQuickLog(plantId, plantName);
  const [logging, setLogging] = useState(false);
  const unscheduled = careTypes.filter(
    (type) => !scheduled.some((schedule) => schedule.care_type.id === type.id),
  );
  // Watering and fertilizing keep a button of their own when they have no row above.
  const main = unscheduled.filter((type) => MAIN_KEYS.includes(type.key ?? ""));
  const others = unscheduled.filter((type) => !main.includes(type));

  return (
    <Group gap="xs">
      {main.map((type) => (
        <Button
          key={type.id}
          variant="light"
          leftSection={<CareIcon icon={type.icon} size={16} />}
          loading={quick.logging(type)}
          onClick={() => {
            quick.log(type);
          }}
        >
          {name(type)}
        </Button>
      ))}
      {others.length > 0 && (
        <Menu position="bottom-start" width={220}>
          <Menu.Target>
            <Button variant="default" rightSection={<IconChevronDown size={14} />}>
              {t("care.more")}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {others.map((type) => (
              <Menu.Item
                key={type.id}
                leftSection={<CareIcon icon={type.icon} size={16} />}
                onClick={() => {
                  quick.log(type);
                }}
              >
                {name(type)}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      )}
      <Button
        variant="subtle"
        leftSection={<IconHistory size={16} />}
        onClick={() => {
          setLogging(true);
        }}
      >
        {t("care.addEarlier")}
      </Button>
      <Button variant="subtle" leftSection={<IconPlus size={16} />} onClick={onAddSchedule}>
        {t("schedules.add")}
      </Button>
      {logging && (
        <CareEventDialog
          plantId={plantId}
          onClose={() => {
            setLogging(false);
          }}
        />
      )}
    </Group>
  );
}
