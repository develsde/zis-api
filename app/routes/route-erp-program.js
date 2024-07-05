const router = require("express").Router();
const { programerp } = require("../controllers");
const path = require("path");
const { authentication, authorization } = require("../../config/auth");
const { upload } = require("../helper/upload");

// GET localhost:8080/home => Ambil data semua dari awal
router.get("/all", authentication, programerp.getAllProgram);
router.get("/allDetail", authentication, programerp.getAllProgramDetail);
router.get("/detail/:id", authentication, programerp.getProgramById);
router.get("/banner", authentication, programerp.getBanner);
router.post("/create", authentication, upload.single("banner"), programerp.registerProgram);
router.put("/update/:id", authentication, upload.single("banner"), programerp.updateProgram);
router.put("/verif/:id", authentication, programerp.verifiedProgram);
router.put("/updatehasnaf/:id", authentication, programerp.updateKategoriPenyaluran);
// router.put("/create-form/:id", authentication, programerp.createForm);


module.exports = router;
