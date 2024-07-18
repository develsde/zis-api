const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");
const { customAlphabet } = require("nanoid");
const { z } = require("zod");
const { midtransfer, cekstatus } = require("../helper/midtrans");
const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
  8
);
const moment = require("moment");
const ExcelJS = require("exceljs");
const axios = require("axios");
const qs = require("qs")

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
      const iswakaf = Number(req.query.iswakaf || 0);
      const isinternal = Number(req.query.isinternal || 0);

      const params = {
        program_status: status,
        program_title: {
          contains: keyword,
        },
        isinternal: isinternal,
        iswakaf: iswakaf,
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
                // user: {
                //   select: {
                //     user_id: true,
                //     user_nama: true,
                //   },
                // },
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
        program_title: z
          .string({ required_error: "Judul Harus Diisi" })
          .min(3, "Judul Terlalu Pendek")
          .max(255),
        program_short_desc: z.string().optional(),
        program_start_date: z.date({
          required_error: "Tanggal Mulai Harus Diisi",
        }),
        program_end_date: z.date({
          required_error: "Tanggal Berakhir Harus Diisi",
        }),
        program_description: z
          .string({ required_error: "Deskripsi Harus Diis" })
          .min(3),
        program_institusi_id: z.number().optional(),
        program_target_amount: z.number({
          required_error: "Target Dana Harus Diisi",
          invalid_type_error: "Target Dana Harus Diisi",
        }),
      });

      //BODY
      const body = await schema.safeParseAsync({
        // ...req.body,
        program_title: req.body.program_title,
        program_short_desc: req.body.program_short_desc,
        program_description: req.body.program_description,
        program_end_date: new Date(req.body.program_end_date),
        program_start_date: new Date(req.body.program_start_date),
        program_target_amount: Number(req.body.program_target_amount),
        program_institusi_id: req.body.program_institusi_id
          ? parseInt(req.body.program_institusi_id)
          : undefined,
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

      const { program_institusi_id, ...rest } = body.data;

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
          user: {
            connect: {
              user_id: Number(userId),
            },
          },
          // beneficiary: {
          //   connectOrCreate: {
          //     create: {

          //     },
          //   }
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

      await prisma.notification.create({
        data: {
          user: {
            connect: {
              user_id: Number(userId),
            },
          },
          description:
            "Program Anda Telah Berhasil Dibuat, Silahkan Tunggu Konfirmasi Dari Admin",
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
        message: "Sukses Tambah Program",
        data: JSON.parse(
          JSON.stringify({
            ...program,
            program_target_amount: Number(program.program_target_amount),
          })
        ),
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getBanner(req, res) {
    try {
      const iswakaf = Number(req.query.iswakaf || 0);

      const banner = await prisma.program.findMany({
        orderBy: {
          program_id: "asc",
        },
        where: {
          program_status: 1,
          program_isheadline: 1,
          iswakaf: iswakaf,
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

  async getFormAct(req, res) {
    try {
      const id = req.params.id;
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;

      const [count, programAct] = await prisma.$transaction([
        prisma.program_form_activity.count({
          where: {
            program_id: Number(id),
          },
        }),
        prisma.program_form_activity.findFirst({
          where: {
            program_id: Number(id),
          },
          include: {
            program: {
              select: {
                program_id: true,
                program_title: true,
                program_activity_biaya: true,
              },
            },
          },
        }),
      ]);
      console.log(programAct);

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: programAct,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async postFormAct(req, res) {
    try {
      const {
        program_registered_value,
        program_form_id,
        program_id,
        program_registered_virtual_account,
        program_registered_bank,
      } = req.body;
      console.log(req.body);
      const program = await prisma.program.findUnique({
        where: {
          program_id: Number(program_id),
        },
        select: {
          program_activity_biaya: true,
        },
      });

      const program_biaya = program ? program.program_activity_biaya : 0;
      let actResult;

      if (program_biaya === 0) {
        actResult = await prisma.program_registered_activity.create({
          data: {
            program: {
              connect: {
                program_id: Number(program_id),
              },
            },
            program_form_activity: {
              connect: {
                id: Number(program_form_id),
              },
            },
            program_registered_value,
            program_registered_virtual_account,
            program_registered_bank,
          },
        });

        res.status(200).json({
          message: "Sukses Kirim Data",
          data: actResult,
        });
      } else if (program_biaya > 0) {
        // const randomNumber = Math.floor(Math.random() * 999) + 1;
        const timesg = String(+new Date());
        const bayarkan = Number(program_biaya);

        actResult = await prisma.program_registered_activity.create({
          data: {
            program: {
              connect: {
                program_id: Number(program_id),
              },
            },
            program_form_activity: {
              connect: {
                id: Number(program_form_id),
              },
            },
            program_registered_value,
            program_registered_virtual_account: `${timesg}P${program_id}`,
            program_registered_bank,
          },
        });

        if (actResult) {
          const midtrans = await midtransfer({
            order: `${timesg}P${program_id}`,
            price: bayarkan,
          });

          console.log(midtrans);

          res.status(200).json({
            message: "Sukses Kirim Data",
            data: {
              actResult,
              midtrans,
            },
          });
        }
      }
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async getRegAct(req, res) {
    try {
      const id = req.params.id;
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;

      const [count, programAct] = await prisma.$transaction([
        prisma.program_registered_activity.count({
          where: {
            program_registered_virtual_account: Number(id),
          },
        }),
        prisma.program_registered_activity.findFirst({
          where: {
            program_registered_virtual_account: Number(id),
          },
          include: {
            program: {
              select: {
                program_id: true,
                program_title: true,
                program_activity_biaya: true,
              },
            },
          },
        }),
      ]);
      const stat = await cekstatus({
        order: id,
      });
      console.log(stat);
      res.status(200).json({
        message: "Sukses Ambil Data",
        data: {
          programAct,
          stat,
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async postMidTrans(req, res) {
    try {
      const {
        order_id,
        datetime,
        amount,
        midtrans_status_log,
        status_transaction,
        program_id,
        // register_id,
        bank_selected_midtrans,
        bank_va,
        non_bank_account,
        non_bank_selected_midtrans,
      } = req.body;
      console.log(req.body);
      const trans = await prisma.program_transaction_activity.findFirst({
        where: {
          order_id: order_id,
        },
      });
      if (trans) {
        return res.status(400).json({
          message: "Order ID telah diverifikasi",
        });
      }
      let actResult;

      actResult = await prisma.program_transaction_activity.create({
        data: {
          program: {
            connect: {
              program_id: Number(program_id),
            },
          },
          // program_registered_activity: {
          //   connect: {
          //     id: Number(register_id),
          //   },
          // },
          order_id,
          datetime: moment().toISOString(datetime),
          amount: Number(amount),
          midtrans_status_log,
          status_transaction: Number(status_transaction),
          bank_selected_midtrans,
          bank_va,
          non_bank_account,
          non_bank_selected_midtrans,
        },
      });
      res.status(200).json({
        message: "Sukses Kirim Data",
        data: actResult,
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async postAdditionalActivity(req, res) {
    try {
      const {
        nama,
        no_wa,
        email,
        province_id,
        city_id,
        district_id,
        alamat,
        kodepos,
        jumlah_peserta,
        paket_id,
        zakat,
        wakaf,
        jasa_kirim,
        ongkir,
        jasa_kirim_barang,
        etd,
        iskomunitas,
        nama_komunitas,
        program_id,
        // jumlah_kaos,
        // no_wa_user,
        ukuran,
        gender,
        // no_peserta = '0',
      } = req.body;
      console.log(req.body);

      // let file = req.file;

      // if (iskomunitas == 1) {
      //   if (!file) {
      //     return res.status(400).json({
      //       message: "File excel harus diupload",
      //     });
      //   }

      //   const maxSize = 5000000;
      //   if (file.size > maxSize) {
      //     await fs.unlink(file.path);

      //     return res.status(400).json({
      //       message: "Ukuran File Terlalu Besar",
      //     });
      //   }
      // }

      const paket = await prisma.activity_paket.findUnique({
        where: {
          id: Number(paket_id),
        },
      });
      let biaya_paket = paket ? paket.biaya : 0;
      let zak = zakat ? zakat : 0;
      let wak = wakaf ? wakaf : 0;
      let ong = ongkir ? ongkir : 0;
      let jml = jumlah_peserta ? jumlah_peserta : 1
      let total = (Number(biaya_paket) * Number(jml)) + Number(zak) + Number(wak) + Number(ong);
      let actResult;

      // actResult = await prisma.activity_additional.create({
      //   data: {
      //     nama,
      //     program: {
      //       connect: {
      //         program_id: Number(program_id),
      //       },
      //     },
      //     no_wa,
      //     activity_paket: {
      //       connect: {
      //         id: Number(paket_id),
      //       },
      //     },
      //     email,
      //     // provinces: {
      //     //   connect: {
      //     //     prov_id: Number(province_id),
      //     //   },
      //     // },
      //     province_id: Number(province_id),
      //     // cities: {
      //     //   connect: {
      //     //     city_id: Number(city_id),
      //     //   },
      //     // },
      //     city_id: Number(city_id),
      //     // districts: {
      //     //   connect: {
      //     //     dis_id: Number(district_id),
      //     //   },
      //     // },
      //     district_id: Number(district_id),
      //     alamat,
      //     kodepos,
      //     jumlah_peserta: Number(jumlah_peserta),
      //     activity_paket: {
      //       connect: {
      //         id: Number(paket_id),
      //       },
      //     },
      //     zakat: zak,
      //     wakaf: wak,
      //     jasa_kirim,
      //     layanan_kirim: jasa_kirim_barang,
      //     etd,
      //     ongkir: ong,
      //     total_biaya: Number(total),
      //     excel: `uploads/${file.filename}`,
      //     iskomunitas: Number(iskomunitas),
      //     nama_komunitas,
      //   },
      // });

      let data = {
        nama,
        program: {
          connect: {
            program_id: Number(program_id),
          },
        },
        no_wa,
        activity_paket: {
          connect: {
            id: Number(paket_id),
          },
        },
        email,
        province_id: Number(province_id),
        city_id: Number(city_id),
        district_id: Number(district_id),
        alamat,
        kodepos,
        jumlah_peserta: Number(jumlah_peserta),
        zakat: Number(zak),
        wakaf: Number(wak),
        jasa_kirim,
        layanan_kirim: jasa_kirim_barang,
        etd,
        ongkir: Number(ong),
        total_biaya: Number(total),
        iskomunitas: Number(iskomunitas),
        nama_komunitas,
      };

      // if (iskomunitas == 1) {
      //   data.excel = `uploads/${file.filename}`;
      // }

      actResult = await prisma.activity_additional.create({
        data: data,
      });

      const timesg = String(+new Date());
      if (actResult) {

        // if (actResult && iskomunitas == 0) {
        await prisma.activity_additional.update({
          where:{
            id: Number(actResult?.id)
          },
          data:{
            order_id: `${timesg}P${program_id}A${actResult?.id}`
          }
        })
        const accUser = await prisma.activity_user.create({
          data: {
            program: {
              connect: {
                program_id: Number(program_id),
              },
            },
            activity_additional: {
              connect: {
                id: Number(actResult.id),
              },
            },
            // additional_id: Number(actResult?.id),
            nama: nama,
            no_wa: no_wa,
            ukuran,
            gender,
            // jumlah_kaos: 1,
            // no_peserta
          },
        });

        // const no_peserta = String(accUser.id).padStart(6, "0");
        // await prisma.activity_user.update({
        //   where: { id: accUser.id },
        //   data: { no_peserta },
        // });

        const midtrans = await midtransfer({
          order: `${timesg}P${program_id}A${actResult?.id}`,
          price: Number(total),
        });

        res.status(200).json({
          message: "Sukses Kirim Data",
          data: {
            accUser,
            actResult,
            midtrans,
          },
        });
      }
      // else if (actResult && iskomunitas == 1) {
      //   const workbook = new ExcelJS.Workbook();
      //   await workbook.xlsx.readFile(file.path);
      //   const worksheet = workbook.getWorksheet(1);

      //   await workbook.xlsx.writeFile(file.path);

      //   let users = [];
      //   let max = 4 + Number(jumlah_peserta)
      //   console.log(users);
      //   worksheet.eachRow((row, rowNumber) => {
      //     if (rowNumber > 4 && rowNumber <= max) {
      //       const user = {
      //         program_id: Number(program_id),
      //         additional_id: Number(actResult?.id),
      //         //samain rownya nanti
      //         nama: row.getCell("B").value,
      //         no_wa: row.getCell("C").value,
      //         ukuran: row.getCell("E").value,
      //         gender: row.getCell("D").value,
      //       };
      //       users.push(user);
      //     }
      //   });

      //   const createdUsers = [];
      //   for (let i = 0; i < users.length; i++) {
      //     const createdUser = await prisma.activity_user.create({
      //       data: users[i],
      //     });

      //     const no_peserta = String(createdUser.id).padStart(6, "0");
      //     await prisma.activity_user.update({
      //       where: { id: createdUser.id },
      //       data: { no_peserta },
      //     });

      //     createdUsers.push(createdUser);
      //   }

      //   const midtrans = await midtransfer({
      //     order: `${timesg}P${program_id}A${actResult?.id}`,
      //     price: Number(total),
      //   });

      //   return res.status(200).json({
      //     message: "Sukses Kirim Data",
      //     data: {
      //       createdUsers,
      //       actResult,
      //       midtrans,
      //     },
      //   });
      // }
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async postPaket(req, res) {
    try {
      const { program_id, kategori, biaya, keterangan } = req.body;

      const postResult = await prisma.activity_paket.create({
        data: {
          program: {
            connect: {
              program_id: Number(program_id),
            },
          },
          kategori,
          biaya: Number(biaya),
          keterangan,
        },
      }
      );

      res.status(200).json({
        message: "Sukses Kirim Data",
        data: postResult,
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async putPaket(req, res) {
    try {
      const { kategori, biaya, keterangan } = req.body;
      const id = req.params.id;

      const putResult = await prisma.activity_paket.update({
        where: {
          id: Number(id),
        },
        data: {
          kategori,
          biaya: Number(biaya),
          keterangan,
        },
      });

      res.status(200).json({
        message: "Sukses Ubah Data",
        data: putResult,
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async delPaket(req, res) {
    try {
      const id = req.params.id;

      const delResult = await prisma.activity_paket.delete({
        where: {
          id: Number(id),
        },
      });

      res.status(200).json({
        message: "Sukses Hapus Data",
        data: delResult,
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async getAdditional(req, res) {
    try {
      const id = req.params.id;
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "created_date";
      const sortType = req.query.order || "desc";

      const params = {
        // program_status: status,
        nama: {
          contains: keyword,
        },
      };

      const [count, ActAdditional] = await prisma.$transaction([
        prisma.activity_additional.count({
          where: params,
        }),
        prisma.activity_additional.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          include: {
            program: {
              select: {
                program_id: true,
                program_title: true,
                program_activity_biaya: true,
              },
            },
            // provinces: true,
            // cities: true,
            // districts: true,
            activity_paket: true,
          },
          skip,
          take: perPage,
        }),
      ]);

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: ActAdditional,
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

  async getActUser(req, res) {
    try {
      const id = req.params.id;
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);

      const [count, ActUser] = await prisma.$transaction([
        prisma.activity_user.count({
          where: {
            additional_id: Number(id),
          },
        }),
        prisma.activity_user.findMany({
          where: {
            additional_id: Number(id),
          },
          include: {
            program: {
              select: {
                program_id: true,
                program_title: true,
                program_activity_biaya: true,
              },
            },
            activity_additional: true,
          },
        }),
      ]);

      res.status(200).json({
        message: "Sukses Ubah Data",
        data: ActUser,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },
  async checkProv(req, res) {
    try {
      const response = await axios.get("https://pro.rajaongkir.com/api/province", {
        headers: {
          key: "017746b2ce942519918096b4d136b79f",
        },
      });
      console.log(response.data);
      res.status(200).json({
        message: "Sukses Ambil Data",
        data: response.data,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({
        message: error || "An error occurred",
      });
    }
  },

  async checkCities(req, res) {
    const id = req.params.id;
    try {
      const response = await axios.get(`https://pro.rajaongkir.com/api/city?province=${id}`, {
        headers: {
          key: "017746b2ce942519918096b4d136b79f",
        },
      });
      console.log(response.data);
      res.status(200).json({
        message: "Sukses Ambil Data",
        data: response.data,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({
        message: error || "An error occurred",
      });
    }
  },

  async checkKec(req, res) {
    const id = req.params.id;
    try {
      const response = await axios.get(`https://pro.rajaongkir.com/api/subdistrict?city=${id}`, {
        headers: {
          key: "017746b2ce942519918096b4d136b79f",
        },
      });
      console.log(response.data);
      res.status(200).json({
        message: "Sukses Ambil Data",
        data: response.data,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({
        message: error || "An error occurred",
      });
    }
  },
  async checkOngkir(req, res) {
    console.log(req.body);
    try {
      const data = {
        origin: req.body.city_id,
        originType: 'city',
        destination: req.body.district_id,
        destinationType: 'subdistrict',
        weight: req.body.jumlah_peserta ? (250 * Number(req.body.jumlah_peserta)) : 250,
        courier: req.body.jasa_kirim
      };
      const response = await axios.post(
        'https://pro.rajaongkir.com/api/cost',
        qs.stringify(req.body),
        {
          headers: {
            key: '017746b2ce942519918096b4d136b79f',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      console.log(response.data);
      res.status(200).json({
        message: "Sukses Ambil Data",
        data: response.data,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({
        message: error || "An error occurred",
      });
    }
  },

  async checkStat(req, res) {
    const id = req.params.id;
    const order_id = req.body.order_id
    try {
      const stat = await cekstatus({
        order: order_id,
      });
      console.log(stat);
      res.status(200).json({
        message: "Sukses Ambil Data",
        data: stat,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({
        message: error || "An error occurred",
      });
    }
  },
};
