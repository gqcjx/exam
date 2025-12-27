-- 为 profiles 表添加昵称字段

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'nickname'
  ) THEN
    ALTER TABLE profiles ADD COLUMN nickname TEXT;
  END IF;
END $$;

-- 更新 find_user_by_account 函数，支持昵称查找
CREATE OR REPLACE FUNCTION find_user_by_account(account_text TEXT)
RETURNS TABLE(user_id UUID, email TEXT, phone TEXT, name TEXT, role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    u.email::TEXT,
    COALESCE(p.phone, u.phone)::TEXT as phone,
    COALESCE(p.nickname, p.name)::TEXT as name,  -- 优先显示昵称
    p.role::TEXT
  FROM profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE u.email = account_text
     OR p.phone = account_text
     OR u.phone = account_text
     OR p.name = account_text
     OR p.nickname = account_text
     OR p.name ILIKE '%' || account_text || '%'
     OR p.nickname ILIKE '%' || account_text || '%'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
