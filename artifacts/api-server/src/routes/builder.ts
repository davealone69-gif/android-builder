import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  GenerateProjectCodeBody,
  StartGithubBuildBody,
} from "@workspace/api-zod";
import { Router, type IRouter } from "express";

type BuildRecord = {
  id: string;
  owner: string;
  repo: string;
  branch: string;
  commitSha: string;
  actionsUrl: string;
};

type GithubError = Error & { status?: number };
type ProxyInit = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

const router: IRouter = Router();
const connectors = new ReplitConnectors();
const builds = new Map<string, BuildRecord>();
const llamaBaseUrl = (process.env["LLAMA_BASE_URL"] ?? "http://127.0.0.1:11434/v1").replace(
  /\/+$/,
  "",
);
const llamaModel = process.env["LLAMA_MODEL"] ?? "llama3.2:1b";

function buildId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function projectNameFromPrompt(prompt: string): string {
  const words = prompt
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3);
  return words.length
    ? words.map((word) => `${word[0]?.toUpperCase()}${word.slice(1)}`).join(" ")
    : "Android app";
}

function parseRepository(repository: string): { owner: string; repo: string } {
  const value = repository
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
  const parts = value.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new Error("Repository must be in owner/repository format.");
  }
  return { owner: parts[0]!, repo: parts[1]! };
}

function escapeKotlin(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function buildProjectFiles(input: {
  projectName: string;
  language: "Kotlin" | "Python";
  prompt: string;
  code: string;
}): Array<{ path: string; content: string }> {
  const safeTitle = escapeKotlin(input.projectName);
  const sourcePath =
    input.language === "Kotlin"
      ? "builder/generated-source.kt"
      : "builder/generated-source.py";
  const workflow = `name: Android Builder

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - name: Check out source
        uses: actions/checkout@v4
      - name: Set up Java
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'
      - name: Set up Gradle
        uses: gradle/actions/setup-gradle@v4
      - name: Build debug APK
        run: gradle :app:assembleDebug
      - name: Upload APK artifact
        uses: actions/upload-artifact@v4
        with:
          name: app-debug-apk
          path: app/build/outputs/apk/debug/app-debug.apk
`;

  return [
    {
      path: ".github/workflows/android-builder.yml",
      content: workflow,
    },
    {
      path: "settings.gradle.kts",
      content: `pluginManagement {
  repositories {
    google()
    mavenCentral()
    gradlePluginPortal()
  }
}

dependencyResolutionManagement {
  repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
  repositories {
    google()
    mavenCentral()
  }
}

rootProject.name = "AndroidBuilder"
include(":app")
`,
    },
    {
      path: "build.gradle.kts",
      content: `plugins {
  id("com.android.application") version "8.7.3" apply false
  id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}
`,
    },
    {
      path: "gradle.properties",
      content: `org.gradle.jvmargs=-Xmx2g -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
`,
    },
    {
      path: "app/build.gradle.kts",
      content: `plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

android {
  namespace = "com.androidbuilder"
  compileSdk = 35

  defaultConfig {
    applicationId = "com.androidbuilder.generated"
    minSdk = 24
    targetSdk = 35
    versionCode = 1
    versionName = "1.0"
  }

  buildFeatures {
    compose = true
  }
}

dependencies {
  implementation("androidx.activity:activity-compose:1.9.3")
  implementation("androidx.compose.ui:ui:1.7.8")
  implementation("androidx.compose.ui:ui-tooling-preview:1.7.8")
  implementation("androidx.compose.material3:material3:1.3.1")
}
`,
    },
    {
      path: "app/src/main/AndroidManifest.xml",
      content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <application
    android:allowBackup="true"
    android:label="${input.projectName}"
    android:theme="@style/Theme.AppCompat.Light.NoActionBar">
    <activity
      android:name=".MainActivity"
      android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>
  </application>
</manifest>
`,
    },
    {
      path: "app/src/main/java/com/androidbuilder/MainActivity.kt",
      content: `package com.androidbuilder

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

class MainActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContent {
      MaterialTheme {
        Surface {
          GeneratedApp()
        }
      }
    }
  }
}

@Composable
private fun GeneratedApp() {
  Text("${safeTitle}")
}
`,
    },
    {
      path: "README.md",
      content: `# ${input.projectName}

Generated by Android Builder.

Prompt: ${input.prompt}

The editable ${input.language} source is in \`${sourcePath}\`. The Android host project builds a debug APK with GitHub Actions.
`,
    },
    {
      path: sourcePath,
      content: input.code,
    },
  ];
}

