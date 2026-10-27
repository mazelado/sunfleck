import { Alert } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";

import { useErrorMessage } from "../api/useErrorMessage";

interface ErrorAlertProps {
  error: unknown;
}

/** Shows an API error as a translated message, or nothing when there's no error. */
export function ErrorAlert({ error }: ErrorAlertProps) {
  const errorMessage = useErrorMessage();
  if (!error) {
    return null;
  }
  return (
    <Alert color="red" icon={<IconAlertCircle aria-hidden />} role="alert">
      {errorMessage(error)}
    </Alert>
  );
}
