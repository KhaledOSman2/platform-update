process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const xss = require('xss-clean'); // لتنظيف مدخلات المستخدم
const cookieParser = require('cookie-parser'); // إضافة cookie-parser
require('dotenv').config();

// إضافة معالج الأخطاء العام
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        Error.captureStackTrace(this, this.constructor);
    }
}

// ميدلوير لمعالجة أخطاء MongoDB
const handleMongoError = (err, req, res, next) => {
    if (err.name === 'MongoServerError') {
        if (err.code === 11000) {
            // معالجة خطأ التكرار في البيانات
            const field = Object.keys(err.keyPattern)[0];
            return res.status(400).json({
                status: 'error',
                message: field === 'email' ? 'البريد الإلكتروني موجود مسبقًا' : `القيمة مكررة في الحقل ${field}`
            });
        }
    }
    next(err.message);
};

// معالج الأخطاء العام
const globalErrorHandler = (err, req, res, next) => {
    // تأكد من أن err هو كائن
    if (typeof err === 'string') {
        err = new Error(err);
    }
    
    // تأكد من وجود كود حالة صالح
    const statusCode = err.statusCode && !isNaN(err.statusCode) ? err.statusCode : 500;
    const status = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';

    res.status(statusCode).json({
        status: status,
        message: err.message || 'حدث خطأ داخلي'
    });
};

const {
    User,
    Course,
    Grade,
    ActivationCode,
    Subscription,
    Notification
} = require('./utils/models');
const fileManager = require('./utils/file-manager');
const app = express();
const PORT = 4000;
const JWT_SECRET = "914a20dddcf9c8d07abf5a4fd19c9895761b2381ca439db756a4a1c479ad37c0";

app.use(cookieParser());

// استيراد وتفعيل نظام المسارات النظيفة
const setupRoutes = require('./utils/routes');
setupRoutes(app);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(xss()); // استخدام xss-clean لتنظيف المدخلات

// تطبيق معالج أخطاء MongoDB
app.use(handleMongoError);
app.use(globalErrorHandler);

// ميدلوير للتحقق من التوكن
async function authenticateToken(req, res, next) {
    // أولاً، حاول استخدام الكوكي (الأكثر أماناً)
    let token = req.cookies?.token;
    
    // احتياطياً، تحقق من الهيدر لأغراض التوافق الخلفي
    if (!token) {
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }
    
    if (!token) return res.status(401).json({ message: 'غير مصرح، يرجى تسجيل الدخول' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const currentUser = await User.findOne({ id: decoded.id });
        
        if (!currentUser || currentUser.isBanned) {
            return res.status(403).json({ message: 'حسابك محظور يرجى التواصل مع الدعم الفني.' });
        }
        
        req.user = decoded;
        next();
    } catch (err) {
        console.error('خطأ في التحقق من التوكن:', err.message);
        return res.status(403).json({ message: 'التوكن غير صالح أو منتهي الصلاحية' });
    }
}

// ----------------------
// API لتسجيل حساب جديد
// ----------------------
app.post('/api/register', async (req, res) => {
    let { username, email, password, grade } = req.body;
    username = username.trim();
    email = email.trim().toLowerCase();

    if (username.length > 16) {
        return res.status(400).json({ message: 'اسم المستخدم يجب ألا يزيد عن 16 حرفًا' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ message: 'البريد الإلكتروني مستخدم بالفعل' });
    }

    try {
        const newUser = new User({ id: Date.now(), username, email, password, grade, isAdmin: false, isBanned: false });
        await newUser.save();
        res.status(201).json({ message: 'تم إنشاء الحساب بنجاح' });
    } catch (err) {
        if (err.name === 'ValidationError') {
            // جمع رسائل الأخطاء من Mongoose
            const errors = Object.values(err.errors).map(val => val.message);
            return res.status(400).json({ message: errors.join('. ') });
        }
        // أخطاء أخرى
        return res.status(500).json({ message: 'حدث خطأ أثناء إنشاء الحساب' });
    }
});

// ----------------------
// API لتسجيل الدخول (توليد توكن JWT)
// ----------------------
// نقطة نهاية API للتحقق من صلاحية التوكن
app.get('/api/validate-token', authenticateToken, (req, res) => {
    // إذا وصل المستخدم إلى هنا، فهذا يعني أن التوكن صالح لأن middleware authenticateToken سيمنع الوصول إذا كان التوكن منتهي الصلاحية
    res.json({ valid: true });
});

// نقطة نهاية API لتجديد التوكن
app.post('/api/refresh-token', async (req, res) => {
    try {
        // استخراج التوكن من الكوكي أو الهيدر
        let token = req.cookies?.token;
        
        if (!token) {
            const authHeader = req.headers['authorization'];
            if (authHeader && authHeader.startsWith('Bearer ')) {
                token = authHeader.split(' ')[1];
            }
        }
        
        if (!token) {
            return res.status(401).json({ message: 'لم يتم توفير التوكن' });
        }
        
        // التحقق من التوكن الحالي
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
        } catch (error) {
            return res.status(401).json({ message: 'التوكن غير صالح' });
        }
        
        // التحقق من المستخدم في قاعدة البيانات
        const user = await User.findOne({ id: decoded.id });
        if (!user || user.isBanned) {
            return res.status(403).json({ message: 'المستخدم غير موجود أو محظور' });
        }
        
        // إنشاء توكن جديد
        const newToken = jwt.sign(
            { 
                id: user.id, 
                email: user.email, 
                grade: user.grade, 
                isAdmin: user.isAdmin 
            }, 
            JWT_SECRET, 
            { expiresIn: '1h' }
        );
        
        res.cookie('token', newToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            path: '/',
            maxAge: 6 * 60 * 60 * 1000,
            domain: req.hostname === 'localhost' ? 'localhost' : undefined
        });
        
        res.json({
            message: 'تم تجديد التوكن بنجاح',
            token: newToken
        });
    } catch (error) {
        console.error('خطأ في تجديد التوكن:', error);
        res.status(500).json({ message: 'حدث خطأ أثناء تجديد التوكن' });
    }
});

