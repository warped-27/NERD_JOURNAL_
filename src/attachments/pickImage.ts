import * as ImagePicker from 'expo-image-picker';
import type { Attachment } from '../notes/Note';
import { newId } from '../lib/id';
import { isTauri } from '../platform/detect';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'tiff', 'avif'];

export async function pickImage(): Promise<Attachment | null> {
  if (isTauri()) return pickImageTauri();

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    base64:     true,
    quality:    0.7,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  if (!asset.base64) return null;

  const sizeBytes = Math.round(asset.base64.length * 0.75);
  if (sizeBytes > MAX_SIZE_BYTES) {
    throw new Error(`Image too large (max 5 MB). This image is ~${Math.round(sizeBytes / 1024 / 1024)} MB.`);
  }

  const mimeType = asset.mimeType ?? 'image/jpeg';

  return {
    id:        newId(),
    type:      'image',
    createdAt: Date.now(),
    data:      asset.base64,
    mimeType,
    name:      asset.fileName ?? `photo_${Date.now()}.jpg`,
    size:      sizeBytes,
  };
}

export async function takePhoto(): Promise<Attachment | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;

  const result = await ImagePicker.launchCameraAsync({
    base64:  true,
    quality: 0.7,
  });

  if (result.canceled || !result.assets[0]) return null;

  const asset = result.assets[0];
  if (!asset.base64) return null;

  const sizeBytes = Math.round(asset.base64.length * 0.75);
  if (sizeBytes > MAX_SIZE_BYTES) {
    throw new Error(`Image too large (max 5 MB).`);
  }

  return {
    id:        newId(),
    type:      'image',
    createdAt: Date.now(),
    data:      asset.base64,
    mimeType:  asset.mimeType ?? 'image/jpeg',
    name:      `photo_${Date.now()}.jpg`,
    size:      sizeBytes,
  };
}

async function pickImageTauri(): Promise<Attachment | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readFile } = await import('@tauri-apps/plugin-fs');

  const selected = await open({
    multiple: false,
    filters:  [{ name: 'Images', extensions: IMAGE_EXTENSIONS }],
  });
  if (!selected) return null;
  const path = Array.isArray(selected) ? selected[0] : selected;
  if (!path) return null;

  const bytes = await readFile(path);
  if (bytes.length > MAX_SIZE_BYTES) {
    throw new Error(`Image too large (max 5 MB). This image is ~${Math.round(bytes.length / 1024 / 1024)} MB.`);
  }

  const base64   = bytesToBase64(bytes);
  const fileName = path.split(/[/\\]/).pop() ?? 'image.jpg';
  const ext      = fileName.split('.').pop()?.toLowerCase() ?? 'jpeg';
  const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

  return {
    id:        newId(),
    type:      'image',
    createdAt: Date.now(),
    data:      base64,
    mimeType,
    name:      fileName,
    size:      bytes.length,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len  = bytes.length;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}
