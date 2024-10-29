require("dotenv").config();

const express = require("express");
const CryptoJS = require('crypto-js');
const bodyParser = require("body-parser");

const app = express();
const path = require("path");
const cors = require("cors");

const morgan = require("morgan");

app.use(morgan("dev"));

app.use(bodyParser.urlencoded({ extended: true, limit: "100mb", parameterLimit: 50000 }));
app.use(bodyParser.json({ limit: "50mb", extended: true }));


const appRoute = require("./app/routes/route-auth");
const homeRoute = require("./app/routes/route-home");
const userRoute = require("./app/routes/route-account");
const mustahiqRoute = require("./app/routes/route-mustahiq");
const bankRoute = require("./app/routes/route-bank");
const proposalRoute = require("./app/routes/route-proposal");
const jurnal = require("./app/routes/route-jurnal");
const ptcash = require("./app/routes/route-pettycash");
const budget = require("./app/routes/route-budget");
const refRoute = require("./app/routes/route-reference");
const transactionRoute = require("./app/routes/transaction");

const erpAuthRoute = require("./app/routes/route-erp-auth");
const erpProgramRoute = require("./app/routes/route-erp-program");

//wakaf
const waqifRoute = require("./app/routes/route-waqif"); 
const mitraRoute = require("./app/routes/route-mitra");

//dashboard
const dashboardRoute = require("./app/routes/route-dashboard");


//payment
const paymentRoute = require("./app/routes/route-payment");


console.log(path.join(__dirname, "uploads"));

app.use("/public/uploads", express.static(path.join(__dirname, "uploads/")));

app.use(
  cors({
    origin: ["https://portal.zisindosat.id", "http://localhost:3000", "http://localhost:5173", "https://myerp.zisindosat.id"],
  })
);
app.use("/auth", appRoute);
app.use("/home", homeRoute);
app.use("/user", userRoute);
app.use("/mustahiq", mustahiqRoute);
app.use("/bank", bankRoute);
app.use("/ref", refRoute);
app.use("/proposal", proposalRoute);
app.use("/jurnal", jurnal);
app.use("/ptcash", ptcash);
app.use("/budget", budget);
app.use("/transaction", transactionRoute);

//ERP
app.use("/erpauth", erpAuthRoute);
app.use("/erpprogram", erpProgramRoute);

//Wakaf
app.use("/wakaf", waqifRoute);
app.use("/mitra", mitraRoute);

//Dashboard-New ERP Purposes
app.use("/dashboard", dashboardRoute);

//paymentroute
app.use("/payment", paymentRoute);

app.get("/payment-success", (req, res) => {
  const referer = req.get("referer");
  const origin = req.get("origin");

  console.log("Referer:", referer);
  console.log("Origin:", origin);

  const responseData = { status: "success received" };
  const base64Data = CryptoJS.enc.Base64.stringify(responseData);

  res.status(200).json({ data: base64Data });
});

app.get("/", (req, res) => {
  res.send("Selamat Datang Di Portal ZISWAF Indosat");
});

app.listen(3034, () => {
  console.log("Server Berjalan di Port : 3034");
});