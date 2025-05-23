// يجب تضمين notification-manager.js في الصفحة قبل هذا الملف
document.addEventListener('DOMContentLoaded', function () {
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('التوكن غير موجود، يرجى تسجيل الدخول');
        
        if (!document.cookie.includes('token=')) {
            document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Strict`;
        }

        const coursesSectionHeader = document.createElement('div');
        coursesSectionHeader.className = 'courses-section-header mb-4';
        coursesSectionHeader.innerHTML = `
            <div class="title-area">
                <h2 class="courses-title">الكورسات الخاصة بك <span id="coursesCounter" class="courses-count"></span></h2>
                <div class="courses-decoration"></div>
            </div>
            <div class="search-container">
                <div class="search-bar-wrapper">
                    <input type="text" id="courseSearch" class="form-control search-input" placeholder="ابحث عن كورس...">
                    <i class="fas fa-search search-icon"></i>
                </div>
            </div>
        `;

        const coursesGrid = document.getElementById('coursesGrid');
        if (!coursesGrid) throw new Error('عنصر شبكة الكورسات غير موجود');
        coursesGrid.parentNode.insertBefore(coursesSectionHeader, coursesGrid);

        const profileLink = document.getElementById('profileLink');
        if (!profileLink) throw new Error('رابط الملف الشخصي غير موجود');
        profileLink.addEventListener('click', function (e) {
            try {
                e.preventDefault();
                const modal = new bootstrap.Modal(document.getElementById('profileModal'));
                if (!modal) throw new Error('نافذة الملف الشخصي غير موجودة');
                modal.show();
            } catch (error) {
                console.error('Error opening profile modal:', error.message);
                NotificationManager.show('حدث خطأ أثناء تحميل بيانات الملف الشخصي', 'error');
            }
        });

        let currentUserId = null;
        fetch('/api/dashboard', { headers: { 'Authorization': 'Bearer ' + token } })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(data => {
                        throw new Error(data.message || 'فشل في جلب بيانات الملف الشخصي');
                    });
                }
                return response.json();
            })
            .then(data => {
                const user = data.user;
                if (!user) throw new Error('بيانات المستخدم غير موجودة');
                currentUserId = user.id;
                const usernameEl = document.getElementById('username');
                const emailEl = document.getElementById('email');
                const passwordEl = document.getElementById('password');
                if (!usernameEl || !emailEl || !passwordEl) throw new Error('عناصر نموذج الملف الشخصي غير موجودة');
                usernameEl.value = user.username || '';
                emailEl.value = user.email || '';
                passwordEl.value = user.password || '';

                // تخزين بيانات المستخدم
                setCachedUserData(user, token);

                fetch('/api/grades')
                    .then(response => {
                        if (!response.ok) {
                            return response.json().then(data => {
                                throw new Error(data.message || 'فشل في جلب الصفوف الدراسية');
                            });
                        }
                        return response.json();
                    })
                    .then(grades => {
                        const gradeSelect = document.getElementById('grade');
                        if (!gradeSelect) throw new Error('عنصر اختيار الصف غير موجود');
                        gradeSelect.innerHTML = '';
                        grades.forEach(g => {
                            const option = document.createElement('option');
                            option.value = g.name;
                            option.textContent = g.name;
                            if (g.name === user.grade) option.selected = true;
                            gradeSelect.appendChild(option);
                        });
                    })
                    .catch(error => {
                        console.error('Error fetching grades:', error.message);
                    });
            })
            .catch(error => {
                console.error('Error fetching profile:', error.message);
                NotificationManager.show('حدث خطأ أثناء جلب بيانات الملف الشخصي', 'error');
            });

        const notificationsButton = document.getElementById('notificationsButton');
        if (!notificationsButton) throw new Error('زر الإشعارات غير موجود');
        notificationsButton.addEventListener('click', function (e) {
            try {
                e.preventDefault();
                const dropdown = this.nextElementSibling;
                if (!dropdown) throw new Error('قائمة الإشعارات غير موجودة');
                if (dropdown.style.display === 'block') {
                    dropdown.style.display = 'none';
                } else {
                    dropdown.style.display = 'block';
                    loadNotifications();
                }
            } catch (error) {
                console.error('Error toggling notifications dropdown:', error.message);
            }
        });

        fetchCourses();

        const courseSearch = document.getElementById('courseSearch');
        if (!courseSearch) throw new Error('حقل البحث عن الكورسات غير موجود');
        courseSearch.addEventListener('input', function (e) {
            try {
                const searchTerm = e.target.value.toLowerCase();
                filterCourses(searchTerm);
            } catch (error) {
                console.error('Error filtering courses:', error.message);
                NotificationManager.show('حدث خطأ أثناء تصفية الكورسات', 'error');
            }
        });

        const profileForm = document.getElementById('profileForm');
        if (!profileForm) throw new Error('نموذج الملف الشخصي غير موجود');
        profileForm.addEventListener('submit', async function (e) {
            try {
                e.preventDefault();
                const originalEmail = document.getElementById('email').value.trim();
                const originalGrade = document.getElementById('grade').value.trim();

                const updatedData = {
                    username: document.getElementById('username').value.trim(),
                    email: originalEmail,
                    password: document.getElementById('password').value.trim(),
                    grade: originalGrade
                };

                const response = await fetch(`/api/users/${currentUserId}`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(updatedData)
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.message || 'فشل في تحديث بيانات الملف الشخصي');
                }
                const result = await response.json();
                NotificationManager.show(result.message, 'success');

                // تحديث بيانات المستخدم المخزنة
                setCachedUserData({
                    id: currentUserId,
                    username: updatedData.username,
                    email: updatedData.email,
                    grade: updatedData.grade,
                    isAdmin: result.user?.isAdmin || false,
                    isBanned: result.user?.isBanned || false
                }, token);

                if (result.logout) {
                    // مسح التوكن من localStorage
                    localStorage.removeItem('token');
                    localStorage.removeItem('grade');
                    localStorage.removeItem('cachedUserData');
                    
                    // مسح التوكن من جميع أنواع الـ cookies بما في ذلك HttpOnly
                    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                    
                    // طلب تسجيل الخروج كامل من الخادم لمسح HttpOnly cookies
                    fetch('/api/logout', {
                        method: 'POST',
                        credentials: 'include'
                    }).finally(() => {
                        // الانتقال إلى صفحة تسجيل الدخول بعد مسح جميع التوكنات
                        window.location.href = 'login?logout=1';
                    });
                }
                document.getElementById('password').value = '';
            } catch (error) {
                console.error('Error updating profile:', error.message);
                NotificationManager.show('حدث خطأ أثناء تحديث بيانات الملف الشخصي', 'error');
            }
        });

        const notificationDropdown = notificationsButton.closest('.notification-dropdown');
        if (!notificationDropdown) throw new Error('حاوية قائمة الإشعارات غير موجودة');

        notificationsButton.addEventListener('click', function () {
            try {
                if (window.innerWidth <= 767) {
                    document.body.classList.toggle('notification-open');
                    notificationDropdown.classList.toggle('show');
                }
            } catch (error) {
                console.error('Error toggling mobile notifications:', error.message);
            }
        });

        document.addEventListener('click', function (event) {
            try {
                if (window.innerWidth <= 767 &&
                    !notificationDropdown.contains(event.target) &&
                    document.body.classList.contains('notification-open')) {
                    document.body.classList.remove('notification-open');
                    notificationDropdown.classList.remove('show');
                }
            } catch (error) {
                console.error('Error closing mobile notifications:', error.message);
            }
        });

        const isLoggedIn = !!token;
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

        const logoutBtn = document.getElementById('logoutBtn');
        if (!logoutBtn) throw new Error('زر تسجيل الخروج غير موجود');
        logoutBtn.addEventListener('click', function () {
            try {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                localStorage.removeItem('cachedUserData');
                sessionStorage.removeItem('token');
                sessionStorage.removeItem('user');
                
                // حذف كوكي التوكن
                document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
                
                window.location.href = 'login?logout=1';
            } catch (error) {
                console.error('Error logging out:', error.message);
                NotificationManager.show('حدث خطأ أثناء تسجيل الخروج', 'error');
            }
        });

        fetchNotificationsCount();
    } catch (error) {
        console.error('Error initializing dashboard:', error.message);
        NotificationManager.show('حدث خطأ أثناء تهيئة لوحة التحكم', 'error');
        window.location.href = 'login?logout=1';
    }
});

async function fetchCourses() {
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('التوكن غير موجود، يرجى تسجيل الدخول');

        const response = await fetch('/api/courses', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('token');
            localStorage.removeItem('grade');
            localStorage.removeItem('cachedUserData');
            window.location.href = 'login';
            throw new Error('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى');
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل في جلب الكورسات');
        }

        const courses = await response.json();
        displayCourses(courses);
    } catch (error) {
        console.error('Error fetching courses:', error.message);
        NotificationManager.show(error.message || 'حدث خطأ أثناء جلب الكورسات', 'error');
    }
}

function displayCourses(courses) {
    try {
        const coursesGrid = document.getElementById('coursesGrid');
        const noCoursesMessage = document.getElementById('noCoursesMessage');
        if (!coursesGrid || !noCoursesMessage) throw new Error('عناصر عرض الكورسات غير موجودة');
        coursesGrid.innerHTML = '';

        const coursesCounter = document.getElementById('coursesCounter');
        if (!coursesCounter) throw new Error('عنصر عداد الكورسات غير موجود');

        if (courses.length > 0) {
            coursesCounter.innerHTML = `<i class="fas fa-book-open"></i>${courses.length} كورس`;
            coursesCounter.style.display = 'inline-flex';
            coursesCounter.classList.add('updated');
            setTimeout(() => {
                coursesCounter.classList.remove('updated');
            }, 600);
        } else {
            coursesCounter.style.display = 'none';
        }

        if (courses.length === 0) {
            noCoursesMessage.style.display = 'block';
            noCoursesMessage.innerHTML = '<i class="fas fa-folder-open"></i><p>لا توجد كورسات متاحة لك حالياً</p>';
        } else {
            noCoursesMessage.style.display = 'none';
            courses = courses.reverse();
            coursesGrid.classList.add('row');

            courses.forEach((course, index) => {
                const badge = (index === 0)
                    ? `<span class="new-badge"><i class="fas fa-star me-1"></i> جديد</span>`
                    : '';

                const courseCard = document.createElement('div');
                courseCard.className = 'col-lg-4 col-md-6 mb-4';
                courseCard.innerHTML = `
                    <div class="course-card card rounded-4 overflow-hidden shadow">
                        <div class="position-relative overflow-hidden">
                            <img src="${course.imageURL || 'images/course-placeholder.jpg'}" 
                                class="card-img-top" 
                                alt="${course.title || 'بدون عنوان'}">
                            ${badge}
                        </div>
                        <div class="card-body">
                            <span class="grade-badge"><i class="fas fa-graduation-cap"></i>${course.grade || 'غير محدد'}</span>
                            <h5 class="card-title fw-bold">${course.title || 'بدون عنوان'}</h5>
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
                coursesGrid.appendChild(courseCard);
            });
        }
    } catch (error) {
        console.error('Error displaying courses:', error.message);
        NotificationManager.show('حدث خطأ أثناء عرض الكورسات', 'error');
    }
}

