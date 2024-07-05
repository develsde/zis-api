const axios = require("axios");
const https = require("https");

const sendWhatsapp = async ({ wa_number, text }) => {

  const agent = new https.Agent({
    rejectUnauthorized: false,
  });

  let config = {
    method: 'post',
    url: 'https://erpapi.zisindosat.id/wapi/send_message',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcm5hbWUiOiIxMjM0NTY3ODkiLCJlbWFpbCI6IjEyMzQ1Njc4OUB6aXNpbmRvc2F0LmlkIiwiaWF0IjoxNzIwMDEzODQ5LCJhdWQiOlsiMTIzNDU2Nzg5Il0sImlzcyI6InozcjBieXRlcyJ9.7Ooh3xUkhG-f_jAPNBCm7LxWV3E751W0JpgTN8ys-Ss'
    },
    httpsAgent: agent,
    data: {
      "client_d": "e84b1720148217601",
      // "phone": "6289657528745",
      "number": wa_number,
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
