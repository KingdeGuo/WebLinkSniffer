/**
 * ML-Inspired Ranking Engine for Link Sniffer
 *
 * Implements BM25, TF-IDF, cosine similarity, and learning-to-rank features
 * All algorithms run locally in the browser — no external dependencies.
 */

class RankingEngine {
    constructor() {
        this.bm25_k1 = 1.5;
        this.bm25_b = 0.75;
        this.idfCache = new Map();
        this.docFreqs = new Map();
        this.totalDocs = 0;
        this.avgDocLength = 0;
        this.docLengths = [];
    }

    // ========== Tokenization ==========

    tokenize(text) {
        if (!text) return [];
        return text
            .toLowerCase()
            .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 1 && !RankingEngine.STOP_WORDS.has(w));
    }

    tokenizeWithPositions(text) {
        const tokens = this.tokenize(text);
        const positions = new Map();
        tokens.forEach((token, i) => {
            if (!positions.has(token)) positions.set(token, []);
            positions.get(token).push(i);
        });
        return { tokens, positions };
    }

    // ========== TF-IDF Computation ==========

    buildCorpus(documents) {
        this.docFreqs.clear();
        this.totalDocs = documents.length;
        this.docLengths = [];
        this.idfCache.clear();

        const corpus = documents.map(doc => {
            const text = (doc.title || '') + ' ' + this._extractPathTokens(doc.url);
            const tokens = this.tokenize(text);
            this.docLengths.push(tokens.length);

            const termFreq = new Map();
            tokens.forEach(t => termFreq.set(t, (termFreq.get(t) || 0) + 1));

            termFreq.forEach((_, term) => {
                this.docFreqs.set(term, (this.docFreqs.get(term) || 0) + 1);
            });

            return { doc, tokens, termFreq };
        });

        this.avgDocLength = this.docLengths.reduce((a, b) => a + b, 0) / (this.totalDocs || 1);
        return corpus;
    }

    computeIDF(term) {
        if (this.idfCache.has(term)) return this.idfCache.get(term);
        const df = this.docFreqs.get(term) || 0;
        const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1);
        this.idfCache.set(term, idf);
        return idf;
    }

    // ========== BM25 Scoring ==========

    bm25Score(queryTokens, docTermFreq, docLength) {
        let score = 0;
        const normFactor = 1 - this.bm25_b + this.bm25_b * (docLength / this.avgDocLength);

        queryTokens.forEach(term => {
            const tf = docTermFreq.get(term) || 0;
            const idf = this.computeIDF(term);
            const tfNorm = (tf * (this.bm25_k1 + 1)) / (tf + this.bm25_k1 * normFactor);
            score += idf * tfNorm;
        });

        return score;
    }

    // ========== Cosine Similarity ==========

    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        const allTerms = new Set([...vecA.keys(), ...vecB.keys()]);
        allTerms.forEach(term => {
            const a = vecA.get(term) || 0;
            const b = vecB.get(term) || 0;
            dotProduct += a * b;
            normA += a * a;
            normB += b * b;
        });

        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    buildTFIDFVector(tokens) {
        const vec = new Map();
        const termFreq = new Map();
        tokens.forEach(t => termFreq.set(t, (termFreq.get(t) || 0) + 1));

        termFreq.forEach((tf, term) => {
            const idf = this.computeIDF(term);
            vec.set(term, tf * idf);
        });
        return vec;
    }

    // ========== Feature Extraction (Learning-to-Rank) ==========

    extractFeatures(link, stats, index) {
        const features = {};

        // F1: Content Area Signal
        features.contentArea = link.isContentArea ? 1 : 0;

        // F2: URL Path Quality
        try {
            const urlObj = new URL(link.url);
            const pathParts = urlObj.pathname.split('/').filter(Boolean);
            features.pathDepth = pathParts.length;
            features.isCleanUrl = urlObj.search ? 0 : 1;
            features.isHTTPS = urlObj.protocol === 'https:' ? 1 : 0;

            const pathStr = pathParts.join(' ').toLowerCase();
            const contentKw = ['article', 'post', 'blog', 'news', 'tutorial', 'guide',
                'docs', 'story', 'read', 'paper', 'research', 'learn', 'topic', 'wiki'];
            features.hasContentPath = contentKw.some(kw => pathStr.includes(kw)) ? 1 : 0;

            const ext = urlObj.pathname.split('.').pop().toLowerCase();
            features.isSuspiciousExt = ['exe', 'apk', 'zip', 'rar'].includes(ext) ? 1 : 0;

            const paramCount = Array.from(urlObj.searchParams.keys()).length;
            features.paramCount = paramCount;

            const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'fbclid',
                'gclid', 'ref', 'source', 'feature', 'si', 't'];
            features.trackingParamCount = Array.from(urlObj.searchParams.keys())
                .filter(k => trackingParams.includes(k.toLowerCase())).length;
        } catch (e) {
            features.pathDepth = 0;
            features.isCleanUrl = 0;
            features.isHTTPS = 0;
            features.hasContentPath = 0;
            features.isSuspiciousExt = 0;
            features.paramCount = 0;
            features.trackingParamCount = 0;
        }

        // F3: Title Quality
        const title = (link.title || '').trim();
        features.titleLength = title.length;
        features.hasTitle = title && !title.startsWith('http') ? 1 : 0;
        features.titleWordCount = this.tokenize(title).length;

        // F4: Position Signal (exponential decay)
        if (stats.maxYPosition > 0 && link.yPosition !== undefined) {
            const normalizedY = link.yPosition / stats.maxYPosition;
            features.positionScore = Math.exp(-3 * normalizedY);
            if (link.xPosition !== undefined) {
                const normalizedX = link.xPosition / (link.viewportWidth || 1200);
                features.isLeftColumn = normalizedX < 0.25 ? 1 : 0;
            } else {
                features.isLeftColumn = 0;
            }
        } else {
            features.positionScore = 0.5;
            features.isLeftColumn = 0;
        }

        // F5: Domain Signals
        try {
            const domain = new URL(link.url).hostname;
            features.domain = domain;
            features.isSameDomain = this._isSameDomain(link.url, stats.currentPageUrl) ? 1 : 0;
            features.domainLinkCount = (stats.domainCounts.get(domain) || 0);
            features.isRareDomain = features.domainLinkCount <= 2 ? 1 : 0;
        } catch (e) {
            features.domain = '';
            features.isSameDomain = 0;
            features.domainLinkCount = 0;
            features.isRareDomain = 0;
        }

        // F6: User Behavior Signals
        features.userClickCount = 0;
        features.userRecentClick = 0;
        features.daysSinceLastClick = 999;
        features.clickFrequency = 0;

        if (stats.userDomainClicks) {
            features.userClickCount = stats.userDomainClicks.get(features.domain) || 0;
            features.clickFrequency = stats.userTotalClicks > 0 ?
                features.userClickCount / stats.userTotalClicks : 0;
        }
        if (stats.userRecentDomains) {
            features.userRecentClick = stats.userRecentDomains.has(features.domain) ? 1 : 0;
        }

        // F7: Text Relevance (BM25 score against user history)
        features.bm25Score = 0;
        features.tfidfSimilarity = 0;

        // F8: Novelty
        features.isFirstVisit = (!stats.userDomainClicks || features.userClickCount === 0) ? 1 : 0;
        features.isNewUrl = stats.linkHistory && !stats.linkHistory.some(h => h.url === link.url) ? 1 : 0;

        return features;
    }

    // ========== Learned-to-Rank Scoring ==========

    /**
     * Compute final score using a linear model with hand-tuned weights
     * (mimics what a trained LambdaMART/GradientBoosted model would learn)
     */
    rankScore(features, queryTokens, docTokens, stats) {
        let score = 0;

        // BM25 text relevance (the most important signal for search)
        const bm25 = this.bm25Score(queryTokens, this._termFreqFromTokens(docTokens), docTokens.length);
        score += bm25 * 12;

        // TF-IDF cosine similarity to user interest profile
        if (features.tfidfSimilarity > 0) {
            score += features.tfidfSimilarity * 25;
        }

        // Content area (very strong signal)
        score += features.contentArea * 80;

        // URL quality
        score += features.isCleanUrl * 12;
        score += features.isHTTPS * 5;
        score += features.hasContentPath * 20;
        score -= features.isSuspiciousExt * 50;
        score -= Math.min(features.trackingParamCount * 4, 16);

        // Path depth: 2-4 is optimal
        if (features.pathDepth >= 2 && features.pathDepth <= 4) score += 15;
        else if (features.pathDepth === 1) score += 8;
        else if (features.pathDepth > 5) score -= 5;

        // Title quality
        score += features.hasTitle * 20;
        if (features.titleLength >= 10 && features.titleLength <= 80) score += 12;
        if (features.titleWordCount >= 3 && features.titleWordCount <= 12) score += 8;
        if (features.titleLength < 5) score -= 15;

        // Position
        score += features.positionScore * 30;
        score += features.isLeftColumn * 5;

        // Domain signals
        score += features.isSameDomain * 20;
        if (features.userClickCount > 0) {
            score += Math.min(Math.log(1 + features.userClickCount) * 6, 25);
        }
        score += features.userRecentClick * 15;
        if (features.daysSinceLastClick > 30) score -= 8;

        // Fatigue penalty
        const todayClicks = this._getTodayDomainClicks(features.domain, stats);
        if (todayClicks >= 5) score -= 18;
        else if (todayClicks >= 3) score -= 10;

        // Novelty bonus
        score += features.isNewUrl * 8;
        score += features.isFirstVisit * 5;

        // Domain diversity: penalize over-representation
        if (features.domainLinkCount >= 5) score -= 10;

        return score;
    }

    // ========== User Interest Profile ==========

    buildUserInterestProfile(history) {
        if (!history || history.length === 0) return new Map();

        const profile = new Map();
        const totalWeight = history.reduce((sum, h) => sum + (h.clickCount || 1), 0);

        history.forEach(h => {
            const weight = (h.clickCount || 1) / totalWeight;
            const tokens = this.tokenize(h.title || '');
            const recentBonus = this._recencyWeight(h.lastClicked);

            tokens.forEach(t => {
                profile.set(t, (profile.get(t) || 0) + weight * recentBonus);
            });

            // Also add domain tokens
            const domainTokens = this.tokenize(h.domain || '');
            domainTokens.forEach(t => {
                profile.set(t, (profile.get(t) || 0) + weight * recentBonus * 0.5);
            });
        });

        return profile;
    }

    computeInterestSimilarity(docTokens, userProfile) {
        if (userProfile.size === 0 || docTokens.length === 0) return 0;

        const docVec = new Map();
        const termFreq = new Map();
        docTokens.forEach(t => termFreq.set(t, (termFreq.get(t) || 0) + 1));
        termFreq.forEach((tf, term) => {
            docVec.set(term, tf / docTokens.length);
        });

        return this.cosineSimilarity(docVec, userProfile);
    }

    // ========== Full Ranking Pipeline ==========

    /**
     * Rank links using the full ML pipeline
     * @param {Array} links - raw link objects from content script
     * @param {Object} stats - computed link statistics
     * @param {Array} linkHistory - user click history
     * @returns {Array} links sorted by relevance score
     */
    rank(links, stats, linkHistory) {
        if (links.length === 0) return links;

        // Build corpus for BM25
        const corpus = this.buildCorpus(links);

        // Build user interest profile
        const userProfile = this.buildUserInterestProfile(linkHistory);

        // Extract features and compute scores
        const scored = links.map((link, index) => {
            const { tokens: docTokens } = corpus[index];
            const features = this.extractFeatures(link, stats, index);

            // Compute TF-IDF similarity to user interest
            const docTFIDF = this.buildTFIDFVector(docTokens);
            features.tfidfSimilarity = this.computeInterestSimilarity(docTokens, userProfile);

            // Compute BM25 score against query (all user history titles as pseudo-query)
            const queryTokens = this._buildQueryFromHistory(linkHistory);

            // Compute final rank score
            const score = this.rankScore(features, queryTokens, docTokens, stats);

            return { link, score, features };
        });

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        return scored.map(s => s.link);
    }

    // ========== Helper Methods ==========

    _extractPathTokens(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname.split('/').filter(Boolean).join(' ') + ' ' +
                urlObj.hostname.replace(/\./g, ' ');
        } catch (e) {
            return '';
        }
    }

    _isSameDomain(url, currentPageUrl) {
        if (!currentPageUrl) return false;
        try {
            return new URL(url).hostname === new URL(currentPageUrl).hostname;
        } catch (e) {
            return false;
        }
    }

    _termFreqFromTokens(tokens) {
        const tf = new Map();
        tokens.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
        return tf;
    }

    _getTodayDomainClicks(domain, stats) {
        if (!stats.linkHistory) return 0;
        const today = new Date().toDateString();
        return stats.linkHistory
            .filter(h => h.domain === domain && h.lastClickDate === today)
            .reduce((sum, r) => sum + (r.todayCount || 0), 0);
    }

    _recencyWeight(lastClicked) {
        if (!lastClicked) return 0.3;
        const days = (Date.now() - lastClicked) / 86400000;
        return Math.exp(-days / 30);
    }

    _buildQueryFromHistory(history) {
        if (!history || history.length === 0) return [];

        // Build a pseudo-query from recent history (last 20 items, weighted by recency)
        const recent = history
            .sort((a, b) => (b.lastClicked || 0) - (a.lastClicked || 0))
            .slice(0, 20);

        const tokens = [];
        recent.forEach(h => {
            const weight = Math.ceil(this._recencyWeight(h.lastClicked) * 3);
            const hTokens = this.tokenize(h.title || '');
            for (let i = 0; i < weight; i++) {
                tokens.push(...hTokens);
            }
        });

        return tokens;
    }
}

// Chinese + English stop words
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
