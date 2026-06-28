// 默认过滤域名
const DEFAULT_FILTERED_DOMAINS = [
    'twitter.com',
    'x.com',
    'facebook.com',
    'instagram.com',
    'tiktok.com',
    'weibo.com',
    'douyin.com'
];

// 默认过滤关键词
const DEFAULT_FILTERED_KEYWORDS = [
    '广告',
    '推广',
    '赞助'
];

// 配置管理器
class OptionsManager {
    constructor() {
        this.filteredDomains = [];
        this.filteredKeywords = [];
        this.filteredUrls = [];
        this.filteredPathPatterns = [];
        this.enableFilter = true;
        this.hideFiltered = true;
        this.enableKeywordFilter = false;
        this.hideKeywordFiltered = true;
        this.enablePathPatternFilter = true;
        this.hidePathPatternFiltered = true;
        
        this.initElements();
        this.loadSettings();
        this.setupEventListeners();
    }
    
    initElements() {
        this.domainList = document.getElementById('domainList');
        this.newDomainInput = document.getElementById('newDomain');
        this.addDomainBtn = document.getElementById('addDomainBtn');
        this.batchInput = document.getElementById('batchInput');
        this.batchAddBtn = document.getElementById('batchAddBtn');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.saveBtn = document.getElementById('saveBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.enableFilterCheckbox = document.getElementById('enableFilter');
        this.hideFilteredCheckbox = document.getElementById('hideFiltered');
        this.presetDomains = document.getElementById('presetDomains');
        this.toast = document.getElementById('toast');
        
        // 关键词过滤相关元素
        this.keywordList = document.getElementById('keywordList');
        this.newKeywordInput = document.getElementById('newKeyword');
        this.addKeywordBtn = document.getElementById('addKeywordBtn');
        this.enableKeywordFilterCheckbox = document.getElementById('enableKeywordFilter');
        this.hideKeywordFilteredCheckbox = document.getElementById('hideKeywordFiltered');
        
        // 屏蔽链接相关元素
        this.filteredUrlList = document.getElementById('filteredUrlList');
        this.clearFilteredUrlsBtn = document.getElementById('clearFilteredUrlsBtn');
        
        // 路径模式相关元素
        this.pathPatternList = document.getElementById('pathPatternList');
        this.newPathPatternInput = document.getElementById('newPathPattern');
        this.addPathPatternBtn = document.getElementById('addPathPatternBtn');
        this.clearPathPatternsBtn = document.getElementById('clearPathPatternsBtn');
        this.enablePathPatternFilterCheckbox = document.getElementById('enablePathPatternFilter');
        this.hidePathPatternFilteredCheckbox = document.getElementById('hidePathPatternFiltered');
    }
    
    async loadSettings() {
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
            
            this.filteredDomains = result.filteredDomains || [...DEFAULT_FILTERED_DOMAINS];
            this.filteredKeywords = result.filteredKeywords || [...DEFAULT_FILTERED_KEYWORDS];
            this.filteredUrls = result.filteredUrls || [];
            this.filteredPathPatterns = result.filteredPathPatterns || [];
            this.enableFilter = result.enableFilter !== undefined ? result.enableFilter : true;
            this.hideFiltered = result.hideFiltered !== undefined ? result.hideFiltered : true;
            this.enableKeywordFilter = result.enableKeywordFilter !== undefined ? result.enableKeywordFilter : false;
            this.hideKeywordFiltered = result.hideKeywordFiltered !== undefined ? result.hideKeywordFiltered : true;
            this.enablePathPatternFilter = result.enablePathPatternFilter !== undefined ? result.enablePathPatternFilter : true;
            this.hidePathPatternFiltered = result.hidePathPatternFiltered !== undefined ? result.hidePathPatternFiltered : true;
            
            this.enableFilterCheckbox.checked = this.enableFilter;
            this.hideFilteredCheckbox.checked = this.hideFiltered;
            this.enableKeywordFilterCheckbox.checked = this.enableKeywordFilter;
            this.hideKeywordFilteredCheckbox.checked = this.hideKeywordFiltered;
            this.enablePathPatternFilterCheckbox.checked = this.enablePathPatternFilter;
            this.hidePathPatternFilteredCheckbox.checked = this.hidePathPatternFiltered;
            
            this.renderDomainList();
            this.updatePresetTags();
            this.renderKeywordList();
            this.renderFilteredUrlList();
            this.renderPathPatternList();
            
            console.log('设置加载完成');
        } catch (error) {
            console.error('加载设置失败:', error);
            this.showToast('加载设置失败', true);
        }
    }
    
