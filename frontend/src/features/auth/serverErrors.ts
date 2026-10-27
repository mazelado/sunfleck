import type { UseFormReturnType } from "@mantine/form";

import { ApiError } from "../../api/errors";
import { useErrorMessage } from "../../api/useErrorMessage";

/**
 * Show the server's messages for individual fields (e.g. why a password is too weak, or which
 * field a rule applies to). Messages the app has a translation for are shown translated.
 */
export function useApplyFieldErrors() {
  const errorMessage = useErrorMessage();
  /**
   * @param fieldNames - API field names that the form calls something else, e.g.
   *   `{ temperature_min_c: "temperature_min" }` when the form shows °F.
   */
  return <T>(
    form: UseFormReturnType<T>,
    error: unknown,
    fieldNames: Record<string, string> = {},
  ): void => {
    if (!(error instanceof ApiError)) {
      return;
    }
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      const isTheMainError = messages.length === 1 && messages[0] === error.message;
      form.setFieldError(
        fieldNames[field] ?? field,
        isTheMainError ? errorMessage(error) : messages.join(" "),
      );
    }
  };
}
