/**
 * 国际化 (i18n) 工具模块
 * 提供统一的多语言支持
 */

class I18n {
  /**
   * 获取当前语言代码
   * @returns {string} 语言代码 (如 'en', 'zh_CN')
   */
  static getLanguage() {
    // 优先使用存储的语言设置
    const saved = localStorage.getItem('app_language');
    if (saved) return saved;

    // 获取浏览器语言
    let browserLang = chrome.i18n.getUILanguage();
    
    // 如果是中文变体，统一为 zh_CN
    if (browserLang.startsWith('zh')) {
      return 'zh_CN';
    }
    
    // 如果是英文变体，统一为 en
    if (browserLang.startsWith('en')) {
      return 'en';
    }
    
    // 默认英文
    return 'en';
  }

  /**
   * 设置语言（保存到本地）
   * @param {string} lang - 语言代码
   */
  static setLanguage(lang) {
    localStorage.setItem('app_language', lang);
  }

  /**
   * 获取翻译字符串
   * @param {string} messageKey - 消息键
   * @param {object} substitutions - 替换参数对象
   * @returns {string} 翻译后的字符串
   */
  static t(messageKey, substitutions = null) {
    try {
      let message = chrome.i18n.getMessage(messageKey);
      
      if (!message) {
        console.warn(`Translation key not found: ${messageKey}`);
        return messageKey;
      }

      // 处理替换参数（如果是对象形式）
      if (substitutions && typeof substitutions === 'object') {
        Object.entries(substitutions).forEach(([key, value]) => {
          const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
          message = message.replace(placeholder, value);
        });
      }

      return message;
    } catch (error) {
      console.error(`Error getting translation: ${messageKey}`, error);
      return messageKey;
    }
  }

  /**
   * 获取所有可用的语言列表
   * @returns {array} 语言列表 [{code: 'zh_CN', name: '中文'}, ...]
   */
  static getAvailableLanguages() {
    return [
      { code: 'zh_CN', name: '中文 (简体)' },
      { code: 'en', name: 'English' }
    ];
  }

  /**
   * 国际化 HTML 元素
   * 查找所有带 data-i18n 属性的元素并应用翻译
   * 用法：在 HTML 中添加 data-i18n="messageKey" 属性
   */
  static localizeDocument() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const type = element.getAttribute('data-i18n-type') || 'text'; // text, title, placeholder
      const translation = this.t(key);

      switch (type) {
        case 'text':
          element.textContent = translation;
          break;
        case 'title':
          element.title = translation;
          break;
        case 'placeholder':
          element.placeholder = translation;
          break;
        case 'html':
          element.innerHTML = translation;
          break;
      }
    });
  }

  /**
   * 更新 document.lang 属性
   */
  static updateDocumentLanguage() {
    const lang = this.getLanguage();
    document.documentElement.lang = lang === 'zh_CN' ? 'zh-CN' : 'en';
    document.documentElement.dir = 'ltr';
  }
}

// 页面加载时自动国际化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    I18n.updateDocumentLanguage();
    I18n.localizeDocument();
  });
} else {
  I18n.updateDocumentLanguage();
  I18n.localizeDocument();
}
