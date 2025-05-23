document.addEventListener('DOMContentLoaded', function() {
    // البحث عن جميع أزرار تسجيل الخروج في الصفحة
    const logoutButtons = document.querySelectorAll('.logout-btn, #logoutBtn, #headerLogoutLink, [data-logout="true"]');
    
    // إضافة مستمع الحدث لكل زر
    logoutButtons.forEach(button => {
        if (button) {
            button.addEventListener('click', performLogout);
        }
    });
    
    // وظيفة تسجيل الخروج الموحدة
    function performLogout(e) {
        // منع السلوك الافتراضي للزر (إن وجد)
        if (e) e.preventDefault();
        
        try {
            console.log('بدء عملية تسجيل الخروج...');
            
            // مسح التوكن من جميع أنواع التخزين للتأكد من تسجيل الخروج التام
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('notifications');
            localStorage.removeItem('userGrade');
            localStorage.removeItem('adminJustLoggedIn');
            localStorage.removeItem('subsJustLoggedIn');
            
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
            sessionStorage.removeItem('notifications');
            sessionStorage.removeItem('userGrade');
            
            document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            
            fetch('/api/logout', {
                method: 'POST',
                credentials: 'include'
            })
            .then(() => {
                console.log('تم تسجيل الخروج بنجاح من API');
                
                // تأخير بسيط قبل التوجيه لضمان مسح البيانات ومعالجة الطلبات
                setTimeout(function() {
                    window.location.href = '/logout';
                }, 100);
            })
            .catch(error => {
                console.error('فشل في تسجيل الخروج من API:', error);
                
                // في حالة الفشل، استمر بالتوجيه لصفحة تسجيل الخروج
                window.location.href = '/logout';
            });
        } catch (error) {
            console.error('حدث خطأ أثناء تسجيل الخروج:', error.message);
            
            // محاولة استخدام مدير الإشعارات إذا كان متاحًا
            if (typeof NotificationManager !== 'undefined') {
                NotificationManager.show('حدث خطأ أثناء تسجيل الخروج', 'error');
            }
            
            // في جميع الحالات، حاول توجيه المستخدم إلى صفحة تسجيل الخروج
            window.location.href = '/logout';
        }
    }
    
    // تصدير وظيفة تسجيل الخروج للاستخدام المباشر إن لزم الأمر
    window.performLogout = performLogout;
}); 