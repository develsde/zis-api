const router = require("express").Router();
const { home } = require("../controllers");
const path = require("path");
const { authentication, authorization } = require("../../config/auth");
const { upload } = require("../helper/upload");
var fs = require('fs');

// GET localhost:8080/home => Ambil data semua dari awal
router.get("/program", home.getAllProgram);
router.get("/banner", home.getBanner);
router.get("/program/:id", home.getProgramById);
router.post("/createprogram", authentication, upload.single("banner"), home.registerProgram);
router.get("/formAct/:id", home.getFormAct);
router.post("/sendAct", home.postFormAct);
router.get("/regAct/:id", home.getRegAct);
router.post("/postMidTrans", home.postMidTrans);
router.post("/act-add", home.postAdditionalActivity)

router.post("/addPaket", home.postPaket)
router.put("/editPaket/:id", home.putPaket)
router.delete("/delPaket/:id", authentication, home.delPaket)
router.get("/getActAdd", authentication, home.getAdditional)
router.get("/getActUser/:id", authentication, home.getActUser)

router.get("/rajaOngkirProv", home.checkProv)
router.get("/rajaOngkirCities/:id", home.checkCities)
router.get("/rajaOngkirKec/:id", home.checkKec)
router.post("/rajaOngkirBayar", home.checkOngkir)
router.get("/checkStat/:id", home.checkStat)

router.get("/getPenjualan", authentication, home.getPenjualan)

router.get("/getAllActUser/", authentication, home.getAllActUser)
router.get("/rajaOngkirKota/:id", home.rajaOngkirKota)
router.get("/getRef/", home.getRef)
router.post("/loh", home.loh)

router.post("/postQurban", home.postQurban)

//Megakonser Portal
router.post("/pemesananMegaKonser", home.postPemesananMegaKonser)
router.get("/pemesananMegaKonser/:order_id", home.getPemesananByOrder)
router.get("/tiketMegaKonser", home.getAllTiket)
router.post("/payment-gateway", home.handlePay)
router.post("/check-payment", home.checkPay)
router.post("/cancel-payment", home.cancelPay)
router.get("/tiket-sold", home.getTiketSold)

//Megakonser ERP
router.get("/pemesanan-megakonser", home.getPemesananMegakonser)
router.get("/detail-pemesanan-megakonser/:id", home.getDetailPemesananMegakonser)

module.exports = router;