// نقطة نهاية API لتسجيل الخروج وإزالة الـ HttpOnly cookies - تم تحديثها

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
        return res.status(401).json({ message: 'البريد الإلكتروني خطأ' });
    }
    if (user.password !== password) {
        return res.status(401).json({ message: 'كلمة المرور خطأ' });
    }
    if (user.isBanned) {
        return res.status(403).json({ message: 'حسابك محظور يرجى التواصل مع الدعم الفني.' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, grade: user.grade, isAdmin: user.isAdmin }, JWT_SECRET, { expiresIn: '1h' });
    
    try {
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            path: '/',
            domain: req.hostname === 'localhost' ? 'localhost' : undefined,
            maxAge: 6 * 60 * 60 * 1000
        });
        
        res.json({ message: 'تم تسجيل الدخول بنجاح', token, user });
    } catch (error) {
        console.error('Error happened while setting token cookie:', error);
        res.json({ message: 'حدث خطأ اثناء محاولة تسجيل الدخول', token, user });
    }
});

// ----------------------
// API لتسجيل الخروج 
// ----------------------
app.post('/api/logout', (req, res) => {
    console.log('Processing logout request...');
    try {
        // مسح جميع الكوكيز المتعلقة بالمصادقة
        const cookieOptions = {
            path: '/',
            domain: req.hostname === 'localhost' ? 'localhost' : undefined,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict'
        };

        // مسح الكوكيز الأساسية
        res.clearCookie('token', cookieOptions);
        res.clearCookie('user_info', { ...cookieOptions, httpOnly: false });
        
        // مسح بالطريقة القديمة أيضًا (للتوافق)
        res.clearCookie('token');
        res.clearCookie('user_info');

        // محاولة صريحة لإزالة الكوكيز عن طريق تعيين تواريخ انتهاء قديمة
        res.cookie('token', '', { expires: new Date(0), path: '/' });
        res.cookie('user_info', '', { expires: new Date(0), path: '/' });

        console.log('Successfully cleared all authentication cookies');
        res.json({ success: true, message: 'تم تسجيل الخروج بنجاح' });
    } catch (error) {
        console.error('خطأ أثناء تسجيل الخروج:', error);
        res.status(500).json({ message: 'حدث خطأ أثناء تسجيل الخروج' });
    }
});

// ----------------------
// API لإدارة المستخدمين (المستخدمين/الطلاب)
// ----------------------
app.get('/api/users', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    const users = await User.find();
    res.json(users);
});

app.get('/api/only-user', authenticateToken, async (req, res) => {
    const currentUserId = req.user.id;
    const currentUser = await User.findOne({ id: currentUserId });

    if (!currentUser) {
        return res.status(404).json({ message: 'User not found' });
    }

    res.json(currentUser);
});

app.delete('/api/users/:id', authenticateToken, async (req, res) => {
    try {
        if (!req.user.isAdmin) return res.sendStatus(403);

        const userId = parseInt(req.params.id);

        // التحقق من صحة معرف المستخدم
        if (isNaN(userId) || userId <= 0) {
            return res.status(400).json({ message: 'معرف المستخدم غير صالح' });
        }

        // منع الأدمن من حذف حسابه الشخصي
        if (req.user.id === userId) {
            return res.status(403).json({ message: 'لا يمكن للمسؤول حذف حسابه الشخصي' });
        }

        const result = await User.deleteOne({ id: userId });
        
        if (result.deletedCount === 0) {
            return res.status(404).json({ message: 'المستخدم غير موجود' });
        }
        
        res.json({ message: 'تم حذف المستخدم بنجاح' });
    } catch (error) {
        console.error('خطأ في حذف المستخدم:', error.message);
        res.status(500).json({ message: 'حدث خطأ أثناء محاولة حذف المستخدم' });
    }
});

