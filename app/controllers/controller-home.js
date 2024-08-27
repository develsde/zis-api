const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");
const { customAlphabet } = require("nanoid");
const { subMonths, subDays, format, endOfMonth } = require("date-fns");
const { z } = require("zod");
var serverkeys = process.env.SERVER_KEY;
var clientkeys = process.env.CLIENT_KEY;
const { midtransfer, cekstatus } = require("../helper/midtrans");
const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
  8
);
const { sendWhatsapp } = require("../helper/whatsapp");
const moment = require("moment");
const ExcelJS = require("exceljs");
const axios = require("axios");
const qs = require("qs");

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
      const isinter = Number(req.query.isinter || 0);

      const params = {
        program_status: status,
        program_title: {
          contains: keyword,
        },
        isinternal: {
          lte: isinternal,
          gte: isinter,
        },
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

          const header = {
            isProduction: true,
            serverKey: serverkeys,
            clientKey: clientkeys,
          };

          const log = await prisma.log_vendor.create({
            data: {
              vendor_api: "Snap MidTrans",
              url_api: req.originalUrl,
              api_header: JSON.stringify(header),
              api_body: JSON.stringify({
                order: `${timesg}P${program_id}`,
                price: bayarkan,
              }),
              api_response: JSON.stringify(midtrans),
              payload: JSON.stringify(req.body),
            },
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
      const stats = await cekstatus({
        order: id,
      });
      const log = await prisma.log_vendor.create({
        data: {
          vendor_api: stats?.config?.url,
          url_api: req.originalUrl,
          api_header: JSON.stringify(stats.headers),
          api_body: stats?.config?.data,
          api_response: JSON.stringify(stats.data),
          payload: JSON.stringify(req.body),
        },
      });
      const stat = stats.data;
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

      const add = await prisma.activity_additional.findFirst({
        where: {
          order_id: order_id,
        },
      });

      const paket = await prisma.activity_paket.findFirst({
        where: {
          id: add.paket_id,
        },
      });

      if (actResult.status_transaction == 200) {
        let pn = add.no_wa;
        pn = pn.replace(/\D/g, "");
        if (pn.substring(0, 1) == "0") {
          pn = "0" + pn.substring(1).trim();
        } else if (pn.substring(0, 3) == "62") {
          pn = "0" + pn.substring(3).trim();
        }
        const dateString = actResult.datetime;
        const date = new Date(dateString);
        const formattedDate = date.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const formattedDana = add.total_biaya.toLocaleString("id-ID", {
          style: "currency",
          currency: "IDR",
        });
        const msgId = await sendWhatsapp({
          wa_number: pn.replace(/[^0-9\.]+/g, ""),
          text:
            "Transaksi Berhasil\n" +
            "\nTerima kasih atas partisipasi kamu, pendaftaran dan pembayaran kamu sudah kami terima.\n" +
            "\nDengan informasi sebagai berikut :" +
            "\nTanggal/waktu : " +
            formattedDate +
            "\nNama : " +
            add.nama +
            "\nNo whatsapp : " +
            add.no_wa +
            "\nAlamat : " +
            add.alamat +
            "\nPaket : " +
            paket.kategori +
            "\nPengiriman : " +
            add.layanan_kirim +
            "\nJumlah yang dibayar : " +
            formattedDana +
            "\n\nJika ada informasi yang tidak sesuai harap hubungi admin kami.\n" +
            "\nSalam zisindosat\n" +
            "\nAdmin\n" +
            "\nPanitia Virtual Run For Palestine\n" +
            "0899-8387-090",
        });
        // const log = await prisma.log_vendor.create({
        //   data: {
        //     vendor_api: "https://erpapi.zisindosat.id/wapi/send_message",
        //     url_api: req.originalUrl,
        //     api_header,
        //     api_body,
        //     api_response: msgId,
        //     payload: req.body,
        //   },
        // });
      }
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
        referentor,
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
      let jml = jumlah_peserta ? jumlah_peserta : 1;
      let total =
        Number(biaya_paket) * Number(jml) +
        Number(zak) +
        Number(wak) +
        Number(ong);
      let actResult;

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
        referentor: {
          connect: {
            id: Number(referentor),
          },
        },
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
          where: {
            id: Number(actResult?.id),
          },
          data: {
            order_id: `${timesg}P${program_id}A${actResult?.id}`,
          },
        });
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

        const header = {
          isProduction: true,
          serverKey: serverkeys,
          clientKey: clientkeys,
        };

        const log = await prisma.log_vendor.create({
          data: {
            vendor_api: "Snap MidTrans",
            url_api: req.originalUrl,
            api_header: JSON.stringify(header),
            api_body: JSON.stringify({
              order: `${timesg}P${program_id}A${actResult?.id}`,
              price: Number(total),
            }),
            api_response: JSON.stringify(midtrans),
            payload: JSON.stringify(req.body),
          },
        });

        if (accUser) {
          let pn = no_wa;
          pn = pn.replace(/\D/g, "");
          if (pn.substring(0, 1) == "0") {
            pn = "0" + pn.substring(1).trim();
          } else if (pn.substring(0, 3) == "62") {
            pn = "0" + pn.substring(3).trim();
          }
          const dateString = actResult.created_date;
          const date = new Date(dateString);
          const formattedDate = date.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });
          const formattedDana = total.toLocaleString("id-ID", {
            style: "currency",
            currency: "IDR",
          });
          const msgId = await sendWhatsapp({
            wa_number: pn.replace(/[^0-9\.]+/g, ""),
            text:
              "Menunggu Pembayaran\n" +
              "\nTerima kasih atas partisipasi kamu, pendaftaran kamu sudah kami terima.\n" +
              "\nMohon segera lakukan pembayaran dan jangan tinggalkan halaman sebelum pembayaran benar-benar selesai.\n" +
              "\nPastikan kembali nominal yang anda kirimkan sesuai dengan data berikut :" +
              "\nTanggal/waktu : " +
              formattedDate +
              "\nNama : " +
              nama +
              "\nNo whatsapp : " +
              no_wa +
              "\nJumlah yang harus dibayarkan : " +
              formattedDana +
              "\n\nJika ada informasi yang tidak sesuai harap hubungi admin kami.\n" +
              "\nSalam zisindosat\n" +
              "\nAdmin\n" +
              "\nPanitia Virtual Run For Palestine\n" +
              "0899-8387-090",
          });
          // const log = await prisma.log_vendor.create({
          //   data: {
          //     vendor_api: "https://erpapi.zisindosat.id/wapi/send_message",
          //     url_api: req.originalUrl,
          //     api_header,
          //     api_body,
          //     api_response: msgId,
          //     payload: req.body,
          //   },
          // });
        }

        res.status(200).json({
          message: "Sukses Kirim Data",
          data: {
            accUser,
            actResult,
            midtrans,
          },
        });
      }
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
      });

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
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "created_date";
      const sortType = req.query.order || "desc";
      const status = Number(req.query.status || 0);

      const start = new Date(req.query.start);
      const end = new Date(req.query.end);

      const validStart = !isNaN(start.getTime()) ? start : new Date();
      const validEnd =
        !isNaN(end.getTime()) && end >= validStart ? end : new Date();

      validStart.setHours(0, 0, 0, 0);
      validEnd.setHours(23, 59, 59, 999);

      if (validStart > validEnd) {
        return res.status(400).json({ message: "Invalid date range" });
      }

      const params = {
        nama: {
          contains: keyword,
        },
        created_date: {
          gte: validStart,
          lte: validEnd,
        },
      };

      const ActAdditional = await prisma.activity_additional.findMany({
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
          activity_paket: true,
        },
      });

      const orderIds = ActAdditional.map((item) => item.order_id);

      const statuses = [];

      for (const orderId of orderIds) {
        const statuss = await cekstatus({ order: orderId });
        const log = await prisma.log_vendor.create({
          data: {
            vendor_api: statuss?.config?.url,
            url_api: req.originalUrl,
            api_header: JSON.stringify(statuss.headers),
            api_body: statuss?.config?.data,
            api_response: JSON.stringify(statuss.data),
            payload: JSON.stringify(req.body),
          },
        });
        const status = statuss.data;
        statuses.push(status);
      }

      const filteredActAdditional = ActAdditional.filter((item, index) => {
        return statuses[index].transaction_status === "settlement";
      });

      const totalFiltered = filteredActAdditional.length;

      const startIdx = (page - 1) * perPage;
      const endIdx = startIdx + perPage;
      const paginatedData = filteredActAdditional.slice(startIdx, endIdx);

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: paginatedData,
        pagination: {
          total: totalFiltered,
          page,
          hasNext: endIdx < totalFiltered,
          totalPage: Math.ceil(totalFiltered / perPage),
        },
      });
    } catch (error) {
      res.status(500).json({
        message:
          error?.message || "Terjadi kesalahan dalam mengambil data tambahan",
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
      const response = await axios.get(
        "https://pro.rajaongkir.com/api/province",
        {
          headers: {
            key: "017746b2ce942519918096b4d136b79f",
          },
        }
      );
      console.log(response);
      const log = await prisma.log_vendor.create({
        data: {
          vendor_api: response?.config?.url,
          url_api: req.originalUrl,
          api_header: JSON.stringify(response.headers),
          api_body: response?.config?.data,
          api_response: JSON.stringify(response.data),
          payload: JSON.stringify(req.body),
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
      const response = await axios.get(
        `https://pro.rajaongkir.com/api/city?province=${id}`,
        {
          headers: {
            key: "017746b2ce942519918096b4d136b79f",
          },
        }
      );
      console.log(response);
      const log = await prisma.log_vendor.create({
        data: {
          vendor_api: response?.config?.url,
          url_api: req.originalUrl,
          api_header: JSON.stringify(response.headers),
          api_body: response?.config?.data,
          api_response: JSON.stringify(response.data),
          payload: JSON.stringify(req.body),
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
      const response = await axios.get(
        `https://pro.rajaongkir.com/api/subdistrict?city=${id}`,
        {
          headers: {
            key: "017746b2ce942519918096b4d136b79f",
          },
        }
      );
      console.log(response);
      const log = await prisma.log_vendor.create({
        data: {
          vendor_api: response?.config?.url,
          url_api: req.originalUrl,
          api_header: JSON.stringify(response.headers),
          api_body: response?.config?.data,
          api_response: JSON.stringify(response.data),
          payload: JSON.stringify(req.body),
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
        origin: 2096,
        originType: "subdistrict",
        destination: req.body.district_id,
        destinationType: "subdistrict",
        weight: req.body.jumlah_peserta
          ? 250 * Number(req.body.jumlah_peserta)
          : 250,
        courier: req.body.jasa_kirim,
      };
      const response = await axios.post(
        "https://pro.rajaongkir.com/api/cost",
        qs.stringify(req.body),
        {
          headers: {
            key: "017746b2ce942519918096b4d136b79f",
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );
      console.log(response);
      const log = await prisma.log_vendor.create({
        data: {
          vendor_api: response?.config?.url,
          url_api: req.originalUrl,
          api_header: JSON.stringify(response.headers),
          api_body: response?.config?.data,
          api_response: JSON.stringify(response.data),
          payload: JSON.stringify(req.body),
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

  async loh(req, res) {
    try {
      // WA
      // const msgId = await sendWhatsapp({
      //   wa_number: "085331026363",
      //   text:
      //     "Testing",
      // });
      // console.log(msgId);

      // RAJA ONGKIR
      // const data = {
      //   origin: 2096,
      //   originType: "subdistrict",
      //   destination: 2095,
      //   destinationType: "subdistrict",
      //   weight: 500,
      //   courier: "jne",
      // };
      // const response = await axios.post(
      //   "https://pro.rajaongkir.com/api/cost",
      //   qs.stringify(data),
      //   {
      //     headers: {
      //       key: "017746b2ce942519918096b4d136b79f",
      //       "Content-Type": "application/x-www-form-urlencoded",
      //     },
      //   }
      // );
      // console.log(response);
      // const log = await prisma.log_vendor.create({
      //   data: {
      //     vendor_api: response?.config?.url,
      //     url_api: req.originalUrl,
      //     api_header: JSON.stringify(response.headers),
      //     api_body: response?.config?.data,
      //     api_response: JSON.stringify(response.data),
      //     payload: JSON.stringify(req.body),
      //   },
      // });

      res.status(200).json({
        message: "Wok",
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async checkStat(req, res) {
    const id = req.params.id;
    const order_id = req.body.order_id;
    try {
      const stats = await cekstatus({
        order: id,
      });
      const log = await prisma.log_vendor.create({
        data: {
          vendor_api: stats?.config?.url,
          url_api: req.originalUrl,
          api_header: JSON.stringify(stats.headers),
          api_body: stats?.config?.data,
          api_response: JSON.stringify(stats.data),
          payload: JSON.stringify(req.body),
        },
      });
      const stat = stats.data;
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

  async getPenjualan(req, res) {
    try {
      const start = new Date(req.query.start);
      const end = new Date(req.query.end);

      const validStart = !isNaN(start.getTime()) ? start : new Date();
      const validEnd =
        !isNaN(end.getTime()) && end >= validStart ? end : new Date();

      validStart.setHours(0, 0, 0, 0);
      validEnd.setHours(23, 59, 59, 999);

      if (validStart > validEnd) {
        return res.status(400).json({ message: "Invalid date range" });
      }

      const params = {
        created_date: {
          gte: validStart,
          lte: validEnd,
        },
      };

      const ActAdditional = await prisma.activity_additional.findMany({
        where: params,
        include: {
          program: {
            select: {
              program_id: true,
              program_title: true,
              program_activity_biaya: true,
            },
          },
          activity_paket: true,
        },
      });

      const orderIds = ActAdditional.map((item) => item.order_id);

      const statuses = [];
      for (const orderId of orderIds) {
        const statuss = await cekstatus({ order: orderId });
        const log = await prisma.log_vendor.create({
          data: {
            vendor_api: statuss?.config?.url,
            url_api: req.originalUrl,
            api_header: JSON.stringify(statuss.headers),
            api_body: statuss?.config?.data,
            api_response: JSON.stringify(statuss.data),
            payload: JSON.stringify(req.body),
          },
        });
        const status = statuss.data;
        statuses.push(status);
      }

      const filteredActAdditional = ActAdditional.filter((item, index) => {
        return statuses[index].transaction_status === "settlement";
      });

      const additionalIds = filteredActAdditional
        .map((item) => item.id)
        .filter((id) => id !== undefined && id !== null);

      const additionalIdsString = additionalIds.join(",");

      const pendapatan = await prisma.$queryRawUnsafe(`
      SELECT SUM(total_biaya) AS totalPendapatan
      FROM activity_additional
      WHERE id IN (${additionalIdsString})
      `);

      const zakatWakaf = await prisma.$queryRawUnsafe(`
      SELECT SUM(wakaf) AS total_wakaf, SUM(zakat) AS total_zakat
      FROM activity_additional
      WHERE id IN (${additionalIdsString})
      `);

      const penjualan = await prisma.$queryRawUnsafe(`
      SELECT a.paket_id, p.kategori, SUM(jumlah_peserta) AS jumlah_pemesanan, p.biaya,  
      p.biaya * SUM(a.jumlah_peserta) AS hasil_penjualan
      FROM activity_additional a
      INNER JOIN activity_paket p ON a.paket_id = p.id
      WHERE a.id IN (${additionalIdsString})
      GROUP BY a.paket_id
      `);

      const ongkir = await prisma.$queryRawUnsafe(`
      SELECT SUM(ongkir) AS total_ongkir
      FROM activity_additional
      WHERE id IN (${additionalIdsString})
      `);

      res.status(200).json({
        message: "Sukses Ambil Data",
        dataPenjualan: penjualan,
        totalZakat: zakatWakaf[0].total_zakat,
        totalWakaf: zakatWakaf[0].total_wakaf,
        ongkir: ongkir[0].total_ongkir,
        totalPendapatan: pendapatan[0].totalPendapatan,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getAllActUser(req, res) {
    try {
      const id = req.params.id;
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const sortBy = req.query.sortBy || "created_date";
      const sortType = req.query.order || "desc";
      const keyword = req.query.keyword || "";

      const start = new Date(req.query.start);
      const end = new Date(req.query.end);

      // Validate date range
      const validStart = !isNaN(start.getTime()) ? start : new Date();
      const validEnd =
        !isNaN(end.getTime()) && end >= validStart ? end : new Date();
      validStart.setHours(0, 0, 0, 0);
      validEnd.setHours(23, 59, 59, 999);

      if (validStart > validEnd) {
        return res.status(400).json({ message: "Invalid date range" });
      }

      // Query parameters
      const params = {
        nama: {
          contains: keyword,
        },
        created_date: {
          gte: validStart,
          lte: validEnd,
        },
      };

      // Fetch Activity Additional
      const ActAdditional = await prisma.activity_additional.findMany({
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
          activity_paket: true,
        },
      });

      const orderIds = ActAdditional.map((item) => item.order_id);

      // Fetch status asynchronously
      const statusPromises = orderIds.map((orderId) =>
        cekstatus({ order: orderId })
      );
      const statuses = await Promise.all(statusPromises);

      // Filter based on status
      const filteredActAdditional = ActAdditional.filter((item, index) => {
        return statuses[index].data.transaction_status === "settlement";
      });

      // Extract subdistrict IDs from filteredActAdditional
      const subdistrictIds = filteredActAdditional
        .map((item) => item.district_id) // Adjust the property if necessary
        .filter((id) => id !== undefined && id !== null);

      console.log("Subdistrict IDs:", subdistrictIds);

      // Example of using subdistrictIds:
      // Fetch subdistrict data
      const subdistrictPromises = subdistrictIds.map((subdistrictId) =>
        axios.get(
          `https://pro.rajaongkir.com/api/subdistrict?id=${subdistrictId}`,
          {
            headers: {
              key: "017746b2ce942519918096b4d136b79f",
            },
          }
        )
      );
      const subdistrictResponses = await Promise.all(subdistrictPromises);

      // Fetch Activity User data
      const [count, ActUser] = await prisma.$transaction([
        prisma.activity_user.count({
          where: {
            additional_id: {
              in: filteredActAdditional.map((item) => item.id),
            },
          },
        }),
        prisma.activity_user.findMany({
          where: {
            additional_id: {
              in: filteredActAdditional.map((item) => item.id),
            },
          },
          include: {
            program: {
              select: {
                program_id: true,
                program_title: true,
                program_activity_biaya: true,
              },
            },
            activity_additional: {
              include: {
                activity_paket: true,
                referentor: true,
              },
            },
          },
          skip,
          take: perPage,
          orderBy: {
            activity_additional: {
              created_date: sortType,
            },
          },
        }),
      ]);

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: ActUser,
        pagination: {
          total: count,
          page,
          hasNext: count > page * perPage,
          totalPage: Math.ceil(count / perPage),
        },
        subdistrictData: subdistrictResponses.map((response) => response.data),
      });
    } catch (error) {
      console.error("Error fetching data:", error);
      res.status(500).json({
        message: error.message || "Internal Server Error",
      });
    }
  },

  async rajaOngkirKota(req, res) {
    const id = req.params.id;
    try {
      const response = await axios.get(
        `https://pro.rajaongkir.com/api/subdistrict?id=${id}`,
        {
          headers: {
            key: "017746b2ce942519918096b4d136b79f",
          },
        }
      );
      console.log(response);
      const log = await prisma.log_vendor.create({
        data: {
          vendor_api: response?.config?.url,
          url_api: req.originalUrl,
          api_header: JSON.stringify(response.headers),
          api_body: response?.config?.data,
          api_response: JSON.stringify(response.data),
          payload: JSON.stringify(req.body),
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

  async getRef(req, res) {
    try {
      // const id = req.params.id;
      const isorg = Number(req.query.isorg || 0);
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);

      const [count, Ref] = await prisma.$transaction([
        prisma.referentor.count({
          where: {
            isorg,
          },
        }),
        prisma.referentor.findMany({
          where: {
            isorg,
          },
        }),
      ]);

      res.status(200).json({
        message: "Sukses Ubah Data",
        data: Ref,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async postQurban(req, res) {
    try {
      const {
        nama,
        nama_mudohi,
        no_wa,
        email,
        province_id,
        city_id,
        district_id,
        alamat,
        program_id,
        ukuran,
        nik,
        type,
        alokasi_hak,
        total
      } = req.body;

      const postResult = await prisma.activity_qurban.create({
        data: {
          program: {
            connect: {
              program_id: Number(program_id),
            },
          },
          nama,
          nama_mudohi,
          no_wa,
          email,
          province_id: Number(province_id),
          city_id: Number(city_id),
          district_id: Number(district_id),
          alamat,
          ukuran,
          nik,
          type: Number(type),
          alokasi_hak: Number(alokasi_hak),
          total:Number(total)
        },
      });
      // const timesg = String(+new Date());
      // const midtrans = await midtransfer({
      //   order: `${timesg}P${program_id}Q${postResult?.id}`,
      //   price: Number(total),
      // });

      // const header = {
      //   isProduction: true,
      //   serverKey: serverkeys,
      //   clientKey: clientkeys,
      // };

      // const log = await prisma.log_vendor.create({
      //   data: {
      //     vendor_api: "Snap MidTrans",
      //     url_api: req.originalUrl,
      //     api_header: JSON.stringify(header),
      //     api_body: JSON.stringify({
      //       order: `${timesg}P${program_id}A${actResult?.id}`,
      //       price: Number(total),
      //     }),
      //     api_response: JSON.stringify(midtrans),
      //     payload: JSON.stringify(req.body),
      //   },
      // });
      if(postResult){
        // let pn = no_wa;
        // pn = pn.replace(/\D/g, "");
        // if (pn.substring(0, 1) == "0") {
        //   pn = "0" + pn.substring(1).trim();
        // } else if (pn.substring(0, 3) == "62") {
        //   pn = "0" + pn.substring(3).trim();
        // }
        // const dateString = postResult.created_date;
        // const date = new Date(dateString);
        // const formattedDate = date.toLocaleDateString("id-ID", {
        //   day: "numeric",
        //   month: "long",
        //   year: "numeric",
        // });
        // const formattedDana = total.toLocaleString("id-ID", {
        //   style: "currency",
        //   currency: "IDR",
        // });
        // const msgId = await sendWhatsapp({
        //   wa_number: pn.replace(/[^0-9\.]+/g, ""),
        //   text:
        //     "Menunggu Pembayaran\n" +
        //     "\nTerima kasih atas partisipasi kamu, pendaftaran kamu sudah kami terima.\n" +
        //     "\nMohon segera lakukan pembayaran dan jangan tinggalkan halaman sebelum pembayaran benar-benar selesai.\n" +
        //     "\nPastikan kembali nominal yang anda kirimkan sesuai dengan data berikut :" +
        //     "\nTanggal/waktu : " +
        //     formattedDate +
        //     "\nNama : " +
        //     nama +
        //     "\nNo whatsapp : " +
        //     no_wa +
        //     "\nJumlah yang harus dibayarkan : " +
        //     formattedDana +
        //     "\n\nJika ada informasi yang tidak sesuai harap hubungi admin kami.\n" +
        //     "\nSalam zisindosat\n" +
        //     "\nAdmin\n" +
        //     "\nPanitia Virtual Run For Palestine\n" +
        //     "0899-8387-090",
        // });
        res.status(200).json({
          message: "Sukses Kirim Data",
          data: postResult,
        });
      }
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },
};
