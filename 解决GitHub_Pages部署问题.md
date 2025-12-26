# 解决 GitHub Pages 部署问题

## 🔴 当前问题

GitHub Pages 打不开：https://gqcjx.github.io/exam/

## ✅ 已完成的配置

1. ✅ **Vite 配置已更新**
   - 已配置 `base: '/exam/'` 路径
   - 文件：`vite.config.ts`

2. ✅ **GitHub Actions 工作流已创建**
   - 文件：`.github/workflows/deploy.yml`
   - **但推送失败**：需要 `workflow` 权限

## 🔧 解决方案

### 方案 1：更新 Personal Access Token 权限（推荐）

1. **访问 Token 设置**
   - https://github.com/settings/tokens

2. **找到现有的 token 或创建新 token**
   - 如果创建新 token，确保勾选：
     - ✅ `repo`（完整仓库权限）
     - ✅ `workflow`（更新 GitHub Actions 工作流）

3. **更新 git 配置**
   ```bash
   git remote set-url origin https://<NEW_TOKEN>@github.com/gqcjx/exam.git
   ```

4. **推送 workflow 文件**
   ```bash
   git push origin main
   ```

### 方案 2：手动在 GitHub 上创建 workflow（快速）

如果不想更新 token，可以手动在 GitHub 上创建 workflow 文件：

1. **访问仓库**
   - https://github.com/gqcjx/exam

2. **创建 workflow 文件**
   - 点击 "Add file" → "Create new file"
   - 路径：`.github/workflows/deploy.yml`
   - 内容：复制下面的 YAML 配置

3. **提交文件**
   - 点击 "Commit new file"

#### Workflow 文件内容：

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      
      - name: Setup Pages
        uses: actions/configure-pages@v4
      
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

## 📋 启用 GitHub Pages

无论使用哪种方案，完成后都需要：

### 第一步：启用 GitHub Pages

1. **访问仓库设置**
   - https://github.com/gqcjx/exam/settings/pages

2. **配置 Pages 源**
   - Source: 选择 **"GitHub Actions"**
   - 不要选择 "Deploy from a branch"

3. **保存设置**

### 第二步：触发部署

- **自动触发**：推送代码到 `main` 分支后自动运行
- **手动触发**：访问 https://github.com/gqcjx/exam/actions，点击 "Run workflow"

### 第三步：等待部署完成

- 查看部署状态：https://github.com/gqcjx/exam/actions
- 部署成功后访问：https://gqcjx.github.io/exam/

## ⚠️ 重要提示

### 路径配置
- 所有资源路径会自动添加 `/exam/` 前缀
- 如果将来使用自定义域名，需要修改 `vite.config.ts` 中的 `base` 为 `/`

### 环境变量
- 如果构建时需要 Supabase 环境变量，需要在 GitHub Secrets 中配置：
  - https://github.com/gqcjx/exam/settings/secrets/actions
  - 添加：`VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

## 🎯 推荐步骤

1. ✅ Vite 配置已更新（已推送）
2. ⏳ 选择方案 1 或方案 2 创建 workflow
3. ⏳ 在 GitHub 上启用 Pages（选择 "GitHub Actions"）
4. ⏳ 等待首次部署完成
5. ⏳ 访问 https://gqcjx.github.io/exam/ 验证

---

**建议使用方案 1**，这样可以保持代码和配置的同步，未来修改 workflow 也更方便。

