import { useTranslation } from "react-i18next";

import { ApiError } from "./errors";

/** Turn an error from the API into a translated message for the person using the app. */
export function useErrorMessage() {
  const { t, i18n } = useTranslation();
  return (error: unknown): string => {
    if (error instanceof ApiError) {
      const key = `errors.${error.code}`;
      if (i18n.exists(key)) {
        return t(key as "errors.unexpected");
      }
      return error.message || t("errors.unexpected");
    }
    return t("errors.unexpected");
  };
}
