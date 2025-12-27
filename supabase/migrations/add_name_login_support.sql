-- 添加通过姓名登录支持

-- 函数：通过姓名查找用户（用于登录）
CREATE OR REPLACE FUNCTION find_user_by_name(name_text TEXT)
RETURNS TABLE(user_id UUID, email TEXT, phone TEXT, name TEXT, role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    u.email::TEXT,
    COALESCE(p.phone, u.phone)::TEXT as phone,
    p.name,
    p.role::TEXT
  FROM profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE p.name = name_text
     OR p.name ILIKE '%' || name_text || '%'  -- 支持部分匹配（昵称）
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 更新 find_user_by_account 函数，支持姓名查找
CREATE OR REPLACE FUNCTION find_user_by_account(account_text TEXT)
RETURNS TABLE(user_id UUID, email TEXT, phone TEXT, name TEXT, role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    u.email::TEXT,
    COALESCE(p.phone, u.phone)::TEXT as phone,
    p.name,
    p.role::TEXT
  FROM profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE u.email = account_text
     OR p.phone = account_text
     OR u.phone = account_text
     OR p.name = account_text
     OR p.name ILIKE '%' || account_text || '%'  -- 支持姓名部分匹配
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
