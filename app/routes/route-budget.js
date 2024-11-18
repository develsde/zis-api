const router = require("express").Router();
const { budget } = require("../controllers");
const path = require("path");
const { authentication, authorization } = require("../../config/auth");
const { upload } = require("../helper/upload");

// GET localhost:8080/home => Ambil data semua dari awal
router.get("/programlist" , budget.programList);
router.get("/all", authentication, budget.allBudgetData);
router.post("/create", authentication, budget.createBudget);
router.put("/update/:id", authentication, budget.updateBudget);
router.delete("/delete", authentication, budget.deleteBudget);


module.exports = router;
