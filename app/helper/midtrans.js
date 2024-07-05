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
        return response.data;
    } catch (error) {
        console.error('Error:', error.response.data);
        throw error;
    }
}
module.exports = {
    midtransfer,
    cekstatus
};