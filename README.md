# 俄语重音助手 (Russian Stress Extension)

[![GitHub Release](https://img.shields.io/github/v/release/wanxiao2018/russian-stress-extension?color=blue&label=Release)](https://github.com/wanxiao2018/russian-stress-extension/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Data License: CC BY-SA 4.0](https://img.shields.io/badge/Data-CC%20BY--SA%204.0-orange.svg)](NOTICE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](manifest.json)
[![Platform](https://img.shields.io/badge/Platform-Chrome%20%7C%20Edge%20%7C%20Chromium-lightgrey.svg)](#安装指南)

为俄语学习者与研究人员打造的轻量级浏览器扩展。完全在本地离线运行，在网页、选区与输入框中智能标注俄语单词重音，保护隐私，零网络请求。

A lightweight Chrome / Edge extension that displays Russian word stress marks directly in the browser. Powered by an offline OpenRussian inflection database, with zero remote network requests.

---

## ✨ 核心特性

- 🔒 **100% 本地离线 & 隐私安全**
  - 内置包含 110 万+ 词形变换的离线词典，不将任何网页文字或用户输入发送到外部服务器。
  - 仅在用户交互（点击扩展图标或按下快捷键）时按需请求标签页权限。
- 📄 **整页一键重音 (Toggle Stress)**
  - 一键为当前普通网页中的全部俄语单词标注重音。
  - 再次点击即可无缝恢复原始网页内容，不留副作用。
- 🔍 **悬停即时查词 (Hover Lookup)**
  - 开启「悬停查词」后，鼠标移至任意俄语单词上方即可弹出浮窗显示其重音形式。
  - 遇到同形异音词（一词多重音，如 `за́мок` 城堡 / `замо́к` 门锁）时清晰列出所有可能重音，避免强行替换导致歧义。
- ✍️ **划词与选区重音 (Selection Stress)**
  - 支持在网页正文或输入框中自由划选俄文片段并快速标音。
  - 保留原有的超链接、加粗及排版结构。
- ⚡ **输入框就地标音 & 快捷键支持**
  - 光标定位在输入框中，按下快捷键 `Alt+Shift+A` 即可一键就地添加重音。
  - 支持浏览器原生 `Ctrl+Z` / `Cmd+Z` 撤销；自动忽略密码输入框以保障敏感信息安全。
- 📖 **用户自定义词典 (Custom Dictionary)**
  - 支持添加个性化重音规则与生僻新词，自定义条目优先于内置词典匹配。

---

## 📦 安装指南

### 方式一：下载已编译 Release 安装包（推荐普通用户）

1. 前往 GitHub **[Releases 页面](https://github.com/wanxiao2018/russian-stress-extension/releases)** 下载最新的 `russian-stress-extension-v1.1.2.zip` 压缩包。
2. 将下载的 ZIP 压缩包解压到本地一个固定的目录（例如 `~/Extensions/russian-stress-extension`）。
3. 打开基于 Chromium 的浏览器，在地址栏输入对应扩展管理地址：
   - **Google Chrome**: `chrome://extensions`
   - **Microsoft Edge**: `edge://extensions`
   - **Brave / Vivaldi / 360 等**: 打开「扩展程序」或「应用管理」页面
4. 打开页面右上角（或左下角）的 **「开发者模式」 (Developer mode)** 开关。
5. 点击 **「加载已解压的扩展程序」 (Load unpacked)**。
6. 选择刚刚解压出来的文件夹根目录（包含 `manifest.json` 的目录）。
7. 安装完成！点击浏览器右上角拼图图标，将「俄语重音助手」固定到工具栏方便使用。

> [!NOTE]
> 扩展仅支持普通的 `http://` 和 `https://` 网页。浏览器内部页面（如 `chrome://`、`edge://`）、扩展商店以及浏览器设置页受安全沙箱限制无法注入。

---

### 方式二：从源码克隆运行（面向开发者）

```bash
# 1. 克隆仓库
git clone https://github.com/wanxiao2018/russian-stress-extension.git
cd russian-stress-extension

# 2. 安装依赖并运行测试
npm install
npm test

# 3. 打包 Release ZIP
npm run package
```

按照方式一的步骤，在浏览器的扩展管理页中点击「加载已解压的扩展程序」，选择本仓库根目录即可。

---

## 💡 使用说明

### 弹窗菜单功能

点击浏览器右上角扩展图标唤出菜单：

| 功能按键 | 说明 |
| :--- | :--- |
| **给当前页面加重音 / 取消当前页面重音** | 全文模式：切换当前网页全局俄语重音状态，自动监听新闻等动态加载内容。 |
| **开启悬停查词 / 关闭悬停查词** | 悬停模式：鼠标移入单词时弹出重音提示卡片，支持普通正文与输入框。 |
| **添加/取消选中文本重音** | 选区模式：对当前鼠标划选的文本区域添加或取消重音（支持双向切换）。 |
| **添加/取消光标输入框重音** | 输入框模式：为光标所在的输入框或文本域添加或取消重音（支持双向切换）。 |
| **自定义词典** | 点击可进入自定义词典配置页面。 |

### 快捷键

- 默认快捷键：`Alt+Shift+A`（为当前光标所在输入框或选区添加/取消重音）。
- **自定义快捷键**：可在浏览器地址栏访问 `chrome://extensions/shortcuts`（Edge 访问 `edge://extensions/shortcuts`），找到「俄语重音助手」并绑定为你喜欢的快捷键组合。

### 自定义词典格式

在弹窗中点击「自定义词典」或打开扩展选项页，每行输入一条规则，格式为 `原形 = 标音形`（`#` 开头的行会被当作注释忽略）：

```text
# 自定义词典示例
пример = приме́р
письмо = письмо́
Москва = Москва́
```

自定义词条会优先于内置离线词典生效。

---

## 🛠️ 项目结构

```text
russian-stress-extension/
├── manifest.json         # Chrome Extension MV3 配置文件
├── accent.js             # 核心重音规则匹配与词典查询引擎
├── content.js            # 网页 DOM 遍历、选区处理、悬停提示及输入框交互
├── background.js         # 后台 Service Worker（快捷键监听与脚本调度）
├── popup.html / .js / .css # 扩展弹出面板界面与控制逻辑
├── options.html / .js / .css # 自定义词典配置选项页面
├── stress-data.json      # 本地离线重音词典（110万+词形）
├── icons/                # 扩展图标 (16x16, 48x48, 128x128)
├── tests/                # 单元测试与词典回归测试集 (jsdom)
├── scripts/              # 构建与打包脚本 (package.js)
├── LICENSE               # MIT 开源许可证
├── NOTICE                # 第三方词典数据版权与许可声明
└── privacy-policy.md     # 隐私政策说明
```

---

## 🧪 开发与测试

本项目采用 Node.js 与 `jsdom` 进行无头回归测试：

```bash
# 安装依赖
npm install

# 运行词典与 DOM 行为回归测试 (111万+ 词典校验)
npm test

# 打包用于发布的 release zip
npm run package
```

打包完成后，zip 文件将输出在 `dist/russian-stress-extension-v<version>.zip`。

---

## 🔒 隐私政策

本扩展恪守最小权限原则与隐私优先承诺：
- 仅申请 `activeTab`、`scripting` 与 `storage` 权限。
- 仅在用户主动点击操作或按下快捷键时才在当前标签页执行脚本。
- 所有单词查找与标注全部在本地内存中完成，**绝不上传任何页面文本、URL、选区或用户输入**。
- 自定义词典仅保存在本地浏览器 `chrome.storage.local` 中。

完整隐私说明请见 [privacy-policy.md](privacy-policy.md)。

---

## 📄 许可证与数据致谢

1. **扩展源代码**：采用 [MIT License](LICENSE) 开源，版权所有 (c) 2026 wanxiao2018。
2. **离线重音词典 (`stress-data.json`)**：
   - 数据衍生自开源词典项目 [OpenRussian](https://github.com/Badestrand/russian-dictionary)。
   - 遵循知识共享署名-相同方式共享 4.0 国际许可协议 ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/))。
   - 任何重新分发或衍生该词典的行为，均须遵守 CC BY-SA 4.0 协议并保留原始署名。详细说明参见 [NOTICE](NOTICE)。