// تعديل بيانات المستخدم: بعد التحديث يتم إرسال علم لتسجيل الخروج مع رسالة معلومات الطلب
app.put('/api/users/:id', authenticateToken, async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id);
        if (!req.user.isAdmin && req.user.id !== userId) {
            throw new AppError('غير مصرح لك بتعديل بيانات هذا المستخدم', 403);
        }

        const user = await User.findOne({ id: userId });
        if (!user) {
            throw new AppError('المستخدم غير موجود', 404);
        }

        const { username, password, email, grade } = req.body;

        // التحقق من صحة البيانات
        if (!username || username.trim() === '') {
            return res.status(400).json({ message: 'اسم المستخدم مطلوب' });
        }

        if (username.length > 25) {
            return res.status(400).json({ message: 'اسم المستخدم يجب ألا يزيد عن 25 حرفًا' });
        }

        if (!password || password.trim() === '') {
            return res.status(400).json({ message: 'كلمة المرور مطلوبة' });
        }

        // التحقق من تكرار البريد الإلكتروني
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
            if (existingUser && existingUser.id !== userId) {
                return res.status(400).json({ message: 'البريد الإلكتروني مستخدم بالفعل' });
            }
        }

        if (req.user.isAdmin) {
            user.username = username;
            user.password = password;
            user.email = email || user.email;
            user.grade = grade || user.grade;
        } else {
            user.username = username;
            user.password = password;
        }

        await user.save();

        if (!req.user.isAdmin && req.user.id === userId) {
            res.json({ message: 'تم تحديث البيانات بنجاح. الرجاء تسجيل الدخول مرة أخرى.' });
        } else {
            res.json({ message: 'تم تحديث البيانات بنجاح.' });
        }
    } catch (error) {
        console.error('خطأ في تحديث بيانات المستخدم:', error.message);
        if (error.name === 'ValidationError') {
            // جمع رسائل الأخطاء من Mongoose
            const errors = Object.values(error.errors).map(val => val.message);
            return res.status(400).json({ message: errors.join('. ') });
        }
        next(error);
    }
});

app.post('/api/users/:id/make-admin', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const userId = parseInt(req.params.id);
    const user = await User.findOne({ id: userId });
    if (user) {
        user.isAdmin = true;
        await user.save();
        res.json({ message: 'تم ترقية المستخدم إلى مسؤول' });
    } else {
        res.status(404).json({ message: 'المستخدم غير موجود' });
    }
});

app.post('/api/users/:id/remove-admin', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const userId = parseInt(req.params.id);

    if (req.user.id === userId) {
        return res.status(403).json({ message: 'لا يمكن للمسؤول إزالة صلاحيات المسؤول عن حسابه الشخصي' });
    }

    const user = await User.findOne({ id: userId });
    if (user) {
        user.isAdmin = false;
        await user.save();
        res.json({ message: 'تم إزالة صلاحية المسؤول من المستخدم' });
    } else {
        res.status(404).json({ message: 'المستخدم غير موجود' });
    }
});

app.post('/api/users/:id/ban', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const userId = parseInt(req.params.id);

    if (req.user.id === userId) {
        return res.status(403).json({ message: 'لا يمكن للمسؤول حظر حسابه الشخصي' });
    }

    const user = await User.findOne({ id: userId });
    if (user) {
        user.isBanned = true;
        await user.save();
        res.json({ message: 'تم حظر المستخدم' });
    } else {
        res.status(404).json({ message: 'المستخدم غير موجود' });
    }
});

app.post('/api/users/:id/unban', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const userId = parseInt(req.params.id);
    const user = await User.findOne({ id: userId });
    if (user) {
        user.isBanned = false;
        await user.save();
        res.json({ message: 'تم إلغاء حظر المستخدم' });
    } else {
        res.status(404).json({ message: 'المستخدم غير موجود' });
    }
});

// ----------------------
// API لإدارة الكورسات
// ----------------------

// endpoint خاص بالمستخدمين المسجلين، يقوم بإرجاع الدورات الخاصة بصف المستخدم
app.get('/api/courses', authenticateToken, async (req, res) => {
    const userGrade = req.user.grade;
    const grade = req.query.grade || userGrade;
    const filteredCourses = await Course.find({ grade: grade.toString() }).select('id title grade imageURL addedDate videos');
    const simplifiedCourses = filteredCourses.map(course => ({
        id: course.id,
        title: course.title,
        grade: course.grade,
        imageURL: course.imageURL,
        addedDate: course.addedDate,
        videosCount: course.videos ? course.videos.length : 0
    }));
    res.json(simplifiedCourses);
});

// endpoint لإرجاع جميع الدورات بدون تحقق أو تصفية (لصفحات العرض العامة مثل courses.html)
app.get('/api/all-courses', async (req, res) => {
    const courses = await Course.find().select('id title grade imageURL addedDate price videos');
    const simplifiedCourses = courses.map(course => ({
        id: course.id,
        title: course.title,
        grade: course.grade,
        imageURL: course.imageURL,
        addedDate: course.addedDate,
        price: course.price,
        videosCount: course.videos ? course.videos.length : 0
    }));
    res.json(simplifiedCourses);
});

// endpoint لإرجاع جميع الدورات بدون تحقق أو تصفية (لصفحات العرض العامة مثل admin.html)
app.get('/api/admin-courses', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    const gradeId = req.query.grade;
    let query = {};
    if (gradeId) {
        // ابحث عن اسم الصف أولاً
        const gradeObj = await Grade.findOne({ id: Number(gradeId) });
        if (gradeObj) {
            query.grade = gradeObj.name;
        } else {
            // إذا لم يوجد الصف، أعد مصفوفة فارغة
            return res.json([]);
        }
    }
    const courses = await Course.find(query);
    res.json(courses);
});

// جلب جميع الكورسات لغرض الفلترة
app.get('/api/admin-all-courses', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const courses = await Course.find().select('id title grade');
    res.json(courses);
});

