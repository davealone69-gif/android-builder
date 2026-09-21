import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Language, Project, useBuilder } from '@/context/BuilderContext';

function LanguageToggle({
  value,
  onChange,
}: {
  value: Language;
  onChange: (value: Language) => void;
}) {
  const colors = useColors();
  return (
    <View style={[styles.languageToggle, { backgroundColor: colors.muted }]}>
      {(['Kotlin', 'Python'] as Language[]).map((language) => (
        <Pressable
          key={language}
          onPress={() => {
            Haptics.selectionAsync();
            onChange(language);
          }}
          style={[
            styles.languageChip,
            value === language && { backgroundColor: colors.accent },
          ]}
        >
          <Text
            style={[
              styles.languageText,
              { color: value === language ? colors.foreground : colors.mutedForeground },
            ]}
          >
            {language}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ActionButton({
  label,
  icon,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={() => {
        if (disabled) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: secondary ? colors.secondary : colors.primary },
        disabled && { opacity: 0.55 },
        pressed && !disabled && { opacity: 0.78, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Feather
        name={icon}
        size={15}
        color={secondary ? colors.secondaryForeground : colors.primaryForeground}
      />
      <Text
        style={[
          styles.actionButtonText,
          { color: secondary ? colors.secondaryForeground : colors.primaryForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ProjectResult({
  project,
  onRepair,
  onBuild,
  onDownload,
}: {
  project: Project;
  onRepair: () => void;
  onBuild: () => void;
  onDownload: () => void;
}) {
  const colors = useColors();
  const isBuilding = project.status === 'Building';
  const isBuilt = project.status === 'Built';
  return (
    <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.resultTop}>
        <View style={[styles.codeMark, { backgroundColor: colors.accent }]}>
          <Feather name={project.language === 'Kotlin' ? 'code' : 'terminal'} size={19} color={colors.primary} />
        </View>
        <View style={styles.resultHeading}>
          <Text style={[styles.resultTitle, { color: colors.cardForeground }]}>{project.name}</Text>
          <Text style={[styles.resultMeta, { color: colors.mutedForeground }]}>
            {project.language} · {project.files} files · {project.updated}
          </Text>
        </View>
        <View style={[styles.readyPill, { backgroundColor: isBuilding ? '#31476E' : '#193F36' }]}>
          {isBuilding ? <ActivityIndicator size="small" color={colors.primary} /> : <View style={[styles.dot, { backgroundColor: colors.primary }]} />}
          <Text style={[styles.readyText, { color: isBuilding ? colors.primary : colors.primary }]}>
            {isBuilding ? 'Queued' : isBuilt ? 'APK ready' : 'Ready'}
          </Text>
        </View>
      </View>
      <Text style={[styles.codePreview, { color: colors.mutedForeground }]} numberOfLines={5}>
        {project.generatedCode}
      </Text>
      <View style={styles.resultActions}>
        <ActionButton label="Self-repair" icon="tool" onPress={onRepair} secondary />
        {isBuilt ? (
          <ActionButton label="Download APK" icon="download" onPress={onDownload} />
        ) : isBuilding ? (
          <ActionButton label="Building on GitHub..." icon="loader" onPress={() => undefined} disabled />
        ) : (
          <ActionButton label="Build on GitHub" icon="github" onPress={onBuild} />
        )}
      </View>
      {project.repairNote ? (
        <View style={[styles.repairNote, { backgroundColor: colors.muted }]}>
          <Feather name="check-circle" size={14} color={colors.primary} />
          <Text style={[styles.repairText, { color: colors.mutedForeground }]}>{project.repairNote}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function BuildScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    projects,
    selectedLanguage,
    setSelectedLanguage,
    createProject,
    repairProject,
    queueGitHubBuild,
    isGitHubConfigured,
    lastError,
  } = useBuilder();
  const [prompt, setPrompt] = useState('');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? projects[0],
    [activeProjectId, projects],
  );

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const project = await createProject(prompt);
      if (project) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setActiveProjectId(project.id);
        setPrompt('');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: insets.bottom + 104 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>ANDROID BUILDER</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Build an app.</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Learn as you ship.</Text>
        </View>
        <View style={[styles.aiBadge, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Feather name="cpu" size={14} color={colors.primary} />
            <Text style={[styles.aiBadgeText, { color: colors.primary }]}>LOCAL AI</Text>
        </View>
      </View>

      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.heroOrb}>
          <Feather name="zap" size={19} color={colors.primaryForeground} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroTitle, { color: colors.cardForeground }]}>What should we build?</Text>
          <Text style={[styles.heroText, { color: colors.mutedForeground }]}>
            Describe it in plain English. Android Builder creates the starter project and keeps the code editable.
          </Text>
        </View>
      </View>

      <View style={[styles.promptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          value={prompt}
          onChangeText={setPrompt}
          multiline
          placeholder="A habit tracker with a calm daily check-in..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.promptInput, { color: colors.foreground }]}
          textAlignVertical="top"
        />
        <View style={styles.promptFooter}>
          <LanguageToggle value={selectedLanguage} onChange={setSelectedLanguage} />
          <Pressable
            onPress={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
            style={({ pressed }) => [
              styles.generateButton,
              { backgroundColor: prompt.trim() && !isGenerating ? colors.primary : colors.secondary },
              pressed && { opacity: 0.8 },
            ]}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color={colors.mutedForeground} />
            ) : (
              <Feather name="arrow-up" size={18} color={prompt.trim() ? colors.primaryForeground : colors.mutedForeground} />
            )}
          </Pressable>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{projects.length}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>projects</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.foreground }]}>{projects.reduce((sum, project) => sum + project.buildCount, 0)}</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>GitHub builds</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: colors.primary }]}>0</Text>
          <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>API keys</Text>
        </View>
      </View>

      {activeProject ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Latest build</Text>
            <Text style={[styles.sectionLink, { color: colors.primary }]}>LOCAL WORKSPACE</Text>
          </View>
          <ProjectResult
            project={activeProject}
            onRepair={() => repairProject(activeProject.id)}
            onBuild={() => {
              if (!isGitHubConfigured) {
                Alert.alert(
                  'Connect GitHub first',
                  'Add your GitHub login, token, and repository in the Projects tab.',
                );
                return;
              }
              queueGitHubBuild(activeProject.id);
            }}
            onDownload={() => {
              if (activeProject.apkUrl) Linking.openURL(activeProject.apkUrl);
            }}
          />
        </View>
      ) : null}

      {lastError ? (
        <View style={[styles.errorRow, { backgroundColor: '#3A2028' }]}>
          <Feather name="alert-circle" size={15} color="#FF9AAE" />
          <Text style={[styles.errorText, { color: '#FFCBD5' }]}>{lastError}</Text>
        </View>
      ) : null}

      <View style={[styles.infoRow, { backgroundColor: colors.muted }]}>
        <Feather name="shield" size={15} color={colors.primary} />
        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
          Code generation uses your configured local llama.cpp server. Builds use the connected GitHub account and run in GitHub Actions.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 10 },
  title: { fontSize: 31, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { fontSize: 18, marginTop: 2 },
  aiBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 8 },
  aiBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  heroCard: { marginHorizontal: 18, marginTop: 24, borderWidth: 1, borderRadius: 22, padding: 18, flexDirection: 'row', gap: 14 },
  heroOrb: { width: 38, height: 38, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4D78FF' },
  heroCopy: { flex: 1 },
  heroTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  heroText: { fontSize: 13, lineHeight: 19 },
  promptCard: { marginHorizontal: 18, marginTop: 12, borderWidth: 1, borderRadius: 20, padding: 12 },
  promptInput: { minHeight: 104, paddingHorizontal: 6, paddingTop: 5, fontSize: 15, lineHeight: 22 },
  promptFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  languageToggle: { flexDirection: 'row', padding: 3, borderRadius: 12, gap: 3 },
  languageChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9 },
  languageText: { fontSize: 12, fontWeight: '600' },
  generateButton: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', paddingHorizontal: 24, paddingVertical: 23, gap: 32 },
  stat: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  statValue: { fontSize: 20, fontWeight: '700' },
  statLabel: { fontSize: 12 },
  section: { paddingHorizontal: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 },
  sectionTitle: { fontSize: 19, fontWeight: '700' },
  sectionLink: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  resultCard: { borderRadius: 20, borderWidth: 1, padding: 15 },
  resultTop: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  codeMark: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  resultHeading: { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: '700' },
  resultMeta: { fontSize: 11, marginTop: 4 },
  readyPill: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  readyText: { fontSize: 10, fontWeight: '700' },
  codePreview: { backgroundColor: '#0A1120', borderRadius: 13, padding: 12, marginTop: 15, fontFamily: 'monospace', fontSize: 11, lineHeight: 17 },
  resultActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionButton: { flex: 1, minHeight: 39, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  actionButtonText: { fontSize: 12, fontWeight: '700' },
  repairNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 11, padding: 10, marginTop: 10 },
  repairText: { flex: 1, fontSize: 11, lineHeight: 16 },
  infoRow: { marginHorizontal: 18, marginTop: 14, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 9, alignItems: 'center' },
  infoText: { flex: 1, fontSize: 11, lineHeight: 16 },
  errorRow: { marginHorizontal: 18, marginTop: 14, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 9, alignItems: 'flex-start' },
  errorText: { flex: 1, fontSize: 11, lineHeight: 16 },
});