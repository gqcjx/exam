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

  // 从环境变量获取 Supabase URL
  // 注意：VITE_ 前缀的变量只在构建时可用，运行时不可用
  // 所以需要在 Netlify 控制台配置不带 VITE_ 前缀的变量，或者同时配置两个
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  
  console.log('Environment check:', {
    hasSupabaseUrl: !!supabaseUrl,
    hasSupabaseAnonKey: !!supabaseAnonKey,
    urlSource: process.env.SUPABASE_URL ? 'SUPABASE_URL' : (process.env.VITE_SUPABASE_URL ? 'VITE_SUPABASE_URL' : 'none'),
    keySource: process.env.SUPABASE_ANON_KEY ? 'SUPABASE_ANON_KEY' : (process.env.VITE_SUPABASE_ANON_KEY ? 'VITE_SUPABASE_ANON_KEY' : 'none'),
  })
  
  if (!supabaseUrl) {
    console.error('Supabase URL not configured in environment variables')
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Supabase URL not configured',
        hint: 'Please configure SUPABASE_URL or VITE_SUPABASE_URL in Netlify environment variables'
      }),
    }
  }

  // 从路径中提取 Supabase API 路径
  // 例如: /.netlify/functions/supabase-proxy/rest/v1/profiles
  // 或者: /.netlify/functions/supabase-proxy/auth/v1/token?grant_type=password
  let apiPath = ''
  if (event.path.includes('/supabase-proxy/')) {
    const pathMatch = event.path.match(/\/supabase-proxy\/(.+)/)
    if (pathMatch) {
      apiPath = pathMatch[1]
    }
  } else if (event.path.startsWith('/.netlify/functions/supabase-proxy/')) {
    apiPath = event.path.replace('/.netlify/functions/supabase-proxy/', '')
  }
  
  // 如果路径中没有查询参数，尝试从 event.queryStringParameters 获取
  if (!apiPath.includes('?') && event.queryStringParameters) {
    const queryString = new URLSearchParams(event.queryStringParameters).toString()
    if (queryString) {
      apiPath += '?' + queryString
    }
  }
  
  if (!apiPath) {
    console.error('Invalid proxy path:', event.path, 'queryStringParameters:', event.queryStringParameters)
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Invalid proxy path', path: event.path, query: event.queryStringParameters }),
    }
  }
  
  // 构建目标 URL，确保正确处理路径和查询参数
  const targetUrl = `${supabaseUrl.replace(/\/$/, '')}/${apiPath}`
  console.log('Proxying request:', event.httpMethod, targetUrl)
  console.log('Request headers:', JSON.stringify(event.headers, null, 2))
  console.log('Request body type:', typeof event.body)
  console.log('Request body length:', event.body ? event.body.length : 0)
  console.log('Is base64 encoded:', event.isBase64Encoded)

  // 获取原始请求的 headers
  const headers = {}
  
  // 复制所有相关 headers（保持原始大小写）
  const contentType = event.headers['content-type'] || event.headers['Content-Type']
  if (contentType) {
    headers['Content-Type'] = contentType
  }
  
  // 转发认证 headers
  if (event.headers.authorization || event.headers['Authorization']) {
    headers['Authorization'] = event.headers.authorization || event.headers['Authorization']
  }
  if (event.headers['x-client-info'] || event.headers['X-Client-Info']) {
    headers['x-client-info'] = event.headers['x-client-info'] || event.headers['X-Client-Info']
  }
  if (event.headers.apikey || event.headers['apikey']) {
    headers['apikey'] = event.headers.apikey || event.headers['apikey']
  }
  
  // Supabase 需要的其他 headers
  if (event.headers['prefer'] || event.headers['Prefer']) {
    headers['Prefer'] = event.headers['prefer'] || event.headers['Prefer']
  }
  
  // 确保有 apikey（如果没有从 headers 获取）
  if (!headers['apikey'] && supabaseAnonKey) {
    headers['apikey'] = supabaseAnonKey
  }
  
  // 如果仍然没有 apikey，记录警告
  if (!headers['apikey']) {
    console.warn('Warning: apikey not found in headers or environment variables')
  }

  // 处理请求体
  // Netlify Functions 的 event.body 可能是字符串（如果是 JSON 或 form-urlencoded）
  // 需要原样转发，不要解析
  let requestBody = event.body
  
  // 如果是 base64 编码的 body（Netlify 在某些情况下会这样做）
  if (event.isBase64Encoded && event.body) {
    requestBody = Buffer.from(event.body, 'base64').toString('utf-8')
    console.log('Decoded base64 body, length:', requestBody.length)
  }
  
  // 对于 form-urlencoded 请求，确保 Content-Type 正确
  if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
    // 确保 Content-Type header 正确设置
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    console.log('Form-urlencoded request detected, body preview:', requestBody ? requestBody.substring(0, 100) : 'empty')
  }

  try {
    console.log('Sending request to:', targetUrl)
    console.log('Request method:', event.httpMethod)
    console.log('Request headers:', JSON.stringify(headers, null, 2))
    console.log('Request body preview:', requestBody ? (typeof requestBody === 'string' ? requestBody.substring(0, 200) : String(requestBody).substring(0, 200)) : 'empty')
    
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers,
      body: requestBody || undefined,
    })

    const data = await response.text()
    let jsonData
    try {
      jsonData = JSON.parse(data)
    } catch {
      jsonData = data
    }

    console.log('Response status:', response.status)
    console.log('Response preview:', typeof jsonData === 'string' ? jsonData.substring(0, 200) : JSON.stringify(jsonData).substring(0, 200))

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
    console.error('Error stack:', error.stack)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: error.message || 'Proxy request failed', details: error.stack }),
    }
  }
}
