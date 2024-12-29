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
    pool: true, // Aktifkan mode pool email transport
    auth: {
      user: "admin@zisindosat.id",
      pass: "ziswaf2019",
    },
    disableUrlAccess: false,
    attachDataUrls: true,
  });

  try {
    const info = await transporter.sendMail({
      from: "admin@zisindosat.id",
      to: email,
      subject,
      html: html,
      attachments: [
        {
          filename: "document.pdf",
          path: pdfPath,
          contentType: "application/pdf",
        },
      ],
    });

    console.log("Message sent: %s", info.messageId);
    return info.messageId;
  } catch (error) {
    console.error("Error sending email: ", error.message);
    throw error;
  } finally {
    // transporter.close(); // Menutup koneksi setelah pengiriman
    console.log("Transporter connection closed.");
  }
};

const sendEmail = async ({ email, html, subject }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    pool: true, // Aktifkan mode pool
    auth: {
      user: "admin@zisindosat.id",
      pass: "ziswaf2019",
    },
    disableUrlAccess: false,
    attachDataUrls: true,
  });

  try {
    const info = await transporter.sendMail({
      from: "admin@zisindosat.id",
      to: email,
      subject,
      html: html,
    });

    console.log("Message sent: %s", info.messageId);
    return info.messageId;
  } catch (error) {
    console.error("Error sending email: ", error.message);
    throw error;
  } finally {
    // transporter.close(); // Menutup koneksi setelah selesai
    console.log("Transporter connection closed.");
  }
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
  const qrCodeImage = await QRCode.toDataURL(url);

  const kodePemesanan = tiket.kode_pemesanan;
  const metodePembayaran = tiket.metode_pembayaran;
  const vaNumber = tiket.va_number;
  const totalPembayaran = tiket.total_harga;


  console.log("liat tiket:", tiket);
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
                
            </div>
  
            <p style="font-size: 16px;">Berikut ini adalah tiket yang anda pesan :</p>
  
            <!-- Card untuk detail tiket -->
            <div style="
                border: 1px solid #ddd; padding: 20px; border-radius: 10px; 
                background-color: #fff; margin-bottom: 20px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                <h3 style="margin-bottom: 15px;">Detail Tiket</h3>
                ${tiket.detail_pemesanan_megakonser.map(
        (tiket, index) => `
                    <div style="margin-bottom: 10px;">
                        <p><strong>Kode Tiket:</strong> ${tiket.kode_tiket}</p>
                        <p><strong>Harga Tiket:</strong> Rp${tiket.tiket_konser.tiket_harga.toLocaleString(
          "id-ID"
        )}</p>
                    <p><strong>Jenis Tiket:</strong> ${tiket.tiket_konser_detail?.tiket_konser_detail_nama ?? 'N/A'}</p>

 <!-- Menggunakan tiket_konser_detail_nama -->
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

const generateTemplateExpiredMegaKonser = async ({ email, tiket }) => {
  const encodedEmail = Buffer.from(email).toString("base64");
  const url = `https://portal.zisindosat.id`;
  const qrCodeImage = await QRCode.toDataURL(url);

  const kodePemesanan = tiket.kode_pemesanan;
  const metodePembayaran = tiket.metode_pembayaran;
  const vaNumber = tiket.va_number;
  const totalPembayaran = tiket.total_harga;


  console.log("liat tiket:", tiket);
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
                <p><strong>Nama:</strong> ${tiket.nama}</p>
                <p><strong>Kode Pemesanan:</strong> ${kodePemesanan}</p>
                <p><strong>Metode Pembayaran:</strong> ${metodePembayaran}</p>
            
            </div>
  
            <p style="font-size: 16px;">Berikut ini adalah tiket yang anda pesan :</p>
  
            <!-- Card untuk detail tiket -->
            <div style="
                border: 1px solid #ddd; padding: 20px; border-radius: 10px; 
                background-color: #fff; margin-bottom: 20px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
                <h3 style="margin-bottom: 15px;">Detail Tiket</h3>
                ${tiket.detail_pemesanan_megakonser.map(
        (tiket, index) => `
                    <div style="margin-bottom: 10px;">
                        <p><strong>Kode Tiket:</strong> ${tiket.kode_tiket}</p>
                        <p><strong>Harga Tiket:</strong> Rp${tiket.tiket_konser.tiket_harga.toLocaleString(
          "id-ID"
        )}</p>
                    <p><strong>Jenis Tiket:</strong> ${tiket.tiket_konser_detail?.tiket_konser_detail_nama ?? 'N/A'}</p>

 <!-- Menggunakan tiket_konser_detail_nama -->
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

module.exports = {
  sendEmail,
  sendEmailWithPdf,
  generateTemplate,
  generateTemplateForgotEmail,
  generateTemplateMegaKonser,
  generateTemplateExpiredMegaKonser,
  generateTemplatePembayaran,
};