    async saveSettings() {
        try {
            const maxItems = 500;
            if (this.filteredDomains.length > maxItems) this.filteredDomains = this.filteredDomains.slice(-maxItems);
            if (this.filteredKeywords.length > maxItems) this.filteredKeywords = this.filteredKeywords.slice(-maxItems);
            if (this.filteredUrls.length > maxItems) this.filteredUrls = this.filteredUrls.slice(-maxItems);
            if (this.filteredPathPatterns.length > maxItems) this.filteredPathPatterns = this.filteredPathPatterns.slice(-maxItems);

            await chrome.storage.local.set({
                filteredDomains: this.filteredDomains,
                filteredKeywords: this.filteredKeywords,
                filteredUrls: this.filteredUrls,
                filteredPathPatterns: this.filteredPathPatterns,
                enableFilter: this.enableFilter,
                hideFiltered: this.hideFiltered,
                enableKeywordFilter: this.enableKeywordFilter,
                hideKeywordFiltered: this.hideKeywordFiltered,
                enablePathPatternFilter: this.enablePathPatternFilter,
                hidePathPatternFiltered: this.hidePathPatternFiltered
            });
            
            this.showToast('设置已保存');
            console.log('设置已保存');
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showToast('保存设置失败', true);
        }
    }
    
    async saveFilterSettings() {
        try {
            await chrome.storage.local.set({
                enableFilter: this.enableFilter,
                hideFiltered: this.hideFiltered,
                enableKeywordFilter: this.enableKeywordFilter,
                hideKeywordFiltered: this.hideKeywordFiltered,
                enablePathPatternFilter: this.enablePathPatternFilter,
                hidePathPatternFiltered: this.hidePathPatternFiltered
            });
            console.log('过滤设置已自动保存');
        } catch (error) {
            console.error('自动保存过滤设置失败:', error);
        }
    }
    
