const nodemailer = require("nodemailer");
const { qrcode } = require("../controllers/controller-qrcode");
const { getIdPembelian } = require("../controllers/controller-qrcode")

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
    const qrCodeImage = await QRCode.toDataURL(url); // Membuat QR code dari URL

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
  generateEmailPembelian
};
