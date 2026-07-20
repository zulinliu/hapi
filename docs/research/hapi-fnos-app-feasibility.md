# HAPI Web 的 fnOS App 可行性调研

> 状态：调研完成，仅形成结论与方案，不实施
> 调研日期：2026-07-20
> 范围：飞牛 fnOS 应用开发与发布、Docker 应用、本地安装、FN Connect，以及 HAPI Web/Hub 分离部署和端到端访问链路。

本文按以下确定拓扑分析，不再把 Hub 与 fnOS 视为同一台宿主机：

```text
同一局域网
├─ Ubuntu 服务器 A：HAPI Hub（不对公网暴露）
└─ fnOS 服务器 B：HAPI Web Docker App（静态 Web + Hub 反向代理）

外部 iPhone 飞牛 App
  -> FN Connect
  -> fnOS 服务器 B 的 HAPI Web App
  -> Web App 容器经局域网访问 Ubuntu 服务器 A 的 Hub
```

## 结论摘要

| 结论 | 置信度 | 说明 |
| --- | --- | --- |
| 用 `.fpk` 包交付 Docker Compose 应用，并由 fnOS 应用中心手动安装、启停，属于官方明确支持的开发路径 | 已证实 | 官方提供 `fnpack --template docker`、`docker-project` 资源类型、Docker 完整案例和应用中心手动安装流程。 |
| 第一阶段将 HAPI Web 作为本地 `.fpk` 侧载测试包是可行的 | 已证实 | 应用中心可选择本地 `.fpk`，也可在设备上用 `appcenter-cli install-fpk`。官方同时强调手动安装只用于本地测试，不应作为公开分发方式。 |
| “本地安装 `.fpk`”不等于“完全断网安装 Docker 镜像” | 已证实 + 未知 | 官方 Docker 案例引用 `nginx:alpine`，验收项明确要求检查镜像能否拉取。官方没有公开镜像 tar 内嵌、安装时 `docker load`、应用包总大小等规范。 |
| 正式上架目前不是公开自助流程 | 已证实 | 截至调研日，官方文档要求经粉丝群联系社区主理人，加入“应用中心开发者先锋交流群”并按工作人员指引提交；开发者后台仍写为后续上线。 |
| HAPI Web 与 Ubuntu Hub 可以在同一 LAN 的两台主机上分开部署 | 已证实 | HAPI Web 可独立构建；fnOS 容器可以通过局域网访问 Ubuntu Hub，Hub/CLI/RPC 模型不变。 |
| fnOS 容器必须同时承担 Hub 反向代理，不能只放静态文件 | 已证实 | HAPI Web JavaScript 实际运行在 iOS WebView；若仍让前端直接请求 Ubuntu 内网 IP，离开局域网后不可达。相对 API 请求必须经 FN Connect 回到 fnOS 容器，再由容器通过 LAN 转给 Hub。 |
| 当前 HAPI Web 不能原样部署到 fnOS 统一网关 `/app/hapi` | 已证实 | Vite 静态资源可生成子路径，但 Router、API、SSE、Socket.IO、语音 WebSocket、推送深链仍有根路径假设。实测登录后访问 `/app/hapi` 得到 `Not Found`。 |
| iOS 飞牛 App 经 FN Connect 打开 fnOS 上的 HAPI Web App | 用户指定目标 + 待实机验证 | 这是本方案的目标访问方式；仍需确认基础页面可达、实际 URL 是独立根路径还是 `/app/hapi`，以及 SSE、Socket.IO、语音 WebSocket 和大请求在中继下的行为。 |
| 满足“FN Connect 单一入口 + Ubuntu Hub 保持私网”的目标有技术路径 | 有条件可行 | fnOS 容器同时提供静态 Web，并把 API/SSE/Socket.IO 代理到固定的 Ubuntu Hub。若 FN Connect 给应用根路径入口，改造较小；若入口是 `/app/hapi`，还需完成前缀、PWA 和长连接适配。 |
| 不应假定 FN Connect 会转发任意应用宿主机端口 | 未证实 | FN Connect 文档描述的是访问 NAS 的服务域名、直连/P2P/中继选择，没有公开任意端口映射、端口白名单或第三方端口代理契约。 |
| WebSocket 有明确的统一网关支持；SSE 没有完整契约 | 已证实 + 未知 | 官方明确支持 WebSocket。官方把“流式响应”列为应改用端口服务或统一网关的场景，但没有给出 SSE 缓冲、超时、心跳、断线重连或 FN Connect 中继限制。 |
| x86 与 ARM 可以通过同一 `.fpk` 表达，但 Docker 镜像仍必须真实支持目标 CPU 架构 | 已证实 | `manifest.platform` 仅有 `x86`、`arm`、`all`。`platform=all` 不会把单架构镜像变成多架构镜像。 |

综合判断：**“fnOS Docker App 作为 Web/Proxy、经 LAN 连接 Ubuntu 私网 Hub”在网络架构上成立，也是正确的数据链路；FN Connect 到第三方 App 的端到端可达性在 Gate 0 前仍是 Conditional Go。当前 HAPI Web 的“独立托管”默认仍是浏览器直连 Hub，因此 fnOS 版本需要固定走同源代理；具体改造量取决于真实 FN Connect 应用入口是根路径还是 `/app/hapi` 子路径。真正的“断网安装”和正式商店发布仍不能依据当前公开规范直接承诺。**

### Go / No-Go

| 目标 | 判断 | 前提 |
| --- | --- | --- |
| 手动上传 `.fpk`，由应用中心安装 Docker 版 HAPI Web | **Go** | NAS 安装时可拉取多架构镜像；若要求完全断网则转为待确认。 |
| HAPI Web 在 fnOS 服务器 B、Hub 在 Ubuntu 服务器 A | **Go** | Web 容器作为反向代理；Ubuntu Hub 监听 LAN 地址，且防火墙只放行 fnOS 主机。 |
| 当前 HAPI Web 原样放到 `/app/hapi` | **No-Go** | 仅设置 Vite base 不足，认证后客户端路由已实测失败。 |
| FN Connect 只暴露静态 Web，浏览器直接连接 HTTP/私网 Hub | **No-Go** | 公网不可路由且存在 Mixed Content。 |
| FN Connect 单一入口、Hub 不公开暴露 | **Conditional Go** | 独立应用 Origin 实机验证通过，或完成统一网关前缀/代理/安全改造并通过 SSE、WebSocket、上传测试。 |
| 提交飞牛应用中心公开发布 | **Conditional Go** | 完成人工提交流程，取得当期审核、签名、镜像和许可证要求；当前没有公开自助发布契约。 |

## 事实分级

- **已证实**：官方开发者平台、帮助中心、官网或官方发布的 CLI 可以直接支持该结论。
- **工具观察**：使用官方 `fnpack` 二进制得到的可重复结果，但并非公开稳定格式契约。
- **推断**：由两个或更多官方事实推导，尚无官方端到端承诺。
- **未知**：公开一手资料没有给出答案，需要询问飞牛或用真实设备验证。

## 官方资料与版本

开发者站点未给整套规范标注单一版本号。可确定的时间基线如下：

- 官方开发者文档最新可见更新日志日期：**2026-07-05**。
- 官方打包工具：**fnpack 1.2.3**；2026-07-05 更新日志确认该版本。
- 统一网关文档加入日期：**2026-05-09**。
- `platform` 取代旧 `arch` 字段：**2025-12-31** 更新日志。
- 本文所有网页均于 **2026-07-20** 复核。后续实施前应再次检查文档和目标 fnOS 版本。

### 核心一手来源

