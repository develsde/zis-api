const router = require("express").Router();
const { usererp } = require("../controllers");
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
router.post("/login", loginlimiter, usererp.loginUser);
router.post("/login-mgt", loginlimiter, usererp.loginMgt);
router.post("/register", authentication, usererp.registerUser);
router.post("/revoked", authentication, usererp.deleteToken);
router.get("/detail/:id", authentication, usererp.detailUser);
router.put("/update/:id", authentication, usererp.updateUser);
router.get("/users", authentication, usererp.getAllUser);
router.put("/verifed/:id", authentication, usererp.verifiedUser);
router.put("/updaterole/:id", authentication, usererp.updateRoles);
router.get("/types", authentication, usererp.getDataType);
router.delete("/remove", authentication, usererp.deleteUser);
router.get("/kategori", authentication, usererp.getDataKategory);

module.exports = router;
