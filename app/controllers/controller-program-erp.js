const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");

const { customAlphabet } = require("nanoid");
const { z } = require("zod");

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890", 8);

module.exports = {
  async getAllProgram(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 1);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "program_id";
      const sortType = req.query.order || "asc";

      const params = {
        OR: [
          { program_status: 1 },
          { program_status: 0 }
        ],
        // program_status: status,
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
            kategori_penyaluran: true,
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
          // const total_donation = await prisma.transactions.aggregate({
          //   where: {
          //     program_id: Number(item.program_id),
          //   },
          //   _sum: {
          //     amount: true,
          //   },
          // });
          //item.program_target_amount = undefined
          return {
            ...item,
            //program_title: item.program_title
            //kategori_penyaluran: ite
            program_target_amount: Number(item.program_target_amount),
            //total_donation: total_donation._sum.amount || 0,
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
  },

  async getAllProgramDetail(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 1);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "program_id";
      const sortType = req.query.order || "asc";
      const iswakaf = Number(req.query.iswakaf || 0)

      const params = {
        OR: [
          { program_status: 1 },
          { program_status: 0 }
        ],
        // program_status: status,
        program_title: {
          contains: keyword,
        },
        ...(category ? { program_category_id: Number(category) } : {}),
        iswakaf
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
            kategori_penyaluran: true,
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
          // const total_donation = await prisma.transactions.aggregate({
          //   where: {
          //     program_id: Number(item.program_id),
          //   },
          //   _sum: {
          //     amount: true,
          //   },
          // });
          //item.program_target_amount = undefined
          return {
            ...item,
            //program_title: item.program_title
            //kategori_penyaluran: ite
            program_target_amount: Number(item.program_target_amount),
            //total_donation: total_donation._sum.amount || 0,
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
  },

  async getProgramById(req, res) {
    try {
      const id = req.params.id;

      if (!id) {
        return res.status(400).json({
          message: "id is required",
        });
      }

      const [program, totalDonation] = await prisma.$transaction([
        prisma.program.findUnique({
          where: {
            program_id: parseInt(id),
          },
          include: {
            program_banner: true,
            program_institusi: true,
            transactions: {
              select: {
                amount: true,
                id: true,
                user: {
                  select: {
                    user_id: true,
                    user_nama: true,
                  },
                },
              },
            },
          },
        }),

        prisma.transactions.aggregate({
          where: {
            program_id: parseInt(id),
          },
          _sum: {
            amount: true,
          },
        }),
      ]);

      if (!program) {
        return res.status(404).json({
          message: "Program Tidak Ditemukan",
        });
      }

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: JSON.parse(
          JSON.stringify({
            ...program,
            program_target_amount: Number(program.program_target_amount),
            total_donation: totalDonation._sum.amount || 0,
          })
        ),
      });
    } catch (error) {
      res.status(500).json({
        message: "Terjadi Kesalahan Server",
        stack: error?.message,
      });
    }
  },

  async registerProgram(req, res) {
    try {
      const schema = z.object({
        program_title: z.string({ required_error: "Judul Harus Diisi" }).min(3, "Judul Terlalu Pendek").max(255),
        program_short_desc: z.string().optional(),
        program_start_date: z.date({ required_error: "Tanggal Mulai Harus Diisi" }),
        program_end_date: z.date({ required_error: "Tanggal Berakhir Harus Diisi" }),
        program_description: z.string({ required_error: "Deskripsi Harus Diis" }).min(3),
        //program_institusi_id: z.number().optional(),
        program_target_amount: z.number({
          required_error: "Target Dana Harus Diisi",
          invalid_type_error: "Target Dana Harus Diisi",
        }),
        iswakaf: z.number().optional(),
        program_wakaf_type: z.number()
      });

      const program_institusi_id = 1;

      //BODY
      const body = await schema.safeParseAsync({
        // ...req.body,
        program_title: req.body.program_title,
        program_short_desc: req.body.program_short_desc,
        program_description: req.body.program_description,
        program_end_date: new Date(req.body.program_end_date),
        program_start_date: new Date(req.body.program_start_date),
        program_target_amount: Number(req.body.program_target_amount),
        program_institusi_id: program_institusi_id,
        iswakaf: Number(req.body.iswakaf),
        program_wakaf_type: Number(req.body.program_wakaf_type)
      });

      const program_cat_id = Number(req.body.program_category_id);

      let errorObj = {};

      if (body.error) {
        body.error.issues.forEach((issue) => {
          errorObj[issue.path[0]] = issue.message;
        });
        body.error = errorObj;
      }

      if (!body.success) {
        return res.status(400).json({
          message: "Beberapa Field Harus Diisi",
          error: errorObj,
        });
      }

      //FILE
      const file = req.file;

      if (!file) {
        return res.status(400).json({
          message: "Banner harus diupload",
        });
      }

      const maxSize = 5000000;
      if (file.size > maxSize) {
        await fs.unlink(file.path);

        return res.status(400).json({
          message: "Ukuran Banner Terlalu Besar",
        });
      }

      const {
        //program_institusi_id,
        ...rest
      } = body.data;

      const userId = req.user_id;
      console.log(body);
      const program = await prisma.program.create({
        data: {
          ...rest,
          program_category: {
            connect: {
              id: Number(program_cat_id),
            },
          },
          // user: {
          //   connect: {
          user_id: Number(userId),
          //   },
          // },

          program_banner: {
            create: {
              banners_name: rest.program_title,
              banners_path: `uploads/${file.filename}`,
            },
          },
          program_kode: nanoid(),
          ...(program_institusi_id
            ? {
              program_institusi: {
                connect: {
                  institusi_id: program_institusi_id,
                },
              },
            }
            : {}),
        },
      });

      if (!program) {
        return res.status(400).json({
          message: "Gagal Tambah Program",
        });
      }
      // if (program){
      //   if (program_cat_id == 100) {
      //     await prisma.program_form_activity.create({
      //       data: {
      //         program_id: program.program_id
      //       }
      //     })
      //   }
      // }

      res.status(200).json({
        message: "Sukses Tambah Program",
        data: JSON.parse(JSON.stringify({ ...program, program_target_amount: Number(program.program_target_amount) })),
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async updateProgram(req, res) {
    try {
      const schema = z.object({
        program_title: z.string({ required_error: "Judul Harus Diisi" }).min(3, "Judul Terlalu Pendek").max(255),
        program_short_desc: z.string().optional(),
        program_start_date: z.date({ required_error: "Tanggal Mulai Harus Diisi" }),
        program_end_date: z.date({ required_error: "Tanggal Berakhir Harus Diisi" }),
        program_description: z.string({ required_error: "Deskripsi Harus Diis" }).min(3),
        program_institusi_id: z.number().optional(),
        program_target_amount: z.number({
          required_error: "Target Dana Harus Diisi",
          invalid_type_error: "Target Dana Harus Diisi",
        }),
        program_banner: z
          .any().optional(),
        iswakaf: z.number(),
        program_wakaf_type: z.number()
      });

      // BODY
      const body = await schema.safeParseAsync({
        // ...req.body,
        program_title: req.body.program_title,
        program_short_desc: req.body.program_short_desc,
        program_description: req.body.program_description,
        program_end_date: new Date(req.body.program_end_date),
        program_start_date: new Date(req.body.program_start_date),
        program_target_amount: Number(req.body.program_target_amount),
        program_institusi_id: req.body.program_institusi_id ? parseInt(req.body.program_institusi_id) : undefined,
        iswakaf: Number(req.body.iswakaf),
        program_wakaf_type: Number(req.body.program_wakaf_type)
      });

      const program_cat_id = Number(req.body.program_category_id);

      let errorObj = {};

      if (body.error) {
        body.error.issues.forEach((issue) => {
          errorObj[issue.path[0]] = issue.message;
        });
        body.error = errorObj;
      }

      if (!body.success) {
        return res.status(400).json({
          message: "Beberapa Field Harus Diisi",
          error: errorObj,
        });
      }

      // FILE
      const file = req.file;
      const program_id = req.params.id;
      const userId = req.user_id;

      const { program_institusi_id, ...rest } = body.data;

      let programUpdateData = {
        ...rest,
        program_category: {
          connect: {
            id: Number(program_cat_id),
          },
        },
        // user: {
        //   connect: {
        user_id: Number(userId),
        //   },
        // },
        // beneficiary: {
        //   connectOrCreate: {
        //     create: {

        //     },
        //   }
        // },
        program_kode: nanoid(),
        ...(program_institusi_id
          ? {
            program_institusi: {
              connect: {
                institusi_id: program_institusi_id,
              },
            },
          }
          : {}),
      };

      // Update program_banner if file is provided
      if (file) {
        const maxSize = 5000000;
        if (file.size > maxSize) {
          await fs.unlink(file.path);
          return res.status(400).json({
            message: "Ukuran Banner Terlalu Besar",
          });
        }

        programUpdateData.program_banner = {
          create: {
            banners_name: rest.program_title,
            banners_path: `uploads/${file.filename}`,
          },
        };
      }

      const program = await prisma.program.update({
        where: {
          program_id: Number(program_id),
        },
        data: programUpdateData,
      });

      if (!program) {
        return res.status(400).json({
          message: "Gagal Tambah Program",
        });
      }

      await prisma.notification.create({
        data: {
          user: {
            connect: {
              user_id: Number(userId),
            },
          },
          description: "Program Anda Telah Berhasil Diedit, Silahkan Tunggu Konfirmasi Dari Admin",
          title: "Program Baru",
          type: "program",
          program: {
            connect: {
              program_id: program.program_id,
            },
          },
        },
      });

      res.status(200).json({
        message: "Sukses Edit Program",
        data: JSON.parse(JSON.stringify({ ...program, program_target_amount: Number(program.program_target_amount) })),
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },
  async verifiedProgram(req, res) {
    try {
      const program_id = req.params.id;
      const program_status = req.body.program_status;

      const program = await prisma.program.update({
        where: {
          program_id: Number(program_id),
        },
        data: {
          program_status,
        },
      });

      if (!program) {
        return res.status(400).json({
          message: "Program tidak ditemukan",
        });
      }

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Aktifasi",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },


  async getBanner(req, res) {
    try {
      const banner = await prisma.program.findMany({
        orderBy: {
          program_id: "asc",
        },
        where: {
          program_status: 1,
          program_isheadline: 1,
        },
        include: {
          program_banner: {
            select: {
              banners_path: true,
              banners_id: true,
            },
          },
        },
        take: 5,
      });

      return res.status(200).json({
        message: "Sukses Ambil Data",
        data: banner.map((item) => ({
          program_id: item.program_id,
          program_banner: {
            banners_path: item.program_banner.banners_path,
          },
        })),
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },
  async updateKategoriPenyaluran(req, res) {
    try {
      const id = req.params.id;

      const kat_penyaluran_id = req.body.kat_penyaluran_id;

      console.log(kat_penyaluran_id)

      const glResult = await prisma.program.update({
        where: {
          program_id: Number(id),
        },
        data: {
          kat_penyaluran_id: Number(kat_penyaluran_id)
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: glResult,
      });
    } catch (error) {
      return res.status(200).json({
        message: "Sukses",
      });
    }
  },

  // async createForm(req, res) {
  //   try {
  //     const id = req.params.id;
  //     const program_id = req.body.program_id;
  //     const program_form = req.body.program_form;
  //     const program_activity_biaya = req.body.program_activity_biaya

  //     const program_biaya = await prisma.program.findUnique({
  //       where: {
  //         program_id: Number(program_id)
  //       },
  //       select: {
  //         program_activity_biaya: true
  //       }
  //     })

  //     if (program_activity_biaya != program_biaya) {
  //       await prisma.program.update({
  //         where: {
  //           program_id: Number(program_id)
  //         },
  //         data: {
  //           program_activity_biaya: Number(program_activity_biaya)
  //         }
  //       })
  //     }

  //     const form = await prisma.program_form_activity.update({
  //       where: {
  //         id: Number(id),
  //       },
  //       data: {
  //         program_form: program_form
  //       },
  //     });

  //     res.status(200).json({
  //       message: "Berhasil membuat form",
  //       data: form,
  //     });
  //   } catch (error) {
  //     res.status(500).json({
  //       message: error?.message,
  //     });
  //   }
  // },
};
