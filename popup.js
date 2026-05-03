class LinkManager {
    constructor() {
        this.links = [];
        this.openedLinks = new Set();
        this.filteredUrls = [];
        this.filteredDomains = [];
        this.filteredPathPatterns = [];
        this.selectedUrls = new Set();
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
                this.showToast(`🌐 已屏蔽 ${newDomains.length} 个域名`);
                this.fetchLinks();
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

    // ========== 顶尖智能排序系统 ==========

    sortLinks() {
        const stats = this.computeLinkStatistics();
        
        const scoredLinks = this.links.map(link => ({
            link,
            score: this.computeIntelligentScore(link, stats),
            isOpened: this.openedLinks.has(link.url)
        }));

        scoredLinks.sort((a, b) => {
            if (this.autoMoveOpened && a.isOpened !== b.isOpened) {
                return a.isOpened ? 1 : -1;
            }

            const scoreDiff = b.score - a.score;
            if (Math.abs(scoreDiff) > 0.1) return scoreDiff;

            return this.fineGrainedCompare(a.link, b.link, stats);
        });

        this.links = scoredLinks.map(item => item.link);
        
        if (window.location.hash.includes('debug')) {
            console.table(scoredLinks.slice(0, 10).map((item, i) => ({
                rank: i + 1,
                title: item.link.title?.substring(0, 40),
                score: item.score.toFixed(2),
                isOpened: item.isOpened
            })));
        }
    }

    computeLinkStatistics() {
        const stats = {
            maxYPosition: 0,
            domainCounts: new Map(),
            pathDepths: [],
            contentAreaLinks: 0,
            hasTitleCount: 0,
            avgTitleLength: 0,
            urlPatterns: new Map()
        };

        let totalTitleLength = 0;

        this.links.forEach(link => {
            if (link.yPosition > stats.maxYPosition) {
                stats.maxYPosition = link.yPosition;
            }

            try {
                const domain = new URL(link.url).hostname;
                stats.domainCounts.set(domain, (stats.domainCounts.get(domain) || 0) + 1);
            } catch (e) {}

            if (link.isContentArea) stats.contentAreaLinks++;

            const title = (link.title || '').trim();
            if (title && !title.startsWith('http')) {
                stats.hasTitleCount++;
                totalTitleLength += title.length;
            }

            try {
                const depth = new URL(link.url).pathname.split('/').filter(Boolean).length;
                stats.pathDepths.push(depth);
            } catch (e) {}
        });

        stats.avgTitleLength = stats.hasTitleCount > 0 ? 
            totalTitleLength / stats.hasTitleCount : 0;

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
                    } catch (e) {}
                }
            } catch (e) {}
        }
        return false;
    }

    isDomainBlocked(url) {
        const domain = this.getDomainFromUrl(url);
        return domain && this.filteredDomains.includes(domain);
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
            this.openLink(link.url);
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

    removeBlockedDomainFromView(domain) {
        const before = this.links.length;
        this.links = this.links.filter(link => {
            try { return new URL(link.url).hostname !== domain; } catch (e) { return true; }
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