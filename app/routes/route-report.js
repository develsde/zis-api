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
router.put("/update-period", authentication, report.updatePeriod);
router.get("/period", report.getPeriod);
router.get("/all-items", report.allDataJurnalDetail);
router.get("/doc-type", report.alldocType);
router.put("/update-items", report.updateJurnal);
//router.post("/create-jurnal-header-temporary", authentication, report.createJurnalHeaderTemp);
router.get("/document-number", authentication, report.listDocumentNumber);
router.get("/all-mutasi", report.allDataMutasi);
router.get("/all-jurnal", authentication, report.allDataJurnal);
router.get("/all-jurnal-header", authentication, report.allDataJurnalHeader);
router.get("/all-jurnal-proposal", authentication, report.getAllJurnalProposal);
router.get("/all-mutasi-jurnal", authentication, report.getAllMutasi);
router.get("/all-calk", authentication, report.getAllCalkData);
router.get("/eb-bank", report.getEndBalance);
router.get("/eb-justbank", report.getEbBank);
router.post("/posting", report.createPosting);
router.get("/get-posting", report.getPosting);
router.get("/all-item-perheader/:id", authentication, report.allItemPerHeader);
router.delete("/delete-header", authentication, report.deleteJurnalHeader);
router.delete("/delete-item", authentication, report.deleteJurnalItem);




router.post("/upload-filemutasi", authentication, upload.single("statement"), report.uploadMutasi);
module.exports = router;
