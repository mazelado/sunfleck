import "i18next";

import type { resources } from "./index";

// Makes translation keys type-checked: t("app.nmae") is a compile error.
declare module "i18next" {
  interface CustomTypeOptions {
    resources: (typeof resources)["en"];
  }
}
