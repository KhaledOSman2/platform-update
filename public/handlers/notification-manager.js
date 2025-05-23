// NotificationManager: نظام إشعارات موحد
const NotificationManager = (function () {
    let container = null;
    let iconsLoaded = false;
    
    // دالة للتأكد من تحميل الأيقونات
    function ensureIconsLoaded() {
        if (!iconsLoaded) {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.style.display = 'none';
            svg.id = 'bootstrap-alert-icons';
            svg.innerHTML = `
                <symbol id="check-circle-fill" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM6.97 11.03a.75.75 0 0 0 1.07 0l3.992-3.992a.75.75 0 1 0-1.06-1.06L7.5 9.439 6.03 7.97a.75.75 0 1 0-1.06 1.061l1.999 1.999z"/>
                </symbol>
                <symbol id="info-fill" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm.93-9.412l-1 4.705c-.07.34.029.533.304.533.194 0 .487-.07.686-.246l-.088.416c-.287.346-.92.598-1.465.598-.703 0-1.002-.422-.808-1.319l.738-3.468c.064-.293.006-.399-.287-.47l-.451-.081.082-.381 2.29-.287zM8 5.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                </symbol>
                <symbol id="exclamation-triangle-fill" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M8.982 1.566a1.13 1.13 0 0 0-1.964 0L.165 13.233c-.457.778.091 1.767.982 1.767h13.707c.89 0 1.438-.99.982-1.767L8.982 1.566zM8 5.5a.5.5 0 0 1 .5.5v3.5a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm0 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
                </symbol>
            `;
            document.body.insertAdjacentElement('afterbegin', svg);
            iconsLoaded = true;
        }
    }
    
    function createContainer() {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.position = 'fixed';
        container.style.top = '90px';
        container.style.right = '24px';
        container.style.zIndex = '9999';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        document.body.appendChild(container);
    }
    
    function getIcon(type) {
        // التأكد من تحميل الأيقونات أولاً
        ensureIconsLoaded();
        
        const iconId = {
            'success': 'check-circle-fill',
            'error': 'exclamation-triangle-fill',
            'warning': 'exclamation-triangle-fill',
            'info': 'info-fill'
        }[type] || 'info-fill';

        return `<svg class="bi flex-shrink-0 me-2" width="24" height="24" fill="currentColor" role="img" aria-label="${type}:">
                    <use xlink:href="#${iconId}"/>
                </svg>`;
    }
    
    function show(message, type = 'success') {
        if (!container) createContainer();
        
        const alertClass = {
            'success': 'alert-success',
            'error': 'alert-danger',
            'warning': 'alert-warning',
            'info': 'alert-info'
        }[type] || 'alert-info';
        
        const icon = getIcon(type);
        const alert = document.createElement('div');
        alert.className = `alert ${alertClass} d-flex align-items-center fade show`;
        alert.style.minWidth = '320px';
        alert.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
        alert.setAttribute('role', 'alert');
        alert.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
                ${icon}
                <div style="flex:1;">${message}</div>
                <button type="button" class="btn-close ms-2" aria-label="Close"></button>
            </div>
        `;
        
        alert.querySelector('.btn-close').onclick = function () {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 200);
        };
        
        setTimeout(() => {
            if (alert.parentNode) {
                alert.classList.remove('show');
                setTimeout(() => alert.remove(), 200);
            }
        }, 5000);
        
        container.appendChild(alert);
    }
    
    // تحميل الأيقونات عند تهيئة المدير
    ensureIconsLoaded();
    
    return { show };
})();