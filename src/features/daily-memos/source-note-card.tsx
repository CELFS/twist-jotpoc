
import { ExternalLink, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { ResilientLink as Link } from "@/components/resilient-link";
import { subscribeToDataChanges } from "@/data/change-bus";
import type {
  SourceNoteRecord,
  WebResourceRecord,
} from "@/data/models";
import { createRepositories } from "@/data/repositories";
import { noteMarkStyle } from "@/features/source-notes/source-note-mark-style";
import { getText } from "@/i18n/get-text";

type SourceNoteSnapshot = {
  failed: boolean;
  loading: boolean;
  note: SourceNoteRecord | null;
  noteId: string | null;
  resource: WebResourceRecord | null;
};

const initialSnapshot: SourceNoteSnapshot = {
  failed: false,
  loading: true,
  note: null,
  noteId: null,
  resource: null,
};

function useSourceNote(noteId: string): SourceNoteSnapshot {
  const [snapshot, setSnapshot] = useState(initialSnapshot);

  useEffect(() => {
    let active = true;
    let scheduled = false;
    const repositories = createRepositories();

    const load = async () => {
      try {
        const note = await repositories.sourceNotes.get(noteId);
        const resource = note
          ? await repositories.webResources.get(note.webResourceId)
          : undefined;

        if (active) {
          setSnapshot({
            failed: false,
            loading: false,
            note: note ?? null,
            noteId,
            resource: resource ?? null,
          });
        }
      } catch {
        if (active) {
          setSnapshot({
            failed: true,
            loading: false,
            note: null,
            noteId,
            resource: null,
          });
        }
      }
    };
    const scheduleLoad = () => {
      if (scheduled) {
        return;
      }

      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        void load();
      });
    };

    void load();
    const unsubscribe = subscribeToDataChanges((change) => {
      if (
        (change.entity === "sourceNotes" &&
          (change.id === noteId || change.id === "*")) ||
        change.entity === "webResources"
      ) {
        scheduleLoad();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [noteId]);

  return snapshot.noteId === noteId
    ? snapshot
    : { ...initialSnapshot, noteId };
}

export function SourceNoteCard({
  compact = false,
  noteId,
  timelineNotes,
}: {
  compact?: boolean;
  noteId: string;
  timelineNotes?: SourceNoteRecord[];
}) {
  const snapshot = useSourceNote(noteId);

  if (snapshot.loading) {
    return (
      <div className="daily-memo-source-note-card" data-loading="true">
        {getText("dailyMemo.sourceNote.loading")}
      </div>
    );
  }

  if (snapshot.failed || !snapshot.note || !snapshot.resource) {
    return (
      <div className="daily-memo-source-note-card" data-failed="true">
        {getText("dailyMemo.sourceNote.loadFailed")}
      </div>
    );
  }

  const { note, resource } = snapshot;
  const title = resource.customTitle || resource.pageTitle || getText("dailyMemo.sourceNote.untitledPage");

  if (timelineNotes) {
    return (
      <Link
        className="timeline-source-note-item"
        data-compact={compact || undefined}
        href={`/source-notes/?note=${encodeURIComponent(note.id)}&returnDate=${encodeURIComponent(note.dateKey)}`}
      >
        <span className="timeline-source-note-item-title">
          <strong>{title}</strong>
          <ExternalLink aria-hidden="true" size={18} />
        </span>
        <span className="timeline-source-note-item-meta">
          <span>{resource.url}</span>
          <time dateTime={note.dateKey}>{note.dateKey}</time>
        </span>
        {!compact && timelineNotes.map((fragment) => (
          <span className="timeline-source-note-item-content" key={fragment.id}>
            <span style={noteMarkStyle(fragment)}>
              {fragment.content || getText("dailyMemo.sourceNote.empty")}
            </span>
          </span>
        ))}
      </Link>
    );
  }

  return (
    <section
      className="daily-memo-source-note-card"
      contentEditable={false}
      data-source-note-id={note.id}
    >
      <header className="daily-memo-source-note-card-header">
        <div className="daily-memo-source-note-card-heading">
          <span>{note.sourceNameSnapshot || getText("dailyMemo.sourceNote.webNote")}</span>
          <time dateTime={note.dateKey}>{note.dateKey}</time>
        </div>
        <div className="daily-memo-source-note-card-actions">
          <a
            aria-label={getText("dailyMemo.sourceNote.openSource")}
            href={resource.url}
            rel="noreferrer noopener"
            target="_blank"
            title={getText("dailyMemo.sourceNote.openSource")}
          >
            <ExternalLink aria-hidden="true" size={16} />
          </a>
          <Link
            aria-label={getText("dailyMemo.sourceNote.edit")}
            href={`/source-notes/?note=${encodeURIComponent(note.id)}&returnDate=${encodeURIComponent(note.dateKey)}`}
            title={getText("dailyMemo.sourceNote.edit")}
          >
            <Pencil aria-hidden="true" size={16} />
          </Link>
        </div>
      </header>
      <a
        className="daily-memo-source-note-card-title"
        href={resource.url}
        rel="noreferrer noopener"
        target="_blank"
      >
        {title}
      </a>
      <p className="daily-memo-source-note-card-url">{resource.url}</p>
      <p className="daily-memo-source-note-card-content" style={noteMarkStyle(note)}>
        {note.content || getText("dailyMemo.sourceNote.empty")}
      </p>
    </section>
  );
}
