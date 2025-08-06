const { prisma } = require("../../prisma/client");
const CryptoJS = require("crypto-js");
const moment = require("moment");
const momentTimezone = require('moment-timezone');

const axios = require("axios");
const {
  Auth,
  sofdigest_sign_id,
  postData,
  poPost,
} = require("../helper/artajasa_bersamapay");
const { InquiryAJ, TransferAJ, TransferInquiryAJ, StatusAJ, BalanceAJ } = require("../helper/artajasa");

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

  async cancelPay(uniqueID) {
    try {
      const now = new Date();
      const timestampHeader = now.toUTCString();
      const secret = "secret"; // GANTI dengan secret yang benar
      const username = "zisindosat";

      const data = {
        VoidRequest: {
          uniqueTransactionCode: uniqueID,
        },
      };

      const uri = "/rest/api/sof_void";
      const method = "POST";

      const client_id_hmac = CryptoJS.HmacSHA256(username, secret);
      let client_id_hash = CryptoJS.enc.Base64.stringify(client_id_hmac)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      const jsonString = JSON.stringify(data);
      const sha256digest = CryptoJS.SHA256(jsonString);
      const sha256 = CryptoJS.enc.Hex.stringify(sha256digest);
      const wordArray = CryptoJS.enc.Utf8.parse(sha256);
      let content_digest = CryptoJS.enc.Base64.stringify(wordArray)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      const string_to_sign = `${method}\n${timestampHeader}\n${uri}\n${content_digest}`;

      const hmac_signature = CryptoJS.HmacSHA256(string_to_sign, secret);
      let base64_encoded_hmac_signature = CryptoJS.enc.Base64.stringify(
        hmac_signature
      )
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      const authorizationHeader = `${client_id_hash}:${base64_encoded_hmac_signature}`;

      const base64Body = Buffer.from(jsonString).toString("base64");

      console.log("📦 Base64 Body yang dikirim ke Artajasa:", base64Body);

      const response = await axios.post(
        "https://im3.artajasa.co.id:20443/rest/api/sof_void",
        base64Body,
        {
          headers: {
            "Content-Type": "application/json",
            Date: timestampHeader,
            Authorization: authorizationHeader,
            Username: username,
          },
        }
      );

      // decode base64 response.data jadi string
      const decoded = Buffer.from(response.data, "base64").toString("utf-8");

      // parsing string jadi object JSON
      const jsonResponse = JSON.parse(decoded);

      console.log("📥 Response decoded dari Artajasa:", jsonResponse);

      return response.data;
    } catch (error) {
      // Pastikan log error jelas dan tidak menyebabkan error tambahan
      const errorMsg =
        error.response?.data || error.message || error.toString();
      console.error("🔴 Gagal membatalkan di Artajasa:", errorMsg);
      throw error; // biarkan throw error supaya bisa ditangani di caller
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

  async transferInquiry(req, res) {
    async function generateRefNumber(length = 12) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let result = "";
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    }
    async function generateUniqueRefNumber() {
      let unique = false;
      let ref;
      while (!unique) {
        ref = await generateRefNumber();
        const existing = await prisma.disbursement.findFirst({
          where: { ref_number: ref },
        });
        if (!existing) unique = true;
      }
      return ref;
    }
    async function generateCustRefNumber(length = 16) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let result = "";
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    }
    async function generateUniqueCustRefNumber() {
      let unique = false;
      let ref;
      while (!unique) {
        ref = await generateCustRefNumber();
        const existing = await prisma.disbursement.findFirst({
          where: { beneficiary_cust_ref_number: ref },
        });
        if (!existing) unique = true;
      }
      return ref;
    }
    try {
      const nowWIB = moment().utc().add(7, "hours").toDate();

      const lastRecord = await prisma.disbursement.findFirst({
        where: {
          response_code: "00",
          type: "transfer",
        },
        orderBy: {
          id: "desc",
        },
        select: { stan: true },
      });
      const lastStan = lastRecord?.stan || "0";
      const newStan = parseInt(lastStan, 10) + 1;
      const stan = newStan.toString().padStart(6, "0");

      const refNumberInquiry = await generateUniqueRefNumber();
      const refNumberTransfer = await generateUniqueRefNumber();
      const custRefNumber = await generateUniqueCustRefNumber();

      const saveToDb = async (data, type, refNumber) => {
        const m = data?.MethodResponse;
        await prisma.disbursement.create({
          data: {
            type: type,
            stan: m.TransactionID?.STAN,
            ref_number: refNumber,
            trans_datetime: m.TransactionID?.TransDateTime,
            inst_id: m.TransactionID?.InstID,
            token_id: m.TransactionID?.TokenID,

            sender_account_id: m.SenderData?.AccountID,
            sender_name: m.SenderData?.Name,
            sender_curr_code: m.SenderData?.CurrCode,
            sender_amount: m.SenderData?.Amount,
            sender_rate: m.SenderData?.Rate,
            sender_area_code: m.SenderData?.AreaCode,

            beneficiary_purpose_code: m.BeneficiaryData?.PurposeCode,
            beneficiary_purpose_desc: m.BeneficiaryData?.PurposeDesc,
            beneficiary_inst_id: m.BeneficiaryData?.InstID,
            beneficiary_account_id: m.BeneficiaryData?.AccountID,
            beneficiary_curr_code: m.BeneficiaryData?.CurrCode,
            beneficiary_amount: m.BeneficiaryData?.Amount,
            beneficiary_cust_ref_number: m.BeneficiaryData?.CustRefNumber,
            beneficiary_name: m.BeneficiaryData?.Name?.trim(),
            beneficiary_regency_code: m.BeneficiaryData?.RegencyCode,

            response_code: m.Response?.Code,
            response_description: m.Response?.Description,
            signature_data: m.Signature?.Data,

            created_at: nowWIB,
          },
        });
      };

      const result = await TransferInquiryAJ({
        stan,
        refNumberInquiry,
        refNumberTransfer,
        custRefNumber,
      });

      if (
        !result?.data?.inquiry ||
        !result?.data?.transfer ||
        result?.success === false
      ) {
        await saveToDb(result.data, result.type, refNumberInquiry);
        return res.status(500).json(result);
      }

      const inquiry = result?.data?.inquiry;
      const transfer = result?.data?.transfer;

      // Simpan inquiry dan transfer
      await saveToDb(inquiry, "inquiry", refNumberInquiry);
      await saveToDb(transfer, "transfer", refNumberTransfer);

      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        error:
          error.message || "Terjadi kesalahan saat memproses inquiry transfer.",
      });
    }
  },

  async inquiry(req, res) {
    async function generateRRN() {
      const now = new Date();

      // ambil format YYMMDDhhmmss
      const year = now.getFullYear().toString().slice(-2); // 2 digit tahun
      const month = (now.getMonth() + 1).toString().padStart(2, "0"); // 2 digit bulan
      const day = now.getDate().toString().padStart(2, "0"); // 2 digit tanggal
      const hour = now.getHours().toString().padStart(2, "0"); // 2 digit jam
      const minute = now.getMinutes().toString().padStart(2, "0"); // 2 digit menit
      const second = now.getSeconds().toString().padStart(2, "0"); // 2 digit detik

      return year + month + day + hour + minute + second; // 12 digit
    }
    async function generateCustRefNumber(length = 16) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let result = "";
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    }
    async function generateUniqueCustRefNumber() {
      let unique = false;
      let ref;
      while (!unique) {
        ref = await generateCustRefNumber();
        const existing = await prisma.disbursement.findFirst({
          where: { beneficiary_cust_ref_number: ref },
        });
        if (!existing) unique = true;
      }
      return ref;
    }
    try {
      const id = req.params.id;
      const nowWIB = moment().utc().add(7, "hours").toDate();

      const lastRecord = await prisma.disbursement.findFirst({
        where: {
          type: "inquiry",
        },
        orderBy: {
          id: "desc",
        },
        select: { stan: true },
      });
      const lastStan = lastRecord?.stan || "0";
      const newStan = parseInt(lastStan, 10) + 1;
      const stan = newStan.toString().padStart(6, "0");

      const refNumberInquiry = await generateRRN();
      const custRefNumber = await generateUniqueCustRefNumber();

      const saveToDb = async (data, type, refNumber) => {
        const m = data?.MethodResponse;
        await prisma.disbursement.create({
          data: {
            proposal_id: Number(id),
            type: type,
            stan: m.TransactionID?.STAN,
            ref_number: refNumber,
            trans_datetime: m.TransactionID?.TransDateTime,
            inst_id: m.TransactionID?.InstID,
            token_id: m.TransactionID?.TokenID,

            sender_account_id: m.SenderData?.AccountID,
            sender_name: m.SenderData?.Name,
            sender_curr_code: m.SenderData?.CurrCode,
            sender_amount: m.SenderData?.Amount,
            sender_rate: m.SenderData?.Rate,
            sender_area_code: m.SenderData?.AreaCode,

            beneficiary_purpose_code: m.BeneficiaryData?.PurposeCode,
            beneficiary_purpose_desc: m.BeneficiaryData?.PurposeDesc,
            beneficiary_inst_id: m.BeneficiaryData?.InstID,
            beneficiary_account_id: m.BeneficiaryData?.AccountID,
            beneficiary_curr_code: m.BeneficiaryData?.CurrCode,
            beneficiary_amount: m.BeneficiaryData?.Amount,
            beneficiary_cust_ref_number: m.BeneficiaryData?.CustRefNumber,
            beneficiary_name: m.BeneficiaryData?.Name?.trim(),
            beneficiary_regency_code: m.BeneficiaryData?.RegencyCode,

            response_code: m.Response?.Code,
            response_description: m.Response?.Description,
            signature_data: m.Signature?.Data,

            created_at: nowWIB,
          },
        });
      };

      const prop = await prisma.proposal.findUnique({
        where: {
          id: Number(id),
        },
        include: {
          user: {
            include: {
              mustahiq: true,
            },
          },
        },
      });

      const nama_rekening =
        (prop.nama_rekening ?? "").trim() ||
        (prop.user?.mustahiq?.bank_account_name ?? "").trim() ||
        "-";
      const nama_bank = prop.nama_bank || prop.user?.mustahiq?.bank_name || "-";
      const norek =
        (prop.nomor_rekening ?? "").trim() ||
        (prop.user?.mustahiq?.bank_number ?? "").trim() ||
        "-";
      const dana_yang_disetujui = prop.dana_yang_disetujui;

      const bank = await prisma.bank.findFirst({
        where: {
          bank_name: nama_bank.trim(),
          isactive: 1,
        },
        select: {
          bank_code: true,
        },
      });

      if (!bank?.bank_code) {
        throw new Error(
          "Bank tidak ditemukan, minta mustahiq memperbarui profil di portal"
        );
      }

      const bank_code = bank.bank_code.padStart(3, "0").trim();

      const result = await InquiryAJ({
        stan,
        refNumberInquiry,
        custRefNumber,
        nama_rekening,
        amount: dana_yang_disetujui,
        beneficiaryInstId: bank_code,
        beneficiaryAccountId: norek,
      });

      if (result.error && result.success === false) {
        return res.status(500).json(result);
      }

      if (result?.data && result?.success === false) {
        await saveToDb(result.data, result.type, refNumberInquiry);
        return res.status(500).json(result);
      }

      const rawBankCode = result.data.MethodResponse.BeneficiaryData.InstID;
      const bankCodeNormalized = parseInt(rawBankCode, 10).toString(); // '001' → 1 → '1'

      const bankName = await prisma.bank.findFirst({
        where: {
          bank_code: bankCodeNormalized,
        },
        select: {
          bank_name: true,
        },
      });
      const bank_name = bankName.bank_name || "Bank tidak ditemukan";

      const inquiry = result?.data;

      // Simpan inquiry dan transfer
      await saveToDb(inquiry, "inquiry", refNumberInquiry);

      res.status(200).json({
        ...result,
        bank_name,
      });
    } catch (error) {
      res.status(500).json({
        error:
          error.message || "Terjadi kesalahan saat memproses inquiry transfer.",
      });
    }
  },

  async statusInquiry(req, res) {
    // const query_stan = req.body.query_stan
    // const query_trans_datetime = req.body.query_trans_datetime
    const id = req.params.id;
    const nowWIB = moment().utc().add(7, "hours").toDate();

    try {
      const saveToDb = async (data, type) => {
        const m = data?.MethodResponse;
        await prisma.disbursement.create({
          data: {
            type: type,
            stan: m.TransactionID?.STAN,
            trans_datetime: m.TransactionID?.TransDateTime,
            inst_id: m.TransactionID?.InstID,

            sender_account_id: m.TransferData.SenderData?.AccountID,
            sender_name: m.TransferData.SenderData?.Name,
            sender_curr_code: m.TransferData.SenderData?.CurrCode,
            sender_amount: m.TransferData.SenderData?.Amount,
            sender_rate: m.TransferData.SenderData?.Rate,

            beneficiary_inst_id: m.TransferData.BeneficiaryData?.InstID,
            beneficiary_account_id: m.TransferData.BeneficiaryData?.AccountID,
            beneficiary_curr_code: m.TransferData.BeneficiaryData?.CurrCode,
            beneficiary_amount: m.TransferData.BeneficiaryData?.Amount,
            beneficiary_cust_ref_number:
              m.TransferData.BeneficiaryData?.CustRefNumber,
            beneficiary_name: m.TransferData.BeneficiaryData?.Name?.trim(),
            beneficiary_regency_code:
              m.TransferData.BeneficiaryData?.RegencyCode,

            response_code: m.TransferData.Response?.Code,
            response_description: m.TransferData.Response?.Description,
            signature_data: m.Signature?.Data,

            created_at: nowWIB,
          },
        });
      };

      const propDisb = await prisma.disbursement.findFirst({
        where: {
          proposal_id: Number(id),
          type: "transfer",
          // response_code: '00',
        },
        orderBy: {
          id: "desc",
        },
        select: {
          stan: true,
          trans_datetime: true,
          ref_number: true,
        },
      });

      if (!propDisb) {
        throw new Error("Transaksi tidak ditemukan");
      }

      const lastRecord = await prisma.disbursement.findFirst({
        where: {
          type: "status",
        },
        orderBy: {
          id: "desc",
        },
        select: { stan: true },
      });
      const lastStan = lastRecord?.stan || "0";
      const newStan = parseInt(lastStan, 10) + 1;
      const stan = newStan.toString().padStart(6, "0");

      const query_stan = propDisb.stan;
      const query_trans_datetime = propDisb.trans_datetime;

      const result = await StatusAJ({
        trans_stan: stan,
        query_stan,
        query_trans_datetime,
      });

      if (result?.success === false) {
        await saveToDb(result.data, result.type);
        return res.status(500).json(result);
      }

      const rawBankCode =
        result.MethodResponse.TransferData.BeneficiaryData.InstID;
      const bankCodeNormalized = parseInt(rawBankCode, 10).toString(); // '001' → 1 → '1'

      const bank = await prisma.bank.findFirst({
        where: {
          bank_code: bankCodeNormalized,
        },
        select: {
          bank_name: true,
        },
      });
      const bank_name = bank.bank_name || "Bank tidak ditemukan";

      await saveToDb(result, "status");
      res.status(200).json({
        success: true,
        message: "Check Status Inquiry berhasil",
        signature: "✅Status Inquiry Signature Valid",
        bank: bank_name,
        refNumber: propDisb.ref_number,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        error:
          error.message || "Terjadi kesalahan saat memproses inquiry transfer.",
      });
    }
  },

  async checkBalance(req, res) {
    const nowWIB = moment().utc().add(7, "hours").toDate();

    try {
      const saveToDb = async (data, type) => {
        const m = data?.MethodResponse;
        await prisma.disbursement.create({
          data: {
            type: type,
            stan: m.TransactionID?.STAN,
            trans_datetime: m.TransactionID?.TransDateTime,
            inst_id: m.TransactionID?.InstID,

            response_code: m.Response?.Code,
            response_description: m.Response?.Description,
            signature_data: m.Signature?.Data,

            account_balance: m.Account.Balance || null,

            created_at: nowWIB,
          },
        });
      };

      const lastRecord = await prisma.disbursement.findFirst({
        where: {
          type: "checkBalance",
        },
        orderBy: {
          id: "desc",
        },
        select: { stan: true },
      });
      const lastStan = lastRecord?.stan || "0";
      const newStan = parseInt(lastStan, 10) + 1;
      const stan = newStan.toString().padStart(6, "0");

      const result = await BalanceAJ({
        stan,
      });

      if (result?.success === false) {
        await saveToDb(result.data, result.type);
        return res.status(500).json(result);
      }
      await saveToDb(result.data, "checkBalance");
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        error:
          error.message || "Terjadi kesalahan saat memproses inquiry transfer.",
      });
    }
  },

  async cashflow(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = req.query.perPage === '-1' ? undefined : Number(req.query.perPage || 10);
      const sortBy = req.query.sortBy || "created_at";
      const sortType = req.query.order || "desc";
      const status = req.query.status || "";
      const keyword = req.query.nama || "";
      const tanggal_dari = req.query.tanggal_dari;
      const tanggal_sampai = req.query.tanggal_sampai;

      const whereClause = {
        OR: [
          {
            AND: [
              { type: { in: ["transfer", "checkBalance"] } },
              { proposal_id: { not: null } },
              { proposal: { nama: { contains: keyword } } },
            ],
          },
          {
            type: "topUp",
          },
        ],
      };

      if (Array.isArray(status) && status.length > 0) {
        const includeCodes = [];
        const excludeCodes = [];

        status.forEach(code => {
          if (code.startsWith('!')) {
            excludeCodes.push(code.substring(1));
          } else {
            includeCodes.push(code);
          }
        });

        if (includeCodes.length > 0 && excludeCodes.length > 0) {
          whereClause.response_code = {
            in: includeCodes,
            notIn: excludeCodes,
          };
        } else if (includeCodes.length > 0) {
          whereClause.response_code = { in: includeCodes };
        } else if (excludeCodes.length > 0) {
          whereClause.response_code = { notIn: excludeCodes };
        }
      }

      if (tanggal_dari || tanggal_sampai) {
        whereClause["created_at"] = {
          ...(tanggal_dari && { gte: new Date(tanggal_dari) }),
          ...(tanggal_sampai && {
            lte: new Date(new Date(tanggal_sampai).setHours(23, 59, 59, 999)),
          }),
        };
      }

      const disbursements = await prisma.disbursement.findMany({
        where: whereClause,
        include: {
          proposal: { select: { nama: true } },
        },
        orderBy: { [sortBy]: sortType },
      });

      // Ambil kode bank unik (tanpa leading zero)
      const kodeBankSet = new Set();
      disbursements.forEach(d => {
        if (d.beneficiary_inst_id) {
          const cleanKode = d.beneficiary_inst_id.replace(/^0+/, '');
          if (cleanKode) kodeBankSet.add(cleanKode);
        }
      });

      const kodeBankList = Array.from(kodeBankSet);

      const banks = await prisma.bank.findMany({
        where: {
          bank_code: { in: kodeBankList },
        },
        select: {
          bank_code: true,
          bank_name: true,
        },
      });

      const bankMap = {};
      banks.forEach(bank => {
        bankMap[bank.bank_code] = bank.bank_name;
      });

      // Pisahkan topUp dan non-topUp
      const topUps = disbursements.filter(d => d.type === 'topUp');
      const others = disbursements.filter(d => d.type !== 'topUp');

      // Group by proposal_id untuk transfer dan checkBalance
      const grouped = {};
      others.forEach((item) => {
        const pid = item.proposal_id;
        if (!grouped[pid]) grouped[pid] = { transfer: null, checkBalance: null };
        if (item.type === 'transfer') grouped[pid].transfer = item;
        else if (item.type === 'checkBalance') grouped[pid].checkBalance = item;
      });

      const groupedResults = Object.values(grouped)
        .filter(group => group.transfer)
        .map(({ transfer, checkBalance }) => {
          let formattedTransDatetime = null;
          if (transfer.trans_datetime) {
            const raw = transfer.trans_datetime;
            const year = parseInt(raw.slice(0, 4));
            const month = parseInt(raw.slice(4, 6)) - 1;
            const day = parseInt(raw.slice(6, 8));
            const hour = parseInt(raw.slice(8, 10));
            const minute = parseInt(raw.slice(10, 12));
            const second = parseInt(raw.slice(12, 14));
            const datetime = new Date(Date.UTC(year, month, day, hour, minute, second));
            formattedTransDatetime = moment(datetime)
              .tz('Asia/Jakarta')
              .format('DD-MM-YYYY HH:mm:ss') + ' WIB';
          }

          const kodeBank = transfer.beneficiary_inst_id?.replace(/^0+/, '') || '';
          const namaBank = bankMap[kodeBank] || transfer.beneficiary_inst_id;

          return {
            ...transfer,
            id: transfer.id.toString(),
            trans_datetime: formattedTransDatetime,
            beneficiary_inst_id: namaBank,
            saldo_akhir: checkBalance?.account_balance || null,
          };
        });

      // Mapping topUp ke format final juga
      const topUpResults = topUps.map(topup => {
        const isoString = topup.created_at instanceof Date
          ? topup.created_at.toISOString()
          : topup.created_at;

        const formatted = isoString.slice(0, 19).replace('T', ' ') + ' WIB';

        return {
          ...topup,
          id: topup.id.toString(),
          trans_datetime: formatted,
          beneficiary_inst_id: '-', // atau kamu bisa kosongin/ganti label lain
          saldo_akhir: null,
        };
      });

      // Gabungkan semuanya
      const finalResult = [...groupedResults, ...topUpResults];

      // Urutkan berdasarkan created_at
      finalResult.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      const total = finalResult.length;
      const paginatedResult = perPage
        ? finalResult.slice((page - 1) * perPage, page * perPage)
        : finalResult;

      res.status(200).json({
        message: "Sukses Ambil Data Disbursement",
        data: paginatedResult,
        pagination: {
          total,
          page,
          hasNext: perPage ? total > page * perPage : false,
          totalPage: perPage ? Math.ceil(total / perPage) : 1,
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message || "Terjadi kesalahan.",
      });
    }
  },

  async topUp(req, res) {
    try {
      const { nominal, datetime } = req.body;

      if (!nominal || !datetime) {
        return res.status(400).json({ message: 'nominal dan datetime wajib diisi.' });
      }

      const jakartaTime = moment.utc(datetime).tz('Asia/Jakarta').toDate();

      const disbursement = await prisma.disbursement.create({
        data: {
          topup_balance: nominal,
          created_at: jakartaTime,
          type: 'topUp',
        },
      });

      res.status(200).json({
        message: 'Top Up berhasil dicatat.',
        data: {
          ...disbursement,
          id: disbursement.id?.toString()// jika BigInt
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message || "Terjadi kesalahan.",
      });
    }
  },
};
