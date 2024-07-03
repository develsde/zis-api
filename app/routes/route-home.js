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

module.exports = router;
