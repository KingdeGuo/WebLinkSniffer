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

// 配置管理器
class OptionsManager {
    constructor() {
        this.filteredDomains = [];
        this.enableFilter = true;
        this.hideFiltered = true;
        
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
    }
    
    async loadSettings() {
        try {
            const result = await chrome.storage.local.get([
                'filteredDomains',
                'enableFilter',
                'hideFiltered'
            ]);
            
            this.filteredDomains = result.filteredDomains || [...DEFAULT_FILTERED_DOMAINS];
            this.enableFilter = result.enableFilter !== undefined ? result.enableFilter : true;
            this.hideFiltered = result.hideFiltered !== undefined ? result.hideFiltered : true;
            
            this.enableFilterCheckbox.checked = this.enableFilter;
            this.hideFilteredCheckbox.checked = this.hideFiltered;
            
            this.renderDomainList();
            this.updatePresetTags();
            
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
                enableFilter: this.enableFilter,
                hideFiltered: this.hideFiltered
            });
            
            this.showToast('设置已保存');
            console.log('设置已保存');
        } catch (error) {
            console.error('保存设置失败:', error);
            this.showToast('保存设置失败', true);
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
        this.enableFilterCheckbox.addEventListener('change', (e) => {
            this.enableFilter = e.target.checked;
        });
        
        this.hideFilteredCheckbox.addEventListener('change', (e) => {
            this.hideFiltered = e.target.checked;
        });
        
        // 预设域名标签点击事件
        this.presetDomains.addEventListener('click', (e) => {
            if (e.target.classList.contains('preset-tag') && !e.target.classList.contains('added')) {
                const domain = e.target.dataset.domain;
                this.addDomainToList(domain);
                e.target.classList.add('added');
            }
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
            this.enableFilter = true;
            this.hideFiltered = true;
            
            this.enableFilterCheckbox.checked = this.enableFilter;
            this.hideFilteredCheckbox.checked = this.hideFiltered;
            
            this.renderDomainList();
            this.updatePresetTags();
            this.showToast('已恢复默认设置');
        }
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