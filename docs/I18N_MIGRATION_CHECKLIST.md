# 国际化迁移检查清单

使用此清单将现有项目升级为多语言版本。

## 第一阶段：准备

- [x] 创建 `_locales/zh_CN/messages.json` 翻译文件
- [x] 创建 `_locales/en/messages.json` 翻译文件
- [x] 创建 `i18n.js` 工具模块（浏览器插件）
- [x] 创建 `tampermonkey_i18n.js` 工具模块（油猴脚本）
- [ ] 查阅 `docs/I18N_GUIDE.md` 了解详细步骤

## 第二阶段：更新浏览器插件

### manifest.json
- [ ] 添加 `"default_locale": "en"` 配置
- [ ] 将 `"name"` 改为 `"__MSG_appName__"`
- [ ] 将 `"description"` 改为 `"__MSG_appDescription__"`

### HTML 文件（popup.html, options.html）

#### 方式一：使用 data-i18n 属性（推荐）
- [ ] 在 `<head>` 中添加 `<script src="i18n.js"></script>`
- [ ] 将文本改为 `data-i18n="messageKey"`
- [ ] 将占位符改为 `data-i18n="key" data-i18n-type="placeholder"`
- [ ] 将 title 改为 `data-i18n="key" data-i18n-type="title"`

示例转换：
```html
<!-- 之前 -->
<h1>网页链接</h1>
<button>刷新链接</button>

<!-- 之后 -->
<h1 data-i18n="webLinks"></h1>
<button data-i18n="refreshLinks"></button>
```

#### 方式二：在 JavaScript 中使用
- [ ] 在脚本开头确保 i18n.js 已加载
- [ ] 使用 `I18n.t('key')` 获取翻译
- [ ] 使用 `I18n.t('key', {param: value})` 处理带参数的翻译

示例转换：
```javascript
// 之前
element.textContent = '刷新链接';

// 之后
element.textContent = I18n.t('refreshLinks');
```

### JavaScript 文件（popup.js, content.js, options.js）

#### 步骤 1：导入 i18n 模块
```javascript
// 在文件顶部或 HTML 中引入
// <script src="i18n.js"></script>
```

#### 步骤 2：替换硬编码的文本
- [ ] 在 popup.js 中替换所有 UI 文本
- [ ] 在 options.js 中替换所有配置页面文本
- [ ] 在 content.js 中的错误提示中替换文本

#### 步骤 3：添加带参数的翻译
对于需要动态值的翻译：
```javascript
// 分页信息
const pageInfo = I18n.t('page', {
  pageNum: this.currentPage,
  totalPages: this.getTotalPages()
});

// 统计数
const stats = I18n.t('linkStats', {
  total: this.links.length,
  new: this.newLinks.length
});
```

### 可选：添加语言选择器
- [ ] 在 popup 或 options 中添加 `<select>` 元素
- [ ] 绑定 change 事件调用 `I18n.setLanguage(lang)`
- [ ] 刷新页面应用新语言

```html
<select id="languageSelect">
  <option value="zh_CN">中文</option>
  <option value="en">English</option>
</select>
```

```javascript
document.getElementById('languageSelect').addEventListener('change', (e) => {
  I18n.setLanguage(e.target.value);
  location.reload();
});
```

## 第三阶段：更新油猴脚本

### tampermonkey_script.js

#### 步骤 1：包含 i18n 代码
- [ ] 复制 `tampermonkey_i18n.js` 中的所有内容到脚本顶部
- [ ] 或在 `// ==UserScript==` 和新代码之间添加注释分隔

#### 步骤 2：替换硬编码文本
- [ ] 使用 `i18n.t('key')` 替换所有 UI 文本
- [ ] 对于带参数的文本，使用 `i18n.t('key', {param: value})`

示例：
```javascript
// 之前
linkItem.innerHTML = `
  <span style="color: orange;">未打开</span>
`;

// 之后
linkItem.innerHTML = `
  <span style="color: orange;">${i18n.t('unopened')}</span>
`;
```

#### 步骤 3：模态框标题和按钮
```javascript
const modal = document.createElement('div');
modal.innerHTML = `
  <div class="link-manager-container">
    <h2>${i18n.t('linkManagerTitle')}</h2>
    <button>${i18n.t('refresh')}</button>
    <!-- 更多内容 -->
  </div>
`;
```

#### 可选：添加语言切换
- [ ] 在管理器中添加语言选择器区域
- [ ] 绑定 change 事件调用 `i18n.setLanguage(lang)`

## 第四阶段：测试

### 浏览器插件测试
- [ ] 在 Chrome 中加载插件，验证中文显示正确
- [ ] 在浏览器设置中改为英文，重新加载插件
- [ ] 验证所有 UI 元素都正确翻译
- [ ] 测试语言切换功能（如果实现）
- [ ] 检查 localStorage 中的语言设置是否保存

### 油猴脚本测试
- [ ] 安装脚本到浏览器
- [ ] 访问网页，验证中文浮动按钮和管理器显示正确
- [ ] 打开浏览器开发工具，执行 `i18n.setLanguage('en')` 测试英文
- [ ] 验证 Tampermonkey 存储中的设置是否保存
- [ ] 清除存储后重新检测语言是否符合浏览器设置

### 兼容性测试
- [ ] Chrome 88+ 测试
- [ ] Edge 88+ 测试
- [ ] Firefox + Tampermonkey 测试
- [ ] Safari + Tampermonkey 测试（如适用）

## 第五阶段：文档更新

- [ ] 更新 README.md，在安装部分添加语言支持信息
- [ ] 添加"支持的语言"部分
- [ ] 更新 CHANGELOG.md，记录国际化功能
- [ ] 在 manifest.json 中添加翻译说明

示例 README 更新：
```markdown
## 支持的语言

- 中文（简体）- 完全支持
- English - 完全支持

### 语言自动检测
- 浏览器插件：根据浏览器 UI 语言自动选择
- 油猴脚本：根据浏览器语言自动选择

### 手动切换语言
在弹出窗口或配置页面中选择语言 🌐
```

## 第六阶段：发布

- [ ] 提交代码到 GitHub
- [ ] 更新版本号（如 1.4.0 → 2.0.0）
- [ ] 发布新版本描述中提及国际化支持
- [ ] 在 Chrome Web Store / Firefox Add-ons 中更新描述

## 常见问题排查

### 翻译不显示
- [ ] 检查 `_locales` 目录结构是否正确
- [ ] 验证 messages.json 语法是否有效
- [ ] 确保消息键拼写正确
- [ ] 检查浏览器控制台是否有错误

### 语言选择器不工作
- [ ] 确认 `I18n.setLanguage()` 被正确调用
- [ ] 检查 localStorage 是否被禁用
- [ ] 验证页面刷新是否成功
- [ ] 查看浏览器控制台的错误信息

### 尖括号或特殊字符显示不正确
- [ ] 确保 messages.json 使用 UTF-8 编码
- [ ] 检查 HTML 中的 `<meta charset="UTF-8">`
- [ ] 对特殊字符使用正确的转义

## 后续优化建议

- [ ] 添加更多语言（日语、西班牙语等）
- [ ] 实现右到左 (RTL) 语言支持
- [ ] 从 i18n 服务动态加载翻译
- [ ] 使用国际化开发工具自动提取翻译键
- [ ] 集成众包翻译平台（如 Crowdin）

---

**预计完成时间**：2-3 小时（根据项目规模）
**难度等级**：中等
**所需技能**：基础 JavaScript、JSON、HTML
