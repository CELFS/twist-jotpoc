export type Credential = {
  accessToken: string;
  accountId: string;
  email: string;
  expiresAt: number;
  scopes: string[];
};

let credential: Credential | null = null;
let controller = new AbortController();

export function getActiveCredential() {
  return credential;
}

export function getCredentialSignal() {
  return controller.signal;
}

export function setActiveCredential(value: Credential | null) {
  if (credential !== value) {
    controller.abort(new DOMException("Account changed", "AbortError"));
    controller = new AbortController();
  }
  credential = value;
}
