# HAPI 源码构建发布迁移方案

状态：已调研、已评审；未执行。
日期：2026-07-19
目标源码：`/home/liuzl/codex-project/hapi-codex` 的 `feat/codex` 分支，调研时 HEAD 为 `30a3f384a1f982e7f1796ebcc415158b8b7af37e`。

## 1. 目标和边界

将本机当前由 Homebrew 提供的 HAPI Hub 和 Runner，替换为由上述源码构建出的单文件二进制。新服务必须保留现有地址、端口、机器身份、会话数据、供应商配置和工作区范围，并作为 systemd 系统服务随开机启动。

本次不是卸载 Homebrew HAPI，也不修改或删除旧单元文件：旧服务只会被停止和禁用；新服务使用不同的 unit 名称。切换期间不得同时运行两个 Hub 或两个 Runner，因为它们会争用 `3006` 端口、`~/.hapi` 数据目录和同一个机器身份。

## 2. 已确认的现状

| 项目 | 调研结果 |
| --- | --- |
| 操作系统 | Ubuntu 24，x86_64 |
| 构建工具 | Bun `1.3.14`，与仓库 `packageManager` 一致 |
| 当前源码版本 | `@twsxtd/hapi 0.23.1`；分支比 `origin/main` 多 3 个提交 |
| 已安装版本 | Homebrew `hapi 0.20.2`，路径 `/home/linuxbrew/.linuxbrew/bin/hapi` |
| 旧 Hub 单元 | `hapi-hub.service`，已启用，`ExecStart=hapi hub` |
| 旧 Runner 单元 | `hapi-runner.service`，已启用，`ExecStart=hapi runner start-sync --workspace-root /home/liuzl` |
| 运行身份 | `liuzl:liuzl`，工作目录 `/home/liuzl` |
| Hub 网络配置 | `HAPI_LISTEN_HOST=0.0.0.0`，`HAPI_LISTEN_PORT=3006` |
| Runner 网络配置 | `HAPI_API_URL=http://localhost:3006` |
| 持久化目录 | `HAPI_HOME=/home/liuzl/.hapi` |
| 主要持久化项 | `hapi.db`、WAL/SHM、`settings.json`、JWT、Runner 状态、日志、运行时文件，以及可能存在的 `providers.json` / Git 偏好 |
| 当前数据规模 | SQLite 主库约 123 MiB，WAL 约 5.4 MiB，日志约 675 MiB；根分区可用空间约 20 GiB |

不在本文档或实施日志中记录 `settings.json`、JWT、令牌、供应商密钥或数据库消息正文。

## 3. 关键设计决定

1. **复用原 `HAPI_HOME`，不迁移到新目录。** 新旧二进制都以 `/home/liuzl/.hapi` 运行，因此机器 ID、Hub token、数据库、会话历史、推送密钥和本地供应商资料保持连续。备份目录绝不能被作为新服务的 `HAPI_HOME` 使用，否则会生成新的机器身份并破坏连续性。
2. **构建与运行分离。** 在当前源码工作区构建，但 systemd 不执行工作区内的 Bun/TypeScript 源码，也不依赖 `node_modules`。构建出的单文件二进制安装到 root 拥有的 `/opt/hapi/releases/<时间>-<提交>/hapi`，`/opt/hapi/current` 指向已验证的 release。这样源码工作区后续编辑不会影响线上服务，且回滚只需切换符号链接。
3. **保留旧单元，创建新单元。** 旧 `hapi-hub.service`、`hapi-runner.service` 保持原文件内容，切换后处于 `disabled` 和 `inactive`。新单元命名为 `hapi-source-hub.service`、`hapi-source-runner.service`，避免覆盖或误改旧发布渠道。
4. **Runner 显式使用 `KillMode=process`。** 当前旧 Runner 单元没有该项。源码文档确认默认 `control-group` 在停止单元时可能终止已派生的 Agent 会话；新 Runner 必须只停止 Runner 主进程，保留已分离的会话进程并允许它们重连。
5. **保留网络和 Agent 查找路径。** 新单元复用当前的监听地址、端口、`HAPI_API_URL`、`HOME` 和工作目录；`PATH` 同时包含 Linuxbrew、`~/.local/bin` 和 mise shims，以继续发现 `claude`、`codex`、`opencode`、`gh`、`git` 等已安装工具。

