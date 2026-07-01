class LinkManager {
    constructor() {
        this.MAX_FILTERED = 500;
        this.links = [];
        this.openedLinks = new Set();
        this.filteredUrls = [];
        this.filteredDomains = [];
        this.filteredPathPatterns = [];
        this.enableFilter = true;
        this.enablePathPatternFilter = true;
        this.hidePathPatternFiltered = true;
        this.selectedUrls = new Set();
        this.currentPage = 1;
        this.pageSize = 15;
        this.autoMoveOpened = true;
        this.hideOpenedLinks = true;
        this.hideBlockedLinks = true;
        this.searchQuery = '';
        this.retryCount = 0;
        this.maxRetries = 3;
        this.fetchRequestId = 0;
        this.isInitialized = false;
        this.linkHistory = [];
        this.rankingEngine = new RankingEngine();

        this.initElements();
        this.initializeApp();
    }

    async initializeApp() {
        try {
            await Promise.all([
                this.loadOpenedLinks(),
                this.loadSettings(),
                this.loadFilteredUrls(),
                this.loadFilteredDomains(),
                this.loadFilteredPathPatterns(),
                this.loadLinkHistory()
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
        this.hideBlockedCheckbox = document.getElementById('hideBlockedCheckbox');
        this.searchInput = document.getElementById('searchInput');
        this.searchClearBtn = document.getElementById('searchClearBtn');
        this.toast = document.getElementById('toast');
        this.blockedUrlsBar = document.getElementById('blockedUrlsBar');
        this.blockedUrlsTags = document.getElementById('blockedUrlsTags');
        this.clearBlockedBtn = document.getElementById('clearBlockedBtn');
        this.bulkActionsBar = document.getElementById('bulkActionsBar');
        this.selectedCount = document.getElementById('selectedCount');
        this.bulkBlockBtn = document.getElementById('bulkBlockBtn');
        this.bulkBlockDomainBtn = document.getElementById('bulkBlockDomainBtn');
        this.bulkCopyBtn = document.getElementById('bulkCopyBtn');
        this.bulkOpenBtn = document.getElementById('bulkOpenBtn');
    }

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
            const result = await chrome.storage.local.get(['autoMoveOpened', 'hideOpenedLinks', 'hideBlockedLinks', 'enableFilter', 'enablePathPatternFilter', 'hidePathPatternFiltered']);
            if (result.autoMoveOpened !== undefined) {
                this.autoMoveOpened = result.autoMoveOpened;
                this.autoOpenCheckbox.checked = this.autoMoveOpened;
            }
            if (result.hideOpenedLinks !== undefined) {
                this.hideOpenedLinks = result.hideOpenedLinks;
                this.hideOpenedCheckbox.checked = this.hideOpenedLinks;
            }
            if (result.hideBlockedLinks !== undefined) {
                this.hideBlockedLinks = result.hideBlockedLinks;
                this.hideBlockedCheckbox.checked = this.hideBlockedLinks;
            }
            if (result.enableFilter !== undefined) {
                this.enableFilter = result.enableFilter;
            }
            if (result.enablePathPatternFilter !== undefined) {
                this.enablePathPatternFilter = result.enablePathPatternFilter;
            }
            if (result.hidePathPatternFiltered !== undefined) {
                this.hidePathPatternFiltered = result.hidePathPatternFiltered;
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

    async loadLinkHistory() {
        try {
            const result = await chrome.storage.local.get('linkHistory');
            this.linkHistory = result.linkHistory || [];
        } catch (error) {
            console.error('加载链接历史失败:', error);
            this.linkHistory = [];
        }
    }

    async saveLinkHistory() {
        try {
            if (this.linkHistory.length > 500) {
                this.linkHistory.sort((a, b) => (b.lastClicked || 0) - (a.lastClicked || 0));
                this.linkHistory = this.linkHistory.slice(0, 500);
            }
            await chrome.storage.local.set({ linkHistory: this.linkHistory });
        } catch (error) {
            console.error('保存链接历史失败:', error);
        }
    }

    getTopicWords(text) {
        return this.rankingEngine.tokenize(text).slice(0, 8);
    }

    async recordLinkClicked(url, title) {
        const domain = this.getDomainFromUrl(url) || 'unknown';
        const topicWords = this.getTopicWords(title || '');
        const now = Date.now();
        const today = new Date().toDateString();

        // 查找已有记录
        const existing = this.linkHistory.find(h => h.url === url);
        if (existing) {
            existing.lastClicked = now;
            existing.clickCount = (existing.clickCount || 0) + 1;
            if (title && !existing.title) existing.title = title;
            if (topicWords.length > 0) {
                existing.topicWords = [...new Set([...(existing.topicWords || []), ...topicWords])].slice(0, 12);
            }
            if (existing.lastClickDate === today) {
                existing.todayCount = (existing.todayCount || 0) + 1;
            } else {
                existing.lastClickDate = today;
                existing.todayCount = 1;
            }
        } else {
            this.linkHistory.push({
                url,
                domain,
                title: title || '',
                topicWords,
                firstSeen: now,
                lastClicked: now,
                clickCount: 1,
                lastClickDate: today,
                todayCount: 1
            });
        }

        await this.saveLinkHistory();
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
                hideOpenedLinks: this.hideOpenedLinks,
                hideBlockedLinks: this.hideBlockedLinks,
                enableFilter: this.enableFilter,
                enablePathPatternFilter: this.enablePathPatternFilter,
                hidePathPatternFiltered: this.hidePathPatternFiltered
            });
        } catch (error) {
            console.error('保存设置失败:', error);
        }
    }

    async saveFilteredUrls() {
        try {
            if (this.filteredUrls.length > this.MAX_FILTERED) {
                this.filteredUrls = this.filteredUrls.slice(-this.MAX_FILTERED);
            }
            await chrome.storage.local.set({ filteredUrls: this.filteredUrls });
        } catch (error) {
            console.error('保存屏蔽链接失败:', error);
        }
    }

    async saveFilteredDomains() {
        try {
            if (this.filteredDomains.length > this.MAX_FILTERED) {
                this.filteredDomains = this.filteredDomains.slice(-this.MAX_FILTERED);
            }
            await chrome.storage.local.set({ filteredDomains: this.filteredDomains });
        } catch (error) {
            console.error('保存屏蔽域名失败:', error);
        }
    }

    async saveFilteredPathPatterns() {
        try {
            if (this.filteredPathPatterns.length > this.MAX_FILTERED) {
                this.filteredPathPatterns = this.filteredPathPatterns.slice(-this.MAX_FILTERED);
            }
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
        this.hideBlockedCheckbox.addEventListener('change', (e) => {
            this.hideBlockedLinks = e.target.checked;
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
                this.removeBlockedDomainFromView(newDomains);
                this.showToast(`🌐 已屏蔽 ${newDomains.length} 个域名`);
            });
        });

        this.bulkCopyBtn.addEventListener('click', () => {
            const urls = Array.from(this.selectedUrls);
            if (urls.length === 0) return;
            const text = urls.join('\n');
            this.copyText(text, `✅ 已复制 ${urls.length} 个链接`);
        });

        this.bulkOpenBtn.addEventListener('click', async () => {
            const urls = Array.from(this.selectedUrls);
            if (urls.length === 0) return;
            const selectedLinks = this.links.filter(l => urls.includes(l.url));
            for (const link of selectedLinks) {
                await this.openLink(link.url, link.title);
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

    async fetchLinks() {
        const currentRequestId = ++this.fetchRequestId;
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
            if (currentRequestId !== this.fetchRequestId) return;
            if (response && response.links) {
                this.links = response.links;
                this.currentPageUrl = response.pageUrl || '';
                this.pageMeta = response.pageMeta || {};
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
            if (currentRequestId !== this.fetchRequestId) return;
            console.error('获取链接失败:', error);
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                try {
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    if (tab) {
                        await this.injectContentScript(tab.id);
                        setTimeout(() => {
                            if (this.fetchRequestId === currentRequestId) {
                                this.fetchLinks();
                            }
                        }, 500);
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

    // ========== 多阶段智能排序系统 ==========

    sortLinks() {
        this.rankedGroups = null;
        this.rankedScores = null;

        if (this.links.length < 4) {
            this.links.sort((a, b) => a.url.localeCompare(b.url));
            return;
        }

        const stats = this.computeLinkStatistics();
        stats.currentPageUrl = this.currentPageUrl;
        stats.linkHistory = this.linkHistory;
        stats.pageMeta = this.pageMeta || {};

        const result = this.rankingEngine.rank(this.links, stats, this.linkHistory);
        this.rankedGroups = result.groups;
        this.rankedScores = result.scores;
        this.pageType = result.pageType;
        this.sessionBehavior = result.sessionBehavior;

        // 更新页面类型标签
        this._updatePageTypeBadge(result.pageType);

        // 最终排序：未打开优先，同组内按分数降序
        const unopened = result.ranked.filter(l => !this.openedLinks.has(l.url));
        const opened = result.ranked.filter(l => this.openedLinks.has(l.url));

        const dispersed = this.domainDispersion(unopened.map(link => ({
            link,
            domain: this.getDomainFromUrl(link.url) || 'unknown',
            compositeScore: 0
        }))).map(item => item.link);

        this.links = [...dispersed, ...opened];
    }

    _updatePageTypeBadge(pageType) {
        const PAGE_TYPE_LABELS = {
            'github-repo': 'GitHub 仓库', 'github-issues': 'GitHub Issues', 'github': 'GitHub',
            'docs': '技术文档', 'qa': '问答社区', 'news': '新闻资讯',
            'blog': '博客文章', 'ecommerce': '电商', 'video': '视频',
            'forum': '论坛', 'wiki': '百科', 'generic': '通用页面'
        };
        const PAGE_TYPE_ICONS = {
            'github-repo': '💻', 'github-issues': 'ISSUES', 'github': '💻',
            'docs': '📚', 'qa': '💬', 'news': '📰',
            'blog': '✍️', 'ecommerce': '🛒', 'video': '🎬',
            'forum': '🗣️', 'wiki': '📖', 'generic': ''
        };

        const label = PAGE_TYPE_LABELS[pageType] || '';
        const icon = PAGE_TYPE_ICONS[pageType] || '';

        const badge = document.getElementById('pageTypeBadge');
        if (badge) {
            badge.textContent = icon ? `${icon} ${label}` : label;
        }
    }

    computeLinkStatistics() {
        const stats = {
            maxYPosition: 0,
            domainCounts: new Map(),
            domainList: [],
            totalDomainTypes: 0,
            pathDepths: [],
            avgPathDepth: 0,
            contentAreaLinks: 0,
            contentAreaRatio: 0,
            hasTitleCount: 0,
            avgTitleLength: 0,
            urlPatterns: new Map(),
            totalLinks: this.links.length,
            maxDomainCount: 0,
            uniqueWordsInTitles: new Set(),
            userDomainClicks: new Map(),
            userTotalClicks: 0,
            userRecentDomains: new Set(),
            titleWordDF: new Map(),
            totalTitleWords: 0,
            avgTitleWords: 0
        };

        let totalTitleLength = 0;
        let totalTitleWordCount = 0;

        this.links.forEach(link => {
            if (link.yPosition > stats.maxYPosition) {
                stats.maxYPosition = link.yPosition;
            }

            try {
                const domain = new URL(link.url).hostname;
                const count = (stats.domainCounts.get(domain) || 0) + 1;
                stats.domainCounts.set(domain, count);
                if (count > stats.maxDomainCount) stats.maxDomainCount = count;
            } catch (e) {}

            if (link.isContentArea) stats.contentAreaLinks++;

            const title = (link.title || '').trim();
            if (title && !title.startsWith('http')) {
                stats.hasTitleCount++;
                totalTitleLength += title.length;
                const words = title.toLowerCase().split(/\W+/).filter(w => w.length > 1);
                totalTitleWordCount += words.length;
                words.forEach(w => {
                    stats.uniqueWordsInTitles.add(w);
                    stats.titleWordDF.set(w, (stats.titleWordDF.get(w) || 0) + 1);
                });
            }

            try {
                const depth = new URL(link.url).pathname.split('/').filter(Boolean).length;
                stats.pathDepths.push(depth);
            } catch (e) {}
        });

        stats.domainList = [...stats.domainCounts.entries()].sort((a, b) => b[1] - a[1]);
        stats.totalDomainTypes = stats.domainCounts.size;
        stats.avgTitleLength = stats.hasTitleCount > 0 ? 
            totalTitleLength / stats.hasTitleCount : 0;
        stats.avgPathDepth = stats.pathDepths.length > 0 ?
            stats.pathDepths.reduce((a, b) => a + b, 0) / stats.pathDepths.length : 0;
        stats.contentAreaRatio = stats.totalLinks > 0 ?
            stats.contentAreaLinks / stats.totalLinks : 0;
        stats.avgTitleWords = stats.hasTitleCount > 0 ?
            totalTitleWordCount / stats.hasTitleCount : 0;
        stats.totalTitleWords = totalTitleWordCount;

        this.linkHistory.forEach(h => {
            const clicks = h.clickCount || 1;
            stats.userTotalClicks += clicks;
            stats.userDomainClicks.set(h.domain, (stats.userDomainClicks.get(h.domain) || 0) + clicks);
            if (h.lastClickDate === new Date().toDateString()) {
                stats.userRecentDomains.add(h.domain);
            }
        });

        return stats;
    }

    domainDispersion(items) {
        if (items.length <= 2) return items;

        const result = [];
        const remaining = [...items];

        while (remaining.length > 0) {
            let bestIndex = 0;
            const lastDomain = result.length > 0 ? result[result.length - 1].domain : null;

            let found = false;
            for (let i = 0; i < remaining.length; i++) {
                if (remaining[i].domain !== lastDomain || lastDomain === null) {
                    if (!found || remaining[i].compositeScore > remaining[bestIndex].compositeScore) {
                        bestIndex = i;
                        found = true;
                    }
                }
            }

            if (!found) {
                bestIndex = 0;
                for (let i = 1; i < remaining.length; i++) {
                    if (remaining[i].compositeScore > remaining[bestIndex].compositeScore) {
                        bestIndex = i;
                    }
                }
            }

            result.push(remaining[bestIndex]);
            remaining.splice(bestIndex, 1);
        }

        return result;
    }

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

    isUrlBlocked(url) {
        if (this.filteredUrls.includes(url)) return true;
        if (this.enableFilter) {
            const domain = this.getDomainFromUrl(url);
            if (domain && this.filteredDomains.some(d => domain === d || domain.endsWith('.' + d))) return true;
        }
        if (this.enablePathPatternFilter && this.hidePathPatternFiltered && this.filteredPathPatterns.length > 0) {
            try {
                const urlObj = new URL(url);
                const pathAndQuery = urlObj.pathname + urlObj.search;
                for (const pattern of this.filteredPathPatterns) {
                    try {
                        const regex = new RegExp(pattern, 'i');
                        if (regex.test(pathAndQuery) || regex.test(urlObj.pathname)) {
                            return true;
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        }
        return false;
    }

    isDomainBlocked(url) {
        const domain = this.getDomainFromUrl(url);
        return domain && this.filteredDomains.some(d => domain === d || domain.endsWith('.' + d));
    }

    extractPathPattern(url) {
        try {
            const urlObj = new URL(url);
            const parts = urlObj.pathname.split('/').filter(Boolean);
            if (parts.length >= 1) {
                return '/' + parts[0] + '/';
            }
            return null;
        } catch (e) {
            return null;
        }
    }

    getFilteredLinks() {
        let filtered = this.links;
        if (this.hideBlockedLinks) {
            filtered = filtered.filter(link => !this.isUrlBlocked(link.url));
        }
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
        let totalLinks = 0;
        let newCount = 0;
        let openedCount = 0;
        let blockedCount = 0;
        this.links.forEach(link => {
            const isBlocked = this.isUrlBlocked(link.url);
            const isOpened = this.openedLinks.has(link.url);
            totalLinks++;
            if (isOpened) openedCount++;
            if (isBlocked) blockedCount++;
            if (!isOpened && !isBlocked) newCount++;
        });
        this.totalLinksElement.textContent = totalLinks;
        this.newLinksElement.textContent = newCount;
        this.openedLinksElement.textContent = openedCount;
        this.blockedLinksElement.textContent = blockedCount;
    }

    updateUI() {
        const filteredLinks = this.getFilteredLinks();
        this.calculateStats();
        this.renderLinks(filteredLinks);
        this.updatePagination(filteredLinks);
        this.updateBulkActionsBar();
    }

    renderLinks(preFilteredLinks) {
        const filteredLinks = preFilteredLinks || this.getFilteredLinks();
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

        // 构建分组显示
        if (this.rankedGroups && this.rankedGroups.size > 1) {
            const pageUrls = new Set(pageLinks.map(l => l.url));
            const REGION_LABELS = {
                main: '主内容', article: '文章', section: '分区',
                other: '其他', nav: '导航', aside: '侧边栏',
                header: '页头', footer: '页脚'
            };
            const REGION_ICONS = {
                main: '📄', article: '📰', section: '📂',
                other: '🔗', nav: '🧭', aside: '📌',
                header: '🔝', footer: '📋'
            };

            this.rankedGroups.forEach((groupItems, region) => {
                const visibleItems = groupItems.filter(item => pageUrls.has(item.link.url));
                if (visibleItems.length === 0) return;

                // 区域标题
                const header = document.createElement('div');
                header.className = 'group-header';
                const icon = REGION_ICONS[region] || '🔗';
                const label = REGION_LABELS[region] || region;

                const iconSpan = document.createElement('span');
                iconSpan.className = 'group-icon';
                iconSpan.textContent = icon;

                const labelSpan = document.createElement('span');
                labelSpan.className = 'group-label';
                labelSpan.textContent = label;

                const countSpan = document.createElement('span');
                countSpan.className = 'group-count';
                countSpan.textContent = visibleItems.length;

                const openAllBtn = document.createElement('button');
                openAllBtn.className = 'group-open-btn';
                openAllBtn.textContent = '全部打开';
                openAllBtn.title = `打开所有${label}链接`;
                const groupUrls = visibleItems.map(item => item.link.url);
                openAllBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._openGroupLinks(groupUrls, visibleItems.map(i => i.link));
                });

                header.appendChild(iconSpan);
                header.appendChild(labelSpan);
                header.appendChild(countSpan);
                header.appendChild(openAllBtn);
                this.linksContainer.appendChild(header);

                // 链接列表
                visibleItems.forEach(item => {
                    const link = item.link;
                    const isOpened = this.openedLinks.has(link.url);
                    const isBlocked = this.isUrlBlocked(link.url);
                    const isSelected = this.selectedUrls.has(link.url);
                    const importance = this._getImportanceLevel(item.total);
                    const el = this.createLinkElement(link, isOpened, isBlocked, isSelected, importance);
                    this.linksContainer.appendChild(el);
                });
            });
        } else {
            // 无分组数据时（链接太少），直接渲染
            pageLinks.forEach(link => {
                const isOpened = this.openedLinks.has(link.url);
                const isBlocked = this.isUrlBlocked(link.url);
                const isSelected = this.selectedUrls.has(link.url);
                const el = this.createLinkElement(link, isOpened, isBlocked, isSelected, 'medium');
                this.linksContainer.appendChild(el);
            });
        }
    }

    _getImportanceLevel(score) {
        if (score >= 70) return 'high';
        if (score >= 45) return 'medium';
        return 'low';
    }

    async _openGroupLinks(urls, linkObjects) {
        const unopenedUrls = urls.filter(u => !this.openedLinks.has(u));
        if (unopenedUrls.length === 0) {
            this.showToast('该分组内所有链接已打开');
            return;
        }
        const linksToOpen = linkObjects.filter(l => unopenedUrls.includes(l.url));
        for (const link of linksToOpen) {
            await this.openLink(link.url, link.title);
        }
        await this.batchSaveOpenedLinks(unopenedUrls, []);
        this.showToast(`🔗 已打开 ${unopenedUrls.length} 个链接`);
        this.updateUI();
    }

    getEmptyStateHtml(totalFiltered) {
        if (totalFiltered === 0) {
            if (this.searchQuery) {
                const safeQuery = this.escapeHtml(this.searchQuery);
                return `<div class="empty-state">没有找到匹配 "<strong>${safeQuery}</strong>" 的链接</div>`;
            } else if (this.hideOpenedLinks || this.hideBlockedLinks) {
                return '<div class="empty-state">所有链接已打开或已隐藏</div>';
            } else {
                return '<div class="empty-state">没有找到链接</div>';
            }
        }
        return '<div class="empty-state">没有找到链接</div>';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    createLinkElement(link, isOpened, isBlocked, isSelected, importance = 'medium') {
        const div = document.createElement('div');
        div.className = `link-item ${isOpened ? 'link-opened' : ''} ${isSelected ? 'selected' : ''}`;
        div.dataset.url = link.url;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'link-checkbox-bulk';
        checkbox.checked = isSelected;
        checkbox.title = '选择此项进行批量操作';
        checkbox.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSelectUrl(link.url, e.target.checked);
        });

        const importanceDot = document.createElement('span');
        importanceDot.className = `importance-dot importance-${importance}`;
        importanceDot.title = importance === 'high' ? '高相关性' : importance === 'medium' ? '中等相关性' : '低相关性';

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

        contentDiv.addEventListener('click', () => {
            this.openLink(link.url, link.title);
            if (!this.openedLinks.has(link.url)) {
                this.toggleLinkOpened(link.url, true);
            }
        });

        div.appendChild(checkbox);
        div.appendChild(importanceDot);
        div.appendChild(contentDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'link-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'link-action-btn copy-btn';
        copyBtn.title = '复制链接';
        copyBtn.textContent = '📋';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyLink(link.url);
        });

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

    toggleSelectUrl(url, selected) {
        if (selected) {
            this.selectedUrls.add(url);
        } else {
            this.selectedUrls.delete(url);
        }
        this.updateBulkActionsBar();

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

    updatePagination(preFilteredLinks) {
        const filteredLinks = preFilteredLinks || this.getFilteredLinks();
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
        for (const link of pageLinks) {
            await this.openLink(link.url, link.title);
        }
        await this.batchSaveOpenedLinks(pageLinks.map(l => l.url), []);
        if (this.autoMoveOpened) {
            this.sortLinks();
            this.updateUI();
        } else {
            this.renderLinks();
        }
    }

    async openLink(url, title) {
        try {
            await chrome.tabs.create({ url, active: false });
            this.rankingEngine.recordSessionClick(url);
            this.recordLinkClicked(url, title || '').catch(err =>
                console.error('记录链接历史失败:', err)
            );
        } catch (error) {
            console.error('打开链接失败:', error);
        }
    }

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

    async blockLink(url, blockBtn) {
        if (this.filteredUrls.includes(url)) {
            this.showToast('该链接已在屏蔽列表中');
            return;
        }
        this.filteredUrls.push(url);
        this.selectedUrls.delete(url);
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
        this.selectedUrls.delete(url);
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
        this.updateUI();
    }

    removeBlockedDomainFromView(domainOrDomains) {
        const domains = Array.isArray(domainOrDomains) ? domainOrDomains : [domainOrDomains];
        this.links = this.links.filter(link => {
            try {
                const linkDomain = new URL(link.url).hostname;
                return !domains.some(d => linkDomain === d || linkDomain.endsWith('.' + d));
            } catch (e) { return true; }
        });
        this.currentPage = 1;
        this.updateUI();
    }

    removeBlockedLinkFromView(url) {
        this.links = this.links.filter(link => link.url !== url);
        this.currentPage = 1;
        this.updateUI();
    }

    removeBlockedLinksFromView(urls) {
        const urlSet = new Set(urls);
        this.links = this.links.filter(link => !urlSet.has(link.url));
        this.currentPage = 1;
        this.updateUI();
    }

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

    removeBlockedPathPatternFromView(pattern) {
        try {
            const regex = new RegExp(pattern, 'i');
            this.links = this.links.filter(link => {
                try {
                    const urlObj = new URL(link.url);
                    return !regex.test(urlObj.pathname + urlObj.search) && !regex.test(urlObj.pathname);
                } catch (e) { return true; }
            });
        } catch (e) {}
        this.currentPage = 1;
        this.updateUI();
    }

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

    updateBlockedUrlsBar() {
        const totalBlocked = this.filteredUrls.length + this.filteredDomains.length + this.filteredPathPatterns.length;
        if (totalBlocked === 0) {
            this.blockedUrlsBar.style.display = 'none';
            return;
        }
        this.blockedUrlsBar.style.display = 'block';
        this.blockedUrlsTags.innerHTML = '';

        this.filteredPathPatterns.forEach(pattern => {
            const tag = document.createElement('span');
            tag.className = 'blocked-tag path-tag';
            const shortPattern = pattern.length > 20 ? pattern.substring(0, 17) + '...' : pattern;
            tag.innerHTML = `🔗 ${shortPattern} <span class="remove-tag">✕</span>`;
            tag.title = `点击取消路径模式屏蔽: ${pattern}`;
            tag.addEventListener('click', () => this.removeBlockedPathPattern(pattern));
            this.blockedUrlsTags.appendChild(tag);
        });

        this.filteredDomains.forEach(domain => {
            const tag = document.createElement('span');
            tag.className = 'blocked-tag domain-tag';
            const shortDomain = domain.length > 25 ? domain.substring(0, 22) + '...' : domain;
            tag.innerHTML = `🌐 ${shortDomain} <span class="remove-tag">✕</span>`;
            tag.title = `点击取消域名屏蔽: ${domain}`;
            tag.addEventListener('click', () => this.removeBlockedDomain(domain));
            this.blockedUrlsTags.appendChild(tag);
        });

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

document.addEventListener('DOMContentLoaded', () => {
    new LinkManager();
});