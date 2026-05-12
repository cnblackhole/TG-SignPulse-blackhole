# TG-SignPulse

> Telegram 多账号自动签到、消息动作编排与关键词监听面板。

[English README](README_EN.md) · [健康检查](#健康检查) · [更新日志](#更新日志)

TG-SignPulse 是一个 Telegram 自动化管理面板。你可以在网页里管理多个账号，配置自动签到任务，并让任务按固定规则每天自动执行。

> AI 驱动：项目已集成 AI 能力（识图、计算题），可直接用于自动任务流程。

## 这个项目是做什么的？

- 统一管理多个 Telegram 账号
- 自动签到、定时发送消息、点击按钮
- 支持 AI 识图和 AI 计算题动作
- 在网页中查看任务执行日志和历史结果
- 支持指定 Telegram 群组话题运行签到
- 支持任务剪贴板批量导入导出、全局代理、失败通知和关键词监听
- 适合 VPS 长期运行

## 项目亮点

- 多账号管理：一个面板管理多个账号
- 动作序列：支持「发送文本 / 点击文字按钮 / 发送骰子 / AI识图 / AI计算 / 关键词监听」
- 话题签到：支持在 Telegram Forum 群组的指定 Thread/Topic 内执行
- 任务迁移：可将当前账号下全部任务导出到剪贴板，也可一键粘贴导入并自动跳过重复任务
- 通知与状态：支持 Telegram机器人通知、关键词命中通知，以及任务执行前账号失效检测
- 日志可视化：可直接查看每次执行的流程日志和最后机器人回复
- 稳定性优化：并发控制、429/超时场景优化、长期运行内存优化
- 容器化部署：Docker / Docker Compose 开箱即用

## 功能概览

| 模块 | 能力 |
| --- | --- |
| 账号管理 | 多账号登录、代理配置、状态检测、重新登录 |
| 任务编排 | 定时/随机时间段执行，支持动作序列和动作间隔 |
| 话题支持 | 群组 `Thread ID` 级别的发送与回复过滤 |
| 关键词监听 | 命中关键词后可选择 Telegram机器人、转发、Bark 或自定义 URL |
| 运维能力 | Docker 部署、持久化数据目录、健康检查、配置导入导出 |

## 小白 3 步部署（推荐）

1. 安装 Docker（服务器和本机都可）
2. 执行下面命令启动容器
3. 浏览器打开 `http://服务器IP:8080`，用默认账号登录

默认凭据：
- 账号：`admin`
- 密码：`admin123`

### 一条命令启动

```bash
docker run -d \
  --name tg-signpulse \
  --restart unless-stopped \
  -p 8080:8080 \
  -v $(pwd)/data:/data \
  -e TZ=Asia/Shanghai \
  -e APP_SECRET_KEY=your_secret_key \
  ghcr.io/akasls/tg-signpulse:latest
```

如果你走反代（如 Nginx），可改成仅本机监听：

```bash
-p 127.0.0.1:8080:8080
```

### Docker Compose（可选）

```yaml
services:
  app:
    image: ghcr.io/akasls/tg-signpulse:latest
    container_name: tg-signpulse
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./data:/data
    environment:
      - TZ=Asia/Shanghai
      - APP_SECRET_KEY=your_secret_key
```

## 数据目录与权限说明

- 默认数据目录：`/data`
- 当 `/data` 不可写时，会自动降级到 `/tmp/tg-signpulse`（非持久化）
- 新镜像已支持根据 `/data` 挂载目录属主 UID/GID 自动适配运行身份，通常无需 `chmod 777`

容器内排查命令：

```bash
id
ls -ld /data
touch /data/.probe && rm /data/.probe
```

## 常用环境变量（简版）

- `APP_SECRET_KEY`: 面板密钥，强烈建议设置
- `ADMIN_PASSWORD`: 初次安装时 admin 账户的默认密码（安全起见强烈建议设置，未设置则默认 admin123）
- `APP_HOST`: FastAPI 容器监听 IP，防暴露默认 `127.0.0.1`（如需用公网直连或宿主机反代端口请设为 `0.0.0.0`）
- `APP_DATA_DIR`: 自定义数据目录（优先级高于面板配置）
- `TG_PROXY`: Telegram 连接代理；也可在面板设置全局代理
- `TG_SESSION_MODE`: `file`（默认）或 `string`（arm64 推荐）
- `TG_SESSION_NO_UPDATES`: `1` 启用 `no_updates`（仅 `string` 模式）
- `TG_GLOBAL_CONCURRENCY`: 全局并发（默认 `1`）
- `APP_TOTP_VALID_WINDOW`: 面板 2FA 容错窗口

## 自定义数据目录

你可以通过两种方式设置数据目录：

1. 面板设置：`系统设置 -> 全局签到设置 -> 数据目录`
2. 环境变量：`APP_DATA_DIR=/your/path`

说明：
- 修改后建议重启后端服务生效
- 该目录请务必可写，并挂载持久化卷

## 本地开发

- 推荐使用 Python 3.12；项目支持 Python `>=3.10,<3.14`
- 不建议使用 Python 3.14 及以上版本，本项目依赖的 Telegram/Pydantic 运行时组件暂未完全兼容
- 前端使用 Node.js 20，进入 `frontend/` 后执行 `npm ci`

## 常用面板设置

在 `系统设置 -> 全局签到设置` 中可以配置：

- 全局代理：账号未单独配置代理时，登录、刷新会话和执行任务会默认使用该代理
- Telegram机器人通知：填写 Bot Token 和通知 Chat ID 后，任务失败、账号登录失效或关键词命中会自动发送通知
- 数据目录：用于保存 sessions、logs、数据库和任务数据

在账号任务页可以：

- 为目标群组填写 `话题 / Thread ID`，让签到只在指定话题内执行
- 在有序动作序列中添加 `关键词监听`，并在 `推送方式` 下拉框中选择 Telegram机器人、转发、Bark 或自定义 URL
- 仅当选择 `转发`、`Bark` 或 `自定义推送 URL` 时，页面才显示对应参数输入框，减少无关配置干扰
- 点击右上角导出图标，将当前账号全部任务复制到剪贴板
- 点击右上角"粘贴导入任务"，从剪贴板批量导入任务并跳过已存在的重复任务

## 健康检查

- `GET /healthz`：快速健康检查
- `GET /readyz`：服务就绪检查

## 项目结构

```text
backend/      FastAPI 后端与调度器
tg_signer/    Telegram 自动化核心
frontend/     Next.js 管理面板
```

## 更新日志

### 2026-05-12

- **修复任务执行 500 错误**：`run_task_with_logs` 中 `except` 块的局部 `logger` 赋值导致整个函数内 `logger` 变为未绑定局部变量，触发 `UnboundLocalError`，已移除该多余赋值。
- **编辑/新建任务后自动补执行**：创建、编辑或启用 range 模式任务时，若当前时间已在执行窗口内且今日未执行，会立即安排一次性补执行，不再等到第二天。

### 2026-05-03

- **关键词监听稳定性修复**：监听后台现确保 client 以 `no_updates=False` 运行，旧 client 不可接收更新时自动重建；正则捕获组优先作为 `{keyword}` 使用，修复兑换流程中 callback 无法确认时后续动作被中断的问题。
- **按钮点击流程重试**：点击按钮失败时不再发送按钮文本，改为从第 1 步重跑完整流程，最多重试 3 次（可通过 `SIGN_TASK_FLOW_RETRY_ATTEMPTS` 调整）。

### 2026-04-29

- **关键词后续动作**：`推送方式` 新增「后续动作」选项，命中后可继续执行动作序列，支持 `{keyword}`、`{message}`、`{sender}` 等变量。
- **机器人通知重构**：通知配置拆为独立组件，新增总开关、登录通知和任务失败通知分控；任务级别可单独关闭失败通知。
- **任务调度兼容修复**：恢复早期 `signs/<task>/config.json` 目录结构的调度支持；修复账号状态卡片长期卡在"检测中"的问题。

### 2026-04-28

- **任务前账号状态探测**：签到任务执行前检测 session 有效性，失效时跳过执行并写入持久状态，同一失效状态不重复推送通知。
- **首页重登入口优化**：账号卡片直接显示"登录失效"，点击即打开重新登录窗口。

### 2026-04-27

- **关键词监听改为动作序列**：监听现作为动作序列中的一个动作，可按任务、账号、群组和话题独立配置；推送方式、转发、Bark 和自定义 URL 参数按需展示。

### 2026-04-26

- **Telegram 话题 (Thread/Topic) 支持**：支持在指定群组话题内执行签到，发送和接收均过滤话题 ID。
- **全局代理与剪贴板批量导入导出**：账号无独立代理时自动回退全局代理；新增任务一键导出/粘贴导入，自动跳过重复。
- **Telegram Bot 失败通知**：任务失败后推送账号、任务、错误及最近日志。

### 2026-03-20

- **SQLite 死锁修复**：完善 Pyrogram 客户端生命周期缓存，彻底修复高并发下 `database is locked` 问题。
- **任务重复执行防护**：任务已在运行时点击"运行"会提示并自动切换到实时日志流，不再重复触发。

### 2026-03-19

- **账号状态显示修复**：修复正常账号被误报为"账号失效"的前端判断问题。
- **老账号 PeerIdInvalid 修复**：修复旧 `.session` 文件账号被错误切换为内存模式导致 `PeerIdInvalid` 签到失败的问题。

### 2026-03-12

- **核心稳定性修复**：修复 Pyrogram 超时及 `FloodWait` 重试引发的并发锁饥饿与内存泄漏问题。

### 2026-03-06

- 动作序列顺序调整；AI 识图/计算支持内联子模式切换；任务复制改为弹窗展示并支持一键复制；修复含 emoji 配置的 UTF-8 导出问题。

### 2026-03-01

- AI 动作升级；`TimeoutError` / `429` 高频日志优化；长时运行稳定性与内存占用优化；新增自定义数据目录配置。

## 致谢

本项目 fork 自 [akasls/TG-SignPulse](https://github.com/akasls/TG-SignPulse)，其上游为 [amchii/tg-signer](https://github.com/amchii/tg-signer)，感谢两位作者的开源工作。

技术栈：FastAPI、Uvicorn、APScheduler、Pyrogram/Kurigram、Next.js、Tailwind CSS、OpenAI SDK。
