const fs = require("fs");
const path = require("path");
const PDFKit = require("pdfkit");

const generatePdf = (orderDetails) => {
  return new Promise((resolve, reject) => {
    const dir = path.join(__dirname, "../../uploads");

    if (!fs.existsSync(dir)) {
      console.log("Folder uploads tidak ada, membuat folder...");
      fs.mkdirSync(dir, { recursive: true });
      console.log("Folder uploads berhasil dibuat.");
    } else {
      console.log("Folder uploads sudah ada.");
    }

    const filePath = path.join(dir, "document.pdf"); // Memperbaiki penempatan file
    const doc = new PDFKit();
    const writeStream = fs.createWriteStream(filePath);

    doc.pipe(writeStream);

    // Validasi struktur orderDetails
    if (
      !orderDetails ||
      !orderDetails.total_harga ||
      !Array.isArray(orderDetails.tiket)
    ) {
      return reject(
        new Error("Data order details tidak lengkap atau tidak valid")
      );
    }

    // Tambahkan konten ke PDF
    doc.fontSize(25).text("Order Details", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text(`Order Number: ${orderDetails.kode_pemesanan}`);

    // Validasi dan cetak total_harga
    const totalHarga =
      orderDetails.total_harga !== undefined ? orderDetails.total_harga : 0;
    doc.text(`Total Price: Rp ${totalHarga.toLocaleString("id-ID")}`);

    // Menambahkan detail tiket
    doc.moveDown();
    doc.fontSize(18).text("Ticket Details:", { underline: true });
    orderDetails.tiket.forEach((ticket) => {
      doc.moveDown();
      doc.fontSize(16).text(`Kode Tiket: ${ticket.kodeTiket}`);

      // Validasi harga tiket
      const hargaTiket =
        ticket.hargaTiket !== undefined ? ticket.hargaTiket : 0;
      doc.text(`Harga Tiket: Rp ${hargaTiket.toLocaleString("id-ID")}`);

      doc.text(`Jenis Tiket: ${ticket.jenisTiket}`);
    });

    doc.end();

    writeStream.on("finish", () => {
      console.log("PDF created successfully at:", filePath);
      console.log(`https://api.zisindosat.id/public/uploads/${fileName}`)
      resolve(filePath);
    });

    writeStream.on("error", (error) => {
      console.error("Error writing PDF:", error);
      reject(error);
    });
  });
};

module.exports = generatePdf;