    setupEventListeners() {
        // 添加域名按钮
        this.addDomainBtn.addEventListener('click', () => this.addDomain());
        
        // 输入框回车事件
        this.newDomainInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addDomain();
            }
        });
        
        // 批量添加按钮
        this.batchAddBtn.addEventListener('click', () => this.batchAddDomains());
        
        // 清空所有按钮
        this.clearAllBtn.addEventListener('click', () => this.clearAllDomains());
        
        // 保存按钮
        this.saveBtn.addEventListener('click', () => this.saveSettings());
        
        // 恢复默认按钮
        this.resetBtn.addEventListener('click', () => this.resetToDefault());
        
        // 复选框事件
        this.enableFilterCheckbox.addEventListener('change', async (e) => {
            this.enableFilter = e.target.checked;
            await this.saveFilterSettings();
        });
        
        this.hideFilteredCheckbox.addEventListener('change', async (e) => {
            this.hideFiltered = e.target.checked;
            await this.saveFilterSettings();
        });
        
        // 预设域名标签点击事件
        this.presetDomains.addEventListener('click', async (e) => {
            if (e.target.classList.contains('preset-tag') && !e.target.classList.contains('added')) {
                const domain = e.target.dataset.domain;
                await this.addDomainToList(domain);
                e.target.classList.add('added');
            }
        });
        
        // 关键词过滤相关事件
        this.addKeywordBtn.addEventListener('click', () => this.addKeyword());
        
        this.newKeywordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.addKeyword();
            }
        });
        
        this.enableKeywordFilterCheckbox.addEventListener('change', async (e) => {
            this.enableKeywordFilter = e.target.checked;
            await this.saveFilterSettings();
        });
        
        this.hideKeywordFilteredCheckbox.addEventListener('change', async (e) => {
            this.hideKeywordFiltered = e.target.checked;
            await this.saveFilterSettings();
        });
        
        this.enablePathPatternFilterCheckbox.addEventListener('change', async (e) => {
            this.enablePathPatternFilter = e.target.checked;
            await this.saveFilterSettings();
        });
        
        this.hidePathPatternFilteredCheckbox.addEventListener('change', async (e) => {
            this.hidePathPatternFiltered = e.target.checked;
            await this.saveFilterSettings();
        });
        
        // 清空屏蔽链接按钮
        this.clearFilteredUrlsBtn.addEventListener('click', () => this.clearAllFilteredUrls());
        
        // 路径模式事件
        this.addPathPatternBtn.addEventListener('click', () => this.addPathPattern());
        this.newPathPatternInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addPathPattern();
        });
        this.clearPathPatternsBtn.addEventListener('click', () => this.clearAllPathPatterns());
    }
    
    async addDomain() {
        const domain = this.newDomainInput.value.trim();
        
        if (!domain) {
            this.showToast('请输入域名', true);
            return;
        }
        
        if (this.isValidDomain(domain)) {
            await this.addDomainToList(domain);
            this.newDomainInput.value = '';
        } else {
            this.showToast('请输入有效的域名', true);
        }
    }
    
    async addDomainToList(domain) {
        // 标准化域名（移除协议和路径）
        const normalizedDomain = this.normalizeDomain(domain);
        
        if (!this.filteredDomains.includes(normalizedDomain)) {
            this.filteredDomains.push(normalizedDomain);
            this.renderDomainList();
            this.updatePresetTags();
            await this.saveDomainsToStorage();
            this.showToast(`已添加域名: ${normalizedDomain}`);
        } else {
            this.showToast('域名已存在', true);
        }
    }
    
    async saveDomainsToStorage() {
        try {
            const maxItems = 500;
            if (this.filteredDomains.length > maxItems) {
                this.filteredDomains = this.filteredDomains.slice(-maxItems);
            }
            await chrome.storage.local.set({
                filteredDomains: this.filteredDomains
            });
            console.log('域名列表已自动保存');
        } catch (error) {
            console.error('自动保存域名列表失败:', error);
        }
    }
    
    normalizeDomain(domain) {
        // 移除协议（http://, https://）
        let normalized = domain.replace(/^https?:\/\//, '');
        
        // 移除路径
        normalized = normalized.split('/')[0];
        
        // 移除端口号
        normalized = normalized.split(':')[0];
        
        return normalized.toLowerCase();
    }
    
    isValidDomain(domain) {
        // 简单的域名验证
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*(\.[a-zA-Z0-9][a-zA-Z0-9-]*)*$/;
        const normalized = this.normalizeDomain(domain);
        return domainRegex.test(normalized);
    }
    
    async removeDomain(domain) {
        const index = this.filteredDomains.indexOf(domain);
        if (index > -1) {
            this.filteredDomains.splice(index, 1);
            this.renderDomainList();
            this.updatePresetTags();
            await this.saveDomainsToStorage();
            this.showToast(`已移除域名: ${domain}`);
        }
    }
    
    async batchAddDomains() {
        const input = this.batchInput.value.trim();
        
        if (!input) {
            this.showToast('请输入域名', true);
            return;
        }
        
        const domains = input.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        let addedCount = 0;
        
        domains.forEach(domain => {
            if (this.isValidDomain(domain)) {
                const normalizedDomain = this.normalizeDomain(domain);
                if (!this.filteredDomains.includes(normalizedDomain)) {
                    this.filteredDomains.push(normalizedDomain);
                    addedCount++;
                }
            }
        });
        
        if (addedCount > 0) {
            this.renderDomainList();
            this.updatePresetTags();
            this.batchInput.value = '';
            await this.saveDomainsToStorage();
            this.showToast(`已添加 ${addedCount} 个域名`);
        } else {
            this.showToast('没有有效的域名可添加', true);
        }
    }
    
    async clearAllDomains() {
        if (this.filteredDomains.length === 0) {
            this.showToast('域名列表已为空', true);
            return;
        }
        
        if (confirm('确定要清空所有过滤域名吗？')) {
            this.filteredDomains = [];
            this.renderDomainList();
            this.updatePresetTags();
            await this.saveDomainsToStorage();
            this.showToast('已清空所有域名');
        }
    }
    
    resetToDefault() {
        if (confirm('确定要恢复默认设置吗？这将覆盖当前的配置。')) {
            this.filteredDomains = [...DEFAULT_FILTERED_DOMAINS];
            this.filteredKeywords = [...DEFAULT_FILTERED_KEYWORDS];
            this.filteredUrls = [];
            this.filteredPathPatterns = [];
            this.enableFilter = true;
            this.hideFiltered = true;
            this.enableKeywordFilter = false;
            this.hideKeywordFiltered = true;
            this.enablePathPatternFilter = true;
            this.hidePathPatternFiltered = true;
            
            this.enableFilterCheckbox.checked = this.enableFilter;
            this.hideFilteredCheckbox.checked = this.hideFiltered;
            this.enableKeywordFilterCheckbox.checked = this.enableKeywordFilter;
            this.hideKeywordFilteredCheckbox.checked = this.hideKeywordFiltered;
            this.enablePathPatternFilterCheckbox.checked = this.enablePathPatternFilter;
            this.hidePathPatternFilteredCheckbox.checked = this.hidePathPatternFiltered;
            
            this.renderDomainList();
            this.updatePresetTags();
            this.renderKeywordList();
            this.renderFilteredUrlList();
            this.renderPathPatternList();
            this.showToast('已恢复默认设置');
        }
    }
    
    async addKeyword() {
        const keyword = this.newKeywordInput.value.trim();
        
        if (!keyword) {
            this.showToast('请输入关键词', true);
            return;
        }
        
        await this.addKeywordToList(keyword);
        this.newKeywordInput.value = '';
    }
    
    async addKeywordToList(keyword) {
        if (!this.filteredKeywords.includes(keyword)) {
            this.filteredKeywords.push(keyword);
            this.renderKeywordList();
            await this.saveKeywordsToStorage();
            this.showToast(`已添加关键词: ${keyword}`);
        } else {
            this.showToast('关键词已存在', true);
        }
    }
    
    async saveKeywordsToStorage() {
        try {
            await chrome.storage.local.set({
                filteredKeywords: this.filteredKeywords
            });
            console.log('关键词列表已自动保存');
        } catch (error) {
            console.error('自动保存关键词列表失败:', error);
        }
    }
    
    async removeKeyword(keyword) {
        const index = this.filteredKeywords.indexOf(keyword);
        if (index > -1) {
            this.filteredKeywords.splice(index, 1);
            this.renderKeywordList();
            await this.saveKeywordsToStorage();
            this.showToast(`已移除关键词: ${keyword}`);
        }
    }
    
    renderKeywordList() {
        this.keywordList.innerHTML = '';
        
        if (this.filteredKeywords.length === 0) {
            this.keywordList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无过滤关键词</div>';
            return;
        }
        
        this.filteredKeywords.forEach(keyword => {
            const item = document.createElement('div');
            item.className = 'domain-item';
            
            const spanEl = document.createElement('span');
            spanEl.textContent = keyword;
            
            const btnEl = document.createElement('button');
            btnEl.textContent = '删除';
            btnEl.addEventListener('click', () => this.removeKeyword(keyword));
            
            item.appendChild(spanEl);
            item.appendChild(btnEl);
            this.keywordList.appendChild(item);
        });
    }
    
    renderDomainList() {
        this.domainList.innerHTML = '';
        
        if (this.filteredDomains.length === 0) {
            this.domainList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无过滤域名</div>';
            return;
        }
        
        this.filteredDomains.forEach(domain => {
            const item = document.createElement('div');
            item.className = 'domain-item';
            
            const spanEl = document.createElement('span');
            spanEl.textContent = domain;
            
            const btnEl = document.createElement('button');
            btnEl.textContent = '删除';
            btnEl.addEventListener('click', () => this.removeDomain(domain));
            
            item.appendChild(spanEl);
            item.appendChild(btnEl);
            this.domainList.appendChild(item);
        });
    }
    
    updatePresetTags() {
        const tags = this.presetDomains.querySelectorAll('.preset-tag');
        tags.forEach(tag => {
            const domain = tag.dataset.domain;
            if (this.filteredDomains.includes(domain)) {
                tag.classList.add('added');
            } else {
                tag.classList.remove('added');
            }
        });
    }
    
    // ========== 屏蔽链接管理 ==========
    
    renderFilteredUrlList() {
        this.filteredUrlList.innerHTML = '';
        
        if (this.filteredUrls.length === 0) {
            this.filteredUrlList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无屏蔽链接</div>';
            return;
        }
        
        this.filteredUrls.forEach(url => {
            const item = document.createElement('div');
            item.className = 'domain-item';
            
            const spanEl = document.createElement('span');
            // 显示简短版本
            const shortUrl = url.length > 60 ? url.substring(0, 57) + '...' : url;
            spanEl.textContent = shortUrl;
            spanEl.setAttribute('title', url);
            
            const btnEl = document.createElement('button');
            btnEl.textContent = '删除';
            btnEl.addEventListener('click', () => this.removeFilteredUrl(url));
            
            item.appendChild(spanEl);
            item.appendChild(btnEl);
            this.filteredUrlList.appendChild(item);
        });
    }
    
    async removeFilteredUrl(url) {
        const index = this.filteredUrls.indexOf(url);
        if (index > -1) {
            this.filteredUrls.splice(index, 1);
            this.renderFilteredUrlList();
            await this.saveFilteredUrlsToStorage();
            this.showToast('已移除屏蔽链接');
        }
    }
    
    async clearAllFilteredUrls() {
        if (this.filteredUrls.length === 0) {
            this.showToast('屏蔽链接列表已为空', true);
            return;
        }
        
        if (confirm('确定要清空所有屏蔽链接吗？')) {
            this.filteredUrls = [];
            this.renderFilteredUrlList();
            await this.saveFilteredUrlsToStorage();
            this.showToast('已清空所有屏蔽链接');
        }
    }
    
    async saveFilteredUrlsToStorage() {
        try {
            await chrome.storage.local.set({
                filteredUrls: this.filteredUrls
            });
            console.log('屏蔽链接列表已自动保存');
        } catch (error) {
            console.error('自动保存屏蔽链接列表失败:', error);
        }
    }
    
    // ========== 路径模式管理 ==========
    
    async addPathPattern() {
        console.log('addPathPattern 被调用');
        const pattern = this.newPathPatternInput.value.trim();
        console.log('输入的模式:', pattern);
        if (!pattern) {
            this.showToast('请输入路径模式', true);
            return;
        }
        if (pattern.length < 3) {
            this.showToast('路径模式太短（至少3个字符）', true);
            return;
        }
        console.log('开始调用 addPathPatternToList');
        await this.addPathPatternToList(pattern);
        this.newPathPatternInput.value = '';
    }
    
    async addPathPatternToList(pattern) {
        console.log('addPathPatternToList 被调用，pattern=', pattern);
        console.log('当前 filteredPathPatterns:', this.filteredPathPatterns);
        if (!this.filteredPathPatterns.includes(pattern)) {
            this.filteredPathPatterns.push(pattern);
            console.log('\u6dfb加后 filteredPathPatterns:', this.filteredPathPatterns);
            this.renderPathPatternList();
            await this.savePathPatternsToStorage();
            this.showToast(`已添加路径模式: ${pattern}`);
        } else {
            this.showToast('路径模式已存在', true);
        }
    }
    
    async removePathPattern(pattern) {
        const index = this.filteredPathPatterns.indexOf(pattern);
        if (index > -1) {
            this.filteredPathPatterns.splice(index, 1);
            this.renderPathPatternList();
            await this.savePathPatternsToStorage();
            this.showToast(`已移除路径模式: ${pattern}`);
        }
    }
    
    async clearAllPathPatterns() {
        if (this.filteredPathPatterns.length === 0) {
            this.showToast('路径模式列表已为空', true);
            return;
        }
        if (confirm('确定要清空所有路径模式吗？')) {
            this.filteredPathPatterns = [];
            this.renderPathPatternList();
            await this.savePathPatternsToStorage();
            this.showToast('已清空所有路径模式');
        }
    }
    
    renderPathPatternList() {
        console.log('renderPathPatternList 被调用');
        this.pathPatternList.innerHTML = '';
        if (this.filteredPathPatterns.length === 0) {
            console.log('路径模式为空');
            this.pathPatternList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无路径模式<br><small style="color:#bbb;">例如: /blog/, /article/, /news/</small></div>';
            return;
        }
        console.log('渲染 ' + this.filteredPathPatterns.length + ' 个路径模式');
        this.filteredPathPatterns.forEach((pattern, index) => {
            const item = document.createElement('div');
            item.className = 'domain-item';
            
            const spanEl = document.createElement('span');
            const codeEl = document.createElement('code');
            codeEl.textContent = pattern;
            spanEl.appendChild(codeEl);
            
            const btnEl = document.createElement('button');
            btnEl.textContent = '删除';
            btnEl.addEventListener('click', () => this.removePathPattern(pattern));
            
            item.appendChild(spanEl);
            item.appendChild(btnEl);
            this.pathPatternList.appendChild(item);
        });
    }
    
    async savePathPatternsToStorage() {
        try {
            await chrome.storage.local.set({
                filteredPathPatterns: this.filteredPathPatterns
            });
            console.log('路径模式列表已自动保存');
        } catch (error) {
            console.error('自动保存路径模式列表失败:', error);
        }
    }
    
    showToast(message, isError = false) {
        this.toast.textContent = message;
        this.toast.className = 'toast' + (isError ? ' error' : '');
        this.toast.classList.add('show');
        
        setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }
}

// 初始化
let optionsManager;
document.addEventListener('DOMContentLoaded', () => {
    optionsManager = new OptionsManager();
});
