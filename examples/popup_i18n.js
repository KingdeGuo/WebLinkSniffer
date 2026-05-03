/**
 * popup.js 国际化改造示例
 * 展示如何在现有代码中集成 I18n 支持
 */

class LinkManager {
  constructor() {
    this.links = [];
    this.openedLinks = new Set(chrome.storage.local.get(['openedLinks']));
    this.filteredUrls = [];
    this.selectedUrls = new Set();
    this.currentPage = 1;
    this.pageSize = 5;
    this.autoMoveOpened = true;
    this.hideOpenedLinks = false;
    this.hideBlockedLinks = false;
    this.searchQuery = '';
    this.blockedLinks = [];
    
    this.createUI();
    this.fetchLinks();
  }

  createUI() {
    this.addStyles();
    this.setupEventListeners();
    this.render();
  }

  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }
      
      .language-selector {
        margin-left: auto;
      }
      
      .lang-select {
        padding: 5px 10px;
        border: 1px solid #ccc;
        border-radius: 4px;
        cursor: pointer;
      }
      
      .filter-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 15px;
        padding: 10px;
        background: #f5f5f5;
        border-radius: 4px;
      }
      
      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }
      
      .checkbox-label input {
        cursor: pointer;
      }
      
      .stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 10px;
        margin-bottom: 15px;
        padding: 10px;
        background: #f0f0f0;
        border-radius: 4px;
        font-size: 13px;
      }
      
      .blocked-section {
        margin-top: 15px;
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #fffaf0;
      }
      
      .blocked-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: pointer;
        font-weight: bold;
        margin-bottom: 10px;
      }
      
      .blocked-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      
      .blocked-tag {
        background: #ff6b6b;
        color: white;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      
      .blocked-tag button {
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 0 4px;
      }
    `;
    document.head.appendChild(style);
  }

  setupEventListeners() {
    // 刷新按钮
    document.getElementById('refreshBtn').addEventListener('click', () => {
      this.fetchLinks();
    });

    // 打开全部按钮
    document.getElementById('openAllBtn').addEventListener('click', () => {
      this.openCurrentPageLinks();
    });

    // 配置按钮
    document.getElementById('optionsBtn').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });

    // 搜索
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase();
      this.currentPage = 1;
      this.render();
    });

    // 自动移动
    document.getElementById('autoOpenCheckbox').addEventListener('change', (e) => {
      this.autoMoveOpened = e.target.checked;
    });

    // 隐藏已打开
    document.getElementById('hideOpenedCheckbox').addEventListener('change', (e) => {
      this.hideOpenedLinks = e.target.checked;
      this.render();
    });

    // 隐藏已屏蔽
    document.getElementById('hideBlockedCheckbox').addEventListener('change', (e) => {
      this.hideBlockedLinks = e.target.checked;
      this.render();
    });

    // 分页
    document.getElementById('prevBtn').addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.render();
      }
    });

    document.getElementById('nextBtn').addEventListener('click', () => {
      if (this.currentPage < this.getTotalPages()) {
        this.currentPage++;
        this.render();
      }
    });
  }

  async fetchLinks() {
    // 从 content.js 获取链接
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: 'getLinkList' }, (response) => {
      if (response && response.links) {
        this.links = response.links;
        this.render();
      }
    });
  }

  render() {
    // 更新分页信息（使用国际化）
    const pageText = I18n.t('page', {
      pageNum: this.currentPage,
      totalPages: this.getTotalPages()
    });
    document.getElementById('pageInfo').textContent = pageText;

    // 更新统计信息
    document.getElementById('totalLinks').textContent = this.links.length;
    document.getElementById('newLinks').textContent = 
      this.links.filter(l => !this.openedLinks.has(l.url)).length;
    document.getElementById('openedLinks').textContent = this.openedLinks.size;

    // 渲染链接列表
    const container = document.getElementById('linksContainer');
    container.innerHTML = '';

    const filteredLinks = this.getFilteredLinks();
    
    if (filteredLinks.length === 0) {
      container.innerHTML = `<div class="no-links">${I18n.t('noLinksFound')}</div>`;
      return;
    }

    const startIdx = (this.currentPage - 1) * this.pageSize;
    const endIdx = startIdx + this.pageSize;
    const pageLinks = filteredLinks.slice(startIdx, endIdx);

    pageLinks.forEach(link => {
      const linkEl = document.createElement('div');
      linkEl.className = 'link-item';
      
      const isOpened = this.openedLinks.has(link.url);
      const statusText = isOpened ? 
        I18n.t('opened') : I18n.t('unopened');

      linkEl.innerHTML = `
        <div class="link-title">${link.title}</div>
        <div class="link-url">${link.url}</div>
        <div class="link-actions">
          <button class="link-btn open-link" title="${I18n.t('open')}">
            ${I18n.t('open')}
          </button>
          <button class="link-btn copy-link" title="${I18n.t('copy')}">
            ${I18n.t('copy')}
          </button>
          <button class="link-btn block-link" title="${I18n.t('block')}">
            ${I18n.t('block')}
          </button>
          <button class="link-btn block-domain" title="${I18n.t('blockDomain')}">
            ${I18n.t('blockDomain')}
          </button>
          <span class="link-status">${statusText}</span>
        </div>
      `;

      // 绑定事件
      linkEl.querySelector('.open-link').addEventListener('click', () => {
        window.open(link.url, '_blank');
        this.markAsOpened(link.url);
      });

      linkEl.querySelector('.copy-link').addEventListener('click', () => {
        navigator.clipboard.writeText(link.url);
        alert(I18n.t('copySuccess'));
      });

      linkEl.querySelector('.block-link').addEventListener('click', () => {
        this.filteredUrls.push(link.url);
        chrome.storage.local.set({ filteredUrls: this.filteredUrls });
        this.render();
      });

      linkEl.querySelector('.block-domain').addEventListener('click', () => {
        try {
          const domain = new URL(link.url).hostname;
          chrome.storage.local.set({ 
            filteredDomains: [...(this.filteredDomains || []), domain]
          });
          this.render();
        } catch (e) {
          console.error('Error parsing domain:', e);
        }
      });

      container.appendChild(linkEl);
    });
  }

  getFilteredLinks() {
    let links = this.links;

    // 搜索过滤
    if (this.searchQuery) {
      links = links.filter(link =>
        link.title.toLowerCase().includes(this.searchQuery) ||
        link.url.toLowerCase().includes(this.searchQuery)
      );
    }

    // 隐藏已打开
    if (this.hideOpenedLinks) {
      links = links.filter(link => !this.openedLinks.has(link.url));
    }

    // 隐藏已屏蔽
    if (this.hideBlockedLinks) {
      links = links.filter(link => !this.filteredUrls.includes(link.url));
    }

    return links;
  }

  getTotalPages() {
    return Math.max(1, Math.ceil(this.getFilteredLinks().length / this.pageSize));
  }

  markAsOpened(url) {
    this.openedLinks.add(url);
  }

  openCurrentPageLinks() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const pageLinks = this.getFilteredLinks().slice(start, end);

    pageLinks.forEach(link => {
      window.open(link.url, '_blank');
      this.markAsOpened(link.url);
    });
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  new LinkManager();
});
