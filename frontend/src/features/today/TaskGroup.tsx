import { Group, Paper, Stack, Title } from "@mantine/core";

import type { Task } from "../../api/today";
import { DoAllButton } from "./DoAllButton";
import { groupBy } from "./grouping";
import { TaskRow } from "./TaskRow";

export interface TaskGroupProps {
  title: string;
  tasks: Task[];
  canEdit: boolean;
  /** Offer doing the same care for every plant in the group at once. */
  bulk: boolean;
  /** The room or spot the group is in, named on its "all at once" button. */
  place?: string;
}

/** Care due in one room (or on one day), with doing the same for all of them at once. */
export function TaskGroup({ title, tasks, canEdit, bulk, place }: TaskGroupProps) {
  const byCare = groupBy(tasks, (task) => String(task.care_type.id));
  const shared = bulk ? [...byCare.values()].filter((group) => group.length > 1) : [];
  return (
    <Paper withBorder radius="lg" p="md">
      <Stack gap="sm">
        <Group justify="space-between" gap="xs">
          <Title order={3} className="sunfleck-card-label">
            {title}
          </Title>
          {shared.map((group) => (
            <DoAllButton key={group[0]?.care_type.id} tasks={group} place={place} />
          ))}
        </Group>
        {tasks.map((task) => (
          <TaskRow key={task.schedule_id} task={task} canEdit={canEdit} />
        ))}
      </Stack>
    </Paper>
  );
}
