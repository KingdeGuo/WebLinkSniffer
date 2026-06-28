/**
 * Adaptive Ranking Engine v3
 *
 * 三维排序范式：
 * 1. 页面上下文理解（这是什么类型的页面？哪些链接最重要？）
 * 2. 链接语义理解（这个链接是什么？它和页面的关系是什么？）
 * 3. 用户行为学习（这个用户现在在做什么？他关心什么？）
 */

class RankingEngine {
    constructor() {
        this.sessionClicks = [];          // 本次会话的点击记录
        this.sessionDomainCounts = new Map(); // 会话内域名点击统计
    }

    // ====================================================================
    // 1. 页面上下文理解
    // ====================================================================

    /**
     * 检测页面类型，返回类型标识和该类型下的链接重要性权重
     */
    detectPageType(pageUrl, pageMeta) {
        const url = (pageUrl || '').toLowerCase();
        const title = (pageMeta?.title || '').toLowerCase();
        const desc = (pageMeta?.description || '').toLowerCase();
        const body = (pageMeta?.bodyText || '').substring(0, 2000).toLowerCase();

        // GitHub
        if (url.includes('github.com')) {
            if (url.match(/github\.com\/[^/]+\/[^/]+$/)) return 'github-repo';
            if (url.includes('/issues') || url.includes('/pull/')) return 'github-issues';
            return 'github';
        }

        // 技术文档
        if (url.includes('docs.') || url.includes('/docs/') || url.includes('/documentation/') ||
            url.includes('/api/') || url.includes('/reference/') || url.includes('/handbook/')) {
            return 'docs';
        }

        // Stack Overflow / 问答
        if (url.includes('stackoverflow.com') || url.includes('quora.com') ||
            url.includes('/questions/') || url.includes('/q/')) {
            return 'qa';
        }

        // 新闻/资讯
        if (url.includes('news') || url.includes('bbc.') || url.includes('cnn.') ||
            url.includes('reuters.') || url.includes('/article/') || url.includes('/story/')) {
            return 'news';
        }

        // 博客/文章
        if (url.includes('blog') || url.includes('/post/') || url.includes('/article/') ||
            url.includes('/p/') || body.includes('发表于') || body.includes('published')) {
            return 'blog';
        }

        // 电商
        if (url.includes('amazon.') || url.includes('taobao.') || url.includes('jd.') ||
            url.includes('/product/') || url.includes('/item/')) {
            return 'ecommerce';
        }

        // 视频
        if (url.includes('youtube.') || url.includes('bilibili.') || url.includes('vimeo.')) {
            return 'video';
        }

        // 论坛
        if (url.includes('reddit.') || url.includes('/forum/') || url.includes('/thread/')) {
            return 'forum';
        }

        // Wikipedia
        if (url.includes('wikipedia.') || url.includes('wiki')) {
            return 'wiki';
        }

        return 'generic';
    }

    /**
     * 根据页面类型返回区域权重调整策略
     */
    getPageTypeStrategy(pageType) {
        const strategies = {
            'github-repo': {
                regionBoost: { main: 10, aside: 15, nav: 5 },
                linkBoost: { sameDomain: 20, hasCodePath: 25, hasReadme: 30 },
                penalty: { tracking: 15 }
            },
            'docs': {
                regionBoost: { main: 15, aside: 10, nav: 0 },
                linkBoost: { sameDomain: 15, hasTutorialPath: 20, hasApiPath: 15 },
                penalty: { tracking: 10 }
            },
            'blog': {
                regionBoost: { main: 20, aside: 5, nav: -5 },
                linkBoost: { sameDomain: 10, hasArticlePath: 15, hasYearPath: 10 },
                penalty: { tracking: 12 }
            },
            'news': {
                regionBoost: { main: 25, aside: 0, nav: -10 },
                linkBoost: { sameDomain: 5, hasArticlePath: 20, hasYearPath: 15 },
                penalty: { tracking: 15 }
            },
            'qa': {
                regionBoost: { main: 20, aside: 5, nav: -5 },
                linkBoost: { sameDomain: 15, hasAnswerLink: 20 },
                penalty: { tracking: 10 }
            },
            'wiki': {
                regionBoost: { main: 15, aside: 10, nav: 0 },
                linkBoost: { sameDomain: 20, hasReferencePath: 15 },
                penalty: { tracking: 5 }
            },
            'generic': {
                regionBoost: {},
                linkBoost: { sameDomain: 10 },
                penalty: { tracking: 10 }
            }
        };
        return strategies[pageType] || strategies.generic;
    }

