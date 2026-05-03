// ==UserScript==
// @name         网址获取增强版
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  获取当前网页中的所有超链接，智能排序、链接去重，分页展示，支持域名过滤、关键词过滤、路径模式过滤，一键屏蔽链接/域名/路径，多选批量操作
// @author       KingdeGuo
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // 不影响页面内容的无关查询参数（追踪、回复交互、时间戳等）
    function getInsignificantParams() {
        return new Set([
            // 评论/回复交互参数
            'replyto', 'replytocom', 'comment_id', 'commentid', 'showcomment',
            // 营销/追踪参数
            'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
            'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
            'fbclid', 'gclid', 'msclkid', 'dclid', 'twclid',
            'igshid', 'mc_cid', 'mc_eid',
            'ref', 'source', 'ref_src', 'ref_url', 'referrer',
            '_ga', '_gl', '_gcl_au', '_gac_ua', '_hsenc', '_hsmi',
            'ck_subscriber_id', 'mkt_tok', 'vero_id', 'wickedid',
            'yclid', 'oly_enc_id', 'oly_anon_id',
            'trk', 'trkcampaign',
            // 时间戳/缓存破坏参数
            't', 'timestamp', 'rand', 'random', 'nocache', '_', 'ver', 'v',
            // 社交媒体分享参数
            'share', 'sfnsn', 'sngid', 'si',
            // 其他无关参数
            'feature', 'embeds_referring_origin', 'embeds_referring',
            'context', 'affiliate',
        ]);
    }

    // 剥离不影响页面内容的无关查询参数
    function stripInsignificantParams(url) {
        try {
            const urlObj = new URL(url);
            if (!urlObj.search || urlObj.search === '') {
                return url;
            }
            const insignificant = getInsignificantParams();
            let changed = false;
            for (const key of [...urlObj.searchParams.keys()]) {
                if (insignificant.has(key.toLowerCase())) {
                    urlObj.searchParams.delete(key);
                    changed = true;
                }
            }
            return changed ? urlObj.toString() : url;
        } catch (e) {
            return url;
        }
    }

    // 获取URL的基础部分（去除锚点/hash + 无关查询参数），用于判断相同页面的不同定位子模块
    function getBaseUrl(url) {
        const cleaned = stripInsignificantParams(url);
        try {
            const urlObj = new URL(cleaned);
            urlObj.hash = '';
            let pathname = urlObj.pathname;
            if (pathname.endsWith('/') && pathname !== '/') {
                pathname = pathname.slice(0, -1);
            }
            return urlObj.origin + pathname + urlObj.search;
        } catch (e) {
            let baseUrl = cleaned;
            const hashIndex = baseUrl.indexOf('#');
            if (hashIndex > -1) {
                baseUrl = baseUrl.substring(0, hashIndex);
            }
            if (baseUrl.endsWith('/') && baseUrl !== '/') {
                baseUrl = baseUrl.slice(0, -1);
            }
            return baseUrl;
        }
    }

    // 获取用于去重的规范化 Key（在 baseUrl 基础上进一步规范化协议和 www 前缀）
    function getDedupKey(url) {
        const baseUrl = getBaseUrl(url);
        try {
            const urlObj = new URL(baseUrl);
            // http → https 协议升级
            if (urlObj.protocol === 'http:') {
                urlObj.protocol = 'https:';
            }
            // 去除 www. 前缀
            if (urlObj.hostname.startsWith('www.')) {
                urlObj.hostname = urlObj.hostname.slice(4);
            }
            return urlObj.origin + urlObj.pathname + urlObj.search;
        } catch (e) {
            return baseUrl;
        }
    }

    // 检查URL是否是图片或媒体资源
    function isMediaResource(url) {
        try {
            const urlLower = url.toLowerCase();

            // 常见图片扩展名
            const imageExtensions = [
                '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp',
                '.ico', '.tiff', '.tif', '.avif', '.heic', '.heif'
            ];

            // 常见媒体资源扩展名（视频、音频等）
            const mediaExtensions = [
                '.mp4', '.mp3', '.avi', '.mov', '.wmv', '.flv', '.webm',
                '.ogg', '.wav', '.m4a', '.m4v', '.mkv', '.3gp'
            ];

            // 检查是否包含图片或媒体扩展名
            const allExtensions = [...imageExtensions, ...mediaExtensions];
            for (const ext of allExtensions) {
                // 检查URL路径部分是否以扩展名结尾（忽略查询参数）
                const urlWithoutQuery = urlLower.split('?')[0];
                if (urlWithoutQuery.endsWith(ext)) {
                    return true;
                }
            }

            // 检查常见的图片/媒体资源路径模式
            const mediaPatterns = [
                /\/images?\//i,
                /\/img\//i,
                /\/photos?\//i,
                /\/pictures?\//i,
                /\/thumbnails?\//i,
                /\/thumb\//i,
                /\/media\//i,
                /\/assets\//i,
                /\/uploads?\//i,
                /\/static\//i,
                /\/resources?\//i
            ];

            // 如果URL路径包含媒体相关目录且有图片扩展名
            for (const pattern of mediaPatterns) {
                if (pattern.test(url)) {
                    // 进一步检查是否可能是图片文件
                    const urlWithoutQuery = urlLower.split('?')[0];
                    const hasImageExt = imageExtensions.some(ext => urlWithoutQuery.endsWith(ext));
                    if (hasImageExt) {
                        return true;
                    }
                }
            }

            return false;
        } catch (e) {
            return false;
        }
    }

    // 获取页面中的所有超链接
    function getAllLinks() {
        const links = [];
        const seenUrls = new Set();
        const baseUrlMap = new Map(); // 用于跟踪基础URL及其对应的链接

        // 获取所有 <a> 标签
        const anchorElements = document.querySelectorAll('a[href]');

        anchorElements.forEach(anchor => {
            try {
                const href = anchor.href;

                // 过滤掉无效的链接
                if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:')) {
                    return;
                }

                // 过滤掉图片和媒体资源链接
                if (isMediaResource(href)) {
                    return;
                }

                // 完全相同的URL去重
                if (seenUrls.has(href)) {
                    return;
                }

                seenUrls.add(href);

                // 获取链接标题
                let title = anchor.textContent.trim();
                if (!title) {
                    title = anchor.getAttribute('title') || anchor.getAttribute('aria-label') || '';
                }

                // 如果还是没有标题，使用 URL 的一部分
                if (!title) {
                    try {
                        const urlObj = new URL(href);
                        title = urlObj.hostname + urlObj.pathname;
                    } catch (e) {
                        title = href;
                    }
                }

                // 限制标题长度
                if (title.length > 100) {
                    title = title.substring(0, 97) + '...';
                }

                // 获取链接在页面中的垂直位置
                let yPosition = 0;
                try {
                    const rect = anchor.getBoundingClientRect();
                    yPosition = rect.top + window.scrollY;
                } catch (e) {
                    yPosition = 0;
                }

                // 判断链接是否在正文内容区域（而非导航栏、页脚等）
                let isContentArea = false;
                try {
                    let parent = anchor.parentElement;
                    let depth = 0;
                    while (parent && parent !== document.body && parent !== document.documentElement && depth < 20) {
                        const tagName = parent.tagName.toLowerCase();
                        // 排除明显的导航/页脚区域
                        if (tagName === 'nav' || tagName === 'footer' || tagName === 'header') {
                            isContentArea = false;
                            break;
                        }
                        // 检测正文区域标记
                        if (tagName === 'main' || tagName === 'article' || tagName === 'section' ||
                            parent.getAttribute('role') === 'main' || parent.getAttribute('role') === 'article') {
                            isContentArea = true;
                            break;
                        }
                        const className = (parent.className && typeof parent.className === 'string') ? parent.className : '';
                        const id = (parent.id || '');
                        if (/\b(content|article|post|entry|body|text)\b/i.test(className) ||
                            /\b(content|article|post|entry|main)\b/i.test(id)) {
                            isContentArea = true;
                            break;
                        }
                        parent = parent.parentElement;
                        depth++;
                    }
                    // 如果遍历到 body 还没找到明确标记，且不在 nav/footer/header 中，可能是内容区
                    if (depth >= 20 || parent === document.body || parent === document.documentElement) {
                        // 如果没有明确排除标记，保守判断为非内容区
                    }
                } catch (e) {
                    isContentArea = false;
                }

                // 获取去重 Key（剥离无关参数 + 协议/www 规范化）
                const dedupKey = getDedupKey(href);
                // 获取净化后的 URL（只剥离无关参数、去除 hash）
                const cleanUrl = getBaseUrl(href);
                // 检查当前链接是否带有锚点或无关参数
                const hasHashOrQuery = href !== cleanUrl;

                // 检查是否已经有相同规范化 Key 的链接
                if (baseUrlMap.has(dedupKey)) {
                    const existingLink = baseUrlMap.get(dedupKey);

                    // 如果当前链接是纯净的（不带锚点和无关参数），且已存在的链接不纯净，则替换
                    if (!hasHashOrQuery && existingLink.hasHashOrQuery) {
                        // 替换为当前纯净的链接
                        const newLink = {
                            url: href,
                            title: title,
                            element: anchor.outerHTML,
                            hasHashOrQuery: false,
                            yPosition: yPosition,
                            isContentArea: isContentArea
                        };
                        // 更新links数组中的对应项
                        const index = links.findIndex(link => link.url === existingLink.url);
                        if (index !== -1) {
                            links[index] = newLink;
                        }
                        baseUrlMap.set(dedupKey, newLink);
                    }
                    // 否则，忽略当前链接（如果已存在的链接是纯净的，或者当前链接不纯净）
                } else {
                    // 第一次遇到这个规范化 Key
                    const linkObj = {
                        url: href,
                        title: title,
                        element: anchor.outerHTML,
                        hasHashOrQuery: hasHashOrQuery,
                        yPosition: yPosition,
                        isContentArea: isContentArea
                    };
                    links.push(linkObj);
                    baseUrlMap.set(dedupKey, linkObj);
                }
            } catch (error) {
                console.error('处理链接时出错:', error);
            }
        });

        // 根据用户需求，我们只保留不带锚点的链接
        // 但是，如果某个基础URL只有带锚点的链接，我们也需要保留一个（至少显示一个链接）
        // 首先，按规范化 Key 分组（剥离无关参数 + 协议/www 规范化），检查哪些基础URL有纯净链接
        const baseUrlGroups = new Map();
        links.forEach(link => {
            const dedupKey = getDedupKey(link.url);
            if (!baseUrlGroups.has(dedupKey)) {
                baseUrlGroups.set(dedupKey, []);
            }
            baseUrlGroups.get(dedupKey).push(link);
        });

        // 对于每个基础URL，优先选择纯净链接；如果只有带#的链接，保留第一个
        const filteredLinks = [];
        baseUrlGroups.forEach((groupLinks, baseUrl) => {
            const pureLinks = groupLinks.filter(link => !link.hasHashOrQuery);
            if (pureLinks.length > 0) {
                // 有纯净链接，选择第一个纯净链接
                filteredLinks.push(pureLinks[0]);
            } else {
                // 只有带#的链接，保留第一个
                filteredLinks.push(groupLinks[0]);
            }
        });

        // 按域名分组并排序
        filteredLinks.sort((a, b) => {
            try {
                const urlA = new URL(a.url);
                const urlB = new URL(b.url);

                // 先按域名排序
                const domainCompare = urlA.hostname.localeCompare(urlB.hostname);
                if (domainCompare !== 0) {
                    return domainCompare;
                }

                // 同域名下按路径排序
                return urlA.pathname.localeCompare(urlB.pathname);
            } catch (e) {
                return a.url.localeCompare(b.url);
            }
        });

        return filteredLinks;
    }

    // 获取过滤后的链接
    async function getFilteredLinks() {
        const links = getAllLinks();

        // 获取过滤设置
        const filteredDomains = GM_getValue('filteredDomains', []);
        const filteredKeywords = GM_getValue('filteredKeywords', []);
        const filteredUrls = GM_getValue('filteredUrls', []);
        const filteredPathPatterns = GM_getValue('filteredPathPatterns', []);
        const enableFilter = GM_getValue('enableFilter', true);
        const hideFiltered = GM_getValue('hideFiltered', true);
        const enableKeywordFilter = GM_getValue('enableKeywordFilter', false);
        const hideKeywordFiltered = GM_getValue('hideKeywordFiltered', true);
        const enablePathPatternFilter = GM_getValue('enablePathPatternFilter', true);
        const hidePathPatternFiltered = GM_getValue('hidePathPatternFiltered', true);

        // 预编译路径正则表达式
        const pathPatternRegexes = [];
        if (enablePathPatternFilter && filteredPathPatterns.length > 0) {
            filteredPathPatterns.forEach(pattern => {
                try {
                    pathPatternRegexes.push({
                        pattern: pattern,
                        regex: new RegExp(pattern, 'i')
                    });
                } catch (e) {
                    // 无效正则，跳过
                }
            });
        }

        // 过滤链接
        return links.filter(link => {
            try {
                // 精确 URL 过滤（始终生效，来自 popup 一键屏蔽 / options 配置）
                if (filteredUrls.length > 0 && filteredUrls.includes(link.url)) {
                    return false;
                }

                // 域名过滤（始终生效，来自 popup 一键屏蔽域名 🌐）
                if (filteredDomains.length > 0) {
                    const urlObj = new URL(link.url);
                    const domain = urlObj.hostname.toLowerCase();

                    const isDomainFiltered = filteredDomains.some(filteredDomain => {
                        return domain === filteredDomain ||
                               domain.endsWith('.' + filteredDomain);
                    });

                    if (isDomainFiltered) {
                        return false;
                    }
                }

                // 路径模式过滤（正则匹配 URL 路径）
                if (pathPatternRegexes.length > 0) {
                    const urlObj = new URL(link.url);
                    const pathAndQuery = urlObj.pathname + urlObj.search;

                    const isPathFiltered = pathPatternRegexes.some(({ regex }) => {
                        // 先匹配完整 path+query，再单独匹配 pathname
                        return regex.test(pathAndQuery) || regex.test(urlObj.pathname);
                    });

                    if (hidePathPatternFiltered && isPathFiltered) {
                        return false;
                    }
                }

                // 关键词过滤（来自 options 页面配置）
                if (enableKeywordFilter && filteredKeywords.length > 0) {
                    const title = (link.title || '').toLowerCase();

                    const isKeywordFiltered = filteredKeywords.some(keyword => {
                        return title.includes(keyword.toLowerCase());
                    });

                    if (hideKeywordFiltered && isKeywordFiltered) {
                        return false;
                    }
                }

                return true;
            } catch (e) {
                return true;
            }
        });
    }

    // 创建链接管理器类
    class LinkManager {
        constructor() {
            this.links = [];
            this.openedLinks = new Set(GM_getValue('openedLinks', []));
            this.filteredUrls = GM_getValue('filteredUrls', []);
            this.filteredDomains = GM_getValue('filteredDomains', []);
            this.filteredPathPatterns = GM_getValue('filteredPathPatterns', []);
            this.selectedUrls = new Set();
            this.currentPage = 1;
            this.pageSize = 5;
            this.autoMoveOpened = GM_getValue('autoMoveOpened', true);
            this.hideOpenedLinks = GM_getValue('hideOpenedLinks', true);
            this.hideBlockedLinks = GM_getValue('hideBlockedLinks', true);
            this.searchQuery = '';
            this.showModal = false;
            this.createUI();
            this.fetchLinks();
        }

        async fetchLinks() {
            this.links = await getFilteredLinks();
            this.render();
        }

        createUI() {
            // 添加CSS样式
            GM_addStyle(`
                #linkManagerModal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    z-index: 10000;
                    display: none;
                }
                .link-manager-container {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    width: 90%;
                    max-width: 800px;
                    background: white;
                    border-radius: 8px;
                    padding: 20px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    max-height: 80vh;
                    overflow-y: auto;
                }
                .controls-bar {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 15px;
                    align-items: center;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .stats-bar {
                    display: flex;
                    gap: 15px;
                    margin-bottom: 15px;
                    font-size: 14px;
                    color: #666;
                }
                .pagination-controls {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                }
                .pagination-btn {
                    padding: 5px 10px;
                    cursor: pointer;
                    background: #f0f0f0;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                }
                .pagination-btn:hover {
                    background: #e0e0e0;
                }
                .pagination-btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                .link-item {
                    padding: 10px;
                    border: 1px solid #eee;
                    border-radius: 4px;
                    margin-bottom: 8px;
                    background: #fafafa;
                }
                .link-item.selected {
                    background: #e6f3ff;
                    border-color: #007cba;
                }
                .link-title {
                    font-weight: bold;
                    margin-bottom: 5px;
                    display: block;
                }
                .link-url {
                    color: #666;
                    font-size: 12px;
                    word-break: break-all;
                    display: block;
                }
                .link-actions {
                    margin-top: 8px;
                    display: flex;
                    gap: 8px;
                }
                .link-btn {
                    padding: 4px 8px;
                    border: 1px solid #ccc;
                    background: #fff;
                    cursor: pointer;
                    border-radius: 3px;
                    font-size: 12px;
                }
                .link-btn:hover {
                    background: #f0f0f0;
                }
                .search-box {
                    padding: 8px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    width: 200px;
                }
                .close-btn {
                    position: absolute;
                    top: 10px;
                    right: 15px;
                    font-size: 24px;
                    cursor: pointer;
                    color: #999;
                }
                .close-btn:hover {
                    color: #333;
                }
                .checkbox-container {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                }
            `);

            // 创建模态框
            this.modal = document.createElement('div');
            this.modal.id = 'linkManagerModal';
            this.modal.innerHTML = `
                <div class="link-manager-container">
                    <span class="close-btn">&times;</span>
                    <h2>网址获取管理器</h2>
                    <div class="controls-bar">
                        <input type="text" id="searchInput" class="search-box" placeholder="搜索链接...">
                        <div class="pagination-controls">
                            <button id="prevBtn" class="pagination-btn">上一页</button>
                            <span id="pageInfo">第 1 页，共 1 页</span>
                            <button id="nextBtn" class="pagination-btn">下一页</button>
                        </div>
                    </div>
                    <div class="controls-bar">
                        <div class="checkbox-container">
                            <input type="checkbox" id="autoOpenCheckbox">
                            <label for="autoOpenCheckbox">自动移动已打开链接到末尾</label>
                        </div>
                        <div class="checkbox-container">
                            <input type="checkbox" id="hideOpenedCheckbox">
                            <label for="hideOpenedCheckbox">隐藏已打开链接</label>
                        </div>
                        <button id="refreshBtn" class="pagination-btn">刷新链接</button>
                    </div>
                    <div class="stats-bar">
                        <div>总链接数: <span id="totalLinks">0</span></div>
                        <div>新链接: <span id="newLinks">0</span></div>
                        <div>已打开链接: <span id="openedLinks">0</span></div>
                    </div>
                    <div id="linksContainer"></div>
                    <div class="controls-bar">
                        <div>
                            <button id="openAllBtn" class="pagination-btn">打开当前页全部链接</button>
                        </div>
                        <div>
                            <button id="saveSettingsBtn" class="pagination-btn">保存设置</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(this.modal);

            // 绑定事件
            this.bindEvents();
        }

        bindEvents() {
            // 关闭按钮
            this.modal.querySelector('.close-btn').addEventListener('click', () => {
                this.showModal = false;
                this.modal.style.display = 'none';
            });

            // 上一页
            document.getElementById('prevBtn').addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.render();
                }
            });

            // 下一页
            document.getElementById('nextBtn').addEventListener('click', () => {
                if (this.currentPage < this.getTotalPages()) {
                    this.currentPage++;
                    this.render();
                }
            });

            // 搜索
            document.getElementById('searchInput').addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.currentPage = 1;
                this.render();
            });

            // 自动移动已打开链接复选框
            document.getElementById('autoOpenCheckbox').checked = this.autoMoveOpened;
            document.getElementById('autoOpenCheckbox').addEventListener('change', (e) => {
                this.autoMoveOpened = e.target.checked;
            });

            // 隐藏已打开链接复选框
            document.getElementById('hideOpenedCheckbox').checked = this.hideOpenedLinks;
            document.getElementById('hideOpenedCheckbox').addEventListener('change', (e) => {
                this.hideOpenedLinks = e.target.checked;
            });

            // 刷新链接
            document.getElementById('refreshBtn').addEventListener('click', () => {
                this.fetchLinks();
            });

            // 保存设置
            document.getElementById('saveSettingsBtn').addEventListener('click', () => {
                GM_setValue('autoMoveOpened', this.autoMoveOpened);
                GM_setValue('hideOpenedLinks', this.hideOpenedLinks);
                alert('设置已保存！');
            });

            // 打开当前页全部链接
            document.getElementById('openAllBtn').addEventListener('click', () => {
                this.openCurrentPageLinks();
            });
        }

        openCurrentPageLinks() {
            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = startIndex + this.pageSize;
            const currentPageLinks = this.getDisplayLinks().slice(startIndex, endIndex);

            currentPageLinks.forEach(link => {
                window.open(link.url, '_blank');
                this.markAsOpened(link.url);
            });
        }

        markAsOpened(url) {
            this.openedLinks.add(url);
            GM_setValue('openedLinks', Array.from(this.openedLinks));
        }

        getDisplayLinks() {
            let links = this.links;

            // 应用搜索过滤
            if (this.searchQuery) {
                links = links.filter(link => 
                    link.title.toLowerCase().includes(this.searchQuery) || 
                    link.url.toLowerCase().includes(this.searchQuery)
                );
            }

            // 应用已打开链接过滤
            if (this.hideOpenedLinks) {
                links = links.filter(link => !this.openedLinks.has(link.url));
            }

            return links;
        }

        getTotalPages() {
            const filteredLinks = this.getDisplayLinks();
            return Math.max(1, Math.ceil(filteredLinks.length / this.pageSize));
        }

        render() {
            // 更新统计信息
            document.getElementById('totalLinks').textContent = this.links.length;
            document.getElementById('openedLinks').textContent = this.openedLinks.size;
            const newLinks = this.links.filter(link => !this.openedLinks.has(link.url)).length;
            document.getElementById('newLinks').textContent = newLinks;

            // 更新页面信息
            const totalPages = this.getTotalPages();
            document.getElementById('pageInfo').textContent = `第 ${this.currentPage} 页，共 ${totalPages} 页`;

            // 更新按钮状态
            document.getElementById('prevBtn').disabled = this.currentPage <= 1;
            document.getElementById('nextBtn').disabled = this.currentPage >= totalPages;

            // 渲染链接列表
            const linksContainer = document.getElementById('linksContainer');
            linksContainer.innerHTML = '';

            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = Math.min(startIndex + this.pageSize, this.getDisplayLinks().length);
            const pageLinks = this.getDisplayLinks().slice(startIndex, endIndex);

            pageLinks.forEach(link => {
                const linkItem = document.createElement('div');
                linkItem.className = `link-item ${this.openedLinks.has(link.url) ? 'opened' : ''}`;
                linkItem.innerHTML = `
                    <div class="link-title">${link.title}</div>
                    <div class="link-url">${link.url}</div>
                    <div class="link-actions">
                        <button class="link-btn open-link" data-url="${encodeURIComponent(link.url)}">打开</button>
                        <button class="link-btn copy-link" data-url="${encodeURIComponent(link.url)}">复制</button>
                        <button class="link-btn block-link" data-url="${encodeURIComponent(link.url)}">屏蔽</button>
                        <button class="link-btn block-domain" data-url="${encodeURIComponent(link.url)}">屏蔽域名</button>
                        ${this.openedLinks.has(link.url) ? 
                          '<span style="color: green; font-size: 12px;">已打开</span>' : 
                          '<span style="color: orange; font-size: 12px;">未打开</span>'}
                    </div>
                `;
                linksContainer.appendChild(linkItem);
            });

            // 绑定链接操作事件
            this.bindLinkEvents();
        }

        bindLinkEvents() {
            // 打开链接
            document.querySelectorAll('.open-link').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const url = decodeURIComponent(e.target.dataset.url);
                    window.open(url, '_blank');
                    this.markAsOpened(url);
                    this.render();
                });
            });

            // 复制链接
            document.querySelectorAll('.copy-link').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const url = decodeURIComponent(e.target.dataset.url);
                    navigator.clipboard.writeText(url).then(() => {
                        alert('链接已复制到剪贴板！');
                    });
                });
            });

            // 屏蔽链接
            document.querySelectorAll('.block-link').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const url = decodeURIComponent(e.target.dataset.url);
                    if (!this.filteredUrls.includes(url)) {
                        this.filteredUrls.push(url);
                        GM_setValue('filteredUrls', this.filteredUrls);
                    }
                    this.fetchLinks();
                });
            });

            // 屏蔽域名
            document.querySelectorAll('.block-domain').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const url = decodeURIComponent(e.target.dataset.url);
                    try {
                        const domain = new URL(url).hostname;
                        if (!this.filteredDomains.includes(domain)) {
                            this.filteredDomains.push(domain);
                            GM_setValue('filteredDomains', this.filteredDomains);
                        }
                        this.fetchLinks();
                    } catch (err) {
                        console.error('解析域名失败:', err);
                    }
                });
            });
        }
    }

    // 创建浮动按钮来触发链接管理器
    function createFloatingButton() {
        GM_addStyle(`
            #showLinksBtn {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                background: #007cba;
                color: white;
                border: none;
                border-radius: 50%;
                width: 50px;
                height: 50px;
                font-size: 18px;
                cursor: pointer;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            #showLinksBtn:hover {
                background: #005a87;
            }
        `);

        const button = document.createElement('button');
        button.id = 'showLinksBtn';
        button.textContent = '🔗';
        button.title = '显示页面链接';
        document.body.appendChild(button);

        let linkManager = null;

        button.addEventListener('click', () => {
            if (!linkManager) {
                linkManager = new LinkManager();
            }
            linkManager.showModal = true;
            linkManager.modal.style.display = 'block';
        });
    }

    // 初始化
    setTimeout(createFloatingButton, 1000);

})();