# 快速配置 GitHub Secrets（3 步）

## 🎯 问题

GitHub Pages 上提示"Supabase 环境变量未配置"，因为 GitHub Pages 无法读取 `.env.local` 文件。

## ✅ 解决方案（3 步）

### 步骤 1：获取 Supabase 配置

1. 访问：https://supabase.com/dashboard
2. 选择你的项目
3. 进入：`Settings` → `API`
4. 复制：
   - **Project URL**（例如：`https://xxxxx.supabase.co`）
   - **anon public key**（在 "Project API keys" 部分，找到 `anon` `public`）

### 步骤 2：在 GitHub 中配置 Secrets

1. 访问：https://github.com/gqcjx/exam/settings/secrets/actions
2. 点击 `New repository secret`
3. 添加第一个：
   - **Name**：`VITE_SUPABASE_URL`
   - **Secret**：粘贴你的 Project URL
   - 点击 `Add secret`
4. 再次点击 `New repository secret`
5. 添加第二个：
   - **Name**：`VITE_SUPABASE_ANON_KEY`
   - **Secret**：粘贴你的 anon public key
   - 点击 `Add secret`

### 步骤 3：触发重新部署

**方式 1：手动触发（推荐）**
1. 访问：https://github.com/gqcjx/exam/actions
2. 选择 "Deploy to GitHub Pages" 工作流
3. 点击 `Run workflow` → `Run workflow`

**方式 2：推送代码触发**
```bash
git commit --allow-empty -m "trigger: rebuild with secrets"
git push origin main
```

## ⏱️ 等待部署完成

- 通常需要 2-5 分钟
- 查看部署状态：https://github.com/gqcjx/exam/actions

## ✅ 验证

部署完成后，访问：https://gqcjx.github.io/exam/login

应该不再显示"环境变量未配置"的错误。

---

**⚠️ 重要：必须使用 `anon` `public` key，不要使用 `service_role` key！**

