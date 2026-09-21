import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  generateProjectCode,
  getGithubBuildStatus,
  startGithubBuild,
} from '@workspace/api-client-react';
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type Language = 'Kotlin' | 'Python';
export type ProjectStatus = 'Ready' | 'Building' | 'Built' | 'Needs repair';

export type Project = {
  id: string;
  name: string;
  description: string;
  language: Language;
  updated: string;
  status: ProjectStatus;
  files: number;
  buildCount: number;
  repo: string;
  generatedCode: string;
  buildId?: string;
  repairNote?: string;
  apkUrl?: string;
  actionsUrl?: string;
};

export type LearningNote = {
  id: string;
  title: string;
  language: Language;
  code: string;
  createdAt: string;
};

export type GitHubConfig = {
  repository: string;
};

type BuilderContextValue = {
  projects: Project[];
  notes: LearningNote[];
  githubConfig: GitHubConfig;
  isGitHubConfigured: boolean;
  lastError: string | null;
  isHydrated: boolean;
  selectedLanguage: Language;
  setSelectedLanguage: (language: Language) => void;
  setGitHubConfig: (config: GitHubConfig) => void;
  clearError: () => void;
  createProject: (prompt: string) => Promise<Project | null>;
  repairProject: (id: string) => Promise<void>;
  queueGitHubBuild: (id: string) => Promise<boolean>;
  addLearningNote: (code: string, language: Language) => void;
};

const STORAGE_KEY = '@android-builder/state';

const starterProject: Project = {
  id: 'starter-counter',
  name: 'Starter Counter',
  description: 'A tiny Kotlin starter with one screen and local state.',
  language: 'Kotlin',
  updated: 'Yesterday',
  status: 'Ready',
  files: 8,
  buildCount: 0,
  repo: 'Not connected',
  generatedCode:
    'class MainActivity : ComponentActivity() {\n  override fun onCreate(savedInstanceState: Bundle?) {\n    setContent { CounterScreen() }\n  }\n}',
};

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeName(prompt: string): string {
  const words = prompt
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  return words.length
    ? words.map((word) => `${word[0]?.toUpperCase()}${word.slice(1)}`).join(' ')
    : 'Untitled app';
}

