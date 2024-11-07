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

// app.post("/payment-success", bodyParser.json({ 
//   strict: false, 
//   verify: (req, res, buf) => {
//     try {
//       req.rawBody = buf.toString();
//     } catch (e) {
//       console.error('Error in body parsing verification:', e);
//       req.rawBody = null;
//     }
//   }
// }), async (req, res) => {
//   try {
//     if (!req.body && !req.rawBody) {
//       console.error('Empty request received');
//       throw new Error('Request body is empty');
//     }

//     const referer = req.get("referer");
//     const origin = req.get("origin");
//     let decodedData;
//     if (req.body.data) {
//       try {
//         decodedData = JSON.parse(
//           Buffer.from(req.body.data, "base64").toString("utf-8")
//         );
//         console.log("Decoded Data:", decodedData);
//       } catch (decodeError) {
//         console.warn("Failed to decode Base64 data:", {
//           error: decodeError.message,
//           base64Content: req.body.data,
//         });
//         throw new Error("Invalid Base64 data");
//       }
//     } else {
//       throw new Error("Missing 'data' field in the request body");
//     }
//     const requestData = {
//       timestamp: new Date().toISOString(),
//       headers: req?.headers,
//       rawBody: req.rawBody,
//       parsedBody: decodedData,
//       config: req?.config,
//       referer: referer,
//       origin: origin
//     };

//     console.log('Payment Success Request:', JSON.stringify(requestData, null, 2));

//     const responseData = {
//       status: "success received"
//     };
//     const base64Data = Buffer.from(JSON.stringify(responseData)).toString("base64");

//     console.log('Successfully processed payment notification:', {
//       timestamp: new Date().toISOString(),
//       responseData: responseData
//     });

//     return res.status(200).json(base64Data);

//   } catch (error) {
//     console.error('Payment Success Error:', {
//       timestamp: new Date().toISOString(),
//       error: {
//         message: error.message,
//         stack: error.stack,
//         name: error.name
//       },
//       requestData: {
//         headers: req?.headers,
//         body: req?.body,
//         config: req?.config,
//         rawBody: req?.rawBody,
//         referer: req.get("referer"),
//         origin: req.get("origin")
//       }
//     });

//     let statusCode = 400;
//     let errorMessage = error.message;

//     if (error.name === 'SyntaxError') {
//       statusCode = 400;
//       errorMessage = 'Invalid JSON format in request';
//     } else if (error.name === 'TypeError') {
//       statusCode = 422;
//       errorMessage = 'Invalid data type in request';
//     } else if (error.message.includes('empty')) {
//       statusCode = 400;
//       errorMessage = 'Request body is empty';
//     }

//     return res.status(statusCode).json({
//       status: "error",
//       timestamp: new Date().toISOString(),
//       error: {
//         message: errorMessage,
//         type: error.name,
//         code: statusCode
//       }
//     });
//   }
// });

app.post("/payment-success", bodyParser.text({
  type: '*/*',
  verify: (req, res, buf) => {
    try {
      req.rawBody = buf.toString();
    } catch (e) {
      console.error('Error in body parsing verification:', e);
      req.rawBody = null;
    }
  }
}), async (req, res) => {
  console.log(req)
  try {
    if (!req.rawBody) {
      console.error('Empty request received');
      throw new Error('Request body is empty');
    }

    const referer = req.get("referer");
    const origin = req.get("origin");
    let decodedData;
    const parsedBody = req.rawBody;
    
    if (parsedBody) {
      try {
        decodedData = JSON.parse(
          Buffer.from(parsedBody, "base64").toString("utf-8")
        );
        console.log("Decoded Data:", decodedData);
      } catch (decodeError) {
        console.warn("Failed to decode Base64 data:", {
          error: decodeError.message,
          base64Content: parsedBody,
        });
        throw new Error("Invalid Base64 data");
      }
    } else {
      throw new Error("Missing 'data' field in the request body");
    }
    
    const requestData = {
      timestamp: new Date().toISOString(),
      headers: req?.headers,
      rawBody: req.rawBody,
      parsedBody: decodedData,
      config: req?.config,
      referer: referer,
      origin: origin
    };

    console.log('Payment Success Request:', JSON.stringify(requestData, null, 2));

    const responseData = {
      status: "success received"
    };
    const base64Data = Buffer.from(JSON.stringify(responseData)).toString("base64");

    console.log('Successfully processed payment notification:', {
      timestamp: new Date().toISOString(),
      responseData: responseData
    });

    return res.status(200).json(base64Data);

  } catch (error) {
    console.error('Payment Success Error:', {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name
      },
      requestData: {
        headers: req?.headers,
        body: req?.body,
        config: req?.config,
        rawBody: req?.rawBody,
        referer: req.get("referer"),
        origin: req.get("origin")
      }
    });

    let statusCode = 400;
    let errorMessage = error.message;

    if (error.name === 'SyntaxError') {
      statusCode = 400;
      errorMessage = 'Invalid JSON format in request';
    } else if (error.name === 'TypeError') {
      statusCode = 422;
      errorMessage = 'Invalid data type in request';
    } else if (error.message.includes('empty')) {
      statusCode = 400;
      errorMessage = 'Request body is empty';
    }

    return res.status(statusCode).json({
      status: "error",
      timestamp: new Date().toISOString(),
      error: {
        message: errorMessage,
        type: error.name,
        code: statusCode
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