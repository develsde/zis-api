const router = require("express").Router();
const { dashboard } = require("../controllers");
const path = require("path");
const { authentication, authorization } = require("../../config/auth");
const { upload } = require("../helper/upload");

// GET localhost:8080/home => Ambil data semua dari awal
router.get("/total-mustahiq", authentication, dashboard.checkTotalMustahiq);
router.get("/data-penyaluran", authentication, dashboard.graphPenyaluran);
router.get("/data-perprogram", authentication, dashboard.graphPerprogram);

module.exports = router;
