// Immediate check before any DOM operations
(function () {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.replace('login?from=admin');
    }
})();

// يجب تضمين notification-manager.js في الصفحة قبل هذا الملف

document.addEventListener('DOMContentLoaded', function () {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login?from=admin';
        return;
    }
    
// Global variables
let activeCodes = [];
let usedCodes = [];
let disabledCodes = [];
let currentFilter = 'all';
let codesPage = 1;
const codesPerPage = 10;
let grades = [];
let availableCourses = [];
let selectedCourses = [];
let selectAllActive = false;
let currentGradeFilter = ''; // New: For filtering by grade
let currentCourseFilter = ''; // New: For filtering by course
let allCoursesList = []; // New: All courses across all grades

// Store all codes for comprehensive search
window.allActiveCodes = [];
window.allUsedCodes = [];
window.allDisabledCodes = [];

// When the document is ready

    // Initial data loading
    loadStatistics();
    loadCodes();
    loadGrades();
    loadAllCourses(); // New: Load all courses for filtering
    setupEventListeners();

// Load all courses for filtering
function loadAllCourses() {
    fetch('/api/admin-all-courses', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(response => response.json())
    .then(data => {
        allCoursesList = data;
        populateCoursesFilterDropdown();
    })
    .catch(error => {
        console.error('Error loading all courses:', error.message);
    });
}

// Populate courses filter dropdown
function populateCoursesFilterDropdown() {
    const courseFilter = document.getElementById('courseFilter');
    courseFilter.innerHTML = '<option value="">جميع الكورسات</option>';
    
    if (allCoursesList && allCoursesList.length > 0) {
        allCoursesList.forEach(course => {
            const option = document.createElement('option');
            option.value = course.id;
            option.textContent = course.title;
            courseFilter.appendChild(option);
        });
    }
}

// Load grades for dropdown
function loadGrades() {
    fetch('/api/grades', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(response => response.json())
    .then(data => {
        grades = data;
        populateGradesDropdown();
        populateGradesFilterDropdown(); // New: Populate the grade filter dropdown
        if (typeof loadCodes === 'function') {
            loadCodes(codesPage);
        }
    })
    .catch(error => {
        console.error('Error loading grades:', error);
    });
}

// Populate grades filter dropdown
function populateGradesFilterDropdown() {
    const gradeFilter = document.getElementById('gradeFilter');
    if (gradeFilter) {
        gradeFilter.innerHTML = '<option value="">جميع الصفوف الدراسية</option>';
        
        grades.forEach(grade => {
            const option = document.createElement('option');
            option.value = grade.id;
            option.textContent = grade.name;
            gradeFilter.appendChild(option);
        });
    }
}

// Populate grades dropdown
function populateGradesDropdown() {
    const gradeSelect = document.getElementById('codeGrade');
    gradeSelect.innerHTML = '<option value="">اختر الصف الدراسي</option>';
    
    grades.forEach(grade => {
        const option = document.createElement('option');
        option.value = grade.id;
        option.textContent = grade.name;
        gradeSelect.appendChild(option);
    });
}

// Load courses by grade
function loadCoursesByGrade(gradeId) {
    // Show loading state
    const coursesLoading = document.querySelector('.courses-loading');
    const coursesEmpty = document.querySelector('.courses-empty');
    const coursesList = document.getElementById('coursesList');
    
    coursesLoading.classList.remove('d-none');
    coursesEmpty.classList.add('d-none');
    coursesList.classList.add('d-none');
    coursesList.innerHTML = '';
    
    // Reset selected courses
    selectedCourses = [];
    selectAllActive = false;
    updateToggleAllButtonText();
    
    fetch(`/api/admin-courses?grade=${gradeId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(response => response.json())
    .then(data => {
        availableCourses = data;
        populateCoursesList();
        coursesLoading.classList.add('d-none');
        
        if (availableCourses.length === 0) {
            coursesEmpty.querySelector('p').textContent = 'لا توجد كورسات متاحة لهذا الصف الدراسي.';
            coursesEmpty.classList.remove('d-none');
        } else {
            coursesList.classList.remove('d-none');
        }
    })
    .catch(error => {
        console.error('Error loading courses:', error);
    });
}

// Populate courses list with checkboxes
function populateCoursesList() {
    const coursesList = document.getElementById('coursesList');
    coursesList.innerHTML = '';
    
    availableCourses.forEach(course => {
        const courseItem = document.createElement('div');
        courseItem.className = 'course-item';
        courseItem.dataset.courseId = course.id;
        courseItem.innerHTML = `
            <label>
                <input type="checkbox" class="course-checkbox" value="${course.id}">
                <span class="course-title">${course.title}</span>
            </label>
        `;
        coursesList.appendChild(courseItem);
        
        // Add event listener to checkbox
        const checkbox = courseItem.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', function() {
            const courseId = parseInt(this.value);
            if (this.checked) {
                selectedCourses.push(courseId);
                courseItem.classList.add('selected');
            } else {
                selectedCourses = selectedCourses.filter(id => id !== courseId);
                courseItem.classList.remove('selected');
                // Update toggle all button state if any is unchecked
                if (selectAllActive) {
                    selectAllActive = false;
                    updateToggleAllButtonText();
                }
            }
        });
    });
}

// Toggle all courses selection
function toggleAllCourses() {
    selectAllActive = !selectAllActive;
    updateToggleAllButtonText();
    
    const checkboxes = document.querySelectorAll('.course-checkbox');
    const courseItems = document.querySelectorAll('.course-item');
    
    checkboxes.forEach((checkbox, index) => {
        checkbox.checked = selectAllActive;
        if (selectAllActive) {
            courseItems[index].classList.add('selected');
        } else {
            courseItems[index].classList.remove('selected');
        }
    });
    
    // Update selectedCourses array
    if (selectAllActive) {
        selectedCourses = availableCourses.map(course => course.id);
    } else {
        selectedCourses = [];
    }
}

// Update toggle all button text
function updateToggleAllButtonText() {
    const toggleBtn = document.getElementById('toggleAllCourses');
    if (selectAllActive) {
        toggleBtn.innerHTML = '<i class="fas fa-square me-1"></i> إلغاء تحديد الكل';
    } else {
        toggleBtn.innerHTML = '<i class="fas fa-check-square me-1"></i> تحديد الكل';
    }
}

// Load statistics for dashboard
function loadStatistics() {
    fetch('/api/subscription-stats', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('totalActiveCodes').textContent = data.activeCodes;
        document.getElementById('totalUsedCodes').textContent = data.usedCodes;
        document.getElementById('totalSubscriptions').textContent = data.totalSubscriptions;
    })
    .catch(error => console.error('Error loading statistics:', error));
}

let isLoadingAllPages = false;
let totalPagesCount = 0;

// Load activation codes
function loadCodes(page = 1, isLoadingAll = false) {
    // Build query parameters including new filters
    let queryParams = `page=${page}&filter=${currentFilter}`;
    if (currentGradeFilter) {
        queryParams += `&grade=${currentGradeFilter}`;
    }
    if (currentCourseFilter) {
        queryParams += `&course=${currentCourseFilter}`;
    }
    
    return fetch(`/api/activation-codes?${queryParams}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(response => response.json())
    .then(data => {
        // If we're loading all pages for search, accumulate the data
        if (isLoadingAll) {
            // Accumulate data for search
            window.allActiveCodes = [...window.allActiveCodes, ...(data.activeCodes || [])];
            window.allUsedCodes = [...window.allUsedCodes, ...(data.usedCodes || [])];
            window.allDisabledCodes = [...window.allDisabledCodes, ...(data.disabledCodes || [])];
            
            return data; // Return data for the caller
        } else {
            // Regular page display
            activeCodes = data.activeCodes;
            usedCodes = data.usedCodes;
            disabledCodes = data.disabledCodes || [];
            totalPagesCount = data.totalPages;
            displayCodes();
            updateCodesPagination(data.totalPages, page);
            
            // If this is the first page and we haven't loaded all data yet, start loading all pages
            if (page === 1 && !isLoadingAllPages && !window.allPagesLoaded) {
                loadAllPagesForSearch();
            }
            
            return data;
        }
    })
    .catch(error => {
        console.error('Error loading codes:', error);
        return { activeCodes: [], usedCodes: [], disabledCodes: [], totalPages: 1 };
    });
}

// Load all pages of codes for comprehensive search
async function loadAllPagesForSearch() {
    if (isLoadingAllPages || window.allPagesLoaded) return; // Prevent multiple simultaneous loads
    
    isLoadingAllPages = true;
    console.log('Starting to load all pages for search');
    
    try {
        // Reset the global search arrays
        window.allActiveCodes = [];
        window.allUsedCodes = [];
        window.allDisabledCodes = [];
        
        // القضية المحددة: البيانات الحالية (للصفحة الأولى) لا تضاف إلى المصفوفات العالمية
        // لنضف البيانات الحالية أولاً حتى نتأكد من أن بيانات الصفحة الأولى موجودة
        if (activeCodes.length > 0 || usedCodes.length > 0 || disabledCodes.length > 0) {
            console.log('Adding current page (page 1) data to search arrays');
            window.allActiveCodes = [...window.allActiveCodes, ...activeCodes];
            window.allUsedCodes = [...window.allUsedCodes, ...usedCodes];
            window.allDisabledCodes = [...window.allDisabledCodes, ...disabledCodes];
        } else {
            // إذا لم تكن بيانات الصفحة الأولى متاحة حاليًا، قم بتحميلها
            console.log('Loading page 1 data explicitly');
            const firstPageData = await loadCodes(1, true);
            totalPagesCount = firstPageData.totalPages || totalPagesCount;
        }
        
        // التأكد من أن لدينا معلومات عن إجمالي عدد الصفحات
        if (totalPagesCount === 0) {
            const tempData = await loadCodes(1, false);
            totalPagesCount = tempData.totalPages || 1;
        }
        
        console.log(`Total pages to load: ${totalPagesCount}`);
        
        // تحميل جميع الصفحات الأخرى (من 2 إلى النهاية)
        const promises = [];
        for (let i = 2; i <= totalPagesCount; i++) { // بدء من 2 لأننا تعاملنا مع الصفحة 1 بالفعل
            console.log(`Loading page ${i} for search...`);
            promises.push(loadCodes(i, true));
        }
        
        await Promise.all(promises);
        window.allPagesLoaded = true;
        console.log('All pages loaded for search. Total codes:', 
                  window.allActiveCodes.length + window.allUsedCodes.length + window.allDisabledCodes.length);
    } catch (error) {
        console.error('Error loading all pages for search:', error);
    } finally {
        isLoadingAllPages = false;
    }
}

// Display codes based on current filter
function displayCodes() {
    const codesTable = document.getElementById('codesTable');
    const tbody = codesTable.querySelector('tbody');

    // Clear existing rows
    tbody.innerHTML = '';

    // Determine which codes to display based on filter
    let codesToDisplay = [];
    if (currentFilter === 'all') {
        codesToDisplay = [...activeCodes, ...usedCodes, ...disabledCodes];
    } else if (currentFilter === 'active') {
        codesToDisplay = [...activeCodes];
    } else if (currentFilter === 'used') {
        codesToDisplay = [...usedCodes];
    } else if (currentFilter === 'disabled') {
        codesToDisplay = [...disabledCodes];
    }

    // لا تقطع النتائج هنا، السيرفر يعيد فقط أكواد الصفحة المطلوبة

    // If no codes, show a message
    if (codesToDisplay.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="9" class="text-center">
                <div class="alert alert-info m-0">
                    لا توجد أكواد تطابق الفلتر الحالي.
                </div>
            </td>
        `;
        tbody.appendChild(row);
        return;
    }

    // Add rows for each code
    codesToDisplay.forEach((code, index) => {
        const row = document.createElement('tr');
        let isActive = !code.usedBy && !code.isDisabled;
        let isDisabled = code.isDisabled === true;
        let statusClass = isActive ? 'success' : (isDisabled ? 'warning' : 'secondary');
        let statusText = isActive ? 'نشط' : (isDisabled ? 'معطل' : 'مستخدم');
        const courseCount = code.courseIds ? code.courseIds.length : 0;
        let gradeName = '-';
        if (code.gradeId && grades && Array.isArray(grades)) {
            const grade = grades.find(g => g.id === code.gradeId);
            if (grade) {
                gradeName = grade.name;
            }
        }
        // ترتيب الصف الصحيح بناءً على الصفحة الحالية
        const rowNumber = index + 1 + (codesPage - 1) * codesPerPage;
        row.innerHTML = `
            <td>${rowNumber}</td>
            <td>${code.code}</td>
            <td>${courseCount} كورس</td>
            <td>${gradeName}</td>
            <td>${formatDate(code.creationDate)}</td>
            <td><span class="badge bg-${statusClass}">${statusText}</span></td>
            <td>${code.usedBy || '-'}</td>
            <td>${code.usageDate ? formatDate(code.usageDate) : '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary view-code" data-code-id="${code.id}" title="عرض التفاصيل">
                    <i class="fas fa-eye"></i>
                </button>
                ${isActive ? `
                <button class="btn btn-sm btn-warning disable-code" data-code-id="${code.id}" title="تعطيل الكود">
                    <i class="fas fa-ban"></i>
                </button>
                ` : ''}
                ${isDisabled ? `
                <button class="btn btn-sm btn-success enable-code" data-code-id="${code.id}" title="إلغاء تعطيل الكود">
                    <i class="fas fa-check"></i>
                </button>
                ` : ''}
                <button class="btn btn-sm btn-danger delete-code" data-code-id="${code.id}" title="حذف الكود">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Attach event listeners to buttons
    attachCodeActionListeners();

    // عند عرض الصفحة العادية (بدون بحث)، أظهر التنقل بين الصفحات
    document.getElementById('codesPagination').style.display = '';
}

// Update the pagination for codes
function updateCodesPagination(totalPages, currentPage) {
    const pagination = document.getElementById('codesPagination');
    const ul = pagination.querySelector('ul');

    // Clear existing pagination
    ul.innerHTML = '';

    // Determine which page buttons to show
    // Show max 5 page buttons centered around current page
    const maxVisiblePages = 5;
    let startPage, endPage;
    
    if (totalPages <= maxVisiblePages) {
        // If fewer pages than max visible, show all
        startPage = 1;
        endPage = totalPages;
    } else {
        // Calculate start and end pages
        const halfVisiblePages = Math.floor(maxVisiblePages / 2);
        
        if (currentPage <= halfVisiblePages + 1) {
            // Near the start
            startPage = 1;
            endPage = maxVisiblePages;
        } else if (currentPage >= totalPages - halfVisiblePages) {
            // Near the end
            startPage = totalPages - maxVisiblePages + 1;
            endPage = totalPages;
        } else {
            // In the middle
            startPage = currentPage - halfVisiblePages;
            endPage = currentPage + halfVisiblePages;
        }
    }

    // First page button (if not at the beginning)
    if (startPage > 1) {
        const firstLi = document.createElement('li');
        firstLi.className = 'page-item';
        firstLi.innerHTML = `<a class="page-link" href="#" data-page="1">1</a>`;
        ul.appendChild(firstLi);
        
        // Add ellipsis if needed
        if (startPage > 2) {
            const ellipsisLi = document.createElement('li');
            ellipsisLi.className = 'page-item disabled';
            ellipsisLi.innerHTML = `<a class="page-link" href="#">…</a>`;
            ul.appendChild(ellipsisLi);
        }
    }

    // Previous button
    const prevLi = document.createElement('li');
    prevLi.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    prevLi.innerHTML = `
        <a class="page-link" href="#" aria-label="Previous" ${currentPage > 1 ? `data-page="${currentPage - 1}"` : ''}>
            <span aria-hidden="true">&laquo;</span>
        </a>
    `;
    ul.appendChild(prevLi);

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        const li = document.createElement('li');
        li.className = `page-item ${i === currentPage ? 'active' : ''}`;
        li.innerHTML = `<a class="page-link" href="#" data-page="${i}">${i}</a>`;
        ul.appendChild(li);
    }

    // Next button
    const nextLi = document.createElement('li');
    nextLi.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextLi.innerHTML = `
        <a class="page-link" href="#" aria-label="Next" ${currentPage < totalPages ? `data-page="${currentPage + 1}"` : ''}>
            <span aria-hidden="true">&raquo;</span>
        </a>
    `;
    ul.appendChild(nextLi);

    // Last page button (if not at the end)
    if (endPage < totalPages) {
        // Add ellipsis if needed
        if (endPage < totalPages - 1) {
            const ellipsisLi = document.createElement('li');
            ellipsisLi.className = 'page-item disabled';
            ellipsisLi.innerHTML = `<a class="page-link" href="#">…</a>`;
            ul.appendChild(ellipsisLi);
        }
        
        const lastLi = document.createElement('li');
        lastLi.className = 'page-item';
        lastLi.innerHTML = `<a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a>`;
        ul.appendChild(lastLi);
    }

    // Attach event listeners
    ul.querySelectorAll('a.page-link').forEach(link => {
        if (link.dataset.page) {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                codesPage = parseInt(this.dataset.page);
                loadCodes(codesPage);
            });
        }
    });
}

// Filter codes based on status
function filterCodes(filter) {
    currentFilter = filter;
    codesPage = 1; // Reset to first page when changing filter
    loadCodes(codesPage);

    // Update active filter button
    document.querySelectorAll('.filter-options button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.filter-options button[data-filter="${filter}"]`).classList.add('active');
}

// Search codes across all loaded codes (not just current page)
function searchCodes(searchTerm) {
    searchTerm = searchTerm.trim().toLowerCase();
    console.log('Searching for:', searchTerm);
    
    if (!searchTerm) {
        // إذا كان البحث فارغًا، أعد عرض الصفحة الحالية
        displayCodes();
        document.getElementById('codesPagination').style.display = 'flex';
        return;
    }
    
    // التحقق من حالة التحميل
    console.log('Loading state:', {
        isLoadingAllPages,
        allPagesLoaded: window.allPagesLoaded,
        activeCodesCount: window.allActiveCodes ? window.allActiveCodes.length : 0,
        usedCodesCount: window.allUsedCodes ? window.allUsedCodes.length : 0,
        disabledCodesCount: window.allDisabledCodes ? window.allDisabledCodes.length : 0
    });
    
    // إذا لم يتم تحميل جميع الصفحات بعد، قم بتحميلها فورًا
    if (!window.allPagesLoaded && !isLoadingAllPages) {
        // عرض مؤشر التحميل
        const searchMessage = document.createElement('div');
        searchMessage.id = 'searchLoadingMessage';
        searchMessage.className = 'alert alert-info text-center mb-3';
        searchMessage.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i> جاري تحميل جميع البيانات للبحث...';
        
        const searchContainer = document.querySelector('.search-container');
        const existingMessage = document.getElementById('searchLoadingMessage');
        if (!existingMessage && searchContainer) {
            searchContainer.after(searchMessage);
        }
        
        // تحميل جميع الصفحات ومن ثم إجراء البحث
        loadAllPagesForSearch().then(() => {
            // إزالة مؤشر التحميل
            if (existingMessage) {
                existingMessage.remove();
            }
            // إجراء البحث مرة أخرى بعد تحميل جميع البيانات
            searchCodes(searchTerm);
        });
        return;
    }
    
    // استخدام جميع الأكواد المحفوظة في متغيرات النافذة للبحث الشامل
    let allCodes = [];
    
    // تحقق من وجود الأكواد المحفوظة عالميًا واستخدامها إذا كانت متوفرة
    if (window.allActiveCodes && window.allActiveCodes.length > 0) {
        allCodes = [...window.allActiveCodes];
    } else {
        allCodes = [...activeCodes];
    }
    
    if (window.allUsedCodes && window.allUsedCodes.length > 0) {
        allCodes = [...allCodes, ...window.allUsedCodes];
    } else {
        allCodes = [...allCodes, ...usedCodes];
    }
    
    if (window.allDisabledCodes && window.allDisabledCodes.length > 0) {
        allCodes = [...allCodes, ...window.allDisabledCodes];
    } else {
        allCodes = [...allCodes, ...disabledCodes];
    }
    
    // إذا لم تكن البيانات الشاملة متوفرة، استخدم البيانات المحلية
    if (allCodes.length === 0) {
        allCodes = [...activeCodes, ...usedCodes, ...disabledCodes];
    }
    
    console.log('Total codes to search:', allCodes.length);
    
    // إزالة مؤشر التحميل إذا كان موجودًا
    const existingMessage = document.getElementById('searchLoadingMessage');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // البحث بشكل مباشر عن مطابقة رقم الكود بالضبط
    const exactCodeMatch = allCodes.filter(code => {
        return code.code && code.code.toLowerCase() === searchTerm;
    });
    
    if (exactCodeMatch.length > 0) {
        console.log('Found exact code match:', exactCodeMatch.length);
        displaySearchResults(exactCodeMatch);
        document.getElementById('codesPagination').style.display = 'none';
        return;
    }
    
    // فلترة الأكواد بناءً على نص البحث (ابحث في الكود، المستخدم، الصف، إلخ)
    const filtered = allCodes.filter(code => {
        try {
            let gradeName = '-';
            if (code.gradeId && grades && Array.isArray(grades)) {
                const grade = grades.find(g => g.id === code.gradeId);
                if (grade) gradeName = grade.name;
            }
            
            // البحث في رقم الكود أولاً
            if (code.code && code.code.toLowerCase().includes(searchTerm)) {
                return true;
            }
            
            const courseCount = code.courseIds ? code.courseIds.length : 0;
            
            // تجميع جميع النصوص للبحث
            const searchFields = [
                code.code || '',
                courseCount + ' كورس',
                gradeName,
                formatDate(code.creationDate),
                code.usedBy || '',
                code.usageDate ? formatDate(code.usageDate) : ''
            ];
            
            // البحث في كل حقل على حدة
            for (const field of searchFields) {
                if (field.toLowerCase().includes(searchTerm)) {
                    return true;
                }
            }
            
            // البحث في النص الكامل كملاذ أخير
            const rowText = searchFields.join(' ').toLowerCase();
            return rowText.includes(searchTerm);
        } catch (err) {
            console.error('Error filtering code:', err, code);
            return false;
        }
    });
    
    console.log('Filtered results:', filtered.length);
    
    // عرض النتائج كاملة بدون تقطيع صفحات
    displaySearchResults(filtered);
    
    // إخفاء التنقل بين الصفحات أثناء البحث
    document.getElementById('codesPagination').style.display = 'none';
}

// Display search results
function displaySearchResults(codes) {
    const codesTable = document.getElementById('codesTable');
    const tbody = codesTable.querySelector('tbody');

    // Clear existing rows
    tbody.innerHTML = '';

    // If no codes, show a message
    if (!codes || codes.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td colspan="9" class="text-center">
                <div class="alert alert-info m-0">
                    لا توجد نتائج تطابق البحث.
                </div>
            </td>
        `;
        tbody.appendChild(row);
        return;
    }

    // Add rows for each code in search results
    codes.forEach((code, index) => {
        const row = document.createElement('tr');
        // تحديد حالة الكود
        let isActive = !code.usedBy && !code.isDisabled;
        let isDisabled = code.isDisabled === true;
        let statusClass = isActive ? 'success' : (isDisabled ? 'warning' : 'secondary');
        let statusText = isActive ? 'نشط' : (isDisabled ? 'معطل' : 'مستخدم');
        const courseCount = code.courseIds ? code.courseIds.length : 0;
        let gradeName = '-';
        if (code.gradeId && grades && Array.isArray(grades)) {
            const grade = grades.find(g => g.id === code.gradeId);
            if (grade) {
                gradeName = grade.name;
            }
        }
        // ترتيب الصف الصحيح بناءً على الصفحة الحالية (في البحث غالباً الصفحة 1)
        const rowNumber = index + 1 + (codesPage - 1) * codesPerPage;
        row.innerHTML = `
            <td>${rowNumber}</td>
            <td>${code.code}</td>
            <td>${courseCount} كورس</td>
            <td>${gradeName}</td>
            <td>${formatDate(code.creationDate)}</td>
            <td><span class="badge bg-${statusClass}">${statusText}</span></td>
            <td>${code.usedBy || '-'}</td>
            <td>${code.usageDate ? formatDate(code.usageDate) : '-'}</td>
            <td>
                <button class="btn btn-sm btn-primary view-code" data-code-id="${code.id}" title="عرض التفاصيل">
                    <i class="fas fa-eye"></i>
                </button>
                ${isActive ? `
                <button class="btn btn-sm btn-warning disable-code" data-code-id="${code.id}" title="تعطيل الكود">
                    <i class="fas fa-ban"></i>
                </button>
                ` : ''}
                ${isDisabled ? `
                <button class="btn btn-sm btn-success enable-code" data-code-id="${code.id}" title="إلغاء تعطيل الكود">
                    <i class="fas fa-check"></i>
                </button>
                ` : ''}
                <button class="btn btn-sm btn-danger delete-code" data-code-id="${code.id}" title="حذف الكود">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Attach event listeners to buttons
    attachCodeActionListeners();
}

// Generate new activation codes
function generateCodes() {
    const count = document.getElementById('codeCount').value;
    const gradeId = document.getElementById('codeGrade').value;

    // Validate inputs
    if (!count || count < 1 || count > 100) {
        NotificationManager.show('يرجى إدخال عدد صحيح للأكواد بين 1 و 100.', 'error');
        return;
    }

    if (!gradeId) {
        NotificationManager.show('يرجى اختيار الصف الدراسي.', 'error');
        return;
    }
    
    if (selectedCourses.length === 0) {
        NotificationManager.show('يرجى اختيار كورس واحد على الأقل.', 'error');
        return;
    }

    fetch('/api/activation-codes/generate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
            count,
            gradeId,
            courseIds: selectedCourses
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Hide modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('createCodesModal'));
    modal.hide();

            // Reload codes
            loadCodes(1);
            loadStatistics();

    // Show success message
            NotificationManager.show('تم إنشاء الأكواد بنجاح.', 'success');
        } else {
            NotificationManager.show('حدث خطأ أثناء إنشاء الأكواد: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error generating codes:', error);
        NotificationManager.show('حدث خطأ أثناء إنشاء الأكواد.', 'error');
    });
}

// Export codes to Excel/CSV
function exportCodes(filter, isFiltered = false) {
    // إظهار مؤشر التحميل
    document.body.style.cursor = 'wait';
    let exportBtn;
    
    if (isFiltered) {
        exportBtn = document.querySelector('#exportFilteredCodes');
    } else {
        exportBtn = document.querySelector(`#export${filter === 'all' ? 'All' : filter === 'active' ? 'Active' : filter === 'used' ? 'Used' : 'Disabled'}Codes`);
    }
    
    if (exportBtn) {
        exportBtn.disabled = true;
        exportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التصدير...';
    }
    
    // Build query parameters including all filters
    let queryParams = `filter=${filter}`;
    if (isFiltered) {
        if (currentGradeFilter) {
            queryParams += `&grade=${currentGradeFilter}`;
        }
        if (currentCourseFilter) {
            queryParams += `&course=${currentCourseFilter}`;
        }
    }
    
    // استخدام Fetch API للتحقق من الاستجابة
    fetch(`/api/codes-export?${queryParams}&includeCourses=true`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => {
        if (response.status === 403) {
            throw new Error('غير مصرح لك بتصدير الأكواد. يرجى تسجيل الدخول كمشرف.');
        }
        if (!response.ok) {
            throw new Error(`Status: ${response.status} - ${response.statusText}`);
        }
        return response.blob();
    })
    .then(blob => {
        // إنشاء عنصر <a> مؤقت لتنزيل الملف
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        // تحديد اسم الملف
        const date = new Date().toISOString().split('T')[0];
        let fileName = 'activation-codes';
        
        if (isFiltered) {
            fileName = 'filtered-codes';
        } else {
            if (filter === 'active') fileName = 'active-codes';
            if (filter === 'used') fileName = 'used-codes';
            if (filter === 'disabled') fileName = 'disabled-codes';
        }
        
        a.download = `${fileName}-${date}.csv`;
        
        document.body.appendChild(a);
        a.click();
        
        // تنظيف العناصر المؤقتة
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // إعادة الزر إلى حالته الطبيعية
        resetExportButton(exportBtn, filter, isFiltered);
    })
    .catch(error => {
        console.error('Error exporting codes:', error);
        NotificationManager.show(error.message || 'حدث خطأ أثناء تصدير الأكواد.', 'error');
        
        // إعادة الزر إلى حالته الطبيعية
        resetExportButton(exportBtn, filter, isFiltered);
    });
}

// إعادة تعيين حالة زر التصدير
function resetExportButton(button, filter, isFiltered = false) {
    document.body.style.cursor = 'default';
    if (button) {
        button.disabled = false;
        
        // إعادة النص الأصلي للزر
        let btnText;
        
        if (isFiltered) {
            btnText = 'تصدير النتائج المفلترة';
        } else {
            btnText = 'تصدير جميع الأكواد';
            if (filter === 'active') btnText = 'تصدير الأكواد النشطة';
            if (filter === 'used') btnText = 'تصدير الأكواد المستخدمة';
            if (filter === 'disabled') btnText = 'تصدير الأكواد المعطلة';
        }
        
        button.innerHTML = `<i class="fas fa-file-export me-1"></i> ${btnText}`;
    }
}

// Helper function to format dates
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG');
}

// Set up event listeners
function setupEventListeners() {
    // Grade selection change
    const gradeSelect = document.getElementById('codeGrade');
    if (gradeSelect) {
        gradeSelect.addEventListener('change', function() {
            const gradeId = this.value;
            if (gradeId) {
                loadCoursesByGrade(gradeId);
            } else {
                // Reset courses display when no grade is selected
                document.querySelector('.courses-empty').classList.remove('d-none');
                document.querySelector('.courses-empty').querySelector('p').textContent = 
                    'يرجى اختيار الصف الدراسي أولاً لعرض الكورسات المتاحة.';
                document.getElementById('coursesList').classList.add('d-none');
                document.querySelector('.courses-loading').classList.add('d-none');
                selectedCourses = [];
            }
        });
    }
    
    // Toggle all courses button
    const toggleAllBtn = document.getElementById('toggleAllCourses');
    if (toggleAllBtn) {
        toggleAllBtn.addEventListener('click', toggleAllCourses);
    }

    // Code search
    const searchInput = document.getElementById('codeSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function () {
            searchCodes(this.value);
        }, 500));
    }

    // Filter buttons
    document.querySelectorAll('.filter-options button').forEach(btn => {
        btn.addEventListener('click', function () {
            filterCodes(this.dataset.filter);
        });
    });

    // Generate codes button
    const generateBtn = document.getElementById('generateCodesBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', generateCodes);
    }

    // Export buttons
    document.getElementById('exportAllCodes').addEventListener('click', () => exportCodes('all'));
    document.getElementById('exportActiveCodes').addEventListener('click', () => exportCodes('active'));
    document.getElementById('exportUsedCodes').addEventListener('click', () => exportCodes('used'));
    document.getElementById('exportDisabledCodes').addEventListener('click', () => exportCodes('disabled'));

    // Reset form when modal is closed
    document.getElementById('createCodesModal').addEventListener('hidden.bs.modal', function () {
        document.getElementById('createCodesForm').reset();
        document.getElementById('coursesList').innerHTML = '';
        document.querySelector('.courses-empty').classList.remove('d-none');
        document.getElementById('coursesList').classList.add('d-none');
        document.querySelector('.courses-loading').classList.add('d-none');
        selectedCourses = [];
        selectAllActive = false;
        updateToggleAllButtonText();
    });

    // Grade filter change
    const gradeFilter = document.getElementById('gradeFilter');
    if (gradeFilter) {
        gradeFilter.addEventListener('change', function() {
            currentGradeFilter = this.value;
            
            // تحديث قائمة الكورسات لتظهر فقط الكورسات المرتبطة بالصف المحدد
            updateCourseFilterBasedOnGrade(this.value);
            
            // تطبيق الفلتر
            applyAdvancedFilters();
        });
    }
    
    // Course filter change
    const courseFilter = document.getElementById('courseFilter');
    if (courseFilter) {
        courseFilter.addEventListener('change', function() {
            currentCourseFilter = this.value;
            applyAdvancedFilters();
        });
    }
    
    // Export filtered codes button
    const exportFilteredBtn = document.getElementById('exportFilteredCodes');
    if (exportFilteredBtn) {
        exportFilteredBtn.addEventListener('click', () => exportCodes(currentFilter, true));
    }
}

