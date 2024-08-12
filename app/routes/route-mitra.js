const router = require("express").Router();
const mitra = require("../controllers/controller-mitra");
const { authentication } = require("../../config/auth");
const { upload } = require("../helper/upload");
//const { validateFields } = require("../middleware/middleware-mustahiq");

router.post("/update-profile", authentication, mitra.create); 
router.post("/register", authentication, upload.single("proposal") , mitra.createMitraReg); 
router.get("/detail/:id", authentication, mitra.getMitraById); 
router.put("/tarik/:id", authentication, mitra.penarikanMitra); 
// router.post("/transaction", authentication, waqif.createWakafTransactions); 
// router.get("/all", authentication, waqif.getAllDataWakaf); 
// router.get("/detail/:id", authentication, waqif.detailWaqif);


//start here for ERP
router.get("/all-recap", authentication, mitra.getAllProcessMitraProposalRecap);
router.get("/all-process", authentication, mitra.getAllProcessMitraProposal);
router.post("/approved", authentication, mitra.approvalProposal);
router.get("/all-approver", authentication, mitra.getAllApproverMitraProposal);
router.put("/update/:id", authentication, mitra.updateStatusMitra);
router.put("/updateApproved/:id", authentication, mitra.updateApproved);
router.post("/update-profile-erp", authentication, mitra.createErp); 
router.post("/register-erp", authentication, upload.single("proposal") , mitra.createMitraRegErp); 
router.get("/mitra-bayar", authentication, mitra.getMitraTarikDana);
router.get("/mitra-terbayar", authentication, mitra.getMitraTerbayar);
router.get("/done/:id", authentication, mitra.sudahBayar);

module.exports = router;
