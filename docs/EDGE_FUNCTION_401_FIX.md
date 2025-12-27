# Edge Function 401 错误修复指南

## 问题描述

Word 文档导入时出现 `401 Unauthorized` 错误，这通常表示 Edge Function 的 JWT 验证设置有问题。

## 可能的原因

1. **Edge Function 的 `verify_jwt` 设置不正确**
2. **用户未登录或 token 已过期**
3. **Edge Function 代码未正确部署**

## 解决方案

### 步骤 1：检查用户登录状态

1. 打开浏览器开发者工具（F12）
2. 进入"题库管理"页面
3. 检查右上角是否显示用户名
4. 如果未登录，请先登录

### 步骤 2：检查 Edge Function 的 JWT 验证设置

在 Supabase Dashboard 中：

1. 进入 **Edge Functions** → **import-questions**
2. 查看函数的 **Settings** 或 **Configuration**
3. 检查 **Verify JWT** 设置：
   - 如果设置为 `true`：Supabase 会自动验证 JWT，如果用户未登录或 token 无效，会返回 401
   - 如果设置为 `false`：需要在代码中手动验证

### 步骤 3：重新部署 Edge Function

#### 方法 A：通过 Supabase Dashboard（推荐）

1. **登录 Supabase Dashboard**
   - 访问 https://supabase.com/dashboard
   - 选择你的项目

2. **进入 Edge Functions**
   - 左侧菜单 → `Edge Functions`
   - 找到 `import-questions` 函数

3. **更新函数代码**
   - 复制以下完整代码：

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 题库导入 Edge Function：校验 + 可选写库（需设置环境变量 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY）

const ALLOWED_TYPES = ["single", "multiple", "true_false", "fill", "short"];
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// 创建用于写入数据库的客户端（使用 service role key）
const supabase = SUPABASE_URL && SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) : null;

function validateQuestion(q: any) {
  if (!q?.subject || !q?.stem || !q?.type) return "缺少 subject/stem/type";
  if (!ALLOWED_TYPES.includes(q.type)) return "不支持的题型";
  if (["single", "multiple", "true_false"].includes(q.type) && !Array.isArray(q.options)) {
    return "选择/判断题需提供 options";
  }
  if (!q.answer) return "缺少答案";
  return null;
}

async function insertQuestions(list: any[]) {
  if (!supabase) return { inserted: 0, mode: "dry-run" };
  const { error } = await supabase.from("questions").insert(list);
  if (error) throw new Error(error.message);
  return { inserted: list.length, mode: "write" };
}

// CORS 头
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Only POST allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 检查认证 header（Supabase 会自动验证 JWT，如果 verify_jwt 设置为 true）
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "未提供认证信息，请先登录" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();
    const list = Array.isArray(payload) ? payload : payload?.questions;
    if (!Array.isArray(list)) {
      return new Response(JSON.stringify({ error: "payload 应为数组或 {questions: []}" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const errors: Array<{ index: number; message: string }> = [];
    list.forEach((q, idx) => {
      const err = validateQuestion(q);
      if (err) errors.push({ index: idx, message: err });
    });

    if (errors.length) {
      return new Response(JSON.stringify({ error: "数据校验失败", errors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await insertQuestions(list);

    return new Response(JSON.stringify({ ok: true, count: list.length, mode: result.mode }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e?.message || "未知错误" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

4. **设置环境变量**
   - 在 Edge Function 设置页面 → **Secrets**
   - 添加以下环境变量：
     - `SUPABASE_URL`: `https://mejrbcxhbgctiwsquqaj.supabase.co`
     - `SUPABASE_SERVICE_ROLE_KEY`: 你的 service_role key（在 Settings > API 中获取）

5. **设置 JWT 验证**
   - 在 Edge Function 设置页面
   - 找到 **Verify JWT** 选项
   - **建议设置为 `false`**（因为我们已经在代码中检查 Authorization header）
   - 或者设置为 `true`（让 Supabase 自动验证，但需要确保用户已登录）

6. **部署**
   - 点击 **Deploy** 按钮
   - 等待部署完成

### 步骤 4：验证修复

1. **确保用户已登录**
   - 刷新页面
   - 检查右上角是否显示用户名

2. **尝试导入 Word 文档**
   - 进入"题库管理"页面
   - 点击"导入题库（CSV/JSON/Word）"
   - 选择一个 Word 文档
   - 应该成功导入

3. **检查浏览器控制台**
   - 如果仍有错误，查看控制台的详细错误信息
   - 检查 Network 标签页中的请求详情

## 重要提示

### 关于 verify_jwt 设置

- **`verify_jwt: true`**：
  - Supabase 会在请求到达你的代码之前验证 JWT
  - 如果 JWT 无效或缺失，会直接返回 401，你的代码不会执行
  - **优点**：更安全，自动处理认证
  - **缺点**：如果用户未登录，无法自定义错误消息

- **`verify_jwt: false`**：
  - Supabase 不会验证 JWT，请求会直接到达你的代码
  - 你需要在代码中手动检查 Authorization header
  - **优点**：可以自定义错误处理和消息
  - **缺点**：需要手动处理认证逻辑

### 推荐设置

**建议使用 `verify_jwt: false`**，因为：
1. 我们已经在代码中检查 Authorization header
2. 可以提供更友好的错误消息
3. 可以更好地控制认证流程

## 如果仍然无法解决

1. **检查 Edge Function 日志**
   - 在 Supabase Dashboard → Edge Functions → import-questions → Logs
   - 查看是否有错误信息

2. **检查环境变量**
   - 确保 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 都已正确设置
   - 环境变量区分大小写

3. **检查用户权限**
   - 确保用户已登录
   - 检查用户的 role 是否为 admin 或 teacher（如果需要）

4. **清除浏览器缓存**
   - 按 Ctrl+Shift+Delete
   - 清除缓存和 Cookie
   - 重新登录

5. **检查 Supabase 项目状态**
   - 确保项目状态为 ACTIVE
   - 检查是否有配额限制

## 联系支持

如果以上步骤都无法解决问题，请提供以下信息：
- Edge Function 的日志
- 浏览器控制台的完整错误信息
- Network 标签页中的请求详情
- Edge Function 的配置（verify_jwt 设置、环境变量等）



