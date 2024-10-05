const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");
const CryptoJS = require("crypto-js");

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
    const now = new Date();
    const rfc7231Date = now.toUTCString();
    const timesg = String(+now);
    const username = "zisindosat";
    const { phone_number, id_SOF, price } = req.body;

    const data = {
      PaymentRequest: {
        version: "8.0",
        timestamp: timesg,
        merchantID: "321000000000014",
        uniqueTransactionCode:
          phone_number + Math.floor(new Date().getTime() / 1000),
        currencyCode: "360",
        msisdn: phone_number,
        idSOF: id_SOF,
        trxType: "payment",
        // "shippingcostAmount": "000000022000",
        totalAmount: price.toString().padStart(12, "0"),
        // "discountRule": "0100",
        // "discountAmount": "000000004000",
        // "origingoodsPrice ": "000000020000",
        userDefinedl: "Nacha NGUJI COBAAA",
      },
    };
    const hashedData = CryptoJS.SHA256(data);
    const digested = CryptoJS.enc.Base64.stringify(hashedData);

    const check = await poPost({
      date: rfc7231Date,
      digest: digested,
      url:"/rest/api/sof_payment_only"
    });
    const auth = await Auth();
    try {
      const response = await axios.post("API", data, {
        headers: {
          "Content-Type": "application/json",
          Date: rfc7231Date,
          Authorization: `${auth}:${check}`,
          Username: username,
        },
      });

      return response;
    } catch (error) {
      console.error(
        "Error:",
        error.response ? error.response.data : error.message
      );
      throw error;
    }
  },

  async cancelPay(req, res){
    const now = new Date();
    const rfc7231Date = now.toUTCString();
    const username = "zisindosat";
    const { uniqueID } = req.body;
    const data = {
      VoidRequest: {
        uniqueTransactionCode: uniqueID
      }
    }
    const hashedData = CryptoJS.SHA256(data);
    const digested = CryptoJS.enc.Base64.stringify(hashedData);
    const check = await poPost({
      date: rfc7231Date,
      digest: digested,
      url:"/rest/api/sof_void"
    });
    const auth = await Auth();
    try {
      const response = await axios.post("API", data, {
        headers: {
          "Content-Type": "application/json",
          Date: rfc7231Date,
          Authorization: `${auth}:${check}`,
          Username: username,
        },
      });

      return response;
    } catch (error) {
      console.error(
        "Error:",
        error.response ? error.response.data : error.message
      );
      throw error;
    }
  },

  async infoPay(req, res){
    const now = new Date();
    const rfc7231Date = now.toUTCString();
    const username = "zisindosat";
    const { uniqueID } = req.body;
    const data = {
      checkStatus: {
        uniqueTransactionCode: uniqueID
      }
    }
    const hashedData = CryptoJS.SHA256(data);
    const digested = CryptoJS.enc.Base64.stringify(hashedData);
    const check = await poPost({
      date: rfc7231Date,
      digest: digested,
      url:"/rest/api/checkStatusTrx"
    });
    const auth = await Auth();
    try {
      const response = await axios.post("API", data, {
        headers: {
          "Content-Type": "application/json",
          Date: rfc7231Date,
          Authorization: `${auth}:${check}`,
          Username: username,
        },
      });

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
