import React, { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Camera, FileText, Image as ImageIcon, Pencil, Plus, Share2, Trash2 } from 'lucide-react-native';
import type { DocumentRow } from '@hearth/schema';
import { Card, EmptyState, FormField, PillButton, SectionHeader, Seg, color, radius, space, type } from '../../ds';
import { enterQuiet, enterRow } from '../../ds/motion';
import {
  captureDocumentPhoto,
  importDocumentFile,
  importDocumentPhoto,
  removeDocument,
  shareDocument,
} from '../../lib/vault';
import { updateDocument } from '../../db/repo';
import { bumpDataVersion } from '../../lib/events';
import { FolderArt } from '../../components/EmptyArt';

const CATEGORY_LABEL: Record<DocumentRow['category'], string> = {
  insurance: 'Insurance',
  directive: 'Directive',
  discharge: 'Discharge',
  lab: 'Lab report',
  photo: 'Photo',
  other: 'Document',
};

/** Every category the schema enum allows, in vault display order. */
const CATEGORY_OPTIONS: { key: DocumentRow['category']; label: string }[] = [
  { key: 'insurance', label: 'Insurance' },
  { key: 'directive', label: 'Directive' },
  { key: 'discharge', label: 'Discharge' },
  { key: 'lab', label: 'Lab' },
  { key: 'photo', label: 'Photo' },
  { key: 'other', label: 'Other' },
];

function fmtAdded(at: string): string {
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function DocumentsTab({
  patientId,
  documents,
}: {
  patientId: string;
  documents: DocumentRow[];
}) {
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState<DocumentRow['category']>('other');

  function startEdit(doc: DocumentRow) {
    setEditingId(doc.id);
    setEditTitle(doc.title);
    setEditCategory(doc.category);
  }

  function saveEdit(doc: DocumentRow) {
    const title = editTitle.trim();
    if (!title) return;
    updateDocument(doc.id, { title, category: editCategory });
    setEditingId(null);
  }

  function pickSource() {
    const run = async (fn: () => Promise<DocumentRow | null>) => {
      setBusy(true);
      try {
        const doc = await fn();
        if (doc) bumpDataVersion();
      } catch (e) {
        Alert.alert('Could not add the document', String(e));
      } finally {
        setBusy(false);
      }
    };
    const title = 'Untitled document';
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take a photo', 'Choose from photos', 'Choose a file'],
          cancelButtonIndex: 0,
        },
        (i) => {
          if (i === 1) void run(() => captureDocumentPhoto(patientId, title, 'other'));
          if (i === 2) void run(() => importDocumentPhoto(patientId, title, 'other'));
          if (i === 3) void run(() => importDocumentFile(patientId, '', 'other'));
        },
      );
    } else {
      void run(() => importDocumentFile(patientId, '', 'other'));
    }
  }

  function confirmRemove(doc: DocumentRow) {
    Alert.alert('Remove document', `Remove "${doc.title}" from the vault? The file is deleted from this phone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeDocument(doc).then(bumpDataVersion);
        },
      },
    ]);
  }

  return (
    <View>
      <Animated.View entering={enterRow(0)}>
        <SectionHeader label="Vault" meta="stored only on this phone" />
      </Animated.View>
      {documents.length === 0 ? (
        <Animated.View entering={enterRow(1)}>
          <EmptyState
            art={<FolderArt size={72} />}
            title="Nothing in the vault yet"
            detail="Insurance cards, the POLST or advance directive, discharge papers. Photograph them once; have them at every visit."
            action={<PillButton label="Add a document" onPress={pickSource} disabled={busy} />}
          />
        </Animated.View>
      ) : (
        <>
          {documents.map((doc, i) => (
            <Animated.View key={doc.id} entering={enterRow(1 + i)}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 12,
                  borderBottomWidth: i === documents.length - 1 ? 0 : 1,
                  borderBottomColor: color.line,
                }}
              >
                <View
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: radius.sm,
                    borderWidth: 1,
                    borderColor: color.line,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {doc.mimeType.startsWith('image/') ? (
                    <ImageIcon size={17} color={color.ink2} strokeWidth={1.8} />
                  ) : (
                    <FileText size={17} color={color.ink2} strokeWidth={1.8} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  <Text style={[type.mini, { marginTop: 2 }]}>
                    {CATEGORY_LABEL[doc.category]} · added {fmtAdded(doc.addedAt)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => (editingId === doc.id ? setEditingId(null) : startEdit(doc))}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Edit document"
                  style={{ padding: 8 }}
                >
                  <Pencil size={17} color={color.ink2} strokeWidth={1.8} />
                </Pressable>
                <Pressable
                  onPress={() => void shareDocument(doc)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Share ${doc.title}`}
                  style={{ padding: 8 }}
                >
                  <Share2 size={17} color={color.ink2} strokeWidth={1.8} />
                </Pressable>
                <Pressable
                  onPress={() => confirmRemove(doc)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${doc.title}`}
                  style={{ padding: 8 }}
                >
                  <Trash2 size={17} color={color.ink3} strokeWidth={1.8} />
                </Pressable>
              </View>
              {editingId === doc.id ? (
                <Card style={{ marginTop: space.sm, marginBottom: space.md }}>
                  <FormField
                    label="Title"
                    value={editTitle}
                    onChangeText={setEditTitle}
                    placeholder="Insurance card, POLST, discharge summary"
                    autoFocus
                  />
                  <View style={{ marginTop: space.lg }}>
                    <Text style={[type.label, { marginBottom: 6 }]}>Category</Text>
                    <Seg options={CATEGORY_OPTIONS} value={editCategory} onChange={setEditCategory} scroll />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: space.lg }}>
                    <PillButton label="Save" size="sm" onPress={() => saveEdit(doc)} disabled={!editTitle.trim()} />
                    <PillButton label="Cancel" variant="outline" size="sm" onPress={() => setEditingId(null)} />
                  </View>
                </Card>
              ) : null}
            </Animated.View>
          ))}
          <Animated.View
            entering={enterRow(documents.length + 1)}
            style={{ marginTop: space.lg, flexDirection: 'row', gap: 10 }}
          >
            <PillButton
              label="Add a document"
              variant="outline"
              size="sm"
              icon={<Plus size={14} color={color.ink} strokeWidth={2} />}
              onPress={pickSource}
              disabled={busy}
            />
          </Animated.View>
        </>
      )}
      <Animated.View entering={enterQuiet}>
        <Text style={[type.mini, { marginTop: space.lg }]}>
          Files are protected by this phone's passcode and never leave it unless you share them. You can require Face
          ID to open Hearth in Settings.
        </Text>
      </Animated.View>
    </View>
  );
}
