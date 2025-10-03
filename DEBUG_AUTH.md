# 🔧 Hướng dẫn Debug Authentication

## Vấn đề: "Bạn phải đăng nhập để đăng nội dung" mặc dù đã đăng nhập

### 🚀 Các bước debug:

#### 1. **Kiểm tra Debug Panel**
- Truy cập trang Upload (`/upload`)
- Trong development mode, bạn sẽ thấy "Auth Debug Panel"
- Nhấn nút "Debug" để xem thông tin chi tiết
- Kiểm tra các trạng thái:
  - Loading: Phải là "Hoàn thành"
  - User: Phải là "Đã đăng nhập"
  - Role: Phải có giá trị (user hoặc admin)

#### 2. **Kiểm tra Console**
- Mở Developer Tools (F12)
- Vào tab Console
- Nhấn nút "Debug" trong panel
- Xem thông tin debug được in ra

#### 3. **Các nguyên nhân có thể:**

##### A. **Session hết hạn**
- **Triệu chứng**: User = null, Session = null
- **Giải pháp**: Nhấn "Refresh Session" hoặc đăng nhập lại

##### B. **Token bị mất**
- **Triệu chứng**: hasAuthToken = false
- **Giải pháp**: Đăng nhập lại

##### C. **Race condition**
- **Triệu chứng**: Loading = true mãi
- **Giải pháp**: Refresh trang hoặc đợi

##### D. **Lỗi network**
- **Triệu chứng**: Session Error hoặc User Error
- **Giải pháp**: Kiểm tra kết nối internet

#### 4. **Các lệnh debug thủ công:**

```javascript
// Trong console browser
// Kiểm tra session
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);

// Kiểm tra user
const { data: { user } } = await supabase.auth.getUser();
console.log('User:', user);

// Refresh session
const { data, error } = await supabase.auth.refreshSession();
console.log('Refresh result:', data, error);

// Kiểm tra localStorage
console.log('Auth token:', localStorage.getItem('sb-your-project-id-auth-token'));
```

#### 5. **Giải pháp nhanh:**

1. **Refresh session**: Nhấn nút "Refresh Session"
2. **Đăng nhập lại**: Nhấn "Đăng nhập ngay"
3. **Clear cache**: Xóa localStorage và đăng nhập lại
4. **Restart app**: Restart development server

#### 6. **Kiểm tra database:**

```sql
-- Kiểm tra user có tồn tại không
SELECT id, email, created_at, last_sign_in_at 
FROM auth.users 
WHERE email = 'your-email@example.com';

-- Kiểm tra user role
SELECT ur.role, p.full_name 
FROM user_roles ur
JOIN auth.users u ON ur.user_id = u.id
LEFT JOIN profiles p ON u.id = p.id
WHERE u.email = 'your-email@example.com';
```

### 🎯 Kết quả mong đợi:

Sau khi debug thành công, bạn sẽ thấy:
- ✅ Loading: "Hoàn thành"
- ✅ User: "Đã đăng nhập"
- ✅ Role: "user" hoặc "admin"
- ✅ Session: "Có"
- ✅ Auth Token: "Có"

### 📞 Nếu vẫn không được:

1. Kiểm tra console để xem lỗi cụ thể
2. Thử đăng nhập lại hoàn toàn
3. Kiểm tra kết nối internet
4. Restart development server
5. Clear browser cache và cookies
