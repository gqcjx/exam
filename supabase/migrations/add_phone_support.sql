-- 添加手机号支持
-- 注意：Supabase 的 auth.users 表已经有 phone 字段，这里我们添加一个触发器来同步手机号到 profiles 表

-- 如果 profiles 表没有 phone 字段，添加它
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone VARCHAR(20);
  END IF;
END $$;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);

-- 函数：同步手机号到 profiles 表
CREATE OR REPLACE FUNCTION sync_profile_phone()
RETURNS TRIGGER AS $$
BEGIN
  -- 当 auth.users 的 phone 更新时，同步到 profiles
  IF NEW.phone IS NOT NULL THEN
    UPDATE profiles
    SET phone = NEW.phone
    WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 触发器：当 auth.users 的 phone 更新时，同步到 profiles
DROP TRIGGER IF EXISTS sync_profile_phone_trigger ON auth.users;
CREATE TRIGGER sync_profile_phone_trigger
  AFTER UPDATE OF phone ON auth.users
  FOR EACH ROW
  WHEN (OLD.phone IS DISTINCT FROM NEW.phone)
  EXECUTE FUNCTION sync_profile_phone();

-- 函数：通过手机号查找用户（用于登录和找回密码）
CREATE OR REPLACE FUNCTION find_user_by_phone(phone_text TEXT)
RETURNS TABLE(user_id UUID, email TEXT, name TEXT, role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    u.email::TEXT,
    p.name,
    p.role::TEXT
  FROM profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE p.phone = phone_text
     OR u.phone = phone_text
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 函数：通过手机号或邮箱查找用户（用于登录）
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
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
