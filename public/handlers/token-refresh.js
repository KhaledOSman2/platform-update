(function() {
    const REFRESH_THRESHOLD_MINUTES = 3;
    
    const TOKEN_CHECK_INTERVAL = 5 * 60 * 1000;

    document.addEventListener('DOMContentLoaded', function() {
        console.log('token-refresh.js: تم تحميل نظام تجديد التوكن');
        
        checkTokenExpiration();
        
        setInterval(checkTokenExpiration, TOKEN_CHECK_INTERVAL);
    });

    async function checkTokenExpiration() {
        const token = localStorage.getItem('token');
        if (!token) {
            return;
        }

        try {
            const payload = parseJwt(token);
            
            const expirationTime = new Date(payload.exp * 1000);
            const currentTime = new Date();
            
            const minutesRemaining = (expirationTime - currentTime) / (1000 * 60);
            
            console.log(`token-refresh.js: الوقت المتبقي للتوكن: ${minutesRemaining.toFixed(2)} دقيقة`);
            
            if (minutesRemaining < REFRESH_THRESHOLD_MINUTES) {
                await refreshToken();
            }
        } catch (error) {
            console.error('token-refresh.js: خطأ أثناء التحقق من وقت انتهاء التوكن:', error);
        }
    }


    async function refreshToken() {
        try {
            console.log('token-refresh.js: جاري تجديد التوكن...');
            
            const token = localStorage.getItem('token');
            const response = await fetch('/api/refresh-token', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('token-refresh.js: فشل تجديد التوكن:', errorData.message);
                return;
            }
            
            const data = await response.json();
            
            localStorage.setItem('token', data.token);
            
            document.cookie = `token=${data.token}; path=/; max-age=21600; SameSite=Strict`;
            
            console.log('token-refresh.js: تم تجديد التوكن بنجاح');
            
            const refreshEvent = new CustomEvent('tokenRefreshed', { 
                detail: { token: data.token } 
            });
            document.dispatchEvent(refreshEvent);
            
        } catch (error) {
            console.error('token-refresh.js: خطأ أثناء محاولة تجديد التوكن:', error);
        }
    }

    
    function parseJwt(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            
            return JSON.parse(jsonPayload);
        } catch (error) {
            console.error('token-refresh.js: خطأ في تحليل التوكن:', error);
            return {};
        }
    }

    window.tokenRefresh = {
        forceRefresh: refreshToken,
        checkExpiration: checkTokenExpiration
    };
})();
