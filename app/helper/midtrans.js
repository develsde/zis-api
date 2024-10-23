const midtransClient = require("midtrans-client");
const fs = require("fs");
var serverkeys = process.env.SERVER_KEY;
var clientkeys = process.env.CLIENT_KEY;
const axios = require("axios");

const midtransfer = async ({ order, price }) => {
  let snap = new midtransClient.Snap({
    isProduction: true,
    serverKey: serverkeys,
    clientKey: clientkeys,
  });
  let parameter = {
    transaction_details: {
      order_id: order,
      gross_amount: price,

    },
    credit_card: {
      secure: true,
    },
  };
  console.log("payment : ", JSON.stringify(parameter));
  try {
    const transaction = await snap.createTransaction(parameter);

    let transactionToken = transaction.token;
    console.log("transactionToken:", transactionToken);

    let transactionRedirectUrl = transaction.redirect_url;
    console.log("transactionRedirectUrl:", transactionRedirectUrl);

    let transactionStatus = transaction.transaction_status || 'pending';

    let paymentResponse = {
      redirect_url: transactionRedirectUrl,
      transaction_token: transactionToken,
      // transaction_status: transactionStatus,
    };

    return {
      success: true,
      code: 200,
      message: "Berikut Datanya : " + JSON.stringify(paymentResponse),
      data: paymentResponse,
    };
  } catch (e) {
    console.log("Error occurred:", e.message);
    return {
      success: false,
      code: 500,
      message: e.message,
    };
  }
};


// const getTransactionStatus = async (orderId) => {
//   console.log("lihat order id:", orderId);
//   let core = new midtransClient.CoreApi({
//     isProduction: true,
//     serverKey: serverkeys,
//     clientKey: clientkeys,
//   });

//   try {
//     const statusResponse = await core.transaction.status(orderId);
//     console.log("Transaction status:", statusResponse.transaction_status);

//     return {
//       success: true,
//       transaction_status: statusResponse.transaction_status,
//       data: statusResponse,
//     };
//   } catch (error) {
//     console.log("Error fetching transaction status:", error.message);
//     return {
//       success: false,
//       message: error.message,
//     };
//   }
// };



