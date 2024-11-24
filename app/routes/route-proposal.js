const router = require("express").Router();
const { proposal } = require("../controllers");
const path = require("path");
const { authentication, authorization } = require("../../config/auth");
const { upload } = require("../helper/upload");

// GET localhost:8080/home => Ambil data semua dari awal
router.post(
  "/create",
  authentication,
  upload.fields([
    { name: "lampiran1", maxCount: 1 },
    { name: "lampiran2", maxCount: 1 },
    { name: "lampiran3", maxCount: 1 },
    { name: "lampiran4", maxCount: 1 },
    { name: "lampiran5", maxCount: 1 },
    { name: "lampiran6", maxCount: 1 },
    { name: "lampiran7", maxCount: 1 },
  ]),
  proposal.createProposal
);
router.get("/details/:id", authentication, proposal.detailProposal);
router.get("/all", authentication, proposal.getAllProposal);
router.get("/all-bayar", authentication, proposal.getAllProposalBayar);
router.get("/all-paid", authentication, proposal.getAllProposalPaid);
router.get("/all-validation", authentication, proposal.getAllPenyaluranValidation);
router.get("/all-process", authentication, proposal.getAllProcessProposal);
router.get("/all-approver", authentication, proposal.getAllApproverProposal);
router.get("/penyaluranAll", authentication, proposal.kategoriPenyaluran);
router.post("/approved", authentication, proposal.approvalProposal);
router.put("/done/:id", authentication, proposal.doneProposal);
router.put("/bayar/:id", authentication, proposal.sudahBayar);
router.post("/update/:id", authentication, proposal.updateProposal);
router.put("/identified/:id", authentication, proposal.updateKategoriPenyaluran);
//router.post("/upload", authentication, upload.single("lampiran"), proposal.registerProgram);
router.post(
  "/create-erp",
  authentication,
  upload.fields([
    { name: "lampiran1", maxCount: 1 },
    { name: "lampiran2", maxCount: 1 },
    { name: "lampiran3", maxCount: 1 },
    { name: "lampiran4", maxCount: 1 },
    { name: "lampiran5", maxCount: 1 },
    { name: "lampiran6", maxCount: 1 },
    { name: "lampiran7", maxCount: 1 },
  ]),
  proposal.createProposalErp
);

module.exports = router;
