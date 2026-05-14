# 用户登录 + 管理员后台方案

## Context

为 EvoDAO 增加完整的身份认证门控与管理后台：
- 整个应用必须登录后才能使用（含 Agent 执行功能）
- 邮箱 + 密码注册 / 登录
- `profiles.is_admin = true` 的用户可访问 `/admin` 后台
- 后台展示用户列表 + `agent_memory` 长期记忆记录管理

---

## Step 1 — 数据库 Migration

**新建 `profiles` 表 + 自动触发器 + RLS**

```sql
-- profiles 表
CREATE TABLE profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text,
  is_admin   boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 用户只能读写自己的 profile；管理员可读全部
CREATE POLICY "users_own" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "admins_read_all" ON profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true));

-- auth.users 新用户自动创建 profile
CREATE OR REPLACE FUNCTION create_profile_on_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles(id, email) VALUES (NEW.id, NEW.email) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW
  EXECUTE FUNCTION create_profile_on_signup();
```

同时更新 `agent_memory` RLS，让管理员可读写全部记录（目前 public_all 已满足，无需修改）。

---

## Step 2 — Enable auto-confirm email

调用 `supabase_configure_auth` 开启自动确认邮件（开发期间跳过邮件验证）。

---

## Step 3 — `src/hooks/useAuth.ts` （新建）

暴露：`user`, `session`, `profile`, `isAdmin`, `isLoading`, `signIn`, `signUp`, `signOut`

```typescript
export function useAuth() {
  // 1. useState: user, session, profile, isLoading
  // 2. useEffect: supabase.auth.onAuthStateChange → 更新 user/session
  //    → 触发 fetchProfile(user.id)
  // 3. fetchProfile: SELECT * FROM profiles WHERE id = user.id (maybeSingle)
  // 4. signIn: supabase.auth.signInWithPassword
  // 5. signUp: supabase.auth.signUp({ emailRedirectTo: origin })
  // 6. signOut: supabase.auth.signOut
  return { user, session, profile, isAdmin, isLoading, signIn, signUp, signOut }
}
```

---

## Step 4 — `src/context/AuthContext.tsx` （新建）

```tsx
const AuthContext = createContext<ReturnType<typeof useAuth> | null>(null);
export function AuthProvider({ children }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}
export function useAuthContext() {
  return useContext(AuthContext)!;
}
```

在 `src/App.tsx` 中用 `<AuthProvider>` 包裹所有内容。

---

## Step 5 — `src/pages/Auth.tsx` （新建）

终端风格的登录/注册页，含两个 tab：

- **LOGIN 标签**：email + password 输入框 → `signIn` → 跳转 `/`
- **REGISTER 标签**：email + password + confirm password → `signUp` → 成功提示
- 错误信息显示（邮箱已存在、密码错误等）
- 加载状态按钮禁用

路由：`/auth`，未登录时跳转到此页。

---

## Step 6 — 路由守卫组件（新建）

**`src/components/auth/ProtectedRoute.tsx`**
```tsx
// isLoading → 显示全屏 spinner
// !user → <Navigate to="/auth" replace />
// else → <Outlet />
```

**`src/components/auth/AdminRoute.tsx`**
```tsx
// isLoading → spinner
// !isAdmin → <Navigate to="/" replace />
// else → <Outlet />
```

---

## Step 7 — `src/router.tsx` 更新

```tsx
import { Auth } from "./pages/Auth";
import { Admin } from "./pages/Admin";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AdminRoute } from "./components/auth/AdminRoute";

export const routers = [
  { path: "/auth", element: <Auth /> },
  {
    element: <ProtectedRoute />,   // 守卫 wrapper
    children: [
      { path: "/", element: <Index /> },
      {
        element: <AdminRoute />,   // 管理员守卫 wrapper
        children: [
          { path: "/admin", element: <Admin /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFound /> },
];
```

---

## Step 8 — `src/pages/Admin.tsx` （新建）

**两个标签页：**

### 用户列表 (`UserTable`)
- 查询：`SELECT id, email, is_admin, created_at FROM profiles ORDER BY created_at DESC`
- 列：邮箱 / 管理员 / 注册时间 / 操作（切换 is_admin）
- 切换管理员：`UPDATE profiles SET is_admin = !is_admin WHERE id = X`

### 记忆管理 (`MemoryTable`)
- 查询：`SELECT * FROM agent_memory ORDER BY created_at DESC LIMIT 50`
- 列：目标 / 模式 / 质量分 / 轮次 / 时间 / 删除
- 删除：`DELETE FROM agent_memory WHERE id = X`

---

## Step 9 — `src/components/agent/AgentHeader.tsx` 更新

右上角添加用户区域：
- 显示登录用户邮箱缩写头像 + dropdown
- dropdown 菜单：`管理后台`（仅 isAdmin 显示）+ `退出登录`
- 使用 `useAuthContext()` 获取 user 和 signOut

---

## Step 10 — i18n 补充

在 `zh.json` 和 `en.json` 中新增：
```json
"auth": {
  "login": "登录", "register": "注册",
  "email": "邮箱", "password": "密码", "confirmPassword": "确认密码",
  "loginBtn": "登录", "registerBtn": "注册",
  "loginTitle": "欢迎回来", "registerTitle": "创建账号",
  "loginError": "邮箱或密码错误",
  "registerSuccess": "注册成功，请登录",
  "logout": "退出登录",
  "passwordMismatch": "两次密码不一致"
},
"admin": {
  "title": "管理后台",
  "users": "用户管理", "memories": "记忆管理",
  "email": "邮箱", "isAdmin": "管理员", "createdAt": "注册时间",
  "toggleAdmin": "切换权限",
  "goal": "目标", "mode": "模式", "score": "质量分",
  "round": "轮次", "delete": "删除",
  "noUsers": "暂无用户", "noMemories": "暂无记忆记录"
}
```

---

## 关键文件清单

| 操作 | 路径 |
|------|------|
| 新建 | `src/hooks/useAuth.ts` |
| 新建 | `src/context/AuthContext.tsx` |
| 新建 | `src/pages/Auth.tsx` |
| 新建 | `src/pages/Admin.tsx` |
| 新建 | `src/components/auth/ProtectedRoute.tsx` |
| 新建 | `src/components/auth/AdminRoute.tsx` |
| 更新 | `src/router.tsx` |
| 更新 | `src/App.tsx` |
| 更新 | `src/components/agent/AgentHeader.tsx` |
| 更新 | `src/i18n/locales/zh.json` |
| 更新 | `src/i18n/locales/en.json` |
| DB Migration | `profiles` 表 + 触发器 |
| Auth Config | 开启 auto-confirm email |

---

## 验证方式

1. 未登录 → 访问 `/` 自动跳转 `/auth`
2. 注册新用户 → 登录 → 正常使用 Agent 功能
3. 数据库手动设 `is_admin = true` → 刷新 → Header 显示"管理后台"入口
4. 访问 `/admin` → 能看到用户列表和记忆表格
5. 非管理员访问 `/admin` → 自动跳转回 `/`
