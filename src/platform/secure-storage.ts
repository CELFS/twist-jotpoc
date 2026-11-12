import { invoke } from "@tauri-apps/api/core";

const credentialKey = "jotpoc.account.credential";
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = queue.catch(() => undefined).then(operation);
  queue = result;
  return result;
}

async function readValue(): Promise<unknown> {
  const result = await invoke<{ value: string | null }>("plugin:secure-keystore|get_item", { key: credentialKey });
  return result.value === null ? null : JSON.parse(result.value);
}

export function readStoredCredential(): Promise<unknown> {
  return serialize(readValue);
}

export function storeCredential(value: unknown): Promise<void> {
  return serialize(() => invoke("plugin:secure-keystore|set_item", {
    key: credentialKey, value: JSON.stringify(value),
  }));
}

export function removeStoredCredential(): Promise<void> {
  return serialize(() => invoke("plugin:secure-keystore|delete_item", { key: credentialKey }));
}

export function removeMatchingCredential(accessToken: string): Promise<void> {
  return serialize(async () => {
    const value = await readValue();
    if (value && typeof value === "object" && "accessToken" in value && value.accessToken === accessToken) {
      await invoke("plugin:secure-keystore|delete_item", { key: credentialKey });
    }
  });
}
