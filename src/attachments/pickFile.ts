import * as DocumentPicker from 'expo-document-picker';
import type { Attachment } from '../notes/Note';
import { newId } from '../lib/id';
import { isTauri } from '../platform/detect';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function pickFile(): Promise<Attachment | null> {
  if (isTauri()) return pickFileTauri();

  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];

  if (asset.size && asset.size > MAX_SIZE_BYTES) {
    throw new Error(`File too large (max 5 MB). This file is ~${Math.round(asset.size / 1024 / 1024)} MB.`);
  }

  let base64: string;
  try {
    const response = await fetch(asset.uri);
    const blob     = await response.blob();
    base64 = await blobToBase64(blob);
  } catch {
    throw new Error('Could not read file. Please try again.');
  }

  const sizeBytes = asset.size ?? Math.round(base64.length * 0.75);

  return {
    id:        newId(),
    type:      'file',
    createdAt: Date.now(),
    data:      base64,
    mimeType:  asset.mimeType ?? 'application/octet-stream',
    name:      asset.name,
    size:      sizeBytes,
  };
}

async function pickFileTauri(): Promise<Attachment | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readFile } = await import('@tauri-apps/plugin-fs');

  const selected = await open({ multiple: false, directory: false });
  if (!selected) return null;
  const path = Array.isArray(selected) ? selected[0] : selected;
  if (!path) return null;

  const bytes = await readFile(path);
  if (bytes.length > MAX_SIZE_BYTES) {
    throw new Error(`File too large (max 5 MB). This file is ~${Math.round(bytes.length / 1024 / 1024)} MB.`);
  }

  const base64   = bytesToBase64(bytes);
  const fileName = path.split(/[/\\]/).pop() ?? 'file';
  const mimeType = inferMimeType(fileName);

  return {
    id:        newId(),
    type:      'file',
    createdAt: Date.now(),
    data:      base64,
    mimeType,
    name:      fileName,
    size:      bytes.length,
  };
}

function inferMimeType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    pdf:  'application/pdf',
    txt:  'text/plain',
    md:   'text/markdown',
    csv:  'text/csv',
    json: 'application/json',
    zip:  'application/zip',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return map[ext] ?? 'application/octet-stream';
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len  = bytes.length;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
