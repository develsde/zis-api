const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const QRCode = require("qrcode");

const generatePdf = async ({ orderDetails }) => {
  // Memastikan bahwa orderDetails berisi data yang diperlukan
  const requiredFields = ['nama', 'kode_pemesanan', 'metode_pembayaran', 'va_number', 'total_harga', 'detail_pemesanan_megakonser'];

  for (const field of requiredFields) {
    if (!orderDetails[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Generate the QR code
  const url = `https://portal.zisindosat.id`;
  let qrCodePath;
  try {
    qrCodePath = await QRCode.toDataURL(url);
  } catch (error) {
    console.error("Error generating QR code:", error);
    throw new Error('Could not generate QR code');
  }

  return new Promise((resolve, reject) => {
    // Mengatur ukuran dokumen menjadi A4
    const doc = new PDFDocument({ size: 'A4' });
    const filePath = path.join(__dirname, '../../uploads/output.pdf');
    const writeStream = fs.createWriteStream(filePath);

    // Error handling for the write stream
    writeStream.on('error', (error) => {
      console.error('Error writing PDF:', error);
      reject(new Error('Error writing PDF file'));
    });

    doc.pipe(writeStream);

    // Bagian Header dengan Logo (Opsional)
    // doc.image('logo.png', 50, 45, { width: 50 });
    doc.fontSize(20).text('Bukti Pembayaran Tiket', 110, 57, { align: 'center' });
    doc.moveDown(2);

    // Memberi Garis Pembatas
    doc.rect(50, doc.y, 500, 2).fillColor('#000').fill();
    doc.moveDown(1.5);

    // Bagian Salam
    doc.fontSize(16).font('Helvetica-Bold').text("Assalamu'alaikum, Wr Wb.", { align: 'left' });
    doc.moveDown(0.5);
    doc.fontSize(14).text('Terima kasih telah melakukan pembelian tiket.', { align: 'left' });
    doc.moveDown(0.5);
    doc.text('Berikut ini adalah detail transaksi anda:', { align: 'left' });
    doc.moveDown(1);

    // Kotak Detail Transaksi
    doc.roundedRect(50, doc.y, 500, 130, 10).stroke();
    doc.moveDown(1);
    doc.fontSize(16).fillColor('#007BFF').text('Detail Transaksi', { align: 'center' });
    doc.fillColor('black').moveDown(0.5);
    doc.fontSize(12).text(`Nama: ${orderDetails.nama}`);
    doc.text(`Kode Pemesanan: ${orderDetails.kode_pemesanan}`);
    doc.text(`Metode Pembayaran: ${orderDetails.metode_pembayaran}`);
    doc.text(`Nomor Virtual Account: ${orderDetails.va_number}`);
    doc.moveDown(4);

    // Kotak Detail Tiket
    const ticketBoxWidth = 500; // Lebar tetap untuk kotak tiket
    doc.roundedRect(50, doc.y, ticketBoxWidth, 180, 10).stroke();
    doc.moveDown(1);
    doc.fontSize(16).fillColor('#007BFF').text('Detail Tiket', { align: 'center' });
    doc.fillColor('black').moveDown(0.5);

    orderDetails.detail_pemesanan_megakonser.forEach((tiket, index) => {
      const tiketDetails = [
        `Kode Tiket: ${tiket.kode_tiket}`,
        `Harga Tiket: Rp ${tiket.tiket_konser.tiket_harga.toLocaleString("id-ID")}`,
        `Jenis Tiket: ${tiket.tiket_konser.tiket_nama}`
      ];

      // Menghitung tinggi kotak berdasarkan jumlah baris
      const maxLineWidth = Math.max(...tiketDetails.map(line => doc.widthOfString(line)));
      const tiketBoxHeight = 3 * 15 + 10; // Estimasi tinggi untuk 3 baris + jarak tambahan

      // Gambarkan kotak dengan tinggi yang disesuaikan
      doc.roundedRect(50, doc.y, maxLineWidth + 20, tiketBoxHeight, 10).stroke(); // Menambahkan padding di kiri dan kanan
      doc.moveDown(1);
      
      tiketDetails.forEach(line => {
        doc.fontSize(12).text(line);
      });

      // Tambahkan pemisah untuk tiket lebih dari 1
      if (index < orderDetails.detail_pemesanan_megakonser.length - 1) {
        doc.moveDown(1); // Jarak lebih untuk pemisah
        doc.rect(60, doc.y, 480, 1).fillOpacity(0.5).fillColor('gray').fill();
        doc.moveDown(1); // Jarak lebih setelah pemisah
      }
    });

    // Total Pembayaran dengan Warna Menonjol
    doc.moveDown(2); // Tambahkan jarak lebih sebelum total pembayaran
    doc.fontSize(16).fillColor('#FF5733').text(`Total Pembayaran: Rp ${orderDetails.total_harga.toLocaleString("id-ID")}`);
    doc.fillColor('black').moveDown(2); // Jarak setelah total pembayaran

    // QR Code
    doc.text('Tunjukkan Kode QR di bawah ini sebelum masuk venue di loket penukaran tiket:', { align: 'left' });
    doc.moveDown(1);
    // Insert the QR code image
    const qrImage = Buffer.from(qrCodePath.split(",")[1], 'base64');
    try {
      doc.image(qrImage, {
        fit: [150, 150],
        align: 'center',
      });
    } catch (error) {
      console.error('Error inserting QR code into PDF:', error);
      reject(new Error('Error inserting QR code into PDF'));
    }
    doc.moveDown(2);

    // Footer
    doc.fontSize(14).text('Terima kasih atas partisipasi anda.', { align: 'left' });
    doc.moveDown();
    doc.text('Wassalamu\'alaikum Wr, Wb', { align: 'left' });

    // Mengakhiri dan menghasilkan PDF
    doc.end();

    writeStream.on('finish', () => {
      resolve(filePath);
    });
  });
};

module.exports = generatePdf;