const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const QRCode = require("qrcode");

const generatePdf = async ({ orderDetails }) => {
    const requiredFields = ['nama', 'kode_pemesanan', 'metode_pembayaran', 'total_harga', 'detail_pemesanan_megakonser'];
    
    for (const field of requiredFields) {
        if (!orderDetails[field]) {
            throw new Error(`Missing required field: ${field}`);
        }
    }

    const kode_pemesanan = orderDetails.kode_pemesanan

    const url = `myerp.zisindosat.id/tiketscan/${kode_pemesanan}`;
    let qrCodePath;
    try {
        qrCodePath = await QRCode.toDataURL(url);
    } catch (error) {
        console.error("Error generating QR code:", error);
        throw new Error('Could not generate QR code');
    }

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const filePath = path.join(__dirname, `../../uploads/output${kode_pemesanan}.pdf`);
        const writeStream = fs.createWriteStream(filePath);

        writeStream.on('error', (error) => {
            console.error('Error writing PDF:', error);
            reject(new Error('Error writing PDF file'));
        });

        doc.pipe(writeStream);

        const checkPageSpace = (requiredSpace) => {
            if (doc.y + requiredSpace > doc.page.height - doc.page.margins.bottom) {
                doc.addPage();
            }
        };

        doc.fontSize(24).text('Bukti Pembayaran Tiket', { align: 'center' });
        doc.moveDown(0.5);
        doc.rect(50, doc.y, 500, 2).fillColor('#000').fill();
        doc.moveDown(1);

        doc.fontSize(16).font('Helvetica-Bold').text("Assalamu'alaikum, Wr Wb.", { align: 'left' });
        doc.moveDown(0.5);
        doc.fontSize(14).text('Terima kasih telah melakukan pembelian tiket.', { align: 'left' });
        doc.moveDown(0.5);
        doc.text('Berikut ini adalah detail transaksi anda:', { align: 'left' });
        doc.moveDown(1);

        doc.roundedRect(50, doc.y, 500, 130, 10).stroke();
        doc.moveDown(1);
        doc.fontSize(16).fillColor('#007BFF').text('Detail Transaksi', { align: 'center' });
        doc.fillColor('black').moveDown(0.5);
        const leftMargin = 10;
       // Adjust this value for desired indentation

        doc.fontSize(12)
            .text(`Nama: ${orderDetails.nama}`, {  align: 'left', indent: leftMargin })
            .text(`Kode Pemesanan: ${orderDetails.kode_pemesanan}`, {  align: 'left', indent: leftMargin })
            .text(`Metode Pembayaran: ${orderDetails.metode_pembayaran}`, {  align: 'left', indent: leftMargin })
            // .text(`Nomor Virtual Account: ${orderDetails.va_number}`, { align: 'left', indent: leftMargin })
            .moveDown(2);
        

        const ticketBoxWidth = 500;
        doc.fontSize(16).fillColor('#007BFF').text('Detail Tiket', { align: 'center' });
        doc.fillColor('black').moveDown(0.5);

        orderDetails.detail_pemesanan_megakonser.forEach((tiket, index) => {
            const tiketDetailsHeight = 60;
            checkPageSpace(tiketDetailsHeight + 20);

            const tiketDetails = [
                `Kode Tiket: ${tiket.kode_tiket}`,
                `Harga Tiket: Rp ${tiket.tiket_konser.tiket_harga.toLocaleString("id-ID")}`,
                `Jenis Tiket: ${tiket.tiket_konser_detail.tiket_konser_detail_nama}`
            ];

            doc.roundedRect(50, doc.y, ticketBoxWidth, tiketDetailsHeight, 10).stroke();
            doc.moveDown(1);
            tiketDetails.forEach(line => {
              doc.fontSize(12).text(line, { indent: leftMargin });
          });

            if (index < orderDetails.detail_pemesanan_megakonser.length - 1) {
                doc.moveDown(1);
                doc.rect(60 + leftMargin, doc.y, 480 - leftMargin * 2, 1).fillColor('black').fill();
                doc.moveDown(1);
            }
        });

        checkPageSpace(40);
        doc.moveDown(2);
        doc.fontSize(16).fillColor('#FF5733').text(`Total Pembayaran: Rp ${orderDetails.total_harga.toLocaleString("id-ID")}`);
        doc.fillColor('black').moveDown(2);

        // Adding more space before QR code and footer
        checkPageSpace(150);
        doc.text('Tunjukkan Kode QR di bawah ini sebelum masuk venue di loket penukaran tiket:', { align: 'left' });
        doc.moveDown(1);

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

        doc.moveDown(9); // Add space after the QR code

        checkPageSpace(40);
        doc.fontSize(14).text('Terima kasih atas partisipasi anda.', { align: 'left' });
        doc.moveDown(0.5);
        doc.text('Wassalamu\'alaikum Wr, Wb', { align: 'left' });

        doc.end();

        writeStream.on('finish', () => {
            resolve(filePath);
        });
    });
};

module.exports = generatePdf;
