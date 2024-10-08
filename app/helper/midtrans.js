const midtransClient = require('midtrans-client');
const fs = require('fs');
var serverkeys = process.env.SERVER_KEY;
var clientkeys = process.env.CLIENT_KEY;
const ax = require('axios');

const midtransfer = async ({ order, price }) => {
    let snap = new midtransClient.Snap({
        isProduction: true,
        serverKey: serverkeys,
        clientKey: clientkeys
    });
    let parameter = {
        "transaction_details": {
            "order_id": order,
            "gross_amount": price
        }, "credit_card": {
            "secure": true
        }
    };
    console.log("payment : ", JSON.stringify(parameter));
    try {
        const transaction = await snap.createTransaction(parameter);

        let transactionToken = transaction.token;
        console.log('transactionToken:', transactionToken);

        let transactionRedirectUrl = transaction.redirect_url;
        console.log('transactionRedirectUrl:', transactionRedirectUrl);

        let paymentResponse = {
            redirect_url: transactionRedirectUrl,
            transaction_token: transactionToken
        }

        return {
            success: true,
            code: 200,
            message: ("Berikut Datanya : " + JSON.stringify(paymentResponse)),
            data: paymentResponse,
        };
    } catch (e) {
        console.log('Error occurred:', e.message);
        return {
            success: false,
            code: 500,
            message: e.message,
        };
    }
};
const cekstatus = async ({ order }) => {
    let serverKey = serverkeys + ":";
    let auth = Buffer.from(serverKey).toString('base64');
    try {
        const response = await ax.get(`https://api.midtrans.com/v2/${order}/status`,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': `Basic ${auth}`,
                }
            });
        return response;
    } catch (error) {
        console.error('Error:', error.response.data);
        throw error;
    }
}

const axios = require('axios');

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
        default:
            throw new Error('Tipe pembayaran tidak dikenali'); // Buat error jika tipe tidak valid
    }

    return `${prefix}${timestamp}`; // Mengembalikan order_id dengan prefix
}

const handlePayment = async ({ paymentType }) => {
    try {
        const orderId = generateOrderId(paymentType); // Ganti dengan fungsi untuk menghasilkan order_id
        let options;

        // Menentukan options berdasarkan payment_type
        switch (paymentType) {
            case 'bca':
                options = {
                    method: 'POST',
                    url: 'https://api.sandbox.midtrans.com/v2/charge',
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        authorization: 'Basic U0ItTWlkLXNlcnZlci1HbU5HbmtMYklrZXdDV3ltVkdpbWxadnM6'
                    },
                    data: {
                        "payment_type": "bank_transfer",
                        "transaction_details": {
                            "gross_amount": 10000,
                            "order_id": orderId
                        },
                        bank_transfer: { bank: 'bca' }
                    }
                };
                break;
            case 'mandiri':
                options = {
                    method: 'POST',
                    url: 'https://api.sandbox.midtrans.com/v2/charge',
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        authorization: 'Basic U0ItTWlkLXNlcnZlci1HbU5HbmtMYklrZXdDV3ltVkdpbWxadnM6'
                    },
                    data: {
                        "payment_type": "echannel",
                        "transaction_details": {
                            "order_id": orderId,
                            "gross_amount": 95000
                        },
                        echannel: {
                            "bill_info1": "Payment For:",
                            "bill_info2": "debt"
                        }
                    }
                };
                break;
            case 'bni':
                options = {
                    method: 'POST',
                    url: 'https://api.sandbox.midtrans.com/v2/charge',
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        authorization: 'Basic U0ItTWlkLXNlcnZlci1HbU5HbmtMYklrZXdDV3ltVkdpbWxadnM6'
                    },
                    data: {
                        "payment_type": "bank_transfer",
                        "transaction_details": {
                            "gross_amount": 10000,
                            "order_id": orderId
                        },
                        bank_transfer: { bank: 'bni' }
                    }
                };
                break;
            case 'bri':
                options = {
                    method: 'POST',
                    url: 'https://api.sandbox.midtrans.com/v2/charge',
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        authorization: 'Basic U0ItTWlkLXNlcnZlci1HbU5HbmtMYklrZXdDV3ltVkdpbWxadnM6'
                    },
                    data: {
                        "payment_type": "bank_transfer",
                        "transaction_details": {
                            "gross_amount": 10000,
                            "order_id": orderId
                        },
                        bank_transfer: { bank: 'bri' }
                    }
                };
                break;
            case 'gopay':
                options = {
                    method: 'POST',
                    url: 'https://api.sandbox.midtrans.com/v2/charge',
                    headers: {
                        accept: 'application/json',
                        'content-type': 'application/json',
                        authorization: 'Basic U0ItTWlkLXNlcnZlci1HbU5HbmtMYklrZXdDV3ltVkdpbWxadnM6'
                    },
                    data: {
                        "payment_type": "qris",
                        "transaction_details": {
                            "gross_amount": 10000,
                            "order_id": orderId
                        },
                        qris: { "acquirer": "gopay" }
                    }
                };
                break;
            default:
                throw new Error('Tipe pembayaran tidak dikenali'); // Buat error jika tipe tidak valid
        }

        const response = await axios.request(options); // Gunakan await untuk menunggu respons
        return response // Tampilkan respons
    } catch (error) {
        // Periksa apakah error memiliki response
        if (error.response) {
            console.error('Error response:', error.response.data);
        } else {
            console.error('Error message:', error.message);
        }
        throw error; // Lempar kembali error untuk penanganan lebih lanjut jika diperlukan
    }
};

module.exports = {
    midtransfer,
    cekstatus,
    handlePayment
};