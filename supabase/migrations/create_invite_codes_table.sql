-- 创建邀请码表
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('teacher', 'admin')),
  created_by UUID REFERENCES profiles(user_id),
  used_by UUID REFERENCES profiles(user_id),
  used_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_role ON invite_codes(role);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires_at ON invite_codes(expires_at);

-- 启用 RLS
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- RLS 策略：所有人可以查看未使用的邀请码（用于验证）
CREATE POLICY "invite_codes read unused" ON invite_codes
  FOR SELECT USING (used_by IS NULL AND expires_at > NOW());

-- RLS 策略：管理员和教师可以查看所有邀请码
CREATE POLICY "invite_codes read admin/teacher" ON invite_codes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (SELECT auth.uid())
      AND profiles.role IN ('admin', 'teacher')
    )
  );

-- RLS 策略：管理员可以创建邀请码
CREATE POLICY "invite_codes insert admin" ON invite_codes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- RLS 策略：管理员可以更新邀请码（标记为已使用）
CREATE POLICY "invite_codes update admin" ON invite_codes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = (SELECT auth.uid())
      AND profiles.role = 'admin'
    )
  );

-- 函数：生成随机邀请码
CREATE OR REPLACE FUNCTION generate_invite_code(length INTEGER DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- 排除容易混淆的字符
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..length LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 函数：验证邀请码
CREATE OR REPLACE FUNCTION verify_invite_code(code_text TEXT, role_text TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  code_record RECORD;
BEGIN
  SELECT * INTO code_record
  FROM invite_codes
  WHERE invite_codes.code = code_text
    AND invite_codes.role = role_text
    AND invite_codes.used_by IS NULL
    AND invite_codes.expires_at > NOW();
  
  RETURN code_record.id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- 函数：使用邀请码
CREATE OR REPLACE FUNCTION use_invite_code(code_text TEXT, user_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  code_record RECORD;
BEGIN
  -- 查找可用的邀请码
  SELECT * INTO code_record
  FROM invite_codes
  WHERE invite_codes.code = code_text
    AND invite_codes.used_by IS NULL
    AND invite_codes.expires_at > NOW()
  FOR UPDATE;
  
  -- 如果找到，标记为已使用
  IF code_record.id IS NOT NULL THEN
    UPDATE invite_codes
    SET used_by = user_id_param,
        used_at = NOW()
    WHERE invite_codes.id = code_record.id;
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 函数：通过邮箱查找学生（用于家长绑定）
-- 注意：这个函数需要 SECURITY DEFINER 权限来访问 auth.users
CREATE OR REPLACE FUNCTION find_student_by_email(email_text TEXT)
RETURNS TABLE(user_id UUID, name TEXT, role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.user_id,
    p.name,
    p.role::TEXT
  FROM profiles p
  INNER JOIN auth.users u ON u.id = p.user_id
  WHERE u.email = email_text
    AND p.role = 'student'
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
