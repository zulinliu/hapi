# Host management

HAPI can manage files, Git repositories, and Claude Code/Codex API providers on a connected runner machine.

## Enable workspace management

Host file and Git operations are opt-in. Start the runner with one or more workspace roots:

```bash
hapi runner start --workspace-root ~/code --workspace-root /srv/projects
```

Open **Browse** in the web app and select a machine. Every file and Git operation is restricted to that machine's configured roots. Workspace roots and nested `.git` metadata cannot be modified through the file manager.

## File manager

The **Files** tab supports:

- creating files and folders;
- copying and moving files or folders;
- permanently deleting selected files or folders after confirmation;
- choosing an existing or custom destination for copy/move operations, with replace, new-copy, or skip conflict policies;
- previewing and editing text files with stale-write protection, previewing images, and downloading files or compressed folder archives;
- showing hidden files;
- starting an agent session in the current directory.

Copy and move operations preflight every destination before changing files. They can stop on a conflict, replace existing paths, create a numbered copy, or skip conflicts. Long operations run as cancellable runner jobs and report progress to the web app.

## Git management

The **Git** tab discovers the repository containing the current directory and supports:

- status, branch, upstream, ahead/behind, and remote inspection;
- staging and unstaging paths;
- committing staged changes;
- pushing to `origin`;
- adding or replacing the `origin` URL;
- cloning into the current directory;
- fetching/pruning remote refs, fast-forwarding the current branch, and creating, switching, or deleting local and remote branches.

The commit form defaults to a Conventional Commit template and can switch to a custom message. This preference is saved locally in `$HAPI_HOME/git-preferences.json`, keyed by repository; no project file or Git configuration is changed.

For GitHub clones, HAPI uses an authenticated `gh repo clone` when available and falls back to `git clone`. Core working-tree operations and push use Git because GitHub CLI has no commit/push replacement. Configure Git or GitHub CLI credentials on the runner machine; HAPI does not accept credentials embedded in remote URLs.

## API providers

Open **Settings → API Providers**, select a machine, then select an Agent. The page includes every Agent HAPI can create. Managed custom profiles are currently adapted for Claude Code, Codex, and Grok Build; other Agents remain visible with their native-login-only status.

A managed profile can contain:

- display name;
- explicit API protocol (`anthropic-messages`, `openai-responses`, `openai-chat-completions`, or `gemini-generative-ai` when supported by that Agent);
- API base URL;
- API key, or a Claude-specific auth token;
- optional default model;
- custom models and a cached provider model list.

Profiles and secrets are stored only on the selected machine in `$HAPI_HOME/providers.json` with private file permissions. The hub does not persist provider secrets and list responses never return them.

Use **Test** to call the protocol's low-cost model-list endpoint. A failed check never discards the form: the profile can still be saved as unverified. Provider models are cached on the machine and merged with HAPI's native model choices in new sessions and compatible running sessions. Append `[1M]` to a configured model ID, for example `glm-5.2[1M]`, to declare one-million-token context; the Agent receives the raw `glm-5.2` ID. Untagged models are shown as 200K by HAPI convention.

Choose a machine default in Settings, or override it while creating a session. **Machine default** resolves the machine's configured profile and falls back to the Agent login when no default exists. **System / agent login** bypasses managed profiles and uses the Agent's existing login and environment. A running session can change only models that its Agent advertises; changing a provider applies on a new or restarted session.

Terminal launches use the machine default as well. Override it with:

```bash
hapi --hapi-provider <profile-uuid>
hapi codex --hapi-provider <profile-uuid>
hapi grok --hapi-provider <profile-uuid>
```

Use `--hapi-provider system` to bypass the managed default.

### Agent mappings

- Claude Code: `ANTHROPIC_API_KEY` or `ANTHROPIC_AUTH_TOKEN`, plus optional `ANTHROPIC_BASE_URL`.
- Codex official endpoint: `OPENAI_API_KEY`.
- Codex custom endpoint: an ephemeral process-level `model_provider` configuration; the regular `CODEX_HOME` remains intact so sessions, skills, and user configuration are preserved.

## Security notes

- Machine routes remain namespace-isolated and require an online machine.
- Paths are canonicalized with `realpath`; symlink escapes are rejected.
- Git commands use fixed argument arrays, never shell command strings.
- Remote URLs containing inline credentials are rejected.
- Provider secrets are injected only into the selected agent process and are redacted from responses and logs.