async function githubJson(path: string, init?: ProxyInit): Promise<any> {
  const response = await connectors.proxy("github", path, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body?.message ?? `GitHub request failed (${response.status})`) as GithubError;
    error.status = response.status;
    throw error;
  }
  return body;
}

async function commitProject(
  owner: string,
  repo: string,
  input: {
    projectName: string;
    language: "Kotlin" | "Python";
    prompt: string;
    code: string;
  },
): Promise<{ branch: string; commitSha: string }> {
  const repository = await githubJson(`/repos/${owner}/${repo}`);
  const branch = repository.default_branch ?? "main";
  let parentSha: string | undefined;
  let baseTree: string | undefined;

  try {
    const ref = await githubJson(
      `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`,
    );
    parentSha = ref.object.sha;
    const commit = await githubJson(
      `/repos/${owner}/${repo}/git/commits/${parentSha}`,
    );
    baseTree = commit.tree.sha;
  } catch (error) {
    if ((error as GithubError).status !== 404) throw error;
  }

  const blobs: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  for (const file of buildProjectFiles(input)) {
    const blob = await githubJson(`/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: Buffer.from(file.content).toString("base64"),
        encoding: "base64",
      }),
    });
    blobs.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const tree = await githubJson(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(baseTree ? { base_tree: baseTree } : {}), tree: blobs }),
  });
  const commit = await githubJson(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Build ${input.projectName}`,
      tree: tree.sha,
      ...(parentSha ? { parents: [parentSha] } : {}),
    }),
  });

  try {
    await githubJson(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
  } catch (error) {
    if ((error as GithubError).status !== 404) throw error;
    await githubJson(`/repos/${owner}/${repo}/git/refs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
    });
  }

  return { branch, commitSha: commit.sha };
}

router.post("/ai/generate", async (req, res) => {
  const parsed = GenerateProjectCodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Prompt and language are required." });
    return;
  }

  const { prompt, language, learningContext } = parsed.data;
  const system = `You generate concise, runnable starter code for an Android Builder project.
Return only the source code, no markdown fences and no explanation.
The selected language is ${language}.
The code must be self-contained and safe to save as a project source file.`;
  const user = [
    `App request: ${prompt}`,
    learningContext ? `Learning snippets to respect:\n${learningContext}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await fetch(`${llamaBaseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: llamaModel,
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      res.status(503).json({
        message: `Local llama.cpp server returned ${response.status}.`,
      });
      return;
    }
    const code = body?.choices?.[0]?.message?.content;
    if (typeof code !== "string" || !code.trim()) {
      res.status(503).json({ message: "Local AI returned no code." });
      return;
    }
    res.json({
      projectName: projectNameFromPrompt(prompt),
      language,
      code: code.trim(),
      model: llamaModel,
    });
  } catch (error) {
    req.log.error({ err: error }, "Local AI request failed");
    res.status(503).json({
      message: `Local llama.cpp server is unavailable at ${llamaBaseUrl}.`,
    });
  }
});

router.post("/github/builds", async (req, res) => {
  const parsed = StartGithubBuildBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Repository, project name, prompt, language, and code are required." });
    return;
  }

  try {
    const { owner, repo } = parseRepository(parsed.data.repository);
    const { branch, commitSha } = await commitProject(owner, repo, parsed.data);
    const id = buildId();
    const actionsUrl = `https://github.com/${owner}/${repo}/actions`;
    builds.set(id, { id, owner, repo, branch, commitSha, actionsUrl });
    res.status(202).json({
      buildId: id,
      status: "queued",
      repository: `${owner}/${repo}`,
      commitSha,
      actionsUrl,
    });
  } catch (error) {
    req.log.error({ err: error }, "GitHub build start failed");
    const status = (error as GithubError).status === 404 ? 404 : 502;
    res.status(status).json({ message: (error as Error).message });
  }
});

router.get("/github/builds/:buildId", async (req, res) => {
  const record = builds.get(req.params.buildId);
  if (!record) {
    res.status(404).json({ message: "Build not found." });
    return;
  }

  try {
    const runs = await githubJson(
      `/repos/${record.owner}/${record.repo}/actions/runs?head_sha=${record.commitSha}&per_page=10`,
    );
    const run = runs.workflow_runs?.[0];
    if (!run) {
      res.json({
        buildId: record.id,
        status: "queued",
        conclusion: null,
        actionsUrl: record.actionsUrl,
        downloadUrl: null,
        message: "Waiting for GitHub Actions to start.",
      });
      return;
    }
    if (run.status !== "completed") {
      res.json({
        buildId: record.id,
        status: "in_progress",
        conclusion: null,
        actionsUrl: run.html_url ?? record.actionsUrl,
        downloadUrl: null,
        message: "GitHub Actions is building the APK.",
      });
      return;
    }
    if (run.conclusion !== "success") {
      res.json({
        buildId: record.id,
        status: "failed",
        conclusion: run.conclusion,
        actionsUrl: run.html_url ?? record.actionsUrl,
        downloadUrl: null,
        message: `GitHub Actions finished with ${run.conclusion ?? "an unknown result"}.`,
      });
      return;
    }
    const artifacts = await githubJson(
      `/repos/${record.owner}/${record.repo}/actions/runs/${run.id}/artifacts?per_page=100`,
    );
    const apkArtifact = artifacts.artifacts?.find(
      (artifact: { name?: string; expired?: boolean }) =>
        artifact.name === "app-debug-apk" && !artifact.expired,
    );
    res.json({
      buildId: record.id,
      status: "completed",
      conclusion: run.conclusion,
      actionsUrl: run.html_url ?? record.actionsUrl,
      downloadUrl: apkArtifact
        ? `/api/github/builds/${record.id}/download`
        : null,
      message: apkArtifact
        ? "APK artifact is ready to download."
        : "Build succeeded but the APK artifact was not found.",
    });
  } catch (error) {
    req.log.error({ err: error }, "GitHub build status failed");
    res.status(502).json({ message: (error as Error).message });
  }
});

router.get("/github/builds/:buildId/download", async (req, res) => {
  const record = builds.get(req.params.buildId);
  if (!record) {
    res.status(404).json({ message: "Build not found." });
    return;
  }

  try {
    const runs = await githubJson(
      `/repos/${record.owner}/${record.repo}/actions/runs?head_sha=${record.commitSha}&per_page=10`,
    );
    const run = runs.workflow_runs?.[0];
    if (!run || run.conclusion !== "success") {
      res.status(409).json({ message: "The APK is not ready yet." });
      return;
    }
    const artifacts = await githubJson(
      `/repos/${record.owner}/${record.repo}/actions/runs/${run.id}/artifacts?per_page=100`,
    );
    const apkArtifact = artifacts.artifacts?.find(
      (artifact: { name?: string; expired?: boolean }) =>
        artifact.name === "app-debug-apk" && !artifact.expired,
    );
    if (!apkArtifact) {
      res.status(404).json({ message: "APK artifact not found." });
      return;
    }
    const artifactResponse = await connectors.proxy(
      "github",
      `/repos/${record.owner}/${record.repo}/actions/artifacts/${apkArtifact.id}/zip`,
    );
    if (!artifactResponse.ok) {
      res.status(artifactResponse.status).send(await artifactResponse.text());
      return;
    }
    const archive = Buffer.from(await artifactResponse.arrayBuffer());
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="android-builder-apk.zip"',
    );
    res.send(archive);
  } catch (error) {
    req.log.error({ err: error }, "APK download failed");
    res.status(502).json({ message: (error as Error).message });
  }
});

export default router;