    // ====================================================================
    // 2. 链接语义理解
    // ====================================================================

    /**
     * 分析链接的语义角色（它是干什么的？）
     */
    classifyLinkSemantics(link, stats) {
        const title = (link.title || '').trim().toLowerCase();
        const url = link.url || '';
        const semantics = [];

        // 内容链接（文章、教程、博客）
        if (link.isContentArea) {
            if (title.length >= 10) semantics.push('content');
        }

        // 导航链接
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            if (pathParts.length <= 1 && !urlObj.search) {
                semantics.push('navigation');
            }
        } catch (e) {}

        // 外部引用
        if (!this._isSameDomain(url, stats.currentPageUrl)) {
            semantics.push('external');
        }

        // 资源链接（PDF、文档等）
        try {
            const ext = new URL(url).pathname.split('.').pop().toLowerCase();
            if (['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'zip', 'tar', 'gz'].includes(ext)) {
                semantics.push('resource');
            }
        } catch (e) {}

        // 代码链接（GitHub、GitLab 等）
        if (url.includes('github.com') || url.includes('gitlab.com') || url.includes('bitbucket.org')) {
            semantics.push('code');
        }

        // 社交链接
        if (url.match(/(twitter\.com|x\.com|facebook\.com|linkedin\.com|weibo\.com)/)) {
            semantics.push('social');
        }

        if (semantics.length === 0) semantics.push('other');
        return semantics;
    }

    /**
     * 分析锚文本质量
     */
    anchorTextScore(link) {
        const title = (link.title || '').trim();
        if (!title || title.startsWith('http')) return 0;

        let score = 0;
        const words = title.split(/\s+/);

        // 描述性长度：3-15 词最佳
        if (words.length >= 3 && words.length <= 15) score += 20;
        else if (words.length >= 2) score += 10;
        else score -= 5;

        // 字符长度：15-80 最佳
        if (title.length >= 15 && title.length <= 80) score += 15;
        else if (title.length >= 8) score += 8;

        // 包含动词（描述性锚文本的特征）
        const verbs = ['如何', '怎么', '使用', '安装', '配置', '创建', '构建', '实现',
            'how', 'use', 'install', 'setup', 'create', 'build', 'implement', 'learn'];
        if (verbs.some(v => title.toLowerCase().includes(v))) score += 10;

        // 包含具体名词（非泛化文本）
        if (/\b(api|sdk|guide|tutorial|docs?|reference|example|demo)\b/i.test(title)) score += 8;

        // 导航/通用文本惩罚
        const genericPatterns = [
            /^(更多|more|learn more|read more|点击|click|here|这里|详情|detail|查看|link|url)$/i,
            /^(下一页|上一页|prev|next|»|«)$/i,
            /^(分享|share|收藏|favorite)$/i,
            /^(广告|ad|sponsored|推广|promotion)$/i,
        ];
        if (genericPatterns.some(p => p.test(title))) score -= 25;

        return Math.max(-20, Math.min(score, 50));
    }

    // ====================================================================
    // 3. 用户行为学习
    // ====================================================================

    /**
     * 记录本次会话的点击行为
     */
    recordSessionClick(url) {
        const domain = this._getDomain(url);
        if (!domain) return;

        this.sessionClicks.push({ url, domain, time: Date.now() });
        this.sessionDomainCounts.set(domain, (this.sessionDomainCounts.get(domain) || 0) + 1);
    }

    /**
     * 分析会话行为模式
     */
    analyzeSessionBehavior() {
        if (this.sessionClicks.length === 0) return { pattern: 'new', focus: null, diversity: 0 };

        // 最近 30 秒的点击
        const recent = this.sessionClicks.filter(c => Date.now() - c.time < 30000);
        const recentDomains = new Set(recent.map(c => c.domain));

        // 行为模式判断
        let pattern = 'browse'; // 默认浏览模式
        if (recent.length >= 3) {
            if (recentDomains.size <= 2) {
                pattern = 'deep-dive'; // 深度阅读：集中在少数域名
            } else {
                pattern = 'explore'; // 探索模式：跨多个域名
            }
        }

        // 关注焦点：最近点击最多的域名
        const focus = recent.length > 0 ?
            [...this.sessionDomainCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] : null;

        // 多样性：会话中不同域名的比例
        const uniqueDomains = new Set(this.sessionClicks.map(c => c.domain)).size;
        const diversity = this.sessionClicks.length > 0 ? uniqueDomains / this.sessionClicks.length : 0;

        return { pattern, focus, diversity, recentCount: recent.length };
    }

