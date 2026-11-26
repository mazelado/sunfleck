import { Checkbox, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useTranslation } from "react-i18next";

import { type Me, useUpdateHousehold } from "../../api/accounts";
import { ErrorAlert } from "../../components/ErrorAlert";
import { WelcomeStep } from "./WelcomeStep";

type Household = NonNullable<Me["household"]>;

interface GrowStepProps {
  household: Household;
  step: number;
  of: number;
  onDone: () => void;
}

/**
 * "What do you grow?": turns on Garden for outdoor and edible plants, and Collection for a
 * collection, for Admins setting up a household. Houseplants need neither.
 */
export function GrowStep({ household, step, of, onDone }: GrowStepProps) {
  const { t } = useTranslation();
  const update = useUpdateHousehold();
  const form = useForm({
    initialValues: { garden: household.garden, collection: household.collection },
  });

  const handleSubmit = form.onSubmit(async (values) => {
    try {
      if (values.garden !== household.garden || values.collection !== household.collection) {
        await update.mutateAsync(values);
      }
      onDone();
    } catch {
      // The error is shown by ErrorAlert.
    }
  });

  return (
    <WelcomeStep
      step={step}
      of={of}
      question={t("welcome.grow.question")}
      why={t("welcome.grow.why")}
      next={t("welcome.grow.next")}
      saving={update.isPending}
      onSubmit={handleSubmit}
    >
      <ErrorAlert error={update.error} />
      <Stack gap="md">
        <Checkbox
          label={t("welcome.grow.garden")}
          description={t("welcome.grow.gardenHelp")}
          {...form.getInputProps("garden", { type: "checkbox" })}
        />
        <Checkbox
          label={t("welcome.grow.collection")}
          description={t("welcome.grow.collectionHelp")}
          {...form.getInputProps("collection", { type: "checkbox" })}
        />
      </Stack>
    </WelcomeStep>
  );
}
