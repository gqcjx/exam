# Edge Function 部署指南

## 问题
CORS 错误：`Access-Control-Allow-Origin header is missing`

## 解决方案
已更新 `import-questions` Edge Function 添加了 CORS 支持，需要重新部署。

## 部署方法（选择其一）

### 方法 1：通过 Supabase Dashboard（推荐）

1. **登录 Supabase Dashboard**
   - 访问 https://supabase.com/dashboard
   - 选择你的项目（mejrbcxhbgctiwsquqaj）

2. **进入 Edge Functions 页面**
   - 左侧菜单 → `Edge Functions`
   - 找到 `import-questions` 函数

3. **更新函数代码**
   - 点击函数名称进入详情页
   - 点击 `Edit` 或 `Update` 按钮
   - 复制 `exam/supabase/functions/import-questions/index.ts` 的全部内容
   - 粘贴到编辑器中
   - 点击 `Deploy` 或 `Save` 按钮

4. **验证部署**
   - 部署成功后，刷新前端页面
   - 再次尝试导入 Word 文件
   - CORS 错误应该消失

### 方法 2：使用 Supabase CLI

如果你已经安装了 Supabase CLI：

```bash
# 1. 登录 Supabase CLI
npx supabase login

# 2. 链接到你的项目
npx supabase link --project-ref mejrbcxhbgctiwsquqaj

# 3. 部署 Edge Function
cd exam
npx supabase functions deploy import-questions
```

**注意：** 如果项目状态为 INACTIVE，可能需要先激活项目。

### 方法 3：直接复制代码

如果上述方法都不行，可以：

1. 打开 Supabase Dashboard
2. 进入 `Edge Functions` → `import-questions`
3. 复制以下完整代码：

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 题库导入 Edge Function：校验 + 可选写库（需设置环境变量 SUPABASE_URL 与 SUPABASE_SERVICE_ROLE_KEY）

const ALLOWED_TYPES = ["single", "multiple", "true_false", "fill", "short"];
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
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

4. 粘贴到 Supabase Dashboard 的代码编辑器中
5. 点击 `Deploy` 按钮

## 关键变更说明

本次更新添加了以下 CORS 支持：

1. **CORS 响应头**：
   - `Access-Control-Allow-Origin: *` - 允许所有来源
   - `Access-Control-Allow-Headers` - 允许的请求头
   - `Access-Control-Allow-Methods` - 允许的 HTTP 方法

2. **OPTIONS 预检请求处理**：
   - 浏览器在发送 POST 请求前会先发送 OPTIONS 请求
   - 现在 Edge Function 会正确响应 OPTIONS 请求

3. **所有响应都包含 CORS 头**：
   - 确保所有响应（成功、错误）都包含 CORS 头

## 部署后验证

部署完成后：

1. 刷新前端页面（http://localhost:5173）
2. 进入"题库管理"页面
3. 点击"导入题库（CSV/JSON/Word）"
4. 选择一个 Word 文件
5. 检查浏览器控制台，应该不再有 CORS 错误

## 如果仍有问题

如果部署后仍有 CORS 错误：

1. **清除浏览器缓存**：Ctrl+Shift+Delete
2. **硬刷新页面**：Ctrl+F5
3. **检查 Edge Function 日志**：
   - Supabase Dashboard → Edge Functions → import-questions → Logs
   - 查看是否有错误信息

4. **验证环境变量**：
   - 确保 Edge Function 的环境变量 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 已正确设置
   - Supabase Dashboard → Edge Functions → import-questions → Settings → Secrets



