/**
 * Documents vault file operations. Bytes live in the app sandbox under
 * documents/vault/ (covered by iOS Data Protection from P1); rows in the
 * documents table carry only names and categories. Every share is a
 * sensitive read and goes through the access log.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import type { DocumentRow } from '@hearth/schema';
import { addDocument, archiveDocument, logAccess } from '../db/repo';

const VAULT_DIR = `${FileSystem.documentDirectory}vault/`;

async function ensureVaultDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(VAULT_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(VAULT_DIR, { intermediates: true });
}

export function vaultPath(doc: DocumentRow): string {
  return `${VAULT_DIR}${doc.fileName}`;
}

function extFrom(uri: string, fallback: string): string {
  const m = /\.([A-Za-z0-9]{1,5})(?:\?|$)/.exec(uri);
  return (m?.[1] ?? fallback).toLowerCase();
}

async function intake(
  patientId: string,
  srcUri: string,
  opts: { title: string; category: DocumentRow['category']; mimeType: string; ext: string },
): Promise<DocumentRow> {
  await ensureVaultDir();
  const fileName = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${opts.ext}`;
  await FileSystem.copyAsync({ from: srcUri, to: `${VAULT_DIR}${fileName}` });
  return addDocument({
    patientId,
    title: opts.title,
    category: opts.category,
    fileName,
    mimeType: opts.mimeType,
  });
}

/** Take a photo of a document with the camera. Returns null if canceled. */
export async function captureDocumentPhoto(
  patientId: string,
  title: string,
  category: DocumentRow['category'],
): Promise<DocumentRow | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) return null;
  const res = await ImagePicker.launchCameraAsync({ quality: 0.85 });
  const asset = res.assets?.[0];
  if (res.canceled || !asset) return null;
  return intake(patientId, asset.uri, {
    title,
    category,
    mimeType: asset.mimeType ?? 'image/jpeg',
    ext: extFrom(asset.uri, 'jpg'),
  });
}

/** Import an existing photo from the library. Returns null if canceled. */
export async function importDocumentPhoto(
  patientId: string,
  title: string,
  category: DocumentRow['category'],
): Promise<DocumentRow | null> {
  const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.85 });
  const asset = res.assets?.[0];
  if (res.canceled || !asset) return null;
  return intake(patientId, asset.uri, {
    title,
    category,
    mimeType: asset.mimeType ?? 'image/jpeg',
    ext: extFrom(asset.uri, 'jpg'),
  });
}

/** Import a file (PDF etc.) from the Files app. Returns null if canceled. */
export async function importDocumentFile(
  patientId: string,
  title: string,
  category: DocumentRow['category'],
): Promise<DocumentRow | null> {
  const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  const asset = res.assets?.[0];
  if (res.canceled || !asset) return null;
  return intake(patientId, asset.uri, {
    title: title || asset.name,
    category,
    mimeType: asset.mimeType ?? 'application/pdf',
    ext: extFrom(asset.name ?? asset.uri, 'pdf'),
  });
}

/** Share a vault document through the system sheet; logged as a read. */
export async function shareDocument(doc: DocumentRow): Promise<void> {
  logAccess(`document.share:${doc.title}`, doc.patientId);
  await Sharing.shareAsync(vaultPath(doc), { mimeType: doc.mimeType });
}

/** Archive the row and remove the bytes. */
export async function removeDocument(doc: DocumentRow): Promise<void> {
  archiveDocument(doc.id);
  await FileSystem.deleteAsync(vaultPath(doc), { idempotent: true });
}
