const nodemailer = require("nodemailer");
const { getIdPembelian } = require("./qrcode");
const QRCode = require("qrcode");
const { text } = require("body-parser");
const { password } = require("../../config/config.db");
const midtransClient = require("midtrans-client");
const { generatePdf } = require("../helper/pdf");
const fs = require("fs");
const path = require("path");
// const snap = require('midtrans-client');

var serverkeys = process.env.SERVER_KEY;

let snap = new midtransClient.Snap({
  isProduction: false,
  serverKey: serverkeys,
});

const sendEmailWithPdf = async ({ email, html, subject, pdfPath }) => {
  console.log("Apa Path nya? ", pdfPath);
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "admin@zisindosat.id",
      pass: "ziswaf2019",
    },
    disableUrlAccess: false,
    attachDataUrls: true,
  });

  const info = await transporter.sendMail({
    from: "admin@zisindosat.id",
    to: email,
    subject,
    html: html,
    attachments: [
      {
        filename: 'document.pdf',
        path: pdfPath,
        contentType: 'application/pdf'
      }
    ]
  });

  console.log("Message sent: %s", info.messageId);

  return info.messageId;
};

const sendEmail = async ({ email, html, subject }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "admin@zisindosat.id",
      pass: "ziswaf2019",
    },
    disableUrlAccess: false,
    attachDataUrls: true,
  });

  const info = await transporter.sendMail({
    from: "admin@zisindosat.id",
    to: email,
    subject,
    html: html
  });

  console.log("Message sent: %s", info.messageId);

  return info.messageId;
};

const generateTemplate = ({ email, password }) => {
  const encodedEmail = Buffer.from(email).toString("base64");
  const url = `https://portal.zisindosat.id/verifikasi?akun=${encodedEmail}`;

  const content = `
  <p>Assalamu'alaikum, Wr Wb.</p>
  <p>Terima Kasih Telah Mendaftar Ke Ziswaf INDOSAT.</p>
  <p>Berikut ini adalah detail login anda :</p>
  <p>Username: ${email}</p>
  <p>Password: ${password}</p>
  <p>Untuk melanjutkan proses registrasi dan agar anda bisa melakukan login, silahkan lakukan Verifikasi terlebih
     dahulu, dengan melakukan klik pada link berikut</p>
  <br />
  <a href="${url}"><strong>VERIFIKASI AKUN</strong></a>
  <br />
  <p>Terima kasih atas partisipasi anda.</p>
  <p>Wassalamu'alaikum Wr, Wb</p>
`;

  return content;
};

const generateTemplateForgotEmail = ({ email, token }) => {
  const encodedEmail = Buffer.from(email).toString("base64");
  const url = `https://portal.zisindosat.id/reset-password?akun=${encodedEmail}&token=${token}`;

  const content = `
  <p>Assalamu'alaikum, Wr Wb.</p>
  <p>Anda telah melakukan permintaan untuk melakukan reset password.</p>
  <p>Untuk melanjutkan proses reset password, silahkan klik link berikut:</p>
  <br />
  <a href="${url}"><strong>RESET PASSWORD</strong></a>
  <br />
  <p>Terima kasih atas partisipasi anda.</p>
  <p>Wassalamu'alaikum Wr, Wb</p>
 `;

  return content;
};

