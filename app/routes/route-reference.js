const router = require("express").Router();
const { refData } = require("../controllers");
const path = require("path");
const { authentication, authorization } = require("../../config/auth");
const { upload } = require("../helper/upload");
const { ref } = require("pdfkit");
const { getAllOutlets } = require("../controllers/controller-reference");

// GET localhost:8080/home => Ambil data semua dari awal
router.get("/provinces", refData.provinces);
router.get("/cities/:id", refData.cities);
router.get("/districts/:id", refData.districts);
router.get("/gla", authentication, refData.glaccount);
router.get("/all-program", authentication, refData.getDataProgram); //new for mt940 Header
router.get("/all-muzaki", authentication, refData.getAllMuzaki); //new for mt940 Headerx`
router.get("/glaccMt", authentication, refData.glaccountMt940); //new for mt940
router.get("/glaccManual", authentication, refData.glaccountManual); //new for mt940
router.get("/gltype", authentication, refData.gltype);
router.post("/addgl", authentication, refData.createGlAccount);
router.put("/updategl/:id", authentication, refData.updateGlAccount);
router.delete("/removegl", authentication, refData.deleteGL);

router.get("/masterbank", authentication, refData.masterbank);
router.post("/addbank", authentication, refData.createMasterBank);
router.put("/updatebank/:id", authentication, refData.updateBank);
router.delete("/removebank", authentication, refData.deleteBank);

router.get("/getBank", authentication, refData.getBank);
router.post("/postBank", authentication, refData.postBank);
router.put("/putBank/:id", authentication, refData.putBank);
router.delete("/deleteBank", authentication, refData.delBank);

router.get("/article", refData.getAllArticle);
router.get("/article/:id", refData.getByIdArticle);
router.post(
  "/addArticle",
  authentication,
  upload.single("banner"),
  refData.registerArticle
);
router.put(
  "/editArticle/:id",
  authentication,
  upload.single("banner"),
  refData.updateArticle
);
router.delete("/delArticle/:id", authentication, refData.deleteArticle);

router.get("/institusi/:id", refData.institusi);
router.get("/glaccBayar", authentication, refData.glaccountPerBayar);
router.post("/imkasSaldo", refData.checkImkas);

//refrentor
router.get("/activity-paket/:id", refData.paket);
router.get("/refrentor", refData.getRefrentor);
router.get("/refrentor-erp", refData.getRefrentorErp);
router.post("/create-refrentor", refData.createRefrentor);
router.put("/update-refrentor/:id", refData.updateRefrentor);
router.delete("/delete-refrentor/:id", refData.deleteRefrentor);

//Reporting
router.get("/gl-account-report", authentication, refData.getReportGlaccount);
router.get("/asnaf-type-report", authentication, refData.getReportAsnafType);
router.get("/program-report", authentication, refData.getReportProgram);
router.get("/aktifitas-report", authentication, refData.getReportAktifitas);
router.get("/zis-report", authentication, refData.getReportZis);
router.get("/wakaf-report", authentication, refData.getReportWakaf);
router.get("/muzzaki-report", authentication, refData.getReportMuzzaki);

//Salam Donasi
router.get("/outlet", refData.getOutlet);
router.post("/register-donasi", refData.registerDonasi);
router.post("/check-payment", refData.checkPay);

//salam donasi erp
router.get("/cso", authentication, refData.getAllCso);
router.put("/update/:id", authentication, refData.updateCso);
router.get("/AllOutlet", authentication, refData.getAllOutlet);
router.get("/AllOutlets", authentication, refData.getAllOutlets);
router.get("/TransOutlet", authentication, refData.getTransaksiPerOutlet);
router.get("/transAllOutlet", refData.getAllTransaksiOutlet);
router.get("/outlet", refData.getOutletByUsername);
router.put("/updateUserOutlet/:id", refData.updateOutletCredentials);
router.post("/create", authentication,refData.createOutlet);
router.put("/updateOutlet/:id", authentication,refData.updateOutlet);
module.exports = router;
