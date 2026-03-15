// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getLinks') {
        const links = getAllLinks();
        sendResponse({ links });
        return true; // 保持消息通道开放以支持异步响应
    }
});

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
                // 已存在相同基础URL的链接
                const existingLink = baseUrlMap.get(baseUrl);
                
                if (hasHashOrQuery) {
                    // 当前链接带有锚点或查询参数，标记为重复（已点击）
                    links.push({
                        url: href,
                        title: title,
                        element: anchor.outerHTML,
                        isDuplicate: true // 标记为重复链接
                    });
                } else {
                    // 当前链接是纯净的基础URL（不带锚点和查询参数）
                    // 将之前的链接标记为重复
                    existingLink.isDuplicate = true;
                    
                    // 添加当前纯净的链接
                    const newLink = {
                        url: href,
                        title: title,
                        element: anchor.outerHTML,
                        isDuplicate: false
                    };
                    links.push(newLink);
                    baseUrlMap.set(baseUrl, newLink);
                }
            } else {
                // 第一次遇到这个基础URL
                const linkObj = {
                    url: href,
                    title: title,
                    element: anchor.outerHTML,
                    isDuplicate: false
                };
                links.push(linkObj);
                baseUrlMap.set(baseUrl, linkObj);
            }
        } catch (error) {
            console.error('处理链接时出错:', error);
        }
    });
    
    // 按域名分组并排序
    links.sort((a, b) => {
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
    
    return links;
}

// 页面加载完成后，可以做一些初始化工作
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('网址获取插件已加载，当前页面链接数量:', getAllLinks().length);
    });
} else {
    console.log('网址获取插件已加载，当前页面链接数量:', getAllLinks().length);
}