| 编号 | 官方来源 | 用途 |
| --- | --- | --- |
| F1 | [飞牛应用开放平台](https://developer.fnnas.com/) | 平台状态；“开放 API”“我的应用”仍显示即将上线。 |
| F2 | [AI 友好文档索引](https://developer.fnnas.com/llms.txt) / [完整快照](https://developer.fnnas.com/llms-full.txt) | 官方完整文档索引与快照。 |
| F3 | [准备工作](https://developer.fnnas.com/docs/quick-started/prerequisites/) | 测试设备、管理员权限、CLI 和本地包流程。 |
| F4 | [创建应用](https://developer.fnnas.com/docs/quick-started/create-application/) / [测试应用](https://developer.fnnas.com/docs/quick-started/test-application/) | `.fpk` 创建、手动安装及测试定位。 |
| F5 | [上架应用](https://developer.fnnas.com/docs/quick-started/publish-application/) | 当前人工提交路径、发布材料和测试要求。 |
| F6 | [应用框架](https://developer.fnnas.com/docs/core-concepts/framework/) | 安装目录、生命周期、升级与卸载。 |
| F7 | [Manifest](https://developer.fnnas.com/docs/core-concepts/manifest/) | 元数据、CPU 平台、端口、依赖、兼容范围。 |
| F8 | [环境变量](https://developer.fnnas.com/docs/core-concepts/environment-variables/) | 路径、端口、用户、共享目录和系统架构变量。 |
| F9 | [应用权限](https://developer.fnnas.com/docs/core-concepts/privilege/) / [应用资源](https://developer.fnnas.com/docs/core-concepts/resource/) | 包用户、共享目录、Docker Compose 项目。 |
| F10 | [应用入口](https://developer.fnnas.com/docs/core-concepts/app-entry/) / [index.cgi](https://developer.fnnas.com/docs/core-concepts/index-cgi/) | 端口、CGI、iframe/url 入口和能力边界。 |
| F11 | [统一网关](https://developer.fnnas.com/docs/core-concepts/gateway-registration/) | 系统域名、Unix Socket、登录态、WebSocket 与自定义路径。 |
| F12 | [用户向导](https://developer.fnnas.com/docs/core-concepts/wizard/) | 安装、升级、卸载和配置表单。 |
| F13 | [图标](https://developer.fnnas.com/docs/core-concepts/icon/) | 图标文件、尺寸和大小限制。 |
| F14 | [Docker 应用案例](https://developer.fnnas.com/docs/examples/docker/) | Compose、镜像、端口、状态检测与网关示例。 |
| F15 | [fnpack](https://developer.fnnas.com/docs/cli/fnpack/) / [appcenter-cli](https://developer.fnnas.com/docs/cli/appcentercli/) | 官方工具版本、校验、打包、安装和启停。 |
| F16 | [2025-12-31 更新](https://developer.fnnas.com/docs/update-log/20251231/) / [2026-05-09 更新](https://developer.fnnas.com/docs/update-log/20260509/) / [2026-07-05 更新](https://developer.fnnas.com/docs/update-log/20260705/) | 架构字段、统一网关、fnpack 版本时间线。 |
| F17 | [如何远程访问飞牛 NAS](https://help.fnnas.com/zh-CN/articles/v1/access/how-access) | FN Connect 子域名、SSL、直连/P2P/中继行为。帮助中心 sitemap 对该页标注的最近修改时间为 2026-06-18。 |
| F18 | [FN Connect 官网](https://www.fnnas.com/fn-connect) | 中继带宽/流量权益与连接策略。商业参数可能变化。 |
| F19 | [官方 fnpack 1.2.3 Linux amd64](https://static2.fnnas.com/fnpack/fnpack-1.2.3-linux-amd64) | 本次包格式与 Docker 模板工具观察。调研时 SHA-256 为 `54b97fa7b70968c4d05c79840f5daeff508957d0bb2062fdb0376d00d9615c93`。 |
| F20 | [Native 应用案例](https://developer.fnnas.com/docs/examples/native/) | 统一网关完整示例；国内版示例声明 `os_min_version=1.1.3100`。 |

### HAPI 一手来源

| 编号 | 仓库来源 | 用途 |
| --- | --- | --- |
| H1 | [Web README](../../web/README.md) / [Hub README](../../hub/README.md) | 独立静态托管、Hub 选择器、CORS、HTTPS 与部署配置。 |
| H2 | [useServerUrl.ts](../../web/src/hooks/useServerUrl.ts) / [client.ts](../../web/src/api/client.ts) | Hub URL 优先级、origin 归一化、REST URL 与 Bearer JWT。 |
| H3 | [useSSE.ts](../../web/src/hooks/useSSE.ts) / [useTerminalSocket.ts](../../web/src/hooks/useTerminalSocket.ts) | SSE、心跳重连、Socket.IO 路径和终端 namespace。 |
| H4 | [vite.config.ts](../../web/vite.config.ts) / [router.tsx](../../web/src/router.tsx) / [sw.ts](../../web/src/sw.ts) | Vite base、客户端路由、PWA scope、缓存与根路径假设。 |
| H5 | [Hub HTTP server](../../hub/src/web/server.ts) / [Socket.IO server](../../hub/src/socket/server.ts) | CORS、上传体积、静态托管、Socket.IO Origin 检查和 WebSocket 路由。 |
| H6 | [serverSettings.ts](../../hub/src/config/serverSettings.ts) / [auth.ts](../../hub/src/web/routes/auth.ts) / [auth middleware](../../hub/src/web/middleware/auth.ts) | Hub 监听、公开 URL、CORS、CLI token 换 JWT 与 SSE 查询参数鉴权。 |
| H7 | [voice.ts](../../hub/src/web/routes/voice.ts) / [pushNotificationChannel.ts](../../hub/src/push/pushNotificationChannel.ts) | 语音 WebSocket 回连地址和推送通知深链。 |
| H8 | [协议版本](../../shared/src/version.ts) / [Web About](../../web/src/routes/settings/about.tsx) | Web/Hub 协议版本与当前缺少主动兼容检查。 |
| H9 | [AGPL-3.0-only LICENSE](../../LICENSE) | 分发对象码、对应源代码和网络交互版本的许可证义务。 |

## fnOS 应用平台

### 1. `.fpk`、Manifest 与目录结构

#### 1.1 开发目录

官方 `fnpack create <appname> --template docker` 生成或要求的核心结构是：

```text
myapp/
├── app/
│   ├── docker/
│   │   └── docker-compose.yaml
│   └── ui/
│       ├── config
│       └── images/
├── cmd/
│   ├── main
│   ├── install_init
│   ├── install_callback
│   ├── upgrade_init
│   ├── upgrade_callback
│   ├── uninstall_init
│   ├── uninstall_callback
│   ├── config_init
│   └── config_callback
├── config/
│   ├── privilege
│   └── resource
├── wizard/
├── manifest
├── ICON.PNG
└── ICON_256.PNG
```

`fnpack build` 会检查 `manifest`、合法 JSON 的 `config/privilege` 与 `config/resource`、两个根图标、`app/`、`cmd/`、`wizard/`，以及 manifest 声明的 UI 目录，然后生成 `<appname>.fpk`。[F15]

#### 1.2 Manifest 核心字段

| 范畴 | 字段 | 结论 |
| --- | --- | --- |
| 身份 | `appname`, `version`, `display_name`, `desc`, `source` | 第三方来源使用 `source=thirdparty`。`manifest` 位于包根目录且无扩展名。 |
| 发布者 | `maintainer`, `maintainer_url`, `distributor`, `distributor_url` | 上架前应填写真实信息。 |
| CPU | `platform=x86|arm|all` | `all` 只适用于包本身无特定架构二进制的情况；容器镜像仍需匹配目标架构。 |
| 系统兼容 | `os_min_version`, `os_max_version` | 应按真实测试范围填写。官方 Native 统一网关案例对国内版使用 `os_min_version=1.1.3100`；这不是所有版本、架构和 Docker App 的通用兼容承诺。 |
| 控制 | `ctl_stop=true|false` | 决定应用中心是否显示启动、停止和状态。 |
| 安装 | `install_type`, `install_dep_apps` | 空安装类型由用户选存储位置；`root` 安装到系统分区；依赖以 `:` 分隔，可用 `>` 表示最低版本。 |
| UI | `desktop_uidir`, `desktop_applaunchname` | 入口 ID 必须和 `app/{desktop_uidir}/config` 一致。 |
| 网络 | `service_port`, `checkport` | 固定端口服务可声明端口，并在启动前检查冲突；无固定端口可省略或按需关闭检查。 |
| 授权 | `disable_authorization_path` | 控制是否显示用户目录授权设置。 |
| 更新 | `changelog` | 用于应用更新说明。2025-12-16 日志曾写作 `change_log`，当前 Manifest 正文使用 `changelog`，应以目标系统实测及当前正文为准。 |

官方没有公开 `appname` 字符集合/长度、版本比较完整语义、保留端口列表等全部约束。实施前应让 `fnpack` 校验，并在目标 fnOS 上安装测试。

#### 1.3 安装后目录

fnOS 在 `/var/apps/{appname}` 建立入口目录，并通过软链接把不同数据类型放到所选存储空间：[F6][F8]

```text
/var/apps/{appname}
├── target -> /vol{n}/@appcenter/{appname}  # 已安装文件/运行资源
├── etc    -> /vol{n}/@appconf/{appname}    # 配置
├── var    -> /vol{n}/@appdata/{appname}    # 需跨应用重启保留的运行数据
├── tmp    -> /vol{n}/@apptemp/{appname}    # 临时数据
├── home   -> /vol{n}/@apphome/{appname}    # 应用用户数据
├── cmd/
├── config/
├── manifest
├── meta
├── shares/
└── wizard/
```

脚本与 Compose 应使用 `TRIM_APPDEST`、`TRIM_PKGETC`、`TRIM_PKGVAR`、`TRIM_PKGTMP`、`TRIM_PKGHOME` 等变量，不应硬编码 `/vol{n}`。

注意：框架页列出 `shares/`，资源页和环境变量页的文字示例写成 `/var/apps/myapp/share/`，而 `fnpack 1.2.3` Docker 模板使用 `/var/apps/{appname}/shares/...`。官方材料存在单复数不一致。稳妥做法是优先使用 `TRIM_DATA_SHARE_PATHS`，不要自行拼接该路径。

#### 1.4 工具观察到的 `.fpk` 格式

使用官方 fnpack 1.2.3 创建 Docker 模板并执行 `fnpack build`，本次观察到：

- `.fpk` 是 gzip 压缩的 tar 包。
- 外层包含 `app.tgz`、`cmd/`、`config/`、`wizard/`、`manifest` 和两个图标。
- `fnpack` 在打包后的 manifest 追加了 32 位十六进制 `checksum`。
- 未观察到签名文件或签名命令。

这些属于**工具观察，不是官方承诺的稳定内部格式**。应用代码不应自行解析或生成 `.fpk`，应持续使用官方 `fnpack`。

### 2. Docker Compose 应用模型

#### 2.1 注册方式

`config/resource` 用 `docker-project` 注册 Compose 项目：[F9][F14]

```json
{
  "docker-project": {
    "projects": [
      {
        "name": "myapp-stack",
        "path": "docker"
      }
    ]
  }
}
```

`path` 相对于包内 `app/`，指向包含 `docker-compose.yaml` 的目录。项目名应跨版本保持稳定。

fnOS 根据该资源负责 Docker 项目的启动和停止，因此 Docker 应用的 `cmd/main start|stop` 通常无需再次执行 Compose；`status` 仍需准确检查代表应用可用性的容器，返回 `0` 表示运行、`3` 表示未运行、`1` 表示失败。[F6][F14]

#### 2.2 镜像和 Compose

官方案例使用：

```yaml
services:
  web:
    image: nginx:alpine
    container_name: hello-docker-web
    restart: unless-stopped
    ports:
      - "${TRIM_SERVICE_PORT}:80"
    volumes:
      - "${TRIM_APPDEST}/docker/html:/usr/share/nginx/html:ro"
```

可以确认：

- Compose 可以使用 fnOS 注入的 `TRIM_*` 环境变量。
- 静态内容可以随 `.fpk` 放入 `app/docker/html`，安装后从 `TRIM_APPDEST` 只读挂载。
- 用户数据应显式挂载到 `TRIM_PKGVAR` 或声明的 data-share，而不是依赖容器可写层。
- 官方案例验收步骤包含“Docker 镜像是否能拉取”，说明本地 `.fpk` 默认不包含远端镜像。
- 官方 Docker 案例页面未规定 Docker Engine/Compose 的精确版本、受支持的全部 Compose 字段、构建器支持或网络驱动限制。官方 fnpack 1.2.3 模板带 `version: "3.8"`，但不能据此推导所有 Compose 3.8 能力都受应用中心支持。

#### 2.3 CPU 架构

- fnOS 文档面向主流 x86 和 ARM 设备。
- Manifest 使用粗粒度 `x86`、`arm`、`all`，不是 OCI 的 `linux/amd64`、`linux/arm64` 命名。
- fnpack 1.2.3 官方下载提供 Linux amd64 与 Linux arm64 工具，未提供 32 位工具。
- Docker 镜像需为目标设备提供匹配 manifest。计划同包覆盖两类设备时，宜发布 OCI 多架构镜像，并在 x86 与 ARM 真机分别测试。
- ARM 版 fnOS 的硬件兼容性范围、Docker 功能一致性和生产稳定性不能仅由 `platform=all` 保证。

#### 2.4 权限和存储

`config/privilege` 的 `run-as=package` 为普通 fnOS 应用进程创建专用包用户；官方明确指出，它**不负责指定容器内进程身份**。[F9][F14]

因此 Docker App 仍需单独处理：

- 镜像内运行用户和 UID/GID。
- 挂载路径的真实读写权限。
- 是否需要额外 Linux capabilities、设备或宿主机网络。
- 敏感配置的保存方式。

官方总原则是最小权限。普通应用应使用包用户，只有确实需要时才加入附加系统组或使用 root。当前公开 Docker 规范没有给容器特权模式、宿主机网络、Docker Socket、设备透传等能力的上架政策，应视为高风险未知项。

用户可见共享目录通过 `data-share` 声明。系统自动创建目录，使用 Windows ACL 模型，并向应用运行用户授予所需 ACL。应用可从 `TRIM_DATA_SHARE_PATHS` 获取路径。纯静态 Web 前端通常不需要申请用户文件目录权限。

### 3. 本地安装、包限制与真正离线能力

#### 3.1 已证实的本地安装流程

图形界面：[F4]

1. 使用 `fnpack build` 生成 `.fpk`。
2. 以管理员登录测试设备。
3. 打开应用中心的手动安装入口。
4. 选择 `.fpk` 并完成向导。

命令行：[F15]

```bash
appcenter-cli install-fpk myapp.fpk
appcenter-cli install-fpk myapp.fpk --env config.env
```

设备上的源码目录还可以用 `appcenter-cli install-local` 快速打包安装。CLI 还支持 `default-volume`、`list`、`start` 和 `stop`。

官方定位很明确：手动安装和 `install-fpk` 用于本地验证、重复测试或 CI；**不应作为正式公开分发渠道**。

#### 3.2 “离线”需要拆成两层

| 场景 | 结论 |
| --- | --- |
| 不经过公开应用中心，上传本地 `.fpk` 安装 | 官方支持。 |
| 安装时 NAS 可访问 Docker Registry 并拉取镜像 | 官方 Docker 案例支持。 |
| NAS 完全断网，`.fpk` 同时携带并导入镜像 | 公开规范未确认。 |
| 预先在 NAS 手动 `docker load`，再安装引用该 tag 的 `.fpk` | Docker 层面可能可行，但不是官方应用交付流程，升级、清理、审核均未知。 |
| 在生命周期脚本中对包内 tar 执行 `docker load` | 技术上可实验，官方未记录这种包结构或批准策略，不应在确认前作为正式方案。 |

若第一阶段“离线安装”仅指不经应用商店侧载，则不存在规范阻塞。若要求完全断网安装，必须先向飞牛确认镜像内嵌方式、包体上限、安装脚本权限和审核接受度。

#### 3.3 已知与未知限制

已知：

- 根图标必须存在：`ICON.PNG` 为 64 x 64，`ICON_256.PNG` 为 256 x 256。
- 图标格式为 PNG 或 JPG、sRGB、正方形画布，每个不超过 1024 KB。[F13]
- fnpack 会做必要文件和基础格式校验。[F15]

公开资料未给出：

- `.fpk` 总大小上限、单文件上限、上传超时。
- 压缩格式和包内部结构的兼容承诺。
- 内嵌 Docker 镜像规则和镜像大小上限。
- Registry 白名单、私有 Registry 凭据注入方式。
- 安装期间网络失败的标准重试策略。
- 容器 CPU、内存、PID、日志或磁盘配额。

### 4. 签名、审核和正式上架

#### 4.1 当前公开流程

截至 2026-07-20，官方“上架应用”页仍写明：[F5]

1. 先加入任意飞牛粉丝群。
2. 联系飞牛社区主理人。
3. 加入“应用中心开发者先锋交流群”。
4. 按工作人员指引提交应用信息、应用包和测试材料。
5. 开发者后台上线后，以后续平台流程为准。

公开要求的材料至少包括：

- fnpack 生成的最终 `.fpk`。
- 应用图标。
- 展示真实应用界面和核心流程的截图。
- 准确的 manifest 元数据、兼容范围和更新说明。
- 支持系统版本、硬件架构上的安装、运行、数据与权限测试结果。

#### 4.2 尚未公开的发布规则

- 开发者实名认证、组织认证和账号注册细则。
- Web 自助提交后台。
- 应用签名证书申请、私钥管理和签名命令。
- 是否由开发者签名、飞牛复签，或仅由应用中心校验 checksum。
- 完整审核清单、禁止内容、许可证要求、隐私政策模板。
- Docker 基础镜像、Registry、镜像漏洞和 SBOM 要求。
- 审核 SLA、灰度发布、回滚、下架和紧急更新机制。
- 收费、分成、地域、出口合规和用户支持规则。

官方 fnpack 和本地安装文档没有签名步骤；官方 fnpack 1.2.3 生成包中也未观察到签名文件。这只能说明**当前本地测试流程不要求开发者执行公开签名命令**，不能推导正式上架永远无需签名。

### 5. 升级、卸载与数据保留

#### 5.1 生命周期

fnOS 可调用：

| 脚本 | 时机 |
| --- | --- |
| `install_init`, `install_callback` | 应用文件应用前、后 |
| `upgrade_init`, `upgrade_callback` | 升级前、后 |
| `uninstall_init`, `uninstall_callback` | 卸载清理前、后 |
| `config_init`, `config_callback` | 配置应用前、后 |
| `main start|stop|status` | 运行控制 |

生命周期脚本应尽量幂等。升级脚本用于数据/配置迁移和兼容检查；运行中的应用可能在升级前停止，并在完成后重启。[F6]

#### 5.2 数据放置原则

- 随包发布、升级可替换的文件：`TRIM_APPDEST` (`target`)。
- 应用配置：`TRIM_PKGETC`。
- 需跨应用重启保存的运行数据：`TRIM_PKGVAR`。
- 应用用户数据：`TRIM_PKGHOME`。
- 用户需要从文件管理器访问的数据：`data-share` / `TRIM_DATA_SHARE_PATHS`。
- 临时数据：`TRIM_PKGTMP`。

Docker 容器的可写层不应被当作持久化存储。Compose 项目名、服务名和数据挂载目标应跨版本保持稳定。

#### 5.3 保留行为的公开边界

官方明确建议卸载逻辑尊重用户数据：如果允许用户选择保留或删除，可在 `wizard/uninstall` 收集选择，再由卸载脚本执行。[F6][F12]

但公开文档没有明确说明：

- 无卸载向导时 `etc`、`var`、`home`、data-share 默认删除还是保留。
- 升级时 `target` 的替换/合并细节，以及失败后的原子回滚。
- Docker 项目停止或卸载时是否删除命名 volume、网络和已拉取镜像。
- data-share 在卸载后的默认归属和再次安装行为。

所以不能只依赖系统默认。正式包应把“保留配置/删除全部数据”做成明确卸载选择，并在 x86/ARM 真机验证升级、降级失败、卸载保留、卸载清空、重新安装五条路径。对于无需本地业务数据的 HAPI Web 静态前端，应尽量保持无状态，缩小这部分风险。

### 6. 端口、应用入口和统一网关

#### 6.1 三种访问模型

| 模型 | 路径/地址 | 登录态 | WebSocket / 流式 | 适用性 |
| --- | --- | --- | --- | --- |
| 独立端口 | `http(s)://NAS:{service_port}/...` | 与 NAS 登录态无关 | 由应用自己支持 | 简单、直接，但端口冲突、HTTPS、远程暴露需自行处理。 |
| `index.cgi` | `/cgi/ThirdParty/{appname}/index.cgi/` | 调用前校验 NAS 用户会话 | 不支持 WebSocket；官方不建议用于流式、长请求、高流量 API | 轻量静态页面。 |
| 统一网关 | `/app/{appname}` 或其自定义子路径 | 转发前校验会话，并注入用户 Header | 明确支持 WebSocket；流式细节未量化 | 常驻服务、API、系统域名和 FN Connect 候选方案。 |

端口入口的 `service_port`、Compose 端口映射、UI `port` 必须一致。`checkport=true` 可在启动前检查冲突。安装向导也可以收集端口，但仍需校验范围与冲突。[F7][F10][F12][F14]

#### 6.2 统一网关机制

UI 配置示例：[F11][F14]

```json
{
  ".url": {
    "myapp.main": {
      "title": "My App",
      "icon": "images/icon_{0}.png",
      "type": "iframe",
      "protocol": "",
      "gatewayPrefix": "/app/myapp",
      "gatewaySocket": "app.sock",
      "url": "/app/myapp",
      "allUsers": true
    }
  }
}
```

核心约束：

- `gatewayPrefix` 使用 `/app/{appname}` 或 `/app/{appname}/{customPath}`，路径需稳定、URL 安全，公开路径避免点号。
- `gatewaySocket` 只写文件名。Socket 位于安装后的 `target`，例如 `/var/apps/myapp/target/app.sock`。
- 网关模式忽略 UI 配置中的 `protocol` 和 `port`。
- HTTP 与 WebSocket 路由都必须保持在声明的前缀下。
- Docker 容器需挂载 `${TRIM_APPDEST}`，并在挂载目录内创建 Unix Socket。
- 网关在转发前校验 NAS 会话，并注入 `X-Trim-Userid`、`X-Trim-Isadmin`、`X-Trim-Username`。应用仍负责业务授权。

WebSocket 可使用同一 Socket 和稳定子路径，例如 `/app/myapp/ws`。握手时获得相同用户上下文，服务端应把连接绑定到可信 Header，而不是信任消息内的用户 ID。

#### 6.3 SSE 边界

官方 `index.cgi` 文档明确说 CGI 不适合“流式响应”，应改用独立端口或统一网关。因此统一网关是 SSE 的合理候选路径。[F10]

然而官方统一网关文档只明确点名 WebSocket，没有公布：

- `text/event-stream` 是否关闭代理缓冲。
- 空闲超时、最大连接时长和并发连接数。
- 心跳间隔要求。
- FN Connect 直连与中继模式下的差异。
- HTTP/1.1、HTTP/2 转换行为以及断线重连 Header 保留情况。

结论：SSE 必须做真机抓包和长时间测试，不能仅根据“支持流式响应”做发布承诺。

### 7. FN Connect 对第三方 Web 应用的能力边界

#### 7.1 官方明确能力

FN Connect 是飞牛自研远程访问服务：[F17][F18]

- 为设备分配唯一 FN ID 和访问子域名。
- 为该唯一子域名提供 SSL 证书，可通过 HTTPS 安全访问 NAS。
- 根据网络环境在局域网、公网直连、P2P 和中继之间选择连接方式。
- 浏览器在可公网直连时可选择直连；官方帮助页把 P2P 自动切换明确描述为飞牛 App 能力。
- 只有使用中继转发时计入 FN Connect 流量；中继存在带宽/流量权益和实际 NAS 上行带宽限制。

#### 7.2 与第三方应用结合的推断

用户指定的目标是：在 iOS 飞牛 App 中通过 FN Connect 打开 NAS 上安装的 HAPI Web App。这是待实现和验收的目标拓扑，不等同于已经完成实测。公开文档仍未给出第三方 App 的完整 URL/协议支持矩阵，因此基础页面可达性和以下细节都需实机确认。

官方统一网关定义的是“飞牛 fnOS 访问域名下的稳定系统 URL”；FN Connect 提供的正是可访问 NAS 的带 SSL 域名。因此可作以下推断：

1. 经 `/app/{appname}` 注册的应用路径，理论上可复用 FN Connect 域名与 HTTPS。
2. WebSocket 使用当前页面的 `wss://{host}/app/{appname}/ws`，理论上可沿同一网关转发。
3. 相比 `http://NAS:port`，统一网关避免浏览器从 HTTPS 页面访问 HTTP 端口造成的混合内容问题。

其中“统一网关路径是否原样经 FN Connect 暴露”以及长连接边界仍是**高可信推断**。公开资料没有给第三方应用的 SSE、Socket.IO、上传大小和中继超时支持矩阵。

#### 7.3 不能据文档假定的能力

- FN Connect 会转发任意宿主机 TCP/HTTP 端口。
- 可以为第三方端口配置独立子域名、路径映射或自定义域名。
- 独立端口入口会自动获得 FN Connect SSL 终止。
- WebSocket、SSE、文件上传/下载在中继下没有额外超时或大小限制。
- FN Connect 会把外部 HTTPS 请求代理到应用声明的 `protocol=http` 端口。
- 第三方应用可以绕过 NAS 登录态公开匿名路径。统一网关默认会做会话校验；公开 OAuth 回调等能力的具体配置未完整公开。

因此 HAPI Web 的 fnOS 包不应把裸端口作为 FN Connect 远程访问的唯一设计。在独立 HTTPS origin 未经真机证实前，应把统一网关作为 **fnOS 侧集成** 的官方能力基线；统一网关经 FN Connect 可达仍是 P0 验证项。局域网端口只作为诊断或备选入口，是否保留需结合安全评估。

### 8. fnOS 包装层初步方案

下面只描述不随最终网络拓扑变化的 fnOS 包装层。HAPI 访问路径和反向代理选择见第 11 节。

1. 用 `fnpack create hapi --template docker` 作为包骨架。
2. 把 HAPI Web 的生产静态产物放入 `.fpk` 的 `app/docker/html`，随包升级。
3. Compose 启动一个最小 Web/Proxy 容器：静态目录只读挂载，并把 API、SSE、Socket.IO 和语音 WebSocket 转发到固定的 Ubuntu Hub LAN 地址；容器本身不保存业务数据。
4. `config/resource` 只声明一个稳定名称的 `docker-project`，不申请 data-share 或用户目录授权。
5. 安装/配置向导收集 Ubuntu Hub 的 LAN URL，例如 `http://192.168.1.20:3006`；只允许管理员配置，校验 scheme/host/port，并把结果写入 `TRIM_PKGETC`。该地址只供容器代理使用，不下发为浏览器 Hub URL。
6. 若使用统一网关，让容器内服务监听挂载到 `${TRIM_APPDEST}` 的 Unix Socket，UI 入口注册稳定的 `/app/hapi` 路径；HAPI Web 必须先完成第 10.4 节所列前缀适配。
7. 若 FN Connect 实测为端口应用提供独立根路径 HTTPS 入口，可使用 `service_port` 形态，保留 HAPI 根路径并减少前缀改造；该能力仍需确认真实 URL 和长连接行为。
8. `cmd/main status` 检查 Web/Proxy 服务本身；Hub 可达性作为独立诊断，不应因 Ubuntu Hub 临时离线而让 fnOS 无限重启容器。
9. `manifest` 初期只声明已实测的 fnOS 版本和 CPU 架构；多架构发布前准备 amd64/arm64 镜像。
10. 本地测试版直接手动安装 `.fpk`。正式分发则走开发者先锋群的当前人工流程，不公开传播侧载包作为商店替代。

若必须完全断网安装，第 3 步还需要解决镜像随包交付；这是当前最大 fnOS 平台未知项，需先获得飞牛书面确认或完成可回滚的真机实验。

### 9. 实施前必须关闭的未知项

| 优先级 | 问题 | 建议确认方式 |
| --- | --- | --- |
| P0 | 统一网关第三方应用能否稳定经 FN Connect 访问 | x86 真机启用 FN Connect，测试 HTTPS、子路径、刷新、静态资源和登录态。 |
| P0 | WebSocket 与 SSE 在 FN Connect 直连/中继下的超时、缓冲和重连行为 | 分别强制/构造直连与中继网络，持续连接、断网恢复、抓包。 |
| P0 | 完全断网安装时官方认可的镜像携带/导入方式 | 向开发者先锋群确认；同时询问 `.fpk` 包体与镜像大小限制。 |
| P0 | 当前 HAPI Web 不支持统一网关子路径 | 已定位根路径假设；按第 10.4 节改造并增加子路径端到端测试。 |
| P0 | 远程 iOS WebView 如何使用 Ubuntu 私网 Hub | 已确定采用 fnOS 容器同源反向代理；浏览器不能填写或直接访问 Ubuntu LAN URL。 |
| P1 | 统一网关最低 fnOS 版本及 ARM 支持一致性 | 国内版官方案例使用 `1.1.3100`；仍需向飞牛确认目标版本/架构并填写真实 `os_min_version`。 |
| P1 | 升级和卸载时 bind mount、命名 volume、镜像及 `var/home/share` 的默认清理规则 | 安装两版本包，覆盖升级、失败回滚、保留卸载、清空卸载和重装。 |
| P1 | 应用中心审核对镜像来源、root、容器 capabilities、许可证、隐私声明和 SBOM 的要求 | 提交前向工作人员获取当前审核清单。 |
| P1 | 正式上架签名、开发者身份、发布和回滚流程 | 开发者后台上线前后重新复核官方流程。 |
| P2 | Compose 版本、healthcheck、资源限制、日志轮转和私有 Registry 支持 | 用最小兼容 Compose，并在目标系统验证后才增加高级字段。 |

## HAPI Web 与 Hub 分离部署分析

### 10.1 分离部署是正式支持能力

HAPI Web 构建结果是纯静态 `web/dist`。HAPI 的 Web README 和 Hub README 都明确说明，静态资源可以放在 GitHub Pages、Cloudflare Pages 等独立站点，用户再从登录页选择 Hub。[H1]

浏览器和 Hub 的真实数据链路如下：

```text
浏览器 ──加载静态文件──> HAPI Web 托管点
浏览器 ──REST─────────> Hub /api/*
浏览器 ──SSE──────────> Hub /api/events
浏览器 ──Socket.IO────> Hub /socket.io/，namespace=/terminal
Hub    ──Socket.IO────> CLI，namespace=/cli
```

因此：

- Web 所在容器只负责静态文件时，容器不会参与之后的 API 请求。
- 浏览器必须自己能到达 Hub，或者 Web 容器必须显式提供反向代理。
- Hub 和 CLI/RPC 的关系不因 Web 移到 NAS 而改变；Web 不直接连接 CLI。

本项目选择第二条路径，目标数据流必须是：

```text
iOS 飞牛 App 内的 HAPI WebView
  -> 同源 /api、/socket.io 请求
  -> FN Connect
  -> fnOS HAPI Web/Proxy 容器
  -> 局域网 http(s)://<ubuntu-hub-ip>:3006
  -> Ubuntu HAPI Hub
```

只有最后一段由 fnOS 容器访问 Ubuntu LAN 地址。iOS WebView 永远不应获得或直接请求该 LAN 地址。

### 10.2 Web 如何选择 Hub

当前运行时优先级是：[H2]

1. URL 查询参数 `?hub=https://hub.example.com`。
2. `localStorage.hapi_hub_url`。
3. 静态页面自身的 `window.location.origin`。

登录页也提供 Hub 选择器。这里有两个重要边界：

- Hub URL 必须是 `http://` 或 `https://`。
- `normalizeServerUrl()` 返回 `parsed.origin`，会丢弃输入 URL 的 pathname。即 `https://example.com/hapi-hub` 最终只保留 `https://example.com`。

REST 客户端又以绝对 `/api/...` 构造 URL，SSE 固定 `/api/events`，终端 Socket.IO 固定 `/socket.io/`。所以当前支持的是“独立 Hub origin”，不是“某个 origin 下的 Hub 子路径”。[H2][H3]

对本项目的含义：

- fnOS 版本应默认使用页面自身 origin，不在浏览器端设置 Ubuntu Hub LAN URL。
- Ubuntu Hub 地址属于容器服务端配置，由反向代理读取。
- 登录页 Hub 选择器可保留为诊断能力，也可在 fnOS 发行构建中隐藏/锁定；不能引导远程用户填写 `http://192.168.x.x:3006`。

`VITE_HUB_PROXY` 只服务 Vite 开发服务器，不能解决 fnOS 生产部署。生产环境应由容器启动配置生成反向代理上游，前端继续使用页面自身 origin；不需要把 Ubuntu Hub 地址编译进 Web。[H4]

### 10.3 鉴权、CORS 和 Hub 监听

浏览器登录流程：[H5][H6]

1. 用户输入 `CLI_API_TOKEN[:namespace]`。
2. Web 把这个长期共享密钥按 Hub URL 存入 `localStorage`。
3. Web 调用 `POST /api/auth`，换取有效期 4 小时的 JWT。
4. REST 使用 `Authorization: Bearer <JWT>`。
5. SSE 因原生 `EventSource` 不能设置 Header，把 JWT 放在 `?token=` 查询参数。
6. 终端 Socket.IO 把 JWT 放在握手 auth 中。

Hub 不依赖 Cookie，因此跨源部署的主要门槛是 CORS，而不是 Cookie SameSite：

- HTTP API 允许配置的 origin、必要方法、`authorization` 和 `content-type`。
- Socket.IO 有独立的 Origin 精确匹配检查。
- `CORS_ORIGINS` 支持逗号分隔的精确 origin 或全局 `*`，不支持子域名通配模式。
- 不建议为省事使用 `*`；HAPI 能控制终端、代码和文件，应配置明确的本地与 FN Connect origin。

本项目对 iOS WebView 是同源访问，浏览器层不需要跨源 CORS；但反向代理通常会把外部 `Origin` 原样转发给 Ubuntu Hub，Socket.IO 服务端仍会执行 Origin 检查。因此应把实际 FN Connect origin 和本地 fnOS 应用 origin 加入 Ubuntu Hub 的 `CORS_ORIGINS`。由可信代理删除/改写 Origin 也能工作，但会弱化 Hub 自身的来源保护，不作为首选。

Hub 默认只监听 `127.0.0.1:3006`。Docker 容器中的 `127.0.0.1` 是容器自身，不是 NAS 宿主系统，也不是另一台开发机。容器需要访问 Hub 时，必须让 Hub 绑定明确的局域网地址或 `0.0.0.0`，并用主机防火墙只允许 NAS 地址访问。[H6]

### 10.4 fnOS 子路径不是只改 Vite base

HAPI README 写有子路径构建说明，Vite 配置也会把静态资源、PWA `scope` 和 `start_url` 生成到指定 base；但当前完整应用仍不具备子路径运行能力。[H1][H4]

已定位的问题：

| 部分 | 当前行为 | `/app/hapi` 所需行为 |
| --- | --- | --- |
| TanStack Router | `createRouter()` 未设置 `basepath` | 从公开应用前缀剥离 `/app/hapi` 后匹配 `/sessions` 等路由。 |
| REST | 绝对 `/api/*` | 同源代理时请求 `/app/hapi/api/*`；跨源直连时仍可请求 Hub `/api/*`。 |
| SSE | 绝对 `/api/events` | 支持带 pathname 的 Hub/proxy base。 |
| Socket.IO | 固定 `path=/socket.io/` | 支持 `/app/hapi/socket.io/`，再由代理改写到 Hub 根路径。 |
| 语音 WebSocket | Hub 生成根路径 `/api/voice/*-ws`；Qwen 前端也有页面 origin 根路径 fallback | 生成并使用公开前缀下的 `wss` 路径。 |
| PWA/推送 | 部分 scope 已跟随 base，但通知图标和 Hub 生成的 `/sessions/:id` 深链仍是根路径 | 所有图标、通知点击、分享入口和 SPA fallback 保持在 scope 内。 |
| API 缓存 | Service Worker 匹配根路径认证 API，缓存名未按 Hub/namespace 隔离 | fnOS 版建议不缓存认证 API，只保留离线 shell。 |

本次做了只读构建验证：

```text
VITE_BASE_URL=/app/hapi/ bun run build:web
```

生成物的资源地址、manifest scope 和 start URL 都正确落在 `/app/hapi/`。将生成物按该前缀提供，并用最小假 Hub 完成认证后，Playwright 访问结果为 `Not Found`；原因是 Router 仍用完整 pathname `/app/hapi` 匹配根路由。登录页在认证前能显示，不能证明业务路由可用。

结论：统一网关版本需要系统性引入“公开应用 base”和“Hub/API base”，不能只改 Nginx 或 Vite 参数。

### 10.5 Web/Hub 版本兼容

Hub 的 `/health` 返回 `protocolVersion`，CLI 会检查协议版本；Web 目前只在 About 页面展示自己编译时的版本，没有主动比较 Hub `/health`。[H8]

fnOS Web 包与宿主机 Hub 会独立升级。仓库共享类型和协议可能同步变化，因此需要：

- 每个 fnOS 包版本记录对应的 HAPI commit/tag 和协议版本。
- 上线前至少测试同版本 Web/Hub，以及 Web 前一版对 Hub 新版的失败表现。
- 发现协议不匹配时明确阻止或提示升级，不能让用户在部分功能静默失败后才定位。

## 11. 目标双机拓扑与接入形态

### 11.1 唯一主方案

本项目不要求 Ubuntu Hub 公网可达。完整链路固定为：

```text
iPhone 飞牛 App / FN Connect
  -> fnOS 服务器 B
  -> HAPI Web/Proxy Docker 容器
       ├─ 返回 HAPI web/dist
       ├─ 代理 REST /api/*
       ├─ 代理 SSE /api/events
       ├─ 代理 Socket.IO /socket.io/*
       └─ 代理语音 WebSocket /api/voice/*-ws
  -> 同一局域网
  -> Ubuntu 服务器 A:3006
  -> HAPI Hub
```

职责边界：

| 组件 | 职责 | 不负责 |
| --- | --- | --- |
| iOS 飞牛 App / FN Connect | 把用户带到 fnOS 上的 HAPI App | 不直接访问 Ubuntu Hub，不代理整个家庭/办公 LAN。 |
| fnOS HAPI 容器 | 静态 Web、SPA fallback、反向代理、缓存和连接超时控制 | 不运行 Hub，不保存 Hub SQLite，不持有用户的 `CLI_API_TOKEN`。 |
| Ubuntu Hub | HAPI 鉴权、状态、SSE、Socket.IO、RPC 网关 | 不对公网暴露，不提供 fnOS App 静态页面。 |
| HAPI CLI/Runner | 连接 Ubuntu Hub，运行 Agent 和 RPC | 不连接 fnOS Web 容器。 |

所以“Web 连接 Hub”的准确含义是：**iOS WebView 对公开应用地址发同源请求，fnOS 容器再以服务端身份通过 LAN 连接 Ubuntu Hub。**

### 11.2 关键平台决策：FN Connect 给 App 什么 URL

主拓扑不变。先确认 FN Connect 能否到达第三方 App；能够到达后，实际入口形态决定 HAPI 改造量：

| 入口形态 | 浏览器看到的路径 | HAPI 改造量 | 平台证据 |
| --- | --- | --- | --- |
| 应用独立根路径 origin | `https://<app-origin>/` | 低到中；现有 `/api`、`/socket.io` 可保持 | 官方公开文档未明确承诺，需真机确认。 |
| fnOS 统一网关 | `https://<fn-domain>/app/hapi/` | 中到高；Web、API、SSE、Socket.IO、PWA 都要前缀感知 | `/app/{appname}`、Unix Socket 和 WebSocket 已有官方文档。 |

这不是“是否做反向代理”的选择。两种入口都必须由 fnOS 容器代理 Ubuntu Hub；区别只在公开路径是根路径还是 `/app/hapi`。

### 11.3 根路径入口形态

若 iOS 飞牛 App/FN Connect 实测能把应用端口映射为稳定、独立的 HTTPS origin：

```text
https://<app-origin>/                -> web/dist/index.html
https://<app-origin>/sessions/...    -> SPA index.html
https://<app-origin>/api/...         -> http://<ubuntu-hub-lan>:3006/api/...
https://<app-origin>/socket.io/...   -> http://<ubuntu-hub-lan>:3006/socket.io/...
```

优点：

- HAPI 当前根路径假设基本保留。
- 独立 origin 隔离 HAPI 的 `localStorage`、Cache Storage 和 Service Worker。
- 浏览器只有一个 HTTPS origin；Ubuntu Hub 保持私网。

仍需验证：

- FN Connect 下的真实 URL、证书、重装后稳定性和是否确实为独立 origin。
- SSE、Socket.IO polling/upgrade、语音 WebSocket 和 50 MiB 请求在中继模式下是否完整转发。
- 应用入口 `type=url` 与 `type=iframe` 的实际行为。HAPI 需要通知、PWA、剪贴板和麦克风时，`type=url` 更稳妥。

### 11.4 统一网关路径形态

若 FN Connect 通过 fnOS 系统域名的 `/app/hapi` 打开第三方应用：

```text
https://<fn-domain>/app/hapi/                  -> HAPI SPA
https://<fn-domain>/app/hapi/sessions/...      -> SPA index.html
https://<fn-domain>/app/hapi/api/...           -> Ubuntu Hub /api/...
https://<fn-domain>/app/hapi/socket.io/...     -> Ubuntu Hub /socket.io/...
```

请求先经 FN Connect 和 fnOS 统一网关，再通过 Unix Socket 到 Web/Proxy 容器。该形态需要：

1. HAPI Web 全面支持 `/app/hapi` Router basepath。
2. Web 的同源 API base 保留 pathname，不再被归一化为 origin。
3. 容器把公开前缀改写为 Ubuntu Hub 的根路径。
4. PWA scope、图标、分享入口、推送深链和 SPA fallback 都不能逃逸到 fnOS 根路径。
5. 语音回连 URL 改为前缀感知。当前 Hub 会把 `HAPI_PUBLIC_URL` 的 pathname 强制替换成根路径 `/api/voice/...`，必须同步修正。[H7]

统一网关额外带来共享 origin 风险，见第 12.2 节。

### 11.5 Web/Proxy 容器的共同代理契约

无论入口形态是哪一种，代理都需要满足：

1. 上游只允许管理员配置的固定 Ubuntu Hub LAN URL；不能从浏览器参数动态选择任意目标，避免成为 SSRF/开放代理。
2. `/api/events` 关闭响应缓冲，读取超时覆盖长连接；Hub 每 30 秒心跳，Web 90 秒无活动才判定失联。
3. `/socket.io/` 同时支持 HTTP polling 和 WebSocket Upgrade。
4. `/api/voice/gemini-ws`、`/api/voice/qwen-ws` 支持 WebSocket Upgrade。
5. 请求体上限至少覆盖 Hub 的 68 MiB；HAPI 单文件业务限制为 50 MiB。
6. 不记录 SSE/语音 URL 中完整的 `token=` 查询参数。
7. 哈希静态资源可长期缓存；`index.html`、`sw.js` 和 manifest 不长期缓存。
8. Web 服务健康与 Ubuntu Hub 可达分开。Hub 临时离线只显示连接错误，不触发 fnOS 无限重启容器。
9. 保留 HAPI 自身 JWT/namespace 鉴权。FN Connect/fnOS 登录态只保护入口，不能直接映射为 HAPI 权限。

### 11.6 Ubuntu Hub 的 LAN 配置

- `HAPI_LISTEN_HOST` 绑定 Ubuntu 的 LAN 地址或 `0.0.0.0`，不能保持默认 `127.0.0.1`。
- Ubuntu 防火墙只允许 fnOS 服务器 B 的固定 IP 访问 Hub 端口；其他 LAN 主机默认拒绝。
- `CORS_ORIGINS` 加入实际 FN Connect origin 和本地 fnOS App origin，以通过 Hub 的 Socket.IO Origin 检查。
- 若 LAN 不完全可信，fnOS 到 Ubuntu 使用内网 TLS；最低限度也要有网段隔离和防火墙。
- Hub 的 `HAPI_HOME`、SQLite 和备份仍完全留在 Ubuntu 服务器 A。

### 11.7 明确排除的错误链路

不能把 Ubuntu LAN URL 放进 HAPI 登录页，让 iOS WebView 直接请求：

```text
iPhone -> FN Connect -> 加载 Web
iPhone -> http://192.168.x.x:3006 -> Hub   # 错误
```

公网 iPhone 没有到该 LAN 地址的路由；若页面是 HTTPS，还会触发 Mixed Content。正确链路始终是 `iPhone -> FN Connect -> fnOS Proxy -> LAN Hub`。

让 Hub 另行使用 HAPI Relay/Cloudflare Tunnel 暴露公网可以作为故障排查或退路，但不属于本项目主设计，也没有必要作为首版前提。

## 12. 安全、合规与运维问题

### 12.1 HAPI 权限级别

HAPI 不只是只读仪表盘。它可以发送 Agent 消息、审批权限、操作终端、读取工作区文件、执行 Git/文件操作和远程启动会话。fnOS 包应按高权限管理工具处理：

- 默认入口仅管理员可见，建议 `allUsers=false` 且入口权限只读。
- 不因统一网关已校验 NAS 登录就跳过 HAPI JWT/namespace 鉴权。
- 不在安装向导、Compose、静态配置或应用日志保存 `CLI_API_TOKEN`。
- Hub 端口不对整个 LAN 或公网无差别开放。

### 12.2 统一网关共享 Origin 风险

统一网关把第三方应用放在 fnOS 系统 origin 的不同 pathname 下。浏览器同源隔离不区分 pathname，因此同 origin 的其他脚本理论上可以访问 HAPI 的 `localStorage` 和 Cache Storage。

当前 HAPI 会持久化长期 `CLI_API_TOKEN`，Service Worker 还会缓存部分已认证 API 响应。[H4][H6] 对统一网关版至少需要：

- 不持久化原始 `CLI_API_TOKEN`；优先改为内存短会话、重新登录，或设计服务端配对凭据。
- fnOS 构建禁用 sessions/machines 等认证 API 的离线缓存，只缓存静态 shell。
- Service Worker scope 严格限定 `/app/hapi/`。
- 验证 fnOS 桌面父页面、其他网关应用及 iframe sandbox 是否能访问应用存储。

如果 FN Connect 的根路径入口能提供独立 origin，应优先使用它解决这类隔离问题。

### 12.3 fnOS 到 Ubuntu Hub 的传输

若 fnOS 代理到 Ubuntu Hub 使用明文 HTTP，登录时原始 `CLI_API_TOKEN` 会经过局域网。最低要求是可信隔离网络、Ubuntu 防火墙只放行 fnOS 主机；更稳妥的是内网 TLS。

fnOS 容器的上游必须是 Ubuntu 服务器的稳定 LAN IP 或内网 DNS 名，不能使用 `localhost`。需要验证两台主机之间的 VLAN、路由、防火墙、DNS 和 Ubuntu 休眠/重启后的地址稳定性。FN Connect 只负责 iPhone 到 fnOS 的第一段，不参与 fnOS 到 Ubuntu 的这段 LAN 通信。

### 12.4 日志和秘密

- SSE JWT 位于查询参数，语音 WebSocket JWT 也位于查询参数。fnOS 网关、容器代理和 Hub 日志都应隐藏 query string 或对 `token` 脱敏。
- 用户通过 URL `?token=` 登录时，Web 只有认证成功后才清理参数；不应把这种 URL用于安装入口或分享。
- 上游 Hub 地址可以存于 `TRIM_PKGETC`，但 HAPI token 不应由应用包统一保存。
- 容器镜像固定版本/摘要，保留 SBOM 和漏洞扫描结果；正式审核是否强制要求尚未公开。

### 12.5 AGPL-3.0-only

仓库及 `hapi-web` 使用 AGPL-3.0-only。[H9] 分发 `.fpk`/容器对象码时，需要一并履行许可证和对应源代码提供义务；若修改 HAPI，网络用户还需能方便取得该版本的 Corresponding Source。

发布准备至少应包括：

- `.fpk` 内保留 LICENSE 和必要 notices。
- 应用 About/说明页提供准确的源代码链接，指向与发布二进制一致的 tag/commit。
- 公开 fnOS 适配修改、构建脚本、Dockerfile/Compose 和生成该对象码所需脚本。
- 标明修改者和修改日期，并复核第三方前端依赖许可证。

这部分是工程合规提示，不替代正式法律意见。应用中心当前也未公开许可证审核清单，应在提交前向工作人员确认。

### 12.6 性能与用户体验

- 本次子路径构建的 `web/dist` 约 8.34 MiB，PWA 预缓存约 8.5 MiB。2026-07-20 的 FN Connect 基础版页面展示带宽为 2-4 Mbps；该商业参数主要影响中继且可能变化，按此估算首次缓存可能需要数十秒，未计协议开销。[F18]
- 50 MiB 文件上传、生成图片、终端交互和语音对中继时延/流量更敏感。
- FN Connect 会择优直连/P2P/中继，局域网测试成功不能代表中继成功；验收必须构造中继场景。
- `iframe` 入口下的通知、PWA 安装、剪贴板和麦克风能力可能受浏览器权限策略影响，优先测试 `type=url`。
- FN Connect 地址与本地 fnOS 应用地址属于不同浏览器 origin 时，会产生不同的存储分区，用户可能需要分别登录。

## 13. 综合风险矩阵

| 等级 | 风险 | 影响 | 处理 |
| --- | --- | --- | --- |
| 阻断 | FN Connect 是否稳定转发第三方统一网关/端口应用未获官方完整承诺 | 最终远程入口可能不可用 | 真机分别验证直连与中继；向开发者先锋群书面确认。 |
| 阻断 | 当前 HAPI 业务路由和实时连接不支持 `/app/hapi` | 认证后 Not Found，API/终端路径错误 | 做统一前缀抽象和端到端测试，不能只配置 Vite base。 |
| 阻断 | fnOS App 只部署静态 Web，遗漏 Hub 反向代理 | Web 能打开但远程无法登录/收消息 | 把同源代理列为包的必需组件，浏览器不接触 Ubuntu LAN URL。 |
| 高 | 统一网关共享 origin 暴露长期 token/认证缓存 | Hub 高权限凭据或会话数据泄漏 | 不持久化 seed token、禁用认证 API 缓存；优先独立 origin。 |
| 高 | Hub 从 loopback 改为 LAN 监听扩大攻击面 | 局域网任意主机可尝试访问 | 绑定指定地址、防火墙仅放行 NAS、保留强 token、优先 TLS。 |
| 高 | Web 与 Hub 独立升级产生协议漂移 | 部分功能静默失败 | 发布矩阵、协议握手、明确阻断提示、同版本验证。 |
| 高 | SSE/Socket.IO/语音 WS 经过两层代理 | 实时消息、终端或语音间歇断开 | 关闭缓冲、Upgrade、长超时、心跳和断线恢复实测。 |
| 高 | fnOS 包分发不满足 AGPL | 无法合规发布 | 同步发布对应源码、许可证、修改说明和构建脚本。 |
| 中 | 本地 `.fpk` 仍需在线拉镜像 | 用户理解的“离线安装”失败 | 明确术语；完全断网能力先向飞牛确认。 |
| 中 | 镜像或 FPK 只支持单架构 | ARM/x86 某一类设备无法启动 | 发布 OCI amd64/arm64，多架构真机验收。 |
| 中 | FN Connect 中继带宽、流量、上传上限未知 | 首屏慢、大文件失败、成本增加 | 减少预缓存，测 1/50 MiB 上传与实际弱网。 |
| 中 | fnOS iframe 权限策略 | PWA、通知、麦克风功能缺失 | 优先 `type=url`，iframe 作为兼容入口测试。 |
| 中 | 应用中心签名、镜像、安全审核规则未公开 | 正式上架周期不可预测 | 侧载阶段即联系开发者先锋群，提前拿当期清单。 |
| 低 | Web 容器随 Hub 离线反复重启 | 无意义重启和糟糕诊断 | Web 健康与 Hub 可达分离；UI 显示 Hub 离线。 |

## 14. 建议推进顺序与验收门

这不是实施计划，只是后续进入开发前的决策顺序。

### Gate 0：fnOS/FN Connect 最小网络探针

先做不含 HAPI 业务的最小 Docker App，验证：

1. 端口入口是否获得独立、稳定的 FN Connect HTTPS origin。
2. 统一网关 `/app/test` 是否可经 FN Connect 打开。
3. 两种入口在强制中继条件下的 SSE、WebSocket、50 MiB 请求和深链刷新。
4. `type=url` 与 `type=iframe` 的 PWA、通知和麦克风能力。

若根路径入口全部通过，采用根路径代理形态；否则采用官方统一网关前缀形态。若两种形态在 FN Connect 中继下都无法稳定转发长连接，则该目标 No-Go，需要与飞牛确认平台支持后再继续。

### Gate 1：HAPI Web 子路径/代理能力

统一网关前缀形态必须先通过：

- `/app/hapi/` 登录、会话列表与 `/app/hapi/sessions/:id` 直接刷新。
- REST 全功能、两条 SSE、终端 polling -> WebSocket upgrade。
- Gemini/Qwen 语音 WebSocket 回连 URL包含正确前缀。
- PWA scope、更新、通知深链、分享入口均不逃逸到站点根路径。
- 登录切换 namespace 后无旧认证 API 缓存串读。

### Gate 2：真实 Hub 网络与安全

- 固定按“fnOS 服务器 B -> Ubuntu Hub 服务器 A”拓扑验证容器到 Hub 的路由、DNS、超时和重连。
- Hub 停止、重启、升级不匹配时，Web 保持可打开并给出可操作错误。
- 防火墙证明除 NAS 外无法访问 Hub LAN 端口。
- 代理和网关日志确认不落完整 JWT/CLI token。
- 普通 NAS 用户不能打开管理员 HAPI 入口。

### Gate 3：包生命周期与发布

- amd64、arm64 的安装、启动、停止、升级、卸载保留/清空和重装。
- 在线拉镜像失败时的错误与重试；如要求完全断网，先取得官方认可方案。
- 对应源码、LICENSE、修改说明、SBOM、隐私/数据流说明齐备。
- 向飞牛取得当前审核、签名、镜像来源、回滚和 SLA 要求，再决定提交应用中心。

### 最终建议

1. **短期侧载验证**：可以开始，固定使用“fnOS Web/Proxy 容器 -> LAN -> Ubuntu Hub”，优先验证 FN Connect 应用入口形态和代理长连接，不承诺完全断网或正式分发。
2. **根路径入口可用时**：保留 HAPI 现有根路径，以最小改造完成静态 Web + 同源 Hub 代理。
3. **只有统一网关可用时**：完成 `/app/hapi` 前缀感知改造，再由同一容器代理私网 Ubuntu Hub。
4. **Ubuntu Hub 始终保持私网**：无需 HAPI Relay、Cloudflare Tunnel 或额外公网端口；这些不属于本项目方案。
5. **上架决策**：在 Gate 0-3 全部关闭前保持 Conditional Go，不应直接制作公开发布承诺。