## 4. 强制闸门

以下任一项不满足时，实施必须停止，不执行服务切换：

1. **会话闸门：** 当前旧 Runner 有多个派生 Agent 进程。旧单元采用默认 systemd 杀进程语义，直接停止它可能中断这些会话。实施前必须在 HAPI 中确认没有需要保留的活动远程会话，或由操作者明确接受中断并确认可在切换后恢复会话。
2. **源码闸门：** 记录待发布的不可变 commit、`git status`、版本号和 `git diff --check`。不从包含未确认业务改动的工作树发布。方案文档本身可先提交，或在构建前明确排除为仅文档改动。
3. **构建闸门：** `bun install --frozen-lockfile`、类型检查、相关测试和 `bun run build:single-exe` 均成功；构建产物通过 `file`、`--version` 和 SHA-256 校验。
4. **备份闸门：** 完成可读的数据库一致性备份、完整 `HAPI_HOME` 归档、单元文件备份和校验清单。至少保留本机快速回滚副本；如要求抵抗磁盘故障，须在停服前提供第二个不同存储介质或主机的备份目标。
5. **可用性闸门：** 端口 `3006` 仅由旧 Hub 占用；不存在另一套 Hub/Runner 使用相同 `HAPI_HOME`。实施时须以 `lsof`、systemd cgroup 和脱敏后的进程环境核实，在备份窗口内没有非 systemd 管理的 HAPI 进程继续写入 `~/.hapi`。切换后才允许新单元接管该端口和目录。

## 5. 实施步骤

### 阶段 A：发布前冻结与构建

1. 在当前工作区确认发布 commit、分支、版本、工作树状态和当前 Homebrew 版本，写入发布清单。当前调研的候选版本为 `0.23.1` / `30a3f384...`，但实施时必须重新确认。
2. 在工作区安装锁定依赖并运行：`bun install --frozen-lockfile`、`bun typecheck`、`bun run test`。若完整套件因环境问题未结束，需记录原因并至少运行受改动影响的 CLI、Hub、Shared、Web 测试，不能把未完成说成通过。
3. 执行 `bun run build:single-exe`。该命令会下载构建所需的 tunwg 资产、构建 Web、生成嵌入资源并编译当前 Linux x64 二进制。
4. 使用实际输出路径 `cli/dist-exe/bun-linux-x64-baseline/hapi`，而不是文档中的过时 `cli/dist/hapi`。验证可执行权限、架构、`--version`、`/health` 所需的嵌入资源和 SHA-256。
5. 以 root 权限将验证后的二进制复制到新 release 目录，例如 `/opt/hapi/releases/20260719-<short-sha>/hapi`，设置 `root:root` 与 `0755`，生成 `manifest.json`（commit、版本、Bun 版本、构建时间、哈希、测试结果）。此阶段不切换 `/opt/hapi/current`。

### 阶段 B：备份与旧服务停用

