const router = require("express").Router();
const { payment } = require("../controllers");
const path = require("path");
const { authentication, authorization } = require("../../config/auth");
const { upload } = require("../helper/upload");

// GET localhost:8080/home => Ambil data semua dari awal
router.get("/authaj", payment.getAuthAJ);
router.get("/digestData", payment.digestBase64Data);
router.get("/signin", payment.signin);
router.post("/request", payment.reqPay)
router.post("/cancel", payment.cancelPay)
router.post("/info", payment.infoPay)


module.exports = router;
