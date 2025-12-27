# 修复 CORS 错误指南

## 问题
批量导入学生时出现 CORS 错误：
```
Access to fetch at 'https://mejrbcxhbgctiwsquqaj.supabase.co/functions/v1/create-student' 
from origin 'https://gqcjx.github.io' has been blocked by CORS policy: 
Response to preflight request doesn't pass access control check: 
It does not have HTTP ok status.
```

## 可能的原因

1. **Edge Function 未部署**：`create-student` 函数可能还没有在 Supabase 上创建或部署
2. **OPTIONS 请求失败**：预检请求返回了非 200 状态码
3. **环境变量未配置**：Edge Function 缺少必要的环境变量

## 解决步骤

### 步骤 1：确认 Edge Function 是否存在

1. **登录 Supabase Dashboard**
   - 访问 https://supabase.com/dashboard
   - 选择项目（mejrbcxhbgctiwsquqaj）

2. **检查 Edge Functions**
   - 左侧菜单 → `Edge Functions`
   - 查看是否有 `create-student` 函数
   - 如果没有，需要创建它

### 步骤 2：创建/更新 Edge Function

#### 如果函数不存在：

1. **创建新函数**
   - 点击 `Create a new function`
   - 函数名称：`create-student`
   - 点击 `Create function`

2. **复制代码**
   - 打开项目中的 `supabase/functions/create-student/index.ts`
   - 复制全部内容
   - 粘贴到 Supabase Dashboard 的代码编辑器中

#### 如果函数已存在：

1. **更新函数代码**
   - 点击 `create-student` 函数
   - 点击 `Edit` 或进入编辑模式
   - 复制项目中的 `supabase/functions/create-student/index.ts` 全部内容
   - 粘贴并替换现有代码

### 步骤 3：配置环境变量（重要！）

在 Edge Function 设置页面找到 `Secrets` 或 `Environment Variables`，添加：

1. **SUPABASE_URL**
   - 值：`https://mejrbcxhbgctiwsquqaj.supabase.co`

2. **SUPABASE_ANON_KEY**
   - 获取方式：Supabase Dashboard → Settings → API → anon public key
   - 复制完整的 key 值

3. **SUPABASE_SERVICE_ROLE_KEY**
   - 获取方式：Supabase Dashboard → Settings → API → service_role key
   - 复制完整的 key 值（注意保密）

### 步骤 4：设置 JWT 验证

在 Edge Function 设置页面：

1. 找到 **Verify JWT** 选项
2. **设置为 `false`**（重要！）
   - 这样我们的代码可以手动验证用户权限
   - 如果设置为 `true`，可能导致 CORS 或认证问题

### 步骤 5：部署

1. 点击 `Deploy` 按钮
2. 等待部署完成（通常几秒钟）
3. 检查部署状态，确保显示 "Deployed" 或 "Active"

### 步骤 6：验证部署

1. **检查函数日志**
   - 在 Edge Function 页面 → `Logs` 标签
   - 应该能看到函数已部署的日志

2. **测试调用**
   - 刷新前端页面
   - 确保已登录（且是管理员或教师）
   - 进入"用户管理"页面
   - 点击"批量导入学生"
   - 选择 Excel 文件并导入
   - 检查是否成功

## 如果仍然失败

### 检查浏览器控制台

1. 按 F12 打开开发者工具
2. 进入 `Network` 标签
3. 尝试导入学生
4. 找到 `create-student` 请求
5. 查看：
   - 请求 URL 是否正确
   - 请求方法（应该是 POST）
   - 响应状态码
   - 响应内容

### 检查 Edge Function 日志

1. Supabase Dashboard → Edge Functions → create-student → Logs
2. 查看是否有错误信息
3. 检查请求是否到达了 Edge Function

### 常见问题

**Q: 如何确认 Edge Function 已部署？**
A: 在 Supabase Dashboard → Edge Functions 页面，`create-student` 应该显示为 "Active" 或 "Deployed" 状态。

**Q: OPTIONS 请求返回什么状态码？**
A: 应该返回 200（已更新代码）。如果返回其他状态码，可能是部署问题。

**Q: 环境变量在哪里设置？**
A: 在 Edge Function 的设置页面，通常有 "Secrets" 或 "Environment Variables" 部分。

**Q: 为什么需要设置 Verify JWT 为 false？**
A: 我们的代码会手动验证用户身份和权限。如果设置为 true，Supabase 会在平台层面验证 JWT，可能导致 CORS 或认证问题。

## 快速检查清单

- [ ] Edge Function `create-student` 已创建
- [ ] Edge Function 代码已更新（使用最新代码）
- [ ] 环境变量 `SUPABASE_URL` 已设置
- [ ] 环境变量 `SUPABASE_ANON_KEY` 已设置
- [ ] 环境变量 `SUPABASE_SERVICE_ROLE_KEY` 已设置
- [ ] Verify JWT 设置为 `false`
- [ ] Edge Function 已部署（状态为 Active/Deployed）
- [ ] 用户已登录（且是管理员或教师）
- [ ] 浏览器控制台没有其他错误
