# 解决 ERR_CONNECTION_RESET 错误

## 问题描述

在使用项目时，可能会遇到 `ERR_CONNECTION_RESET` 错误，表现为：
- 使用 Clash 代理时正常
- 不使用代理时，本地测试正常，但部署到 Netlify 后访问失败

## 原因分析

`ERR_CONNECTION_RESET` 通常由以下原因导致：

1. **网络环境限制**：某些网络环境下，Supabase 域名可能无法正常访问
2. **DNS 解析问题**：DNS 污染或解析失败
3. **防火墙/安全策略**：网络层面的连接被重置
4. **SSL/TLS 握手失败**：加密连接建立失败

## 已实施的解决方案

### 1. 客户端自动重试机制

项目已经实施了以下优化：

- **自动重试**：网络请求失败时自动重试最多 3 次
- **指数退避**：重试间隔为 1s、2s、4s，避免频繁请求
- **超时控制**：每个请求设置 30 秒超时
- **错误识别**：识别连接重置、网络错误等可重试的错误

### 2. Supabase 客户端配置优化

在 `src/lib/supabaseClient.ts` 中已配置：
- 持久化会话
- 自动刷新 Token
- 使用 PKCE 流程
- 自定义 fetch 函数支持重试

## 其他可能的解决方案

### 方案 1：使用 Supabase 自定义域名

如果 Supabase 项目支持自定义域名，可以使用自己的域名来避免访问问题：

1. 在 Supabase 控制台配置自定义域名
2. 更新环境变量 `VITE_SUPABASE_URL` 为自定义域名

### 方案 2：配置 DNS

如果 DNS 解析有问题，可以尝试：

**Windows:**
1. 打开 `C:\Windows\System32\drivers\etc\hosts`
2. 添加 Supabase 域名的正确解析（需要管理员权限）

**使用公共 DNS:**
- Google DNS: `8.8.8.8`, `8.8.4.4`
- Cloudflare DNS: `1.1.1.1`, `1.0.0.1`

### 方案 3：使用浏览器 DoH (DNS over HTTPS)

在浏览器中启用 DNS over HTTPS：

**Chrome:**
1. 设置 → 隐私设置和安全性 → 安全
2. 启用"使用安全 DNS"，选择 Cloudflare (1.1.1.1)

**Edge:**
1. 设置 → 隐私、搜索和服务
2. 启用"使用安全的 DNS 指定如何查找网站的网络地址"

### 方案 4：使用代理或 VPN

如果其他方案无效，可以：
- 使用 Clash、V2Ray 等代理工具
- 使用 VPN 服务

### 方案 5：检查防火墙设置

确保防火墙未阻止：
- Supabase 域名（通常是 `*.supabase.co`）
- 端口 443 (HTTPS)

### 方案 6：联系网络管理员

如果是在公司或学校网络环境，可能需要联系网络管理员：
- 请求将 Supabase 域名加入白名单
- 检查是否有企业级防火墙或安全策略阻止访问

## 调试方法

### 1. 检查浏览器控制台

打开浏览器开发者工具（F12），查看：
- Console 标签：查看是否有错误信息
- Network 标签：查看失败的请求详情

### 2. 测试 Supabase 连接

在浏览器控制台运行：

```javascript
// 测试 Supabase API 连接
fetch('https://YOUR_PROJECT.supabase.co/rest/v1/', {
  headers: {
    'apikey': 'YOUR_ANON_KEY'
  }
})
.then(r => console.log('连接成功', r))
.catch(e => console.error('连接失败', e))
```

### 3. 检查环境变量

确保 Netlify 环境变量已正确配置：
1. 访问 Netlify 控制台：https://app.netlify.com/projects/qfce/configuration/env
2. 检查 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 是否存在且正确

### 4. 查看 Netlify 构建日志

在 Netlify 控制台的 Deploys 页面，查看构建日志：
- 检查环境变量是否正确注入
- 查看是否有构建错误

## 建议的排查顺序

1. ✅ **首先确认**：项目已实施自动重试机制（已完成）
2. **检查环境变量**：确认 Netlify 环境变量配置正确
3. **测试连接**：使用浏览器控制台测试 Supabase API 连接
4. **尝试 DNS 方案**：更换 DNS 或使用 DoH
5. **联系网络管理员**：如果在受限网络环境
6. **使用代理**：作为临时解决方案

## 注意事项

- 自动重试机制已经能够处理大部分临时性网络问题
- 如果问题持续存在，建议优先检查网络环境
- 某些地区可能确实无法直接访问 Supabase，需要代理
- 定期检查 Supabase 服务状态：https://status.supabase.com/
