const router = require("express").Router();
const { report } = require("../controllers");
const path = require("path");
const { authentication, authorization } = require("../../config/auth");
const { upload } = require("../helper/upload");

// GET localhost:8080/home => Ambil data semua dari awal
router.post("/create-report", authentication, report.createReport);
router.post("/create-mutasi", authentication, report.createMutasi);
router.post("/create-mutasibank", authentication, report.createMutasiFromBank);

router.post("/upload-filemutasi", authentication, upload.single("statement"), report.uploadMutasi);
module.exports = router;
