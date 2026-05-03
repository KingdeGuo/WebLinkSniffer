<div align="center">

# 🔗 WebLinkSniffer

**Extract, manage & batch-open all hyperlinks from any webpage**

[![License: MIT](https://img.shields.io/badge/License-MIT-brightgreen.svg)](LICENSE)
[![Chrome Web Store](https://img.shields.io/badge/Chrome-Add%20to%20Chrome-4285F4?logo=google-chrome&logoColor=white)](https://chrome.google.com/webstore)
[![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Install%20Script-00485B?logo=tampermonkey)](https://www.tampermonkey.net/)

<p align="center">
  <a href="#english">🇺🇸 English</a> •
  <a href="#chinese">🇨🇳 简体中文</a>
</p>

</div>

---

<a name="english"></a>
## 🇺🇸 English

### ✨ What is WebLinkSniffer?

**WebLinkSniffer** is a powerful browser extension & userscript that helps you extract and manage all hyperlinks from any webpage in seconds.

Perfect for:
- 📚 **Researchers** - Collect reference links efficiently
- 🕵️ **SEO Analysts** - Audit page links quickly  
- 💻 **Developers** - Extract documentation links
- 📖 **Content Curators** - Build link collections effortlessly

### 🚀 Why WebLinkSniffer?

| 🎯 Feature | 💡 How It Helps |
|------------|----------------|
| **⚡ One-Click Extraction** | Grab all links instantly, no manual copying |
| **🧹 Smart Deduplication** | Removes duplicates & merges anchor variants automatically |
| **📄 Smart Pagination** | View 5 links per page - no overwhelming scroll |
| **🛡️ Advanced Filtering** | Block domains, keywords, or regex patterns |
| **☑️ Batch Operations** | Open/copy/block multiple links at once |
| **🔍 Real-Time Search** | Find links instantly as you type |
| **🌍 Multi-Language** | English & 中文 supported natively |
| **💾 Session Memory** | Remembers opened links, never repeat |

### 📦 Installation

#### Option 1: Browser Extension ⭐ (Recommended)

<table>
<tr>
<td width="50%">

**Chrome / Edge / Brave**

1. Download this repository
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle top-right)
4. Click **"Load unpacked"**
5. Select the project folder ✅

</td>
<td width="50%">

```bash
# Or use git clone
git clone https://github.com/KingdeGuo/WebLinkSniffer.git
cd WebLinkSniffer
# Then follow steps 2-5 above
```

</td>
</tr>
</table>

#### Option 2: Tampermonkey Script 🐱

<table>
<tr>
<td>

1. Install [Tampermonkey extension](https://www.tampermonkey.net/)
2. Open [`tampermonkey_script.js`](tampermonkey_script.js)
3. Copy all code → Tampermonkey → Create new script
4. Paste & Save 💾
5. Floating 🔗 button appears on all sites!

</td>
</tr>
</table>

### 🎮 Quick Start

```markdown
1. Visit any webpage
2. Click the 🔗 icon (or floating button for userscript)
3. Browse paginated links
4. Click 🚫 to block, ☑️ to select multiple
5. Hit "Open Selected" to batch-open! 🚀
```

### 📸 Screenshots

> *Coming soon - Screenshots of the UI in action*

### 🛠️ Tech Stack

- **Manifest V3** - Modern extension architecture
- **Chrome Storage API** - Fast local persistence  
- **chrome.i18n** - Native i18n support
- **GM API** - Tampermonkey integration
- **Smart URL Normalization** - Protocol, www, params, anchors

### 🌍 Languages Supported

| Language | Code | Status |
|----------|------|--------|
| 🇺🇸 English | `en` | ✅ Native |
| 🇨🇳 简体中文 | `zh_CN` | ✅ Native |

### 📝 Documentation

- [I18N Integration Guide](docs/I18N_GUIDE.md)
- [Migration Checklist](docs/I18N_MIGRATION_CHECKLIST.md)
- [Code Examples](examples/)

---

<a name="chinese"></a>
## 🇨🇳 简体中文

### ✨ WebLinkSniffer 是什么？

**WebLinkSniffer** 是一款强大的浏览器扩展和油猴脚本，帮助您在几秒钟内提取和管理网页中的所有超链接。

适用于：
- 📚 **研究人员** - 高效收集参考文献链接
- 🕵️ **SEO 分析师** - 快速审计页面链接
- 💻 **开发者** - 提取文档链接
- 📖 **内容策展人** - 轻松构建链接集合

### 🚀 为什么选择 WebLinkSniffer？

| 🎯 功能 | 💡 帮助 |
|---------|---------|
| **⚡ 一键提取** | 即时抓取所有链接，无需手动复制 |
| **🧹 智能去重** | 自动移除重复链接并合并锚点变体 |
| **📄 智能分页** | 每页显示 5 个链接 - 不会滚动疲劳 |
| **🛡️ 高级过滤** | 按域名、关键词或正则表达式屏蔽 |
| **☑️ 批量操作** | 同时打开/复制/屏蔽多个链接 |
| **🔍 实时搜索** | 输入时即时查找链接 |
| **🌍 多语言** | 原生支持英文和中文 |
| **💾 会话记忆** | 记住已打开链接，避免重复 |

### 📦 安装方式

#### 方案一：浏览器扩展 ⭐（推荐）

<table>
<tr>
<td width="50%">

**Chrome / Edge / Brave**

1. 下载本仓库
2. 访问 `chrome://extensions/`
3. 启用 **开发者模式**（右上角开关）
4. 点击 **"加载已解压的扩展程序"**
5. 选择项目文件夹 ✅

</td>
<td width="50%">

```bash
# 或使用 git clone
git clone https://github.com/KingdeGuo/WebLinkSniffer.git
cd WebLinkSniffer
# 然后按上述步骤 2-5 操作
```

</td>
</tr>
</table>

#### 方案二：Tampermonkey 脚本 🐱

<table>
<tr>
<td>

1. 安装 [Tampermonkey 扩展](https://www.tampermonkey.net/)
2. 打开 [`tampermonkey_script.js`](tampermonkey_script.js)
3. 复制全部代码 → Tampermonkey → 创建新脚本
4. 粘贴并保存 💾
5. 所有网站右上角出现浮动 🔗 按钮！

</td>
</tr>
</table>

### 🎮 快速开始

```markdown
1. 访问任意网页
2. 点击 🔗 图标（油猴版为浮动按钮）
3. 浏览分页链接
4. 点击 🚫 屏蔽，☑️ 多选
5. 点击"打开选中项"批量打开！🚀
```

### 📸 截图展示

> *即将推出 - UI 实际使用截图*

### 🛠️ 技术栈

- **Manifest V3** - 现代扩展架构
- **Chrome Storage API** - 快速本地持久化
- **chrome.i18n** - 原生国际化支持
- **GM API** - Tampermonkey 集成
- **智能 URL 规范化** - 协议、www、参数、锚点处理

### 🌍 支持的语言

| 语言 | 代码 | 状态 |
|------|------|--------|
| 🇺🇸 English | `en` | ✅ 原生支持 |
| 🇨🇳 简体中文 | `zh_CN` | ✅ 原生支持 |

### 📝 开发文档

- [国际化集成指南](docs/I18N_GUIDE.md)
- [迁移检查清单](docs/I18N_MIGRATION_CHECKLIST.md)
- [代码示例](examples/)

---

## 📁 Project Structure / 项目结构

```
WebLinkSniffer/
├── 📄 manifest.json              # Extension manifest / 扩展清单
├── 🎨 popup.{html,css,js}        # Popup UI / 弹出界面
├── 🔍 content.js                 # Link extraction / 链接提取
├── ⚙️ options.{html,js}          # Settings / 设置页面
├── 🌐 i18n.js                    # i18n utilities / 国际化工具
├── 🐱 tampermonkey_script.js     # Userscript / 油猴脚本
├── 🐱 tampermonkey_i18n.js       # Userscript i18n / 油猴 i18n
├── 🗂️ _locales/                  # Translations / 翻译文件
│   ├── en/messages.json          # English / 英文
│   └── zh_CN/messages.json       # 简体中文
├── 🎨 icons/                     # Icons / 图标
├── 🧪 tests/                     # Test pages / 测试页面
├── 📖 docs/                      # Documentation / 文档
└── 💡 examples/                  # Examples / 示例
```

---

## 🤝 Contributing / 贡献

Contributions are welcome! Feel free to:
- 🐛 Report bugs via [Issues](../../issues)
- 💡 Suggest features  
- 🔧 Submit pull requests

欢迎贡献！可以通过以下方式参与：
- 🐛 通过 [Issues](../../issues) 报告问题
- 💡 建议新功能
- 🔧 提交 Pull Request

---

## 📜 License / 许可证

[MIT License](LICENSE) © KingdeGuo

---

<div align="center">

**⭐ Star this repo if you find it helpful!**  
**⭐ 如果觉得有用，请给本仓库点个星！**

[🔝 Back to Top](#-weblinksniffer)

</div>