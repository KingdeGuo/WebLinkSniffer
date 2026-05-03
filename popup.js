class LinkManager {
    constructor() {
        this.links = [];
        this.openedLinks = new Set();
        this.filteredUrls = [];       // 按具体 URL 屏蔽
        this.filteredDomains = [];    // 按域名屏蔽（新增）
        this.filteredPathPatterns = [];  // 按 URL 路径正则模式屏蔽（新增）
        this.selectedUrls = new Set(); // 多选集合（新增）
        this.currentPage = 1;
        this.pageSize = 5;
        this.autoMoveOpened = true;
        this.hideOpenedLinks = true;
        this.searchQuery = '';
        this.retryCount = 0;
        this.maxRetries = 3;
        this.isInitialized = false;

        this.initElements();
        this.initializeApp();
    }

    // 初始化应用
    async initializeApp() {
        try {
            await Promise.all([
                this.loadOpenedLinks(),
                this.loadSettings(),
                this.loadFilteredUrls(),
                this.loadFilteredDomains(),
                this.loadFilteredPathPatterns()
            ]);

            this.setupEventListeners();
            this.setupBulkEventListeners();
            this.isInitialized = true;

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
        this.blockedLinksElement = document.getElementById('blockedLinks');
        this.pageInfoElement = document.getElementById('pageInfo');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.openAllBtn = document.getElementById('openAllBtn');
        this.optionsBtn = document.getElementById('optionsBtn');
        this.autoOpenCheckbox = document.getElementById('autoOpenCheckbox');
        this.hideOpenedCheckbox = document.getElementById('hideOpenedCheckbox');
        this.searchInput = document.getElementById('searchInput');
        this.searchClearBtn = document.getElementById('searchClearBtn');
        this.toast = document.getElementById('toast');
        this.blockedUrlsBar = document.getElementById('blockedUrlsBar');
        this.blockedUrlsTags = document.getElementById('blockedUrlsTags');
        this.clearBlockedBtn = document.getElementById('clearBlockedBtn');
        // 批量操作元素
        this.bulkActionsBar = document.getElementById('bulkActionsBar');
        this.selectedCount = document.getElementById('selectedCount');
        this.bulkBlockBtn = document.getElementById('bulkBlockBtn');
        this.bulkBlockDomainBtn = document.getElementById('bulkBlockDomainBtn');
        this.bulkCopyBtn = document.getElementById('bulkCopyBtn');
        this.bulkOpenBtn = document.getElementById('bulkOpenBtn');
    }

    // ========== 数据加载 ==========

    async loadOpenedLinks() {
        try {
            const result = await chrome.storage.local.get('openedLinks');
            if (result.openedLinks && Array.isArray(result.openedLinks)) {
                const validUrls = result.openedLinks.filter(url =>
                    url && typeof url === 'string' && url.trim().length > 0
                );
                this.openedLinks = new Set(validUrls);
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
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    async loadFilteredUrls() {
        try {
            const result = await chrome.storage.local.get('filteredUrls');
            this.filteredUrls = result.filteredUrls || [];
        } catch (error) {
            console.error('加载屏蔽链接失败:', error);
            this.filteredUrls = [];
        }
    }

    async loadFilteredDomains() {
        try {
            const result = await chrome.storage.local.get('filteredDomains');
            this.filteredDomains = result.filteredDomains || [];
        } catch (error) {
            console.error('加载屏蔽域名失败:', error);
            this.filteredDomains = [];
        }
    }

    async loadFilteredPathPatterns() {
        try {
            const result = await chrome.storage.local.get('filteredPathPatterns');
            this.filteredPathPatterns = result.filteredPathPatterns || [];
        } catch (error) {
            console.error('加载路径模式失败:', error);
            this.filteredPathPatterns = [];
        }
    }

    async saveOpenedLinks() {
        try {
            await chrome.storage.local.set({ openedLinks: Array.from(this.openedLinks) });
        } catch (error) {
            console.error('保存已打开链接失败:', error);
        }
    }

    async saveSettings() {
        try {
            await chrome.storage.local.set({
                autoMoveOpened: this.autoMoveOpened,
                hideOpenedLinks: this.hideOpenedLinks
            });
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    }

    async saveFilteredUrls() {
        try {
            await chrome.storage.local.set({ filteredUrls: this.filteredUrls });
        } catch (error) {
            console.error('保存屏蔽链接失败:', error);
        }
    }

    async saveFilteredDomains() {
        try {
            await chrome.storage.local.set({ filteredDomains: this.filteredDomains });
        } catch (error) {
            console.error('保存屏蔽域名失败:', error);
        }
    }

    async saveFilteredPathPatterns() {
        try {
            await chrome.storage.local.set({ filteredPathPatterns: this.filteredPathPatterns });
        } catch (error) {
            console.error('保存路径模式失败:', error);
        }
    }

    async batchSaveOpenedLinks(urlsToAdd = [], urlsToRemove = []) {
        try {
            urlsToAdd.forEach(url => this.openedLinks.add(url));
            urlsToRemove.forEach(url => this.openedLinks.delete(url));
            await this.saveOpenedLinks();
        } catch (error) {
            console.error('批量保存失败:', error);
        }
    }

    // ========== 事件监听 ==========

    setupEventListeners() {
        this.prevBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        this.nextBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        this.refreshBtn.addEventListener('click', () => {
            this.retryCount = 0;
            this.selectedUrls.clear();
            this.fetchLinks();
        });
        this.openAllBtn.addEventListener('click', () => this.openCurrentPageLinks());
        this.optionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
        this.autoOpenCheckbox.addEventListener('change', (e) => {
            this.autoMoveOpened = e.target.checked;
            this.saveSettings();
            this.updateUI();
        });
        this.hideOpenedCheckbox.addEventListener('change', (e) => {
            this.hideOpenedLinks = e.target.checked;
            this.saveSettings();
            this.selectedUrls.clear();
            this.updateUI();
        });
        this.searchInput.addEventListener('input', (e) => {
            this.searchQuery = e.target.value.trim().toLowerCase();
            this.currentPage = 1;
            this.selectedUrls.clear();
            this.updateUI();
        });
        this.searchClearBtn.addEventListener('click', () => {
            this.searchInput.value = '';
            this.searchQuery = '';
            this.currentPage = 1;
            this.selectedUrls.clear();
            this.updateUI();
        });
        this.clearBlockedBtn.addEventListener('click', () => {
            if (this.filteredUrls.length === 0 && this.filteredDomains.length === 0 && this.filteredPathPatterns.length === 0) return;
            this.filteredUrls = [];
            this.filteredDomains = [];
            this.filteredPathPatterns = [];
            Promise.all([this.saveFilteredUrls(), this.saveFilteredDomains(), this.saveFilteredPathPatterns()]).then(() => {
                this.updateBlockedUrlsBar();
                this.calculateStats();
                this.showToast('已清空所有屏蔽项目');
                this.fetchLinks();
            });
        });
    }

    setupBulkEventListeners() {
        // 批量屏蔽选中链接
        this.bulkBlockBtn.addEventListener('click', () => {
            const urls = Array.from(this.selectedUrls);
            if (urls.length === 0) return;
            const newUrls = urls.filter(u => !this.filteredUrls.includes(u));
            if (newUrls.length === 0) {
                this.showToast('所选链接已全部屏蔽');
                return;
            }
            this.filteredUrls.push(...newUrls);
            this.saveFilteredUrls().then(() => {
                this.selectedUrls.clear();
                this.updateBlockedUrlsBar();
                this.removeBlockedLinksFromView(newUrls);
                this.showToast(`🚫 已屏蔽 ${newUrls.length} 个链接`);
            });
        });

        // 批量屏蔽域名
        this.bulkBlockDomainBtn.addEventListener('click', () => {
            const urls = Array.from(this.selectedUrls);
            if (urls.length === 0) return;
            const domains = new Set();
            urls.forEach(url => {
                const domain = this.getDomainFromUrl(url);
                if (domain) domains.add(domain);
            });
            const newDomains = Array.from(domains).filter(d => !this.filteredDomains.includes(d));
            if (newDomains.length === 0) {
                this.showToast('所选域名已全部屏蔽');
                return;
            }
            this.filteredDomains.push(...newDomains);
            this.saveFilteredDomains().then(() => {
                this.selectedUrls.clear();
                this.updateBlockedUrlsBar();
                this.showToast(`🌐 已屏蔽 ${newDomains.length} 个域名`);
                this.fetchLinks();
            });
        });

        // 批量复制
        this.bulkCopyBtn.addEventListener('click', () => {
            const urls = Array.from(this.selectedUrls);
            if (urls.length === 0) return;
            const text = urls.join('\n');
            this.copyText(text, `✅ 已复制 ${urls.length} 个链接`);
        });

        // 批量打开
        this.bulkOpenBtn.addEventListener('click', async () => {
            const urls = Array.from(this.selectedUrls);
            if (urls.length === 0) return;
            for (const url of urls) {
                await this.openLink(url);
            }
            await this.batchSaveOpenedLinks(urls, []);
            this.selectedUrls.clear();
            if (this.autoMoveOpened) {
                this.sortLinks();
            }
            this.updateUI();
            this.showToast(`🔗 已打开 ${urls.length} 个链接`);
        });
    }

    // ========== 链接获取 ==========

    async fetchLinks() {
        this.showLoading();
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) {
                this.showError('无法获取当前标签页，请确保您在浏览器中打开了一个页面');
                return;
            }
            if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
                this.showError('无法访问浏览器内部页面，请在普通网页上使用此扩展');
                return;
            }
            const response = await this.sendMessageWithRetry(tab.id, { action: 'getLinks' });
            if (response && response.links) {
                this.links = response.links;
                this.currentPageUrl = response.pageUrl || '';
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
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab) {
                        await this.injectContentScript(tab.id);
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

    sendMessageWithRetry(tabId, message, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error('请求超时')), timeout);
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

    async injectContentScript(tabId) {
        try {
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            });
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

    // ========== 排序 ==========

    sortLinks() {
        const maxYPosition = this.links.reduce((max, link) =>
            link.yPosition && link.yPosition > max ? link.yPosition : max, 0);

        this.links.sort((a, b) => {
            const aOpened = this.openedLinks.has(a.url);
            const bOpened = this.openedLinks.has(b.url);
            if (this.autoMoveOpened && aOpened !== bOpened) return aOpened ? 1 : -1;
            const scoreDiff = this.getLinkScore(b, maxYPosition) - this.getLinkScore(a, maxYPosition);
            if (scoreDiff !== 0) return scoreDiff;
            try {
                const urlA = new URL(a.url);
                const urlB = new URL(b.url);
                const dc = urlA.hostname.localeCompare(urlB.hostname);
                if (dc !== 0) return dc;
                const pc = urlA.pathname.localeCompare(urlB.pathname);
                if (pc !== 0) return pc;
                return urlA.search.localeCompare(urlB.search);
            } catch (e) {
                return a.url.localeCompare(b.url);
            }
        });
    }

    getLinkScore(link, maxYPosition) {
        let score = 0;
        if (!this.openedLinks.has(link.url)) score += 200;
        if (this.isSameDomain(link.url)) score += 40;
        if (maxYPosition > 0 && link.yPosition !== undefined && link.yPosition >= 0) {
            const normalizedY = link.yPosition / maxYPosition;
            if (normalizedY < 0.15) score += 30;
            else if (normalizedY < 0.3) score += 25;
            else if (normalizedY < 0.5) score += 18;
            else if (normalizedY < 0.7) score += 10;
            else score += 3;
        }
        if (link.isContentArea) score += 25;
        score += this.getTitleScore(link.title || link.url);
        try {
            const urlObj = new URL(link.url);
            const depth = urlObj.pathname.split('/').filter(Boolean).length;
            score += Math.max(0, 12 - depth) * 4;
            const params = new URLSearchParams(urlObj.search);
            const paramCount = Array.from(params.keys()).length;
            const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid', 'ref', 'source', 'tracking',
                'gbraid', 'wbraid', 'twclid', 'igshid'];
            const trackingCount = Array.from(params.keys()).filter(k =>
                trackingParams.includes(k.toLowerCase())).length;
            score += Math.max(0, 5 - (paramCount - trackingCount)) * 3;
            score -= trackingCount * 6;
            if (!urlObj.search) score += 8;
            const pathLower = urlObj.pathname.toLowerCase();
            if (/\/(article|post|blog|news|story|read|p|entry|detail|content|202\d|20[12]\d)\//.test(pathLower) ||
                /\/[a-z0-9]+[-_][a-z0-9]+[-_][a-z0-9]+/.test(pathLower)) {
                score += 15;
            }
        } catch (e) { /* ignore */ }
        return score;
    }

    getTitleScore(title) {
        const normalized = (title || '').trim();
        if (!normalized || normalized.startsWith('http') || normalized.includes('://')) return 2;
        const wordCount = normalized.split(/\s+/).length;
        const charCount = normalized.length;
        let score = 0;
        if (wordCount >= 3 && charCount >= 15 && charCount <= 80) score += 30;
        else if (wordCount >= 2 && charCount >= 10 && charCount <= 80) score += 20;
        else if (charCount > 80) score += 10;
        else score += 5;
        if (/[\u4e00-\u9fa5]/.test(normalized) || /[a-zA-Z]/.test(normalized)) score += 10;
        if (/^[\d\s\-\|\.\,\;\:\!\?\(\)\[\]\{\}\#\@\$\^&\*\+\=\/\\`~]+$/.test(normalized)) score -= 10;
        if (/^(更多|more|learn more|read more|点击|click|here|这里|详情|detail|查看)$/i.test(normalized)) score -= 15;
        return score;
    }

    // ========== 域名/URL 辅助方法 ==========

    isSameDomain(url) {
        if (!this.currentPageUrl) return false;
        try {
            return new URL(this.currentPageUrl).hostname === new URL(url).hostname;
        } catch (e) {
            return false;
        }
    }

    getDomainFromUrl(url) {
        try {
            return new URL(url).hostname;
        } catch (e) {
            return null;
        }
    }

    // 检查 URL 是否被屏蔽（精确匹配 或 域名匹配 或 路径模式匹配）
    isUrlBlocked(url) {
        if (this.filteredUrls.includes(url)) return true;
        const domain = this.getDomainFromUrl(url);
        if (domain && this.filteredDomains.includes(domain)) return true;
        if (this.filteredPathPatterns.length > 0) {
            try {
                const urlObj = new URL(url);
                const pathAndQuery = urlObj.pathname + urlObj.search;
                for (const pattern of this.filteredPathPatterns) {
                    try {
                        const regex = new RegExp(pattern, 'i');
                        if (regex.test(pathAndQuery) || regex.test(urlObj.pathname)) {
                            return true;
                        }
                    } catch (e) { /* 无效正则跳过 */ }
                }
            } catch (e) { /* ignore */ }
        }
        return false;
    }

    // 检查域名是否被屏蔽
    isDomainBlocked(url) {
        const domain = this.getDomainFromUrl(url);
        return domain && this.filteredDomains.includes(domain);
    }

    // 从 URL 提取路径模式（例如 /blog/some-post → /blog/）
    extractPathPattern(url) {
        try {
            const urlObj = new URL(url);
            const parts = urlObj.pathname.split('/').filter(Boolean);
            if (parts.length >= 1) {
                // 提取第一段路径作为模式（例如 /blog/）
                return '/' + parts[0] + '/';
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    // ========== 过滤与统计 ==========

    getFilteredLinks() {
        let filtered = this.links;
        // 过滤已屏蔽的链接（精确URL、域名、路径模式）
        filtered = filtered.filter(link => !this.isUrlBlocked(link.url));
        if (this.hideOpenedLinks) {
            filtered = filtered.filter(link => !this.openedLinks.has(link.url));
        }
        if (this.searchQuery) {
            filtered = filtered.filter(link => {
                const title = (link.title || '').toLowerCase();
                const url = link.url.toLowerCase();
                return title.includes(this.searchQuery) || url.includes(this.searchQuery);
            });
        }
        return filtered;
    }

    calculateStats() {
        // 统计已被屏蔽的链接数量
        let blockedCount = 0;
        this.links.forEach(link => {
            if (this.isUrlBlocked(link.url)) blockedCount++;
        });
        const totalLinks = this.links.length;
        let openedCount = 0;
        this.links.forEach(link => {
            if (this.openedLinks.has(link.url)) openedCount++;
        });
        this.totalLinksElement.textContent = totalLinks;
        this.newLinksElement.textContent = totalLinks - openedCount - blockedCount;
        this.openedLinksElement.textContent = openedCount;
        this.blockedLinksElement.textContent = blockedCount;
    }

    updateUI() {
        this.calculateStats();
        this.renderLinks();
        this.updatePagination();
        this.updateBulkActionsBar();
    }

    // ========== 渲染链接列表 ==========

    renderLinks() {
        const filteredLinks = this.getFilteredLinks();
        const totalPages = Math.ceil(filteredLinks.length / this.pageSize);
        if (this.currentPage > totalPages && totalPages > 0) this.currentPage = totalPages;

        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, filteredLinks.length);
        const pageLinks = filteredLinks.slice(startIndex, endIndex);

        if (pageLinks.length === 0) {
            this.linksContainer.innerHTML = this.getEmptyStateHtml(filteredLinks.length);
            return;
        }

        this.linksContainer.innerHTML = '';
        pageLinks.forEach(link => {
            const isOpened = this.openedLinks.has(link.url);
            const isBlocked = this.isUrlBlocked(link.url);
            const isSelected = this.selectedUrls.has(link.url);
            const linkElement = this.createLinkElement(link, isOpened, isBlocked, isSelected);
            this.linksContainer.appendChild(linkElement);
        });
    }

    getEmptyStateHtml(totalFiltered) {
        if (totalFiltered === 0) {
            if (this.searchQuery) {
                return `<div class="empty-state">没有找到匹配 "<strong>${this.searchQuery}</strong>" 的链接</div>`;
            } else if (this.hideOpenedLinks) {
                return '<div class="empty-state">所有链接已打开或已隐藏</div>';
            } else {
                return '<div class="empty-state">没有找到链接</div>';
            }
        }
        return '<div class="empty-state">没有找到链接</div>';
    }

    createLinkElement(link, isOpened, isBlocked, isSelected) {
        const div = document.createElement('div');
        div.className = `link-item ${isOpened ? 'link-opened' : ''} ${isSelected ? 'selected' : ''}`;
        div.dataset.url = link.url;

        // 多选 checkbox
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'link-checkbox-bulk';
        checkbox.checked = isSelected;
        checkbox.title = '选择此项进行批量操作';
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSelectUrl(link.url, e.target.checked);
        });

        const contentDiv = document.createElement('div');
        contentDiv.className = 'link-content';

        const title = document.createElement('div');
        title.className = 'link-title';
        title.textContent = link.title || link.url;
        title.title = link.title || link.url;

        const urlEl = document.createElement('div');
        urlEl.className = 'link-url';
        urlEl.textContent = link.url;
        urlEl.title = link.url;

        contentDiv.appendChild(title);
        contentDiv.appendChild(urlEl);

        // 点击内容区域打开链接
        contentDiv.addEventListener('click', () => {
            this.openLink(link.url);
            if (!this.openedLinks.has(link.url)) {
                this.toggleLinkOpened(link.url, true);
            }
        });

        div.appendChild(checkbox);
        div.appendChild(contentDiv);

        // 操作按钮组
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'link-actions';

        // 复制按钮
        const copyBtn = document.createElement('button');
        copyBtn.className = 'link-action-btn copy-btn';
        copyBtn.title = '复制链接';
        copyBtn.textContent = '📋';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyLink(link.url);
        });

        // 屏蔽此链接按钮
        const blockBtn = document.createElement('button');
        blockBtn.className = `link-action-btn block-btn${isBlocked ? ' blocked' : ''}`;
        blockBtn.title = isBlocked ? '已屏蔽' : '屏蔽此链接';
        blockBtn.textContent = '🚫';
        if (!isBlocked) {
            blockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.blockLink(link.url, blockBtn);
            });
        }

        // 屏蔽域名按钮
        const domainBlockBtn = document.createElement('button');
        const domainBlocked = this.isDomainBlocked(link.url);
        domainBlockBtn.className = `link-action-btn domain-block-btn${domainBlocked ? ' blocked' : ''}`;
        domainBlockBtn.title = domainBlocked ? '该域名已屏蔽' : '屏蔽此域名下所有链接';
        domainBlockBtn.textContent = '🌐';
        if (!domainBlocked) {
            domainBlockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.blockDomainFromUrl(link.url, domainBlockBtn);
            });
        }

        // 屏蔽路径模式按钮（新增 🔗）
        const pathBlockBtn = document.createElement('button');
        const pathPattern = this.extractPathPattern(link.url);
        const pathBlocked = pathPattern && this.filteredPathPatterns.includes(pathPattern);
        pathBlockBtn.className = `link-action-btn path-block-btn${pathBlocked ? ' blocked' : ''}`;
        pathBlockBtn.title = pathBlocked ? '该路径模式已屏蔽' : (pathPattern ? `屏蔽所有包含 "${pathPattern}" 的链接` : 'URL 无可用路径模式');
        pathBlockBtn.textContent = '🔗';
        if (!pathBlocked && pathPattern) {
            pathBlockBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.blockPathPatternFromUrl(link.url, pathBlockBtn);
            });
        }

        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(blockBtn);
        actionsDiv.appendChild(domainBlockBtn);
        actionsDiv.appendChild(pathBlockBtn);
        div.appendChild(actionsDiv);

        return div;
    }

    // ========== 多选逻辑 ==========

    toggleSelectUrl(url, selected) {
        if (selected) {
            this.selectedUrls.add(url);
        } else {
            this.selectedUrls.delete(url);
        }
        this.updateBulkActionsBar();

        // 更新当前 DOM 中对应项的高亮
        const itemEl = this.linksContainer.querySelector(`[data-url="${CSS.escape(url)}"]`);
        if (itemEl) {
            if (selected) {
                itemEl.classList.add('selected');
            } else {
                itemEl.classList.remove('selected');
            }
        }
    }

    updateBulkActionsBar() {
        const count = this.selectedUrls.size;
        if (count === 0) {
            this.bulkActionsBar.style.display = 'none';
        } else {
            this.bulkActionsBar.style.display = 'flex';
            this.selectedCount.textContent = `已选 ${count} 项`;
        }
    }

    // ========== 链接操作 ==========

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
        if (page < 1 || page > totalPages) return;
        this.currentPage = page;
        this.renderLinks();
        this.updatePagination();
    }

    async openCurrentPageLinks() {
        const filteredLinks = this.getFilteredLinks();
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, filteredLinks.length);
        const pageLinks = filteredLinks.slice(startIndex, endIndex);
        const urlsToOpen = pageLinks.map(link => link.url);
        for (const url of urlsToOpen) {
            await this.openLink(url);
        }
        await this.batchSaveOpenedLinks(urlsToOpen, []);
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

    // ========== 复制 ==========

    async copyLink(url) {
        await this.copyText(url, '✅ 已复制链接到剪贴板');
    }

    async copyText(text, successMsg) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast(successMsg);
        } catch (error) {
            try {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                this.showToast(successMsg);
            } catch (e) {
                console.error('复制失败:', e);
                this.showToast('❌ 复制失败', true);
            }
        }
    }

    // ========== 屏蔽链接（精确 URL） ==========

    async blockLink(url, blockBtn) {
        if (this.filteredUrls.includes(url)) {
            this.showToast('该链接已在屏蔽列表中');
            return;
        }
        this.filteredUrls.push(url);
        await this.saveFilteredUrls();

        if (blockBtn) {
            blockBtn.classList.add('blocked');
            blockBtn.title = '已屏蔽';
            const newBtn = blockBtn.cloneNode(true);
            blockBtn.parentNode.replaceChild(newBtn, blockBtn);
        }

        this.updateBlockedUrlsBar();
        this.calculateStats();
        this.showToastWithUndo(`🚫 已屏蔽链接`, () => this.undoBlockUrl(url));
        this.updateUI();
    }

    // ========== 屏蔽域名（新增 🌐） ==========

    async blockDomainFromUrl(url, btn) {
        const domain = this.getDomainFromUrl(url);
        if (!domain) {
            this.showToast('无法解析域名', true);
            return;
        }
        if (this.filteredDomains.includes(domain)) {
            this.showToast('该域名已在屏蔽列表中');
            return;
        }
        this.filteredDomains.push(domain);
        await this.saveFilteredDomains();

        if (btn) {
            btn.classList.add('blocked');
            btn.title = '该域名已屏蔽';
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        }

        this.updateBlockedUrlsBar();
        this.calculateStats();
        this.showToastWithUndo(`🌐 已屏蔽域名: ${domain}`, () => this.undoBlockDomain(domain));
        // 移除该域名下所有链接
        this.updateUI();
    }

    // 移除域名被封的所有链接
    removeBlockedDomainFromView(domain) {
        const before = this.links.length;
        this.links = this.links.filter(link => {
            try { return new URL(link.url).hostname !== domain; } catch (e) { return true; }
        });
        this.currentPage = 1;
        this.updateUI();
    }

    // 从视图中移除已屏蔽的链接
    removeBlockedLinkFromView(url) {
        this.links = this.links.filter(link => link.url !== url);
        this.currentPage = 1;
        this.updateUI();
    }

    // 批量移除已屏蔽的链接
    removeBlockedLinksFromView(urls) {
        const urlSet = new Set(urls);
        this.links = this.links.filter(link => !urlSet.has(link.url));
        this.currentPage = 1;
        this.updateUI();
    }

    // 撤销屏蔽链接
    async undoBlockUrl(url) {
        const index = this.filteredUrls.indexOf(url);
        if (index > -1) {
            this.filteredUrls.splice(index, 1);
            await this.saveFilteredUrls();
            this.updateBlockedUrlsBar();
            this.calculateStats();
            this.showToast('↩️ 已撤销屏蔽');
            this.fetchLinks();
        }
    }

    // 屏蔽路径模式（新增 🔗）
    async blockPathPatternFromUrl(url, btn) {
        const pattern = this.extractPathPattern(url);
        if (!pattern) {
            this.showToast('无法提取路径模式', true);
            return;
        }
        if (this.filteredPathPatterns.includes(pattern)) {
            this.showToast('该路径模式已在屏蔽列表中');
            return;
        }
        if (pattern.length < 3) {
            this.showToast('路径模式太短，无法屏蔽');
            return;
        }
        this.filteredPathPatterns.push(pattern);
        await this.saveFilteredPathPatterns();

        if (btn) {
            btn.classList.add('blocked');
            btn.title = '该路径模式已屏蔽';
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
        }

        this.updateBlockedUrlsBar();
        this.calculateStats();
        this.showToastWithUndo(`🔗 已屏蔽路径模式: ${pattern}`, () => this.undoBlockPathPattern(pattern));
        this.updateUI();
    }

    // 移除被路径模式屏蔽的链接
    removeBlockedPathPatternFromView(pattern) {
        try {
            const regex = new RegExp(pattern, 'i');
            this.links = this.links.filter(link => {
                try {
                    const urlObj = new URL(link.url);
                    return !regex.test(urlObj.pathname + urlObj.search) && !regex.test(urlObj.pathname);
                } catch (e) { return true; }
            });
        } catch (e) { /* 无效正则，不移除 */ }
        this.currentPage = 1;
        this.updateUI();
    }

    // 移除单个路径模式屏蔽
    async removeBlockedPathPattern(pattern) {
        const index = this.filteredPathPatterns.indexOf(pattern);
        if (index > -1) {
            this.filteredPathPatterns.splice(index, 1);
            await this.saveFilteredPathPatterns();
            this.updateBlockedUrlsBar();
            this.calculateStats();
            this.showToast('已取消路径模式屏蔽');
            this.fetchLinks();
        }
    }

    // 撤销屏蔽路径模式
    async undoBlockPathPattern(pattern) {
        const index = this.filteredPathPatterns.indexOf(pattern);
        if (index > -1) {
            this.filteredPathPatterns.splice(index, 1);
            await this.saveFilteredPathPatterns();
            this.updateBlockedUrlsBar();
            this.calculateStats();
            this.showToast('↩️ 已撤销路径模式屏蔽');
            this.fetchLinks();
        }
    }

    // 撤销屏蔽域名
    async undoBlockDomain(domain) {
        const index = this.filteredDomains.indexOf(domain);
        if (index > -1) {
            this.filteredDomains.splice(index, 1);
            await this.saveFilteredDomains();
            this.updateBlockedUrlsBar();
            this.calculateStats();
            this.showToast('↩️ 已撤销域名屏蔽');
            this.fetchLinks();
        }
    }

    // 移除单个屏蔽链接
    async removeBlockedUrl(url) {
        const index = this.filteredUrls.indexOf(url);
        if (index > -1) {
            this.filteredUrls.splice(index, 1);
            await this.saveFilteredUrls();
            this.updateBlockedUrlsBar();
            this.calculateStats();
            this.showToast('已取消屏蔽');
            this.fetchLinks();
        }
    }

    // 移除单个屏蔽域名
    async removeBlockedDomain(domain) {
        const index = this.filteredDomains.indexOf(domain);
        if (index > -1) {
            this.filteredDomains.splice(index, 1);
            await this.saveFilteredDomains();
            this.updateBlockedUrlsBar();
            this.calculateStats();
            this.showToast('已取消域名屏蔽');
            this.fetchLinks();
        }
    }

    // ========== 屏蔽栏更新（同时显示 URL 和域名） ==========

    updateBlockedUrlsBar() {
        const totalBlocked = this.filteredUrls.length + this.filteredDomains.length + this.filteredPathPatterns.length;
        if (totalBlocked === 0) {
            this.blockedUrlsBar.style.display = 'none';
            return;
        }
        this.blockedUrlsBar.style.display = 'block';
        this.blockedUrlsTags.innerHTML = '';

        // 显示路径模式屏蔽
        this.filteredPathPatterns.forEach(pattern => {
            const tag = document.createElement('span');
            tag.className = 'blocked-tag path-tag';
            const shortPattern = pattern.length > 20 ? pattern.substring(0, 17) + '...' : pattern;
            tag.innerHTML = `🔗 ${shortPattern} <span class="remove-tag">✕</span>`;
            tag.title = `点击取消路径模式屏蔽: ${pattern}`;
            tag.addEventListener('click', () => this.removeBlockedPathPattern(pattern));
            this.blockedUrlsTags.appendChild(tag);
        });

        // 显示屏蔽的域名
        this.filteredDomains.forEach(domain => {
            const tag = document.createElement('span');
            tag.className = 'blocked-tag domain-tag';
            const shortDomain = domain.length > 25 ? domain.substring(0, 22) + '...' : domain;
            tag.innerHTML = `🌐 ${shortDomain} <span class="remove-tag">✕</span>`;
            tag.title = `点击取消域名屏蔽: ${domain}`;
            tag.addEventListener('click', () => this.removeBlockedDomain(domain));
            this.blockedUrlsTags.appendChild(tag);
        });

        // 显示屏蔽的 URL
        this.filteredUrls.forEach(url => {
            const tag = document.createElement('span');
            tag.className = 'blocked-tag';
            const shortUrl = url.length > 30 ? url.substring(0, 27) + '...' : url;
            tag.innerHTML = `🚫 ${shortUrl} <span class="remove-tag">✕</span>`;
            tag.title = `点击取消屏蔽: ${url}`;
            tag.addEventListener('click', () => this.removeBlockedUrl(url));
            this.blockedUrlsTags.appendChild(tag);
        });
    }

    // ========== Toast 通知系统 ==========

    showToast(message, isError = false) {
        this.toast.innerHTML = message;
        this.toast.className = 'toast show' + (isError ? ' error' : '');
        if (this.toastTimer) clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => this.toast.classList.remove('show'), 2500);
    }

    showToastWithUndo(message, undoCallback) {
        this.toast.innerHTML = `${message} <button class="toast-undo">撤销</button>`;
        this.toast.className = 'toast show';
        if (this.toastTimer) clearTimeout(this.toastTimer);
        const undoBtn = this.toast.querySelector('.toast-undo');
        undoBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            undoCallback();
            this.toast.classList.remove('show');
        });
        this.toastTimer = setTimeout(() => this.toast.classList.remove('show'), 4000);
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