app.get('/api/courses/:id', authenticateToken, async (req, res) => {
    const courseId = parseInt(req.params.id);
    const course = await Course.findOne({ id: courseId });
    if (course) {
        res.json(course);
    } else {
        res.status(404).json({ message: 'الكورس غير موجودة' });
    }
});

app.post('/api/courses', authenticateToken, fileManager.uploadCourseImage, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const { title, grade, price } = req.body;
    let videos = [];
    let activities = [];
    let exams = [];
    try {
        videos = req.body.videos ? JSON.parse(req.body.videos).map(video => {
            if (!video.id || video.id === "") {
                video.id = Date.now().toString();
            }
            return { ...video, addedDate: new Date().toISOString() };
        }) : [];
        activities = req.body.activities ? JSON.parse(req.body.activities) : [];
        exams = req.body.exams ? JSON.parse(req.body.exams).map(exam => {
            if (!exam.id || exam.id === "") {
                exam.id = Date.now().toString();
            }
            return { ...exam, addedDate: new Date().toISOString() };
        }) : [];
    } catch (error) {
        return res.status(400).json({ message: 'Invalid format' });
    }
    const videoURL = videos.length > 0 ? videos[0].url : '';
    let imageURL = '';
    try {
        // حذف صورة الكورس القديمة من Cloudinary إذا تم رفع صورة جديدة (في حالة التعديل)
        if (req.body.existingImageURL && req.file) {
            await fileManager.deleteCloudinaryFileByUrl(req.body.existingImageURL);
        }
        if (req.file) {
            // رفع الصورة فعليًا إلى Cloudinary مع اسم الملف الأصلي
            const result = await fileManager.uploadToCloudinary(req.file.buffer, req.file.mimetype, 'courses', req.file.originalname);
            imageURL = result.secure_url;
        } else {
            imageURL = '';
        }
    } catch (error) {
        console.error('Error during upload course image to Cloudinary:', error.message);
        imageURL = '';
    }

    const newCourse = new Course({
        id: Date.now(),
        title,
        videoURL,
        videos,
        activities,
        exams,
        grade,
        price: parseFloat(price) || 0,
        imageURL,
        addedDate: new Date().toISOString()
    });
    await newCourse.save();
    res.json({ message: 'تم إضافة الكورس بنجاح' });
});

app.put('/api/courses/:id', authenticateToken, fileManager.uploadCourseImage, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const courseId = parseInt(req.params.id);
    const course = await Course.findOne({ id: courseId });
    if (!course) {
        return res.status(404).json({ message: 'الكورس غير موجود' });
    }

    try {
        const { title, grade, price } = req.body;
        // معالجة الفيديوهات
        const oldVideos = course.videos || [];
        const newVideos = req.body.videos ? JSON.parse(req.body.videos) : [];
        // حذف الفيديوهات القديمة التي لم تعد موجودة
        for (const oldVideo of oldVideos) {
            const stillExists = newVideos.some(newVideo => 
                (newVideo.id && newVideo.id === oldVideo.id) || 
                (newVideo.url && newVideo.url === oldVideo.url)
            );
            if (!stillExists && oldVideo.url) {
                await fileManager.deleteCloudinaryFileByUrl(oldVideo.url); // تعديل: حذف فعلي من Cloudinary
            }
        }
        // إعداد قائمة الفيديوهات الجديدة مع الحفاظ على تواريخ الإضافة
        const videos = newVideos.map(video => {
            const existingVideo = oldVideos.find(v => v.id === video.id);
            return {
                ...video,
                addedDate: existingVideo ? existingVideo.addedDate : new Date().toISOString()
            };
        });
        // معالجة الأنشطة
        const oldActivities = course.activities || [];
        const newActivities = req.body.activities ? JSON.parse(req.body.activities) : [];
        // حذف ملفات الأنشطة القديمة أو المستبدلة فقط إذا تم حذف النشاط أو استبداله فعليًا
        for (const oldActivity of oldActivities) {
            // تحقق من وجود النشاط في القائمة الجديدة
            const matchingNewActivity = newActivities.find(newActivity => newActivity.id && newActivity.id === oldActivity.id);
            // إذا لم يعد النشاط موجودًا في القائمة الجديدة (تم حذفه من الواجهة)
            if (!matchingNewActivity && oldActivity.filePath) {
                console.log(`Delete a deleted activity file: ${oldActivity.title} (${oldActivity.filePath})`);
                await fileManager.deleteCloudinaryFileByUrl(oldActivity.filePath);
            }
            // إذا كان النشاط موجودًا ولكن تم استبدال الملف فقط
            else if (matchingNewActivity && oldActivity.filePath && matchingNewActivity.filePath && matchingNewActivity.filePath !== oldActivity.filePath) {
                console.log(`Delete a replaced activity file: ${oldActivity.title} (${oldActivity.filePath})`);
                await fileManager.deleteCloudinaryFileByUrl(oldActivity.filePath);
            }
        }
        // معالجة الامتحانات
        const oldExams = course.exams || [];
        const newExams = req.body.exams ? JSON.parse(req.body.exams) : [];
        const exams = newExams.map(exam => {
            const existingExam = oldExams.find(e => e.id === exam.id);
            return {
                ...exam,
                addedDate: existingExam ? existingExam.addedDate : new Date().toISOString()
            };
        });
        // معالجة صورة الكورس
        let imageURL = course.imageURL;
        if (req.file) {
            if (course.imageURL) {
                await fileManager.deleteCloudinaryFileByUrl(course.imageURL);
            }
            try {
                const result = await fileManager.uploadToCloudinary(req.file.buffer, req.file.mimetype, 'courses', req.file.originalname);
                imageURL = result.secure_url;
            } catch (error) {
                console.error('خطأ في رفع صورة الكورس إلى Cloudinary (تعديل):', error.message);
            }
        }
        // تحديث قائمة الأنشطة في قاعدة البيانات لتكون مطابقة تمامًا للقائمة الجديدة
        Object.assign(course, {
            title,
            grade,
            price: (price !== undefined && price !== null) ? parseFloat(price) || 0 : course.price,
            imageURL,
            videos,
            activities: newActivities,
            exams,
            lastUpdated: new Date().toISOString()
        });
        await course.save();

        // حماية إضافية: لا تحذف أي ملف نشاط إلا إذا لم يعد النشاط موجودًا فعلاً في قاعدة البيانات بعد الحفظ
        const savedActivities = course.activities || [];
        for (const oldActivity of oldActivities) {
            const stillExists = savedActivities.some(a => a.id === oldActivity.id);
            if (!stillExists && oldActivity.filePath) {
                console.log(`[DoubleCheck] Effectively delete a deleted activity file: ${oldActivity.title} (${oldActivity.filePath})`);
                await fileManager.deleteCloudinaryFileByUrl(oldActivity.filePath);
            }
        }

        res.json({ 
            message: 'تم تحديث الكورس بنجاح',
            course: {
                id: course.id,
                title: course.title,
                grade: course.grade,
                imageURL: course.imageURL
            }
        });
    } catch (error) {
        console.error('خطأ في تحديث الكورس:', error.message);
        res.status(500).json({ 
            message: 'حدث خطأ أثناء تحديث الكورس',
            error: error.message 
        });
    }
});

