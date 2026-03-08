// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getLinks') {
        const links = getAllLinks();
        sendResponse({ links });
        return true; // 保持消息通道开放以支持异步响应
    }
});

// 获取页面中的所有超链接
function getAllLinks() {
    const links = [];
    const seenUrls = new Set();
    
    // 获取所有 <a> 标签
    const anchorElements = document.querySelectorAll('a[href]');
    
    anchorElements.forEach(anchor => {
        try {
            const href = anchor.href;
            
            // 过滤掉无效的链接
            if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:')) {
                return;
            }
            
            // 去重
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
            
            links.push({
                url: href,
                title: title,
                element: anchor.outerHTML
            });
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