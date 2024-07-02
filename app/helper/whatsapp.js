const axios = require("axios");
const https = require("https");

const sendWhatsapp = async ({ wa_number, text }) => {

  const agent = new https.Agent({
    rejectUnauthorized: false,
  });

  let config = {
    method: 'post',
    url: 'https://erpapi.zisindosat.id/v1/messages',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer secret'
    },
    httpsAgent: agent,
    data: {
      "clientId": "ziswaf3",
      // "phone": "6289657528745",
      "phone": wa_number,
      "message": text,
    }
  };

  // const send = await axios.request(config)
  // .then((response) => {
  //   console.log("----> WA SEND", JSON.stringify(response.data));
  // })
  // .catch((error) => {
  //   console.log(error);
  // });

  // return send;
  return true;
};


module.exports = {
  sendWhatsapp,
};
