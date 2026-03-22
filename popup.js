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
        this.isInitialized = false;
        
        this.initElements();
        this.initializeApp();
    }
    
    // 初始化应用，确保数据加载完成后再执行其他操作
    async initializeApp() {
        try {
            // 并行加载所有必要的数据
            await Promise.all([
                this.loadOpenedLinks(),
                this.loadSettings()
            ]);
            
            this.setupEventListeners();
            this.isInitialized = true;
            
            // 数据加载完成后才获取链接
            await this.fetchLinks();
        } catch (error) {
            console.error('初始化应用失败:', error);
            this.showError('初始化失败，请刷新页面重试');
        }
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
        this.optionsBtn = document.getElementById('optionsBtn');
        this.autoOpenCheckbox = document.getElementById('autoOpenCheckbox');
        this.hideOpenedCheckbox = document.getElementById('hideOpenedCheckbox');
    }
    
    async loadOpenedLinks() {
        try {
            const result = await chrome.storage.local.get('openedLinks');
            if (result.openedLinks && Array.isArray(result.openedLinks)) {
                // 过滤掉无效的URL
                const validUrls = result.openedLinks.filter(url => 
                    url && typeof url === 'string' && url.trim().length > 0
                );
                this.openedLinks = new Set(validUrls);
                console.log(`已加载 ${validUrls.length} 个已打开链接`);
            } else {
                console.log('没有找到已保存的链接记录');
            }
        } catch (error) {
            console.error('加载已打开链接失败:', error);
            this.openedLinks = new Set();
        }
    }
    
    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['autoMoveOpened', 'hideOpenedLinks']);
            if (result.autoMoveOpened !== undefined) {
                this.autoMoveOpened = result.autoMoveOpened;
                this.autoOpenCheckbox.checked = this.autoMoveOpened;
            }
            if (result.hideOpenedLinks !== undefined) {
                this.hideOpenedLinks = result.hideOpenedLinks;
                this.hideOpenedCheckbox.checked = this.hideOpenedLinks;
            }
            console.log('设置加载完成');
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }
    
    async saveOpenedLinks() {
        try {
            const linksArray = Array.from(this.openedLinks);
            await chrome.storage.local.set({
                openedLinks: linksArray
            });
            console.log(`已保存 ${linksArray.length} 个已打开链接`);
        } catch (error) {
            console.error('保存已打开链接失败:', error);
            // 尝试使用更简单的保存方式
            try {
                await chrome.storage.local.set({
                    openedLinks: Array.from(this.openedLinks)
                });
            } catch (fallbackError) {
                console.error('备用保存方式也失败:', fallbackError);
            }
        }
    }
    
    async saveSettings() {
        try {
            await chrome.storage.local.set({
                autoMoveOpened: this.autoMoveOpened,
                hideOpenedLinks: this.hideOpenedLinks
            });
            console.log('设置已保存');
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    }
    
    // 批量保存，提高性能
    async batchSaveOpenedLinks(urlsToAdd = [], urlsToRemove = []) {
        try {
            // 更新本地集合
            urlsToAdd.forEach(url => this.openedLinks.add(url));
            urlsToRemove.forEach(url => this.openedLinks.delete(url));
            
            // 保存到存储
            await this.saveOpenedLinks();
        } catch (error) {
            console.error('批量保存失败:', error);
        }
    }
    
    setupEventListeners() {
        this.prevBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        this.nextBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        this.refreshBtn.addEventListener('click', () => {
            this.retryCount = 0;
            this.fetchLinks();
        });
        this.openAllBtn.addEventListener('click', () => this.openCurrentPageLinks());
        this.optionsBtn.addEventListener('click', () => {
            chrome.runtime.openOptionsPage();
        });
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
        
        // 收集要打开的链接URL
        const urlsToOpen = pageLinks.map(link => link.url);
        
        // 批量打开链接
        for (const url of urlsToOpen) {
            await this.openLink(url);
        }
        
        // 批量标记所有链接为已打开
        await this.batchSaveOpenedLinks(urlsToOpen, []);
        
        if (this.autoMoveOpened) {
            this.sortLinks();
            this.updateUI();
        } else {
            this.renderLinks();
        }
    }
    
    // 清理无效的存储数据
    async cleanupStorage() {
        try {
            const result = await chrome.storage.local.get('openedLinks');
            if (result.openedLinks && Array.isArray(result.openedLinks)) {
                // 过滤掉无效的URL
                const validUrls = result.openedLinks.filter(url => 
                    url && typeof url === 'string' && url.trim().length > 0
                );
                
                // 如果过滤后的数量不同，则更新存储
                if (validUrls.length !== result.openedLinks.length) {
                    await chrome.storage.local.set({
                        openedLinks: validUrls
                    });
                    console.log(`清理存储：从 ${result.openedLinks.length} 个链接中移除了 ${result.openedLinks.length - validUrls.length} 个无效链接`);
                }
            }
        } catch (error) {
            console.error('清理存储失败:', error);
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