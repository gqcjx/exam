# 配置 GitHub Secrets 说明

## 🔍 问题描述

在 GitHub Pages 上访问网站时，提示"Supabase 环境变量未配置"。这是因为 GitHub Pages 是静态托管，无法读取 `.env.local` 文件，需要在构建时通过 GitHub Secrets 注入环境变量。

## ✅ 解决方案

### 第一步：获取 Supabase 配置信息

1. **访问 Supabase Dashboard**
   - 打开：https://supabase.com/dashboard
   - 选择你的项目

2. **获取 API 配置**
   - 左侧菜单 → `Settings` → `API`
   - 找到以下信息：
     - **Project URL**：例如 `https://xxxxx.supabase.co`
     - **anon public key**：在 "Project API keys" 部分，找到 `anon` `public` key（**不要使用 `service_role` key！**）

### 第二步：在 GitHub 中配置 Secrets

1. **访问仓库 Secrets 设置**
   - 打开：https://github.com/gqcjx/exam/settings/secrets/actions
   - 或者：仓库首页 → `Settings` → `Secrets and variables` → `Actions`

2. **添加第一个 Secret：VITE_SUPABASE_URL**
   - 点击 `New repository secret`
   - **Name**：输入 `VITE_SUPABASE_URL`
   - **Secret**：粘贴你的 Supabase Project URL（例如：`https://xxxxx.supabase.co`）
   - 点击 `Add secret`

3. **添加第二个 Secret：VITE_SUPABASE_ANON_KEY**
   - 再次点击 `New repository secret`
   - **Name**：输入 `VITE_SUPABASE_ANON_KEY`
   - **Secret**：粘贴你的 Supabase anon public key
   - 点击 `Add secret`

### 第三步：触发重新部署

配置完 Secrets 后，需要触发一次新的部署：

#### 方式 1：推送代码触发（推荐）
```bash
# 在本地执行，推送任何更改即可
git commit --allow-empty -m "trigger: rebuild with secrets"
git push origin main
```

#### 方式 2：手动触发 GitHub Actions
1. 访问：https://github.com/gqcjx/exam/actions
2. 选择 "Deploy to GitHub Pages" 工作流
3. 点击 `Run workflow` → `Run workflow`

### 第四步：验证配置

1. **检查 GitHub Actions 日志**
   - 访问：https://github.com/gqcjx/exam/actions
   - 查看最新的构建日志
   - 确认构建成功（没有环境变量相关的错误）

2. **检查部署后的网站**
   - 等待部署完成（2-5 分钟）
   - 访问：https://gqcjx.github.io/exam/login
   - 尝试登录，应该不再显示"环境变量未配置"的错误

## 📋 验证 Secrets 是否配置正确

### 方法 1：查看 GitHub Actions 日志

1. 访问：https://github.com/gqcjx/exam/actions
2. 点击最新的工作流运行
3. 展开 "Build" 步骤
4. 查看构建日志，确认没有环境变量相关的错误

### 方法 2：检查构建产物

环境变量会在构建时被注入到代码中。构建成功后，可以在浏览器中检查：

1. 访问部署后的网站
2. 按 F12 打开开发者工具
3. 在 Console 中运行：
   ```javascript
   console.log(import.meta.env.VITE_SUPABASE_URL)
   ```
4. 应该能看到你的 Supabase URL（注意：这个值会被 Vite 替换，不是原始值）

## ⚠️ 重要提示

### 1. 使用正确的 Key

- ✅ **使用**：`anon` `public` key
- ❌ **不要使用**：`service_role` key（这是服务器端使用的，不应该暴露在前端）

### 2. Secrets 的安全性

- GitHub Secrets 是加密存储的
- 只有仓库管理员和 GitHub Actions 可以访问
- 不会在日志中显示完整值（只会显示 `***`）

### 3. 本地开发

- 本地开发仍然使用 `.env.local` 文件
- `.env.local` 不会被推送到 GitHub（已在 `.gitignore` 中）
- 本地和 GitHub Pages 使用不同的配置方式

## 🔧 故障排查

### 问题 1：配置了 Secrets 但仍然提示未配置

**可能原因**：
- Secrets 名称拼写错误（应该是 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`）
- 没有触发新的部署（需要重新构建才能使用新的 Secrets）

**解决方法**：
1. 检查 Secrets 名称是否正确
2. 触发一次新的部署
3. 等待部署完成后再测试

### 问题 2：构建失败

**可能原因**：
- Secrets 值为空或格式错误
- GitHub Actions 权限问题

**解决方法**：
1. 检查 Secrets 值是否正确
2. 查看 GitHub Actions 日志中的错误信息
3. 确认仓库有 Actions 权限

### 问题 3：本地可以，但 GitHub Pages 不行

**原因**：
- 本地使用 `.env.local` 文件
- GitHub Pages 使用 GitHub Secrets

**解决方法**：
- 确保在 GitHub Secrets 中也配置了相同的值

## 📝 相关文件

- `.github/workflows/deploy.yml` - GitHub Actions 工作流配置
- `src/lib/supabaseClient.ts` - Supabase 客户端初始化
- `src/lib/env.ts` - 环境变量检查

## 🎯 配置完成后

配置完成后，应该能够：
- ✅ 正常访问登录页面
- ✅ 正常登录和注册
- ✅ 所有需要 Supabase 的功能都能正常工作

---

**配置完成后，请等待 GitHub Actions 部署完成（2-5 分钟），然后访问网站验证！**

