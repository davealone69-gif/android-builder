import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Language, useBuilder } from '@/context/BuilderContext';
import { useColors } from '@/hooks/useColors';

export default function LearnScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { notes, addLearningNote } = useBuilder();
  const [language, setLanguage] = useState<Language>('Kotlin');
  const [code, setCode] = useState('');

  const saveNote = () => {
    if (!code.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addLearningNote(code, language);
    setCode('');
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 104 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>PERSONAL AI MEMORY</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Teach your builder</Text>
        </View>
        <View style={[styles.bookIcon, { backgroundColor: colors.accent }]}>
          <Feather name="book-open" size={20} color={colors.primary} />
        </View>
      </View>
      <Text style={[styles.intro, { color: colors.mutedForeground }]}>
        Save patterns, snippets, and fixes. New projects use this deck as repair context.
      </Text>

      <View style={[styles.editorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.editorTop}>
          <Text style={[styles.editorTitle, { color: colors.cardForeground }]}>Add learning code</Text>
          <View style={[styles.modeToggle, { backgroundColor: colors.muted }]}>
            {(['Kotlin', 'Python'] as Language[]).map((item) => (
              <Pressable
                key={item}
                onPress={() => setLanguage(item)}
                style={[styles.mode, language === item && { backgroundColor: colors.accent }]}
              >
                <Text style={[styles.modeText, { color: language === item ? colors.foreground : colors.mutedForeground }]}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <TextInput
          multiline
          value={code}
          onChangeText={setCode}
          placeholder={language === 'Kotlin' ? 'fun greet(name: String) { ... }' : 'def greet(name):\\n    ...'}
          placeholderTextColor={colors.mutedForeground}
          textAlignVertical="top"
          style={[styles.codeInput, { color: colors.foreground }]}
        />
        <Pressable
          onPress={saveNote}
          disabled={!code.trim()}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: code.trim() ? colors.primary : colors.secondary },
            pressed && { opacity: 0.75 },
          ]}
        >
          <Feather name="plus" size={15} color={code.trim() ? colors.primaryForeground : colors.mutedForeground} />
          <Text style={[styles.saveText, { color: code.trim() ? colors.primaryForeground : colors.mutedForeground }]}>Save to learning deck</Text>
        </Pressable>
      </View>

      <View style={styles.deckHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your deck</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>{notes.length} snippets</Text>
      </View>
      {notes.length ? notes.map((note) => (
        <View key={note.id} style={[styles.noteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.noteHeader}>
            <View style={[styles.noteLanguage, { backgroundColor: colors.accent }]}>
              <Text style={[styles.noteLanguageText, { color: colors.primary }]}>{note.language}</Text>
            </View>
            <Text style={[styles.noteDate, { color: colors.mutedForeground }]}>{note.createdAt}</Text>
          </View>
          <Text style={[styles.noteTitle, { color: colors.cardForeground }]} numberOfLines={1}>{note.title}</Text>
          <Text style={[styles.noteCode, { color: colors.mutedForeground }]} numberOfLines={3}>{note.code}</Text>
        </View>
      )) : (
        <View style={[styles.emptyCard, { backgroundColor: colors.muted }]}>
          <Feather name="layers" size={21} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Your learning deck is empty</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Add a code pattern and self-repair will use it on the next run.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.25, marginBottom: 9 },
  title: { fontSize: 29, fontWeight: '700', letterSpacing: -0.7 },
  bookIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  intro: { paddingHorizontal: 22, marginTop: 10, fontSize: 14, lineHeight: 21 },
  editorCard: { margin: 18, marginBottom: 24, borderRadius: 19, borderWidth: 1, padding: 14 },
  editorTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  editorTitle: { fontSize: 14, fontWeight: '700' },
  modeToggle: { flexDirection: 'row', gap: 3, padding: 3, borderRadius: 10 },
  mode: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 7 },
  modeText: { fontSize: 10, fontWeight: '700' },
  codeInput: { minHeight: 132, backgroundColor: '#0A1120', borderRadius: 13, padding: 12, fontFamily: 'monospace', fontSize: 12, lineHeight: 18 },
  saveButton: { minHeight: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, marginTop: 12 },
  saveText: { fontSize: 12, fontWeight: '700' },
  deckHeader: { paddingHorizontal: 18, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 11 },
  sectionTitle: { fontSize: 19, fontWeight: '700' },
  count: { fontSize: 11 },
  noteCard: { marginHorizontal: 18, marginBottom: 10, borderRadius: 17, borderWidth: 1, padding: 14 },
  noteHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  noteLanguage: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8 },
  noteLanguageText: { fontSize: 10, fontWeight: '700' },
  noteDate: { fontSize: 10 },
  noteTitle: { fontSize: 14, fontWeight: '700', marginTop: 12 },
  noteCode: { fontFamily: 'monospace', fontSize: 11, lineHeight: 17, marginTop: 7 },
  emptyCard: { marginHorizontal: 18, borderRadius: 17, padding: 18, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '700', marginTop: 10 },
  emptyText: { fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5, maxWidth: 265 },
});