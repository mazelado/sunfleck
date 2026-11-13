import { Container, Paper, Skeleton, Stack } from "@mantine/core";

import { SkeletonPage } from "../../components/SkeletonPage";

/** Today while it loads: a weather card and two groups of care rows. */
export function TodaySkeleton() {
  return (
    <Container size="reading" px={0}>
      <SkeletonPage>
        <Stack gap="lg">
          <Skeleton h={120} radius="lg" />
          {[3, 2].map((rows, group) => (
            <Paper key={group} withBorder radius="lg" p="md">
              <Stack gap="sm">
                <Skeleton h={12} w={120} />
                {Array.from({ length: rows }, (_, row) => (
                  <Skeleton key={row} h={44} radius="md" />
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </SkeletonPage>
    </Container>
  );
}
