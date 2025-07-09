const { prisma } = require("../../prisma/client");
const CryptoJS = require("crypto-js");
const moment = require("moment");

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
        // "https://im3.artajasa.co.id:9443/rest/api/sof_void",
        "https://im3.artajasa.co.id:20443/rest/api/sof_void",
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

  async transferInquiry(req, res) {
    async function generateRefNumber(length = 12) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
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
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
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
      const nowWIB = moment().utc().add(7, 'hours').toDate();

      const lastRecord = await prisma.disbursement.findFirst({
        where: {
          response_code: '00',
          type: 'transfer',
        },
        orderBy: {
          id: 'desc',
        },
        select: { stan: true },
      });
      const lastStan = lastRecord?.stan || '0';
      const newStan = parseInt(lastStan, 10) + 1;
      const stan = newStan.toString().padStart(6, '0');

      const refNumberInquiry = await generateUniqueRefNumber();
      const refNumberTransfer = await generateUniqueRefNumber();
      const custRefNumber = await generateUniqueCustRefNumber()

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
          }
        });
      };

      const result = await TransferInquiryAJ({
        stan, refNumberInquiry, refNumberTransfer, custRefNumber
      });

      if (!result?.data?.inquiry || !result?.data?.transfer || result?.success === false) {
        await saveToDb(result.data, result.type, refNumberInquiry);
        return res.status(500).json(result);
      }

      const inquiry = result?.data?.inquiry;
      const transfer = result?.data?.transfer;

      // Simpan inquiry dan transfer
      await saveToDb(inquiry, 'inquiry', refNumberInquiry);
      await saveToDb(transfer, 'transfer', refNumberTransfer);

      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        error: error.message || 'Terjadi kesalahan saat memproses inquiry transfer.',
      });
    }
  },

  async inquiry(req, res) {
    async function generateRRN() {
      const now = new Date();

      // ambil format YYMMDDhhmmss
      const year = now.getFullYear().toString().slice(-2); // 2 digit tahun
      const month = (now.getMonth() + 1).toString().padStart(2, '0'); // 2 digit bulan
      const day = now.getDate().toString().padStart(2, '0'); // 2 digit tanggal
      const hour = now.getHours().toString().padStart(2, '0'); // 2 digit jam
      const minute = now.getMinutes().toString().padStart(2, '0'); // 2 digit menit
      const second = now.getSeconds().toString().padStart(2, '0'); // 2 digit detik

      return year + month + day + hour + minute + second; // 12 digit
    }
    async function generateCustRefNumber(length = 16) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
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
      const nowWIB = moment().utc().add(7, 'hours').toDate();

      const lastRecord = await prisma.disbursement.findFirst({
        where: {
          type: 'inquiry',
        },
        orderBy: {
          id: 'desc',
        },
        select: { stan: true },
      });
      const lastStan = lastRecord?.stan || '0';
      const newStan = parseInt(lastStan, 10) + 1;
      const stan = newStan.toString().padStart(6, '0');

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
          }
        });
      };

      const prop = await prisma.proposal.findUnique({
        where: {
          id: Number(id)
        },
        include: {
          user: {
            include: {
              mustahiq: true
            }
          }
        }
      })

      const nama_rekening = (prop.nama_rekening ?? '').trim() || (prop.user?.mustahiq?.bank_account_name ?? '').trim() || '-';
      const nama_bank = prop.nama_bank || prop.user?.mustahiq?.bank_name || '-';
      const norek = (prop.nomor_rekening ?? '').trim() || (prop.user?.mustahiq?.bank_number ?? '').trim() || '-';
      const dana_yang_disetujui = prop.dana_yang_disetujui

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
        throw new Error('Bank tidak ditemukan, minta mustahiq memperbarui profil di portal');
      }

      const bank_code = bank.bank_code.padStart(3, '0').trim();

      const result = await InquiryAJ({
        stan, refNumberInquiry, custRefNumber, nama_rekening, amount: dana_yang_disetujui, beneficiaryInstId: bank_code, beneficiaryAccountId: norek
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
          bank_code: bankCodeNormalized
        },
        select: {
          bank_name: true
        }
      });
      const bank_name = bankName.bank_name || 'Bank tidak ditemukan'

      const inquiry = result?.data;

      // Simpan inquiry dan transfer
      await saveToDb(inquiry, 'inquiry', refNumberInquiry);

      res.status(200).json({
        ...result,
        bank_name
      });
    } catch (error) {
      res.status(500).json({
        error: error.message || 'Terjadi kesalahan saat memproses inquiry transfer.',
      });
    }
  },

  async statusInquiry(req, res) {
    // const query_stan = req.body.query_stan
    // const query_trans_datetime = req.body.query_trans_datetime
    const id = req.params.id;
    const nowWIB = moment().utc().add(7, 'hours').toDate();

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
            beneficiary_cust_ref_number: m.TransferData.BeneficiaryData?.CustRefNumber,
            beneficiary_name: m.TransferData.BeneficiaryData?.Name?.trim(),
            beneficiary_regency_code: m.TransferData.BeneficiaryData?.RegencyCode,

            response_code: m.TransferData.Response?.Code,
            response_description: m.TransferData.Response?.Description,
            signature_data: m.Signature?.Data,

            created_at: nowWIB,
          }
        });
      };

      const propDisb = await prisma.disbursement.findFirst({
        where: {
          proposal_id: Number(id),
          type: 'transfer',
          // response_code: '00',
        },
        orderBy: {
          id: 'desc',
        },
        select: {
          stan: true,
          trans_datetime: true,
          ref_number: true
        }
      })

      if (!propDisb) {
        throw new Error('Transaksi tidak ditemukan')
      }

      const lastRecord = await prisma.disbursement.findFirst({
        where: {
          type: 'status',
        },
        orderBy: {
          id: 'desc',
        },
        select: { stan: true },
      });
      const lastStan = lastRecord?.stan || '0';
      const newStan = parseInt(lastStan, 10) + 1;
      const stan = newStan.toString().padStart(6, '0');

      const query_stan = propDisb.stan;
      const query_trans_datetime = propDisb.trans_datetime;

      const result = await StatusAJ({
        trans_stan: stan, query_stan, query_trans_datetime
      });

      if (result?.success === false) {
        await saveToDb(result.data, result.type);
        return res.status(500).json(result);
      }

      const rawBankCode = result.MethodResponse.TransferData.BeneficiaryData.InstID;
      const bankCodeNormalized = parseInt(rawBankCode, 10).toString(); // '001' → 1 → '1'

      const bank = await prisma.bank.findFirst({
        where: {
          bank_code: bankCodeNormalized
        },
        select: {
          bank_name: true
        }
      });
      const bank_name = bank.bank_name || 'Bank tidak ditemukan'

      await saveToDb(result, 'status');
      res.status(200).json({
        success: true,
        message: "Check Status Inquiry berhasil",
        signature: '✅Status Inquiry Signature Valid',
        bank: bank_name,
        refNumber: propDisb.ref_number,
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        error: error.message || 'Terjadi kesalahan saat memproses inquiry transfer.',
      });
    }
  },

  async checkBalance(req, res) {
    const nowWIB = moment().utc().add(7, 'hours').toDate();

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
          }
        });
      };

      const lastRecord = await prisma.disbursement.findFirst({
        where: {
          type: 'checkBalance',
        },
        orderBy: {
          id: 'desc',
        },
        select: { stan: true },
      });
      const lastStan = lastRecord?.stan || '0';
      const newStan = parseInt(lastStan, 10) + 1;
      const stan = newStan.toString().padStart(6, '0');

      const result = await BalanceAJ({
        stan
      });

      if (result?.success === false) {
        await saveToDb(result.data, result.type);
        return res.status(500).json(result);
      }
      await saveToDb(result.data, 'checkBalance');
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        error: error.message || 'Terjadi kesalahan saat memproses inquiry transfer.',
      });
    }
  },
};
