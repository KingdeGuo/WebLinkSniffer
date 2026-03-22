// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getLinks') {
        getFilteredLinks().then(links => {
            sendResponse({ links });
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
            'enableFilter',
            'hideFiltered'
        ]);
        
        const filteredDomains = result.filteredDomains || [];
        const enableFilter = result.enableFilter !== undefined ? result.enableFilter : true;
        const hideFiltered = result.hideFiltered !== undefined ? result.hideFiltered : true;
        
        if (!enableFilter || filteredDomains.length === 0) {
            return links;
        }
        
        // 过滤链接
        return links.filter(link => {
            try {
                const urlObj = new URL(link.url);
                const domain = urlObj.hostname.toLowerCase();
                
                // 检查域名是否在过滤列表中
                const isFiltered = filteredDomains.some(filteredDomain => {
                    // 支持子域名匹配
                    return domain === filteredDomain || 
                           domain.endsWith('.' + filteredDomain);
                });
                
                // 如果隐藏被过滤的链接，则不返回被过滤的链接
                if (hideFiltered && isFiltered) {
                    return false;
                }
                
                return true;
            } catch (e) {
                // URL解析失败，保留链接
                return true;
            }
        });
    } catch (error) {
        console.error('获取过滤设置失败:', error);
        return links;
    }
}

// 获取URL的基础部分（去除锚点/hash和查询参数）
function getBaseUrl(url) {
    try {
        const urlObj = new URL(url);
        // 只返回域名和路径，去除查询参数和锚点
        return urlObj.origin + urlObj.pathname;
    } catch (e) {
        // 如果解析失败，尝试简单的字符串处理
        let baseUrl = url;
        // 先去除锚点
        const hashIndex = baseUrl.indexOf('#');
        if (hashIndex > -1) {
            baseUrl = baseUrl.substring(0, hashIndex);
        }
        // 再去除查询参数
        const queryIndex = baseUrl.indexOf('?');
        if (queryIndex > -1) {
            baseUrl = baseUrl.substring(0, queryIndex);
        }
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
            
            // 获取基础URL（不带锚点和查询参数）
            const baseUrl = getBaseUrl(href);
            // 检查当前链接是否带有锚点或查询参数
            const hasHashOrQuery = href !== baseUrl;
            
            // 检查是否已经有相同基础URL的链接
            if (baseUrlMap.has(baseUrl)) {
                const existingLink = baseUrlMap.get(baseUrl);
                
                // 如果当前链接是纯净的（不带锚点和查询参数），且已存在的链接不纯净，则替换
                if (!hasHashOrQuery && existingLink.hasHashOrQuery) {
                    // 替换为当前纯净的链接
                    const newLink = {
                        url: href,
                        title: title,
                        element: anchor.outerHTML,
                        hasHashOrQuery: false
                    };
                    // 更新links数组中的对应项
                    const index = links.findIndex(link => link.url === existingLink.url);
                    if (index !== -1) {
                        links[index] = newLink;
                    }
                    baseUrlMap.set(baseUrl, newLink);
                }
                // 否则，忽略当前链接（如果已存在的链接是纯净的，或者当前链接不纯净）
            } else {
                // 第一次遇到这个基础URL
                const linkObj = {
                    url: href,
                    title: title,
                    element: anchor.outerHTML,
                    hasHashOrQuery: hasHashOrQuery
                };
                links.push(linkObj);
                baseUrlMap.set(baseUrl, linkObj);
            }
        } catch (error) {
            console.error('处理链接时出错:', error);
        }
    });
    
    // 根据用户需求，我们只保留不带#的链接
    // 但是，如果某个基础URL只有带#的链接，我们也需要保留一个（至少显示一个链接）
    // 首先，按基础URL分组，检查哪些基础URL有纯净链接
    const baseUrlGroups = new Map();
    links.forEach(link => {
        const baseUrl = getBaseUrl(link.url);
        if (!baseUrlGroups.has(baseUrl)) {
            baseUrlGroups.set(baseUrl, []);
        }
        baseUrlGroups.get(baseUrl).push(link);
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