function filterCourses(searchTerm) {
    try {
        const coursesGrid = document.getElementById('coursesGrid');
        const courseCards = Array.from(document.querySelectorAll('.col-lg-4.col-md-6.mb-4'));
        const noCoursesMessage = document.getElementById('noCoursesMessage');
        if (!coursesGrid || !noCoursesMessage) throw new Error('عناصر تصفية الكورسات غير موجودة');

        const matchingCourses = [];
        const nonMatchingCourses = [];

        courseCards.forEach(courseWrapper => {
            const titleEl = courseWrapper.querySelector('.card-title');
            if (!titleEl) throw new Error('عنوان الكورس غير موجود');
            const title = titleEl.textContent.toLowerCase();

            if (title.includes(searchTerm)) {
                matchingCourses.push(courseWrapper);
                courseWrapper.style.display = 'block';
            } else {
                nonMatchingCourses.push(courseWrapper);
                courseWrapper.style.display = 'none';
            }
        });

        if (matchingCourses.length === 0 && searchTerm !== '') {
            noCoursesMessage.style.display = 'block';
            noCoursesMessage.innerHTML = `<div class="text-center">
                        <i class="fas fa-exclamation-circle fa-2x mb-3" style="color: #ef4444;"></i>
                        <p>لا توجد نتائج للبحث.</p>
                    </div>`;
        } else {
            noCoursesMessage.style.display = 'none';
        }

        if (searchTerm === '') {
            fetchCourses();
            return;
        }

        coursesGrid.innerHTML = '';
        matchingCourses.forEach(course => {
            coursesGrid.appendChild(course);
        });
        nonMatchingCourses.forEach(course => {
            coursesGrid.appendChild(course);
        });
    } catch (error) {
        console.error('Error filtering courses:', error.message);
    }
}

