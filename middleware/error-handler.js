const fs = require('fs');
const path = require('path');

class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        Error.captureStackTrace(this, this.constructor);
    }
}

// تسجيل الأخطاء في ملف
const logError = (err) => {
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)){
        fs.mkdirSync(logDir);
    }

    const logFile = path.join(logDir, 'error.log');
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${err.stack || err}\n`;

    fs.appendFileSync(logFile, logEntry);
};

// معالج أخطاء MongoDB
const handleMongoErrors = (err) => {
    // معالجة خطأ التكرار
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        const message = field === 'email' 
            ? 'البريد الإلكتروني موجود مسبقاً'
            : `القيمة مكررة في الحقل ${field}`;
        return new AppError(message, 400);
    }

    // معالجة أخطاء التحقق
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(val => val.message);
        return new AppError(`خطأ في البيانات المدخلة: ${errors.join('. ')}`, 400);
    }

    // معالجة أخطاء الاتصال
    if (err.name === 'MongoNetworkError') {
        return new AppError('خطأ في الاتصال بقاعدة البيانات', 500);
    }

    return err;
};

// معالج الأخطاء العام
const errorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    // تسجيل الخطأ
    logError(err.message);

    // معالجة أخطاء MongoDB
    if (err.name === 'MongoServerError' || err.name === 'ValidationError' || err.name === 'MongoNetworkError') {
        err = handleMongoErrors(err.message);
    }

    // في بيئة التطوير
    if (process.env.NODE_ENV === 'development') {
        return res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    }

    // في بيئة الإنتاج
    if (err.isOperational) {
        return res.status(err.statusCode).json({
            status: err.status,
            message: err.message
        });
    }

    // الأخطاء البرمجية غير المتوقعة
    console.error('ERROR 💥', err.message);
    return res.status(500).json({
        status: 'error',
        message: 'حدث خطأ غير متوقع'
    });
};

// تصدير الوحدات
module.exports = {
    AppError,
    errorHandler,
    handleMongoErrors,
    logError
};