const router = require("express").Router();
const { report } = require("../controllers");
const path = require("path");
const { authentication, authorization } = require("../../config/auth");
const { upload } = require("../helper/upload");

// GET localhost:8080/home => Ambil data semua dari awal
router.post("/create-report", authentication, report.createReport);
router.post("/create-mutasi", authentication, report.createMutasi);
router.post("/create-mutasibank", authentication, report.createMutasiFromBank);
router.post("/create-jurnal", authentication, report.createJurnal);
router.post("/create-jurnal-header", authentication, report.createJurnalHeader);
router.get("/doc-type", authentication, report.alldocType);
router.post("/header/update", report.getHeaderAndUpdateItems);
router.get("/document-number", authentication, report.listDocumentNumber);
router.get("/all-mutasi", authentication, report.allDataMutasi);
router.get("/all-jurnal", authentication, report.allDataJurnal);
router.get("/all-jurnal-header", report.allDataJurnalHeader);
router.get("/all-items", report.allDataJurnalDetail);
router.get("/all-jurnal-header/:id", report.getDataJurnalHeaderById);
router.put("/update-items", report.updateJurnal);
router.get("/all-item-perheader/:id", report.allItemPerHeader);
router.delete("/delete-header", authentication, report.deleteJurnalHeader);
router.delete("/delete-item", authentication, report.deleteJurnalItem);



router.post("/upload-filemutasi", authentication, upload.single("statement"), report.uploadMutasi);
module.exports = router;
