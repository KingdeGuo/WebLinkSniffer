class LinkManager {
    constructor() {
        this.links = [];
        this.openedLinks = new Set();
        this.currentPage = 1;
        this.pageSize = 5;
        this.autoMoveOpened = true;
        
        this.initElements();
        this.loadOpenedLinks();
        this.loadSettings();
        this.setupEventListeners();
        this.fetchLinks();
    }
    
    initElements() {
        this.linksContainer = document.getElementById('linksContainer');
        this.totalLinksElement = document.getElementById('totalLinks');
        this.pageInfoElement = document.getElementById('pageInfo');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.refreshBtn = document.getElementById('refreshBtn');
        this.openAllBtn = document.getElementById('openAllBtn');
        this.autoOpenCheckbox = document.getElementById('autoOpenCheckbox');
    }
    
    async loadOpenedLinks() {
        const result = await chrome.storage.local.get('openedLinks');
        if (result.openedLinks) {
            this.openedLinks = new Set(result.openedLinks);
        }
    }
    
    async loadSettings() {
        const result = await chrome.storage.local.get('autoMoveOpened');
        if (result.autoMoveOpened !== undefined) {
            this.autoMoveOpened = result.autoMoveOpened;
            this.autoOpenCheckbox.checked = this.autoMoveOpened;
        }
    }
    
    async saveOpenedLinks() {
        await chrome.storage.local.set({
            openedLinks: Array.from(this.openedLinks)
        });
    }
    
    async saveSettings() {
        await chrome.storage.local.set({
            autoMoveOpened: this.autoMoveOpened
        });
    }
    
    setupEventListeners() {
        this.prevBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        this.nextBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        this.refreshBtn.addEventListener('click', () => this.fetchLinks());
        this.openAllBtn.addEventListener('click', () => this.openCurrentPageLinks());
        this.autoOpenCheckbox.addEventListener('change', (e) => {
            this.autoMoveOpened = e.target.checked;
            this.saveSettings();
        });
    }
    
    async fetchLinks() {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            
            if (!tab) {
                this.showError('无法获取当前标签页');
                return;
            }
            
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getLinks' });
            
            if (response && response.links) {
                this.links = response.links;
                this.sortLinks();
                this.updateUI();
            } else {
                this.showError('无法获取链接，请刷新页面后重试');
            }
        } catch (error) {
            console.error('获取链接失败:', error);
            this.showError('无法获取链接，请刷新页面后重试');
        }
    }
    
    sortLinks() {
        // 将已打开的链接移到末尾
        if (this.autoMoveOpened) {
            this.links.sort((a, b) => {
                const aOpened = this.openedLinks.has(a.url);
                const bOpened = this.openedLinks.has(b.url);
                if (aOpened && !bOpened) return 1;
                if (!aOpened && bOpened) return -1;
                return 0;
            });
        }
    }
    
    updateUI() {
        this.totalLinksElement.textContent = this.links.length;
        this.renderLinks();
        this.updatePagination();
    }
    
    renderLinks() {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, this.links.length);
        const pageLinks = this.links.slice(startIndex, endIndex);
        
        if (pageLinks.length === 0) {
            this.linksContainer.innerHTML = '<div class="empty-state">没有找到链接</div>';
            return;
        }
        
        this.linksContainer.innerHTML = '';
        
        pageLinks.forEach(link => {
            const isOpened = this.openedLinks.has(link.url);
            const linkElement = this.createLinkElement(link, isOpened);
            this.linksContainer.appendChild(linkElement);
        });
    }
    
    createLinkElement(link, isOpened) {
        const div = document.createElement('div');
        div.className = `link-item ${isOpened ? 'link-opened' : ''}`;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'link-checkbox';
        checkbox.checked = isOpened;
        checkbox.addEventListener('change', (e) => {
            this.toggleLinkOpened(link.url, e.target.checked);
        });
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'link-content';
        
        const title = document.createElement('div');
        title.className = 'link-title';
        title.textContent = link.title || link.url;
        title.title = link.title || link.url;
        
        const url = document.createElement('div');
        url.className = 'link-url';
        url.textContent = link.url;
        url.title = link.url;
        
        contentDiv.appendChild(title);
        contentDiv.appendChild(url);
        
        div.appendChild(checkbox);
        div.appendChild(contentDiv);
        
        return div;
    }
    
    async toggleLinkOpened(url, opened) {
        if (opened) {
            this.openedLinks.add(url);
        } else {
            this.openedLinks.delete(url);
        }
        
        await this.saveOpenedLinks();
        
        if (this.autoMoveOpened) {
            this.sortLinks();
            this.updateUI();
        } else {
            this.renderLinks();
        }
    }
    
    updatePagination() {
        const totalPages = Math.ceil(this.links.length / this.pageSize);
        
        this.pageInfoElement.textContent = `第 ${this.currentPage} 页 / 共 ${totalPages} 页`;
        
        this.prevBtn.disabled = this.currentPage <= 1;
        this.nextBtn.disabled = this.currentPage >= totalPages;
        
        this.openAllBtn.disabled = this.links.length === 0;
    }
    
    goToPage(page) {
        const totalPages = Math.ceil(this.links.length / this.pageSize);
        
        if (page < 1 || page > totalPages) {
            return;
        }
        
        this.currentPage = page;
        this.renderLinks();
        this.updatePagination();
    }
    
    async openCurrentPageLinks() {
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = Math.min(startIndex + this.pageSize, this.links.length);
        const pageLinks = this.links.slice(startIndex, endIndex);
        
        for (const link of pageLinks) {
            await this.openLink(link.url);
        }
        
        // 标记所有链接为已打开
        pageLinks.forEach(link => {
            this.openedLinks.add(link.url);
        });
        
        await this.saveOpenedLinks();
        
        if (this.autoMoveOpened) {
            this.sortLinks();
            this.updateUI();
        } else {
            this.renderLinks();
        }
    }
    
    async openLink(url) {
        try {
            await chrome.tabs.create({ url, active: false });
        } catch (error) {
            console.error('打开链接失败:', error);
        }
    }
    
    showError(message) {
        this.linksContainer.innerHTML = `<div class="empty-state">${message}</div>`;
        this.totalLinksElement.textContent = '0';
        this.pageInfoElement.textContent = '第 1 页 / 共 1 页';
        this.prevBtn.disabled = true;
        this.nextBtn.disabled = true;
        this.openAllBtn.disabled = true;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new LinkManager();
});