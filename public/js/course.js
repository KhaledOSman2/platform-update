let currentVideoIndex = 0;
let videos = [];

function formatDate(dateStr) {
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) throw new Error('تاريخ غير صالح');
        const day = date.getDate();
        const monthNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
        const month = monthNames[date.getMonth()];
        return `${day} ${month}`;
    } catch (error) {
        console.error('Error formatting date:', error.message);
        return '';
    }
}

function adjustTitleSize() {
    try {
        const titleElement = document.getElementById('courseTitle');
        if (!titleElement) throw new Error('عنصر العنوان غير موجود');

        const titleText = titleElement.textContent || '';
        const wordCount = titleText.split(/\s+/).length;
        const charCount = titleText.length;

        if (charCount > 80) {
            titleElement.style.fontSize = '1.2rem';
        } else if (charCount > 60 || wordCount > 8) {
            titleElement.style.fontSize = '1.4rem';
        } else if (charCount > 40 || wordCount > 6) {
            titleElement.style.fontSize = '1.7rem';
        } else if (charCount > 20 || wordCount > 4) {
            titleElement.style.fontSize = '2rem';
        } else {
            titleElement.style.fontSize = '2.5rem';
        }
    } catch (error) {
        console.error('Error adjusting title size:', error.message);
    }
}

async function loadCourseDetails() {
    try {
        await new Promise(resolve => setTimeout(resolve, 500));
        NotificationManager.show('تم تحميل بيانات الكورس بنجاح', 'success');
    } catch (error) {
        console.error('Error loading course details:', error.message);
        NotificationManager.show('حدث خطأ أثناء تحميل بيانات الكورس', 'error');
    }
}