// Attach event listeners to code action buttons
function attachCodeActionListeners() {
    // View code details
    document.querySelectorAll('.view-code').forEach(btn => {
        btn.addEventListener('click', function () {
            const codeId = this.dataset.codeId;
            viewCodeDetails(codeId);
        });
    });

    // Disable code
    document.querySelectorAll('.disable-code').forEach(btn => {
        btn.addEventListener('click', function () {
            const codeId = this.dataset.codeId;
            if (confirm('هل أنت متأكد من رغبتك في تعطيل هذا الكود؟')) {
                disableCode(codeId);
            }
        });
    });

    // Enable code (إلغاء تعطيل الكود)
    document.querySelectorAll('.enable-code').forEach(btn => {
        btn.addEventListener('click', function () {
            const codeId = this.dataset.codeId;
            if (confirm('هل أنت متأكد من رغبتك في إلغاء تعطيل هذا الكود؟')) {
                enableCode(codeId);
            }
        });
    });

    // Delete code
    document.querySelectorAll('.delete-code').forEach(btn => {
        btn.addEventListener('click', function () {
            const codeId = this.dataset.codeId;
            if (confirm('هل أنت متأكد من رغبتك في حذف هذا الكود؟ لا يمكن التراجع عن هذا الإجراء.')) {
                deleteCode(codeId);
            }
        });
    });
}