app.delete('/api/courses/:id', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const courseId = parseInt(req.params.id);
    const course = await Course.findOne({ id: courseId });

    if (course) {
        try {
            // حذف صورة الكورس
            if (course.imageURL) {
                await fileManager.deleteCloudinaryFileByUrl(course.imageURL);
            }
            // حذف جميع الفيديوهات المرتبطة
            if (course.videos && Array.isArray(course.videos)) {
                for (const video of course.videos) {
                    if (video.url) {
                        await fileManager.deleteCloudinaryFileByUrl(video.url);
                    }
                }
            }
            // حذف جميع ملفات الأنشطة المرتبطة
            if (course.activities && Array.isArray(course.activities)) {
                for (const activity of course.activities) {
                    if (activity.filePath) {
                        await fileManager.deleteCloudinaryFileByUrl(activity.filePath);
                    }
                }
            }
            // حذف جميع ملفات الامتحانات المرتبطة (إن وجدت)
            if (course.exams && Array.isArray(course.exams)) {
                for (const exam of course.exams) {
                    if (exam.filePath) {
                        await fileManager.deleteCloudinaryFileByUrl(exam.filePath);
                    }
                }
            }
            await Course.deleteOne({ id: courseId });
            res.json({ message: 'تم حذف الكورس بنجاح' });
        } catch (error) {
            console.error('خطأ في حذف الكورس أو ملفاته:', error.message);
            res.status(500).json({ message: 'حدث خطأ أثناء حذف الكورس أو ملفاته', error: error.message });
        }
    } else {
        res.status(404).json({ message: 'الكورس غير موجود' });
    }
});

app.post('/api/uploadActivity', authenticateToken, fileManager.uploadActivityFile, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    if (!req.file) {
        return res.status(400).json({ message: 'لم يتم تحميل الملف' });
    }
    try {
        const result = await fileManager.uploadToCloudinary(req.file.buffer, req.file.mimetype, 'activities', req.file.originalname);
        res.json({ filePath: result.secure_url });
    } catch (error) {
        console.error('خطأ في رفع ملف النشاط إلى Cloudinary:', error.message);
        res.status(500).json({ message: 'فشل رفع الملف إلى Cloudinary', error: error.message });
    }
});

app.delete('/api/activities/:id', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    const activityId = req.params.id;
    // ابحث عن الكورس الذي يحتوي على هذا النشاط
    const course = await Course.findOne({ "activities.id": activityId });
    if (!course) return res.status(404).json({ message: 'النشاط غير موجود' });
    const activity = course.activities.find(a => a.id === activityId);
    // حذف الملف من Cloudinary
    if (activity && activity.filePath) {
        await fileManager.deleteCloudinaryFileByUrl(activity.filePath);
    }
    // احذف النشاط من مصفوفة الأنشطة
    course.activities = course.activities.filter(a => a.id !== activityId);
    await course.save();
    res.json({ message: 'تم حذف النشاط والملف بنجاح' });
});

app.get('/uploads/:filename', authenticateToken, (req, res) => {
    const filePath = path.join(__dirname, 'public/uploads', req.params.filename);
    res.download(filePath);
});

// ----------------------
// API لإدارة الصفوف الدراسية
// ----------------------
app.get('/api/grades', async (req, res) => {
    const grades = await Grade.find();
    res.json(grades);
});

