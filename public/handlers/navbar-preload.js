// This script runs immediately to handle navbar authentication state before page renders
(function() {
    // التحقق من حالة تسجيل الدخول قبل رسم الصفحة
    const isLoggedIn = !!localStorage.getItem('token');
    
    // إضافة style مؤقت لإخفاء أزرار المصادقة حتى يكتمل تحميل الصفحة
    if (isLoggedIn) {
        const style = document.createElement('style');
        style.id = 'nav-auth-styles';
        style.innerHTML = `
            #authBtns { display: none !important; }
            #userBtns { display: flex !important; }
        `;
        document.head.appendChild(style);
    }
})();