const cekStatus = async ({ order }) => {
  let serverKey = serverkeys + ":";
  let auth = Buffer.from(serverKey).toString("base64");
  try {
    const response = await axios.get(
      // `https://api.sandbox.midtrans.com/v2/${order}/status`,
      `https://api.midtrans.com/v2/${order}/status`,
      {
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Basic ${auth}`
        },
      }
    );
    console.log(response);
    return response;
  } catch (error) {
    console.error("Error:", error.response.data);
    throw error;
  }
};

const cancelPayment = async ({ order }) => {
  let serverKey = `${serverkeys}:`;
  let auth = Buffer.from(serverKey).toString("base64");

  const url = `https://api.midtrans.com/v2/${order}/cancel`;

  try {
    const options = {
      method: "POST",
      url: url,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      data: {},
    };

    const response = await axios(options);
    console.log("Success:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    throw error;
  }
};

// const cancelPayment = async ({ order }) => {
//     const serverKey = `${serverkeys}:`;
//     const auth = Buffer.from(serverKey).toString("base64");

//     const url = `https://api.midtrans.com/v2/${order}/cancel`;
//     const options = {
//       method: "POST",
//       headers: {
//         Accept: "application/json",
//         "Content-Type": "application/json",
//         Authorization: `Basic U0ItTWlkLXNlcnZlci1HbU5HbmtMYklrZXdDV3ltVkdpbWxadnM6`,
//       },
//     };

//     try {
//       const response = await fetch(url, options);
//       if (!response.ok) {
//         const errorData = await response.json();
//         throw new Error(
//           `Error ${response.status}: ${errorData.message || "Request failed"}`
//         );
//       }
//       console.log(response.Success);

//       const result = await response.json();
//       console.log("Success:", result);
//       return result;
//     } catch (error) {
//       console.error("Error:", error.message);
//       throw error;
//     }
//   };

const expirePayment = async ({ order }) => {
  let serverKey = `${serverkeys}:`;
  let auth = Buffer.from(serverKey).toString("base64");

  const url = `https://api.midtrans.com/v2/${order}/expire`;

  try {
    const options = {
      method: "POST",
      url: url,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Basic ${auth}`,
      },
      data: {},
    };

    const response = await axios(options);
    console.log("Success:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    throw error;
  }
};

function generateOrderId(paymentType) {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:.]/g, '').slice(0, 15); // Format YYYYMMDDHHMMSS
  let prefix;

  // Memberikan prefix berdasarkan paymentType
  switch (paymentType) {
    case 'bca':
    case 'bni':
    case 'bri':
      prefix = 'BT'; // Prefix untuk bank transfer
      break;
    case 'mandiri':
      prefix = 'EC'; // Prefix untuk Mandiri
      break;
    case 'gopay':
      prefix = 'QR'; // Prefix untuk QRIS
      break;
    case 'cash':
      prefix = 'CS'; // Prefix untuk QRIS
      break;
    default:
      throw new Error('Tipe pembayaran tidak dikenali'); // Buat error jika tipe tidak valid
  }

  return `${prefix}${timestamp}`; // Mengembalikan order_id dengan prefix
}

const handlePayment = async ({ paymentType, kode_pemesanan, amount }) => {
  let serverKey = `${serverkeys}:`;
  let auth = Buffer.from(serverKey).toString("base64");
  try {
    const orderId = generateOrderId(paymentType); // Ganti dengan fungsi untuk menghasilkan order_id
    let options;
    // Menentukan options berdasarkan payment_type
    switch (paymentType) {
      case "bca":
        options = {
          method: "POST",
          //   url: "https://api.midtrans.com/v2/charge",
          url: "https://api.sandbox.midtrans.com/v2/charge",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            // Authorization: `Basic ${auth}`,
            Authorization: `Basic U0ItTWlkLXNlcnZlci1HbU5HbmtMYklrZXdDV3ltVkdpbWxadnM6`,
          },
          data: {
            payment_type: "bank_transfer",
            transaction_details: {
              gross_amount: Number(amount),
              order_id: orderId,
            },
            bank_transfer: { bank: "bca" },
          },
        };
        break;
      case "mandiri":
        options = {
          method: "POST",
          //   url: "https://api.midtrans.com/v2/charge",
          url: "https://api.sandbox.midtrans.com/v2/charge",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            // Authorization: `Basic ${auth}`,
            Authorization: `Basic U0ItTWlkLXNlcnZlci1HbU5HbmtMYklrZXdDV3ltVkdpbWxadnM6`,
          },
          data: {
            payment_type: "echannel",
            transaction_details: {
              order_id: orderId,
              gross_amount: Number(amount),
            },
            echannel: {
              bill_info1: "Payment For:",
              bill_info2: "debt",
            },
          },
        };
        break;
      case "bni":
        options = {
          method: "POST",
          //   url: "https://api.midtrans.com/v2/charge",
          url: "https://api.sandbox.midtrans.com/v2/charge",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            // Authorization: `Basic ${auth}`,
            Authorization: `Basic U0ItTWlkLXNlcnZlci1HbU5HbmtMYklrZXdDV3ltVkdpbWxadnM6`,
          },
          data: {
            payment_type: "bank_transfer",
            transaction_details: {
              gross_amount: Number(amount),
              order_id: orderId,
            },
            bank_transfer: { bank: "bni" },
          },
        };
        break;
      case "bri":
        options = {
          method: "POST",
          //   url: "https://api.midtrans.com/v2/charge",
          url: "https://api.sandbox.midtrans.com/v2/charge",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            // Authorization: `Basic ${auth}`,
            Authorization: `Basic U0ItTWlkLXNlcnZlci1HbU5HbmtMYklrZXdDV3ltVkdpbWxadnM6`,
          },
          data: {
            payment_type: "bank_transfer",
            transaction_details: {
              gross_amount: Number(amount),
              order_id: orderId,
            },
            bank_transfer: { bank: "bri" },
          },
        };
        break;
      case "gopay":
        options = {
          method: "POST",
          //   url: "https://api.midtrans.com/v2/charge",
          url: "https://api.sandbox.midtrans.com/v2/charge",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            // Authorization: `Basic ${auth}`,
            Authorization: `Basic U0ItTWlkLXNlcnZlci1HbU5HbmtMYklrZXdDV3ltVkdpbWxadnM6`,
          },
          data: {
            payment_type: "qris",
            transaction_details: {
              gross_amount: Number(amount),
              order_id: orderId,
            },
            qris: { acquirer: "gopay" },
          },
        };
        break;
      case "cash":
        return orderId;
      default:
        throw new Error("Tipe pembayaran tidak dikenali"); // Buat error jika tipe tidak valid
    }

    const response = await axios.request(options); // Gunakan await untuk menunggu respons
    return response; // Tampilkan respons
  } catch (error) {
    // Periksa apakah error memiliki response
    if (error.response) {
      console.error("Error response:", error.response.data);
    } else {
      console.error("Error message:", error.message);
    }
    throw error; // Lempar kembali error untuk penanganan lebih lanjut jika diperlukan
  }
};

module.exports = {
  midtransfer,
  cekStatus,
  cancelPayment,
  expirePayment,
  handlePayment,
  // getTransactionStatus,
};
