import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBuilder } from '@/context/BuilderContext';
import { useColors } from '@/hooks/useColors';

export default function ProjectsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    projects,
    repairProject,
    queueGitHubBuild,
    githubConfig,
    setGitHubConfig,
    isGitHubConfigured,
  } = useBuilder();

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: insets.bottom + 104 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>WORKSPACE</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Your projects</Text>
        </View>
        <View style={[styles.folderIcon, { backgroundColor: colors.accent }]}>
          <Feather name="folder" size={20} color={colors.primary} />
        </View>
      </View>
      <Text style={[styles.intro, { color: colors.mutedForeground }]}>
        Every prompt becomes an editable Android project. Repair it, then send a build to GitHub Actions.
      </Text>

      <View style={[styles.connectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.connectionHeader}>
          <View>
            <Text style={[styles.connectionTitle, { color: colors.cardForeground }]}>GitHub connection</Text>
            <Text style={[styles.connectionSubtitle, { color: colors.mutedForeground }]}>
              Required before an APK build can start
            </Text>
          </View>
          <View style={[styles.connectionStatus, { backgroundColor: isGitHubConfigured ? '#193F36' : colors.muted }]}>
            <View style={[styles.statusDot, { backgroundColor: isGitHubConfigured ? colors.primary : colors.mutedForeground }]} />
            <Text style={[styles.connectionStatusText, { color: isGitHubConfigured ? colors.primary : colors.mutedForeground }]}>
              {isGitHubConfigured ? 'Ready' : 'Not connected'}
            </Text>
          </View>
        </View>
        <TextInput
          value={githubConfig.login}
          onChangeText={(login) => setGitHubConfig({ ...githubConfig, login })}
          placeholder="GitHub login"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          style={[styles.connectionInput, { color: colors.foreground, borderColor: colors.border }]}
        />
        <TextInput
          value={githubConfig.token}
          onChangeText={(token) => setGitHubConfig({ ...githubConfig, token })}
          placeholder="Personal access token"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={[styles.connectionInput, { color: colors.foreground, borderColor: colors.border }]}
        />
        <TextInput
          value={githubConfig.repository}
          onChangeText={(repository) => setGitHubConfig({ ...githubConfig, repository })}
          placeholder="owner/repository"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          style={[styles.connectionInput, { color: colors.foreground, borderColor: colors.border }]}
        />
        <View style={[styles.tokenNote, { backgroundColor: colors.muted }]}>
          <Feather name="lock" size={13} color={colors.primary} />
          <Text style={[styles.tokenNoteText, { color: colors.mutedForeground }]}>
            Your token is held in memory only and is not saved to the device.
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        {projects.map((project) => {
          const building = project.status === 'Building';
          const built = project.status === 'Built';
          return (
            <View key={project.id} style={[styles.projectCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <View style={[styles.projectIcon, { backgroundColor: project.language === 'Kotlin' ? '#283B70' : '#3E3526' }]}>
                  <Feather name={project.language === 'Kotlin' ? 'code' : 'terminal'} size={18} color={project.language === 'Kotlin' ? '#9EB8FF' : '#FFCE78'} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={[styles.projectName, { color: colors.cardForeground }]}>{project.name}</Text>
                  <Text style={[styles.projectDescription, { color: colors.mutedForeground }]} numberOfLines={2}>{project.description}</Text>
                </View>
                <View style={[styles.status, { backgroundColor: building ? '#31476E' : '#193F36' }]}>
                  <View style={[styles.statusDot, { backgroundColor: building ? '#9EB8FF' : colors.primary }]} />
                  <Text style={[styles.statusText, { color: building ? '#9EB8FF' : colors.primary }]}>{building ? 'Building' : built ? 'APK ready' : project.status}</Text>
                </View>
              </View>
              <View style={[styles.details, { borderTopColor: colors.border }]}>
                <Text style={[styles.detail, { color: colors.mutedForeground }]}>{project.language} · {project.files} files</Text>
                <Text style={[styles.detail, { color: colors.mutedForeground }]}>{project.buildCount} GitHub {project.buildCount === 1 ? 'build' : 'builds'}</Text>
                <Text style={[styles.detail, { color: colors.mutedForeground }]}>{project.updated}</Text>
              </View>
              <View style={styles.actions}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    repairProject(project.id);
                  }}
                  style={({ pressed }) => [styles.secondaryButton, { backgroundColor: colors.secondary }, pressed && { opacity: 0.75 }]}
                >
                  <Feather name="tool" size={14} color={colors.secondaryForeground} />
                  <Text style={[styles.secondaryText, { color: colors.secondaryForeground }]}>Repair</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (built) {
                      if (project.apkUrl) Linking.openURL(project.apkUrl);
                      return;
                    }
                    if (!isGitHubConfigured) {
                      Alert.alert('Connect GitHub first', 'Enter your login, token, and repository above.');
                      return;
                    }
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    queueGitHubBuild(project.id);
                  }}
                  style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && { opacity: 0.75 }]}
                >
                  <Feather name={built ? 'download' : 'github'} size={14} color={colors.primaryForeground} />
                  <Text style={[styles.primaryText, { color: colors.primaryForeground }]}>{built ? 'Download APK' : 'Build on GitHub'}</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <View style={[styles.githubCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <View style={[styles.githubMark, { backgroundColor: colors.card }]}>
          <Feather name="github" size={17} color={colors.foreground} />
        </View>
        <View style={styles.githubCopy}>
          <Text style={[styles.githubTitle, { color: colors.foreground }]}>GitHub Actions handoff</Text>
          <Text style={[styles.githubText, { color: colors.mutedForeground }]}>Builds run from a generated workflow. Connect a repository when you are ready for real APK artifacts.</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, marginBottom: 9 },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.7 },
  folderIcon: { width: 45, height: 45, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  intro: { paddingHorizontal: 22, marginTop: 10, fontSize: 14, lineHeight: 21 },
  list: { padding: 18, gap: 12 },
  projectCard: { borderRadius: 19, borderWidth: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  projectIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1 },
  projectName: { fontSize: 15, fontWeight: '700' },
  projectDescription: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  status: { borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  details: { borderTopWidth: 1, marginTop: 14, paddingTop: 11, flexDirection: 'row', justifyContent: 'space-between' },
  detail: { fontSize: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  secondaryButton: { flex: 0.8, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  secondaryText: { fontSize: 12, fontWeight: '700' },
  primaryButton: { flex: 1.2, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  primaryText: { fontSize: 12, fontWeight: '700' },
  githubCard: { marginHorizontal: 18, padding: 14, borderRadius: 17, borderWidth: 1, flexDirection: 'row', gap: 11 },
  githubMark: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  githubCopy: { flex: 1 },
  githubTitle: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  githubText: { fontSize: 11, lineHeight: 16 },
  connectionCard: { margin: 18, marginTop: 18, borderRadius: 19, borderWidth: 1, padding: 14 },
  connectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13 },
  connectionTitle: { fontSize: 14, fontWeight: '700' },
  connectionSubtitle: { fontSize: 11, marginTop: 4 },
  connectionStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6 },
  connectionStatusText: { fontSize: 10, fontWeight: '700' },
  connectionInput: { minHeight: 42, borderWidth: 1, borderRadius: 11, paddingHorizontal: 12, marginBottom: 8, fontSize: 13 },
  tokenNote: { borderRadius: 10, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  tokenNoteText: { flex: 1, fontSize: 10, lineHeight: 15 },
});