const generateTemplatePembayaran = async ({ email, tiket }) => {
  const encodedEmail = Buffer.from(email).toString("base64");
  const url = `https://portal.zisindosat.id`;
  // const pdfFileName = document.pdf; // Nama file yang lebih deskriptif

  console.log("lihat tiket:", tiket);
  // Data dummy untuk kode pemesanan, metode pembayaran, dan nomor virtual account
  const kodePemesanan = tiket.kode_pemesanan;
  const metodePembayaran = tiket.metode_pembayaran;
  const vaNumber = tiket.va_number;
  const qrCodeImage = await QRCode.toDataURL(url);

  const totalPembayaran = tiket.total_harga;

  const content = `
        <div style="font-family: 'Arial, sans-serif'; padding: 20px; background-color: #f4f4f4;">
            <p style="font-size: 16px;">Assalamu'alaikum, Wr Wb.</p>
            <p style="font-size: 16px;">Mohon Melakukan Pembayaran Tiket.</p>
            <p style="font-size: 16px;">Berikut ini adalah detail transaksi anda :</p>
  
            <!-- Card untuk detail transaksi -->
            <div style="
                border: 1px solid #ddd; padding: 20px; border-radius: 10px; 
                background-color: #fff; margin-bottom: 20px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                <h3 style="margin-bottom: 15px;">Detail Transaksi</h3>
                <p><strong>Nama:</strong> ${tiket.nama}</p>
                <p><strong>Kode Pemesanan:</strong> ${kodePemesanan}</p>
                <p><strong>Metode Pembayaran:</strong> ${metodePembayaran}</p>
                <p><strong>Nomor Virtual Account:</strong> ${vaNumber}</p>
            </div>
  
            <p style="font-size: 16px;">Berikut ini adalah tiket yang anda pesan :</p>
  
            <!-- Card untuk detail tiket -->
            <div style="
                border: 1px solid #ddd; padding: 20px; border-radius: 10px; 
                background-color: #fff; margin-bottom: 20px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                <h3 style="margin-bottom: 15px;">Detail Tiket</h3>
                ${tiket.detail_pemesanan_megakonser
      .map(
        (tiket, index) => `
                    <div style="margin-bottom: 10px;">
                        <p><strong>Kode Tiket:</strong> ${tiket.kode_tiket}</p>
                        <p><strong>Harga Tiket:</strong> Rp${tiket.tiket_konser.tiket_harga.toLocaleString(
          "id-ID"
        )}</p>
                        <p><strong>Jenis Tiket:</strong> ${tiket.tiket_konser.tiket_nama
          }</p>
                    </div>
                    ${index < tiket.length - 1
            ? '<hr style="margin: 10px 0; border-top: 1px solid #ddd;" />'
            : ""
          }
                `
      )
      .join("")}
                <p style="font-size: 18px; font-weight: bold; margin-top: 20px;">
                    Total Pembayaran: Rp${totalPembayaran.toLocaleString(
        "id-ID"
      )}
                </p>
            </div>
            <p style="font-size: 16px;">Mohon melakukan pembayaran sebelum batas waktu yang sudah ditentukan.</p>
            <p style="font-size: 16px;">Wassalamu'alaikum Wr, Wb</p>\
        </div>
    `;

  return content;
};

const generateTemplateMegaKonser = async ({ email, tiket }) => {
  const encodedEmail = Buffer.from(email).toString("base64");
  const url = `https://portal.zisindosat.id`;
  // const pdfFileName = document.pdf; // Nama file yang lebih deskriptif

  console.log("lihat tiket:", tiket);
  // Data dummy untuk kode pemesanan, metode pembayaran, dan nomor virtual account
  const kodePemesanan = tiket.kode_pemesanan;
  const metodePembayaran = tiket.metode_pembayaran;
  const vaNumber = tiket.va_number;
  const qrCodeImage = await QRCode.toDataURL(url);

  const totalPembayaran = tiket.total_harga;

  const content = `
        <div style="font-family: 'Arial, sans-serif'; padding: 20px; background-color: #f4f4f4;">
            <p style="font-size: 16px;">Assalamu'alaikum, Wr Wb.</p>
            <p style="font-size: 16px;">Pembayaran Tiket Telah Berhasil.</p>
            <p style="font-size: 16px;">Berikut ini adalah detail transaksi anda :</p>
  
            <!-- Card untuk detail transaksi -->
            <div style="
                border: 1px solid #ddd; padding: 20px; border-radius: 10px; 
                background-color: #fff; margin-bottom: 20px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                <h3 style="margin-bottom: 15px;">Detail Transaksi</h3>
                <p><strong>Nama:</strong> ${tiket.nama}</p>
                <p><strong>Kode Pemesanan:</strong> ${kodePemesanan}</p>
                <p><strong>Metode Pembayaran:</strong> ${metodePembayaran}</p>
                <p><strong>Nomor Virtual Account:</strong> ${vaNumber}</p>
            </div>
            <br/>
            <p style="font-size: 16px;">
                <b>Unduh ampiran dibawah ini dan tunjukkan kode QR sebelum masuk avenue di tempat penukaran tiket yang tersedia di lokasi konser.</b>
            </p>
            <p style="font-size: 16px;">Terima kasih atas partisipasi anda.</p>
            <p style="font-size: 16px;">Wassalamu'alaikum Wr, Wb</p>\
        </div>
    `;

  return content;
};