// View code details
function viewCodeDetails(codeId) {
    fetch(`/api/activation-codes/${codeId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(response => response.json())
    .then(code => {
        // Populate the modal with code details
        document.getElementById('viewCodeValue').textContent = code.code;
        document.getElementById('viewCreationDate').textContent = formatDate(code.creationDate);
        
        // تحديد حالة الكود (نشط أو معطل أو مستخدم)
        let status = 'نشط';
        if (code.isDisabled) {
            status = 'معطل';
        } else if (code.usedBy) {
            status = 'مستخدم';
        }
        document.getElementById('viewStatus').textContent = status;
        
        document.getElementById('viewUser').textContent = code.usedBy || '-';
        document.getElementById('viewUsageDate').textContent = code.usageDate ? formatDate(code.usageDate) : '-';
        
        // عرض معلومات الصف الدراسي
        const gradeElement = document.getElementById('viewGrade');
        if (gradeElement) {
            gradeElement.textContent = code.gradeName || '-';
        }
        
        // عرض معلومات الكورسات كـ badges
        const coursesListElement = document.getElementById('viewCoursesList');
        if (coursesListElement) {
            coursesListElement.innerHTML = ''; // Clear previous badges
            if (code.courses && Array.isArray(code.courses) && code.courses.length > 0) {
                code.courses.forEach(course => {
                    const badge = document.createElement('span');
                    badge.className = 'course-badge';
                    badge.textContent = course.title;
                    coursesListElement.appendChild(badge);
                });
            } else {
                coursesListElement.textContent = '-';
            }
        }

    // Show the modal
    const modal = new bootstrap.Modal(document.getElementById('codeDetailsModal'));
    modal.show();
    })
    .catch(error => {
        console.error('Error getting code details:', error);
        NotificationManager.show('حدث خطأ أثناء جلب تفاصيل الكود', 'error');
    });
}

// Disable a code
function disableCode(codeId) {
    fetch(`/api/activation-codes/${codeId}/disable`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Reload codes
            loadCodes(codesPage);
            loadStatistics();
            NotificationManager.show('تم تعطيل الكود بنجاح.');
        } else {
            NotificationManager.show('حدث خطأ أثناء تعطيل الكود: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error disabling code:', error);
        NotificationManager.show('حدث خطأ أثناء تعطيل الكود.', 'error');
    });
}

// Enable a code (إلغاء تعطيل كود)
function enableCode(codeId) {
    fetch(`/api/activation-codes/${codeId}/enable`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Reload codes
            loadCodes(codesPage);
            loadStatistics();
            NotificationManager.show('تم إلغاء تعطيل الكود بنجاح.', 'success');
        } else {
            NotificationManager.show('حدث خطأ أثناء إلغاء تعطيل الكود: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error enabling code:', error);
        NotificationManager.show('حدث خطأ أثناء إلغاء تعطيل الكود.', 'error');
    });
}

// Delete a code
function deleteCode(codeId) {
    fetch(`/api/activation-codes/${codeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Reload codes
            loadCodes(codesPage);
            loadStatistics();
            NotificationManager.show('تم حذف الكود بنجاح.', 'success');
        } else {
            NotificationManager.show('حدث خطأ أثناء حذف الكود: ' + data.message, 'error');
        }
    })
    .catch(error => {
        console.error('Error deleting code:', error);
        NotificationManager.show('حدث خطأ أثناء حذف الكود.', 'error');
    });
}

