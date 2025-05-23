
(function() {
    document.addEventListener('DOMContentLoaded', validateToken);
    
    setInterval(validateToken, 30000);

    document.addEventListener('tokenRefreshed', function(event) {
        console.log('token-validator.js: تم تلقي حدث تجديد التوكن');
    });
    
    
    async function validateToken() {
        try {
            const token = localStorage.getItem('token');
            
            if (!token) return;
            
            const response = await fetch('/api/validate-token', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                console.warn('توكن المستخدم منتهي الصلاحية أو غير صالح');
                
                const refreshSuccessful = await tryRefreshToken();
                
                if (!refreshSuccessful) {
                    console.warn('فشل تجديد التوكن، جاري تسجيل الخروج...');
                    handleExpiredToken();
                } else {
                    console.log('تم تجديد التوكن بنجاح، لا حاجة لتسجيل الخروج');
                }
            }
        } catch (error) {
            console.error('خطأ أثناء التحقق من صلاحية التوكن:', error);
        }
    }
    
    function handleExpiredToken() {
        console.log('تنفيذ عملية تسجيل الخروج نظرًا لانتهاء صلاحية التوكن...');
        
        localStorage.removeItem('token');
        localStorage.removeItem('grade');
        localStorage.removeItem('cachedUserData');
        localStorage.removeItem('cachedNotifications');
        localStorage.removeItem('user');
        localStorage.removeItem('notifications');
        localStorage.removeItem('userGrade');
        localStorage.removeItem('adminJustLoggedIn');
        localStorage.removeItem('subsJustLoggedIn');
        localStorage.removeItem('justLoggedIn');
        
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('notifications');
        sessionStorage.removeItem('userGrade');
        
        document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        
        fetch('/api/logout', {
            method: 'POST',
            credentials: 'include'
        }).finally(() => {
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login?logout=2';
            }
        });
    }
    
    async function tryRefreshToken() {
        if (window.tokenRefresh && typeof window.tokenRefresh.forceRefresh === 'function') {
            try {
                await window.tokenRefresh.forceRefresh();
                
                return !!localStorage.getItem('token');
            } catch (error) {
                console.error('فشل محاولة تجديد التوكن:', error);
                return false;
            }
        } else {
            console.warn('وظيفة تجديد التوكن غير متوفرة');
            return false;
        }
    }

    window.handleTokenError = function(status) {
        if (status === 401 || status === 403) {
            tryRefreshToken().then(refreshSuccessful => {
                if (!refreshSuccessful) {
                    handleExpiredToken();
                }
            });
            return true;
        }
        return false;
    };
})();
