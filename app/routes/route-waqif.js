const router = require("express").Router();
const waqif = require("../controllers/controller-wakif");
const { authentication } = require("../../config/auth");
const { upload } = require("../helper/upload");
//const { validateFields } = require("../middleware/middleware-mustahiq");

router.post("/update-profile", authentication, waqif.create); 
router.post("/register", authentication, waqif.createWakafReg); 
//router.get("/detail/:id", authentication, waqif.getWaqifById); 
router.post("/transaction", authentication, waqif.createWakafTransactions); 
router.get("/all", authentication, waqif.getAllDataWakaf); 
router.get("/detail/:id", authentication, waqif.detailWaqif); 

module.exports = router;