// دوال مساعدة لإدارة التخزين المؤقت لبيانات المستخدم
function getCachedUserData() {
    try {
        const cachedData = localStorage.getItem('cachedUserData');
        if (!cachedData) return null;

        const parsedData = JSON.parse(cachedData);
        const token = localStorage.getItem('token');

        // التحقق من تطابق التوكن
        if (parsedData.token === token && parsedData.user && parsedData.user.grade) {
            return parsedData.user;
        }
        return null;
    } catch (error) {
        console.error('Error getting cached user data:', error.message);
        NotificationManager.show('حدث خطأ أثناء جلب بيانات المستخدم', 'error');
        return null;
    }
}

function setCachedUserData(user, token) {
    try {
        const cacheData = {
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                grade: user.grade,
                isAdmin: user.isAdmin || false,
                isBanned: user.isBanned || false
            },
            token: token,
            timestamp: Date.now()
        };
        localStorage.setItem('cachedUserData', JSON.stringify(cacheData));
    } catch (error) {
        console.error('Error setting cached user data:', error.message);
        NotificationManager.show('حدث خطأ أثناء تخزين بيانات', 'error');
    }
}

// دوال مساعدة لإدارة التخزين المؤقت للإشعارات
function getCachedNotifications(userGrade) {
    try {
        const cachedData = localStorage.getItem('cachedNotifications');
        if (!cachedData) return null;

        const parsedData = JSON.parse(cachedData);
        const cacheDuration = 300000; // 5 دقائق بالميلي ثانية
        const currentTime = Date.now();

        // التحقق من صلاحية التخزين وتطابق الصف الدراسي
        if (parsedData.timestamp && (currentTime - parsedData.timestamp) < cacheDuration && parsedData.grade === userGrade) {
            return parsedData.data;
        }
        return null;
    } catch (error) {
        console.error('Error getting cached notifications:', error.message);
        NotificationManager.show('حدث خطأ أثناء جلب الإشعارات', 'error');
        return null;
    }
}