1. 等待会话闸门通过。记录活动会话数量和 runner 进程快照，并确认没有终端或测试遗留的 HAPI 进程会继续写入 `~/.hapi`；不在日志中写入提示词、令牌或 Provider 密钥。不能确认时，暂停实施并要求操作者决定如何处理该进程。
2. 创建权限为 `0700` 的本机备份目录，例如 `/home/liuzl/.local/state/hapi-backups/<时间>-pre-source-release/`。先检查可用空间，预留至少 3 GiB。
3. 备份 `/etc/systemd/system/hapi-hub.service`、`/etc/systemd/system/hapi-runner.service`、`systemctl show` 元数据和 Homebrew 二进制版本。备份文件必须保留所有权和权限。
4. 先禁用旧 Runner 的开机启动，再停止旧 Runner；随后禁用并停止旧 Hub。顺序必须是 Runner -> Hub。停止后验证两个旧 unit 都是 `disabled` 和 `inactive`，且 `3006` 已释放。
5. 服务静止后，对 `~/.hapi/hapi.db` 执行 SQLite `integrity_check`，使用 SQLite `.backup` 生成独立的一致性数据库副本；不要只复制运行中的主数据库文件。
6. 归档整个 `~/.hapi`（包括数据库、WAL/SHM、配置、JWT、Provider/Git 偏好、日志和运行时目录）为受限权限的完整恢复档，并生成 SHA-256 清单。SQLite `.backup` 是快速数据恢复副本，完整归档是保留文件属性和所有持久化资料的取证副本。
7. 检查备份可读、数据库副本可执行 `integrity_check`、校验和匹配。若配置了异机/异盘备份目标，此时复制并校验第二份；任一验证失败都恢复旧服务，不进入新服务启动。

### 阶段 C：安装并启用源码服务

1. 将 `/opt/hapi/current` 原子地指向已验证的新 release，但保留任何旧 `current` 指向记录，便于回退。
2. 创建以下 systemd 系统单元。其精确内容在实施时从本方案生成并经 `systemd-analyze verify` 验证：

```ini
# /etc/systemd/system/hapi-source-hub.service
[Unit]
Description=HAPI Hub (source-built release)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=liuzl
Group=liuzl
WorkingDirectory=/home/liuzl
UMask=0077
Environment=HOME=/home/liuzl
Environment=HAPI_HOME=/home/liuzl/.hapi
Environment=HAPI_LISTEN_HOST=0.0.0.0
Environment=HAPI_LISTEN_PORT=3006
Environment=PATH=/home/liuzl/.local/bin:/home/liuzl/.local/share/mise/shims:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/opt/hapi/current/hapi hub
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/hapi-source-runner.service
[Unit]
Description=HAPI Runner (source-built release)
After=network-online.target hapi-source-hub.service
Wants=network-online.target
Requires=hapi-source-hub.service

[Service]
Type=simple
User=liuzl
Group=liuzl
WorkingDirectory=/home/liuzl
UMask=0077
KillMode=process
Environment=HOME=/home/liuzl
Environment=HAPI_HOME=/home/liuzl/.hapi
Environment=HAPI_API_URL=http://localhost:3006
Environment=PATH=/home/liuzl/.local/bin:/home/liuzl/.local/share/mise/shims:/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=/opt/hapi/current/hapi runner start-sync --workspace-root /home/liuzl
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

3. 执行 `systemd-analyze verify`，`daemon-reload`，然后先 `enable --now hapi-source-hub.service`，在健康检查通过后再 `enable --now hapi-source-runner.service`。不对旧单元执行 delete、mask 或 uninstall。

### 阶段 D：验收

1. Hub：`hapi-source-hub.service` 为 active，`curl http://127.0.0.1:3006/health` 返回 `status: ok`，且监听地址仍为 LAN 可访问的 `0.0.0.0:3006`。
2. Runner：`hapi-source-runner.service` 为 active，Web 中显示原有机器而不是新机器；工作区根仍是 `/home/liuzl`。
3. 数据连续性：检查既有会话、消息数量、机器 ID、设置、Provider 配置列表和 Git 偏好仍存在。只检查名称、数量和功能，不输出密钥值。
4. 功能冒烟：创建一个最小测试会话；验证文件浏览、上传/下载、Git 状态与 Provider 选择入口可用。Provider 健康检查只在操作者允许对外发起 API 请求时执行。
5. 守护与自启：检查新 unit 为 `enabled`，旧 unit 为 `disabled`；重启服务一次并确认 Runner 重连。实际整机重启仅在窗口允许时进行，并在重启后重复健康检查。
6. 观察期：保留 Homebrew、旧 unit、完整备份和前一 release 至少 14 天；观察 journal、Hub 日志、Runner 重连和数据库完整性。期间不得清理旧发布物或备份。

## 6. 回滚方案