const generateTemplateExpiredMegaKonser = async ({ email, password }) => {
  const encodedEmail = Buffer.from(email).toString("base64");
  const url = `https://portal.zisindosat.id`;

  // Data dummy untuk kode pemesanan, metode pembayaran, dan nomor virtual account
  const kodePemesanan = "ABC123";
  const metodePembayaran = "Transfer Bank";
  const vaNumber = "1234567890";
  const qrCodeImage = await QRCode.toDataURL(url);

  // Data dummy untuk tiket yang dipesan
  const tiketDipesan = [
    { kodeTiket: "TK001", hargaTiket: 250000, jenisTiket: "VIP" },
    { kodeTiket: "TK002", hargaTiket: 150000, jenisTiket: "Reguler" },
    { kodeTiket: "TK003", hargaTiket: 100000, jenisTiket: "Diskon" },
  ];

  // Hitung total pembayaran
  const totalPembayaran = tiketDipesan.reduce(
    (total, tiket) => total + tiket.hargaTiket,
    0
  );

  const content = `
      <div style="font-family: 'Arial, sans-serif'; padding: 20px; background-color: #f4f4f4;">
          <p style="font-size: 16px;">Assalamu'alaikum, Wr Wb.</p>
          <p style="font-size: 16px;">Pembayaran Tiket Telah Kadaluarsa.</p>
          <p style="font-size: 16px;">Berikut ini adalah detail transaksi anda :</p>

          <!-- Card untuk detail transaksi -->
          <div style="
              border: 1px solid #ddd; padding: 20px; border-radius: 10px; 
              background-color: #fff; margin-bottom: 20px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
              <h3 style="margin-bottom: 15px;">Detail Transaksi</h3>
              <p><strong>Nama:</strong> ${email}</p>
              <p><strong>Kode Pemesanan:</strong> ${kodePemesanan}</p>
              <p><strong>Metode Pembayaran:</strong> ${metodePembayaran}</p>
              <p><strong>Nomor Virtual Account:</strong> ${vaNumber}</p>
          </div>

          <p style="font-size: 16px;">Berikut ini adalah tiket yang anda pesan :</p>

          <!-- Card untuk detail tiket -->
          <div style="
              border: 1px solid #ddd; padding: 20px; border-radius: 10px; 
              background-color: #fff; margin-bottom: 20px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
              <h3 style="margin-bottom: 15px;">Detail Tiket</h3>
              ${tiketDipesan
      .map(
        (tiket, index) => `
                  <div style="margin-bottom: 10px;">
                      <p><strong>Kode Tiket:</strong> ${tiket.kodeTiket}</p>
                      <p><strong>Harga Tiket:</strong> Rp${tiket.hargaTiket.toLocaleString(
          "id-ID"
        )}</p>
                      <p><strong>Jenis Tiket:</strong> ${tiket.jenisTiket}</p>
                  </div>
                  ${index < tiketDipesan.length - 1
            ? '<hr style="margin: 10px 0; border-top: 1px solid #ddd;" />'
            : ""
          }
              `
      )
      .join("")}
              <p style="font-size: 18px; font-weight: bold; margin-top: 20px;">
                  Total Pembayaran: Rp${totalPembayaran.toLocaleString("id-ID")}
              </p>
          </div>
      </div>
  `;

  return content;
};

module.exports = {
  sendEmail,
  sendEmailWithPdf,
  generateTemplate,
  generateTemplateForgotEmail,
  generateTemplateMegaKonser,
  generateTemplateExpiredMegaKonser,
  generateTemplatePembayaran,
};