async function loadCourseData() {
    const loadingOverlay = document.getElementById('loadingOverlay');
    try {
        if (!loadingOverlay) throw new Error('عنصر التحميل غير موجود');
        loadingOverlay.style.display = 'flex';

        const token = localStorage.getItem('token');
        // تم إزالة فحص وجود التوكن لأنه تم التحقق منه مسبقاً

        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('id');
        if (!courseId) {
            throw new Error('لم يتم العثور على الكورس');
        }

        const courseResponse = await fetch(`/api/courses/${courseId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!courseResponse.ok) {
            const errorData = await courseResponse.json();
            throw new Error(errorData.message || 'فشل في جلب بيانات الكورس');
        }
        const course = await courseResponse.json();

        const courseTitle = document.getElementById('courseTitle');
        if (!courseTitle) throw new Error('عنصر عنوان الكورس غير موجود');
        courseTitle.textContent = course.title || 'بدون عنوان';
        adjustTitleSize();

        const courseGrade = document.getElementById('courseGrade');
        if (!courseGrade) throw new Error('عنصر الصف الدراسي غير موجود');
        courseGrade.textContent = course.grade || 'غير محدد';

        const courseImage = document.getElementById('courseImage');
        if (!courseImage) throw new Error('عنصر صورة الكورس غير موجود');
        courseImage.src = course.imageURL || 'images/course-placeholder.jpg';

        const courseVideo = document.getElementById('courseVideo');
        if (!courseVideo) throw new Error('عنصر الفيديو غير موجود');
        courseVideo.src = course.videoURL || '';

        const videoTitle = document.getElementById('videoTitle');
        if (!videoTitle) throw new Error('عنصر عنوان الفيديو غير موجود');
        videoTitle.textContent = course.videos && course.videos[0]?.title || 'بدون عنوان';

        const lectureCount = course.videoCount !== undefined ? course.videoCount : (course.videos ? course.videos.length : 0);
        const lectureCountEl = document.getElementById('lectureCount');
        if (!lectureCountEl) throw new Error('عنصر عدد المحاضرات غير موجود');
        lectureCountEl.textContent = `${lectureCount} محاضرات`;

        if (course.addedDate) {
            const courseDate = new Date(course.addedDate);
            if (isNaN(courseDate.getTime())) throw new Error('تاريخ إضافة الكورس غير صالح');
            const formattedCourseDate = formatDate(courseDate);
            const year = courseDate.getFullYear();
            const coursedateEl = document.getElementById('coursedate');
            if (!coursedateEl) throw new Error('عنصر تاريخ الكورس غير موجود');
            coursedateEl.textContent = formattedCourseDate + ' ' + year;
        } else {
            const today = new Date();
            const year = today.getFullYear();
            const coursedateEl = document.getElementById('coursedate');
            if (!coursedateEl) throw new Error('عنصر تاريخ الكورس غير موجود');
            coursedateEl.textContent = formatDate(today) + ' ' + year;
        }

        videos = course.videos || [];
        const videosList = document.getElementById('videosList');
        if (!videosList) throw new Error('عنصر قائمة الفيديوهات غير موجود');
        videosList.innerHTML = '';

        const noVideoMessage = document.getElementById('noVideoMessage');
        if (!noVideoMessage) throw new Error('عنصر رسالة عدم وجود فيديوهات غير موجود');

        if (videos.length > 0) {
            noVideoMessage.style.display = 'none';
            videos.forEach((video, index) => {
                const li = document.createElement('div');
                li.className = 'content-item videos';
                li.innerHTML = `
                    <div class="content-item-header">
                        <div class="content-item-title">
                            <i class="fas fa-video"></i>
                            <span>المحاضرة ${index + 1}:</span>
                        </div>
                        <div class="content-item-badge">
                            <i class="fas fa-calendar-alt"></i>
                            ${formatDate(video.addedDate || new Date())}
                        </div>
                    </div>
                    <div class="content-item-body">${video.title || 'بدون عنوان'}</div>
                `;
                li.dataset.index = index;
                li.addEventListener('click', () => {
                    currentVideoIndex = index;
                    updateVideo();
                });
                videosList.appendChild(li);
            });
            updateNavButtons();
            highlightCurrentVideo();
        } else {
            courseVideo.style.display = 'none';
            noVideoMessage.style.display = 'block';
            videosList.innerHTML = `
                <div class="empty-content-item videos">
                    <i class="fas fa-video-slash"></i>
                    <div class="empty-title">لا تتوفر محاضرات حاليا</div>
                    <div class="empty-message">سيتم إضافة المحاضرات قريبا</div>
                </div>`;
        }

        const activitiesList = document.getElementById('activitiesList');
        if (!activitiesList) throw new Error('عنصر قائمة المستندات غير موجود');
        activitiesList.innerHTML = '';

        if (course.activities && course.activities.length > 0) {
            course.activities.forEach((activity, index) => {
                const li = document.createElement('div');
                li.className = 'content-item activities';
                li.innerHTML = `
                    <div class="content-item-header">
                        <div class="content-item-title">
                            <i class="fas fa-file-pdf"></i>
                            <span>المستند ${index + 1}:</span>
                        </div>
                        <div class="content-item-badge">
                            <i class="fas fa-calendar-alt"></i>
                            ${formatDate(activity.addedDate || new Date())}
                        </div>
                    </div>
                    <div class="content-item-body">${activity.title || 'بدون عنوان'}</div>
                `;
                li.style.cursor = 'pointer';
                li.addEventListener('click', () => {
                    const downloadLink = document.createElement('a');
                    downloadLink.href = activity.filePath || '#';
                    downloadLink.download = activity.title || `document-${index + 1}`;
                    downloadLink.style.display = 'none';
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                });
                activitiesList.appendChild(li);
            });
        } else {
            activitiesList.innerHTML = `
                <div class="empty-content-item activities">
                    <i class="fas fa-file-pdf"></i>
                    <div class="empty-title">لا تتوفر مستندات حاليا</div>
                    <div class="empty-message">سيتم إضافة المستندات والملفات قريبا</div>
                </div>`;
        }

        const examsList = document.getElementById('examsList');
        if (!examsList) throw new Error('عنصر قائمة الاختبارات غير موجود');
        examsList.innerHTML = '';

        const exams = course.exams || [];
        if (exams.length > 0) {
            exams.forEach((exam, index) => {
                const li = document.createElement('div');
                li.className = 'content-item exams';
                li.innerHTML = `
                    <div class="content-item-header">
                        <div class="content-item-title">
                            <i class="fas fa-clipboard-check"></i>
                            <span>الاختبار ${index + 1}:</span>
                        </div>
                        <div class="content-item-badge">
                            <i class="fas fa-calendar-alt"></i>
                            ${formatDate(exam.addedDate || new Date())}
                        </div>
                    </div>
                    <div class="content-item-body">${exam.title || 'بدون عنوان'}</div>
                `;
                li.style.cursor = 'pointer';
                li.addEventListener('click', () => {
                    viewExam(exam.googleFormUrl, exam.title);
                });
                examsList.appendChild(li);
            });
        } else {
            examsList.innerHTML = `
                <div class="empty-content-item exams">
                    <i class="fas fa-clipboard-check"></i>
                    <div class="empty-title">لا تتوفر اختبارات حاليا</div>
                    <div class="empty-message">سيتم إضافة الاختبارات عند انتهاء شرح الدروس</div>
                </div>`;
                    }

        NotificationManager.show('تم تحميل بيانات الكورس بنجاح', 'success');
    } catch (error) {
        console.error('Error loading course data:', error.message);
        
        // تجنب إظهار إشعارات الأخطاء المتعلقة بالتوكن
        if (!error.message.includes('التوكن غير موجود')) {
            NotificationManager.show(error.message || 'حدث خطأ أثناء تحميل بيانات الكورس', 'error');
        }
        
    } finally {
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => loadingOverlay.style.display = 'none', 300);
        }
    }
}

function updateVideo() {
    try {
        const video = videos[currentVideoIndex];
        if (!video) throw new Error('الفيديو غير موجود');

        const courseVideo = document.getElementById('courseVideo');
        if (!courseVideo) throw new Error('عنصر الفيديو غير موجود');
        courseVideo.src = video.url || '';

        const videoTitle = document.getElementById('videoTitle');
        if (!videoTitle) throw new Error('عنصر عنوان الفيديو غير موجود');
        videoTitle.textContent = video.title || 'بدون عنوان';

        updateNavButtons();
        highlightCurrentVideo();
    } catch (error) {
        console.error('Error updating video:', error.message);
        NotificationManager.show('حدث خطأ أثناء تحديث الفيديو', 'error');
    }
}

function updateNavButtons() {
    try {
        const prevBtn = document.getElementById('prevVideoBtn');
        const nextBtn = document.getElementById('nextVideoBtn');
        if (!prevBtn || !nextBtn) throw new Error('أزرار التنقل غير موجودة');

        prevBtn.disabled = currentVideoIndex === 0;
        nextBtn.disabled = currentVideoIndex === videos.length - 1;
    } catch (error) {
        console.error('Error updating nav buttons:', error.message);
    }
}

function highlightCurrentVideo() {
    try {
        const items = document.querySelectorAll('#videosList .content-item');
        items.forEach(item => {
            item.classList.remove('current');
            item.style.pointerEvents = 'auto';
        });

        if (items.length > currentVideoIndex) {
            items[currentVideoIndex].classList.add('current');
        }
    } catch (error) {
        console.error('Error highlighting current video:', error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        // تحميل بيانات الكورس - تم إزالة فحص التوكن لأنه يتم التعامل معه على الخادم
        loadCourseData();

        document.querySelectorAll('.card-header').forEach(header => {
            header.addEventListener('click', function () {
                try {
                    const cardBody = this.nextElementSibling;
                    if (!cardBody) throw new Error('عنصر جسم البطاقة غير موجود');

                    cardBody.classList.toggle('show');

                    const isExpanded = this.getAttribute('aria-expanded') === 'true';
                    this.setAttribute('aria-expanded', !isExpanded);

                    const icon = this.querySelector('i:last-child');
                    if (!icon) throw new Error('أيقونة التحكم غير موجودة');
                    if (isExpanded) {
                        icon.style.transform = 'rotate(0deg)';
                    } else {
                        icon.style.transform = 'rotate(180deg)';
                    }
                } catch (error) {
                    console.error('Error toggling card header:', error.message);
                }
            });
        });

        const revealElements = document.querySelectorAll('.reveal');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });
        revealElements.forEach(el => observer.observe(el));

        const prevVideoBtn = document.getElementById('prevVideoBtn');
        const nextVideoBtn = document.getElementById('nextVideoBtn');
        if (!prevVideoBtn || !nextVideoBtn) throw new Error('أزرار التنقل بالفيديو غير موجودة');

        prevVideoBtn.addEventListener('click', () => {
            try {
                if (currentVideoIndex > 0) {
                    currentVideoIndex--;
                    updateVideo();
                }
            } catch (error) {
                console.error('Error navigating to previous video:', error.message);
                NotificationManager.show('حدث خطأ أثناء الانتقال إلى الفيديو السابق', 'error');
            }
        });

        nextVideoBtn.addEventListener('click', () => {
            try {
                if (currentVideoIndex < videos.length - 1) {
                    currentVideoIndex++;
                    updateVideo();
                }
            } catch (error) {
                console.error('Error navigating to next video:', error.message);
                NotificationManager.show('حدث خطأ أثناء الانتقال إلى الفيديو التالي', 'error');
            }
        });

        window.addEventListener('resize', () => {
            try {
                adjustTitleSize();
            } catch (error) {
                console.error('Error on resize:', error.message);
            }
        });
    } catch (error) {
        console.error('Error initializing page:', error.message);
        NotificationManager.show('حدث خطأ أثناء تحميل الصفحة', 'error');
    }
});

function viewExam(googleFormUrl, examTitle) {
    try {
        if (!googleFormUrl || !examTitle) throw new Error('رابط الاختبار أو العنوان غير صالح');
        const examModal = new bootstrap.Modal(document.getElementById('examModal'));
        if (!examModal) throw new Error('نافذة الاختبار غير موجودة');

        const examIframe = document.getElementById('examIframe');
        if (!examIframe) throw new Error('إطار الاختبار غير موجود');
        examIframe.src = googleFormUrl;

        const examModalLabel = document.getElementById('examModalLabel');
        if (!examModalLabel) throw new Error('عنوان نافذة الاختبار غير موجود');
        examModalLabel.textContent = examTitle;

        examModal.show();
    } catch (error) {
        console.error('Error viewing exam:', error.message);
        NotificationManager.show('حدث خطأ أثناء عرض الاختبار', 'error');
    }
}

window.onscroll = function () {
    try {
        const backToTopBtn = document.getElementById("backToTopBtn");
        if (!backToTopBtn) throw new Error('زر العودة إلى الأعلى غير موجود');
        backToTopBtn.style.display = (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) ? "block" : "none";
    } catch (error) {
        console.error('Error handling scroll:', error.message);
    }
};

function topFunction() {
    try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error('Error scrolling to top:', error.message);
    }
}