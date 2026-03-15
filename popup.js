class LinkManager {
    constructor() {
        this.links = [];
        this.openedLinks = new Set();
        this.currentPage = 1;
        this.pageSize = 5;
        this.autoMoveOpened = true;
        this.hideOpenedLinks = true; // 默认隐藏已打开的链接
        this.retryCount = 0;
        this.maxRetries = 3;
        
        this.initElements();
        this.loadOpenedLinks();
        this.loadSettings();
        this.setupEventListeners();
        this.fetchLinks();
    }
    
    initElements() {
        this.linksContainer = document.getElementById('linksContainer');
        this.totalLinksElement = document.getElementById('totalLinks');
        this.newLinksElement = document.getElementById('newLinks');
        this.openedLinksElement = document.getElementById('openedLinks');
        this.pageInfoElement = document.getElementById('pageInfo');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.openAllBtn = document.getElementById('openAllBtn');
        this.autoOpenCheckbox = document.getElementById('autoOpenCheckbox');
        this.hideOpenedCheckbox = document.getElementById('hideOpenedCheckbox');
    }
    
    async loadOpenedLinks() {
        const result = await chrome.storage.local.get('openedLinks');
        if (result.openedLinks) {
            this.openedLinks = new Set(result.openedLinks);
        }
    }
    
    async loadSettings() {
        const result = await chrome.storage.local.get(['autoMoveOpened', 'hideOpenedLinks']);
        if (result.autoMoveOpened !== undefined) {
            this.autoMoveOpened = result.autoMoveOpened;
            this.autoOpenCheckbox.checked = this.autoMoveOpened;
        }
        if (result.hideOpenedLinks !== undefined) {
            this.hideOpenedLinks = result.hideOpenedLinks;
            this.hideOpenedCheckbox.checked = this.hideOpenedLinks;
        }
    }
    
    async saveOpenedLinks() {
        await chrome.storage.local.set({
            openedLinks: Array.from(this.openedLinks)
        });
    }
    
    async saveSettings() {
        await chrome.storage.local.set({
            autoMoveOpened: this.autoMoveOpened,
            hideOpenedLinks: this.hideOpenedLinks
        });
    }
    
    setupEventListeners() {
        this.prevBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        this.nextBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        this.refreshBtn.addEventListener('click', () => {
            this.retryCount = 0;
            this.fetchLinks();
        });
        this.openAllBtn.addEventListener('click', () => this.openCurrentPageLinks());
        this.autoOpenCheckbox.addEventListener('change', (e) => {
            this.autoMoveOpened = e.target.checked;
            this.saveSettings();
            this.updateUI();
        });
        this.hideOpenedCheckbox.addEventListener('change', (e) => {
            this.hideOpenedLinks = e.target.checked;
            this.saveSettings();
            this.updateUI();
        });
    }
    
    async fetchLinks() {
        this.showLoading();
        
        try {
            // 获取当前活动标签页
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                this.showError('无法获取当前标签页，请确保您在浏览器中打开了一个页面');
                return;
            }
            
            // 检查页面是否可以访问
            if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
                this.showError('无法访问浏览器内部页面，请在普通网页上使用此扩展');
                return;
            }
            
            // 尝试发送消息获取链接
            const response = await this.sendMessageWithRetry(tab.id, { action: 'getLinks' });
            
            if (response && response.links) {
                this.links = response.links;
                this.retryCount = 0;
                
                // 处理重复链接：将标记为 isDuplicate 的链接自动添加到已打开列表
                await this.processDuplicateLinks();
                
                if (this.links.length === 0) {
                    this.showEmpty();
                } else {
                    this.sortLinks();
                    this.updateUI();
                }
            } else {
                throw new Error('返回的链接数据无效');
            }
        } catch (error) {
            console.error('获取链接失败:', error);
            
            // 如果是连接错误，尝试注入 content script
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`尝试重新注入 content script (${this.retryCount}/${this.maxRetries})...`);
                
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab) {
                        await this.injectContentScript(tab.id);
                        // 短暂延迟后重试
                        setTimeout(() => this.fetchLinks(), 500);
                        return;
                    }
                } catch (injectError) {
                    console.error('注入 content script 失败:', injectError);
                }
            }
            
            this.showError(`无法获取链接，请刷新页面后重试<br><small style="color: #9ca3af; display: block; margin-top: 8px;">${error.message || '连接失败'}</small>`);
        }
    }
    
    // 发送消息并设置超时
    sendMessageWithRetry(tabId, message, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('请求超时'));
            }, timeout);
            
            chrome.tabs.sendMessage(tabId, message, (response) => {
                clearTimeout(timeoutId);
                
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            });
        });
    }
    
    // 注入 content script
    async injectContentScript(tabId) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
            console.log('Content script 注入成功');
        } catch (error) {
            console.error('Content script 注入失败:', error);
            throw error;
        }
    }
    
    showLoading() {
        this.linksContainer.innerHTML = '<div class="loading-state">正在获取链接...</div>';
        this.totalLinksElement.textContent = '-';
        this.pageInfoElement.textContent = '加载中...';
        this.prevBtn.disabled = true;
        this.nextBtn.disabled = true;
        this.openAllBtn.disabled = true;
    }
    
    showEmpty() {
        this.linksContainer.innerHTML = '<div class="empty-state">当前页面没有检测到链接</div>';
        this.totalLinksElement.textContent = '0';
        this.pageInfoElement.textContent = '第 1 页 / 共 1 页';
        this.prevBtn.disabled = true;
        this.nextBtn.disabled = true;
        this.openAllBtn.disabled = true;
    }
    
    // 处理重复链接：将标记为 isDuplicate 的链接自动添加到已打开列表
    async processDuplicateLinks() {
        let hasNewDuplicates = false;
        
        this.links.forEach(link => {
            if (link.isDuplicate && !this.openedLinks.has(link.url)) {
                this.openedLinks.add(link.url);
                hasNewDuplicates = true;
            }
        });
        
        // 如果有新的重复链接被标记，保存到存储
        if (hasNewDuplicates) {
            await this.saveOpenedLinks();
        }
    }
    
    sortLinks() {
        // 将已打开的链接移到末尾
        if (this.autoMoveOpened) {
            this.links.sort((a, b) => {
                const aOpened = this.openedLinks.has(a.url);
                const bOpened = this.openedLinks.has(b.url);
                if (aOpened && !bOpened) return 1;
                if (!aOpened && bOpened) return -1;
                return 0;
            });
        }
    }
    
    // 获取过滤后的链接（根据是否隐藏已打开链接）
    getFilteredLinks() {
        if (this.hideOpenedLinks) {
            return this.links.filter(link => !this.openedLinks.has(link.url));
        }
        return this.links;
    }
    
    // 计算统计信息
    calculateStats() {
        const totalLinks = this.links.length;
        let openedCount = 0;
        
        this.links.forEach(link => {
            if (this.openedLinks.has(link.url)) {
                openedCount++;
            }
        });
        
        const newLinksCount = totalLinks - openedCount;
        
        this.totalLinksElement.textContent = totalLinks;
        this.newLinksElement.textContent = newLinksCount;
        this.openedLinksElement.textContent = openedCount;
    }
    
    updateUI() {
        this.calculateStats();
        this.renderLinks();
        this.updatePagination();
    }
    
    renderLinks() {
        const filteredLinks = this.getFilteredLinks();
        const totalPages = Math.ceil(filteredLinks.length / this.pageSize);
        
        // 如果当前页超出范围，调整到最后一页
        if (this.currentPage > totalPages && totalPages > 0) {
            this.currentPage = totalPages;
        }
        
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, filteredLinks.length);
        const pageLinks = filteredLinks.slice(startIndex, endIndex);
        
        if (pageLinks.length === 0) {
            if (filteredLinks.length === 0) {
                if (this.hideOpenedLinks) {
                    this.linksContainer.innerHTML = '<div class="empty-state">所有链接已打开或已隐藏</div>';
                } else {
                    this.linksContainer.innerHTML = '<div class="empty-state">没有找到链接</div>';
                }
            } else {
                this.linksContainer.innerHTML = '<div class="empty-state">没有找到链接</div>';
            }
            return;
        }
        
        this.linksContainer.innerHTML = '';
        
        pageLinks.forEach(link => {
            const isOpened = this.openedLinks.has(link.url);
            const linkElement = this.createLinkElement(link, isOpened);
            this.linksContainer.appendChild(linkElement);
        });
    }
    
    createLinkElement(link, isOpened) {
        const div = document.createElement('div');
        div.className = `link-item ${isOpened ? 'link-opened' : ''}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'link-checkbox';
        checkbox.checked = isOpened;
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            this.toggleLinkOpened(link.url, e.target.checked);
        });
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'link-content';
        
        const title = document.createElement('div');
        title.className = 'link-title';
        title.textContent = link.title || link.url;
        title.title = link.title || link.url;
        
        const url = document.createElement('div');
        url.className = 'link-url';
        url.textContent = link.url;
        url.title = link.url;
        
        contentDiv.appendChild(title);
        contentDiv.appendChild(url);
        
        // 点击内容区域打开链接
        contentDiv.addEventListener('click', () => {
            this.openLink(link.url);
            if (!this.openedLinks.has(link.url)) {
                checkbox.checked = true;
                this.toggleLinkOpened(link.url, true);
            }
        });
        
        div.appendChild(checkbox);
        div.appendChild(contentDiv);
        
        return div;
    }
    
    async toggleLinkOpened(url, opened) {
        if (opened) {
            this.openedLinks.add(url);
        } else {
            this.openedLinks.delete(url);
        }
        
        await this.saveOpenedLinks();
        
        if (this.autoMoveOpened) {
            this.sortLinks();
            this.updateUI();
        } else {
            this.renderLinks();
        }
    }
    
    updatePagination() {
        const filteredLinks = this.getFilteredLinks();
        const totalPages = Math.ceil(filteredLinks.length / this.pageSize);
        
        this.pageInfoElement.textContent = `第 ${this.currentPage} 页 / 共 ${totalPages} 页`;
        
        this.prevBtn.disabled = this.currentPage <= 1;
        this.nextBtn.disabled = this.currentPage >= totalPages;
        
        this.openAllBtn.disabled = filteredLinks.length === 0;
    }
    
    goToPage(page) {
        const filteredLinks = this.getFilteredLinks();
        const totalPages = Math.ceil(filteredLinks.length / this.pageSize);
        
        if (page < 1 || page > totalPages) {
            return;
        }
        
        this.currentPage = page;
        this.renderLinks();
        this.updatePagination();
    }
    
    async openCurrentPageLinks() {
        const filteredLinks = this.getFilteredLinks();
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, filteredLinks.length);
        const pageLinks = filteredLinks.slice(startIndex, endIndex);
        
        for (const link of pageLinks) {
            await this.openLink(link.url);
        }
        
        // 标记所有链接为已打开
        pageLinks.forEach(link => {
            this.openedLinks.add(link.url);
        });
        
        await this.saveOpenedLinks();
        
        if (this.autoMoveOpened) {
            this.sortLinks();
            this.updateUI();
        } else {
            this.renderLinks();
        }
    }
    
    async openLink(url) {
        try {
            await chrome.tabs.create({ url, active: false });
        } catch (error) {
            console.error('打开链接失败:', error);
        }
    }
    
    showError(message) {
        this.linksContainer.innerHTML = `<div class="error-state">${message}</div>`;
        this.totalLinksElement.textContent = '0';
        this.pageInfoElement.textContent = '第 1 页 / 共 1 页';
        this.prevBtn.disabled = true;
        this.nextBtn.disabled = true;
        this.openAllBtn.disabled = true;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new LinkManager();
});