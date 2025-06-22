// const axios = require("axios");
// const https = require("https");

// const sendWhatsapp = async ({ wa_number, text }) => {
//   const agent = new https.Agent({
//     rejectUnauthorized: false,
//   });

//   let config = {
//     method: "post",
//     url: "https://erpapi.zisindosat.id/wapi/send_message",
//     headers: {
//       "Content-Type": "application/json",
//       Authorization:
//         "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcm5hbWUiOiIxMjM0NTY3ODkiLCJlbWFpbCI6IjEyMzQ1Njc4OUB6aXNpbmRvc2F0LmlkIiwiaWF0IjoxNzIwMDEzODQ5LCJhdWQiOlsiMTIzNDU2Nzg5Il0sImlzcyI6InozcjBieXRlcyJ9.7Ooh3xUkhG-f_jAPNBCm7LxWV3E751W0JpgTN8ys-Ss",
//     },
//     httpsAgent: agent,
//     data: {
//       client_id: "4f7a1736329954633",
//       number: wa_number,
//       message: text,
//     },
//   };

//   const send = await axios
//     .request(config)
//     .then((response) => {
//       console.log("----> WA SEND", JSON.stringify(response.data));
//     })
//     .catch((error) => {
//       console.log(error);
//     });

//   return send;
//   // return true;
// };

// module.exports = {
//   sendWhatsapp,
// };

const axios = require("axios");
const https = require("https");
const fs = require("fs");
const FormData = require("form-data");

const sendWhatsapp = async ({ wa_number, text }) => {
  const agent = new https.Agent({
    rejectUnauthorized: false,
  });

  let config = {
    method: "post",
    url: "https://erpapi.zisindosat.id/wapi/send_message",
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcm5hbWUiOiIxMjM0NTY3ODkiLCJlbWFpbCI6IjEyMzQ1Njc4OUB6aXNpbmRvc2F0LmlkIiwiaWF0IjoxNzIwMDEzODQ5LCJhdWQiOlsiMTIzNDU2Nzg5Il0sImlzcyI6InozcjBieXRlcyJ9.7Ooh3xUkhG-f_jAPNBCm7LxWV3E751W0JpgTN8ys-Ss",
    },
    httpsAgent: agent,
    data: {
      client_id: "4f7a1736329954633",
      number: wa_number,
      message: text,
    },
  };

  const send = await axios
    .request(config)
    .then((response) => {
      console.log("----> WA SEND", JSON.stringify(response.data));
    })
    .catch((error) => {
      console.log(error);
    });

  return send;
};

/**
 * Kirim WhatsApp lewat Fonnte API
 * @param {Object} param0
 * @param {string} param0.wa_number - Nomor HP tujuan, misal: 08123456789
 * @param {string} param0.text - Isi pesan WA
 */
const sendFonnte = async ({ wa_number, text }) => {
  const payload = {
    target: wa_number, // contoh: "6281234567890"
    message: text,
  };

  const headers = {
    Authorization: "V41xrmX2cTcfMWZ49FbS", // ⛔ ganti ini dengan token asli kamu
    "Content-Type": "application/json", // ✅ penting agar Fonnte memproses JSON
  };

  try {
    const response = await axios.post("https://api.fonnte.com/send", payload, {
      headers,
    });

    console.log("---> FONNTE SEND:", response.data);
    return response.data;
  } catch (error) {
    console.error("FONNTE ERROR:", error.response?.data || error.message);
    return null;
  }
};
const sendFonnteMedia = async ({ wa_number, caption, filePath }) => {
  const form = new FormData();

  form.append("target", wa_number);

  // Cek ekstensi file
  const isPdf = filePath.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    form.append("message", caption); // untuk PDF gunakan message
  } else {
    form.append("caption", caption); // untuk gambar/video gunakan caption
  }

  form.append("file", fs.createReadStream(filePath)); // Kirim file sebagai stream

  const headers = {
    Authorization: "V41xrmX2cTcfMWZ49FbS",
    ...form.getHeaders(),
  };

  try {
    const response = await axios.post("https://api.fonnte.com/send", form, {
      headers,
    });

    console.log("✅ Media sent to WhatsApp:", response.data);
    return response.data;
  } catch (error) {
    console.error(
      "❌ Failed to send media via Fonnte:",
      error.response?.data || error.message
    );
    return null;
  }
};

module.exports = {
  sendWhatsapp,
  sendFonnte,
  sendFonnteMedia,
};