app.post('/api/grades', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const { name } = req.body;
    const existingGrade = await Grade.findOne({ name });
    if (existingGrade) {
        return res.status(400).json({ message: 'الصف الدراسي موجود بالفعل' });
    }

    const newGrade = new Grade({ id: Date.now(), name });
    await newGrade.save();
    res.json({ message: 'تم إضافة الصف الدراسي بنجاح' });
});

app.delete('/api/grades/:id', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const gradeId = parseInt(req.params.id);
    await Grade.deleteOne({ id: gradeId });
    res.json({ message: 'تم حذف الصف الدراسي' });
});

// ----------------------
// API لإدارة الامتحانات
// ----------------------
app.post('/api/exams', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const { title, grade, courseId, googleFormUrl } = req.body;
    const course = await Course.findOne({ id: parseInt(courseId), grade: grade.toString() });
    if (!course) {
        return res.status(404).json({ message: 'الكورس غير موجودة لهذا الصف الدراسي' });
    }

    const newExam = {
        id: Date.now(),
        title,
        googleFormUrl,
        courseId: parseInt(courseId),
        addedDate: new Date().toISOString()
    };

    course.exams.push(newExam);
    await course.save();
    res.json({ message: 'تم إضافة الاختبار بنجاح' });
});

app.get('/api/exams', authenticateToken, async (req, res) => {
    const { courseId, grade } = req.query;
    const course = await Course.findOne({ id: parseInt(courseId), grade: grade ? grade.toString() : undefined });
    if (!course) {
        return res.status(404).json({ message: 'الكورس غير موجودة لهذا الصف الدراسي' });
    }
    res.json({ exams: course.exams || [], course });
});

app.put('/api/exams/:id', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const examId = parseInt(req.params.id);
    const { title, grade, courseId, googleFormUrl } = req.body;
    const newCourseId = parseInt(courseId);

    const newCourse = await Course.findOne({ id: newCourseId, grade: grade.toString() });
    if (!newCourse) {
        return res.status(404).json({ message: 'الكورس غير موجودة لهذا الصف الدراسي' });
    }

    let examFound = false;
    let examData = null;

    const courses = await Course.find();
    for (const course of courses) {
        const examIndex = course.exams.findIndex(e => e.id === examId);
        if (examIndex !== -1) {
            examData = course.exams[examIndex];
            course.exams.splice(examIndex, 1);
            await course.save();
            examFound = true;
            break;
        }
    }

    if (!examFound) {
        return res.status(404).json({ message: 'الاختبار غير موجود' });
    }

    examData.title = title;
    examData.googleFormUrl = googleFormUrl;
    examData.courseId = newCourseId;

    newCourse.exams.push(examData);
    await newCourse.save();
    res.json({ message: 'تم تحديث الاختبار بنجاح' });
});

app.delete('/api/exams/:id', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const examId = parseInt(req.params.id);
    let examFound = false;

    const courses = await Course.find();
    for (const course of courses) {
        const examIndex = course.exams.findIndex(e => e.id === examId);
        if (examIndex !== -1) {
            course.exams.splice(examIndex, 1);
            await course.save();
            examFound = true;
            break;
        }
    }

    if (!examFound) {
        return res.status(404).json({ message: 'الاختبار غير موجود' });
    }

    res.json({ message: 'تم حذف الاختبار بنجاح' });
});

// ----------------------
// API لإدارة الإشعارات
// ----------------------
app.get('/api/notifications', authenticateToken, async (req, res) => {
    const grade = req.query.grade;
    const notifications = grade ? await Notification.find({ grade }) : await Notification.find();
    res.json(notifications);
});

app.post('/api/notifications', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const { title, content, grade } = req.body;
    const newNotification = new Notification({ id: Date.now(), title, content, grade });
    await newNotification.save();
    res.json({ message: 'تم إضافة الإشعار بنجاح' });
});

app.put('/api/notifications/:id', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const notificationId = parseInt(req.params.id);
    const { title, content, grade } = req.body;

    const notification = await Notification.findOne({ id: notificationId });
    if (notification) {
        notification.title = title;
        notification.content = content;
        notification.grade = grade;
        await notification.save();
        res.json({ message: 'تم تحديث الإشعار بنجاح' });
    } else {
        res.status(404).json({ message: 'الإشعار غير موجود' });
    }
});

app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const notificationId = parseInt(req.params.id);
    await Notification.deleteOne({ id: notificationId });
    res.json({ message: 'تم حذف الإشعار' });
});

// Endpoint عام لجلب أحدث إشعار عام (بدون مصادقة)
app.get('/api/public-notification', async (req, res) => {
    // جلب أحدث إشعار عام (grade === 'عام' أو بدون grade)
    const notifications = await Notification.find({ $or: [ { grade: 'عام' }, { grade: { $exists: false } }, { grade: '' } ] }).sort({ id: 1 });
    if (notifications.length > 0) {
        const latestNotification = notifications[notifications.length - 1];
        res.json(latestNotification);
    } else {
        res.json(null);
    }
});