// Utility function for debouncing
function debounce(func, delay) {
    let timeout;
    return function () {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
    }

// Apply grade and course filters
function applyAdvancedFilters() {
    // Update current filter based on current grade and course filters
    loadCodes(1);
}

// Update course filter dropdown based on selected grade
function updateCourseFilterBasedOnGrade(gradeId) {
    const courseFilter = document.getElementById('courseFilter');
    if (!courseFilter) return;
    
    // إعادة تعيين القائمة دائمًا بخيار "جميع الكورسات"
    courseFilter.innerHTML = '<option value="">جميع الكورسات</option>';
    
    // طباعة معلومات تشخيصية حول gradeId
    console.log('Grade ID selected:', gradeId);
    console.log('Grade ID type:', typeof gradeId);
    
    // إذا لم يتم تحديد صف، أظهر جميع الكورسات
    if (!gradeId) {
        console.log('No grade selected, showing all courses');
        // إذا كانت القائمة الكاملة متاحة، استخدمها
        if (allCoursesList && allCoursesList.length > 0) {
            console.log(`Adding all ${allCoursesList.length} courses to dropdown`);
            allCoursesList.forEach(course => {
                const option = document.createElement('option');
                option.value = course.id;
                option.textContent = course.title;
                courseFilter.appendChild(option);
            });
        }
        return;
    }
    
    // تحميل الكورسات من الخادم دائماً للتأكد من أحدث البيانات
    console.log(`Fetching courses for grade ID: ${gradeId}`);
    fetch(`/api/admin-courses?grade=${gradeId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error fetching courses: ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(courses => {
        console.log(`Received ${courses.length} courses from API for grade ID ${gradeId}:`, courses);
        
        if (courses.length === 0) {
            // إذا لم تكن هناك كورسات، جرب استخدام البيانات المخزنة محلياً
            console.log('No courses returned from API, trying local data');
            if (allCoursesList && allCoursesList.length > 0) {
                // تحويل gradeId إلى رقم للمقارنة
                const gradeIdNumber = parseInt(gradeId, 10);
                console.log('Converted grade ID to number:', gradeIdNumber);
                
                // عرض بنية بيانات الكورسات للتشخيص
                console.log('Sample course from allCoursesList:', allCoursesList[0]);
                
                // تجربة مختلف طرق المقارنة
                const filteredCourses = allCoursesList.filter(course => {
                    // طباعة معلومات عن كل كورس للتشخيص
                    if (typeof course.gradeId !== 'undefined') {
                        console.log(`Course ${course.id}: title=${course.title}, gradeId=${course.gradeId}, type=${typeof course.gradeId}`);
                    }
                    
                    return course.gradeId == gradeId || // مقارنة غير صارمة للنصوص والأرقام
                           course.gradeId === gradeIdNumber || // مقارنة صارمة للأرقام
                           course.grade_id == gradeId || // اسم بديل محتمل للخاصية
                           (course.grade && course.grade.id == gradeId); // هيكل بيانات محتمل آخر
                });
                
                console.log(`Found ${filteredCourses.length} courses with grade ID ${gradeId} from local data`);
                
                // إضافة الكورسات المفلترة إلى القائمة
                filteredCourses.forEach(course => {
                    const option = document.createElement('option');
                    option.value = course.id;
                    option.textContent = course.title;
                    courseFilter.appendChild(option);
                });
            }
        } else {
            // إضافة الكورسات من الخادم إلى القائمة
            courses.forEach(course => {
                const option = document.createElement('option');
                option.value = course.id;
                option.textContent = course.title;
                courseFilter.appendChild(option);
            });
        }
        
        // التحقق من عدد الخيارات في القائمة المنسدلة بعد التحديث
        console.log(`Course filter now has ${courseFilter.options.length - 1} courses (excluding the default option)`);
    })
    .catch(error => {
        console.error('Error loading courses for filter:', error);
        // في حالة حدوث خطأ، حاول استخدام البيانات المخزنة محلياً
        if (allCoursesList && allCoursesList.length > 0) {
            const gradeIdNumber = parseInt(gradeId, 10);
            // استخدم مقارنة غير صارمة لزيادة فرصة تطابق البيانات
            const filteredCourses = allCoursesList.filter(course => 
                String(course.gradeId) === String(gradeId) ||
                course.gradeId == gradeId ||
                course.grade_id == gradeId
            );
            
            console.log(`Fallback: Found ${filteredCourses.length} courses from local data`);
            
            // إضافة الكورسات المفلترة إلى القائمة
            filteredCourses.forEach(course => {
                const option = document.createElement('option');
                option.value = course.id;
                option.textContent = course.title;
                courseFilter.appendChild(option);
            });
        }
    });
    
    // إعادة تعيين الفلتر الحالي للكورس
    currentCourseFilter = '';
}

// مثال: عند تفعيل كود اشتراك أو عند حدوث خطأ
function activateAdminSubscription() {
    try {
        // ...عملية التفعيل...
        NotificationManager.show('تم تفعيل كود الاشتراك بنجاح', 'success');
    } catch (error) {
        NotificationManager.show('حدث خطأ أثناء تفعيل كود الاشتراك', 'error');
    }
}

});