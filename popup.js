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
        this.selectedUrls = new Set();
        this.currentPage = 1;
        this.pageSize = 5;
        this.autoMoveOpened = true;
        this.hideOpenedLinks = true;
        this.hideBlockedLinks = true;
        this.searchQuery = '';
        this.retryCount = 0;
        this.maxRetries = 3;
        this.isInitialized = false;
        this.linkHistory = [];

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
            const result = await chrome.storage.local.get(['autoMoveOpened', 'hideOpenedLinks', 'hideBlockedLinks', 'enableFilter', 'enablePathPatternFilter']);
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
        if (!text) return [];
        const stopWords = new Set([
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
            'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
            'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
            'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every',
            'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'only',
            'own', 'same', 'than', 'too', 'very', 'just', 'this', 'that', 'these',
            'those', 'it', 'its', 'here', 'there', 'when', 'where', 'why', 'how',
            'which', 'who', 'whom', 'what', '新', '最新', '的', '了', '在', '是',
            '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也',
            '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
            '自己', '这', '他', '她', '它', '们', '那', '些', '什么', '怎么',
            '如何', '哪个', '为什么', '因为', '所以', '但是', '而且', '或者',
            '如果', '虽然', '然后', '可以', '应该', '需要', '已经', '还是',
            '比较', '非常', '真的', '关于', '对于', '你们', '我们', '他们',
            '进行', '使用', '通过', '以及', '只是', '就是', '更多', '查看',
            '了解', '阅读', '详情', '点击', '链接', '更多', '更多', '&', '|'
        ]);
        return text.toLowerCase()
            .split(/\W+/)
            .filter(w => w.length > 1 && !stopWords.has(w))
            .slice(0, 8);
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

    computeHistoryScore(item, stats) {
        if (this.linkHistory.length === 0) return 50;
        let score = 50;
        const link = item.link;
        const domain = item.domain;
        const title = (link.title || '').trim().toLowerCase();

        // 1) 域名亲和力（Medium 式偏好加权）
        const domainRecords = this.linkHistory.filter(h => h.domain === domain);
        if (domainRecords.length > 0) {
            const totalClicks = domainRecords.reduce((sum, r) => sum + (r.clickCount || 0), 0);
            if (totalClicks >= 5) {
                score += 15;
                const days = this.daysSince(domainRecords.reduce((max, r) => Math.max(max, r.lastClicked || 0), 0));
                if (days > 14) score -= 5;
            } else if (totalClicks >= 2) {
                score += 8;
            }
        }

        // 2) 主题偏好匹配（TF-IDF 式关键词相似度）
        if (title && !title.startsWith('http')) {
            const currentWords = this.getTopicWords(title);
            const allHistoryWords = new Map();
            this.linkHistory.forEach(h => {
                (h.topicWords || []).forEach(w => {
                    allHistoryWords.set(w, (allHistoryWords.get(w) || 0) + (h.clickCount || 1));
                });
            });

            if (allHistoryWords.size > 0 && currentWords.length > 0) {
                let matchScore = 0;
                currentWords.forEach(w => {
                    if (allHistoryWords.has(w)) {
                        matchScore += Math.min(allHistoryWords.get(w), 5);
                    }
                });
                score += Math.min(matchScore * 2, 18);
            }
        }

        // 3) 会话连续性（YouTube 式近因加权）
        const today = new Date().toDateString();
        const todayHistory = this.linkHistory.filter(h => h.lastClickDate === today);
        if (todayHistory.length > 0) {
            const todayTopicWords = new Set();
            todayHistory.forEach(h => (h.topicWords || []).forEach(w => todayTopicWords.add(w)));
            const currentWords = this.getTopicWords(title);
            const topicOverlap = currentWords.filter(w => todayTopicWords.has(w)).length;
            if (topicOverlap >= 2) score += 8;
        }

        // 4) 疲劳惩罚（同域名今天点击过多 → 降权）
        const todayDomainClicks = this.linkHistory
            .filter(h => h.domain === domain && h.lastClickDate === today)
            .reduce((sum, r) => sum + (r.todayCount || 0), 0);
        if (todayDomainClicks >= 5) {
            score -= 12;
        } else if (todayDomainClicks >= 3) {
            score -= 5;
        }

        // 5) 全局首次出现加分
        if (!this.linkHistory.some(h => h.url === link.url)) {
            score += 6;
        }

        return Math.max(0, Math.min(score, 100));
    }

    daysSince(timestamp) {
        return timestamp ? Math.floor((Date.now() - timestamp) / 86400000) : 999;
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
                hideBlockedLinks: this.hideBlockedLinks
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

    // ========== 多阶段智能排序系统 ==========

    sortLinks() {
        if (this.links.length < 4) {
            // 链接太少，简单排序即可
            this.links.sort((a, b) => a.url.localeCompare(b.url));
            return;
        }

        const stats = this.computeLinkStatistics();
        
        // 阶段1：增强打分（基础分 + 历史偏好 + 新颖度 三维融合）
        const scoredLinks = this.links.map(link => {
            const baseScore = this.computeIntelligentScore(link, stats);
            const domain = this.getDomainFromUrl(link.url) || 'unknown';
            const item = { link, baseScore, domain };

            const historyScore = this.computeHistoryScore(item, stats);
            const noveltyScore = this.computeNoveltyScore(link, stats);

            // 最终分 = 页面质量×0.50 + 历史偏好×0.35 + 探索奖励×0.15
            const compositeScore = baseScore * 0.50 + historyScore * 0.35 + noveltyScore * 0.15;

            return {
                link,
                compositeScore,
                baseScore,
                noveltyScore,
                historyScore,
                isOpened: this.openedLinks.has(link.url),
                domain,
                category: null
            };
        });

        // 阶段2：三分类（core / interest / explore）
        scoredLinks.forEach(item => {
            item.category = this.categorizeLink(item, stats);
        });

        // 未打开的排前面
        const unopened = scoredLinks.filter(item => !item.isOpened);
        let opened = scoredLinks.filter(item => item.isOpened);

        // 阶段3：组内按 compositeScore 降序
        const sortByScore = (arr) => arr.sort((a, b) => b.compositeScore - a.compositeScore);
        sortByScore(opened);

        // 阶段4：多样性交错排列（针对未打开链接）
        const interleaved = this.diversityInterleave(unopened, stats);

        // 阶段5：域名分散（确保相邻项域名不同）
        const dispersed = this.domainDispersion(interleaved);

        // 阶段6：组内微扰动
        const finalUnopened = this.microShuffleWithinGroup(dispersed);

        // 已打开的排在最后
        const finalOrder = [...finalUnopened, ...opened];
        this.links = finalOrder.map(item => item.link);

        // debug 输出
        if (window.location.hash.includes('debug')) {
            console.table(finalOrder.slice(0, 15).map((item, i) => ({
                rank: i + 1,
                title: (item.link.title || '').substring(0, 40),
                category: item.category,
                composite: item.compositeScore.toFixed(1),
                base: item.baseScore.toFixed(1),
                novelty: item.noveltyScore.toFixed(1),
                domain: item.domain,
                opened: item.isOpened ? '✓' : ''
            })));
        }
    }

    computeNoveltyScore(link, stats) {
        let score = 50;

        try {
            const url = link.url;
            const domain = new URL(url).hostname;
            const domainCount = stats.domainCounts.get(domain) || 1;
            
            // 罕见域名加分（当前页面内）
            if (stats.totalDomainTypes > 1) {
                const rarity = 1 - (domainCount / stats.maxDomainCount);
                score += rarity * 25;
            } else {
                score += 5;
            }

            // 跨域链接加分（与当前页面不同域名）
            if (!this.isSameDomain(url)) {
                score += 18;
            }

            // 全局首次出现（Google Discover 式新鲜度）
            if (!this.linkHistory.some(h => h.url === url)) {
                score += 22;
            }

            // 域名从未访问过
            if (!this.linkHistory.some(h => h.domain === domain)) {
                score += 15;
            } else {
                // 至少 30 天没访问 → 轻微探索加分
                const lastVisit = Math.max(
                    ...this.linkHistory.filter(h => h.domain === domain).map(h => h.lastClicked || 0)
                );
                if (lastVisit && this.daysSince(lastVisit) > 30) {
                    score += 8;
                }
            }

            // 独特标题词汇加分
            const title = (link.title || '').trim().toLowerCase();
            if (title && !title.startsWith('http')) {
                const words = title.split(/\W+/).filter(w => w.length > 1);
                let uniqueCount = 0;
                for (const w of words) {
                    if (stats.uniqueWordsInTitles.has(w)) {
                        uniqueCount++;
                    }
                }
                const uniqueness = words.length > 0 ? uniqueCount / words.length : 0;
                score += (1 - uniqueness) * 12;
            }

            // URL 路径深度新颖性
            try {
                const depth = new URL(url).pathname.split('/').filter(Boolean).length;
                if (stats.avgPathDepth > 0) {
                    const depthDiff = Math.abs(depth - stats.avgPathDepth);
                    score += Math.min(depthDiff * 4, 10);
                }
            } catch (e) {}

            // 非 HTML 扩展名酌情加分（PDF / Markdown）
            const pathLower = new URL(url).pathname.toLowerCase();
            if (/\.(pdf|md|docx?|pptx?|xlsx?|csv)$/i.test(pathLower)) {
                score += 10;
            }

        } catch (e) {}

        return Math.max(0, Math.min(score, 100));
    }

    categorizeLink(item, stats) {
        const score = item.compositeScore;
        const base = item.baseScore;
        const novelty = item.noveltyScore;
        const link = item.link;
        const domain = item.domain;

        // 高基础分 + 内容区 + 优质标题 → 核心
        if (base >= 250 && link.isContentArea &&
            link.title && link.title.length >= 10 && !link.title.startsWith('http')) {
            return 'core';
        }

        // 高基础分但标题一般 → 核心（靠内容区/位置补足）
        if (base >= 230 && link.isContentArea) {
            return 'core';
        }

        // 高新颖度 + 跨域 → 探索
        if (novelty >= 65 && !this.isSameDomain(link.url)) {
            return 'explore';
        }

        // 中等分 + 有标题 → 兴趣
        if (score >= 200 && link.title && link.title.length >= 5) {
            return 'interest';
        }

        // 罕见域名 + 有一定分 → 探索
        try {
            const domainCount = stats.domainCounts.get(domain) || 1;
            if (domainCount <= 2 && score >= 150 && !this.isSameDomain(link.url)) {
                return 'explore';
            }
        } catch (e) {}

        // 剩下的按分数分
        if (score >= 220) return 'interest';
        if (score >= 150) return 'explore';
        return 'interest'; // 默认兴趣
    }

    diversityInterleave(scoredItems, stats) {
        if (scoredItems.length === 0) return [];

        // 按分类分桶，桶内按分数降序
        const buckets = {
            core: [],
            interest: [],
            explore: []
        };

        scoredItems.forEach(item => {
            if (buckets[item.category]) {
                buckets[item.category].push(item);
            } else {
                buckets.interest.push(item);
            }
        });

        // 桶内按 compositeScore 降序
        for (const cat of ['core', 'interest', 'explore']) {
            buckets[cat].sort((a, b) => b.compositeScore - a.compositeScore);
        }

        // 交错顺序：核心 → 兴趣 → 探索 → 循环
        const interleaveOrder = ['core', 'interest', 'explore'];
        const result = [];
        const indices = { core: 0, interest: 0, explore: 0 };
        let roundRobinIndex = 0;

        // 前 8 个位置使用严格交错
        const topCount = Math.min(8, scoredItems.length);
        for (let i = 0; i < topCount; i++) {
            const cat = interleaveOrder[roundRobinIndex % 3];
            if (indices[cat] < buckets[cat].length) {
                result.push(buckets[cat][indices[cat]]);
                indices[cat]++;
            }
            roundRobinIndex++;

            // 如果当前分类用完了，跳到下一个
            if (indices[cat] >= buckets[cat].length) {
                // 找个还有剩余的
                for (let offset = 1; offset <= 2; offset++) {
                    const nextCat = interleaveOrder[(roundRobinIndex + offset) % 3];
                    if (indices[nextCat] < buckets[nextCat].length) {
                        roundRobinIndex = (roundRobinIndex + offset);
                        break;
                    }
                }
            }
        }

        // 剩余按分数高低混合
        const remaining = [];
        for (const cat of ['core', 'interest', 'explore']) {
            while (indices[cat] < buckets[cat].length) {
                remaining.push(buckets[cat][indices[cat]]);
                indices[cat]++;
            }
        }
        remaining.sort((a, b) => b.compositeScore - a.compositeScore);

        return [...result, ...remaining];
    }

    domainDispersion(items) {
        if (items.length <= 2) return items;

        const result = [];
        const remaining = [...items];

        while (remaining.length > 0) {
            // 找分数最高且与上一个域名不同的项
            let bestIndex = 0;
            const lastDomain = result.length > 0 ? result[result.length - 1].domain : null;

            // 优先选不同域名的
            let found = false;
            for (let i = 0; i < remaining.length; i++) {
                if (remaining[i].domain !== lastDomain || lastDomain === null) {
                    // 找这个候选中的最高分
                    if (!found || remaining[i].compositeScore > remaining[bestIndex].compositeScore) {
                        bestIndex = i;
                        found = true;
                    }
                }
            }

            // 如果所有剩余项都是同域名，就选最高分
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

    microShuffleWithinGroup(items) {
        if (items.length <= 4) return items;

        const result = [...items];

        // 对中间段（跳过前2和后2）做局部随机微调
        const start = 2;
        const end = Math.max(result.length - 2, start);

        for (let i = end - 1; i > start; i--) {
            // 只在同分类或同域名段内微调
            const swapWindow = Math.min(3, i - start + 1);
            const j = i - Math.floor(Math.random() * swapWindow);

            if (i !== j) {
                const di = result[i].domain;
                const dj = result[j].domain;
                const dPrevI = i > 0 ? result[i - 1].domain : null;
                const dPrevJ = j > 0 ? result[j - 1].domain : null;
                const dNextI = i < result.length - 1 ? result[i + 1].domain : null;
                const dNextJ = j < result.length - 1 ? result[j + 1].domain : null;

                const iCanMoveToJ = dj !== dPrevJ && di !== dNextJ;
                const jCanMoveToI = di !== dPrevI && dj !== dNextI;

                if (iCanMoveToJ && jCanMoveToI) {
                    [result[i], result[j]] = [result[j], result[i]];
                }
            }
        }

        return result;
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
            uniqueWordsInTitles: new Set()
        };

        let totalTitleLength = 0;

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
                title.toLowerCase().split(/\W+/).filter(w => w.length > 1).forEach(w => {
                    stats.uniqueWordsInTitles.add(w);
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

        return stats;
    }

    computeIntelligentScore(link, stats) {
        let score = 0;
        const weights = {
            freshness: 150,
            relevance: 100,
            authority: 80,
            quality: 70,
            position: 60,
            semantic: 50,
            engagement: 40
        };

        if (!this.openedLinks.has(link.url)) {
            score += weights.freshness;
            try {
                const domain = new URL(link.url).hostname;
                if (stats.domainCounts.get(domain) === 1) {
                    score += 20;
                }
            } catch (e) {}
        }

        score += this.calculateRelevanceScore(link, stats) * (weights.relevance / 100);
        score += this.calculateAuthorityScore(link, stats) * (weights.authority / 100);
        score += this.calculateQualityScore(link, stats) * (weights.quality / 100);
        score += this.calculatePositionScore(link, stats) * (weights.position / 100);
        score += this.calculateSemanticScore(link) * (weights.semantic / 100);
        score += this.calculateEngagementScore(link) * (weights.engagement / 100);

        if (this.isSameDomain(link.url)) {
            score += 25;
        }

        return score;
    }

    calculateRelevanceScore(link, stats) {
        let score = 0;
        
        try {
            const urlObj = new URL(link.url);
            const pathLower = urlObj.pathname.toLowerCase();
            
            const highValuePatterns = [
                { pattern: /\/(article|post|story|read|content|detail|view)\//i, weight: 25 },
                { pattern: /\/(blog|news|magazine|journal)\//i, weight: 20 },
                { pattern: /\/(tutorial|guide|howto|docs|documentation)\//i, weight: 22 },
                { pattern: /\/(research|paper|study|analysis|report)\//i, weight: 24 },
                { pattern: /\/(about|intro|overview|summary)\//i, weight: 15 },
                { pattern: /\/(202[0-9]|20[0-9]{3})\//, weight: 18 },
                { pattern: /\/[a-z0-9]+([-_.][a-z0-9]+){2,}/i, weight: 16 }
            ];

            for (const { pattern, weight } of highValuePatterns) {
                if (pattern.test(pathLower)) {
                    score += weight;
                    break;
                }
            }

            const ext = pathLower.split('.').pop();
            const valuableExtensions = {
                'html': 5, 'htm': 5, '': 5,
                'pdf': 12,
                'md': 10,
            };
            if (valuableExtensions[ext]) {
                score += valuableExtensions[ext];
            }

            const params = new URLSearchParams(urlObj.search);
            const usefulParams = ['id', 'page', 'category', 'tag', 'q', 'search'];
            const hasUsefulParams = Array.from(params.keys()).some(k => 
                usefulParams.some(up => k.toLowerCase().includes(up))
            );
            if (hasUsefulParams) score += 8;

        } catch (e) {}

        return Math.min(score, 100);
    }

    calculateAuthorityScore(link, stats) {
        let score = 50;

        try {
            const urlObj = new URL(link.url);
            
            const pathDepth = urlObj.pathname.split('/').filter(Boolean).length;
            score += Math.max(0, 8 - pathDepth) * 5;

            if (!urlObj.search) {
                score += 15;
            } else {
                const params = new URLSearchParams(urlObj.search);
                const paramCount = Array.from(params.keys()).length;
                
                if (paramCount <= 2) {
                    score += 5;
                } else {
                    score -= (paramCount - 2) * 3;
                }

                const trackingParams = [
                    'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
                    'fbclid', 'gclid', 'gclsrc', 'dclid', 'msclkid',
                    'ref', 'source', 'tracking', 'gbraid', 'wbraid', 'twclid', 'igshid',
                    'si', 'feature', 't', 's', 'affiliate', 'partner'
                ];
                const trackingCount = Array.from(params.keys()).filter(k => 
                    trackingParams.includes(k.toLowerCase())
                ).length;
                score -= trackingCount * 8;
            }

            if (urlObj.protocol === 'https:') {
                score += 10;
            }

            const domainCount = stats.domainCounts.get(urlObj.hostname) || 1;
            if (domainCount >= 3) {
                score += 10;
            }

        } catch (e) {}

        return Math.max(0, Math.min(score, 100));
    }

    calculateQualityScore(link, stats) {
        let score = 0;

        if (link.isContentArea) {
            score += 30;
        }

        if (link.textLength) {
            if (link.textLength >= 10 && link.textLength <= 100) {
                score += 15;
            } else if (link.textLength > 100) {
                score += 8;
            }
        }

        if (link.contextQuality) {
            score += link.contextQuality * 20;
        }

        if (link.elementSize) {
            const { width, height } = link.elementSize;
            const area = width * height;
            if (area > 5000 && area < 50000) {
                score += 10;
            }
        }

        return Math.min(score, 100);
    }

    calculatePositionScore(link, stats) {
        let score = 0;

        if (stats.maxYPosition > 0 && link.yPosition !== undefined && link.yPosition >= 0) {
            const normalizedY = link.yPosition / stats.maxYPosition;

            if (normalizedY < 0.1) {
                score = 35;
            } else if (normalizedY < 0.25) {
                score = 30;
            } else if (normalizedY < 0.4) {
                score = 25;
            } else if (normalizedY < 0.6) {
                score = 18;
            } else if (normalizedY < 0.8) {
                score = 12;
            } else {
                score = 6;
            }

            if (link.xPosition !== undefined) {
                const normalizedX = link.xPosition / (link.viewportWidth || 1200);
                if (normalizedX < 0.33) {
                    score += 5;
                }
            }
        }

        return score;
    }

    calculateSemanticScore(link) {
        const title = (link.title || '').trim();
        const anchorText = (link.anchorText || '').trim();
        
        const bestText = this.selectBestText(title, anchorText, link.url);
        
        let score = this.analyzeTextQuality(bestText);

        if (title && anchorText && title !== anchorText) {
            const similarity = this.calculateTextSimilarity(title, anchorText);
            if (similarity > 0.5) {
                score += 10;
            }
        }

        return Math.min(score, 100);
    }

    selectBestText(title, anchorText, url) {
        const titleQuality = this.getTextQualityMetrics(title);
        const anchorQuality = this.getTextQualityMetrics(anchorText);

        if (titleQuality.score > anchorQuality.score * 1.2) {
            return title;
        } else if (anchorQuality.score > titleQuality.score * 1.2) {
            return anchorText;
        }
        
        return title.length > anchorText.length ? title : anchorText;
    }

    getTextQualityMetrics(text) {
        if (!text || text.trim().length === 0) {
            return { score: 0, length: 0, wordCount: 0 };
        }

        const normalized = text.trim();
        const length = normalized.length;
        const wordCount = normalized.split(/\s+/).length;
        
        let score = 0;
        
        if (length >= 15 && length <= 80) score += 30;
        else if (length >= 10 && length <= 120) score += 20;
        else if (length > 5) score += 10;

        if (wordCount >= 3 && wordCount <= 12) score += 20;
        else if (wordCount >= 2) score += 10;

        if (/[\u4e00-\u9fa5a-zA-Z]/.test(normalized)) score += 15;

        if (!normalized.startsWith('http') && !normalized.includes('://')) score += 15;

        return { score, length, wordCount };
    }

    analyzeTextQuality(text) {
        const metrics = this.getTextQualityMetrics(text);
        let score = metrics.score;

        const normalized = text.trim().toLowerCase();

        const negativePatterns = [
            { pattern: /^(更多|more|learn more|read more|点击|click|here|这里|详情|detail|查看|link|url)$/i, penalty: 20 },
            { pattern: /^(下一页|上一页|prev|next|»|«|>>|<<)$/i, penalty: 15 },
            { pattern: /^(分享|share|收藏|favorite|打印|print)$/i, penalty: 12 },
            { pattern: /^(广告|ad|sponsored|推广|promotion)$/i, penalty: 25 },
            { pattern: /^[\d\s\-|.,;:!?()[\]{}#@$^&*+=/\\`~]+$/, penalty: 15 },
        ];

        for (const { pattern, penalty } of negativePatterns) {
            if (pattern.test(normalized)) {
                score -= penalty;
                break;
            }
        }

        const positivePatterns = [
            { pattern: /(如何|how to|教程|guide|方法|way to)/i, bonus: 10 },
            { pattern: /(最佳|best|top|优秀|great)/i, bonus: 8 },
            { pattern: /(完整|complete|全面|comprehensive)/i, bonus: 8 },
            { pattern: /(免费|free|开源|open source)/i, bonus: 6 },
            { pattern: /(202[4-9]|最新|latest|new)/i, bonus: 10 },
        ];

        for (const { pattern, bonus } of positivePatterns) {
            if (pattern.test(normalized)) {
                score += bonus;
            }
        }

        return Math.max(0, Math.min(score, 100));
    }

    calculateTextSimilarity(text1, text2) {
        const words1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 2));
        const words2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 2));
        
        const intersection = new Set([...words1].filter(w => words2.has(w)));
        const union = new Set([...words1, ...words2]);
        
        return union.size > 0 ? intersection.size / union.size : 0;
    }

    calculateEngagementScore(link) {
        let score = 50;

        if (link.isFeatured || link.isHighlighted) {
            score += 20;
        }

        if (link.hasImage || link.isImageLink) {
            score += 10;
        }

        if (link.socialSignals) {
            score += Math.min(link.socialSignals * 5, 20);
        }

        if (link.hasHoverEffect) {
            score += 5;
        }

        return Math.min(score, 100);
    }

    fineGrainedCompare(linkA, linkB, stats) {
        try {
            const urlA = new URL(linkA.url);
            const urlB = new URL(linkB.url);

            const isSameDomainA = this.isSameDomain(linkA.url);
            const isSameDomainB = this.isSameDomain(linkB.url);
            if (isSameDomainA !== isSameDomainB) {
                return isSameDomainA ? -1 : 1;
            }

            const depthA = urlA.pathname.split('/').filter(Boolean).length;
            const depthB = urlB.pathname.split('/').filter(Boolean).length;
            if (depthA !== depthB) return depthA - depthB;

            const paramsA = new URLSearchParams(urlA.search).toString().length;
            const paramsB = new URLSearchParams(urlB.search).toString().length;
            if (paramsA !== paramsB) return paramsA - paramsB;

            const domainCompare = urlA.hostname.localeCompare(urlB.hostname);
            if (domainCompare !== 0) return domainCompare;

            return urlA.pathname.localeCompare(urlB.pathname);

        } catch (e) {
            return linkA.url.localeCompare(linkB.url);
        }
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
        if (this.enablePathPatternFilter && this.filteredPathPatterns.length > 0) {
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
        const totalLinks = this.links.length;
        let openedCount = 0;
        let blockedCount = 0;
        this.links.forEach(link => {
            const isBlocked = this.isUrlBlocked(link.url);
            const isOpened = this.openedLinks.has(link.url);
            if (isBlocked) blockedCount++;
            if (isOpened && !isBlocked) openedCount++;
        });
        this.totalLinksElement.textContent = totalLinks;
        this.newLinksElement.textContent = Math.max(0, totalLinks - openedCount - blockedCount);
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

    createLinkElement(link, isOpened, isBlocked, isSelected) {
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
            // 异步记录到历史缓存（不阻塞）
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