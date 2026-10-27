import type { UseFormReturnType } from "@mantine/form";

import { ApiError } from "../../api/errors";

/** Show the server's messages for individual fields (e.g. why a password is too weak). */
export function applyFieldErrors<T>(form: UseFormReturnType<T>, error: unknown): void {
  if (error instanceof ApiError) {
    for (const [field, messages] of Object.entries(error.fieldErrors)) {
      form.setFieldError(field, messages.join(" "));
    }
  }
}
