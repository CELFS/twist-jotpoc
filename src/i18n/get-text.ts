import { getResolvedAppLanguage, type ResolvedAppLanguage } from "./app-language";
import enMessages from "./messages/en.json";
import zhMessages from "./messages/zh-CN.json";

type MessagePath<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : T[Key] extends Record<string, unknown>
      ? `${Key}.${MessagePath<T[Key]>}`
      : never;
}[keyof T & string];

export type MessageKey = MessagePath<typeof zhMessages> | MessagePath<typeof enMessages>;

const messages: Record<ResolvedAppLanguage, unknown> = {
  en: enMessages,
  zh: zhMessages,
};

export function getText(key: MessageKey): string {
  let value: unknown = messages[getResolvedAppLanguage()];

  for (const segment of key.split(".")) {
    if (
      typeof value !== "object" ||
      value === null ||
      !(segment in value)
    ) {
      return key;
    }

    value = (value as Record<string, unknown>)[segment];
  }

  return typeof value === "string" ? value : key;
}
