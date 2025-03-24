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

const generateTemplateProposalBayar = async ({ nama, formattedDate, formattedDana, bank_number, bank_account_name }) => {
  const content = `
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proposal Disetujui</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: auto;
            background: #ffffff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .content {
            font-size: 16px;
            line-height: 1.6;
        }
        .highlight {
            font-weight: bold;
            color: #2c3e50;
        }
        .footer {
            margin-top: 20px;
            font-size: 14px;
            text-align: center;
            color: #555;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">Proposal Disetujui</div>
        <div class="content">
            <p>Assalamu'alaikum, Wr Wb.</p>
            <p>Proposal atas nama <span class="highlight">${nama}</span> telah disetujui dan telah ditransfer pada <span class="highlight">${formattedDate}</span> sejumlah <span class="highlight">${formattedDana}</span> ke nomor rekening <span class="highlight">${bank_number}</span> a.n <span class="highlight">${bank_account_name}</span>.</p>
            <p>Terima kasih atas kepercayaannya.</p>
            <p>Wassalamu'alaikum Wr, Wb.</p>
        </div>
        <div class="footer">&copy; ZIS Indosat - Semua Hak Dilindungi</div>
    </div>
</body>
</html>

    `;

  return content;
};

const generateTemplateProposalCreate = async ({ nama, nik_mustahiq, program_title }) => {
  const content = `
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Konfirmasi Proposal</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: auto;
            background: #ffffff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            font-size: 18px;
            font-weight: bold;
            margin-bottom: 20px;
        }
        .content {
            font-size: 16px;
            line-height: 1.6;
        }
        .highlight {
            font-weight: bold;
            color: #2c3e50;
        }
        .footer {
            margin-top: 20px;
            font-size: 14px;
            text-align: center;
            color: #555;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">Konfirmasi Proposal</div>
        <div class="content">
            <p>Assalamu'alaikum, Wr Wb.</p>
            <p>Proposal atas nama <span class="highlight">${nama}</span> dan NIK <span class="highlight">${nik_mustahiq}</span> pada program <span class="highlight">${program_title}</span> telah kami terima.</p>
            <p>Mohon lakukan konfirmasi kepada kami apabila terjadi duplikasi maupun kesalahan pada proposal.</p>
            <p>Terima kasih.</p>
            <p>Wassalamu'alaikum Wr, Wb.</p>
        </div>
        <div class="footer">&copy; ZIS Indosat - Semua Hak Dilindungi</div>
    </div>
</body>
</html>
    `;

  return content;
};

