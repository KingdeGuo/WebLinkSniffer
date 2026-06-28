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

**WebLinkSniffer** is a browser extension & userscript that extracts and intelligently ranks all hyperlinks from any webpage.

Perfect for:
- 📚 **Researchers** - Collect reference links efficiently
- 🕵️ **SEO Analysts** - Audit page links quickly  
- 💻 **Developers** - Extract documentation links
- 📖 **Content Curators** - Build link collections effortlessly

### 🚀 Key Features

| Feature | Description |
|---------|-------------|
| **🧠 Adaptive Ranking** | Page-type-aware scoring with TF-IDF, cosine similarity, and session behavior learning |
| **📑 Grouped Display** | Links organized by page region (main content, navigation, sidebar, etc.) with per-group open-all |
| **📄 Smart Pagination** | 15 links per page with relevance-sorted display |
| **🧹 Smart Deduplication** | Removes duplicates & merges anchor variants automatically |
| **🛡️ Advanced Filtering** | Block domains, keywords, regex patterns, or exact URLs |
| **☑️ Batch Operations** | Open/copy/block multiple links at once |
| **🔍 Real-Time Search** | Find links instantly as you type |
| **🌍 Multi-Language** | English & 中文 supported natively |
| **💾 Session Memory** | Remembers opened links, never repeat |

### 🧠 Ranking Engine

The built-in ranking engine uses a three-dimensional adaptive approach:

1. **Page Context** - Detects 12 page types (GitHub, docs, blog, news, etc.) and adjusts link weights accordingly
2. **Link Semantics** - Classifies links by role (content, navigation, external, resource, code, social)
3. **User Behavior** - Tracks session patterns (deep-dive vs explore) and adapts rankings in real-time

### 📦 Installation

#### Option 1: Browser Extension ⭐ (Recommended)

**Chrome / Edge / Brave**

1. Download this repository
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle top-right)
4. Click **"Load unpacked"**
5. Select the project folder ✅

```bash
# Or use git clone
git clone https://github.com/KingdeGuo/WebLinkSniffer.git
cd WebLinkSniffer
# Then follow steps 2-5 above
```

#### Option 2: Tampermonkey Script 🐱

1. Install [Tampermonkey extension](https://www.tampermonkey.net/)
2. Open [`tampermonkey_script.js`](tampermonkey_script.js)
3. Copy all code → Tampermonkey → Create new script
4. Paste & Save 💾
5. Floating 🔗 button appears on all sites!

### 🛠️ Tech Stack

- **Manifest V3** - Modern extension architecture
- **Chrome Storage API** - Fast local persistence  
- **Adaptive Ranking Engine** - Page-type detection, TF-IDF, cosine similarity, session behavior learning
- **GM API** - Tampermonkey integration
- **Smart URL Normalization** - Protocol, www, params, anchors

---

<a name="chinese"></a>
## 🇨🇳 简体中文

### ✨ WebLinkSniffer 是什么？

**WebLinkSniffer** 是一款浏览器扩展和油猴脚本，帮助您提取并智能排序网页中的所有超链接。

适用于：
- 📚 **研究人员** - 高效收集参考文献链接
- 🕵️ **SEO 分析师** - 快速审计页面链接
- 💻 **开发者** - 提取文档链接
- 📖 **内容策展人** - 轻松构建链接集合

### 🚀 核心功能

| 功能 | 说明 |
|------|------|
| **🧠 自适应排序** | 页面类型感知评分，TF-IDF、余弦相似度、会话行为学习 |
| **📑 分区展示** | 按页面区域分组（主内容、导航、侧边栏等），每组独立一键打开 |
| **📄 智能分页** | 每页 15 条，按相关性排序展示 |
| **🧹 智能去重** | 自动移除重复链接并合并锚点变体 |
| **🛡️ 高级过滤** | 按域名、关键词、正则表达式或精确 URL 屏蔽 |
| **☑️ 批量操作** | 同时打开/复制/屏蔽多个链接 |
| **🔍 实时搜索** | 输入时即时查找链接 |
| **🌍 多语言** | 原生支持英文和中文 |
| **💾 会话记忆** | 记住已打开链接，避免重复 |

### 🧠 排序引擎

内置排序引擎采用三维自适应方法：

1. **页面上下文** - 识别 12 种页面类型（GitHub、文档、博客、新闻等），动态调整链接权重
2. **链接语义** - 按角色分类链接（内容、导航、外部引用、资源、代码、社交）
3. **用户行为** - 追踪会话模式（深度阅读 vs 探索），实时自适应排序

### 📦 安装方式

#### 方案一：浏览器扩展 ⭐（推荐）

**Chrome / Edge / Brave**

1. 下载本仓库
2. 访问 `chrome://extensions/`
3. 启用 **开发者模式**（右上角开关）
4. 点击 **"加载已解压的扩展程序"**
5. 选择项目文件夹 ✅

```bash
# 或使用 git clone
git clone https://github.com/KingdeGuo/WebLinkSniffer.git
cd WebLinkSniffer
# 然后按上述步骤 2-5 操作
```

#### 方案二：Tampermonkey 脚本 🐱

1. 安装 [Tampermonkey 扩展](https://www.tampermonkey.net/)
2. 打开 [`tampermonkey_script.js`](tampermonkey_script.js)
3. 复制全部代码 → Tampermonkey → 创建新脚本
4. 粘贴并保存 💾
5. 所有网站右上角出现浮动 🔗 按钮！

### 🛠️ 技术栈

- **Manifest V3** - 现代扩展架构
- **Chrome Storage API** - 快速本地持久化
- **自适应排序引擎** - 页面类型检测、TF-IDF、余弦相似度、会话行为学习
- **GM API** - Tampermonkey 集成
- **智能 URL 规范化** - 协议、www、参数、锚点处理

---

## 📁 Project Structure / 项目结构

```
WebLinkSniffer/
├── manifest.json              # Extension manifest
├── popup.{html,css,js}        # Popup UI
├── ranking.js                 # Adaptive ranking engine
├── content.js                 # Link extraction
├── options.{html,js}          # Settings page
├── i18n.js                    # i18n utilities
├── tampermonkey_script.js     # Userscript
├── tampermonkey_i18n.js       # Userscript i18n
├── _locales/                  # Translations
│   ├── en/messages.json
│   └── zh_CN/messages.json
├── icons/                     # Icons
├── tests/                     # Test pages
├── docs/                      # Documentation
└── examples/                  # Examples
```

---

## 🤝 Contributing / 贡献

Contributions are welcome! Feel free to:
- 🐛 Report bugs via [Issues](../../issues)
- 💡 Suggest features  
- 🔧 Submit pull requests

---

## 📜 License / 许可证

[MIT License](LICENSE) © KingdeGuo

---

<div align="center">

**⭐ Star this repo if you find it helpful!**

</div>
