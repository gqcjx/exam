# 修复 unsupported_grant_type 错误

## 问题描述

Netlify 部署后登录时出现 `unsupported_grant_type` 错误，但 GitHub Pages 部署正常。

## 错误原因

`unsupported_grant_type` 错误通常发生在 OAuth token 请求中，当 Supabase Auth API 没有收到正确的请求格式时。Supabase 的 `signInWithPassword` 会发送 POST 请求到 `/auth/v1/token`，请求体应该是 `application/x-www-form-urlencoded` 格式，包含：
- `grant_type=password`
- `email=...`
- `password=...`

问题可能出现在：
1. 请求体在代理过程中被损坏或格式改变
2. Content-Type header 不正确
3. Netlify Functions 对请求体的处理方式

## 修复内容

### 1. 改进请求体处理

**文件**: `netlify/functions/supabase-proxy.js`

- 正确处理 base64 编码的请求体（Netlify 在某些情况下会 base64 编码）
- 确保 form-urlencoded 请求的 Content-Type 正确
- 原样转发请求体，不进行解析或转换

### 2. 改进 Headers 处理

- 支持不同大小写的 headers（`content-type` 和 `Content-Type`）
- 确保所有必要的 headers 都被正确转发
- 自动添加 `apikey` header（如果缺失）

### 3. 添加调试日志

- 添加详细的请求日志，便于排查问题
- 记录请求体类型、长度和预览
- 记录 headers 信息

## 验证步骤

### 1. 测试登录

1. 访问 https://qfce.netlify.app/login
2. 尝试登录
3. 检查是否还有 `unsupported_grant_type` 错误

### 2. 查看 Functions 日志

如果仍有问题，查看 Functions 日志：

1. 访问 Netlify 控制台 → Functions → supabase-proxy → Logs
2. 查看最近的请求日志
3. 检查：
   - 请求 URL 是否正确
   - Content-Type 是否为 `application/x-www-form-urlencoded`
   - 请求体是否包含 `grant_type=password`
   - 请求体是否被正确转发

### 3. 检查浏览器网络请求

1. 打开浏览器开发者工具（F12）→ Network 标签
2. 尝试登录
3. 查找发送到 `/.netlify/functions/supabase-proxy/auth/v1/token` 的请求
4. 检查：
   - 请求方法：应该是 POST
   - Content-Type：应该是 `application/x-www-form-urlencoded`
   - 请求体：应该包含 `grant_type=password&email=...&password=...`

## 常见问题

### Q: 仍然出现 unsupported_grant_type 错误

**A**: 
1. 检查 Functions 日志，查看请求体内容
2. 确认 Content-Type header 是否正确
3. 确认请求体是否包含 `grant_type=password`
4. 检查环境变量 `VITE_SUPABASE_ANON_KEY` 是否已配置

### Q: 请求体为空或格式错误

**A**: 
1. 检查 Netlify Functions 日志中的 "Request body preview"
2. 确认 `event.isBase64Encoded` 的值
3. 如果 body 是 base64 编码，确认解码是否正确

### Q: Content-Type header 不正确

**A**: 
1. 检查 Functions 日志中的 "Request headers"
2. 确认 Content-Type 是否为 `application/x-www-form-urlencoded`
3. 如果 Content-Type 缺失或错误，代理函数会自动设置

## 技术细节

### Supabase Auth API 请求格式

Supabase 的 `signInWithPassword` 发送的请求格式：

```
POST /auth/v1/token
Content-Type: application/x-www-form-urlencoded

grant_type=password&email=user@example.com&password=password123
```

### Netlify Functions 请求体处理

Netlify Functions 的 `event.body` 可能是：
- 字符串（如果是文本格式）
- base64 编码的字符串（如果 `event.isBase64Encoded` 为 true）

代理函数需要：
1. 检查 `event.isBase64Encoded`
2. 如果是 base64，先解码
3. 原样转发，不进行解析

### Headers 大小写问题

HTTP headers 在 Netlify Functions 中可能是小写，但 Supabase API 可能需要特定的大小写。代理函数会同时检查小写和原始大小写。

## 调试技巧

### 1. 查看 Functions 日志

在 Netlify 控制台查看详细的请求日志：
- 请求 URL
- 请求方法
- Headers
- 请求体预览

### 2. 查看浏览器网络请求

在浏览器开发者工具中：
- 查看发送到代理的请求
- 检查请求头和请求体
- 查看响应内容

### 3. 对比 GitHub Pages 和 Netlify

如果 GitHub Pages 正常但 Netlify 有问题：
- 检查环境变量配置
- 检查代理函数是否正确部署
- 检查 Functions 日志中的错误信息

## 更新日志

- **2024-01-XX**: 修复 unsupported_grant_type 错误，改进请求体处理和 headers 转发
