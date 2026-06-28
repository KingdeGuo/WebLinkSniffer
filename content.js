// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getLinks') {
        getFilteredLinks().then(links => {
            sendResponse({
                links,
                pageUrl: window.location.href
            });
        });
        return true; // 保持消息通道开放以支持异步响应
    }
});

// 获取过滤后的链接
async function getFilteredLinks() {
    const links = getAllLinks();
    
    // 获取过滤设置
    try {
        const result = await chrome.storage.local.get([
            'filteredDomains',
            'filteredKeywords',
            'filteredUrls',
            'filteredPathPatterns',
            'enableFilter',
            'hideFiltered',
            'enableKeywordFilter',
            'hideKeywordFiltered',
            'enablePathPatternFilter',
            'hidePathPatternFiltered'
        ]);
        
        const filteredDomains = result.filteredDomains || [];
        const filteredKeywords = result.filteredKeywords || [];
        const filteredUrls = result.filteredUrls || [];
        const filteredPathPatterns = result.filteredPathPatterns || [];
        const enableFilter = result.enableFilter !== undefined ? result.enableFilter : true;
        const hideFiltered = result.hideFiltered !== undefined ? result.hideFiltered : true;
        const enableKeywordFilter = result.enableKeywordFilter !== undefined ? result.enableKeywordFilter : false;
        const hideKeywordFiltered = result.hideKeywordFiltered !== undefined ? result.hideKeywordFiltered : true;
        const enablePathPatternFilter = result.enablePathPatternFilter !== undefined ? result.enablePathPatternFilter : true;
        const hidePathPatternFiltered = result.hidePathPatternFiltered !== undefined ? result.hidePathPatternFiltered : true;
        
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
                
                // 域名过滤（受 enableFilter 开关控制）
                if (enableFilter && filteredDomains.length > 0) {
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
    } catch (error) {
        console.error('获取过滤设置失败:', error);
        return links;
    }
}

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
                if (depth >= 20 || parent === document.body || parent === document.documentElement) {
                    isContentArea = true;
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

// 页面加载完成后，可以做一些初始化工作
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('网址获取插件已加载，当前页面链接数量:', getAllLinks().length);
    });
} else {
    console.log('网址获取插件已加载，当前页面链接数量:', getAllLinks().length);
}