// ----------------------
// API للإحصائيات (محمية)
// ----------------------
app.get('/api/analytics', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);

    const totalUsers = await User.countDocuments();
    const totalCourses = await Course.countDocuments();
    const totalActivities = await Course.aggregate([{ $project: { activitiesCount: { $size: '$activities' } } }, { $group: { _id: null, total: { $sum: '$activitiesCount' } } }]);
    const totalVideos = await Course.aggregate([{ $project: { videosCount: { $size: '$videos' } } }, { $group: { _id: null, total: { $sum: '$videosCount' } } }]);
    const totalExams = await Course.aggregate([{ $project: { examsCount: { $size: '$exams' } } }, { $group: { _id: null, total: { $sum: '$examsCount' } } }]);

    res.json({
        totalUsers,
        totalCourses,
        totalActivities: totalActivities[0]?.total || 0,
        totalVideos: totalVideos[0]?.total || 0,
        totalExams: totalExams[0]?.total || 0
    });
});

app.get('/api/dashboard', authenticateToken, async (req, res) => {
    const currentUser = await User.findOne({ id: req.user.id });
    res.json({ message: 'لوحة تحكم الطالب', user: currentUser });
});

app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    res.json({ message: 'لوحة تحكم الأدمن', user: req.user });
});

// ----------------------
// API لإحصائيات الاشتراكات
// ----------------------
app.get('/api/subscription-stats', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    const activeCodes = await ActivationCode.countDocuments({ usedBy: { $exists: false }, isDisabled: { $ne: true } });
    const usedCodes = await ActivationCode.countDocuments({ usedBy: { $exists: true } });
    const totalSubscriptions = await Subscription.countDocuments({ isExpired: { $ne: true } });
    res.json({
        activeCodes,
        usedCodes,
        totalSubscriptions
    });
});

// ----------------------
// API لجلب أكواد التفعيل مع التصفية والصفحات
// ----------------------
app.get('/api/activation-codes', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    const { page = 1, filter = 'all', grade = '', course = '' } = req.query;
    const pageSize = 10;
    let query = {};
    if (filter === 'active') {
        query.usedBy = { $exists: false };
        query.isDisabled = { $ne: true };
    } else if (filter === 'used') {
        query.usedBy = { $exists: true };
    } else if (filter === 'disabled') {
        query.isDisabled = true;
    }
    if (grade) {
        query.gradeId = parseInt(grade);
    }
    if (course) {
        query.courseIds = parseInt(course);
    }
    const totalItems = await ActivationCode.countDocuments(query);
    const totalPages = Math.ceil(totalItems / pageSize);
    const codes = await ActivationCode.find(query)
        .sort({ creationDate: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize);
    const activeCodes = codes.filter(code => !code.usedBy && !code.isDisabled);
    const usedCodes = codes.filter(code => code.usedBy);
    const disabledCodes = codes.filter(code => code.isDisabled);
    res.json({
        activeCodes,
        usedCodes,
        disabledCodes,
        totalPages,
        currentPage: parseInt(page),
        totalItems
    });
});

// جلب تفاصيل كود تفعيل محدد
app.get('/api/activation-codes/:id', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    const codeId = Number(req.params.id);
    if (isNaN(codeId)) return res.status(400).json({ message: 'معرّف الكود غير صالح' });
    const code = await ActivationCode.findOne({ id: codeId });
    if (!code) return res.status(404).json({ message: 'الكود غير موجود' });
    // جلب معلومات الكورسات
    let courseDetails = [];
    if (Array.isArray(code.courseIds) && code.courseIds.length > 0) {
        const courses = await Course.find({ id: { $in: code.courseIds } });
        courseDetails = courses.map(c => ({ id: c.id, title: c.title, grade: c.grade }));
    }
    // جلب اسم الصف
    let gradeName = '';
    if (code.gradeId) {
        const grade = await Grade.findOne({ id: code.gradeId });
        if (grade) gradeName = grade.name;
    }
    res.json({ ...code.toObject(), courses: courseDetails, gradeName });
});

// تعطيل كود تفعيل
app.post('/api/activation-codes/:id/disable', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    const codeId = Number(req.params.id);
    if (isNaN(codeId)) return res.status(400).json({ message: 'معرّف الكود غير صالح' });
    const code = await ActivationCode.findOne({ id: codeId });
    if (!code) return res.status(404).json({ message: 'الكود غير موجود' });
    if (code.usedBy) return res.status(400).json({ message: 'الكود مستخدم بالفعل ولا يمكن تعطيله' });
    code.isDisabled = true;
    code.disabledBy = req.user.id;
    code.disabledDate = new Date().toISOString();
    await code.save();
    res.json({ success: true, message: 'تم تعطيل الكود بنجاح' });
});

// إلغاء تعطيل كود تفعيل (تفعيل كود معطل)
app.post('/api/activation-codes/:id/enable', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    const codeId = Number(req.params.id);
    if (isNaN(codeId)) return res.status(400).json({ message: 'معرّف الكود غير صالح' });
    const code = await ActivationCode.findOne({ id: codeId });
    if (!code) return res.status(404).json({ message: 'الكود غير موجود' });
    if (!code.isDisabled) return res.status(400).json({ message: 'الكود غير معطل' });
    code.isDisabled = false;
    code.enabledBy = req.user.id;
    code.enabledDate = new Date().toISOString();
    await code.save();
    res.json({ success: true, message: 'تم إلغاء تعطيل الكود بنجاح' });
});

// حذف كود تفعيل
app.delete('/api/activation-codes/:id', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    const codeId = Number(req.params.id);
    if (isNaN(codeId)) return res.status(400).json({ message: 'معرّف الكود غير صالح' });
    const code = await ActivationCode.findOne({ id: codeId });
    if (!code) return res.status(404).json({ message: 'الكود غير موجود' });
    await ActivationCode.deleteOne({ id: codeId });
    res.json({ success: true, message: 'تم حذف الكود بنجاح' });
});

