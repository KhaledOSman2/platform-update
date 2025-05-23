document.addEventListener('DOMContentLoaded', async function () {
    const currentPath = window.location.pathname;

    if (currentPath.endsWith('login')) {
        const urlParams = new URLSearchParams(window.location.search);
        const redirectFrom = urlParams.get('from');

        if (redirectFrom) {
            const alertContainer = document.getElementById('alertContainer');

            if (alertContainer) {
                let alertMessage = '';

                switch (redirectFrom) {
                    case 'admin':
                        alertMessage = 'غير مسموح لك بالوصول إلى هذه الصفحة';
                        break;
                    case 'dashboard':
                        alertMessage = 'برجاء تسجيل الدخول للوصول إلى لوحة التحكم';
                        break;
                    case 'course':
                        alertMessage = 'برجاء تسجيل الدخول لعرض الكورس';
                        break;
                    default:
                        alertMessage = 'برجاء تسجيل الدخول للوصول إلى هذا المحتوى';
                }

                alertContainer.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show mb-4" role="alert">
                    <strong>تنبيه!</strong> ${alertMessage}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="إغلاق"></button>
                </div>`;
            }
        }
    }

    // Skip token validation if already handled by preload script
    const isProtectedPage = currentPath.endsWith('dashboard') ||
        currentPath.endsWith('admin') ||
        currentPath.endsWith('course');

    // For pages that aren't protected or don't have preload scripts
    if (!isProtectedPage) {
        // تحميل قائمة الصفوف الدراسية في نموذج التسجيل
        if (currentPath.endsWith('register')) {
            const gradeSelect = document.getElementById('grade');
            try {
                const gradesResponse = await fetch('/api/grades');
                if (!gradesResponse.ok) {
                    const errorData = await gradesResponse.json();
                    throw new Error(errorData.message || 'فشل في جلب الصفوف الدراسية');
                }
                const grades = await gradesResponse.json();
                grades.forEach(grade => {
                    const option = document.createElement('option');
                    option.value = grade.name;
                    option.textContent = grade.name;
                    gradeSelect.appendChild(option);
                });
            } catch (err) {
                console.error('Error fetching grades:', err);
                NotificationManager.show('حدث خطأ أثناء جلب الصفوف الدراسية', 'error');
            }
        }
    }
});

AOS.init({
    duration: 1000
});

document.addEventListener('DOMContentLoaded', async function () {
    try {
        const response = await fetch('/api/all-courses');
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل في جلب الكورسات');
        }
        const courses = await response.json();
        const latestCoursesGrid = document.getElementById('latestCoursesGrid');

        if (courses.length === 0) {
            if (latestCoursesGrid) {
                latestCoursesGrid.innerHTML = `
                    <div class="col-12 d-flex justify-content-center align-items-center">
                        <div class="no-courses-card shadow-sm p-4 rounded-4 text-center w-100" style="background: linear-gradient(135deg, #f8fbff 60%, #e3f0ff 100%); border: 1.5px solid #3a84ed; max-width: 420px; margin: 0 auto;">
                            <div style="font-size: 3rem; color: #3a84ed; margin-bottom: 1rem;">
                                <i class="fas fa-book-open"></i>
                            </div>
                            <div style="font-size: 1.3rem; font-weight: bold; color: #3a84ed; margin-bottom: 0.5rem;">لا توجد كورسات متاحة حالياً</div>
                            <div style="color: #555; font-size: 1.05rem;">تابعنا باستمرار ليصلك كل جديد من الكورسات قريباً!</div>
                        </div>
                    </div>
                `;
            }
        } else {
            courses.slice(-3).reverse().forEach(course => {
                const courseCard = document.createElement('div');
                courseCard.className = 'col-lg-4 col-md-6';
                courseCard.innerHTML = `
                    <div class="course-card card rounded-4 overflow-hidden shadow">
                        <div class="position-relative overflow-hidden">
                            <img src="${course.imageURL || 'images/course-placeholder.jpg'}" 
                                 class="card-img-top" 
                                 alt="${course.title}">
                            <span class="new-badge"><i class="fas fa-star me-1"></i> جديد</span>
                        </div>
                        <div class="card-body">
                            <span class="grade-badge">${course.grade}</span>
                            <span class="course-price-badge money-badge" style="display:inline-flex; align-items:center; gap:6px; margin-right:8px; padding:5px 16px; border-radius:22px; font-size:1.05rem; font-weight:700; background:${course.price === 0 ? '#d4edda' : '#fffbe6'}; color:${course.price === 0 ? '#28a745' : '#b8860b'}; border:1.5px solid ${course.price === 0 ? '#28a745' : '#b8860b'}; box-shadow:0 2px 8px rgba(0,0,0,0.09);">
                                <i class="fas fa-money-bill-wave" style="color:${course.price === 0 ? '#28a745' : '#b8860b'};"></i>
                                ${course.price === 0 ? 'مجاني' : course.price + ' جنيه'}
                            </span>
                            <h5 class="card-title fw-bold">${course.title}</h5>
                            <div class="course-meta">
                               <span class="lectures-count" style="box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border: 1px solid rgba(0, 0, 0, 0.1); border-radius: 20px;">
                                    <i class="fas fa-play-circle me-2"></i>
                                    ${course.videosCount !== undefined ? course.videosCount : 0} محاضرات
                                </span>
                                <button class="watch-cta-button" 
                                        onclick="window.location.href='course?id=${course.id}'">
                                    مشاهدة الكورس
                                </button>
                            </div>
                        </div>
                    </div>
                `;
                latestCoursesGrid.appendChild(courseCard);
            });
        }
    } catch (error) {
        console.error('حدث خطأ أثناء جلب الكورسات:', error);
        NotificationManager.show('حدث خطأ أثناء جلب الكورسات', 'error');
    }
});

// يجب تضمين notification-manager.js في الصفحة قبل هذا الملف
document.addEventListener('DOMContentLoaded', function () {
    try {
        // التحقق من حالة تسجيل الدخول
        const isLoggedIn = !!localStorage.getItem('token');
        const authBtns = document.getElementById('authBtns');
        const userBtns = document.getElementById('userBtns');

        if (!authBtns || !userBtns) throw new Error('أزرار المصادقة أو المستخدم غير موجودة');

        if (isLoggedIn) {
            authBtns.classList.add('d-none');
            userBtns.classList.remove('d-none');
        } else {
            authBtns.classList.remove('d-none');
            userBtns.classList.add('d-none');
        }

        // معالجة سلوك شريط التنقل على الشاشات المختلفة
        const navbarCollapse = document.getElementById('navbarNav');
        if (!navbarCollapse) throw new Error('عنصر شريط التنقل غير موجود');

        function adjustNavbar() {
            try {
                if (window.innerWidth < 992) {
                    navbarCollapse.classList.remove('show');
                } else {
                    navbarCollapse.classList.add('desktop-nav');
                }
            } catch (error) {
                console.error('Error adjusting navbar:', error.message);
            }
        }

        adjustNavbar();
        window.addEventListener('resize', adjustNavbar);

        // تم نقل منطق تسجيل الخروج إلى ملف logout-handler.js
        // الملف الجديد يعالج تلقائياً جميع أزرار تسجيل الخروج في الصفحة
    } catch (error) {
        console.error('Error initializing authentication:', error.message);
        if (typeof NotificationManager !== 'undefined') {
            NotificationManager.show('حدث خطأ أثناء تهيئة المصادقة', 'error');
        }
    }
});