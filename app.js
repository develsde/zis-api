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
    origin: ["https://portal.zisindosat.id", "http://localhost:3000", "http://localhost:5173", "https://myerp.zisindosat.id", "https://ipg.artajasa.co.id"],
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

const rawBodySaver = (req, res, buf, encoding) => {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
};

app.post("/payment-success", 
  express.raw({ 
    type: '*/*',
    limit: '50mb',
    verify: rawBodySaver
  }), 
  (req, res) => {
    try {
      console.log('Raw Request Headers:', req?.headers);
      console.log('Raw Request Body:', req?.rawBody);
      
      const referer = req.get("referer");
      const origin = req.get("origin");

      let parsedBody;
      if (req.headers['content-type']?.includes('application/json')) {
        try {
          parsedBody = JSON.parse(req.rawBody);
        } catch (parseError) {
          console.log('JSON Parse Error:', parseError);
          parsedBody = { rawContent: req.rawBody };
        }
      } else {
        parsedBody = { rawContent: req.rawBody };
      }

      const responseData = {
        status: "success received",
        timestamp: new Date().toISOString(),
        receivedData: parsedBody,
        metadata: {
          contentType: req.headers['content-type'],
          origin: origin,
          referer: referer
        }
      };

      const base64Data = Buffer.from(JSON.stringify(responseData)).toString("base64");

      console.log('Successfully processed request');

      return res.status(200).json(base64Data);

    } catch (error) {
      console.error('Payment Processing Error:', {
        error: error.message,
        stack: error.stack,
        headers: req?.headers,
        rawBody: req?.rawBody
      });

      return res.status(400).json({
        status: "error",
        timestamp: new Date().toISOString(),
        error: {
          message: "Failed to process notification",
          details: error.message
        }
      });
    }
});


app.get("/", (req, res) => {
  res.send("Selamat Datang Di Portal ZISWAF Indosat");
});

app.listen(3034, () => {
  console.log("Server Berjalan di Port : 3034");
});