// إنشاء أكواد تفعيل جديدة
app.post('/api/activation-codes/generate', authenticateToken, async (req, res) => {
    if (!req.user.isAdmin) return res.sendStatus(403);
    const { count, gradeId, courseIds } = req.body;
    if (!count || count < 1 || count > 100) {
        return res.status(400).json({ message: 'عدد الأكواد يجب أن يكون بين 1 و 100' });
    }
    if (!gradeId) {
        return res.status(400).json({ message: 'يرجى تحديد الصف الدراسي' });
    }
    if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
        return res.status(400).json({ message: 'يرجى تحديد كورس واحد على الأقل' });
    }
    // تحقق من وجود الصف والكورسات
    const grade = await Grade.findOne({ id: parseInt(gradeId) });
    if (!grade) return res.status(404).json({ message: 'الصف الدراسي غير موجود' });
    const courses = await Course.find({ id: { $in: courseIds.map(Number) } });
    if (courses.length === 0) return res.status(404).json({ message: 'الكورسات المحددة غير موجودة' });
    // توليد الأكواد
    const existingCodes = await ActivationCode.find({}, 'code');
    const existingSet = new Set(existingCodes.map(c => c.code));
    function generateUniqueCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code;
        do {
            code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        } while (existingSet.has(code));
        existingSet.add(code);
        return code;
    }
    const newCodes = [];
    for (let i = 0; i < count; i++) {
        const newCode = new ActivationCode({
            id: Date.now() + i,
            code: generateUniqueCode(),
            gradeId: parseInt(gradeId),
            courseIds: courseIds.map(Number),
            creationDate: new Date().toISOString(),
            createdBy: req.user.id
        });
        newCodes.push(newCode);
    }
    await ActivationCode.insertMany(newCodes);
    res.json({ success: true, message: `تم إنشاء ${count} كود بنجاح`, codes: newCodes });
});

// تصدير الأكواد
app.get('/api/codes-export', authenticateToken, async (req, res) => {
    if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({ message: 'غير مصرح لك بتصدير الأكواد' });
    }
    const { filter = 'all', grade = '', course = '', includeCourses = false } = req.query;
    let query = {};
    if (filter === 'active') {
        query.usedBy = { $exists: false };
        query.isDisabled = { $ne: true };
    } else if (filter === 'used') {
        query.usedBy = { $exists: true };
    } else if (filter === 'disabled') {
        query.isDisabled = true;
    }
    if (grade && grade !== '') {
        query.gradeId = parseInt(grade);
    }
    if (course && course !== '') {
        query.courseIds = parseInt(course);
    }
    const codes = await ActivationCode.find(query).sort({ creationDate: -1 });
    if (!codes.length) {
        return res.status(200).send('لا توجد أكواد تطابق معايير التصفية المحددة');
    }
    // جلب الصفوف والكورسات لمعلومات إضافية
    let gradesMap = {};
    let coursesMap = {};
    if (includeCourses === 'true') {
        const allCourses = await Course.find();
        coursesMap = Object.fromEntries(allCourses.map(c => [c.id, c.title]));
    }
    if (grade || includeCourses === 'true') {
        const allGrades = await Grade.find();
        gradesMap = Object.fromEntries(allGrades.map(g => [g.id, g.name]));
    }
    // إعداد CSV
    let csvHeaders = 'كود التفعيل,عدد الكورسات,الصف الدراسي,تاريخ الإنشاء,الحالة,المستخدم,تاريخ الاستخدام';
    if (includeCourses === 'true') {
        csvHeaders += ',أسماء الكورسات';
    }
    let csvContent = csvHeaders + '\n';
    codes.forEach(code => {
        let status = code.isDisabled ? 'معطل' : (code.usedBy ? 'مستخدم' : 'نشط');
        const courseCount = code.courseIds ? code.courseIds.length : 0;
        let gradeName = '-';
        if (code.gradeId && gradesMap[code.gradeId]) {
            gradeName = gradesMap[code.gradeId];
        }
        let csvLine = `${code.code},${courseCount},${gradeName},${new Date(code.creationDate).toLocaleDateString('ar-EG')},${status},${code.usedBy || '-'},${code.usageDate ? new Date(code.usageDate).toLocaleDateString('ar-EG') : '-'}`;
        if (includeCourses === 'true' && code.courseIds && Array.isArray(code.courseIds)) {
            const courseNames = code.courseIds.map(cid => coursesMap[cid] || '').filter(Boolean).join(' | ');
            csvLine += `,${courseNames}`;
        }
        csvContent += csvLine + '\n';
    });
    // تحديد اسم الملف
    let fileName = 'activation-codes';
    if (filter === 'active') fileName = 'active-codes';
    if (filter === 'used') fileName = 'used-codes';
    if (filter === 'disabled') fileName = 'disabled-codes';
    if (grade && grade !== '') fileName += `-grade-${grade}`;
    if (course && course !== '') fileName += `-course-${course}`;
    const date = new Date().toISOString().split('T')[0];
    fileName = `${fileName}-${date}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.status(200).send(csvContent);
});

app.listen(PORT, () => {
    console.log(`- Server running on port ${PORT}`);
});
