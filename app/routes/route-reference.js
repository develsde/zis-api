const router = require("express").Router();
const { refData } = require("../controllers");
const path = require("path");
const { authentication, authorization } = require("../../config/auth");
const { upload } = require("../helper/upload");

// GET localhost:8080/home => Ambil data semua dari awal
router.get("/provinces", refData.provinces);
router.get("/cities/:id", refData.cities);
router.get("/districts/:id", refData.districts);
router.get("/gla", authentication, refData.glaccount);
router.get("/all-program", authentication, refData.getDataProgram); //new for mt940 Header
router.get("/all-muzaki", authentication, refData.getAllMuzaki); //new for mt940 Headerx`
router.get("/glaccMt", authentication, refData.glaccountMt940); //new for mt940
router.get("/gltype", authentication, refData.gltype);
router.post("/addgl", authentication, refData.createGlAccount);
router.put("/updategl/:id", authentication, refData.updateGlAccount);
router.delete("/removegl", authentication, refData.deleteGL);

router.get("/masterbank", authentication, refData.masterbank);
router.post("/addbank", authentication, refData.createMasterBank);
router.put("/updatebank/:id", authentication, refData.updateBank);
router.delete("/removebank", authentication, refData.deleteBank);

router.get("/article", refData.getAllArticle)
router.get("/article/:id", refData.getByIdArticle)
router.post("/addArticle", authentication, upload.single("banner"), refData.registerArticle)
router.put("/editArticle/:id", authentication, upload.single("banner"), refData.updateArticle)
router.delete("/delArticle/:id", authentication, refData.deleteArticle)

router.get("/institusi/:id", refData.institusi)
router.get("/glaccBayar", authentication, refData.glaccountPerBayar);
router.post("/imkasSaldo", refData.checkImkas)

router.get("/activity-paket/:id", refData.paket);

//Reporting Financial
router.get("/gl-account-report", refData.getReportGlaccount);
router.get("/asnaf-type-report", refData.getReportAsnafType);
router.get("/program-report", refData.getReportProgram);

module.exports = router;
