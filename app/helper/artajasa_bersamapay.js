const axios = require("axios");
const sha256 = require('crypto-js/sha256');
//const Base64 = require('crypto-js/enc-base64');
const CryptoJS = require('crypto-js');
//const HmacSHA256 = require('crypto-js/hmac-sha256');

const Auth = async () => {
  
  const secret = "secret";
  const username = "zisindosat";

  try {

    var authfirst = CryptoJS.HmacSHA256(username, secret);
    var signHex = CryptoJS.enc.Base64.stringify(authfirst);
    
    console.log("base64String :"+ signHex);

    //console.log('JSON result:', JSON.stringify(signHex, null, 2));

    return signHex;
  } catch (error) {
    console.error("Error: error encrypted");
    throw error;
  }
};

const sofdigest_sign_id = async () => {

      try{

        const phoneNumber = "08558833244"

        const jsonData = {
            
                "Version" : "8.0",
                "timestamp" : "300924091809",
                "merchantID": "321000000000014",
                "uniqueTransactionCode": phoneNumber+Math.floor(new Date().getTime() / 1000),
                "currencyCode": "360",
                "msisdn": phoneNumber,
                "idSOF": "06",
                "trxType": "payment",
                "totalAmount": "000000050000",
                "userDefined1": "Pembayaran 1"
            
        }

        const digetJson = { "sof_payment_only" : jsonData }

        const alldata = CryptoJS.enc.Base64.stringify(sha256(digetJson));

        console.log("ALLDATA", JSON.stringify(alldata));

        return alldata;

      }catch (error) {
          console.error("Error: error encrypted");
      }

}

const postData = async () => {

  try{
    const secret = "secret";
   const Strings = "POST "+ 
                    "\n" + 
                  "Tue 1 OCT 2024 12:16:00 GMT" +
                  "\n" +
                  "/rest/api/sof_payment_only" +
                  "\n" +
                  "TqXFCKZWbnYkBUP4/rBv1Fd3e+OVScQBZDav2mXSMw4="
   
   const dataSign = CryptoJS.HmacSHA256(Strings, secret);
   
   const dataEncB64 = CryptoJS.enc.Base64.stringify(dataSign);

   console.log("ALLDATA", JSON.stringify(dataEncB64));

    return dataEncB64;

  }catch (error) {
      console.error("Error: error encrypted");
  }

}

const JWTToken = async () => {

  try{
    
    const headers = {
       "alg" : "HS256",
       "typ" : "JWT"
    }

    const body = {
        "version" : 1,
        "type" : 1,
        "epoch" : "17289894899488",
        "msisdn" : "08558833244",
        "operator_name": "indosat",
        "key_id" : "f0f8hd3uiug3iguiu3giugiu4ui6621ioh",
        "path" : "/rest/api/sof_payment_only"
    }

    return dataEncB64;

  }catch (error) {
      console.error("Error: error encrypted");
  }

}


module.exports = {
  Auth,
  sofdigest_sign_id,
  postData
};