    /**
     * 根据会话行为动态调整分数
     */
    applySessionBoost(score, link, behavior) {
        const domain = this._getDomain(link.url);
        if (!domain) return score;

        let adjustment = 0;

        switch (behavior.pattern) {
            case 'deep-dive':
                // 深度阅读模式：优先同域名内容
                if (domain === behavior.focus) adjustment += 20;
                // 降低跨域链接的权重
                if (domain !== behavior.focus) adjustment -= 10;
                break;

            case 'explore':
                // 探索模式：优先跨域链接
                if (domain !== behavior.focus) adjustment += 15;
                // 降低同域名链接的权重（已经看够了）
                if (domain === behavior.focus) adjustment -= 8;
                break;

            case 'browse':
            default:
                // 浏览模式：保持默认
                break;
        }

        // 全局会话疲劳
        const sessionClicks = this.sessionDomainCounts.get(domain) || 0;
        if (sessionClicks >= 3) adjustment -= sessionClicks * 3;

        return score + adjustment;
    }

    // ====================================================================
    // 综合打分
    // ====================================================================

    computeScore(link, stats, userProfile, pageTypeStrategy) {
        let score = 0;

        // 1. 区域权重
        const region = this.classifyRegion(link);
        const regionBoost = pageTypeStrategy.regionBoost[region] || 0;
        score += (this.REGION_WEIGHTS[region] || 60) + regionBoost;

        // 2. 内容质量
        score += this.contentQualityScore(link, stats);

        // 3. 锚文本质量（新增）
        score += this.anchorTextScore(link);

        // 4. 用户兴趣匹配
        score += this.computeInterestScore(link, userProfile);

        // 5. 链接语义加分
        const semantics = this.classifyLinkSemantics(link, stats);
        if (semantics.includes('content')) score += 15;
        if (semantics.includes('navigation')) score -= 5;
        if (semantics.includes('resource')) score += 8;
        if (semantics.includes('social')) score -= 10;

        // 6. 页面类型特定加分
        const linkBoost = pageTypeStrategy.linkBoost || {};
        try {
            const urlObj = new URL(link.url);
            const path = urlObj.pathname.toLowerCase();
            const isSameDomain = this._isSameDomain(link.url, stats.currentPageUrl);

            if (linkBoost.sameDomain && isSameDomain) score += linkBoost.sameDomain;
            if (linkBoost.hasCodePath && (path.includes('/src/') || path.includes('/lib/') || path.includes('/tree/'))) {
                score += linkBoost.hasCodePath;
            }
            if (linkBoost.hasReadme && (path.includes('readme') || path.includes('CHANGELOG'))) {
                score += linkBoost.hasReadme;
            }
            if (linkBoost.hasTutorialPath && /(tutorial|guide|howto|learn)/i.test(path)) {
                score += linkBoost.hasTutorialPath;
            }
            if (linkBoost.hasArticlePath && /(article|post|blog|story|news)/i.test(path)) {
                score += linkBoost.hasArticlePath;
            }
            if (linkBoost.hasYearPath && /20(2[0-9]|3[0-9])/.test(path)) {
                score += (linkBoost.hasYearPath || 10);
            }
            if (linkBoost.hasReferencePath && /(reference|api|docs|spec)/i.test(path)) {
                score += (linkBoost.hasReferencePath || 10);
            }

            // 追踪参数惩罚
            const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid',
                'gclid', 'ref', 'source', 'feature', 'si', 't'];
            const trackingCount = Array.from(urlObj.searchParams.keys())
                .filter(k => trackingParams.includes(k.toLowerCase())).length;
            if (trackingCount > 0) score -= trackingCount * (pageTypeStrategy.penalty?.tracking || 8);
        } catch (e) {}

        // 7. 行为信号
        score += this.behaviorScore(link, stats);

        // 8. 新颖度
        score += this.noveltyScore(link, stats);

