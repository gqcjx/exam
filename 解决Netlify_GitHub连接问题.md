# 解决 Netlify GitHub 连接问题

## 🔍 错误信息

```
Failed during stage 'preparing repo': 
fatal: unable to access 'https://github.com/gqcjx/exam/': Could not resolve host: github.com
```

这是一个网络连接问题，Netlify 无法访问 GitHub 仓库。

## ✅ 解决方案

### 方案 1：重新连接 GitHub 仓库（推荐）

1. **访问 Netlify 站点设置**
   - 打开：https://app.netlify.com/sites/qfce/configuration/deploys
   - 或者：Netlify Dashboard → 你的站点 → `Site settings` → `Build & deploy` → `Continuous Deployment`

2. **断开并重新连接**
   - 找到 "Build settings" 部分
   - 点击 "Link to a Git provider"
   - 选择 "GitHub"
   - 重新授权并选择仓库 `gqcjx/exam`
   - 保存设置

3. **触发重新部署**
   - 访问：https://app.netlify.com/sites/qfce/deploys
   - 点击 `Trigger deploy` → `Deploy site`

### 方案 2：检查 Netlify 的 GitHub 集成

1. **访问 Netlify 账户设置**
   - 打开：https://app.netlify.com/user/applications
   - 或者：Netlify Dashboard → 右上角头像 → `User settings` → `Applications`

2. **检查 GitHub 集成**
   - 找到 "GitHub" 集成
   - 确认状态为 "Connected"
   - 如果未连接，点击 "Connect to GitHub" 并授权

3. **检查仓库权限**
   - 确认 Netlify 有权限访问 `gqcjx/exam` 仓库
   - 如果仓库是私有的，确保 Netlify 有访问权限

### 方案 3：手动触发部署（临时解决）

如果网络问题是临时的，可以等待几分钟后重试：

1. **访问部署页面**
   - https://app.netlify.com/sites/qfce/deploys

2. **手动触发部署**
   - 点击 `Trigger deploy` → `Deploy site`
   - 选择 "Deploy site"（不是 "Clear cache and deploy site"）

3. **如果仍然失败**
   - 等待 5-10 分钟后重试
   - 这可能是 Netlify 或 GitHub 的临时网络问题

### 方案 4：使用 Netlify CLI 手动部署

如果 Git 集成持续有问题，可以使用 Netlify CLI 手动部署：

1. **安装 Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **登录 Netlify**
   ```bash
   netlify login
   ```

3. **初始化并部署**
   ```bash
   netlify init
   netlify deploy --prod
   ```

## 🔧 检查清单

### 1. 检查 GitHub 仓库状态

- ✅ 确认仓库 `gqcjx/exam` 存在且可访问
- ✅ 确认仓库不是私有的（或者 Netlify 有访问权限）
- ✅ 确认仓库的默认分支是 `main`

### 2. 检查 Netlify 站点配置

访问：https://app.netlify.com/sites/qfce/configuration/deploys

确认：
- ✅ **Repository**：显示 `gqcjx/exam`
- ✅ **Branch**：显示 `main`
- ✅ **Build command**：`npm run build`
- ✅ **Publish directory**：`dist`

### 3. 检查 Netlify 的 GitHub 权限

访问：https://app.netlify.com/user/applications

确认：
- ✅ GitHub 集成已连接
- ✅ 有权限访问 `gqcjx/exam` 仓库

## 📋 常见原因

### 原因 1：临时网络问题

**症状**：偶尔出现连接失败

**解决方法**：
- 等待几分钟后重试
- 这是最常见的临时问题

### 原因 2：GitHub 集成断开

**症状**：持续无法连接

**解决方法**：
- 重新连接 GitHub 集成
- 重新授权 Netlify 访问仓库

### 原因 3：仓库权限问题

**症状**：仓库是私有的，Netlify 无权限

**解决方法**：
- 将仓库设为公开，或
- 在 GitHub 中授权 Netlify 访问私有仓库

### 原因 4：Netlify 服务问题

**症状**：所有站点都无法部署

**解决方法**：
- 检查 Netlify 状态页面：https://www.netlifystatus.com/
- 等待服务恢复

## 🎯 快速修复步骤

1. **访问站点设置**
   - https://app.netlify.com/sites/qfce/configuration/deploys

2. **检查仓库连接**
   - 如果显示 "Not connected"，点击 "Link to a Git provider"
   - 重新连接 GitHub 仓库

3. **触发部署**
   - 访问：https://app.netlify.com/sites/qfce/deploys
   - 点击 `Trigger deploy` → `Deploy site`

4. **等待部署完成**
   - 通常需要 2-5 分钟
   - 查看部署日志确认成功

## ⚠️ 重要提示

- 如果问题持续存在，可能是 Netlify 或 GitHub 的服务问题
- 可以查看 Netlify 状态：https://www.netlifystatus.com/
- 也可以查看 GitHub 状态：https://www.githubstatus.com/

---

**建议先尝试方案 1（重新连接 GitHub 仓库），这通常能解决大部分连接问题！**

