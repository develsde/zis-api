const { prisma } = require("../../prisma/client");
const fs = require("fs");
// const { sendImkas } = require("../helper/imkas");

module.exports = {
  async details(req, res) {
    const userId = req.user_id;

    return res.status(200).json({
      userId,
    });
  },

  async create(req, res) {
    try {
      const userId = req.user_id;

      const ktp_url = req.files?.ktp_file?.[0].path;
      const kk_url = req.files?.kk_file?.[0].path;

      if (!ktp_url || !kk_url) {
        if (ktp_url) {
          fs.unlinkSync(ktp_url);
        }
        if (kk_url) {
          fs.unlinkSync(kk_url);
        }
        return res.status(400).json({
          message: "KTP dan KK harus diisi",
        });
      }

      const {
        address,
        province,
        kota,
        kecamatan,
        bank_account_name,
        emergency_contact_name,
        emergency_contact_number,
        bank_name,
        bank_number,
        is_institusi,
        institusi_nama,
        institusi_no_hp,
      } = req.body;

      console.log(JSON.stringify(req.body));

      if (is_institusi) {
        await prisma.user.update({
          where: {
            user_id: userId,
          },
          data: {
            institusi: {
              create: {
                institusi_nama,
                institusi_no_hp,
              },
            },
          },
        });
      }

      const mustahiqResult = await prisma.mustahiq.create({
        data: {
          user: {
            connect: {
              user_id: userId,
            },
          },
          kk_url: `uploads/${req.files?.ktp_file?.[0].filename}`,
          ktp_url: `uploads/${req.files?.kk_file?.[0].filename}`,
          address,
          province,
          kota,
          kecamatan,
          emergency_contact_name,
          emergency_contact_number,
          bank_name,
          bank_number,
          bank_account_name,
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: mustahiqResult,
      });
    } catch (error) {
      const ktp_url = req.files?.ktp_file?.[0].path;
      const kk_url = req.files?.kk_file?.[0].path;

      if (ktp_url) {
        fs.unlinkSync(ktp_url);
      }
      if (kk_url) {
        fs.unlinkSync(kk_url);
      }

      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async getProposalById(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 1);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";
      const id = req.params.id;
      const params = {
        user_id: Number(id),
      };

      const [count, proposal] = await prisma.$transaction([
        prisma.proposal.count({
          where: params,
        }),
        prisma.proposal.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          include: {
            user: true,

            program: {
              select: {
                program_title: true,
                pogram_target_amount: false,
                kategori_penyaluran: true,
                program_category: true,
              },
              // include: {

              // }
            },
            proposal_approval: {
              include: {
                user: {
                  select: {
                    user_id: true,
                    user_nama: true,
                    username: true,
                    user_phone: true,
                  },
                },
              },
            },
          },
          skip,
          // take: perPage,
        }),
      ]);

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data",

        data: proposal,
        // pagination: {
        //   total: count,
        //   page,
        //   hasNext: count > page * perPage,
        //   totalPage: Math.ceil(count / perPage),
        // },
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },
  async getDetailById(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 1);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";
      const id = req.params.id;
      const params = {
        id: Number(id),
      };

      const [count, proposal] = await prisma.$transaction([
        prisma.proposal.count({
          where: params,
        }),
        prisma.proposal.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          include: {
            user: true,
            proposal_approval: {
              include: {
                user: {
                  select: {
                    user_id: true,
                    user_nama: true,
                    username: true,
                    user_phone: true,
                  },
                },
              },
            },
          },
          skip,
          take: perPage,
        }),
      ]);

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data",

        data: proposal,
        pagination: {
          total: count,
          page,
          hasNext: count > page * perPage,
          totalPage: Math.ceil(count / perPage),
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },
};
