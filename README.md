# SimpRead

> 划词即问的浏览器侧边栏 AI 对话助手 · An AI sidebar companion that answers any text you select on the web.

SimpRead 是一款基于 Manifest V3 的浏览器扩展，把 AI 对话直接嵌入浏览器侧边栏（Edge Side Panel）。
在任意网页选中一段文字，点击浮现的「AI」按钮，即可自动打开侧边栏并发送给 AI——翻译、解释、解题，一气呵成。

## 功能特性

- **划词即问**：网页任意选中文本 → 点击浮动「AI」按钮 → 自动打开侧边栏并发送，无需手动复制粘贴
- **侧边栏对话**：基于 Edge Side Panel API 的沉浸式对话界面，浏览网页时随时提问
- **多会话管理**：新建 / 切换 / 删除会话，会话标题随首条消息自动生成
- **多模式**：内置 `Explain` / `Solve` / `Translate` 三种模式，支持自定义模式（自定义 system prompt）
- **OpenAI 兼容 API**：默认 DeepSeek，可自定义任意 OpenAI 兼容端点（URL / 模型 / Key / 温度）
- **Markdown 渲染**：AI 回复实时渲染为 Markdown，代码块、表格清晰可读
- **请求控制**：支持随时中止（Stop）正在进行的请求
- **本地优先**：全部数据仅存浏览器本地，支持一键导出备份 / 清空

## 安装

### 方式一：加载解压缩的扩展（开发模式）

1. 克隆或下载本仓库：

   ```bash
   git clone https://github.com/Utteran/SimpRead.git
   ```

2. 打开 Edge，访问 `edge://extensions`
3. 打开左下角「**开发人员模式**」
4. 点击「**加载解压缩的扩展**」，选择项目文件夹（包含 `manifest.json` 的目录）
5. 点击浏览器工具栏的扩展图标，将 SimpRead **固定到工具栏**
6. 点击图标打开侧边栏，首次使用请在 **Settings** 中配置 API（见下）

> 兼容性：需要 Edge（Chromium）114+ 或 Chrome 114+（Side Panel API）。

## 使用

### 1. 配置 API（首次必做）

打开侧边栏 → **Settings** → **API**，填写：

| 配置项 | 说明 | 默认值 |
|---|---|---|
| API URL | OpenAI 兼容的聊天补全端点 | `https://api.deepseek.com/chat/completions` |
| Model | 使用的模型名 | `deepseek-chat` |
| API Key | 你的 API 密钥（仅存本地） | — |
| Temperature | 采样温度，范围 0–2，数值越大越发散 | `0.3` |

点击 **Save API Settings** 保存。

### 2. 划词提问

在任意网页选中一段文本，点击浮现的蓝色「AI」按钮 → 侧边栏自动打开并把划词内容发送给 AI。

### 3. 管理会话

- **New**：开启新会话
- **Delete**：删除当前会话（至少保留一个）
- 下拉框切换历史会话

### 4. 管理模式

- 下拉框切换内置/自定义模式
- Settings → **Modes**：添加自定义模式（名称 + system prompt），或编辑/删除已有自定义模式

### 5. 数据备份

Settings → **Data**：`Export Data` 导出全部数据为 JSON；`Clear All Local Data` 清空本地数据。

## 隐私说明

- 所有会话、模式、设置（含 API Key）**仅存储在你的浏览器本地**（`chrome.storage.local`）
- 划词内容**仅发送到你自行配置的 API 端点**，不经过任何第三方中转
- 扩展自身不收集任何遥测或使用数据

## 项目结构

```
SimpRead/
├── manifest.json      # Manifest V3 清单（权限/侧边栏/后台/内容脚本声明）
├── background.js      # Service Worker：接收划词消息、打开侧边栏、会话级缓存
├── content.js         # 内容脚本：划词选区监听 + 浮动「AI」按钮
├── sidepanel.html     # 侧边栏界面结构
├── sidepanel.js       # 侧边栏逻辑：会话/模式/API 调用/本地存储
├── style.css          # 侧边栏样式
└── marked.min.js      # Markdown 渲染库（本地 vendored，无 CDN 依赖）
```

## 工作流程

```
用户选中文本
   │  content.js 弹出浮动「AI」按钮
   ▼
点击按钮 → chrome.runtime.sendMessage({type:"TEXT_SELECTED"})
   ▼
background.js：写入 session 缓存 → 打开侧边栏 → 转发消息
   ▼
sidepanel.js：接收划词 → 自动作为消息发送 → 调用配置的 OpenAI 兼容 API
   ▼
Markdown 渲染 AI 回复 → 保存到本地会话
```

## 许可

[MIT](LICENSE)
