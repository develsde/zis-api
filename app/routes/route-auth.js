const router = require("express").Router();
const { user } = require("../controllers");
const multer = require("multer");
//const upload = multer({ dest: './uploads/reports/' })
const { authentication, authorization } = require("../../config/auth");
const rateLimit = require('express-rate-limit');
const loginlimiter = rateLimit({
    windowMs: 3 * 60 * 1000, // 10 minutes
    max: 3,
    message: {
        status: 429,
        message: "Terlalu banyak kesalahan. Silakan ulangi dalam 3 menit."
    },
    onLimitReached: (req, res, options) => {
        return res.status(429).json({
            message: "Terlalu banyak kesalahan. Silakan ulangi dalam 3 menit.",
        });
    },
});

// GET localhost:8080/home => Ambil data semua dari awal
router.post("/login", loginlimiter, user.loginUser);
router.post("/register", user.registerUser);
router.put("/update", authentication, user.updateUser);
router.post("/verifed", user.verifiedUser);
router.put("/password", authentication, user.updatePasswordWithAuth);
router.post("/resetpassword", user.resetPassword);
router.post("/resetpassERP/:user_id", user.resetPasswordErp);
router.post("/forgot-password", user.forgotPassword);

module.exports = router;
