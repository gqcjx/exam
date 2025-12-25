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

  // 注意：如果 Edge Function 的 verify_jwt 设置为 true，Supabase 会自动验证 JWT
  // 如果 verify_jwt 设置为 false，这里可以检查 Authorization header
  // 为了简化，我们暂时不检查，让 Supabase 平台层面的验证处理
  // 如果 verify_jwt 为 true 且认证失败，请求不会到达这里

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

