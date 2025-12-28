# Netlify 登录问题修复说明

## 问题描述

GitHub Pages 部署正常，但 Netlify 部署后登录出现问题。这是因为 Netlify 环境下需要通过代理访问 Supabase API，但代理函数存在一些问题。

## 修复内容

### 1. 改进代理函数路径处理

**文件**: `netlify/functions/supabase-proxy.js`

- 改进了 API 路径提取逻辑，支持所有 Supabase API 路径（包括 `/auth/v1/`、`/rest/v1/` 等）
- 添加了详细的错误日志，便于调试
- 确保 URL 路径拼接正确（移除末尾斜杠）

### 2. 改进 Headers 转发

**文件**: `netlify/functions/supabase-proxy.js`

- 改进了 headers 处理逻辑，确保所有必要的 headers 都被转发
- 自动添加 `apikey` header（如果请求中没有）
- 支持转发 `Prefer` header（Supabase 查询选项）
- 正确处理 `Content-Type` header

### 3. 改进客户端代理逻辑

**文件**: `src/lib/supabaseClient.ts`

- 改进了 URL 构建逻辑，正确处理查询参数
- 添加了错误处理和回退机制
- 添加了调试日志（可在浏览器控制台查看）

## 验证步骤

### 1. 检查环境变量

确保在 Netlify 控制台配置了以下环境变量：

- `VITE_SUPABASE_URL`: 你的 Supabase 项目 URL
- `VITE_SUPABASE_ANON_KEY`: 你的 Supabase anon public key
- `SUPABASE_URL`: （可选）如果 `VITE_SUPABASE_URL` 未设置，Functions 会使用此变量

**配置位置**: Netlify 控制台 → Site settings → Build & deploy → Environment variables

### 2. 测试登录功能

1. 访问 https://qfce.netlify.app
2. 打开浏览器开发者工具（F12）→ Network 标签
3. 尝试登录
4. 查看网络请求：
   - 应该看到请求发送到 `/.netlify/functions/supabase-proxy/`
   - 检查请求是否成功（状态码 200）

### 3. 检查 Functions 日志

如果登录仍然失败：

1. 访问 Netlify 控制台 → Functions → supabase-proxy → Logs
2. 查看错误信息
3. 检查是否有路径解析错误或 headers 问题

## 常见问题

### Q: 登录时提示 "Supabase 未配置"

**A**: 检查环境变量是否已正确配置：
- 在 Netlify 控制台确认 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY` 已设置
- 重新部署站点（环境变量更改后需要重新部署）

### Q: 登录时提示网络错误

**A**: 
1. 检查浏览器控制台的网络请求
2. 查看 Functions 日志（Netlify 控制台 → Functions → Logs）
3. 确认代理请求是否被正确转发

### Q: 代理请求返回 400 错误

**A**: 
1. 检查 Functions 日志中的错误信息
2. 确认 API 路径是否正确提取
3. 检查 `event.path` 的值（在 Functions 日志中）

### Q: 代理请求返回 500 错误

**A**: 
1. 检查 Functions 日志中的详细错误信息
2. 确认 Supabase URL 环境变量已配置
3. 检查 Supabase 服务是否正常

## 调试技巧

### 1. 查看浏览器控制台

打开浏览器开发者工具（F12），在 Console 标签中查看：
- `[Proxy] Forwarding request:` 日志 - 确认代理是否被触发
- `[Proxy] Error building proxy URL:` 错误 - 如果有 URL 构建问题

### 2. 查看网络请求

在 Network 标签中：
- 查找发送到 `/.netlify/functions/supabase-proxy/` 的请求
- 检查请求的 headers（特别是 `apikey` 和 `Authorization`）
- 查看响应状态码和内容

### 3. 查看 Functions 日志

在 Netlify 控制台：
- Functions → supabase-proxy → Logs
- 查看 `Proxying request:` 日志，确认目标 URL
- 查看错误堆栈信息

## 技术细节

### 代理流程

1. **客户端检测**: `src/lib/supabaseClient.ts` 检测是否在 Netlify 环境
2. **请求拦截**: 所有 Supabase API 请求被自定义 `fetch` 函数拦截
3. **路径转换**: 将 Supabase URL 转换为 Netlify Function 路径
4. **代理转发**: Netlify Function 接收请求，转发到真实的 Supabase API
5. **响应返回**: 将 Supabase 的响应原样返回给客户端

### 支持的 API 路径

代理支持所有 Supabase API 路径：
- `/auth/v1/*` - 认证 API
- `/rest/v1/*` - REST API
- `/storage/v1/*` - 存储 API
- `/realtime/v1/*` - 实时 API

## 更新日志

- **2024-01-XX**: 修复路径处理逻辑，改进 headers 转发，添加错误处理和日志
