import { getDatabase } from "./database";
import { cloudApi, readCachedResource } from "./cloud-api";
import { publishDataChange } from "./change-bus";
import type { JsonValue } from "./models";

export function createRepositories() {
  return {
    sourceNotes: { get: async (id: string) => (await cloudApi.note.detail(id))?.record },
    webResources: { get: async (id: string) => readCachedResource(id) },
    settings: {
      get: (key: string) => getDatabase().settings.get(key),
      async set(key: string, value: JsonValue) {
        await getDatabase().settings.put({ key, value, updatedAt: Date.now() });
        publishDataChange({ entity: "settings", id: key });
      },
    },
  };
}
