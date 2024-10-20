const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");
const CryptoJS = require("crypto-js");
const moment = require("moment");

const { customAlphabet } = require("nanoid");
const { z } = require("zod");
const axios = require("axios");
const {
  Auth,
  sofdigest_sign_id,
  postData,
  poPost,
} = require("../helper/artajasa_bersamapay");

module.exports = {
  async getAuthAJ(req, res) {
    try {
      const check = await Auth();
      console.log(check);

      return res.status(200).json({
        message: "Sukses",
        data: check,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async digestBase64Data(req, res) {
    try {
      const check = await sofdigest_sign_id();
      console.log(check);

      return res.status(200).json({
        message: "Sukses",
        data: check,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async signin(req, res) {
    try {
      const check = await postData();
      console.log(check);

      return res.status(200).json({
        message: "Sukses",
        data: check,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async reqPay(req, res) {
    // const now = new Date();
    // const rfc7231Date = now.toUTCString();
    // const timesg = String(+now);

    const date = (new Date()).toString();
    const timesg = moment().format("DDMMYYHHmmss") 
    const username = "zisindosat";
    const { phone_number, id_SOF, price } = req.body;

    const datas = {
      PaymentRequest: {
        "version": "8.0",
        "timeStamp": timesg,
        "merchantID": "321000000000014",
        "uniqueTransactionCode": Math.random().toString().slice(2, 14).padStart(12, '0'),
        "currencyCode": "360",
        "msisdn": phone_number,
        "idSOF": id_SOF,
        "trxType": "paymentonly",
        "shippingcostAmount": "000000022000",
        "totalAmount": price.toString().padStart(12, "0"),
        "discountRule": "0100",
        "discountAmount": "000000004000",
        "origingoodsPrice": "000000020000",
        "userDefinedl": "Nacha NGUJI COBAAA",
      },
    };
    const str_data = JSON.stringify(datas)
    console.log(str_data);
    const hashedData = CryptoJS.SHA256(str_data);
    const digested = CryptoJS.enc.Hex.stringify(hashedData);

    const digestUTF = CryptoJS.enc.Utf8.parse(digested)

    var base64 = CryptoJS.enc.Base64.stringify(digestUTF)

    base64 = base64.replace(/\+/gi, '-').replace(/\//gi, '_').replace(/\=/gi, '');
    console.log("Base " + base64);
    
    const check = await poPost({
      date: date,
      digest: base64,
      url:"/rest/api/sof_payment_only"
    });
    const auth = await Auth();

    const data = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(str_data))
    
    try {
      const response = await axios.post("https://im3.artajasa.co.id:9443/rest/api/sof_payment_only", 
        data, 
      {
        headers: {
          "Content-Type": "application/json",
          Date: date,
          Authorization: `${auth}:${check}`,
          Username: username,
        },
      });

      if (response.data && typeof response.data == "string") {
        const decodedResult = Buffer.from(response.data, "base64").toString("utf-8");
        console.log("Decoded Response:", decodedResult);
        return decodedResult;
      } else {
        console.log("Response is not a Base64-encoded string:", response.data);
        return response.data; // Return as-is if it's not Base64
      }
    } catch (error) {
      // console.error(
      //   "Error:",
      //   error.response ? error.response.data : error.message
      // );
      const errorDetails = {
        headers: error.config?.headers, 
        method: error.config?.method, 
        url: error.config?.url, 
        data: error.config?.data, 
        error: error.response?.data,
        message: error.message 
    };
      // throw new Error(JSON.stringify(errorDetails));
      console.log("Error Details:", errorDetails);
    }
  },

  async cancelPay(req, res) {
    const now = new Date();
    const rfc7231Date = now.toUTCString();
    const username = "zisindosat";
    const { uniqueID } = req.body;
    const data = {
      VoidRequest: {
        uniqueTransactionCode: uniqueID,
      },
    };
    const hashedData = CryptoJS.SHA256(data);
    const digested = CryptoJS.enc.Base64.stringify(hashedData);
    const check = await poPost({
      date: rfc7231Date,
      digest: digested,
      url: "/rest/api/sof_void",
    });
    const auth = await Auth();
    try {
      const response = await axios.post(
        "https://im3.artajasa.co.id:9443/rest/api/sof_void",
        data,
        {
          headers: {
            "Content-Type": "application/json",
            Date: rfc7231Date,
            Authorization: `${auth}:${check}`,
            Username: username,
          },
        }
      );

      return response;
    } catch (error) {
      console.error(
        "Error:",
        error.response ? error.response.data : error.message
      );
      throw error;
    }
  },

  async infoPay(req, res) {
    const now = new Date();
    const rfc7231Date = now.toUTCString();
    const username = "zisindosat";
    const { uniqueID } = req.body;
    const data = {
      checkStatus: {
        uniqueTransactionCode: uniqueID,
      },
    };
    const hashedData = CryptoJS.SHA256(data);
    const digested = CryptoJS.enc.Base64.stringify(hashedData);
    const check = await poPost({
      date: rfc7231Date,
      digest: digested,
      url: "/rest/api/checkStatusTrx",
    });
    const auth = await Auth();
    try {
      const response = await axios.post(
        "https://im3.artajasa.co.id:9443/rest/api/checkStatusTrx",
        data,
        {
          headers: {
            "Content-Type": "application/json",
            Date: rfc7231Date,
            Authorization: `${auth}:${check}`,
            Username: username,
          },
        }
      );

      return response;
    } catch (error) {
      console.error(
        "Error:",
        error.response ? error.response.data : error.message
      );
      throw error;
    }
  },
};
