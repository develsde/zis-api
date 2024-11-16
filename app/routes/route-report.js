const router = require("express").Router();
const { report } = require("../controllers");
const path = require("path");
const { authentication, authorization } = require("../../config/auth");
const { upload } = require("../helper/upload");

// GET localhost:8080/home => Ambil data semua dari awal
router.get("/create-report", authentication, report.createReport);
router.get("/create-mutasi", authentication, report.createMutasi);

module.exports = router;
