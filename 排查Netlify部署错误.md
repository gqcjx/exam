# 排查 Netlify 部署错误

## 🔍 常见错误及解决方法

### 错误 1：构建失败 - 环境变量未定义

**错误信息**：
```
Error: VITE_SUPABASE_URL is not defined
```

**解决方法**：
1. 访问：https://app.netlify.com/sites/qfce/configuration/env
2. 添加环境变量：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. 触发重新部署

### 错误 2：构建失败 - TypeScript 错误

**错误信息**：
```
error TS2307: Cannot find module 'xxx'
```

**解决方法**：
1. 检查 `package.json` 中的依赖是否正确
2. 确认所有依赖都已安装
3. 检查 TypeScript 配置

### 错误 3：构建失败 - 找不到模块

**错误信息**：
```
Error: Cannot find module 'xxx'
```

**解决方法**：
1. 确认 `package-lock.json` 已提交到仓库
2. 在 Netlify 构建设置中确保使用 `npm ci` 而不是 `npm install`
3. 检查 `package.json` 中的依赖版本

### 错误 4：构建成功但页面空白

**可能原因**：
- base 路径配置错误
- React Router basename 配置错误
- 资源路径不匹配

**解决方法**：
1. 检查浏览器控制台错误
2. 检查网络请求，确认资源路径正确
3. 确认 `vite.config.ts` 和 `src/routes.tsx` 配置正确

### 错误 5：404 错误 - 路由不工作

**可能原因**：
- `netlify.toml` 中的重定向规则未生效
- SPA 路由未正确配置

**解决方法**：
1. 确认 `netlify.toml` 文件已提交到仓库根目录
2. 确认重定向规则：
   ```toml
   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```
3. 触发重新部署

### 错误 6：构建超时

**可能原因**：
- 构建时间过长
- 依赖安装失败

**解决方法**：
1. 检查构建日志，找出耗时步骤
2. 优化构建配置
3. 考虑使用构建缓存

## 🔧 检查清单

### 1. 检查 Netlify 构建设置

访问：https://app.netlify.com/sites/qfce/configuration/deploys

确认：
- ✅ **Build command**: `npm run build`
- ✅ **Publish directory**: `dist`
- ✅ **Node version**: 20（在 `netlify.toml` 中配置）

### 2. 检查环境变量

访问：https://app.netlify.com/sites/qfce/configuration/env

确认：
- ✅ `VITE_SUPABASE_URL` 已配置
- ✅ `VITE_SUPABASE_ANON_KEY` 已配置
- ✅ 环境变量作用域设置为 `All scopes` 或 `Production`

### 3. 检查配置文件

确认以下文件已提交到仓库：
- ✅ `netlify.toml`（在根目录）
- ✅ `vite.config.ts`
- ✅ `package.json`
- ✅ `package-lock.json`

### 4. 检查构建日志

访问：https://app.netlify.com/sites/qfce/deploys

1. 点击最新的部署
2. 查看构建日志
3. 查找错误信息（通常以 `Error:` 或 `Failed:` 开头）

## 📋 快速修复步骤

### 步骤 1：查看构建日志

1. 访问：https://app.netlify.com/sites/qfce/deploys
2. 点击最新的失败部署
3. 查看 "Build log" 部分
4. 复制错误信息

### 步骤 2：根据错误类型修复

**如果是环境变量错误**：
- 配置环境变量（见上方）

**如果是构建错误**：
- 检查代码是否有语法错误
- 运行本地构建：`npm run build`
- 修复错误后推送代码

**如果是配置错误**：
- 检查 `netlify.toml` 配置
- 确认文件格式正确

### 步骤 3：触发重新部署

修复后，触发重新部署：
1. 访问：https://app.netlify.com/sites/qfce/deploys
2. 点击 `Trigger deploy` → `Deploy site`

## 🎯 本地测试

在推送代码前，建议先在本地测试构建：

```bash
# 安装依赖
npm install

# 构建项目
npm run build

# 预览构建结果
npm run preview
```

如果本地构建成功，Netlify 构建也应该成功。

## 📝 获取帮助

如果以上方法都无法解决问题：

1. **查看完整的构建日志**
   - 复制完整的错误信息
   - 包括错误堆栈跟踪

2. **检查相关文件**
   - 确认所有配置文件格式正确
   - 确认没有语法错误

3. **提供详细信息**
   - 错误信息
   - 构建日志片段
   - 相关配置文件内容

---

**请查看 Netlify 部署日志，告诉我具体的错误信息，我可以帮你进一步诊断问题！**

