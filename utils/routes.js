const path = require('path');
const jwt = require('jsonwebtoken');
const { User } = require('./models');

const JWT_SECRET = "914a20dddcf9c8d07abf5a4fd19c9895761b2381ca439db756a4a1c479ad37c0";

async function authenticateTokenForRoute(req, res, next) {
    let token = req.cookies?.token;
    
    if (!token) {
        const authHeader = req.headers['authorization'];
        const queryToken = req.query.token;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        } else if (queryToken) {
            token = queryToken;
        }
    }
    
    if (!token) {
        return res.redirect('/login?from=' + encodeURIComponent(req.path.replace('/', '')));
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const currentUser = await User.findOne({ id: decoded.id });
        
        if (!currentUser || currentUser.isBanned) {
            return res.redirect('/login?from=' + encodeURIComponent(req.path.replace('/', '')));
        }
        
        req.user = decoded;
        next();
    } catch (err) {
        return res.redirect('/login?from=' + encodeURIComponent(req.path.replace('/', '')));
    }
}

function requireAdmin(req, res, next) {
    if (!req.user || !req.user.isAdmin) {
        return res.redirect('/login?from=admin');
    }
    next();
}

function setupRoutes(app) {
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/html/index.html'));
    });
    app.get('/login', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/html/login.html'));
    });
    app.get('/register', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/html/register.html'));
    });
    
    app.get('/about', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/html/about.html'));
    });
    app.get('/404', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/html/404.html'));
    });
    app.get('/logout', (req, res) => {
        try {
            res.clearCookie('token', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Strict',
                path: '/',
                domain: req.hostname === 'localhost' ? 'localhost' : undefined
            });
            res.clearCookie('token');
            setTimeout(() => {
                res.redirect('/login?logout=1');
            }, 100);
        } catch (error) {
            console.error('خطأ أثناء تسجيل الخروج:', error);
            res.redirect('/login?logout=1&error=1');
        }
    });
    
    app.get('/courses', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/html/courses.html'));
    });
    app.get('/course', authenticateTokenForRoute, (req, res) => {
        res.sendFile(path.join(__dirname, '../public/html/course.html'));
    });
    app.get('/dashboard', authenticateTokenForRoute, (req, res) => {
        res.sendFile(path.join(__dirname, '../public/html/dashboard.html'));
    });
    app.get('/subscription', authenticateTokenForRoute, (req, res) => {
        res.sendFile(path.join(__dirname, '../public/html/subscription.html'));
    });
    app.get('/admin', authenticateTokenForRoute, requireAdmin,  (req, res) => {
        res.sendFile(path.join(__dirname, '../public/html/admin.html'));
    });
    app.get('/admin-subs', authenticateTokenForRoute, requireAdmin, (req, res) => {
        res.sendFile(path.join(__dirname, '../public/html/admin-subs.html'));
    });
}

module.exports = setupRoutes;
