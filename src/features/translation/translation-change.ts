import type { LocalTranslation } from "@/translation/contracts";

export type TranslationChange = {
  kind: "create" | "update" | "collect" | "uncollect" | "remove";
  record: LocalTranslation;
};
