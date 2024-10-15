const nodemailer = require("nodemailer");
const { getIdPembelian } = require("./qrcode")
const QRCode = require('qrcode');
const { text } = require("body-parser");

const sendEmail = async ({ email, html, subject }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "admin@zisindosat.id",
      pass: "ziswaf2019",
    },
  });

  const info = await transporter.sendMail({
    from: "admin@zisindosat.id",
    to: email,
    subject,
    html: html,
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

const generateTemplateMegaKonser = async ({ email, password }) => {
  const encodedEmail = Buffer.from(email).toString("base64");
  const url = `https://portal.zisindosat.id/verifikasi?akun=${encodedEmail}`;

  // Data dummy untuk kode pemesanan, metode pembayaran, dan nomor virtual account
  const kodePemesanan = "ABC123";
  const metodePembayaran = "Transfer Bank";
  const vaNumber = "1234567890";
  
  // Membuat QR code dari URL
  const qrCodeImage = await QRCode.toDataURL(url); // Tunggu hasil promise
  

  // Data dummy untuk tiket yang dipesan
  const tiketDipesan = [
    { kodeTiket: "TK001", hargaTiket: 250000, jenisTiket: "VIP" },
    { kodeTiket: "TK002", hargaTiket: 150000, jenisTiket: "Reguler" },
    { kodeTiket: "TK003", hargaTiket: 100000, jenisTiket: "Diskon" },
  ];

  // Hitung total pembayaran
  const totalPembayaran = tiketDipesan.reduce((total, tiket) => total + tiket.hargaTiket, 0);

  const content = `
      <div style="font-family: 'Arial, sans-serif'; padding: 20px; background-color: #f4f4f4;">
          <p style="font-size: 16px;">Assalamu'alaikum, Wr Wb.</p>
          <p style="font-size: 16px;">Terima Kasih Telah Melakukan Pembelian Tiket Mega Konser Indosat.</p>
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
              ${tiketDipesan.map((tiket, index) => `
                  <div style="margin-bottom: 10px;">
                      <p><strong>Kode Tiket:</strong> ${tiket.kodeTiket}</p>
                      <p><strong>Harga Tiket:</strong> Rp${tiket.hargaTiket.toLocaleString('id-ID')}</p>
                      <p><strong>Jenis Tiket:</strong> ${tiket.jenisTiket}</p>
                  </div>
                  ${index < tiketDipesan.length - 1 ? '<hr style="margin: 10px 0; border-top: 1px solid #ddd;" />' : ''}
              `).join('')}
              <p style="font-size: 18px; font-weight: bold; margin-top: 20px;">
                  Total Pembayaran: Rp${totalPembayaran.toLocaleString('id-ID')}
              </p>
          </div>

          <p style="font-size: 16px;">
              <b>Tunjukkan Kode QR dibawah ini sebelum masuk avenue di loket penukaran tiket yang tersedia di lokasi konser.</b>
          </p>
          <br />
        
          <img src="${qrCodeImage}" alt="QR Code" style="max-width: 50%; height: auto;"/>
          <br /><br />
          <p style="font-size: 16px;">Terima kasih atas partisipasi anda.</p>
          <p style="font-size: 16px;">Wassalamu'alaikum Wr, Wb</p>
      </div>
  `;

  return content;
};
 
// Contoh penggunaan
(async () => {
  const email = "example@example.com"; // Ganti dengan email yang diinginkan
  const template = await generateTemplateMegaKonser({ email, password: "dummyPassword" });
  console.log(template);
})();

const generateEmailPembelian = ({ qrcode, kode_pemesanan, total_harga }) => {
  const content = `
    <p>Assalamu'alaikum, Wr Wb</p>
    <p>Pembayaran Tiket berhasil</p>
    <p>Berikut QR Code Untuk Penukaran Tiket</p>
    <p><img src="${qrcode}" alt="QR Code" /></p>
    <p>Detail Pemesanan:</p>
    <p>Order Number: ${kode_pemesanan}</p> <!-- Menggunakan variabel kode_pemesanan -->
    <p>Total Harga: ${total_harga}</p> <!-- Menggunakan variabel total_harga -->
    <p>Terimakasih Atas Partisipasi Dalam Konser, Enjoy The Show</p>
  `;

  return content;
};



const sendEmailWithQRCode = async (req, res) => {
  const pemesanan_id = req.params.id; // Ambil ID dari params
  const email = req.body.email; // Ambil email dari body permintaan

  try {
    // Dapatkan detail pemesanan menggunakan ID
    const response = await getIdPembelian({ params: { id: pemesanan_id } });

    // Cek apakah berhasil mengambil data
    if (response.error) {
      return res.status(404).json({ error: response.error });
    }

    const { kode_pemesanan, total_harga } = response; // Dapatkan kode pemesanan dan total harga
    const url = `https://example.com/pemesanan/${pemesanan_id}`;
    const qrCodeImage = await QRCode.toString(text); // Membuat QR code dari URL

    const emailContent = generateEmailPembelian({
      qrcode: qrCodeImage,
      kodePemesanan: kode_pemesanan, // Menggunakan kode pemesanan
      total_harga,
    });

    await sendEmail({
      email,
      subject: 'Pembayaran Tiket Berhasil',
      html: emailContent,
    });

    console.log('Email with QR code sent successfully');
    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email with QR code:', error);
    res.status(500).json({ error: 'An error occurred while sending the email' });
  }

};


module.exports = {
  sendEmail,
  generateTemplate,
  generateTemplateForgotEmail,
  generateEmailPembelian,
  sendEmailWithQRCode,
  generateTemplateMegaKonser
};