        // 9. 位置信号
        score += this.positionScore(link, stats);

        return { total: Math.max(0, score), region, semantics };
    }

    // ====================================================================
    // 主排序管线
    // ====================================================================

    rank(links, stats, linkHistory) {
        if (links.length === 0) return { ranked: [], groups: new Map(), scores: [] };

        // 1. 页面上下文
        const pageType = this.detectPageType(stats.currentPageUrl, stats.pageMeta);
        const pageTypeStrategy = this.getPageTypeStrategy(pageType);

        // 2. 用户兴趣画像
        const userProfile = this.computeUserInterestProfile(linkHistory);

        // 3. 会话行为分析
        const sessionBehavior = this.analyzeSessionBehavior();

        // 4. 逐链接打分
        const scored = links.map(link => {
            const { total, region, semantics } = this.computeScore(link, stats, userProfile, pageTypeStrategy);

            // 会话行为调整
            const adjustedScore = this.applySessionBoost(total, link, sessionBehavior);

            return { link, total: adjustedScore, region, semantics };
        });

        // 5. 排序
        scored.sort((a, b) => b.total - a.total);

        // 6. 分组（按区域 + 语义）
        const groups = new Map();
        const groupOrder = ['main', 'article', 'section', 'other', 'nav', 'aside', 'header', 'footer'];

        scored.forEach(item => {
            const region = item.region;
            if (!groups.has(region)) groups.set(region, []);
            groups.get(region).push(item);
        });

        const sortedGroups = new Map();
        groupOrder.forEach(region => {
            if (groups.has(region)) sortedGroups.set(region, groups.get(region));
        });

        return {
            ranked: scored.map(s => s.link),
            groups: sortedGroups,
            scores: scored,
            pageType,
            sessionBehavior
        };
    }

    // ====================================================================
    // 内容质量评分（保留核心逻辑）
    // ====================================================================

    contentQualityScore(link, stats) {
        let score = 0;
        const title = (link.title || '').trim();

        if (title && !title.startsWith('http')) {
            if (title.length >= 10 && title.length <= 80) score += 20;
            else if (title.length >= 5) score += 10;
            else score -= 10;

            const words = this.tokenize(title);
            if (words.length >= 3 && words.length <= 12) score += 12;
        } else {
            score -= 12;
        }

        try {
            const urlObj = new URL(link.url);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);

            if (pathParts.length >= 2 && pathParts.length <= 4) score += 12;
            else if (pathParts.length === 1) score += 6;
            if (!urlObj.search) score += 8;
            if (urlObj.protocol === 'https:') score += 4;

            const ext = urlObj.pathname.split('.').pop().toLowerCase();
            if (['exe', 'apk', 'zip', 'rar'].includes(ext)) score -= 35;
        } catch (e) {}

        return Math.max(0, Math.min(score, 80));
    }

    // ====================================================================
    // 用户兴趣画像
    // ====================================================================

    computeUserInterestProfile(history) {
        if (!history || history.length === 0) return new Map();

        const profile = new Map();
        const totalWeight = history.reduce((sum, h) => sum + (h.clickCount || 1), 0);

        history.forEach(h => {
            const weight = (h.clickCount || 1) / totalWeight;
            const recentBonus = this._recencyWeight(h.lastClicked);

            this.tokenize(h.title || '').forEach(t => {
                profile.set(t, (profile.get(t) || 0) + weight * recentBonus);
            });

            this.tokenize(h.domain || '').forEach(t => {
                profile.set(t, (profile.get(t) || 0) + weight * recentBonus * 0.3);
            });
        });

        return profile;
    }

    computeInterestScore(link, userProfile) {
        if (userProfile.size === 0) return 0;

        const tokens = this.tokenize((link.title || '').trim());
        if (tokens.length === 0) return 0;

        let score = 0;
        const termFreq = new Map();
        tokens.forEach(t => termFreq.set(t, (termFreq.get(t) || 0) + 1));

        termFreq.forEach((tf, term) => {
            score += (tf / tokens.length) * (userProfile.get(term) || 0);
        });

        return Math.min(score * 100, 60);
    }

    // ====================================================================
    // 行为信号 & 新颖度 & 位置
    // ====================================================================

    behaviorScore(link, stats) {
        let score = 0;
        const domain = this._getDomain(link.url);
        if (!domain) return score;

        const userClicks = (stats.userDomainClicks || new Map()).get(domain) || 0;
        if (userClicks > 0) score += Math.min(Math.log(1 + userClicks) * 6, 20);

        if ((stats.userRecentDomains || new Set()).has(domain)) score += 12;

        const todayClicks = this._getTodayDomainClicks(domain, stats);
        if (todayClicks >= 5) score -= 18;
        else if (todayClicks >= 3) score -= 10;

        if (!stats.linkHistory || !stats.linkHistory.some(h => h.domain === domain)) score += 6;
        if (!stats.linkHistory || !stats.linkHistory.some(h => h.url === link.url)) score += 4;

        return score;
    }

    noveltyScore(link, stats) {
        let score = 0;

        if (!this._isSameDomain(link.url, stats.currentPageUrl)) score += 10;

        const domain = this._getDomain(link.url);
        if (domain && stats.domainCounts) {
            const count = stats.domainCounts.get(domain) || 1;
            if (count === 1) score += 8;
            else if (count <= 2) score += 4;
        }

        try {
            const ext = new URL(link.url).pathname.split('.').pop().toLowerCase();
            if (['pdf', 'md', 'docx', 'pptx', 'xlsx', 'csv'].includes(ext)) score += 6;
        } catch (e) {}

        return score;
    }

    positionScore(link, stats) {
        if (!stats.maxYPosition || stats.maxYPosition <= 0) return 0;
        if (link.yPosition === undefined || link.yPosition < 0) return 0;
        const normalizedY = link.yPosition / stats.maxYPosition;
        return 25 * Math.exp(-3 * normalizedY);
    }

    // ====================================================================
    // 区域分类
    // ====================================================================

    classifyRegion(link) {
        if (link.isContentArea) return 'main';

        try {
            const urlObj = new URL(link.url);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            if (pathParts.length <= 1) {
                const contentKw = ['article', 'post', 'blog', 'news', 'tutorial',
                    'guide', 'docs', 'read', 'paper', 'research'];
                if (!contentKw.some(kw => urlObj.pathname.toLowerCase().includes(kw))) {
                    return 'nav';
                }
            }
        } catch (e) {}

        return 'other';
    }

    // ====================================================================
    // Tokenization & Helpers
    // ====================================================================

    tokenize(text) {
        if (!text) return [];
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 1 && !RankingEngine.STOP_WORDS.has(w));
    }

    _getDomain(url) {
        try { return new URL(url).hostname; } catch (e) { return null; }
    }

    _isSameDomain(url, currentPageUrl) {
        if (!currentPageUrl) return false;
        try { return new URL(url).hostname === new URL(currentPageUrl).hostname; }
        catch (e) { return false; }
    }

    _recencyWeight(lastClicked) {
        if (!lastClicked) return 0.3;
        const days = (Date.now() - lastClicked) / 86400000;
        return Math.exp(-days / 30);
    }

    _getTodayDomainClicks(domain, stats) {
        if (!stats.linkHistory) return 0;
        const today = new Date().toDateString();
        return stats.linkHistory
            .filter(h => h.domain === domain && h.lastClickDate === today)
            .reduce((sum, r) => sum + (r.todayCount || 0), 0);
    }

    // 区域权重基准值
    get REGION_WEIGHTS() {
        return {
            main: 100, article: 95, section: 80,
            aside: 50, nav: 40, footer: 20, header: 35, other: 60
        };
    }
}

RankingEngine.STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
    'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every',
    'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'only',
    'own', 'same', 'than', 'too', 'very', 'just', 'this', 'that', 'these',
    'those', 'it', 'its', 'here', 'there', 'when', 'where', 'why', 'how',
    'which', 'who', 'whom', 'what', '的', '了', '在', '是', '我', '有',
    '和', '就', '不', '人', '都', '一', '上', '也', '很', '到', '说',
    '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '他',
    '她', '它', '们', '那', '些', '什么', '怎么', '如何', '哪个', '为什么',
    '因为', '所以', '但是', '而且', '或者', '如果', '虽然', '然后', '可以',
    '应该', '需要', '已经', '还是', '比较', '非常', '真的', '关于', '对于',
    '你们', '我们', '他们', '进行', '使用', '通过', '以及', '只是', '就是',
    '更多', '查看', '了解', '阅读', '详情', '点击', '链接', '新', '最新'
]);
