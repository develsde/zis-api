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

//     // Step 1: Check if 'data' field exists in the body
//     if (req.body.data) {
//       // Step 2: Decode the Base64 'data' field
//       try {
//         const decodedBase64 = Buffer.from(req.body.data, "base64").toString("utf-8");
//         console.log("Decoded Base64 Data:", decodedBase64);

//         // Step 3: Parse the decoded string as JSON
//         try {
//           decodedData = JSON.parse(decodedBase64);
//           console.log("Decoded Data:", decodedData);
//         } catch (parseError) {
//           console.warn("Failed to parse decoded data:", {
//             error: parseError.message,
//             decodedData: decodedBase64,
//           });
//           throw new Error("Invalid JSON format after decoding Base64 data");
//         }

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
  

// app.post("/payment-success", bodyParser.text({
//   type: '*/*',
//   verify: (req, res, buf) => {
//     try {
//       req.rawBody = buf.toString();
//     } catch (e) {
//       console.error('Error in body parsing verification:', e);
//       req.rawBody = null;
//     }
//   }
// }), async (req, res) => {
//   console.log(req)
//   try {
//     if (!req.rawBody) {
//       console.error('Empty request received');
//       throw new Error('Request body is empty');
//     }

//     const referer = req.get("referer");
//     const origin = req.get("origin");
//     let decodedData;
//     const parsedBody = req.rawBody;
    
//     if (parsedBody) {
//       try {
//         decodedData = JSON.parse(
//           Buffer.from(parsedBody, "base64").toString("utf-8")
//         );
//         console.log("Decoded Data:", decodedData);
//       } catch (decodeError) {
//         console.warn("Failed to decode Base64 data:", {
//           error: decodeError.message,
//           base64Content: parsedBody,
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

app.post(
  "/payment-success",
  bodyParser.text({
    type: "*/*",
    verify: (req, res, buf) => {
      try {
        req.rawBody = buf.toString();
      } catch (e) {
        console.error("Error in body parsing verification:", e);
        req.rawBody = null;
      }
    },
  }),
  async (req, res) => {
    try {
      // Pastikan rawBody tersedia
      if (!req.rawBody) {
        console.error("Empty request received");
        throw new Error("Request body is empty");
      }

      let decodedData;
      const base64Content = req.rawBody;

      if (base64Content) {
        try {
          // Langkah pertama: lakukan decode dari Base64, kemudian parse ke JSON
          const utf8DecodedData = Buffer.from(base64Content, "base64").toString("utf-8");
          console.log("mentah:", base64Content);
          console.log("setengah", utf8DecodedData);
          decodedData = JSON.parse(utf8DecodedData);
          console.log("Decoded Data:", decodedData);
        } catch (decodeError) {
          console.warn("Failed to decode Base64 data:", {
            error: decodeError.message,
            base64Content: base64Content,
          });
          throw new Error("Invalid Base64 data");
        }
      } else {
        throw new Error("Missing 'data' field in the request body");
      }

      // Struktur data request untuk logging atau debugging
      const requestData = {
        timestamp: new Date().toISOString(),
        headers: req?.headers,
        rawBody: req.rawBody,
        parsedBody: decodedData,
      };

      console.log("Payment Success Request:", JSON.stringify(requestData, null, 2));

      // Response sukses
      const responseData = {
        status: "success received",
      };
      const base64Response = Buffer.from(JSON.stringify(responseData)).toString("base64");

      console.log("Successfully processed payment notification:", {
        timestamp: new Date().toISOString(),
        responseData: responseData,
      });

      // Kirimkan response dalam format Base64
      return res.status(200).json({ response: base64Response });
    } catch (error) {
      console.error("Payment Success Error:", {
        timestamp: new Date().toISOString(),
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        requestData: {
          headers: req?.headers,
          body: req?.body,
          rawBody: req?.rawBody,
        },
      });

      let statusCode = 400;
      let errorMessage = error.message;

      if (error.name === "SyntaxError") {
        statusCode = 400;
        errorMessage = "Invalid JSON format in request";
      } else if (error.message.includes("empty")) {
        statusCode = 400;
        errorMessage = "Request body is empty";
      }

      // Kirim response error dengan status dan informasi yang jelas
      return res.status(statusCode).json({
        status: "error",
        timestamp: new Date().toISOString(),
        error: {
          message: errorMessage,
          type: error.name,
          code: statusCode,
        },
      });
    }
  }
);

// Middleware untuk rute selain "/payment-success"
// Middleware JSON hanya untuk rute selain "/payment-success"
// app.use((req, res, next) => {
//   if (req.path !== "/payment-success") {
//     express.json()(req, res, next);
//   } else {
//     next();
//   }
// });

