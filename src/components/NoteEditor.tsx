import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { T }               from '../design/components/T';
import { Box }             from '../design/components/Box';
import { Input }           from '../design/components/Input';
import { Btn }             from '../design/components/Btn';
import { AiAssistant }     from './AiAssistant';
import { RelatedNotes }    from './RelatedNotes';
import { AttachmentList }  from './AttachmentList';
import { AttachmentPicker } from './AttachmentPicker';
import { useAi }           from '../ai/AiContext';
import { Colors, Spacing } from '../design/tokens';
import type { Note, Attachment } from '../notes/Note';

const MAX_ATTACHMENTS  = 10;
const MAX_TOTAL_BYTES  = 20 * 1024 * 1024; // 20 MB

function estimateBytes(a: Attachment): number {
  if (a.data) return Math.ceil(a.data.length * 0.75);
  return a.size ?? 0;
}

interface Props {
  initialTitle:        string;
  initialContent:      string;
  initialAttachments?: Attachment[];
  initialTags?:        string[];
  initialSummary?:     string;
  initialPalette?:     string[];
  onSave:       (patch: Pick<Note, 'title' | 'content'> & { attachments?: Attachment[] }) => Promise<void>;
  onDelete?:    () => Promise<void>;
  currentNote?: Note;
  allNotes?:    Note[];
  onOpenNote?:  (note: Note) => void;
}

const AUTO_TITLE_PROMPT =
  'Generate a concise title (max 60 characters) for this journal note. ' +
  'Return ONLY the title text, no quotes, no punctuation at the end.';

export function NoteEditor({
  initialTitle,
  initialContent,
  initialAttachments,
  initialTags,
  initialSummary,
  initialPalette,
  onSave,
  onDelete,
  currentNote,
  allNotes,
  onOpenNote,
}: Props) {
  const [title,           setTitle]           = useState(initialTitle);
  const [content,         setContent]         = useState(initialContent);
  const [attachments,     setAttachments]     = useState<Attachment[]>(initialAttachments ?? []);
  const [saving,          setSaving]          = useState(false);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [showPicker,      setShowPicker]      = useState(false);
  const [error,           setError]           = useState('');
  const accentColor = initialPalette?.[0] ?? Colors.greenMute;
  const ai = useAi();

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      await onSave({ title: title.trim(), content, attachments });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setSaving(true);
    setError('');
    try {
      await onDelete();
    } catch {
      setError('Delete failed.');
      setSaving(false);
    }
  }

  async function handleAutoTitle() {
    if (!content.trim()) return;
    setGeneratingTitle(true);
    setError('');
    try {
      const result = await ai.ask(content, AUTO_TITLE_PROMPT);
      if (result.ok) setTitle(result.value.slice(0, 80));
      else setError(result.error.message);
    } finally {
      setGeneratingTitle(false);
    }
  }

  function addAttachment(a: Attachment) {
    if (attachments.length >= MAX_ATTACHMENTS) {
      setError(`Maximum ${MAX_ATTACHMENTS} attachments per note.`);
      return;
    }
    const totalBytes = attachments.reduce((sum, x) => sum + estimateBytes(x), 0);
    if (totalBytes + estimateBytes(a) > MAX_TOTAL_BYTES) {
      setError('Total attachment size would exceed the 20 MB limit.');
      return;
    }
    setAttachments((prev) => [...prev, a]);
  }

  function removeAttachment(id: string) {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <Box style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Title row */}
        <View style={styles.titleRow}>
          <Input
            value={title}
            onChangeText={setTitle}
            placeholder="title"
            style={[styles.titleInput, styles.titleFlex]}
            testID="editor-title"
          />
          <Btn
            label={generatingTitle ? '…' : 'AI'}
            variant="ghost"
            onPress={handleAutoTitle}
            loading={generatingTitle}
            style={styles.autoTitleBtn}
            testID="auto-title-btn"
          />
        </View>

        <Input
          value={content}
          onChangeText={setContent}
          placeholder="start writing…"
          multiline
          style={styles.contentInput}
          textAlignVertical="top"
          testID="editor-content"
        />

        {/* Attachments */}
        <AttachmentList
          attachments={attachments}
          onRemove={removeAttachment}
        />

        {showPicker && (
          <AttachmentPicker
            onAdd={addAttachment}
            onClose={() => setShowPicker(false)}
          />
        )}

        {/* AI Enrichment panel — shown after first save when AI is configured */}
        {(initialSummary || (initialTags && initialTags.length > 0)) && (
          <View style={[styles.enrichPanel, { borderColor: accentColor }]}>
            <T variant="label" style={[styles.enrichTitle, { color: accentColor }]}>
              AI ANALYSIS
            </T>
            {initialSummary && (
              <T variant="muted" style={styles.enrichSummary}>{initialSummary}</T>
            )}
            {initialTags && initialTags.length > 0 && (
              <View style={styles.enrichTags}>
                {initialTags.map((tag) => (
                  <T
                    key={tag}
                    variant="caption"
                    style={[styles.enrichTag, { borderColor: accentColor, color: accentColor }]}
                  >
                    #{tag}
                  </T>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Related notes — offline TF-IDF, only when note has content */}
        {currentNote && allNotes && onOpenNote && (title || content) && (
          <RelatedNotes
            currentNote={{ ...currentNote, title, content }}
            allNotes={allNotes}
            onOpen={onOpenNote}
          />
        )}

        {error ? <T variant="error" style={styles.error}>{error}</T> : null}

        <View style={styles.actions}>
          <Btn
            label="+ ATTACH"
            variant="ghost"
            onPress={() => setShowPicker((v) => !v)}
            style={styles.attachBtn}
            testID="attach-btn"
          />
          <Btn
            label="SAVE"
            onPress={handleSave}
            loading={saving}
            style={styles.saveBtn}
            testID="save-btn"
          />
          {onDelete && (
            <Btn
              label="DELETE"
              variant="danger"
              onPress={handleDelete}
              style={styles.deleteBtn}
              testID="delete-btn"
            />
          )}
        </View>
      </ScrollView>

      <AiAssistant noteContent={content} />
    </Box>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  scroll: { flexGrow: 1, padding: Spacing.md },

  titleRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.xs,
    marginBottom:  Spacing.md,
  },
  titleFlex:    { flex: 1, marginBottom: 0 },
  titleInput:   { fontSize: 20, borderColor: Colors.border, color: Colors.textBright },
  autoTitleBtn: { width: 44, paddingHorizontal: 0 },

  contentInput: {
    flex:         1,
    minHeight:    240,
    marginBottom: Spacing.sm,
    borderColor:  Colors.border,
    color:        Colors.textPrimary,
  },
  enrichPanel: {
    borderWidth:    1,
    borderColor:    Colors.greenMute,
    padding:        Spacing.sm,
    marginBottom:   Spacing.sm,
    gap:            Spacing.xs,
  } as ViewStyle,
  enrichTitle:   { fontSize: 11, marginBottom: Spacing.xs },
  enrichSummary: { lineHeight: 18 },
  enrichTags: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.xs,
    marginTop:     Spacing.xs,
  },
  enrichTag: {
    borderWidth:      1,
    paddingHorizontal: Spacing.xs,
    paddingVertical:  2,
    fontSize:         10,
  },

  error:     { marginBottom: Spacing.sm },
  actions:   { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
  attachBtn: { flex: 0, paddingHorizontal: Spacing.sm },
  saveBtn:   { flex: 1 },
  deleteBtn: { flex: 1 },
});
