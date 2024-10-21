const express = require('express');
const QRCode = require('qrcode');
const app = express();
const { prisma } = require("../../prisma/client");

async function getIdPembelian(req, res) {
    const id = req.params.id; // pastikan Anda mendapatkan id dari request params

    try {
        const program = await prisma.pemesanan_megakonser.findUnique({
            where: {
                pemesanan_id: Number(id), // pastikan Anda menggunakan id di sini
            },
            select: {
                pemesanan_id: true, // pastikan pemesanan_id dipilih
                kode_pemesanan: true,
                total_harga:true,
            },
        });

        if (program) {
            // Mengirim respons dengan pemesanan_id dan pemesanan_title
            res.json(program);
        } else {
            // Jika tidak ditemukan
            res.status(404).json({ error: "Data not found" });
        }
    } catch (error) {
        // Jika terjadi error
        res.status(500).json({ error: "An error occurred" });
    }
};


    async function qrcode(req, res) {
        try {
            const pemesanan_id = req.query.pemesanan_id || 'default_id'; // Contoh penggantian jika pemesanan_id tidak tersedia
            const url = `https://example.com/pemesanan/${pemesanan_id}`; // Menggunakan template literal untuk URL

            // Membuat QR code sebagai Data URL
            const qrCodeImage = await QRCode.toDataURL(url);

            // Mengirim QR code sebagai image dalam respons HTML
            res.send(`<img src="${qrCodeImage}" alt="QR Code"/>`);
        } catch (err) {
            console.error('Error generating QR Code:', err);
            res.status(500).send('Internal Server Error');
        }
    };

    module.exports = {
        qrcode,
        getIdPembelian
    }
