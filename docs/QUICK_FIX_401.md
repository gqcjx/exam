# 快速修复 401 错误

## 问题
Word 文档导入时出现 `401 Unauthorized` 错误。

## 原因
Edge Function 的 JWT 验证设置导致认证失败。

## 解决方案（3 步）

### 步骤 1：检查用户登录状态
- ✅ 确保已登录（右上角显示用户名）
- ✅ 如果未登录，请先登录

### 步骤 2：在 Supabase Dashboard 中设置 Edge Function

1. **打开 Supabase Dashboard**
   - 访问 https://supabase.com/dashboard
   - 选择你的项目

2. **进入 Edge Functions**
   - 左侧菜单 → `Edge Functions`
   - 找到 `import-questions` 函数

3. **检查/设置 Verify JWT**
   - 在函数设置页面找到 **Verify JWT** 选项
   - **设置为 `false`**（重要！）
   - 这样 Supabase 不会在平台层面验证 JWT，我们的代码可以处理认证

4. **设置环境变量**（如果还没有）
   - 在函数设置页面 → **Secrets**
   - 添加：
     - `SUPABASE_URL`: `https://mejrbcxhbgctiwsquqaj.supabase.co`
     - `SUPABASE_SERVICE_ROLE_KEY`: 你的 service_role key（在 Settings > API 中获取）

### 步骤 3：重新部署 Edge Function

1. **复制代码**
   - 打开 `exam/supabase/functions/import-questions/index.ts`
   - 复制全部内容

2. **粘贴到 Supabase Dashboard**
   - 在 Edge Functions → import-questions → Editor
   - 粘贴代码

3. **点击 Deploy**
   - 等待部署完成

### 步骤 4：测试

1. 刷新前端页面
2. 确保已登录
3. 尝试导入 Word 文档
4. 应该成功！

## 如果仍然失败

### 检查 Edge Function 日志
1. 在 Supabase Dashboard → Edge Functions → import-questions → Logs
2. 查看是否有错误信息
3. 检查请求是否到达了 Edge Function

### 检查浏览器控制台
1. 按 F12 打开开发者工具
2. 查看 Network 标签页
3. 找到 `import-questions` 请求
4. 查看请求详情和响应

### 常见问题

**Q: 如何找到 Verify JWT 设置？**
A: 在 Edge Function 的设置页面，通常在 "Configuration" 或 "Settings" 部分。

**Q: 如何获取 service_role key？**
A: Supabase Dashboard → Settings → API → Service Role Key（注意保密！）

**Q: 设置 verify_jwt 为 false 安全吗？**
A: 是的，因为我们的代码会检查用户是否已登录。而且只有已登录的用户才能访问前端页面。

## 完整代码

Edge Function 的完整代码在 `exam/supabase/functions/import-questions/index.ts`，可以直接复制使用。



