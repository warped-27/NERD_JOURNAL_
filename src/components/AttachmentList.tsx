import React from 'react';
import { View, Pressable, Image, StyleSheet, Linking } from 'react-native';
import type { Attachment } from '../notes/Note';
import { T } from '../design/components/T';
import { Colors, Spacing, Typography } from '../design/tokens';
import { assertSafeUrl } from '../lib/urlValidation';

interface Props {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

function fileIcon(type: Attachment['type']): string {
  switch (type) {
    case 'file':  return '📄';
    case 'link':  return '🔗';
    case 'voice': return '🎙';
    default:      return '📎';
  }
}

function label(a: Attachment): string {
  if (a.type === 'link')  return a.title ?? a.url ?? 'Link';
  if (a.type === 'voice') return a.transcription
    ? a.transcription.slice(0, 60) + (a.transcription.length > 60 ? '…' : '')
    : `Voice (${a.duration != null ? Math.round(a.duration) + 's' : '?'})`;
  return a.name ?? a.mimeType ?? a.type;
}

function ImageAttachment({ a }: { a: Attachment }) {
  const uri = a.data ? `data:${a.mimeType ?? 'image/jpeg'};base64,${a.data}` : undefined;
  return (
    <View style={styles.imageWrap} testID={`attachment-image-${a.id}`}>
      {uri ? (
        <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <T variant="mono" style={styles.thumbnailIcon}>🖼</T>
        </View>
      )}
      <T variant="caption" style={styles.imageName} numberOfLines={1}>
        {a.name ?? 'image'}
      </T>
    </View>
  );
}

export function AttachmentList({ attachments, onRemove }: Props) {
  if (!attachments.length) return null;

  // Images rendered as a horizontal thumbnail strip
  const images = attachments.filter((a) => a.type === 'image');
  const others = attachments.filter((a) => a.type !== 'image');

  return (
    <View style={styles.root} testID="attachment-list">
      {images.length > 0 && (
        <View style={styles.imageStrip} testID="attachment-images">
          {images.map((a) => (
            <View key={a.id} style={styles.imageItem}>
              <ImageAttachment a={a} />
              <Pressable
                onPress={() => onRemove(a.id)}
                style={styles.imageRemove}
                testID={`attachment-remove-${a.id}`}
                accessibilityLabel="Remove attachment"
              >
                <T variant="label" style={styles.removeIcon}>✕</T>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {others.map((a) => (
        <View key={a.id} style={styles.row} testID={`attachment-${a.id}`}>
          <T variant="mono" style={styles.icon}>{fileIcon(a.type)}</T>

          <Pressable
            style={styles.labelWrap}
            onPress={() => {
              if (a.type === 'link' && a.url) {
                try {
                  assertSafeUrl(a.url);
                  void Linking.openURL(a.url);
                } catch {
                  // URL failed safety check — silently ignore to avoid opening dangerous schemes
                }
              }
            }}
            testID={`attachment-label-${a.id}`}
          >
            <T
              variant={a.type === 'link' ? 'label' : 'body'}
              style={[styles.label, a.type === 'link' && styles.linkLabel]}
              numberOfLines={2}
            >
              {label(a)}
            </T>
            {a.type === 'link' && a.url && (
              <T variant="caption" style={styles.url} numberOfLines={1}>{a.url}</T>
            )}
          </Pressable>

          <Pressable
            onPress={() => onRemove(a.id)}
            style={styles.removeBtn}
            testID={`attachment-remove-${a.id}`}
            accessibilityLabel="Remove attachment"
          >
            <T variant="label" style={styles.removeIcon}>✕</T>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const THUMB = 80;

const styles = StyleSheet.create({
  root: { marginTop: Spacing.sm },

  imageStrip: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.xs,
    marginBottom:  Spacing.xs,
  },
  imageItem:    { position: 'relative' },
  imageWrap:    { alignItems: 'center', gap: 2 },
  thumbnail: {
    width:        THUMB,
    height:       THUMB,
    borderWidth:  1,
    borderColor:  Colors.border,
  },
  thumbnailPlaceholder: {
    backgroundColor: Colors.bgPanel,
    alignItems:      'center',
    justifyContent:  'center',
  },
  thumbnailIcon: { fontSize: 24 },
  imageName: {
    width:    THUMB,
    fontSize: 9,
    color:    Colors.textMuted,
  },
  imageRemove: {
    position:        'absolute',
    top:             2,
    right:           2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius:    8,
    width:           16,
    height:          16,
    alignItems:      'center',
    justifyContent:  'center',
  },

  row: {
    flexDirection:     'row',
    alignItems:        'flex-start',
    borderWidth:       1,
    borderColor:       Colors.border,
    paddingVertical:   Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom:      Spacing.xs,
    gap:               Spacing.sm,
  },
  icon:      { fontSize: 16, lineHeight: 22 },
  labelWrap: { flex: 1 },
  label:     { fontSize: Typography.sizeSm, lineHeight: 20 },
  linkLabel: { color: Colors.green, textDecorationLine: 'underline' },
  url:       { color: Colors.textMuted, fontSize: Typography.sizeXs, marginTop: 2 },
  removeBtn: { paddingLeft: Spacing.xs },
  removeIcon:{ color: Colors.error, fontSize: 14 },
});