function setCachedNotifications(notifications, userGrade) {
    try {
        const cacheData = {
            data: notifications,
            timestamp: Date.now(),
            grade: userGrade
        };
        localStorage.setItem('cachedNotifications', JSON.stringify(cacheData));
    } catch (error) {
        console.error('Error setting cached notifications:', error.message);
        NotificationManager.show('حدث خطأ أثناء تخزين الإشعارات', 'error');
    }
}

let isLoadingNotifications = false;

async function loadNotifications() {
    if (isLoadingNotifications) return;
    isLoadingNotifications = true;

    try {
        const notificationsDropdown = document.getElementById('notificationsDropdown');
        if (!notificationsDropdown) throw new Error('قائمة الإشعارات غير موجودة');
        notificationsDropdown.innerHTML = '';

        const userGrade = await getUserGrade();
        const token = localStorage.getItem('token');
        if (!token) throw new Error('التوكن غير موجود، يرجى تسجيل الدخول');

        // جلب عدد الإشعارات من السيرفر فقط
        const countResponse = await fetch('/api/notifications', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!countResponse.ok) {
            const errorData = await countResponse.json();
            throw new Error(errorData.message || 'فشل في جلب الإشعارات');
        }
        let notificationsFromServer = await countResponse.json();
        notificationsFromServer = notificationsFromServer.filter(notification =>
            !notification.grade ||
            notification.grade === 'عام' ||
            notification.grade === userGrade
        );
        const serverCount = notificationsFromServer.length;

        const cachedNotifications = getCachedNotifications(userGrade);
        if (cachedNotifications && cachedNotifications.length === serverCount) {
            displayNotifications(cachedNotifications, userGrade);
            isLoadingNotifications = false;
            return;
        }
        // إذا لم يوجد كاش أو العدد مختلف، استخدم بيانات السيرفر وحدّث الكاش
        setCachedNotifications(notificationsFromServer, userGrade);
        displayNotifications(notificationsFromServer, userGrade);
    } catch (error) {
        console.error('Error fetching notifications:', error.message);
        const userGrade = await getUserGrade();
        const cachedNotifications = getCachedNotifications(userGrade);
        if (cachedNotifications) {
            displayNotifications(cachedNotifications, userGrade);
        } else {
            NotificationManager.show(error.message || 'حدث خطأ أثناء جلب الإشعارات', 'error');
            const notificationsDropdown = document.getElementById('notificationsDropdown');
            if (notificationsDropdown) {
                notificationsDropdown.innerHTML = '<li>تعذر تحميل الإشعارات</li>';
            }
        }
    } finally {
        isLoadingNotifications = false;
    }
}

