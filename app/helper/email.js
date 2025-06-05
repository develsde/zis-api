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
    host: "mail.zisindosat.id",
    port: 465,
    secure: true,
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
    // service: "gmail",
    // pool: true, // Aktifkan mode pool
    host: "mail.zisindosat.id",
    port: 465,
    secure: true,
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

const generateTemplatePembayaran = async ({
  email,
  tiket,
  totalHargaFinal,
}) => {
  const encodedEmail = Buffer.from(email).toString("base64");
  const url = `https://portal.zisindosat.id`;
  const qrCodeImage = await QRCode.toDataURL(url);

  const kodePemesanan = tiket.kode_pemesanan;
  const infaq = tiket.infaq;
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
                ${tiket.detail_pemesanan_megakonser
                  .map(
                    (tiket, index) => `
                    <div style="margin-bottom: 10px;">
                        <p><strong>Kode Tiket:</strong> ${tiket.kode_tiket}</p>
                        <p><strong>Harga Tiket:</strong> Rp${tiket.tiket_konser.tiket_harga.toLocaleString(
                          "id-ID"
                        )}</p>
                    <p><strong>Jenis Tiket:</strong> ${
                      tiket.tiket_konser_detail?.tiket_konser_detail_nama ??
                      "N/A"
                    }</p>

 <!-- Menggunakan tiket_konser_detail_nama -->
                    </div>
                    ${
                      index < tiket.length - 1
                        ? '<hr style="margin: 10px 0; border-top: 1px solid #ddd;" />'
                        : ""
                    }
                `
                  )
                  .join("")}
                <p style="font-size: 18px; font-weight: bold; margin-top: 20px;">
    <strong>Infaq: Rp${Number(infaq || 0).toLocaleString("id-ID")}
</p>
<p style="font-size: 18px; font-weight: bold; margin-top: 10px;">
    Total Pembayaran: Rp${totalHargaFinal.toLocaleString("id-ID")}
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
                ${tiket.detail_pemesanan_megakonser
                  .map(
                    (tiket, index) => `
                    <div style="margin-bottom: 10px;">
                        <p><strong>Kode Tiket:</strong> ${tiket.kode_tiket}</p>
                        <p><strong>Harga Tiket:</strong> Rp${tiket.tiket_konser.tiket_harga.toLocaleString(
                          "id-ID"
                        )}</p>
                    <p><strong>Jenis Tiket:</strong> ${
                      tiket.tiket_konser_detail?.tiket_konser_detail_nama ??
                      "N/A"
                    }</p>

 <!-- Menggunakan tiket_konser_detail_nama -->
                    </div>
                    ${
                      index < tiket.length - 1
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

const generateTemplateProposalBayar = async ({
  nama,
  formattedDate,
  formattedDana,
  bank_number,
  bank_account_name,
}) => {
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

const generateTemplateProposalCreate = async ({
  nama,
  nik_mustahiq,
  program_title,
}) => {
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

const generateTemplateQurbanSuccess = async ({
  nama,
  formattedDate,
  formattedDana,
  detail_qurban,
  program_nama,
}) => {
  return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2 style="color: #28a745;">Pembayaran Berhasil</h2>
      <p>Assalamu’alaikum Wr. Wb. ${nama},</p>
      <p>Alhamdulillah, pembayaran Qurban Anda telah kami terima pada tanggal <strong>${formattedDate}</strong>.</p>

      <p><strong>Program:</strong> ${program_nama}<br>
      <strong>Total Pembayaran:</strong> ${formattedDana}</p>

      <h3>Detail Qurban Anda:</h3>
      <ul>
        ${detail_qurban
          .map(
            (d) => `
          <li>
            <strong>Nama Mudhohi:</strong> ${d.nama_mudohi}<br>
            <strong>Paket Hewan:</strong> ${d.paket_hewan}<br>
            <strong>Jumlah:</strong> ${d.qty}<br>
            <strong>Total:</strong> ${d.total}
          </li>
        `
          )
          .join("")}
      </ul>

      <p>Terima kasih telah berpartisipasi dalam program Qurban ZISWAF Indosat.</p>

      <p>Semoga Allah menerima amal ibadah kita semua. Aamiin.</p>

      <p>Wassalamu’alaikum Wr. Wb.</p>

      <p style="margin-top: 30px;">Hormat kami,<br><strong>ZISWAF Indosat</strong></p>
    </div>
  `;
};

const generateTemplateQurban = async ({
  program_id,
  nama,
  formattedDate,
  no_wa,
  formattedDana,
  bankName,
  vaNumber,
  lokasi,
  detail_qurban,
  alokasi_hak,
  type,
  province,
  city,
  kecamatan,
  alamat,
  nik_karyawan,
}) => {
  const alokasiHakMapping = {
    1: "Saya serahkan ke panitia untuk di distribusikan",
    2: "Saya ambil di Kantor Pusat IOH",
    3: "Dikirim ke rumah",
  };

  const tipePendaftarMapping = {
    1: "Karyawan Aktif IOH",
    2: "Pensiunan IOH",
    3: "Mitra IOH",
  };

  const tipePendaftar =
    program_id === 97
      ? tipePendaftarMapping[type] || "Tipe Tidak Diketahui"
      : null;
  const alokasiHak = alokasiHakMapping[alokasi_hak] || lokasi; // Ganti lokasi dengan alokasi hak jika program_id = 97

  const wordingAlamat =
    alokasi_hak === "3"
      ? `<p>Berikut adalah informasi alamat lengkap untuk pengiriman:</p>`
      : "";

  const alamatLengkap =
    alokasi_hak === "3"
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
            <p><span class="highlight">${
              program_id === 97 ? "Alokasi Hak" : "Lokasi Penyembelihan"
            }:</span> ${alokasiHak}</p>
            <p><span class="highlight">Nama:</span> ${nama}</p>
            ${
              tipePendaftar
                ? `<p><span class="highlight">Tipe Pendaftar:</span> ${tipePendaftar}</p>`
                : ""
            }
            ${
              type === "1"
                ? `<p><span class="highlight">NIK Karyawan:</span> ${nik_karyawan}</p>`
                : ""
            }
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
            ${detail_qurban
              .map(
                (item, index) => `
              <p><span class="highlight">#${index + 1}</span></p>
              <p><span class="highlight">Nama Mudohi:</span> ${
                item.nama_mudohi
              }</p>
              <p><span class="highlight">Paket Hewan:</span> ${
                item.paket_hewan
              }</p>
              <p><span class="highlight">Harga:</span> ${item.total}</p>
              <hr>
            `
              )
              .join("")}
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
const generateTemplatePemotonganQurban = async ({
  nama,
  formattedDate,
  lokasi,
  detail_qurban,
}) => {
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
            color: #27ae60;
            margin-bottom: 20px;
        }
        .content {
            font-size: 12px;
            line-height: 1.6;
            color: #2c3e50;
        }
        .highlight {
            font-weight: bold;
            color: #2980b9;
        }
        .footer {
            margin-top: 20px;
            font-size: 12px;
            text-align: center;
            color: #555;
        }
        .rincian {
            background: #f9f9f9;
            padding: 10px;
            border-radius: 5px;
            margin-top: 10px;
        }
        .rincian p {
            margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">Penyembelihan Qurban Telah Dilaksanakan</div>
        <div class="content">
          <p>Assalamu'alaikum warahmatullahi wabarakatuh,</p>
          <p>Dengan ini kami menginformasikan bahwa hewan qurban atas nama <strong>${nama}</strong> telah selesai disembelih pada:</p>
          <p><span class="highlight">Tanggal:</span> ${formattedDate}</p>
          <p><span class="highlight">Lokasi Penyembelihan:</span> ${lokasi}</p>

          <p><strong>Rincian Qurban:</strong></p>
          <div class="rincian">
            ${detail_qurban
              .map(
                (item, index) => `
              <p><span class="highlight">#${index + 1}</span></p>
              <p><span class="highlight">Nama Mudohi:</span> ${
                item.nama_mudohi
              }</p>
              <p><span class="highlight">Paket Hewan:</span> ${
                item.activity_paket?.kategori || "-"
              }</p>
              <hr>
            `
              )
              .join("")}
          </div>

          <p>Semoga qurban yang telah Bapak/Ibu tunaikan diterima oleh Allah SWT dan membawa keberkahan bagi kita semua.</p>
          <p>Terima kasih atas kepercayaan yang telah diberikan kepada panitia qurban ZIS Indosat.</p>
          
          <p>Wassalamu'alaikum warahmatullahi wabarakatuh.</p>

          <div class="footer">
            <p><b>ZIS Indosat</b></p>
            <p>Panitia Qurban</p>
            <p>0856-9331-8006</p>
            <p><small>Email ini dikirim pada: ${formattedDate}</small></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return content;
};

const generateTemplateVRFP = ({
  formattedDate,
  nama,
  no_wa,
  formattedDana,
  kategori, // contoh: "Virtual Run 5K"
  biaya_paket, // contoh: 200000
  zak, // infaq (angka)
  wak, // wakaf (angka)
  jasa_kirim, // teks (JNE, J&T, dll)
  alamat, // alamat lengkap
}) => {
  const formatCurrency = (num) =>
    Number(num).toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
    });

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <p>Terima kasih atas partisipasi kamu, pendaftaran kamu sudah kami terima.</p>
      <p>
        Mohon segera lakukan pembayaran dan jangan tinggalkan halaman sebelum pembayaran benar-benar selesai.<br />
        Pastikan kembali nominal yang anda kirimkan sesuai dengan data berikut:
      </p>

      <p><strong>Tanggal/waktu:</strong> ${formattedDate}<br />
      <strong>Nama:</strong> ${nama}<br />
      <strong>No WhatsApp:</strong> ${no_wa}</p>

      <p>
        <strong>Paket:</strong> ${kategori} - ${formatCurrency(
    biaya_paket
  )}<br />
        <strong>Infaq Palestina:</strong> ${
          zak ? formatCurrency(zak) : "Rp. ---"
        }<br />
        <strong>Wakaf Palestina:</strong> ${
          wak ? formatCurrency(wak) : "Rp. ---"
        }<br />
        <strong>Jumlah yang harus dibayarkan:</strong> ${formattedDana}
      </p>

      <p>
        <strong>Jasa Pengiriman:</strong> ${jasa_kirim || "---"}<br />
        <strong>Alamat:</strong> ${alamat || "---"}
      </p>

      <p>Jika ada informasi yang tidak sesuai harap hubungi admin kami.</p>

      <p>Salam,<br />
      <strong>ZIS INDOSAT</strong><br />
      Admin Virtual Run For Palestine<br />
     CS 1: 08558121111<br />
     CS 2: 08998387090</p>
    </div>
  `;
};
const generateTemplateVrfpSuccess = ({
  formattedDate,
  nama,
  no_wa,
  formattedDana,
  kategori,
  biaya_paket,
  zak,
  wak,
  jasa_kirim,
  alamat,
}) => {
  const formatCurrency = (num) =>
    Number(num).toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
    });

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <p><strong>Assalamu’alaikum ${nama},</strong></p>

      <p>Alhamdulillah, kami telah menerima pembayaranmu untuk kegiatan:</p>
      
      <p>
        <strong>Paket:</strong> ${kategori} - ${formatCurrency(
    biaya_paket
  )}<br />
        <strong>Infaq Palestina:</strong> ${
          zak ? formatCurrency(zak) : "Rp. ---"
        }<br />
        <strong>Wakaf Palestina:</strong> ${
          wak ? formatCurrency(wak) : "Rp. ---"
        }<br />
        <strong>Total Pembayaran:</strong> ${formattedDana}
      </p>

      <p>
        <strong>Tanggal Pembayaran:</strong> ${formattedDate}<br />
        <strong>No WhatsApp:</strong> ${no_wa}
      </p>

      <p>
        <strong>Jasa Pengiriman:</strong> ${jasa_kirim || "---"}<br />
        <strong>Alamat Pengiriman:</strong> ${alamat || "---"}
      </p>

      <p>Terima kasih atas partisipasimu. Semoga amal dan dukunganmu terhadap Palestina menjadi amal jariyah yang terus mengalir.</p>

      <p>Salam,<br />
      <strong>ZIS INDOSAT</strong><br />
      Admin Virtual Run For Palestine<br />
     CS 1: 08558121111<br />
     CS 2: 08998387090</p>
  `;
};
const generateTemplateExpiredVrfp = ({
  formattedDate,
  nama,
  no_wa,
  formattedDana,
  kategori,
  biaya_paket,
  zak,
  wak,
  jasa_kirim,
  alamat,
}) => {
  const formatCurrency = (num) =>
    Number(num).toLocaleString("id-ID", {
      style: "currency",
      currency: "IDR",
    });

  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <p><strong>Halo ${nama},</strong></p>

      <p>Kami mendeteksi bahwa pembayaranmu untuk kegiatan berikut belum berhasil atau telah <strong>expired</strong>:</p>

      <p>
        <strong>Paket:</strong> ${kategori} - ${formatCurrency(
    biaya_paket
  )}<br />
        <strong>Infaq Palestina:</strong> ${
          zak ? formatCurrency(zak) : "Rp. ---"
        }<br />
        <strong>Wakaf Palestina:</strong> ${
          wak ? formatCurrency(wak) : "Rp. ---"
        }<br />
        <strong>Total yang seharusnya dibayar:</strong> ${formattedDana}
      </p>

      <p>
        <strong>Tanggal Pendaftaran:</strong> ${formattedDate}<br />
        <strong>No WhatsApp:</strong> ${no_wa}
      </p>

      <p>
        <strong>Jasa Pengiriman:</strong> ${jasa_kirim || "---"}<br />
        <strong>Alamat:</strong> ${alamat || "---"}
      </p>

      <p>Silakan lakukan pendaftaran ulang untuk mendapatkan tautan pembayaran baru. Jika ada kendala, hubungi admin kami.</p>

      <p>Terima kasih atas niat baikmu dalam mendukung program kami.</p>

      <p>Salam,<br />
      <strong>ZIS INDOSAT</strong><br />
      Admin Virtual Run For Palestine<br />
     CS 1: 08558121111<br />
     CS 2: 08998387090</p>
  `;
};

const generateTemplateQurbanExpired = ({
  nama,
  formattedDate,
  formattedDana,
  program_nama,
  detail_qurban,
}) => {
  const detailItems = detail_qurban
    .map(
      (item, index) => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${index + 1}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${
          item.nama_mudohi
        }</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${
          item.paket_hewan
        }</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.qty}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${item.total}</td>
      </tr>`
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
      <p>Assalamu'alaikum, <strong>${nama}</strong>,</p>

      <p>Kami ingin menginformasikan bahwa transaksi Qurban Anda melalui program <strong>${program_nama}</strong> dengan total donasi sebesar <strong>${formattedDana}</strong> pada tanggal <strong>${formattedDate}</strong> <strong>tidak berhasil diselesaikan dalam waktu yang ditentukan</strong>.</p>

      <p>Detail transaksi Anda adalah sebagai berikut:</p>

      <table style="border-collapse: collapse; width: 100%; margin-top: 10px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="padding: 8px; border: 1px solid #ddd;">No</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Nama Mudhohi</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Paket Hewan</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Qty</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${detailItems}
        </tbody>
      </table>

      <p>Jika Anda masih ingin melanjutkan donasi Qurban, silakan lakukan pemesanan ulang melalui platform kami. Kami siap membantu Anda kapan pun dibutuhkan.</p>

      <p>Terima kasih atas perhatian dan kepercayaan Anda.</p>

      <p>Wassalamu'alaikum warahmatullahi wabarakatuh,</p>
      <p><strong>ZISWAF Indosat</strong></p>
    </div>
  `;
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
  generateTemplateQurban,
  generateTemplateQurbanSuccess,
  generateTemplateQurbanExpired,
  generateTemplateVRFP,
  generateTemplateVrfpSuccess,
  generateTemplateExpiredVrfp,
  generateTemplatePemotonganQurban,
};
