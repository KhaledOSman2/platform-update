document.addEventListener('DOMContentLoaded', function () {
    console.log('login.js: DOM loaded, initializing...');
    
    // التحقق من حالة تسجيل الدخول
    const isLoggedIn = !!localStorage.getItem('token');
    const authBtns = document.getElementById('authBtns');
    const userBtns = document.getElementById('userBtns');

    if (isLoggedIn) {
        console.log('login.js: Token found, user already logged in');
        authBtns.classList.add('d-none');
        userBtns.classList.remove('d-none');
    } else {
        console.log('login.js: No token found, showing authentication buttons');
        authBtns.classList.remove('d-none');
        userBtns.classList.add('d-none');
    }

    // معالجة سلوك شريط التنقل على الشاشات المختلفة
    const navbarCollapse = document.getElementById('navbarNav');

    function adjustNavbar() {
        if (window.innerWidth < 992) {
            // للشاشات الصغيرة - إزالة الظهور التلقائي وتغيير الأنماط
            navbarCollapse.classList.remove('show');
        } else {
            // للشاشات الكبيرة - إضافة class للتأكد من العرض الصحيح
            navbarCollapse.classList.add('desktop-nav');
        }
    }

    // تنفيذ عند تحميل الصفحة
    adjustNavbar();

    // تنفيذ عند تغيير حجم الشاشة
    window.addEventListener('resize', adjustNavbar);

    // عرض إشعار تسجيل الخروج إذا كان هناك باراميتر logout=1
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('logout') === '1') {
        console.log('login.js: Detected logout=1 parameter, showing notification');
        NotificationManager.show('تم تسجيل الخروج بنجاح', 'success');
    }
    // عرض اشعار عند انتهاء صلاحية الجلسة
    if (urlParams.get('logout') === '2') {
        console.log('login.js: Detected logout=2 parameter, showing session expired notification');
        NotificationManager.show('انتهت صلاحية الجلسة يرجى تسجيل الدخول مرة أخرى', 'warning');
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        console.log('login.js: Login form found, adding event listener');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('login.js: Form submitted, processing data...');
            
            try {
                const email = document.getElementById('email').value.trim();
                const password = document.getElementById('password').value.trim();
                
                console.log('login.js: Trying to log in with:', email);
                
                // Mostrar indicador de carga si existe
                

                console.log('login.js: Sending request to /api/login');
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                console.log('login.js: Server response:', data);
                
                if (response.ok) {
                    console.log('login.js: Login successful, storing token');
                    // تخزين التوكن في localStorage
                    localStorage.setItem('token', data.token);
                    
                    // تخزين التوكن في cookie لإرساله مع الطلبات اللاحقة
                    document.cookie = `token=${data.token}; path=/; max-age=86400; SameSite=Strict`;
                    NotificationManager.show('جاري تسجيل الدخول...', 'info');

                    console.log('login.js: Login successful, redirecting...');
                    
                    if (data.user && data.user.isAdmin) {
                        console.log('login.js: User is admin, redirecting to /admin');
                        // وضع علامات الترحيب للمشرف
                        localStorage.setItem('adminJustLoggedIn', 'true');
                        localStorage.setItem('subsJustLoggedIn', 'true');
                        window.location.href = 'admin';
                    } else {
                        console.log('login.js: Regular user, redirecting to /dashboard');
                        // وضع علامة الترحيب للمستخدم العادي
                        localStorage.setItem('justLoggedIn', 'true');
                        window.location.href = 'dashboard';
                    }
                } else {
                    console.error('login.js: Error logging in:', data.message);
                    NotificationManager.show(data.message || 'فشل تسجيل الدخول', 'error');
                }
            } catch (err) {
                console.error('login.js: Error during login:', err);
                NotificationManager.show('حدث خطأ أثناء تسجيل الدخول. حاول مرة أخرى.', 'error');
            }
        });
    } else {
        console.warn('login.js: Login form not found');
    }

    // تبديل ظهور كلمة المرور
    const togglePassword = document.getElementById('togglePassword');
    if (togglePassword) {
        togglePassword.addEventListener('click', function () {
            const passwordField = document.getElementById('password');
            const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordField.setAttribute('type', type);
            this.firstElementChild.classList.toggle('fa-eye');
            this.firstElementChild.classList.toggle('fa-eye-slash');
        });
    }
});
