# 链接去重功能实现总结

## 问题描述
用户发现有些链接是类似于 `xx#xx` 这种格式，其中 `#` 一般是某个章节标识。对于这种链接，实际上是同一个页面的不同部分，应该只保留不带 `#` 的那个链接。

## 解决方案

### 1. 修改 content.js 中的链接获取逻辑

#### 核心思路：
- 使用 `baseUrlMap` 跟踪每个基础URL（去除 `#` 和查询参数后的URL）对应的链接
- 优先保留不带 `#` 和查询参数的纯净链接
- 如果同一个基础URL既有带 `#` 的链接，又有不带 `#` 的链接，只保留不带 `#` 的
- 如果某个基础URL只有带 `#` 的链接，保留第一个遇到的

#### 具体实现：
1. **基础URL提取**：使用 `getBaseUrl()` 函数去除URL中的锚点（`#`）和查询参数（`?`）
2. **链接去重**：通过 `baseUrlMap` 确保每个基础URL只有一个链接
3. **优先级处理**：当遇到纯净链接时，替换已存在的带 `#` 链接
4. **最终过滤**：按基础URL分组，对于每个基础URL，优先选择纯净链接；如果只有带 `#` 的链接，保留第一个

### 2. 修改 popup.js

由于 content.js 已经处理了重复链接，popup.js 中的重复链接处理逻辑不再需要：
- 删除了 `processDuplicateLinks()` 函数的调用
- 删除了 `processDuplicateLinks()` 函数的定义

## 效果示例

### 示例1：同一页面的不同链接
输入：
- `https://example.com/page1`
- `https://example.com/page1#section1`
- `https://example.com/page1#section2`
- `https://example.com/page1?query=1`

输出：
- `https://example.com/page1`（只保留不带 `#` 和查询参数的链接）

### 示例2：只有带 `#` 的链接
输入：
- `https://example.com/page2#intro`
- `https://example.com/page2#section1`

输出：
- `https://example.com/page2#intro`（保留第一个遇到的带 `#` 链接）

## 测试页面
创建了 `test_hash_links.html` 测试页面，包含各种场景的链接，用于验证功能是否正常工作。

## 注意事项
1. 此修改会影响所有链接的获取，确保不会误删正常链接
2. 对于只有带 `#` 链接的页面，会保留第一个遇到的链接
3. 查询参数（`?`）也被视为非纯净链接，会被去重
4. 媒体资源链接（图片、视频等）仍然会被过滤掉