function displayNotifications(notifications, userGrade) {
    try {
        const notificationsDropdown = document.getElementById('notificationsDropdown');
        if (!notificationsDropdown) throw new Error('قائمة الإشعارات غير موجودة');
        notificationsDropdown.innerHTML = '';

        const notificationCountBadge = document.getElementById('notificationCountBadge');
        if (!notificationCountBadge) throw new Error('شارة عدد الإشعارات غير موجودة');
        notificationCountBadge.textContent = notifications.length;

        if (notifications.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'لا توجد إشعارات';
            notificationsDropdown.appendChild(li);
        } else {
            notifications = notifications.reverse();
            notifications.forEach((notification, index) => {
                const li = document.createElement('li');
                const titleSpan = document.createElement('span');
                titleSpan.className = 'notification-title';
                titleSpan.textContent = notification.title || 'بدون عنوان';
                li.appendChild(titleSpan);

                if (index === 0) {
                    const badgeSpan = document.createElement('span');
                    badgeSpan.className = 'new-notification-badge';
                    badgeSpan.textContent = 'جديد';
                    li.appendChild(badgeSpan);
                }

                li.addEventListener('click', function () {
                    try {
                        const notificationDetailsModalLabel = document.getElementById('notificationDetailsModalLabel');
                        const notificationDetailsContent = document.getElementById('notificationDetailsContent');
                        if (!notificationDetailsModalLabel || !notificationDetailsContent) {
                            throw new Error('عناصر نافذة تفاصيل الإشعار غير موجودة');
                        }
                        notificationDetailsModalLabel.innerHTML = `<i class="fas fa-bell"></i> ${notification.title || 'بدون عنوان'}`;
                        notificationDetailsContent.textContent = notification.content || 'بدون محتوى';
                        const notificationModal = new bootstrap.Modal(document.getElementById('notificationDetailsModal'));
                        if (!notificationModal) throw new Error('نافذة تفاصيل الإشعار غير موجودة');
                        notificationModal.show();
                    } catch (error) {
                        console.error('Error showing notification details:', error.message);
                    }
                });
                notificationsDropdown.appendChild(li);
            });
        }
    } catch (error) {
        console.error('Error displaying notifications:', error.message);
    }
}

async function fetchNotificationsCount() {
    try {
        const token = localStorage.getItem('token');
        if (!token) throw new Error('التوكن غير موجود، يرجى تسجيل الدخول');

        const userGrade = await getUserGrade();
        const cachedNotifications = getCachedNotifications(userGrade);

        if (cachedNotifications) {
            const notificationCountBadge = document.getElementById('notificationCountBadge');
            if (!notificationCountBadge) throw new Error('شارة عدد الإشعارات غير موجودة');
            notificationCountBadge.textContent = cachedNotifications.length;
            return;
        }

        const response = await fetch('/api/notifications', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل في جلب عدد الإشعارات');
        }
        let notifications = await response.json();

        notifications = notifications.filter(notification =>
            !notification.grade ||
            notification.grade === 'عام' ||
            notification.grade === userGrade
        );

        const notificationCountBadge = document.getElementById('notificationCountBadge');
        if (!notificationCountBadge) throw new Error('شارة عدد الإشعارات غير موجودة');
        notificationCountBadge.textContent = notifications.length;
        setCachedNotifications(notifications, userGrade);
    } catch (error) {
        console.error('Error fetching notifications count:', error.message);
    }
}

async function getUserGrade() {
    try {
        const cachedUser = getCachedUserData();
        if (cachedUser) {
            return cachedUser.grade || null;
        }

        const token = localStorage.getItem('token');
        if (!token) throw new Error('التوكن غير موجود، يرجى تسجيل الدخول');

        const response = await fetch('/api/dashboard', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'فشل في جلب الصف الدراسي');
        }
        const data = await response.json();
        const user = data.user;
        if (!user) throw new Error('بيانات المستخدم غير موجودة');

        // تخزين بيانات المستخدم
        setCachedUserData(user, token);
        return user.grade || null;
    } catch (error) {
        console.error('Error fetching user grade:', error.message);
        return null;
    }
}

document.addEventListener('DOMContentLoaded', function () {
    try {
        fetchNotificationsCount();

        const notificationsButton = document.getElementById('notificationsButton');
        if (notificationsButton) {
            notificationsButton.replaceWith(notificationsButton.cloneNode(true));
            document.getElementById('notificationsButton').addEventListener('click', function () {
                try {
                    loadNotifications();
                } catch (error) {
                    console.error('Error initiating notifications load:', error.message);
                }
            });
        }
    } catch (error) {
        console.error('Error initializing notifications:', error.message);
    }
});