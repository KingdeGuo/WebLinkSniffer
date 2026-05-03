# 国际化 (i18n) 实现指南

本文档说明如何为浏览器插件和油猴脚本集成多语言支持。

## 目录结构

```
_locales/
├── zh_CN/
│   └── messages.json    # 中文翻译
└── en/
    └── messages.json    # 英文翻译

i18n.js                  # 浏览器插件国际化工具
tampermonkey_i18n.js     # 油猴脚本国际化工具
```

## 浏览器插件集成

### 1. 更新 manifest.json

在 manifest.json 中添加默认语言配置：

```json
{
  "manifest_version": 3,
  "name": "__MSG_appName__",
  "description": "__MSG_appDescription__",
  "default_locale": "en",
  // ... 其他配置
}
```

### 2. 在 HTML 中使用翻译

#### 方法一：直接在 HTML 属性中使用（推荐）

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <script src="i18n.js"></script>
</head>
<body>
    <h1 data-i18n="webLinks"></h1>
    <button id="refreshBtn" class="btn" data-i18n="refreshLinks"></button>
    <input type="text" id="searchInput" class="search-box" 
           data-i18n="search" data-i18n-type="placeholder">
    <span id="pageInfo" data-i18n="page"></span>
</body>
</html>
```

#### 方法二：在 JavaScript 中使用

```javascript
// 导入 i18n 模块
// <script src="i18n.js"></script>

// 获取翻译
document.getElementById('refreshBtn').textContent = I18n.t('refreshLinks');

// 带参数的翻译
const pageText = I18n.t('page', {
  pageNum: this.currentPage,
  totalPages: this.getTotalPages()
});
document.getElementById('pageInfo').textContent = pageText;

// 设置属性
document.getElementById('searchInput').placeholder = I18n.t('search');
```

### 3. 在 popup.js 中使用

```javascript
class LinkManager {
  createUI() {
    GM_addStyle(`...`);
    
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div class="link-manager-container">
        <h2>${I18n.t('webLinks')}</h2>
        <input type="text" 
               placeholder="${I18n.t('search')}"
               class="search-box">
        <button class="pagination-btn">${I18n.t('refreshLinks')}</button>
        <!-- 更多按钮 -->
      </div>
    `;
    document.body.appendChild(modal);
  }

  render() {
    const pageText = I18n.t('page', {
      pageNum: this.currentPage,
      totalPages: this.getTotalPages()
    });
    document.getElementById('pageInfo').textContent = pageText;
  }
}
```

### 4. 添加语言切换功能（可选）

在 options.html 中添加：

```html
<div class="setting-group">
  <label>Language / 语言:</label>
  <select id="languageSelect">
    <option value="en">English</option>
    <option value="zh_CN">中文 (简体)</option>
  </select>
</div>
```

在 options.js 中添加：

```javascript
document.getElementById('languageSelect').addEventListener('change', (e) => {
  I18n.setLanguage(e.target.value);
  // 刷新页面应用新语言
  location.reload();
});

// 加载保存的语言选择
document.getElementById('languageSelect').value = I18n.getLanguage();
```

## 油猴脚本集成

### 1. 在脚本顶部引入

```javascript
// ==UserScript==
// @name         Web Link Sniffer
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Extract all hyperlinks...
// @author       Your Name
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

// 包含国际化脚本代码
// [复制 tampermonkey_i18n.js 的内容到这里]

(function() {
  'use strict';
  // 你的脚本代码
})();
```

### 2. 在代码中使用翻译

```javascript
class LinkManager {
  createUI() {
    GM_addStyle(`...`);
    
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div class="link-manager-container">
        <h2>${i18n.t('linkManagerTitle')}</h2>
        <input type="text" 
               placeholder="${i18n.t('search')}"
               class="search-box">
        <button id="refreshBtn">${i18n.t('refresh')}</button>
        <!-- 更多内容 -->
      </div>
    `;
    document.body.appendChild(modal);
  }

  render() {
    const pageText = i18n.t('page', {
      pageNum: this.currentPage,
      totalPages: this.getTotalPages()
    });
    document.getElementById('pageInfo').textContent = pageText;
  }
}
```

### 3. 添加语言切换按钮（可选）

```javascript
// 在链接管理器中添加语言选择器
const languageOptions = i18n.getAvailableLanguages();
let languageSelect = `<select id="languageSelect" style="margin: 10px;">`;

languageOptions.forEach(lang => {
  const selected = i18n.getCurrentLanguage() === lang.code ? 'selected' : '';
  languageSelect += `<option value="${lang.code}" ${selected}>${lang.name}</option>`;
});

languageSelect += '</select>';

// 绑定事件
document.getElementById('languageSelect').addEventListener('change', (e) => {
  i18n.setLanguage(e.target.value);
  location.reload();
});
```

## 翻译管理

### 添加新的翻译词条

1. 在 `_locales/zh_CN/messages.json` 中添加中文翻译
2. 在 `_locales/en/messages.json` 中添加英文翻译

示例：

```json
// _locales/zh_CN/messages.json
{
  "myNewFeature": {
    "message": "我的新功能"
  }
}

// _locales/en/messages.json
{
  "myNewFeature": {
    "message": "My New Feature"
  }
}
```

然后在代码中使用：

```javascript
I18n.t('myNewFeature')  // 浏览器插件

i18n.t('myNewFeature')  // 油猴脚本
```

## 语言检测优先级

### 浏览器插件版本
1. 检查本地存储的语言设置 (`localStorage.getItem('app_language')`)
2. 检查浏览器 UI 语言 (`chrome.i18n.getUILanguage()`)
3. 默认英文

### 油猴脚本版本
1. 检查 Tampermonkey 存储的语言设置 (`GM_getValue('app_language')`)
2. 检查浏览器语言 (`navigator.language`)
3. 默认英文

## 测试方法

### 测试浏览器插件

1. 在开发者工具中切换语言：`I18n.setLanguage('zh_CN')` 或 `'en'`
2. 在 localStorage 中查看：`localStorage.getItem('app_language')`
3. 手动修改 Chrome 语言设置测试自动检测

### 测试油猴脚本

1. 在浏览器控制台中切换语言：`i18n.setLanguage('zh_CN')` 或 `'en'`
2. 查看 Tampermonkey 存储中的值

## 常见问题

**Q: 如何支持更多语言？**
A: 在 `_locales` 目录中创建新的语言文件夹与 messages.json，并更新 i18n.js 中的语言检测逻辑

**Q: 翻译文件位置错误会怎样？**
A: 浏览器会显示消息键而不是翻译文本，如 `"appName"` 而不是 `"网址获取"`

**Q: 是否支持复数形式和复杂格式？**
A: 当前实现支持简单的参数替换。如需复杂格式，可使用 `intl` 库

**Q: 能否动态加载语言？**
A: 可以扩展 TampermonkeyI18n，从服务器动态加载翻译文件
