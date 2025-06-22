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
    const date = new Date().toString();
    const timesg = moment()
      .utcOffset(7 * 60)
      .format("DDMMYYHHmmss");

    const username = "zisindosat";
    const { phone_number, id_SOF, price } = req.body;

    try {
      const datas = {
        PaymentRequest: {
          version: "8.0",
          timeStamp: timesg,
          merchantID: "321000000000014",
          uniqueTransactionCode: Math.random()
            .toString()
            .slice(2, 14)
            .padStart(12, "0"),
          currencyCode: "360",
          msisdn: phone_number,
          idSOF: id_SOF,
          trxType: "paymentonly",
          shippingcostAmount: "000000022000",
          totalAmount: price.toString().padStart(12, "0"),
          discountRule: "0100",
          discountAmount: "000000004000",
          origingoodsPrice: "000000020000",
          userDefinedl: "ZIS INDOSAT",
        },
      };

      // Log JSON body request sebelum dikirim
      console.log("🔹 Body request (JSON):", JSON.stringify(datas, null, 2));

      const str_data = JSON.stringify(datas);
      const hashedData = CryptoJS.SHA256(str_data);
      const digested = CryptoJS.enc.Hex.stringify(hashedData);
      const digestUTF = CryptoJS.enc.Utf8.parse(digested);

      let base64 = CryptoJS.enc.Base64.stringify(digestUTF)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      // Log Base64 body request
      console.log("🔹 Body request (Base64):", base64);

      const check = await poPost({
        date: date,
        digest: base64,
        url: "/rest/api/sof_payment_only",
      });
      const auth = await Auth();

      const data = CryptoJS.enc.Base64.stringify(
        CryptoJS.enc.Utf8.parse(str_data)
      );

      // Log body dan header yang akan dikirim ke API
      console.log("🔹 Request body yang dikirim (Base64):", data);
      console.log("🔹 Header yang dikirim:", {
        "Content-Type": "application/json",
        Date: date,
        Authorization: `${auth}:${check}`,
        Username: username,
      });

      // Log request yang dikirim ke URL
      console.log(
        "🔹 Mengirim request ke URL:",
        // "https://im3.artajasa.co.id:9443/rest/api/sof_payment_only"
        // "https://ipg.artajasa.co.id:3067/rest/api/sof_payment_only"  //prod
        "https://im3.artajasa.co.id:20443/rest/api/sof_payment_only"
      );

      const response = await axios.post(
        // "https://im3.artajasa.co.id:9443/rest/api/sof_payment_only",
        // "https://ipg.artajasa.co.id:3067/rest/api/sof_payment_only", //prod
        "https://im3.artajasa.co.id:20443/rest/api/sof_payment_only",
        data,
        {
          headers: {
            "Content-Type": "application/json",
            Date: date,
            Authorization: `${auth}:${check}`,
            Username: username,
          },
        }
      );

      console.log("🔹 Response dari API:", response.data);

      // Decode Base64 Response if needed
      if (response.data && typeof response.data === "string") {
        const decodedResult = Buffer.from(response.data, "base64").toString(
          "utf-8"
        );
        console.log("🔹 Decoded Response:", decodedResult);

        const dataku = JSON.parse(decodedResult);
        if (dataku?.SendPaymentResp) {
          console.log("🔹 Data dari API:", dataku);
          const kemem = await prisma.log_aj.create({
            data: {
              uniqueCode: dataku.SendPaymentResp.uniqueTransactionCode,
              ammount: dataku.SendPaymentResp.amount,
            },
          });
          console.log("🔹 Harga:", kemem);
        } else {
          console.error(
            "⚠️ SendPaymentResp tidak ditemukan dalam decoded response"
          );
        }

        return {
          success: true,
          message: "Payment processed successfully",
          data: dataku,
        };
      } else {
        console.log("⚠️ Response bukan format Base64:", response.data);
        if (response.data?.SendPaymentResp) {
          await prisma.log_aj.create({
            data: {
              uniqueCode: response.data.SendPaymentResp.uniqueTransactionCode,
              ammount: response.data.SendPaymentResp.amount,
            },
          });
        } else {
          console.error(
            "⚠️ SendPaymentResp tidak ditemukan dalam raw response"
          );
        }

        return {
          success: true,
          message: "Payment processed successfully",
          data: response.data,
        };
      }
    } catch (error) {
      console.error("🚨 Error Details:", {
        headers: error.config?.headers || "No headers",
        method: error.config?.method || "No method",
        url: error.config?.url || "No URL",
        data: error.config?.data || "No data",
        error: error.response?.data || "No response data",
        message: error.message,
      });

      // Return error details as JSON
      return {
        success: false,
        message: "An error occurred during payment processing",
        error: error.response?.data || error.message,
      };
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
    const date = new Date().toString();
    const timesg = moment().format("DDMMYYHHmmss");
    const username = "zisindosat";
    const { uniqueID } = req.body;
    const datas = {
      checkStatus: {
        uniqueTransactionCode: uniqueID,
      },
    };
    const str_data = JSON.stringify(datas);
    const hashedData = CryptoJS.SHA256(str_data);
    const digested = CryptoJS.enc.Hex.stringify(hashedData);
    const digestUTF = CryptoJS.enc.Utf8.parse(digested);
    let base64 = CryptoJS.enc.Base64.stringify(digestUTF)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
    const check = await poPost({
      date: date,
      digest: base64,
      url: "/rest/api/checkStatusTrx",
    });
    const auth = await Auth();
    const data = CryptoJS.enc.Base64.stringify(
      CryptoJS.enc.Utf8.parse(str_data)
    );
    console.log("lihat data utc", data);

    try {
      const response = await axios.post(
        // "https://im3.artajasa.co.id:9443/rest/api/checkStatusTrx",
        // "https://ipg.artajasa.co.id:3067/rest/api/checkStatusTrx", //prod
        "https://im3.artajasa.co.id:20443/rest/api/checkStatusTrx",
        data,
        {
          headers: {
            "Content-Type": "application/json",
            Date: date,
            Authorization: `${auth}:${check}`,
            Username: username,
          },
        }
      );

      // Periksa apakah response berupa JSON
      if (
        response.headers["content-type"] &&
        response.headers["content-type"].includes("application/json")
      ) {
        console.log("Response is JSON");
        console.log("response callback", response.data);
      } else {
        console.error("Response is not JSON:", response.data);
        return res
          .status(500)
          .json({ success: false, message: "Invalid response format" });
      }

      if (response.data && typeof response.data === "string") {
        const decodedResult = Buffer.from(response.data, "base64").toString(
          "utf-8"
        );
        console.log("Decoded Response:", decodedResult);
        const dataku = JSON.parse(decodedResult);
        console.log("icun", dataku);

        const aj = await prisma.log_aj.findFirst({
          where: {
            uniqueCode: dataku.checkStatusResp.uniqueTransactionCode,
          },
        });

        if (!aj) {
          return res
            .status(404)
            .json({ message: "Transaction Code Tidak Ditemukan" });
        }

        const data = await prisma.log_aj.update({
          where: {
            id_aj: aj.id_aj,
          },
          data: {
            timestampt: dataku.checkStatusResp.timeStamp,
            merchantId: dataku.checkStatusResp.merchantId,
            respCode: dataku.checkStatusResp.respCode,
            ammount: dataku.checkStatusResp.amt,
            uniqueCode: dataku.checkStatusResp.uniqueCode,
            transRef: dataku.checkStatusResp.transRef,
            date_time: dataku.checkStatusResp.dateTime,
            status: dataku.checkStatusResp.status,
            fail_resson: dataku.checkStatusResp.failReason,
            status_notify_sof: dataku.checkStatusResp.statusNotifySOF,
            status_transaction: dataku.checkStatusResp.statusTransaction,
            status_transaction: dataku.checkStatusResp.status_transaction,
          },
        });
        console.log("infopay", data);

        return res.status(200).json({
          success: true,
          message: "Payment processed successfully",
          data: JSON.parse(decodedResult),
        });
      } else {
        console.log("Response is not a Base64-encoded string:", response.data);

        return res.status(200).json({
          success: true,
          message: "Payment processed successfully",
          data: response.data,
        });
      }
    } catch (error) {
      console.error(
        "Error:",
        error.response ? error.response.data : error.message
      );
      return res.status(500).json({
        success: false,
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },
};
