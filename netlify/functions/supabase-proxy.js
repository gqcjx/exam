// 代理 Supabase API 请求
// Netlify Functions 使用 Node.js 运行时
exports.handler = async (event) => {
  // 处理 CORS 预检请求
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
      body: '',
    }
  }

  // 从环境变量获取 Supabase URL（Netlify Functions 可以访问构建时环境变量）
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
  if (!supabaseUrl) {
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Supabase URL not configured' }),
    }
  }

  // 从路径中提取 Supabase API 路径
  // 例如: /.netlify/functions/supabase-proxy/rest/v1/profiles
  let apiPath = ''
  if (event.path.includes('/supabase-proxy/')) {
    const pathMatch = event.path.match(/\/supabase-proxy\/(.+)/)
    if (pathMatch) {
      apiPath = pathMatch[1]
    }
  } else if (event.path.startsWith('/.netlify/functions/supabase-proxy/')) {
    apiPath = event.path.replace('/.netlify/functions/supabase-proxy/', '')
  }
  
  if (!apiPath) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Invalid proxy path', path: event.path }),
    }
  }
  
  const targetUrl = `${supabaseUrl}/${apiPath}`

  // 获取原始请求的 headers
  const headers = {
    'Content-Type': event.headers['content-type'] || 'application/json',
  }

  // 转发认证 headers
  if (event.headers.authorization) {
    headers['Authorization'] = event.headers.authorization
  }
  if (event.headers['x-client-info']) {
    headers['x-client-info'] = event.headers['x-client-info']
  }
  if (event.headers.apikey) {
    headers['apikey'] = event.headers.apikey
  }

  try {
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers,
      body: event.body ? event.body : undefined,
    })

    const data = await response.text()
    let jsonData
    try {
      jsonData = JSON.parse(data)
    } catch {
      jsonData = data
    }

    return {
      statusCode: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      },
      body: typeof jsonData === 'string' ? jsonData : JSON.stringify(jsonData),
    }
  } catch (error) {
    console.error('Proxy error:', error)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: error.message || 'Proxy request failed' }),
    }
  }
}
