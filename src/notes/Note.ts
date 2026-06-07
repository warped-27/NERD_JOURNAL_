export type AttachmentType = 'image' | 'file' | 'link' | 'voice';

export interface Attachment {
  id:        string;
  type:      AttachmentType;
  createdAt: number;

  // image | file | voice — base64-encoded binary
  data?:       string;
  mimeType?:   string;
  name?:       string;
  size?:       number; // bytes

  // link
  url?:        string;
  title?:      string;

  // voice only
  duration?:       number; // seconds
  transcription?:  string;
}

export interface Note {
  id:          string;
  title:       string;
  content:     string;
  attachments: Attachment[]; // always present; [] for old notes
  createdAt:   number; // unix ms
  updatedAt:   number; // unix ms
  // AI-generated enrichment — optional for backward compat with old encrypted notes
  tags?:    string[];
  summary?: string;
  palette?: string[]; // 2-3 accent hex colors representing note mood
}

/** Shape of a row as stored in SQLite (id + encrypted JSON + timestamps). */
export interface NoteRow {
  id:         string;
  envelope:   string; // base64url-encoded AES-GCM envelope of JSON-stringified Note
  updated_at: number;
  created_at: number;
}

export const NOTES_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS notes (
    id         TEXT    PRIMARY KEY,
    envelope   TEXT    NOT NULL,
    updated_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
`;
