export function openNote(id: string) {
  window.dispatchEvent(new CustomEvent("jotpoc:open-note", { detail: id }));
}
