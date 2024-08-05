const ax = require('axios');
const CryptoJS = require('crypto-js');
const { format } = require('date-fns');
const sendImkas = async ({ nom, phone, desc, id }) => {
    const timesg = String(+ new Date);
    const datas = {
        "amount": Number(nom),
        "customerPhone": String(phone),
        "desc": String(desc),
        "jurnalId": "ZISWAF",
        "partnerCode": String(id),
        "productCode": "Top up - ZISWAF",
        "referenceNumber": String(id)
    }
    const serverkey = 'wAEd3Jhc62KzDFtPw6fxw4PTbKPZiKvjtT1eW6FpxXQ='
    const reqtrim = JSON.stringify(datas).replace(/[^a-zA-Z0-9\,:{}.]+/g, "").toUpperCase() + ':' + timesg;
    var hasreq = CryptoJS.HmacSHA256(reqtrim, serverkey);
    var signHex = CryptoJS.enc.Base64.stringify(hasreq);
    try {
        const response = await ax.post('https://imkas.pactindo.com/api/topup/postingDisbursement',
            datas,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Institution-ID': 'IMCASH',
                    'Timestamp': timesg,
                    'Authorization': 'Basic WklTV0FG',
                    'Signature': signHex
                }
            });
        console.log(datas);
        console.log(response);
        return response;
    } catch (error) {
        console.error('Error:', error.response.data);
        throw error;
    }
};

const checkImkas = async () => {
    const timesg = format(new Date(), 'yyyyMMdd');
    // const timesg = String(+ new Date);
    const datas = {
        "partnerId": "ZISWAF",
        "partnerCode": "ZISWAF"
    }
    const serverkey = 'wAEd3Jhc62KzDFtPw6fxw4PTbKPZiKvjtT1eW6FpxXQ='
    const reqtrim = JSON.stringify(datas).replace(/[^a-zA-Z0-9\,:{}.]+/g, "").toUpperCase() + ':' + timesg;
    var hasreq = CryptoJS.HmacSHA256(reqtrim, serverkey);
    var signHex = CryptoJS.enc.Base64.stringify(hasreq);
    try {
        const response = await ax.post('https://imkas.pactindo.com/api/topup/checkDepositBalance',
            datas,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Institution-ID': 'IMCASH',
                    'Timestamp': timesg,
                    'Authorization': 'Basic WklTV0FG',
                    'Signature': signHex
                }
            });
        // console.log(datas);
        console.log(response);
        return response;
    } catch (error) {
        console.error('Error:', error.response.data);
        throw error;
    }
};
module.exports = {
    sendImkas,
    checkImkas
};