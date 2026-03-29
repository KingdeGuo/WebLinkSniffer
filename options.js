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
        this.enableFilter = true;
        this.hideFiltered = true;
        this.enableKeywordFilter = false;
        this.hideKeywordFiltered = true;
        
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
    }
    
    async loadSettings() {
        try {
            const result = await chrome.storage.local.get([
                'filteredDomains',
                'filteredKeywords',
                'enableFilter',
                'hideFiltered',
                'enableKeywordFilter',
                'hideKeywordFiltered'
            ]);
            
            this.filteredDomains = result.filteredDomains || [...DEFAULT_FILTERED_DOMAINS];
            this.filteredKeywords = result.filteredKeywords || [...DEFAULT_FILTERED_KEYWORDS];
            this.enableFilter = result.enableFilter !== undefined ? result.enableFilter : true;
            this.hideFiltered = result.hideFiltered !== undefined ? result.hideFiltered : true;
            this.enableKeywordFilter = result.enableKeywordFilter !== undefined ? result.enableKeywordFilter : false;
            this.hideKeywordFiltered = result.hideKeywordFiltered !== undefined ? result.hideKeywordFiltered : true;
            
            this.enableFilterCheckbox.checked = this.enableFilter;
            this.hideFilteredCheckbox.checked = this.hideFiltered;
            this.enableKeywordFilterCheckbox.checked = this.enableKeywordFilter;
            this.hideKeywordFilteredCheckbox.checked = this.hideKeywordFiltered;
            
            this.renderDomainList();
            this.updatePresetTags();
            this.renderKeywordList();
            
            console.log('设置加载完成');
        } catch (error) {
            console.error('加载设置失败:', error);
            this.showToast('加载设置失败', true);
        }
    }
    
    async saveSettings() {
        try {
            await chrome.storage.local.set({
                filteredDomains: this.filteredDomains,
                filteredKeywords: this.filteredKeywords,
                enableFilter: this.enableFilter,
                hideFiltered: this.hideFiltered,
                enableKeywordFilter: this.enableKeywordFilter,
                hideKeywordFiltered: this.hideKeywordFiltered
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
                hideKeywordFiltered: this.hideKeywordFiltered
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
        this.presetDomains.addEventListener('click', (e) => {
            if (e.target.classList.contains('preset-tag') && !e.target.classList.contains('added')) {
                const domain = e.target.dataset.domain;
                this.addDomainToList(domain);
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
    }
    
    addDomain() {
        const domain = this.newDomainInput.value.trim();
        
        if (!domain) {
            this.showToast('请输入域名', true);
            return;
        }
        
        if (this.isValidDomain(domain)) {
            this.addDomainToList(domain);
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
            this.enableFilter = true;
            this.hideFiltered = true;
            this.enableKeywordFilter = false;
            this.hideKeywordFiltered = true;
            
            this.enableFilterCheckbox.checked = this.enableFilter;
            this.hideFilteredCheckbox.checked = this.hideFiltered;
            this.enableKeywordFilterCheckbox.checked = this.enableKeywordFilter;
            this.hideKeywordFilteredCheckbox.checked = this.hideKeywordFiltered;
            
            this.renderDomainList();
            this.updatePresetTags();
            this.renderKeywordList();
            this.showToast('已恢复默认设置');
        }
    }
    
    addKeyword() {
        const keyword = this.newKeywordInput.value.trim();
        
        if (!keyword) {
            this.showToast('请输入关键词', true);
            return;
        }
        
        this.addKeywordToList(keyword);
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
            item.innerHTML = `
                <span>${keyword}</span>
                <button onclick="optionsManager.removeKeyword('${keyword}')">删除</button>
            `;
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
            item.innerHTML = `
                <span>${domain}</span>
                <button onclick="optionsManager.removeDomain('${domain}')">删除</button>
            `;
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