document.addEventListener('DOMContentLoaded', function () {
    // التحقق من حالة تسجيل الدخول
    const isLoggedIn = !!localStorage.getItem('token');
    const authBtns = document.getElementById('authBtns');
    const userBtns = document.getElementById('userBtns');

    if (isLoggedIn) {
        authBtns.classList.add('d-none');
        userBtns.classList.remove('d-none');
    } else {
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

    // Handle registration form submission
    const registerForm = document.getElementById('registerForm');
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value.trim();
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;
        const grade = document.getElementById('grade').value;
        
        try {
            
            
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password, grade })
            });
            const data = await response.json();
            
            if (response.ok) {
                console.log('Registro exitoso, intentando iniciar sesión...');
                // لا تعرض إشعار هنا، انتقل مباشرة للوحة التحكم مع تمرير باراميتر
                const loginResponse = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const loginData = await loginResponse.json();
                
                if (loginResponse.ok) {
                    console.log('Inicio de sesión post-registro exitoso');
                    localStorage.setItem('token', loginData.token);
                    
                    // تخزين التوكن في cookie لإرساله مع الطلبات اللاحقة
                    document.cookie = `token=${loginData.token}; path=/; max-age=86400; SameSite=Strict`;
                    NotificationManager.show('جاري إنشاء الحساب...', 'info');
                    window.location.href = 'dashboard?registered=1';
                } else {
                    console.error('Error en inicio de sesión post-registro:', loginData.message);
                    NotificationManager.show(loginData.message || 'فشل تسجيل الدخول بعد إنشاء الحساب', 'error');
                }
            } else {
                console.error('Error en registro:', data.message);
                NotificationManager.show(data.message || 'فشل إنشاء الحساب', 'error');
            }
        } catch (err) {
            console.error('Error during registration:', err);
            NotificationManager.show('حدث خطأ أثناء إنشاء الحساب. حاول مرة أخرى.', 'error');
        }
    });
    
    // Toggle password visibility for register page
    const toggleReg = document.getElementById('toggleRegisterPassword');
    if (toggleReg) {
        toggleReg.addEventListener('click', function () {
            const passwordField = document.getElementById('password');
            const newType = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordField.setAttribute('type', newType);
            this.firstElementChild.classList.toggle('fa-eye');
            this.firstElementChild.classList.toggle('fa-eye-slash');
        });
    }
});
