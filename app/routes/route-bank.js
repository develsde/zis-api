const router = require('express').Router();
const { bank } = require('../controllers');
const path = require("path");
const multer  = require('multer')
//const dest = path.resolve(__dirname, "../../uploads/");
//const upload = multer({ dest: dest })
const { upload } = require("../helper/upload");
const { authentication, authorization } = require("../../config/auth");
const fs = require("fs/promises");


// GET localhost:8080/home => Ambil data semua dari awal
router.post('/mt940', authentication, bank.getDataMt940);
router.post('/imkas', authentication, bank.getDataImkas);
router.put('/identified', authentication, bank.updateStatusMT);
router.get('/alldata/:id', authentication, bank.dataMt940);
router.get('/allimkas/:id', authentication, bank.dataImkasDetail);
router.get('/allfile', authentication, bank.dataFileMt940);
router.get('/list', authentication, bank.listbank);
router.get('/listgla', authentication, bank.listGla);
router.get('/listproposal', authentication, bank.listProposal);

router.post("/upload", authentication, upload.single("statement"), bank.statementCreate);


module.exports = router;