function apiUrl(path: string): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}${path}` : path;
}

function absoluteDownloadUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith('http') ? url : apiUrl(url);
}

export function BuilderProvider({ children }: PropsWithChildren) {
  const [projects, setProjects] = useState<Project[]>([starterProject]);
  const [notes, setNotes] = useState<LearningNote[]>([]);
  const [githubConfig, setGitHubConfig] = useState<GitHubConfig>({
    repository: '',
  });
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('Kotlin');
  const [lastError, setLastError] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored) as {
          projects?: Project[];
          notes?: LearningNote[];
          selectedLanguage?: Language;
        };
        if (parsed.projects?.length) setProjects(parsed.projects);
        if (parsed.notes) setNotes(parsed.notes);
        if (parsed.selectedLanguage) setSelectedLanguage(parsed.selectedLanguage);
      })
      .catch(() => undefined)
      .finally(() => setIsHydrated(true));
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projects, notes, selectedLanguage }),
    ).catch(() => undefined);
  }, [isHydrated, notes, projects, selectedLanguage]);

  const learningContext = notes
    .slice(0, 8)
    .map((note) => `${note.language}: ${note.code}`)
    .join('\n\n');

  const pollBuild = async (projectId: string, buildId: string): Promise<void> => {
    try {
      const status = await getGithubBuildStatus(buildId);
      setProjects((current) =>
        current.map((project) => {
          if (project.id !== projectId) return project;
          if (status.status === 'queued' || status.status === 'in_progress') {
            return {
              ...project,
              status: 'Building',
              actionsUrl: status.actionsUrl,
              updated: status.message,
            };
          }
          if (status.status === 'completed' && status.downloadUrl) {
            return {
              ...project,
              status: 'Built',
              actionsUrl: status.actionsUrl,
              apkUrl: absoluteDownloadUrl(status.downloadUrl),
              updated: 'APK ready',
              repairNote: undefined,
            };
          }
          return {
            ...project,
            status: 'Needs repair',
            actionsUrl: status.actionsUrl,
            updated: 'GitHub build failed',
            repairNote: status.message,
          };
        }),
      );
      if (status.status === 'queued' || status.status === 'in_progress') {
        setTimeout(() => void pollBuild(projectId, buildId), 5000);
      }
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Unable to read GitHub build status.');
      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? { ...project, status: 'Needs repair', updated: 'Status check failed' }
            : project,
        ),
      );
    }
  };

  const value = useMemo<BuilderContextValue>(
    () => ({
      projects,
      notes,
      githubConfig,
      isGitHubConfigured: Boolean(githubConfig.repository.trim()),
      lastError,
      isHydrated,
      selectedLanguage,
      setSelectedLanguage,
      setGitHubConfig,
      clearError: () => setLastError(null),
      createProject: async (prompt) => {
        try {
          const generated = await generateProjectCode({
            prompt: prompt.trim(),
            language: selectedLanguage,
            learningContext,
          });
          const project: Project = {
            id: makeId(),
            name: generated.projectName || makeName(prompt),
            description: prompt.trim(),
            language: selectedLanguage,
            updated: `Generated with ${generated.model}`,
            status: 'Ready',
            files: selectedLanguage === 'Kotlin' ? 8 : 5,
            buildCount: 0,
            repo: 'Not connected',
            generatedCode: generated.code,
          };
          setProjects((current) => [project, ...current]);
          return project;
        } catch (error) {
          setLastError(
            error instanceof Error
              ? error.message
              : 'Local AI could not generate code.',
          );
          return null;
        }
      },
      repairProject: async (id) => {
        const project = projects.find((item) => item.id === id);
        if (!project) return;
        try {
          const generated = await generateProjectCode({
            prompt: `Repair this ${project.language} Android project code. Keep its intended behavior, fix compile/runtime risks, and return the complete corrected source.\n\nOriginal request: ${project.description}\n\nCurrent source:\n${project.generatedCode}`,
            language: project.language,
            learningContext,
          });
          setProjects((current) =>
            current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    generatedCode: generated.code,
                    status: 'Ready',
                    updated: `Repaired with ${generated.model}`,
                    repairNote: `Real AI repair completed with ${generated.model}.`,
                  }
                : item,
            ),
          );
        } catch (error) {
          setLastError(
            error instanceof Error
              ? error.message
              : 'Local AI could not repair this project.',
          );
          setProjects((current) =>
            current.map((item) =>
              item.id === id
                ? { ...item, status: 'Needs repair', updated: 'Repair failed' }
                : item,
            ),
          );
        }
      },
      queueGitHubBuild: async (id) => {
        if (!githubConfig.repository.trim()) return false;
        const project = projects.find((item) => item.id === id);
        if (!project) return false;
        try {
          const build = await startGithubBuild({
            repository: githubConfig.repository.trim(),
            projectName: project.name,
            language: project.language,
            prompt: project.description,
            code: project.generatedCode,
          });
          setProjects((current) =>
            current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    status: 'Building',
                    buildId: build.buildId,
                    buildCount: item.buildCount + 1,
                    repo: build.repository,
                    actionsUrl: build.actionsUrl,
                    apkUrl: undefined,
                    updated: 'GitHub Actions queued',
                  }
                : item,
            ),
          );
          setTimeout(() => void pollBuild(id, build.buildId), 2500);
          return true;
        } catch (error) {
          setLastError(
            error instanceof Error
              ? error.message
              : 'GitHub could not start the build.',
          );
          return false;
        }
      },
      addLearningNote: (code, language) => {
        const cleaned = code.trim();
        if (!cleaned) return;
        const firstLine = cleaned
          .split('\n')[0]
          ?.replace(/^\/\/|^#/, '')
          .trim();
        const note: LearningNote = {
          id: makeId(),
          title: firstLine || 'Learning snippet',
          language,
          code: cleaned,
          createdAt: 'Just now',
        };
        setNotes((current) => [note, ...current]);
      },
    }),
    [
      githubConfig,
      isHydrated,
      lastError,
      learningContext,
      notes,
      projects,
      selectedLanguage,
    ],
  );

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}

export function useBuilder() {
  const value = useContext(BuilderContext);
  if (!value) throw new Error('useBuilder must be used inside BuilderProvider');
  return value;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);