export type MemoSourcePreset = { id: string; name: string; color: string };
export type DailyMemoRecord = { id: string; dateKey: string; title: string; content: string; createdAt: number; updatedAt: number };
export type WebResourceRecord = { id: string; url: string; urlKey: string; pageTitle: string; customTitle?: string; createdAt: number; updatedAt: number };
export type SourceNoteRecord = {
  id: string;
  webResourceId: string;
  dateKey: string;
  sourcePresetId: string | null;
  sourceNameSnapshot: string | null;
  content: string;
  createdAt: number;
  updatedAt: number;
  ink?: { color: "red" | "purple" | "blue" | "green" | "yellow"; lineStyle: "highlight" | "underline" | "wavy" };
};
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export type SettingRecord = { key: string; value: JsonValue; updatedAt: number };
