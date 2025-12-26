# 排查 GitHub Pages 部署问题

## 🔍 诊断步骤

### 第一步：检查 GitHub Actions 运行状态

1. **访问 Actions 页面**
   - https://github.com/gqcjx/exam/actions

2. **查看最新的工作流运行**
   - 找到 "Deploy to GitHub Pages" 工作流
   - 点击查看运行详情

3. **检查是否有错误**
   - 如果显示 ❌ 失败，点击查看错误日志
   - 如果显示 ✅ 成功，继续下一步

### 第二步：检查 GitHub Pages 设置

1. **访问 Pages 设置**
   - https://github.com/gqcjx/exam/settings/pages

2. **确认配置**
   - Source 应该选择：**"GitHub Actions"**
   - 如果显示 "Deploy from a branch"，需要改为 "GitHub Actions"

3. **查看部署状态**
   - 应该显示最新的部署记录
   - 如果有部署记录，点击查看详情

### 第三步：常见问题排查

#### 问题 1：Actions 显示失败

**可能原因：**
- 构建错误（TypeScript 错误、依赖问题）
- 环境变量缺失
- Node.js 版本不兼容

**解决方法：**
1. 查看 Actions 日志中的错误信息
2. 检查 `package.json` 中的依赖是否正确
3. 尝试本地构建：`npm run build`

#### 问题 2：Pages 设置未启用

**症状：**
- 访问 https://gqcjx.github.io/exam/ 显示 404
- Settings → Pages 显示 "Your site is live at..." 但实际无法访问

**解决方法：**
1. 确保 Source 选择 "GitHub Actions"
2. 等待几分钟让 GitHub 处理
3. 清除浏览器缓存后重试

#### 问题 3：构建成功但页面空白

**可能原因：**
- 路径配置问题
- 资源加载失败
- React Router 配置问题

**解决方法：**
1. 检查浏览器控制台错误
2. 确认 `vite.config.ts` 中 `base: '/exam/'` 已配置
3. 检查所有资源路径是否正确

#### 问题 4：首次部署需要等待

**说明：**
- 首次启用 GitHub Pages 可能需要 5-10 分钟
- 构建过程可能需要 2-5 分钟
- 总共可能需要 10-15 分钟才能访问

### 第四步：验证配置

#### 检查 vite.config.ts

```typescript
export default defineConfig({
  plugins: [react()],
  base: '/exam/', // 必须配置此项
})
```

#### 检查 workflow 文件

确保 `.github/workflows/deploy.yml` 存在且内容正确。

#### 检查构建输出

本地运行构建命令，检查是否有错误：
```bash
npm run build
```

### 第五步：手动触发部署

如果自动部署未触发，可以手动触发：

1. **访问 Actions 页面**
   - https://github.com/gqcjx/exam/actions

2. **选择工作流**
   - 点击 "Deploy to GitHub Pages"

3. **手动运行**
   - 点击 "Run workflow"
   - 选择分支：`main`
   - 点击 "Run workflow"

## 🔧 快速修复命令

如果发现问题，可以尝试以下操作：

### 1. 重新推送触发部署

```bash
# 创建一个空提交来触发部署
git commit --allow-empty -m "trigger: redeploy to GitHub Pages"
git push origin main
```

### 2. 检查本地构建

```bash
# 清理并重新构建
rm -rf dist
npm run build

# 检查 dist 目录是否生成
ls -la dist
```

### 3. 验证配置文件

```bash
# 检查 vite.config.ts
cat vite.config.ts

# 检查 workflow 文件
cat .github/workflows/deploy.yml
```

## 📋 需要提供的信息

如果问题仍未解决，请提供以下信息：

1. **GitHub Actions 状态**
   - 截图或描述 Actions 页面的状态
   - 是否有错误信息

2. **GitHub Pages 设置**
   - Source 选择的是什么？
   - 是否有部署记录？

3. **浏览器控制台错误**
   - 打开 https://gqcjx.github.io/exam/
   - 按 F12 打开开发者工具
   - 查看 Console 和 Network 标签的错误

4. **本地构建结果**
   - 运行 `npm run build` 的结果
   - 是否有构建错误？

## 🎯 预期结果

配置正确后，应该看到：

1. ✅ GitHub Actions 显示绿色成功标记
2. ✅ GitHub Pages 设置显示 "Your site is live at https://gqcjx.github.io/exam/"
3. ✅ 访问 https://gqcjx.github.io/exam/ 可以看到网站首页

---

**请按照上述步骤逐一检查，并告诉我每一步的结果！**


