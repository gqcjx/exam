# 解决 Netlify 部署后无法登录问题

## 问题描述

项目在本地可以正常运行，但部署到 Netlify 后，不开科学上网就无法登录。这是因为 Supabase 的 API 端点（`*.supabase.co`）在某些地区可能被限制访问。

## 解决方案

### 方案 1：使用 Netlify Function 代理（已实现）

项目已经实现了自动代理功能：

1. **自动检测 Netlify 环境**：代码会自动检测是否在 Netlify 环境（通过检查域名是否包含 `netlify.app` 或 `netlify.com`）

2. **自动使用代理**：在 Netlify 环境下，所有 Supabase API 请求会自动通过 Netlify Function 代理

3. **无需额外配置**：如果环境变量已正确配置，代理功能会自动生效

### 配置步骤

1. **确保环境变量已配置**：
   - 在 Netlify 控制台 → Site settings → Build & deploy → Environment variables
   - 添加 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`
   - 可选：添加 `SUPABASE_URL`（如果 `VITE_SUPABASE_URL` 未设置）

2. **重新部署**：
   - 保存环境变量后，触发重新部署
   - 或者推送代码到 GitHub（如果已连接）

### 工作原理

1. **客户端检测**：`src/lib/supabaseClient.ts` 会自动检测是否在 Netlify 环境

2. **自定义 Fetch**：在 Netlify 环境下，使用自定义的 `fetch` 函数，将所有 Supabase API 请求转发到 `/.netlify/functions/supabase-proxy/`

3. **Netlify Function 代理**：`netlify/functions/supabase-proxy.ts` 接收请求，转发到真实的 Supabase API，并返回响应

4. **透明代理**：整个过程对应用代码完全透明，不需要修改业务逻辑

### 文件说明

- `src/lib/supabaseClient.ts`：Supabase 客户端配置，包含自动代理逻辑
- `netlify/functions/supabase-proxy.ts`：Netlify Function 代理实现

## GitHub Pages 部署

GitHub Pages 是静态托管，不支持服务器端代理。如果遇到访问问题，建议：

1. **使用科学上网**：在无法访问 Supabase API 的地区，需要使用科学上网工具

2. **使用 Supabase 自定义域名**：如果 Supabase 项目支持自定义域名，可以配置自定义域名来避免访问限制

3. **考虑使用 Netlify**：Netlify 支持服务器端代理，可以解决访问问题

## 验证代理是否生效

1. 打开浏览器开发者工具（F12）
2. 切换到 Network 标签
3. 尝试登录
4. 查看网络请求：
   - 如果看到请求发送到 `/.netlify/functions/supabase-proxy/`，说明代理已生效
   - 如果直接请求 `*.supabase.co`，说明代理未生效（可能是环境检测失败）

## 故障排查

### 代理未生效

1. **检查域名**：确认部署的域名包含 `netlify.app` 或 `netlify.com`
2. **检查环境变量**：确认 `VITE_SUPABASE_URL` 已正确配置
3. **检查控制台**：查看浏览器控制台是否有错误信息

### 代理请求失败

1. **检查 Netlify Function 日志**：
   - 在 Netlify 控制台 → Functions → supabase-proxy
   - 查看错误日志

2. **检查环境变量**：
   - 确认 `VITE_SUPABASE_URL` 或 `SUPABASE_URL` 在 Netlify 环境变量中已配置
   - 注意：Netlify Functions 可以访问构建时环境变量，但 `VITE_` 前缀的变量需要在构建时注入

3. **检查 CORS**：确认 Supabase 项目的 CORS 设置允许 Netlify 域名访问

## 注意事项

1. **性能影响**：通过代理会增加一次网络跳转，可能会有轻微的性能影响，但通常可以忽略

2. **安全性**：代理会转发所有请求头和认证信息，安全性由 Netlify 和 Supabase 保证

3. **成本**：Netlify Functions 有免费额度，对于正常使用通常足够