// // Rute "/payment-success" untuk menangani data Base64
// app.post(
//   "/payment-success",
//   express.raw({
//     type: "*/*",
//     verify: (req, res, buf) => {
//       try {
//         req.rawBody = buf.toString();
//       } catch (e) {
//         console.error("Kesalahan dalam verifikasi parsing body:", e);
//         req.rawBody = null;
//       }
//     },
//   }),
//   async (req, res) => {
//     try {
//       if (!req.rawBody) {
//         throw new Error("Badan permintaan kosong");
//       }

//       let decodedData;
//       const base64Content = req.rawBody;

//       if (base64Content) {
//         try {
//           // Decode Base64 ke UTF-8, lalu parsing ke JSON
//           const utf8DecodedData = Buffer.from(base64Content, "base64").toString("utf-8");
//           console.log("Konten Base64 Mentah:", base64Content);
//           console.log("Konten Terdecode UTF-8:", utf8DecodedData);
//           decodedData = JSON.parse(utf8DecodedData);
//           console.log("Data Terparse:", decodedData);
//         } catch (decodeError) {
//           console.warn("Gagal mendecode data Base64:", {
//             error: decodeError.message,
//             base64Content,
//           });
//           throw new Error("Data Base64 tidak valid");
//         }
//       } else {
//         throw new Error("Badan permintaan hilang atau konten Base64 tidak valid");
//       }

//       console.log("Permintaan Payment Success:", {
//         timestamp: new Date().toISOString(),
//         headers: req.headers,
//         rawBody: req.rawBody,
//         parsedBody: decodedData,
//       });

//       // Mengirimkan respon sukses dalam format Base64
//       const responseData = { status: "berhasil diterima" };
//       const base64Response = Buffer.from(JSON.stringify(responseData)).toString("base64");

//       console.log("Berhasil memproses notifikasi pembayaran:", {
//         timestamp: new Date().toISOString(),
//         responseData,
//       });

//       return res.status(200).json({ response: base64Response });
//     } catch (error) {
//       console.error("Kesalahan Payment Success:", {
//         timestamp: new Date().toISOString(),
//         error: {
//           message: error.message,
//           stack: error.stack,
//           name: error.name,
//         },
//         requestData: {
//           headers: req.headers,
//           body: req.body,
//           rawBody: req.rawBody,
//         },
//       });

//       let statusCode = 400;
//       let errorMessage = error.message;

//       if (error.name === "SyntaxError") {
//         errorMessage = "Format JSON tidak valid dalam permintaan";
//       } else if (error.message.includes("kosong")) {
//         errorMessage = "Badan permintaan kosong";
//       }

//       return res.status(statusCode).json({
//         status: "error",
//         timestamp: new Date().toISOString(),
//         error: {
//           message: errorMessage,
//           type: error.name,
//           code: statusCode,
//         },
//       });
//     }
//   }
// );




// // Middleware global yang menonaktifkan express.json() untuk rute "/payment-success"
// app.use((req, res, next) => {
//   if (req.path !== "/payment-success") {
//     express.json()(req, res, next);  // Parsing JSON hanya untuk route selain "/payment-success"
//   } else {
//     next();
//   }
// });

// Rute "/payment-success" khusus untuk menerima plain text dengan header JSON
// app.post(
//   "/payment-success",
//   express.raw({ type: "*/*" }), // Menangani semua tipe konten sebagai teks mentah
//   async (req, res) => {
//     try {
//       if (!req.body) {
//         throw new Error("Body kosong atau tidak valid");
//       }

//       let decodedData;
//       const base64Content = req.body.toString(); // Ambil body sebagai string

//       try {
//         // Decode dari Base64 ke UTF-8, kemudian parsing ke JSON
//         const utf8DecodedData = Buffer.from(base64Content, "base64").toString("utf-8");
//         console.log("Data Terdecode UTF-8:", utf8DecodedData);
//         decodedData = JSON.parse(utf8DecodedData); // Parsing string UTF-8 sebagai JSON
//       } catch (decodeError) {
//         console.error("Gagal mendecode data Base64:", decodeError);
//         throw new Error("Data Base64 tidak valid atau JSON tidak valid");
//       }

//       console.log("Data Callback Diterima:", decodedData);

//       // Respon sukses
//       const responseData = { status: "berhasil diterima" };
//       const base64Response = Buffer.from(JSON.stringify(responseData)).toString("base64");

//       return res.status(200).json({ response: base64Response });
//     } catch (error) {
//       console.error("Kesalahan dalam memproses callback:", error);

//       return res.status(400).json({
//         status: "error",
//         error: {
//           message: error.message,
//           type: error.name,
//         },
//       });
//     }
//   }
// );


app.get("/", (req, res) => {
  res.send("Selamat Datang Di Portal ZISWAF Indosat");
});

app.listen(3034, () => {
  console.log("Server Berjalan di Port : 3034");
});