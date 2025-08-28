const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");

const { customAlphabet } = require("nanoid");
const { z, date } = require("zod");
const { checkImkas } = require("../helper/imkas");
const { equal } = require("assert");

const numberWithCommas = (num) => {
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

module.exports = {
  async checkTotalMustahiq(req, res) {
    try {
      // Hitung total mustahiq
      const totalMustahiq = await prisma.user.count({
        where: {
          NOT: { mustahiq_id: null },
        },
      });
      if (!totalMustahiq) {
        return res.status(404).json({
          message: "Ambil Total Mustahiq Gagal Dilakukan",
        });
      }

      let arrIdProposal = [];
      let arrIdMitra = [];
      let arrId = [];
      let arrCurrentId = [];

      const tahun = new Date().getFullYear();

      // ambil bulan dari body kalau ada, kalau tidak pakai bulan berjalan
      const bulan =
        req.query?.bulan &&
        Number(req.query.bulan) >= 1 &&
        Number(req.query.bulan) <= 12
          ? Number(req.query.bulan)
          : new Date().getMonth() + 1;

      // Proposal approved (all time di tahun berjalan)
      const getAllId = await prisma.$queryRaw`
      select p.id as id, u.mustahiq_id
      from proposal p 
      join user u on u.user_id = p.user_id 
      where p.approved = 1
      and u.mustahiq_id is not null 
      and YEAR(p.create_date) = ${tahun}
      group by p.id, u.mustahiq_id;`;

      const getCurrentId = getAllId;

      getAllId.map((item) => {
        arrIdProposal.push(item.id);
        arrId.push(item.id);
      });
      getCurrentId.map((item) => arrCurrentId.push(item.id));

      // 🔹 Hitung mustahiq penerima manfaat (distinct mustahiq_id yang punya proposal approved)
      const mustahiqPenerimaManfaat = new Set(
        getAllId.map((item) => item.mustahiq_id)
      ).size;

      // Total Muzaki
      const totalMuzaki = await prisma.user.count({
        where: { user_type: 11 },
      });

      // Total Muwakif
      const totalMuwakif = await prisma.user.count({
        where: { user_type: 15 },
      });

      // Semua mitra mustahiq
      const getAllMitraProp = await prisma.$queryRaw`
      select p.id as id, count(p.id) as jumlah
      from mitra p 
      join user u on u.user_id = p.mitra_user_id 
      where u.mustahiq_id is not null 
      and YEAR(p.created_date) = ${tahun}
      group by p.id;`;

      getAllMitraProp.map((item) => arrIdMitra.push(item.id));

      // Data proposal (approved only)
      const totalProposalPenyaluran = await prisma.proposal.findMany({
        where: { id: { in: arrIdProposal } },
      });

      // Data mitra
      const totalMitraPenyaluran = await prisma.mitra.findMany({
        where: { id: { in: arrIdMitra } },
      });

      // 🔹 Nominal penyaluran total hanya bulan tertentu (default bulan berjalan)
      const totalNominalPenyaluran = await prisma.proposal.aggregate({
        _sum: { dana_approval: true },
        where: {
          id: { in: arrIdProposal },
          tgl_bayar: {
            gte: new Date(tahun, bulan - 1, 1), // awal bulan
            lt: new Date(tahun, bulan, 1), // awal bulan berikutnya
          },
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: [
          {
            icon: "bx bxs-user-rectangle",
            title: "MUSTAHIQ TERDAFTAR",
            value: Number(totalMustahiq) + " Orang",
            badgeValue: "Dari Portal",
            color: "success",
            desc: "Keseluruhan Data",
          },
          {
            icon: "bx bxs-user-rectangle",
            title: "MUSTAHIQ PENERIMA MANFAAT",
            value: mustahiqPenerimaManfaat + " Orang",
            badgeValue: "Dari Proposal Approved",
            color: "success",
            desc: "Mustahiq yang sudah menerima manfaat",
          },
          {
            icon: "bx bx-purchase-tag-alt",
            title: "TOTAL PROPOSAL ZIS",
            value:
              numberWithCommas(String(totalProposalPenyaluran.length)) +
              " Proposal",
            badgeValue: "All Time",
            color: "warning",
            desc: "",
          },
          {
            icon: "bx bx-purchase-tag-alt",
            title: "TOTAL PENYALURAN ZIS",
            value:
              "Rp." +
              numberWithCommas(
                String(totalNominalPenyaluran._sum.dana_approval || 0)
              ),
            badgeValue: `Bulan ${bulan}-${tahun}`,
            color: "warning",
            desc: "Nominal penyaluran",
          },
          {
            icon: "bx bxs-user-rectangle",
            title: "MUZAKI TERDAFTAR",
            value: Number(totalMuzaki) + " Orang",
            badgeValue: "Dari Portal",
            color: "success",
            desc: "Keseluruhan Data",
          },
          {
            icon: "bx bxs-user-rectangle",
            title: "MUWAKIF TERDAFTAR",
            value: Number(totalMuwakif) + " Orang",
            badgeValue: "Dari Portal",
            color: "success",
            desc: "Keseluruhan Data",
          },
          {
            icon: "bx bx-purchase-tag-alt",
            title: "TOTAL MITRA WAKAF",
            value:
              numberWithCommas(String(totalMitraPenyaluran.length)) + " Mitra",
            badgeValue: "All Time",
            color: "warning",
            desc: "",
          },
        ],
        dataPenyaluran:
          "Rp." +
          numberWithCommas(
            String(totalNominalPenyaluran._sum.dana_approval || 0)
          ),
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async graphPenyaluran(req, res) {
    try {
      let arrIsApproved = [];
      let arrIsPaid = [];
      let arrAllPenyaluran = [];

      const getPenyaluranIsApproved =
        await prisma.$queryRaw`select SUM(p.dana_approval) as dana_approval 
                        from proposal p join user u on u.user_id = p.user_id 
                        where p.approved = 1 and u.mustahiq_id is not null group by MONTH(p.create_date)`;

      getPenyaluranIsApproved.map((item) => {
        arrIsApproved.push(Number(item.dana_approval));
      });

      const getPenyaluranIspaid =
        await prisma.$queryRaw`select SUM(p.dana_approval) as dana_approval 
                        from proposal p join user u on u.user_id = p.user_id 
                        where p.ispaid = 1 and u.mustahiq_id is not null group by MONTH(p.create_date)`;

      getPenyaluranIspaid.map((item) => {
        arrIsPaid.push(Number(item.dana_approval));
      });

      const getAllPenyaluran =
        await prisma.$queryRaw`select (Case when SUM(p.dana_yang_diajukan) is null then 0 else SUM(p.dana_yang_diajukan) end) as dana_approval 
                              from proposal p group by MONTH(p.create_date)`;

      getAllPenyaluran.map((item) => {
        arrAllPenyaluran.push(Number(item.dana_approval));
      });

      return res.status(200).json({
        message: "Sukses",
        data: [
          {
            name: "Total Pengajuan",
            data: arrAllPenyaluran,
          },
          {
            name: "Yang Disetujui",
            data: arrIsApproved,
          },
          {
            name: "Telah Disalurkan",
            data: arrIsPaid,
          },
        ],
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async graphPerprogram(req, res) {
    try {
      const arrValue = [];
      const arrProgramName = [];
      const arrGabungan = [];

      const getPenyaluranIspaid =
        await prisma.$queryRaw`select COUNT(id) as jumlah, p.program_title as title
                            FROM proposal pr LEFT JOIN program p on p.program_id = pr.program_id 
                            GROUP BY pr.program_id
                            ORDER BY jumlah DESC LIMIT 10`;

      getPenyaluranIspaid.map((item) => {
        arrProgramName.push(item.title);
        arrValue.push(Number(item.jumlah));
        arrGabungan.push({
          namaprogram: item.title,
          total: Number(item.jumlah),
        });
      });

      return res.status(200).json({
        message: "Sukses",
        data: {
          dataNamaProgram: arrProgramName,
          dataValue: arrValue,
          dataGabungan: arrGabungan,
        },
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async dataRekapReferentor(req, res) {
    try {
      const arrValue = [];
      const arrName = [];

      const getAllRef =
        await prisma.$queryRaw`select count(p.id) as jml, p.nama_pemberi_rekomendasi as name, "Referentor Indosat" as description
      from proposal p 
      join user u on u.user_id = p.user_id 
      where p.nama_pemberi_rekomendasi is not NULL and 
      u.user_type = 10 and 
      u.mustahiq_id is not NULL group by p.nama_pemberi_rekomendasi ORDER BY jml DESC LIMIT 5`;

      getAllRef.map((item) => {
        //arrValue.push({"name": item.name, "desc": item.description, "value": Number(item.jml)});
        arrName.push(item.name);
        arrValue.push(Number(item.jml));
      });

      return res.status(200).json({
        message: "Sukses",
        data: {
          dataAllReferentor: arrName,
          dataValue: arrValue,
        },
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
};