const generateTemplateQurban = async ({ program_id, nama, formattedDate, no_wa, formattedDana, bankName, vaNumber, lokasi, detail_qurban, alokasi_hak, type, province, city, kecamatan, alamat, nik_karyawan }) => {
  const alokasiHakMapping = {
    "1": "Saya serahkan ke panitia untuk di distribusikan",
    "2": "Saya ambil di Kantor Pusat IOH",
    "3": "Dikirim ke rumah"
  };

  const tipePendaftarMapping = {
    "1": "Karyawan Aktif IOH",
    "2": "Pensiunan IOH",
    "3": "Mitra IOH"
  };

  const tipePendaftar = program_id === 97 ? tipePendaftarMapping[type] || "Tipe Tidak Diketahui" : null;
  const alokasiHak = alokasiHakMapping[alokasi_hak] || lokasi; // Ganti lokasi dengan alokasi hak jika program_id = 97

  const wordingAlamat = (alokasi_hak === "3")
    ? `<p>Berikut adalah informasi alamat lengkap untuk pengiriman:</p>`
    : "";

  const alamatLengkap = (alokasi_hak === "3")
    ? `
      ${wordingAlamat}
      <div class="alamat-details">
        <p><span class="highlight">Provinsi:</span> ${province}</p>
        <p><span class="highlight">Kota/Kabupaten:</span> ${city}</p>
        <p><span class="highlight">Kecamatan:</span> ${kecamatan}</p>
        <p><span class="highlight">Alamat:</span> ${alamat}</p>
      </div>
    `
    : "";

  const content = `
    <html>
    <head>
      <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: auto;
            background: #ffffff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            font-size: 16px;
            font-weight: bold;
            color: #e74c3c;
            margin-bottom: 20px;
        }
        .content {
            font-size: 12px;
            line-height: 1.6;
            color: #2c3e50;
        }
        .highlight {
            font-weight: bold;
            color: #d35400;
        }
        .footer {
            margin-top: 20px;
            font-size: 12px;
            text-align: center;
            color: #555;
            display: block !important;
        }
        .details, .alamat-details, .rincian {
            background: #f9f9f9;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
        }
        .details p, .alamat-details p, .rincian p {
            margin: 5px 0;
        }
        .cta {
            margin-top: 20px;
            text-align: center;
        }
        .cta a {
            display: inline-block;
            background-color: #e74c3c;
            color: #fff;
            padding: 10px 20px;
            border-radius: 5px;
            text-decoration: none;
            font-weight: bold;
        }
        .cta a:hover {
            background-color: #c0392b;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">Menunggu Pembayaran</div>
        <div class="content">
          <p>Terima kasih atas partisipasi kamu, pendaftaran kamu sudah kami terima.</p>
          <p>Mohon segera lakukan pembayaran dan jangan tinggalkan halaman sebelum pembayaran benar-benar selesai.</p>
          <p>Pastikan kembali nominal yang Anda kirimkan sesuai dengan data berikut:</p>
  
          <div class="details">
            <p><span class="highlight">Tanggal/Waktu:</span> ${formattedDate}</p>
            <p><span class="highlight">${program_id === 97 ? "Alokasi Hak" : "Lokasi Penyembelihan"}:</span> ${alokasiHak}</p>
            <p><span class="highlight">Nama:</span> ${nama}</p>
            ${tipePendaftar ? `<p><span class="highlight">Tipe Pendaftar:</span> ${tipePendaftar}</p>` : ""}
            ${type === "1" ? `<p><span class="highlight">NIK Karyawan:</span> ${nik_karyawan}</p>` : ""}
            <p><span class="highlight">No WhatsApp:</span> ${no_wa}</p>
            <p><span class="highlight">Nominal:</span> ${formattedDana}</p>
            <p><span class="highlight">Bank:</span> ${bankName}</p>
            <p><span class="highlight">VA Number:</span> ${vaNumber}</p>
          </div>
  
          ${alamatLengkap}

          <p><strong>Berikut adalah rincian qurban yang telah Anda daftarkan:</strong></p>
          <p>Pastikan kembali data berikut sudah sesuai dengan yang Anda inginkan. Jika ada kesalahan, segera hubungi admin.</p>

          <p><strong>Rincian Qurban:</strong></p>
          <div class="rincian">
            ${detail_qurban.map((item, index) => `
              <p><span class="highlight">#${index + 1}</span></p>
              <p><span class="highlight">Nama Mudohi:</span> ${item.nama_mudohi}</p>
              <p><span class="highlight">Paket Hewan:</span> ${item.paket_hewan}</p>
              <p><span class="highlight">Harga:</span> ${item.total}</p>
              <hr>
            `).join('')}
          </div>
  
          <p>Jika ada informasi yang tidak sesuai, harap hubungi admin kami.</p>
          <div class="cta">
            <a href="https://wa.me/085693318006">Hubungi Admin</a>
          </div>
          <div class="footer">
            <p>Salam,</p>
            <p><b>ZIS Indosat</b></p>
            <p>Panitia Qurban</p>
            <p>0856-9331-8006</p>
            <p><small>Email dikirim pada: ${formattedDate}</small></p>
          </div>
        </div>
      </div>
    </body>
    </html>
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
  generateTemplateProposalBayar,
  generateTemplateProposalCreate,
  generateTemplateQurban
};
