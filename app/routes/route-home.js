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

router.get("/getPaket", home.getPaket);
router.post("/addPaket", home.postPaket)
router.put("/editPaket/:id", home.putPaket)
router.delete("/delPaket/:id", authentication, home.delPaket)
router.get("/getActAdd", authentication, home.getAdditional)
router.get("/getActUser/:id", authentication, home.getActUser)

//lokasi qurban
router.get("/locQurban", home.getLokasiQurban);
router.get("/locQurbanPortal", home.getLokasiQurbanPortal);
router.post("/create-locQurban", home.createLokasiQurban);
router.put("/update-locQurban/:id", home.updateLokasiQurban);
router.delete("/delete-locQurban/:id", home.deleteLokasiQurban);

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
// router.get("/pemesananMegaKonser/:kode_pemesanan", home.getDetailByKodePemesanan)
router.get("/tiketMegaKonser", home.getAllTiket)
router.post("/payment-gateway", home.handlePay)
router.post("/check-payment", home.checkPay)
router.post("/cancel-payment", home.cancelPay)
router.get("/tiket-sold", home.getTiketSold)

//Megakonser ERP
router.get("/tiketMegaKonserErp", home.getAllTiketErp)
router.get("/pemesanan-megakonser-old", home.getPemesananMegakonserLama),
  router.get(
    "/pemesanan-megakonser",
    authentication,
    home.getPemesananMegakonser
  ),
  router.get("/allPemesanan", home.getPemesananMegakonserWithoutPagination),
  router.get(
    "/detail-pemesanan-megakonser/:id",
    authentication,
    home.getDetailPemesananMegakonser
  );
router.get("/resendEmail/:kode_pemesanan", authentication, home.resendEmail);
router.get("/resendEmailVrfp/:order_id", authentication, home.resendEmailVrfp);
router.get(
  "/exportAllDataPemesanan",
  authentication,
  home.exportAllPemesananToExcel
);
router.get(
  "/exporPemesananToExcel/:id",
  authentication,
  home.exportPemesananToExcel
);
router.get(
  "/getPenjualanMegakonser",
  authentication,
  home.getPenjualanMegakonser
);
router.get(
  "/getPenjualanAffiliator",
  authentication,
  home.getPenjualanAffiliator
);
router.get("/getAffiliatorKonser", authentication, home.getAffiliatorKonser);
router.post(
  "/pemesananMegaKonser-erp",
  authentication,
  home.postPemesananMegaKonserErp
);
router.get("/getTiket/:kode_pemesanan", home.getDetailByKodePemesanan);
router.get("/getAllTiket", home.getAllDetails);
router.put("/updateStatusTiket/:id", home.updateDetailStatusById);
router.put("/updateAllStatusTiket", home.updateDetailStatusByIdPemesanan);

//Qurban Report
router.get("/getReportQutab", home.getReportQutab);
router.get("/getReportQuray", home.getReportQuray);
router.get("/LaporanPenjualanQutab", home.getPenjualanQutab);
router.get("/sendEmailQurban/:UTC", home.sendEmailQurban);
router.get("/sendEmailSuccess/:UTC", home.sendEmailQurbanSuccess);

//management affiliator
router.get("/getAffiliatorQurban", home.getAffiliatorQurban);
router.post("/createAffQurban", home.createAffiliatorQurban);
router.put("/update-affQurban/:id", home.updateAffiliatorQurban);
router.get("/getListAfKonser", home.getAffiliatorKonser);
router.post("/createAffiliatorKonser", home.createAffiliatorKonser);
router.put("/updateAffKonser/:id", home.updateAffiliatorKonser);
router.get("/getAffiliatorVrfp", home.getAffiliatorVrfp);
router.post("/createAffVrfp", home.createAffiliatorVrfpr);
router.put("/updateAffVrfp/:id", home.updateAffiliatorVRFP);
module.exports = router;
