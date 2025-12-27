# Edge Function 认证问题修复指南

## 问题描述

Word 文档导入时出现 `401 Unauthorized` 错误，表示 Edge Function 需要认证但未正确验证。

## 解决方案

已更新代码以正确处理 JWT 认证：

### 1. 前端更新 (`exam/src/api/questions.ts`)

- ✅ 添加了登录状态检查
- ✅ 确保调用 Edge Function 前用户已登录
- ✅ 改进了错误提示信息

### 2. Edge Function 更新 (`exam/supabase/functions/import-questions/index.ts`)

- ✅ 添加了 JWT token 验证
- ✅ 检查 Authorization header
- ✅ 验证用户身份

## 部署步骤

### 方法 1：通过 Supabase Dashboard（推荐）

1. **登录 Supabase Dashboard**
   - 访问 https://supabase.com/dashboard
   - 选择你的项目

2. **进入 Edge Functions**
   - 左侧菜单 → `Edge Functions`
   - 找到 `import-questions` 函数

3. **更新函数代码**
   - 复制 `exam/supabase/functions/import-questions/index.ts` 的全部内容
   - 粘贴到编辑器中
   - 点击 `Deploy` 按钮

4. **设置环境变量**（如果还没有设置）
   - 在 Edge Function 设置页面
   - 添加以下环境变量：
     - `SUPABASE_URL`: 你的项目 URL（例如：`https://mejrbcxhbgctiwsquqaj.supabase.co`）
     - `SUPABASE_ANON_KEY`: 你的 anon/public key（在 Settings > API 中获取）
     - `SUPABASE_SERVICE_ROLE_KEY`: 你的 service_role key（在 Settings > API 中获取，**注意保密**）

5. **验证部署**
   - 确保用户已登录
   - 尝试导入 Word 文档
   - 应该不再出现 401 错误

### 方法 2：使用 Supabase CLI

```bash
# 1. 登录 Supabase CLI
npx supabase login

# 2. 链接到你的项目
npx supabase link --project-ref mejrbcxhbgctiwsquqaj

# 3. 设置环境变量（如果还没有设置）
npx supabase secrets set SUPABASE_URL=https://mejrbcxhbgctiwsquqaj.supabase.co
npx supabase secrets set SUPABASE_ANON_KEY=your-anon-key
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 4. 部署 Edge Function
cd exam
npx supabase functions deploy import-questions
```

## 环境变量说明

### SUPABASE_URL
- 你的 Supabase 项目 URL
- 格式：`https://your-project-ref.supabase.co`
- 在 Supabase Dashboard → Settings → API 中可以找到

### SUPABASE_ANON_KEY
- 你的 anon/public key（公开密钥）
- 用于验证用户 JWT token
- 在 Supabase Dashboard → Settings → API 中可以找到
- **注意**：这是公开密钥，可以暴露在前端代码中

### SUPABASE_SERVICE_ROLE_KEY
- 你的 service_role key（服务角色密钥）
- 用于绕过 RLS 直接写入数据库
- 在 Supabase Dashboard → Settings → API 中可以找到
- **⚠️ 重要**：这是敏感密钥，**绝对不能**暴露在前端代码中，只能用于 Edge Functions 和服务器端代码

## 验证步骤

1. **确保用户已登录**
   - 在浏览器中打开应用
   - 确保已登录（检查右上角是否显示用户名）

2. **尝试导入 Word 文档**
   - 进入"题库管理"页面
   - 点击"导入题库（CSV/JSON/Word）"
   - 选择一个 Word 文档
   - 应该成功导入，不再出现 401 错误

3. **检查错误信息**
   - 如果仍然出现 401 错误：
     - 检查用户是否已登录
     - 检查 Edge Function 的环境变量是否正确设置
     - 检查浏览器控制台的错误信息

## 常见问题

### Q: 为什么需要认证？
A: Edge Function 需要验证用户身份，确保只有已登录的用户可以导入题目。这符合安全最佳实践。

### Q: 如果用户未登录会怎样？
A: 前端会先检查登录状态，如果未登录会提示"请先登录后再导入题库"。

### Q: 环境变量在哪里设置？
A: 在 Supabase Dashboard → Edge Functions → import-questions → Settings → Secrets 中设置。

### Q: 如何获取环境变量的值？
A: 在 Supabase Dashboard → Settings → API 中可以找到所有需要的密钥。

## 更新后的代码

### Edge Function 完整代码

请参考 `exam/supabase/functions/import-questions/index.ts` 文件。

关键更新：
- 添加了 JWT token 验证
- 检查 Authorization header
- 使用 anon key 验证用户身份
- 使用 service_role key 写入数据库

## 注意事项

1. **安全性**：
   - `SUPABASE_SERVICE_ROLE_KEY` 绝对不能暴露在前端
   - 只在 Edge Functions 中使用 service_role key

2. **环境变量**：
   - 确保所有环境变量都已正确设置
   - 环境变量区分大小写

3. **用户权限**：
   - 当前实现允许所有已登录用户导入题目
   - 如果需要限制为管理员/教师，可以在 Edge Function 中添加角色检查

## 后续优化建议

如果需要限制导入权限为管理员/教师：

```typescript
// 在 Edge Function 中添加角色检查
const { data: profile } = await supabaseAuth
  .from('profiles')
  .select('role')
  .eq('user_id', user.id)
  .single();

if (!profile || (profile.role !== 'admin' && profile.role !== 'teacher')) {
  return new Response(JSON.stringify({ error: '权限不足，仅管理员和教师可以导入题目' }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```