触发条件包括：Hub 不能健康响应、Runner 未能使用原机器身份重连、数据库完整性失败、会话/配置缺失、端口或认证异常、关键功能冒烟失败。

1. 停止并禁用 `hapi-source-runner.service`，再停止并禁用 `hapi-source-hub.service`。
2. 不修改 `~/.hapi`，先启用并启动旧 `hapi-hub.service`，健康检查成功后启用并启动旧 `hapi-runner.service`。
3. 验证旧 Hub 的 `3006`、旧机器身份和会话数据恢复。由于默认复用同一个数据目录，正常回滚不应需要恢复数据。
4. 只有在数据库校验失败或持久化资料确实被破坏时，才在全部 HAPI 服务停止后从已校验的 SQLite 备份和完整归档恢复；恢复前再复制当前故障现场，避免覆盖唯一证据。
5. 在发布清单中记录失败现象、journal 片段（脱敏）和回滚结果。旧 unit 文件与 Homebrew 安装始终保留。

## 7. 方案评审结论

| 要求 | 覆盖情况 |
| --- | --- |
| 源码构建、发布和版本更新 | 固定 commit，单文件构建，独立 release 目录和可追溯 manifest |
| 原服务不卸载、仅停用 | 旧 unit 保留原文件，只执行 disable + stop |
| 旧守护与开机自启停用 | 两个旧 unit 均验证 `disabled`/`inactive` |
| 新守护与开机自启 | 两个新的 systemd 系统 unit，`enable --now`，Runner 依赖新 Hub |
| 配置和数据备份、沿用 | 一致性 SQLite 备份 + 全量 `HAPI_HOME` 归档；新服务复用原目录 |
| LAN 可访问性 | 保持 `0.0.0.0:3006` 与原端口不变 |
| 避免运行中会话丢失 | 将旧 Runner 的会话中断风险列为不可跳过闸门；新 Runner 用 `KillMode=process` |
| 可回滚 | 不替换旧安装；符号链接发布和完整备份支持快速回退 |

残余风险：这是从 `0.20.2` 到源码 `0.23.1` 的跨版本更新，数据库与运行时行为可能变化；因此必须先完成备份、健康检查和功能验收，且在观察期内保留旧版本。由于本机快速备份与数据位于同一根分区，它不能单独防范该磁盘整体故障；需要异机/异盘副本才能覆盖该风险。

## 8. 新会话实施提示词

```text
请在 /home/liuzl/codex-project/hapi-codex 按 docs/plans/hapi-source-release-migration-2026-07-19.md 实施 HAPI 源码构建发布迁移。先完整阅读方案并重新核对当前环境、git commit、systemd 单元、端口、HAPI_HOME、磁盘空间和活动会话；不得假设调研结果仍然有效。

严格执行方案中的五个闸门。尤其注意：旧 hapi-runner.service 当前未设置 KillMode=process，停止它可能终止活动 Agent 会话；在我明确确认会话已清空或接受中断前，不得停止、禁用、重启任何旧服务。不得卸载 Homebrew HAPI、删除旧 unit、删除 ~/.hapi，或打印任何 token、密钥、Provider 凭证、数据库消息内容。

使用当前工作区的干净、已记录 commit 构建 all-in-one 二进制；将产物发布到独立的 /opt/hapi/releases/<release> 目录并通过 /opt/hapi/current 切换。新 systemd 单元必须命名 hapi-source-hub.service 和 hapi-source-runner.service，复用原 HAPI_HOME=/home/liuzl/.hapi、LAN 地址 0.0.0.0:3006、Runner API URL 和 /home/liuzl 工作区根；新 Runner 必须设置 KillMode=process。先做并校验一致性 SQLite 备份、完整 HAPI_HOME 归档、原 unit 备份和校验清单，再停用旧服务。

实施过程中在每个不可逆或影响服务可用性的步骤前报告状态并等待我确认。完成后验证健康检查、原机器身份、会话/设置/Provider 配置连续性、文件和 Git 管理功能、守护进程和开机自启；保留旧服务、旧二进制、备份和前一 release，并给出脱敏的发布与回滚记录。
```
