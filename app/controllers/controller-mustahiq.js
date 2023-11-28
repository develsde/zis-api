const { prisma } = require("../../prisma/client");
const fs = require("fs");

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
        imkas_number,
        is_institusi,
        institusi_nama,
        institusi_no_hp,
      } = req.body;

      console.log(JSON.stringify(req.body))

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
          imkas_number,
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
  async getProgramByUserId(req, res) {
    try {
      const id = req.params.id;
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 2);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "program_id";
      const sortType = req.query.order || "asc";

      const params = {
        user_id: parseInt(id),
        program_title: {
          contains: keyword,
        },
        ...(category ? { program_category_id: Number(category) } : {}),
      };

      const [count, program] = await prisma.$transaction([
        prisma.program.count({
          where: params,
        }),
        prisma.program.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          include: {
            program_category: true,
            program_institusi: {
              select: {
                institusi_id: true,
                institusi_nama: true,
              },
            },
            program_banner: {
              select: {
                banners_path: true,
                banners_id: true,
              },
            },
          },
          skip,
          take: perPage,
        }),
      ]);

      const programResult = await Promise.all(
        program.map(async (item) => {
          const total_donation = await prisma.transactions.aggregate({
            where: {
              program_id: item.program_id,
            },
            _sum: {
              amount: true,
            },
          });

          return {
            ...item,
            program_target_amount: Number(item.program_target_amount),
            total_donation: total_donation._sum.amount || 0,
          };
        })
      );

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data",

        data: programResult,
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
  }
};
