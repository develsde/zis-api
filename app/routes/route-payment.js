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
router.post("/disbursement", authentication, payment.transferInquiry)
router.post("/inquiry-disbursement/:id", authentication, payment.inquiry)
router.post("/status-disbursement/:id", authentication, payment.statusInquiry)
router.post("/balance-disbursement", authentication, payment.checkBalance)
router.get("/cashflow-disbursement", payment.cashflow);
router.post("/topup-disbursement", authentication, payment.topUp)
router.delete("/delete-topup-disbursement", authentication, payment.deleteTopUp)

module.exports = router;
