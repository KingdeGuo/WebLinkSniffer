/**
 * Tampermonkey 脚本国际化模块
 * 提供多语言支持 (zh_CN, en)
 */

const I18nMessages = {
  zh_CN: {
    linkManagerTitle: '网址获取管理器',
    search: '搜索链接...',
    page: '第 {{pageNum}} 页，共 {{totalPages}} 页',
    previousPage: '上一页',
    nextPage: '下一页',
    autoOpen: '自动移动已打开链接到末尾',
    hideOpened: '隐藏已打开链接',
    hideBlocked: '隐藏已屏蔽链接',
    refresh: '刷新链接',
    totalLinks: '总链接数',
    newLinks: '新链接',
    openedLinks: '已打开链接',
    blockedLinks: '已屏蔽链接',
    open: '打开',
    copy: '复制',
    block: '屏蔽',
    blockDomain: '屏蔽域名',
    blockPath: '屏蔽路径',
    opened: '已打开',
    unopened: '未打开',
    copySuccess: '链接已复制到剪贴板！',
    openAllLink: '打开当前页全部链接',
    saveSettings: '保存设置',
    settingsSaved: '设置已保存！',
    showBlockedLinks: '显示已屏蔽链接',
    hideBlockedLinks: '隐藏已屏蔽链接'
  },
  en: {
    linkManagerTitle: 'Web Link Sniffer',
    search: 'Search links...',
    page: 'Page {{pageNum}} of {{totalPages}}',
    previousPage: 'Previous',
    nextPage: 'Next',
    autoOpen: 'Auto move opened links to end',
    hideOpened: 'Hide opened links',
    hideBlocked: 'Hide blocked links',
    refresh: 'Refresh Links',
    totalLinks: 'Total Links',
    newLinks: 'New Links',
    openedLinks: 'Opened Links',
    blockedLinks: 'Blocked Links',
    open: 'Open',
    copy: 'Copy',
    block: 'Block',
    blockDomain: 'Block Domain',
    blockPath: 'Block Path',
    opened: 'Opened',
    unopened: 'Unopened',
    copySuccess: 'Link copied to clipboard!',
    openAllLink: 'Open All Links on This Page',
    saveSettings: 'Save Settings',
    settingsSaved: 'Settings saved!',
    showBlockedLinks: 'Show blocked links',
    hideBlockedLinks: 'Hide blocked links'
  }
};

class TampermonkeyI18n {
  constructor() {
    // 从存储中获取保存的语言，或检测浏览器语言
    this.language = GM_getValue('app_language') || this.detectLanguage();
    this.messages = I18nMessages[this.language] || I18nMessages.en;
  }

  /**
   * 检测浏览器语言
   */
  detectLanguage() {
    const browserLang = navigator.language || navigator.userLanguage;
    
    if (browserLang.startsWith('zh')) {
      return 'zh_CN';
    }
    if (browserLang.startsWith('en')) {
      return 'en';
    }
    
    return 'en'; // 默认英文
  }

  /**
   * 设置语言
   */
  setLanguage(lang) {
    if (I18nMessages[lang]) {
      this.language = lang;
      this.messages = I18nMessages[lang];
      GM_setValue('app_language', lang);
    }
  }

  /**
   * 获取翻译
   */
  t(key, params = {}) {
    let message = this.messages[key] || key;
    
    // 替换参数
    Object.entries(params).forEach(([k, v]) => {
      message = message.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), v);
    });
    
    return message;
  }

  /**
   * 获取所有可用语言
   */
  getAvailableLanguages() {
    return [
      { code: 'zh_CN', name: '中文 (简体)' },
      { code: 'en', name: 'English' }
    ];
  }

  /**
   * 获取当前语言
   */
  getCurrentLanguage() {
    return this.language;
  }
}

// 导出单例
const i18n = new TampermonkeyI18n();
