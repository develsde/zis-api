const router = require("express").Router();
const { jurnal } = require("../controllers");
const path = require("path");
const { authentication, authorization } = require("../../config/auth");
const { upload } = require("../helper/upload");

// GET localhost:8080/home => Ambil data semua dari awal
router.get("/jurnalall/:id", authentication, jurnal.jurnalAll);
router.get("/perintahbayar", authentication, jurnal.jurnalPerintahBayar);
router.get("/all", authentication, jurnal.jurnalListAll);
router.get("/category", authentication, jurnal.jurnalCategory);
router.post("/create", authentication, jurnal.createJurnal);
router.post("/create-penerimaan", authentication, jurnal.createJurnalPenerimaan);
router.post("/create-jurnal-manual", authentication, jurnal.createJurnalManual);
router.post("/createjurnalptc", authentication, jurnal.createJurnalPettyCash);

module.exports = router;
