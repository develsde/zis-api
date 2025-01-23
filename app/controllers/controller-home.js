const { prisma } = require("../../prisma/client");
const fs = require("fs");
const { customAlphabet } = require("nanoid");
const { subMonths, subDays, format, endOfMonth } = require("date-fns");
const { z } = require("zod");
var serverkeys = process.env.SERVER_KEY;
var clientkeys = process.env.CLIENT_KEY;
const {
  midtransfer,
  cekStatus,
  handlePayment,
  cancelPayment,
  generateOrderId,
  getTransactionStatus,
} = require("../helper/midtrans");
const { reqPay } = require("../controllers/controller-payment");
const { scheduleCekStatus } = require("../helper/background-jobs");
const nanoid = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890",
  8
);
const {
  sendEmail,
  generateTemplateMegaKonser,
  generateTemplateCancelMegaKonser,
  generateTemplatePembayaran,
  sendEmailWithPdf,
} = require("../helper/email");
const { sendWhatsapp } = require("../helper/whatsapp");
const moment = require("moment");
const ExcelJS = require("exceljs");
const axios = require("axios");
const qs = require("qs");
const { password } = require("../../config/config.db");
const generatePdf = require("../helper/pdf");
const path = require("path");
const { error } = require("console");
const { schedule } = require("node-cron");

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
      const stats = await cekStatus({
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
        // program_id,
        // register_id,
        bank_selected_midtrans,
        bank_va,
        non_bank_account,
        non_bank_selected_midtrans,
      } = req.body;
      console.log(req.body);

      // const trans = await prisma.program_transaction_activity.findFirst({
      //   where: {
      //     order_id: order_id,
      //   },
      // });

      // const trans = await prisma.pemesanan_megakonser.findFirst({
      //   where: {
      //     kode_pemesanan: order_id,
      //   },
      // });

      // if (trans) {
      //   return res.status(400).json({
      //     message: "Order ID telah diverifikasi",
      //   });
      // }
      // let actResult;

      // actResult = await prisma.program_transaction_activity.create({
      //   data: {
      //     program: {
      //       connect: {
      //         program_id: Number(program_id),
      //       },
      //     },
      //     // program_registered_activity: {
      //     //   connect: {
      //     //     id: Number(register_id),
      //     //   },
      //     // },
      //     order_id,
      //     datetime: moment().toISOString(datetime),
      //     amount: Number(amount),
      //     midtrans_status_log,
      //     status_transaction: Number(status_transaction),
      //     bank_selected_midtrans,
      //     bank_va,
      //     non_bank_account,
      //     non_bank_selected_midtrans,
      //   },
      // });

      // const add = await prisma.activity_additional.findFirst({
      //   where: {
      //     order_id: order_id,
      //   },
      // });

      // const paket = await prisma.activity_paket.findFirst({
      //   where: {
      //     id: add.paket_id,
      //   },
      // });

      // if (actResult.status_transaction == 200) {
      //   let pn = add.no_wa;
      //   pn = pn.replace(/\D/g, "");
      //   if (pn.substring(0, 1) == "0") {
      //     pn = "0" + pn.substring(1).trim();
      //   } else if (pn.substring(0, 3) == "62") {
      //     pn = "0" + pn.substring(3).trim();
      //   }
      //   const dateString = actResult.datetime;
      //   const date = new Date(dateString);
      //   const formattedDate = date.toLocaleDateString("id-ID", {
      //     day: "numeric",
      //     month: "long",
      //     year: "numeric",
      //   });
      //   const formattedDana = add.total_biaya.toLocaleString("id-ID", {
      //     style: "currency",
      //     currency: "IDR",
      //   });
      //   const msgId = await sendWhatsapp({
      //     wa_number: pn.replace(/[^0-9\.]+/g, ""),
      //     text:
      //       "Transaksi Berhasil\n" +
      //       "\nTerima kasih atas partisipasi kamu, pendaftaran dan pembayaran kamu sudah kami terima.\n" +
      //       "\nDengan informasi sebagai berikut :" +
      //       "\nTanggal/waktu : " +
      //       formattedDate +
      //       "\nNama : " +
      //       add.nama +
      //       "\nNo whatsapp : " +
      //       add.no_wa +
      //       "\nAlamat : " +
      //       add.alamat +
      //       "\nPaket : " +
      //       paket.kategori +
      //       "\nPengiriman : " +
      //       add.layanan_kirim +
      //       "\nJumlah yang dibayar : " +
      //       formattedDana +
      //       "\n\nJika ada informasi yang tidak sesuai harap hubungi admin kami.\n" +
      //       "\nSalam zisindosat\n" +
      //       "\nAdmin\n" +
      //       "\nPanitia Virtual Run For Palestine\n" +
      //       "0899-8387-090",
      //   });
      //   // const log = await prisma.log_vendor.create({
      //   //   data: {
      //   //     vendor_api: "https://erpapi.zisindosat.id/wapi/send_message",
      //   //     url_api: req.originalUrl,
      //   //     api_header,
      //   //     api_body,
      //   //     api_response: msgId,
      //   //     payload: req.body,
      //   //   },
      //   // });
      // }
      res.status(200).json({
        message: "Sukses Kirim Data",
        // data: actResult,
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
        const statuss = await cekStatus({ order: orderId });
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
      const stats = await cekStatus({
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

      res.status(200).json({
        message: "Sukses Ambil Data",
        // data: stat,
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
        const statuss = await cekStatus({ order: orderId });
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
        cekStatus({ order: orderId })
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
        harga,
        ongkir,
        gender,
        lokasi_penyaluran,
        detail_qurban,
        bank,
      } = req.body;

      const totals = Number(harga) + Number(ongkir);

      if (detail_qurban.length < 1) {
        return res
          .status(400)
          .json({ message: "Masukkan detail qurban wajib diisi" });
      }

      // Menghitung total harga dari detail_qurban
      const transformedDetails = detail_qurban.map((detail) => ({
        paket_id: Number(detail.paket_id),
        nama_mudohi: detail.nama_mudohi,
        qty: detail.qty,
        total: String(detail.total),
      }));

      const totalPrice = transformedDetails.reduce((sum, detail) => {
        const totalAmount = Number(detail.total.replace(/\D/g, ""));
        return sum + totalAmount;
      }, 0);

      // Memproses nomor WA
      let pn = no_wa.replace(/\D/g, "");
      if (pn.startsWith("0")) {
        pn = "0" + pn.substring(1).trim();
      } else if (pn.startsWith("62")) {
        pn = "0" + pn.substring(2).trim();
      }

      const phoneNumber = Number(bank) === 20 ? "086500018999" : no_wa;

      // Mengirim request ke payment gateway menggunakan reqPay
      const response = await reqPay({
        body: {
          phone_number: phoneNumber,
          id_SOF: bank,
          price: totalPrice,
        },
      });

      const UTC = response.data.SendPaymentResp.uniqueTransactionCode;
      const actionData = response.data.SendPaymentResp.actionData;

      // Memproses actionData jika bank adalah 20
      const bankName =
        Number(bank) === 20
          ? "BlueBCA"
          : actionData.match(/\[([^\]]+)\]/g)[0].replace(/\[|\]/g, "");
      const vaNumber =
        Number(bank) === 20
          ? actionData // Directly use actionData for VA Number
          : actionData.match(/\[([^\]]+)\]/g)[2].replace(/\[|\]/g, "");

      // Insert ke tabel activity_qurban
      const postResult = await prisma.activity_qurban.create({
        data: {
          program: {
            connect: {
              program_id: Number(program_id),
            },
          },
          nama,
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
          total: Number(totals),
          harga: Number(harga),
          ongkir: Number(ongkir),
          gender,
          lokasi_penyaluran,
          UTC, // Menyimpan uniqueTransactionCode
        },
      });

      // Menyimpan detail qurban ke tabel
      const detail = await prisma.detail_qurban.createMany({
        data: transformedDetails.map((detail) => ({
          ...detail,
          qurban_id: Number(postResult?.id),
        })),
      });

      // Kirim pesan WhatsApp
      const formattedDate = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const formattedDana = totalPrice.toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
      });

      await sendWhatsapp({
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
          "\nBank : " +
          bankName +
          "\nVA Number : " +
          vaNumber +
          "\n\nJika ada informasi yang tidak sesuai harap hubungi admin kami.\n" +
          "\nSalam zisindosat\n" +
          "\nAdmin\n" +
          "\nPanitia Qurban Raya\n" +
          "0899-8387-090",
      });

      // Menjadwalkan pengecekan status
      scheduleCekStatus({ uniqueTransactionCode: UTC });

      res.status(200).json({
        message: "Sukses Kirim Data",
        data: {
          postResult,
          detail,
          paymentResponse: response,
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async postPemesananMegaKonser(req, res) {
    try {
      const {
        nama,
        telepon,
        email,
        gender,
        total_harga,
        kode_affiliator,
        bank,
        detail_pemesanan,
      } = req.body;

      // console.log("banksat", bank);
      console.log("noHp", telepon);
      console.log("id_sof", bank);
      console.log("nominal", total_harga);

      if (!Array.isArray(detail_pemesanan) || detail_pemesanan.length < 1) {
        return res
          .status(400)
          .json({ message: "Detail pemesanan wajib diisi" });
      }

      if (kode_affiliator) {
        const affiliator = await prisma.affiliator.findUnique({
          where: { kode: kode_affiliator },
        });

        if (!affiliator) {
          return res
            .status(400)
            .json({ message: "Kode Affiliator tidak tersedia" });
        }
      }

      const lastOrder = await prisma.pemesanan_megakonser.findFirst({
        orderBy: { id: "desc" },
        select: { id: true },
      });

      const baseId = 686; // Nilai dasar jika data kosong
      const nextId = lastOrder ? lastOrder.id + 1 : baseId;
      const hurufAwal =
        detail_pemesanan[0].id_tiket === 1
          ? "A"
          : detail_pemesanan[0].id_tiket === 3
          ? "B"
          : "C";
      const kode_pemesanan = `${hurufAwal}${String(nextId).padStart(5, "0")}`;

      console.log(
        `Processing new order: ${kode_pemesanan} for email: ${email}`
      );

      // Menggunakan reqPay untuk pembayaran
      console.log("ayayayayaya");
      function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }

      const response = await reqPay({
        body: {
          phone_number: telepon,
          id_SOF: bank, // Ganti dengan ID_SOF yang sesuai
          price: total_harga,
        },
      });

      // Delay 2 seconds before fetching the status
      await delay(1000);
      console.log("resp", response);
      const UTC = response.data.SendPaymentResp.uniqueTransactionCode;
      console.log("status transaksi", UTC);

      scheduleCekStatus({ uniqueTransactionCode: UTC });
      console.log(`reqPay response for order: ${kode_pemesanan}`, response);

      // if (!response.success) {
      //   return res.status(500).json({
      //     message: response.message,
      //   });
      // }

      const transaction_time = new Date();
      const expiry_time = new Date();
      expiry_time.setMinutes(expiry_time.getMinutes() + 15);

      // const statusId =
      //   response.data.SendPaymentResp.transaction_status || "Pending";
      // const displayStatus = statusId === "200" ? "Berhasil" : "gagal";
      const statusId = "Pending"; // Tetapkan status secara statis
      const displayStatus = "Pending"; // Atur status tampilan menjadi 'Pending'

      const postResult = await prisma.pemesanan_megakonser.create({
        data: {
          nama,
          telepon,
          email,
          gender,
          total_harga: Number(total_harga),
          kode_affiliator,
          kode_pemesanan: kode_pemesanan,
          metode_pembayaran: "reqPay",
          status: "pending",
          transaction_time: transaction_time,
          expiry_time: expiry_time,
        },
      });

      console.log(
        `Order created in DB: ${kode_pemesanan}, ID: ${postResult.id}`
      );

      const transformedDetails = detail_pemesanan.map((detail) => {
        const kode_tiket = `TK-${Math.floor(100000 + Math.random() * 900000)}`;

        return {
          id_pemesanan: postResult.id,
          id_tiket: detail.id_tiket,
          id_detail_tiket: detail.id_tiket_detail,
          kode_tiket,
        };
      });

      await prisma.detail_pemesanan_megakonser.createMany({
        data: transformedDetails,
      });

      console.log(`Details inserted for order: ${kode_pemesanan}`);

      res.status(200).json({
        message: "Sukses Kirim Data",
        data: {
          postResult,
          transformedDetails,
          // uniqueTransactionCode:
          //   response.data.SendPaymentResp.uniqueTransactionCode,
        },
      });
    } catch (error) {
      console.error(`Error processing order: ${error.message}`);
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async getDetailByKodePemesanan(req, res) {
    try {
      console.log("Seluruh Params:", req.params); // Log seluruh params untuk debug
      console.log("Request Body:", req.body); // Log body request untuk debug

      const kode_pemesanan = req.params.kode_pemesanan; // Ambil kode_pemesanan dari req.params
      const keyword = req.query.keyword || ""; // Ambil keyword dari query untuk pencarian kode_tiket

      console.log("Kode Pemesanan:", kode_pemesanan); // Log kode_pemesanan yang diterima
      console.log("Keyword:", keyword); // Log keyword untuk pencarian kode_tiket

      if (!kode_pemesanan) {
        return res.status(400).json({
          message: "Kode pemesanan tidak diberikan dalam URL",
        });
      }

      const params = {
        kode_pemesanan: {
          contains: kode_pemesanan,
        },
        detail_pemesanan_megakonser: {
          some: {
            kode_tiket: {
              contains: keyword, // Gunakan keyword untuk pencarian kode_tiket
            },
          },
        },
      };

      // Ambil data pemesanan berdasarkan kode_pemesanan dan pencarian kode_tiket (jika disediakan)
      const pemesanan = await prisma.pemesanan_megakonser.findMany({
        where: params,
        // include: {
        //   detail_pemesanan_megakonser: {
        //     include: {
        //       tiket_konser_detail: true, // Mengambil semua field dari tiket_konser_detail
        //     },
        //   },
        // },
      });

      const result = await Promise.all(
        pemesanan.map(async (pemes) => {
          const detail = await prisma.detail_pemesanan_megakonser.findMany({
            where: {
              id_pemesanan: Number(pemes.id),
              ...(keyword ? { kode_tiket: keyword } : {}),
            },
            include: {
              tiket_konser_detail: true,
            },
          });
          return { pemesanan, detail_pemesanan: detail };
        })
      );

      // if (pemesanan.length === 0) {
      //   return res.status(404).json({
      //     message:
      //       "Data tidak ditemukan untuk kode_pemesanan atau kode_tiket yang diberikan",
      //   });
      // }

      // // Format data agar lebih terstruktur
      // const formattedData = pemesanan.map((pesan) => ({
      //   ...pesan,
      //   detail_pemesanan: pesan.detail_pemesanan_megakonser.map((detail) => ({
      //     ...detail,
      //     tiket_konser_detail: detail.tiket_konser_detail, // Mengambil semua field dari tiket_konser_detail
      //   })),
      // }));

      res.status(200).json({
        message: "Sukses mengambil data berdasarkan kode_pemesanan",
        data: result,
      });
    } catch (error) {
      console.error(error); // Tambahkan log untuk error yang lebih jelas
      res.status(500).json({
        message: error?.message || "Terjadi kesalahan pada server",
      });
    }
  },

  async getAllDetails(req, res) {
    try {
      console.log("Request Query:", req.query); // Log query params untuk debug

      const keyword = req.query.keyword || ""; // Ambil keyword untuk pencarian kode_tiket

      console.log("Keyword:", keyword); // Log keyword untuk pencarian kode_tiket

      // Ambil semua data pemesanan
      const pemesanan = await prisma.pemesanan_megakonser.findMany({
        // Tidak ada filter pada kode_pemesanan
        include: {
          detail_pemesanan_megakonser: {
            where: keyword ? { kode_tiket: { contains: keyword } } : {}, // Filter berdasarkan kode_tiket jika ada keyword
            include: {
              tiket_konser_detail: true, // Mengambil semua field dari tiket_konser_detail
            },
          },
        },
      });

      // Format data agar lebih terstruktur
      // const formattedData = pemesanan.map((pesan) => ({
      //   ...pesan,
      //   detail_pemesanan: pesan.detail_pemesanan_megakonser.map((detail) => ({
      //     ...detail,
      //     tiket_konser_detail: detail.tiket_konser_detail, // Mengambil semua field dari tiket_konser_detail
      //   })),
      // }));

      res.status(200).json({
        message: "Sukses mengambil semua data",
        data: pemesanan,
      });
    } catch (error) {
      console.error(error); // Tambahkan log untuk error yang lebih jelas
      res.status(500).json({
        message: error?.message || "Terjadi kesalahan pada server",
      });
    }
  },

  async updateDetailStatusById(req, res) {
    try {
      // Ambil `id` dan `status` dari request
      const { id, status } = req.body;

      // Validasi input
      if (!id || status === undefined) {
        return res.status(400).json({
          message: "Parameter 'id' dan 'status' harus disediakan.",
        });
      }

      // Update status detail berdasarkan `id`
      const updatedDetail = await prisma.detail_pemesanan_megakonser.update({
        where: {
          id: parseInt(id, 10),
        },
        data: {
          status: parseInt(status, 10),
        },
      });

      // Berikan respon sukses
      res.status(200).json({
        message: "Status berhasil diperbarui.",
        data: updatedDetail,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message || "Terjadi kesalahan saat memperbarui status.",
      });
    }
  },

  async updateDetailStatusByIdPemesanan(req, res) {
    try {
      // Ambil `id_pemesanan` dan `status` dari request
      const { id_pemesanan, status } = req.body;

      // Validasi input
      if (!id_pemesanan || status === undefined) {
        return res.status(400).json({
          message: "Parameter 'id_pemesanan' dan 'status' harus disediakan.",
        });
      }

      // Update status detail berdasarkan `id_pemesanan`
      const updatedDetails =
        await prisma.detail_pemesanan_megakonser.updateMany({
          where: {
            id_pemesanan: parseInt(id_pemesanan, 10),
          },
          data: {
            status: parseInt(status, 10),
          },
        });

      // Berikan respon sukses
      if (updatedDetails.count > 0) {
        res.status(200).json({
          message: "Status berhasil diperbarui.",
          updatedCount: updatedDetails.count,
        });
      } else {
        res.status(404).json({
          message:
            "Tidak ada data yang ditemukan dengan id_pemesanan tersebut.",
        });
      }
    } catch (error) {
      res.status(500).json({
        message: error?.message || "Terjadi kesalahan saat memperbarui status.",
      });
    }
  },

  async getAllTiket(req, res) {
    try {
      // Ambil semua tiket
      const tiket = await prisma.tiket_konser.findMany({
        select: {
          tiket_id: true,
          tiket_startdate: true,
          tiket_enddate: true,
          tiket_harga: true,
          tiket_jumlah: true,
          tiket_nama: true,
        },
      });

      // Ambil tanggal saat ini
      const today = new Date();

      // Filter tiket yang startdate dan enddate nya sesuai
      const tiketWithDetails = [];

      for (let item of tiket) {
        const startDate = new Date(item.tiket_startdate);
        const endDate = new Date(item.tiket_enddate);

        // Jika startDate <= hari ini <= endDate
        if (today >= startDate && today <= endDate) {
          // Ambil detail tiket hanya untuk tiket yang cocok
          const detail = await prisma.tiket_konser_detail.findMany({
            where: {
              tiket_konser_id: item.tiket_id, // Sesuaikan dengan tiket yang sedang diiterasi
            },
          });

          // Gabungkan tiket dengan detail
          tiketWithDetails.push({
            ...item, // Data tiket
            detail, // Detail tiket
          });

          // Log detail tiket yang diambil
          console.log(`Tiket ID: ${item.tiket_id}, Detail:`, detail);
        } else {
          // Tiket tanpa detail jika tidak cocok
          tiketWithDetails.push(item);
        }
      }

      return res.status(200).json({
        success: true,
        message: "Data tiket berhasil diambil",
        data: tiketWithDetails,
      });
    } catch (error) {
      console.error("Error retrieving tickets:", error.message);
      return res.status(500).json({
        success: false,
        message: "Gagal mengambil data tiket",
        error: error.message,
      });
    }
  },

  async getAllTiketErp(req, res) {
    try {
      // Ambil tiket dengan tiket_id = 1
      const tiket = await prisma.tiket_konser.findMany({
        where: {
          tiket_id: 1,
        },
        select: {
          tiket_id: true,
          tiket_startdate: true,
          tiket_enddate: true,
          tiket_harga: true,
          tiket_jumlah: true,
          tiket_nama: true,
        },
      });

      // Cek apakah tiket ditemukan
      if (tiket.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Tiket dengan ID tersebut tidak ditemukan",
        });
      }

      // Ambil detail tiket yang sesuai dengan tiket_id
      const tiketWithDetails = [];

      for (let item of tiket) {
        const detail = await prisma.tiket_konser_detail.findMany({
          where: {
            tiket_konser_id: item.tiket_id, // Sesuaikan dengan tiket yang sedang diiterasi
          },
        });

        // Gabungkan tiket dengan detail
        tiketWithDetails.push({
          ...item, // Data tiket
          detail, // Detail tiket
        });

        // Log detail tiket yang diambil
        console.log(`Tiket ID: ${item.tiket_id}, Detail:`, detail);
      }

      return res.status(200).json({
        success: true,
        message: "Data tiket berhasil diambil",
        data: tiketWithDetails,
      });
    } catch (error) {
      console.error("Error retrieving tickets:", error.message);
      return res.status(500).json({
        success: false,
        message: "Gagal mengambil data tiket",
        error: error.message,
      });
    }
  },

  async handlePay(req, res) {
    const paymentType = req.body.payment_type;

    try {
      const response = await handlePayment({ paymentType: paymentType });

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: response.data,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({
        message: error.message || "An error occurred",
      });
    }
  },

  // Implementasi pada checkPay

  async checkPay(req, res, idOrder) {
    const order_id = req.body.order_id;
    // const email = req.body.email;

    console.log("order id:", order_id);
    // console.log("email:", email);

    try {
      // Cek status transaksi dari Midtrans
      const stats = await cekStatus({ order: order_id }); // Pastikan orderId yang dikirimkan valid

      // Log informasi dari Midtrans
      console.log(
        "Response dari Midtrans:",
        JSON.stringify(stats.data, null, 2)
      );

      const pemesanan = await prisma.pemesanan_megakonser.findUnique({
        where: {
          kode_pemesanan: order_id,
        },
        include: {
          detail_pemesanan_megakonser: {
            include: {
              tiket_konser: true,
              tiket_konser_detail: true,
            },
          },
        },
      });
      const filePath = path.join(
        __dirname,
        `../../uploads/output${order_id}.pdf`
      );
      // const writeStream = fs.createWriteStream(filePath);

      const email = pemesanan?.email;
      // Periksa status code dan transaction status
      if (stats.data.status_code === "200") {
        // Data tiket (sesuaikan dengan data yang sebenarnya)
        const templateEmail = await generateTemplateMegaKonser({
          email,
          password: email,
          tiket: pemesanan,
        });
        const msgId = await sendEmailWithPdf({
          email,
          html: templateEmail,
          subject: "Pembelian Tiket Sound of Freedom",
          pdfPath: filePath,
        });

        fs.unlink(filePath, (err) => {
          if (err) {
            console.error("Error saat menghapus file PDF:", err);
          }
        });

        await prisma.pemesanan_megakonser.update({
          where: { kode_pemesanan: order_id },
          data: { status: stats.data.transaction_status || "" },
        });

        console.log(
          `Order ${order_id} settled successfully. Email sent: ${msgId}`
        );

        // Log vendor dan update status transaksi
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
        // Respon sukses
        return res.status(200).json({ message: "Sukses Ambil Data" });
      } else if (stats.data.status_code === "404") {
        return res.status(400).json({
          message: "Transaksi tidak ditemukan. Pastikan ID transaksi benar.",
        });
      } else {
        console.error(error);
        return res.status(400).json({
          message: "Anda Belum Melakukan Pembayaran",
        });
      }
    } catch (error) {
      console.error("Error:", error.message);
      return res.status(500).json({
        message: error.message || "An error occurred",
      });
    }
  },

  async cancelPay(req, res) {
    const order = req.body.order_id;
    // const telepon = req.body.telepon;
    try {
      const stats = await cancelPayment({
        order: order,
      });
      // let pn = telepon;
      // pn = pn.replace(/\D/g, "");
      // if (pn.substring(0, 1) == "0") {
      //   pn = "0" + pn.substring(1).trim();
      // } else if (pn.substring(0, 3) == "62") {
      //   pn = "0" + pn.substring(3).trim();
      // }

      // const msgId = await sendWhatsapp({
      //   wa_number: pn.replace(/[^0-9\.]+/g, ""),
      //   text: "Pembatalan pembayaran anda telah berhasil. Terima kasih.",
      // });

      const templateEmail = await generateTemplateCancelMegaKonser({
        email: email,
        password: email,
      });
      const msgId = await sendEmail({
        email: email,
        html: templateEmail,
        subject: "Pembelian Tiket Mega Konser Indosat",
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

      if (stats.data.status_code === 200) {
        await prisma.pemesanan_megakonser.update({
          where: {
            kode_pemesanan: order,
          },
          data: {
            status: stats.data?.transaction_status || "",
          },
        });
      }
      console.log(stats);
      res.status(200).json({
        message: "Sukses Ambil Data",
        // data: stats,
      });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({
        message: error.message || "An error occurred",
      });
    }
  },

  async getTiketSold(req, res) {
    try {
      // Mengambil tiket dan menghitung total dibeli berdasarkan kondisi status 'settlement' atau 'capture'
      const tiket_sold = await prisma.tiket_konser.findMany({
        select: {
          tiket_id: true,
          tiket_nama: true,
          detail_pemesanan_megakonser: {
            where: {
              pemesanan_megakonser: {
                OR: [{ status: "settlement" }],
              },
            },
            select: {
              id_tiket: true, // Field yang dibutuhkan untuk menghitung total pemesanan
            },
          },
        },
      });

      // Mapping hasil untuk menyesuaikan output dengan struktur yang diinginkan
      const data = tiket_sold.map((tiket) => ({
        tiket_id: tiket.tiket_id,
        tiket_nama: tiket.tiket_nama,
        total_dibeli: tiket.detail_pemesanan_megakonser.length, // Menghitung jumlah total tiket yang dibeli
      }));

      return res.status(200).json({
        success: true,
        message: "Data tiket berhasil diambil",
        data: data,
      });
    } catch (error) {
      console.error("Error retrieving tickets:", error.message);
      return res.status(500).json({
        success: false,
        message: "Gagal mengambil data tiket",
        error: error.message,
      });
    }
  },

  async getPemesananMegakonser(req, res) {
    try {
      const keyword = req.query.keyword || "";
      const status = req.query.status || "";
      const kode_affiliator = req.query.kode_affiliator || "";
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const sortBy = req.query.sortBy || "transaction_time";
      const sortType = req.query.order || "desc";

      const params = {
        OR: [
          {
            nama: {
              contains: keyword,
            },
          },
          {
            telepon: {
              contains: keyword,
            },
          },
          {
            email: {
              contains: keyword,
            },
          },
          {
            kode_pemesanan: {
              contains: keyword,
            },
          },
        ],
        ...(status && { status }),
        ...(kode_affiliator && { kode_affiliator }),
      };

      // const [count, pemesanan] = await prisma.$transaction([
      //     prisma.pemesanan_megakonser.count({
      //         where: params,
      //     }),
      //     prisma.pemesanan_megakonser.findMany({
      //         orderBy: {
      //             [sortBy]: sortType,
      //         },
      //         where: params,
      //         include: {
      //             detail_pemesanan_megakonser: {
      //                 include: {
      //                     tiket_konser: true,
      //                     tiket_konser_detail: {
      //                         select: {
      //                             tiket_konser_detail_nama: true, // Memastikan kolom ini diambil
      //                         }
      //                     },
      //                 },
      //             },
      //         },
      //         skip,
      //         take: perPage,
      //     }),
      // ]);

      const [count, pemesanan] = await prisma.$transaction([
        prisma.pemesanan_megakonser.count({
          where: params,
        }),
        prisma.pemesanan_megakonser.findMany({
          // orderBy: {
          //   [sortBy]: sortType,
          // },
          where: params,
          include: {
            detail_pemesanan_megakonser: {
              include: {
                tiket_konser: true, // Mengambil semua field dari tiket_konser
                tiket_konser_detail: true, // Mengambil semua field dari tiket_konser_detail
              },
            },
            affiliator: true,
          },
          skip, // Menggunakan offset untuk paginasi
          take: perPage, // Mengambil jumlah data sesuai perPage
        }),
      ]);

      // Memformat data agar lebih mudah diakses
      // const formattedData = pemesanan.map(pesan => ({
      //     ...pesan,
      //     detail_pemesanan: pesan.detail_pemesanan_megakonser.map(detail => ({
      //         ...detail,
      //         tiket_konser_detail_nama: detail.tiket_konser_detail.tiket_konser_detail_nama, // Akses nama tiket konser detail
      //     })),
      // }));

      const formattedData = pemesanan.map((pesan) => ({
        ...pesan,
        detail_pemesanan: pesan.detail_pemesanan_megakonser.map((detail) => ({
          ...detail,
          tiket_konser_detail: detail.tiket_konser_detail, // Mengambil semua field dari tiket_konser_detail
        })),
      }));

      console.log(JSON.stringify(formattedData, null, 2)); // Cek hasil

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: formattedData,
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

  async getPemesananMegakonserWithoutPagination(req, res) {
    try {
      const keyword = req.query.keyword || "";
      const status = req.query.status || "";
      const kode_affiliator = req.query.kode_affiliator || "";
      const sortBy = req.query.sortBy || "transaction_time";
      const sortType = req.query.order || "desc";

      const params = {
        OR: [
          {
            nama: {
              contains: keyword,
            },
          },
          {
            telepon: {
              contains: keyword,
            },
          },
          {
            email: {
              contains: keyword,
            },
          },
          {
            kode_pemesanan: {
              contains: keyword,
            },
          },
        ],
        ...(status && { status }),
        ...(kode_affiliator && { kode_affiliator }),
      };

      const [count, pemesanan] = await prisma.$transaction([
        prisma.pemesanan_megakonser.count({
          where: params,
        }),
        prisma.pemesanan_megakonser.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          include: {
            detail_pemesanan_megakonser: {
              include: {
                tiket_konser: true, // Mengambil semua field dari tiket_konser
                tiket_konser_detail: true, // Mengambil semua field dari tiket_konser_detail
              },
            },
            affiliator: true,
          },
        }),
      ]);

      // Memformat data agar lebih mudah diakses
      const formattedData = pemesanan.map((pesan) => ({
        ...pesan,
        detail_pemesanan: pesan.detail_pemesanan_megakonser.map((detail) => ({
          ...detail,
          tiket_konser_detail: detail.tiket_konser_detail, // Mengambil semua field dari tiket_konser_detail
        })),
      }));

      console.log(JSON.stringify(formattedData, null, 2)); // Cek hasil

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: formattedData,
        totalData: count, // Total data without pagination
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  // async findPemesananMegakonser(req, res) {
  //   try {
  //     const keyword = req.query.keyword || "";
  //     const kodePemesanan = req.query.kode_pemesanan || "";
  //     const page = Number(req.query.page || 1);
  //     const perPage = Number(req.query.perPage || 10);
  //     const skip = (page - 1) * perPage;
  //     const sortBy = req.query.sortBy || "transaction_time";
  //     const sortType = req.query.order || "desc";

  //     // Tambahkan parameter pencarian untuk no_hp dan email

  //     const [count, pemesanan] = await prisma.$transaction([
  //       prisma.pemesanan_megakonser.count({
  //         where: params,
  //       }),
  //       prisma.pemesanan_megakonser.findMany({
  //         orderBy: {
  //           [sortBy]: sortType,
  //         },
  //         where: params,
  //         skip,
  //         take: perPage,
  //       }),
  //     ]);

  //     res.status(200).json({
  //       message: "Sukses Ambil Data",
  //       data: pemesanan,
  //       pagination: {
  //         total: count,
  //         page,
  //         hasNext: count > page * perPage,
  //         totalPage: Math.ceil(count / perPage),
  //       },
  //     });
  //   } catch (error) {
  //     res.status(500).json({
  //       message: error?.message,
  //     });
  //   }
  // },

  async getDetailPemesananMegakonser(req, res) {
    try {
      const id = req.params.id;

      const [count, ActUser] = await prisma.$transaction([
        prisma.detail_pemesanan_megakonser.count({
          where: {
            id_pemesanan: Number(id),
          },
        }),
        prisma.detail_pemesanan_megakonser.findMany({
          where: {
            id_pemesanan: Number(id),
          },
          include: {
            tiket_konser: true,
            tiket_konser_detail: true,
          },
        }),
      ]);

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: ActUser,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async resendEmail(req, res) {
    try {
      const { kode_pemesanan } = req.params; // Ganti order_id dengan kode_pemesanan

      // Ambil data pemesanan berdasarkan kode_pemesanan
      const pemesanan = await prisma.pemesanan_megakonser.findUnique({
        where: {
          kode_pemesanan: kode_pemesanan, // Ganti order_id dengan kode_pemesanan
        },
        include: {
          detail_pemesanan_megakonser: {
            include: {
              tiket_konser: true,
              tiket_konser_detail: true,
            },
          },
        },
      });

      // Jika data pemesanan tidak ditemukan, kembalikan respon error
      if (!pemesanan) {
        return res.status(404).json({
          success: false,
          message: `Pemesanan dengan kode ${kode_pemesanan} tidak ditemukan.`,
        });
      }

      // Dapatkan email dari data pemesanan
      const { email } = pemesanan;

      try {
        // Buat file PDF berdasarkan detail pemesanan
        const pdfLink = await generatePdf({ orderDetails: pemesanan });
        console.log(
          `PDF generated for order: ${kode_pemesanan}, filePath: ${pdfLink}`
        );

        // Buat template email menggunakan detail pemesanan
        const templateEmail = await generateTemplateMegaKonser({
          email,
          tiket: pemesanan, // Isi detail pemesanan sebagai tiket
        });

        // Kirim email dengan lampiran PDF
        const msgId = await sendEmailWithPdf({
          email,
          html: templateEmail,
          subject: "Pembelian Tiket Sound of Freedom",
          pdfPath: pdfLink,
        });

        // Hapus file PDF setelah email terkirim
        fs.unlink(pdfLink, (err) => {
          if (err) {
            console.error("Error saat menghapus file PDF:", err);
          }
        });

        console.log(`Email with PDF sent for order: ${kode_pemesanan}`);
        return res.status(200).json({
          success: true,
          message: `Email berhasil dikirim ulang untuk order ${kode_pemesanan}`,
          msgId: msgId,
        });
      } catch (error) {
        console.error(
          `Gagal membuat atau mengirim email untuk order ${kode_pemesanan}, error:`,
          error
        );
        return res.status(500).json({
          success: false,
          message: `Gagal mengirim email untuk order ${kode_pemesanan}`,
          error: error.message,
        });
      }
    } catch (error) {
      console.error("Error dalam resend email:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengirim ulang email",
        error: error.message,
      });
    }
  },

  async exportAllPemesananToExcel(req, res) {
    try {
      // Ambil semua data dari tabel pemesanan_megakonser
      const pemesananData = await prisma.pemesanan_megakonser.findMany({
        include: {
          detail_pemesanan_megakonser: {
            include: {
              tiket_konser: true,
              tiket_konser_detail: true,
            },
          },
        },
      });

      // Membuat workbook dan worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Data Semua Pemesanan");

      // Menambahkan header ke worksheet
      worksheet.columns = [
        { header: "ID Pemesanan", key: "id", width: 15 },
        { header: "Nama", key: "nama", width: 20 },
        { header: "Telepon", key: "telepon", width: 15 },
        { header: "Email", key: "email", width: 25 },
        { header: "Gender", key: "gender", width: 10 },
        { header: "Total Harga", key: "total_harga", width: 15 },
        { header: "Kode Affiliator", key: "kode_affiliator", width: 15 },
        { header: "Kode Pemesanan", key: "kode_pemesanan", width: 20 },
        { header: "Metode Pembayaran", key: "metode_pembayaran", width: 20 },
        { header: "Status", key: "status", width: 15 },
        { header: "Transaction Time", key: "transaction_time", width: 25 },
        { header: "Expiry Time", key: "expiry_time", width: 25 },
        { header: "Detail Tiket Nama", key: "detail_tiket_nama", width: 25 },
        { header: "Detail Tiket Harga", key: "detail_tiket_harga", width: 15 },
      ];

      // Menambahkan semua data pemesanan ke worksheet
      pemesananData.forEach((order) => {
        // Tambahkan data utama pemesanan ke worksheet
        worksheet.addRow({
          id: order.id,
          nama: order.nama,
          telepon: order.telepon,
          email: order.email,
          gender: order.gender,
          total_harga: order.total_harga,
          kode_affiliator: order.kode_affiliator,
          kode_pemesanan: order.kode_pemesanan,
          metode_pembayaran: order.metode_pembayaran,
          status: order.status,
          transaction_time: order.transaction_time,
          expiry_time: order.expiry_time,
          detail_tiket_nama: "", // Kosong untuk menambah detail di bawahnya
          detail_tiket_harga: "",
        });

        // Menambahkan detail pemesanan di baris berikutnya
        order.detail_pemesanan_megakonser.forEach((detail) => {
          worksheet.addRow({
            id: "",
            nama: "",
            telepon: "",
            email: "",
            gender: "",
            total_harga: "",
            kode_affiliator: "",
            kode_pemesanan: "",
            metode_pembayaran: "",
            status: "",
            transaction_time: "",
            expiry_time: "",
            detail_tiket_nama:
              detail.tiket_konser_detail?.tiket_konser_detail_nama,
            detail_tiket_harga: detail.harga_tiket,
          });
        });
      });

      // Simpan file Excel ke folder uploads
      const filename = `Semua_Pemesanan_MegaKonser_${Date.now()}.xlsx`;
      const uploadPath = path.join(__dirname, "../../uploads", filename); // Set the path to uploads directory
      await workbook.xlsx.writeFile(uploadPath);

      // Memberikan respons file yang dapat diunduh
      res.status(200).json({
        message: "Data semua pemesanan berhasil diekspor ke Excel",
        file: filename,
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async exportPemesananToExcel(req, res) {
    try {
      const id = req.params.id;

      // Ambil data detail pemesanan berdasarkan id_pemesanan
      const detailPemesanan = await prisma.detail_pemesanan_megakonser.findMany(
        {
          where: {
            id_pemesanan: Number(id),
          },
          select: {
            kode_tiket: true, // Hanya mengambil kolom kode_tiket
          },
        }
      );

      if (detailPemesanan.length === 0) {
        return res
          .status(404)
          .json({ message: "Data kode tiket tidak ditemukan" });
      }

      // Membuat workbook dan worksheet
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Kode Tiket");

      // Menambahkan header ke worksheet
      worksheet.columns = [
        { header: "Kode Tiket", key: "kode_tiket", width: 30 }, // Hanya header kode_tiket
      ];

      // Menambahkan data kode tiket ke worksheet
      detailPemesanan.forEach((detail) => {
        worksheet.addRow({
          kode_tiket: detail.kode_tiket,
        });
      });

      // Membuat path untuk menyimpan file sementara
      const filename = `Kode_Tiket_MegaKonser_${Date.now()}.xlsx`;
      const uploadPath = path.join(__dirname, "../../uploads", filename);

      // Menulis file Excel ke path sementara
      await workbook.xlsx.writeFile(uploadPath);

      // Mengirimkan file Excel untuk diunduh
      res.download(uploadPath, filename, (err) => {
        if (err) {
          return res
            .status(500)
            .json({ message: "Gagal mengunduh file", error: err.message });
        }

        // Setelah pengunduhan selesai, hapus file dari server
        fs.unlink(uploadPath, (err) => {
          if (err) {
            console.error("Gagal menghapus file sementara:", err);
          }
        });
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async getPenjualanMegakonser(req, res) {
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

      const totalPendapatan = await prisma.pemesanan_megakonser.aggregate({
        _sum: {
          total_harga: true,
        },
        where: {
          status: "settlement",
        },
      });

      const pemesanan = await prisma.detail_pemesanan_megakonser.findMany({
        where: {
          pemesanan_megakonser: {
            status: "settlement",
          },
        },
        select: {
          id_detail_tiket: true,
          tiket_konser_detail: {
            select: {
              id: true,
              tiket_konser_detail_nama: true,
              tiket_konser: {
                select: {
                  tiket_id: true,
                  tiket_nama: true,
                  tiket_harga: true,
                },
              },
            },
          },
        },
      });

      const groupedData = pemesanan.reduce((acc, item) => {
        const { tiket_konser } = item.tiket_konser_detail;
        const tiketKey = tiket_konser.tiket_id;

        if (!acc[tiketKey]) {
          acc[tiketKey] = {
            tiket_id: tiket_konser.tiket_id,
            tiket_nama: tiket_konser.tiket_nama,
            tiket_harga: tiket_konser.tiket_harga,
            total_pembelian: 0,
            detail_tiket: {},
          };
        }

        acc[tiketKey].total_pembelian += 1;

        const detailKey = item.tiket_konser_detail.id;

        if (!acc[tiketKey].detail_tiket[detailKey]) {
          acc[tiketKey].detail_tiket[detailKey] = {
            detail_tiket_id: detailKey,
            tiket_konser_detail_nama:
              item.tiket_konser_detail.tiket_konser_detail_nama,
            jumlah_dipesan: 0,
          };
        }

        acc[tiketKey].detail_tiket[detailKey].jumlah_dipesan += 1;

        return acc;
      }, {});

      const penjualan = Object.values(groupedData).map((tiket) => ({
        tiket_id: tiket.tiket_id,
        tiket_nama: tiket.tiket_nama,
        tiket_harga: tiket.tiket_harga,
        total_pembelian: tiket.total_pembelian,
        detail_tiket: Object.values(tiket.detail_tiket),
      }));

      res.status(200).json({
        message: "Sukses Ambil Data",
        dataPenjualan: penjualan,
        totalPendapatan: totalPendapatan._sum.total_harga,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getPenjualanAffiliator(req, res) {
    try {
      const keyword = req.query.keyword || "";
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;

      const rawResult = await prisma.$queryRaw`
      SELECT a.nama, a.kode, 
             COALESCE(SUM(p.total_harga), 0) AS total_harga
      FROM affiliator a
      LEFT JOIN pemesanan_megakonser p 
      ON a.kode = p.kode_affiliator AND p.status = 'settlement'
      WHERE a.nama LIKE ${"%" + keyword + "%"}
      GROUP BY a.id
      ORDER BY total_harga DESC
      LIMIT ${perPage} OFFSET ${skip}
    `;

      // Konversi BigInt ke String untuk menghindari error
      const resultWithString = rawResult.map((row) => ({
        ...row,
        total_harga: row.total_harga.toString(), // Konversi BigInt ke string
      }));

      const countResult = await prisma.$queryRaw`
      SELECT COUNT(*) AS total 
      FROM affiliator a
      WHERE a.nama LIKE ${"%" + keyword + "%"}
    `;
      const total = Number(countResult[0]?.total || 0); // Pastikan total berupa number

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: resultWithString,
        pagination: {
          total,
          page,
          hasNext: total > page * perPage,
          totalPage: Math.ceil(total / perPage),
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message || "Terjadi kesalahan pada server",
      });
    }
  },

  async getAffiliator(req, res) {
    try {
      const affiliator = await prisma.affiliator.findMany({
        // where: {
        //   status: 1
        // }
      });

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: affiliator,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async postPemesananMegaKonserErp(req, res) {
    try {
      const {
        nama,
        telepon,
        email,
        gender,
        total_harga,
        // kode_affiliator,
        // bank,
        detail_pemesanan,
      } = req.body;

      if (!Array.isArray(detail_pemesanan) || detail_pemesanan.length < 1) {
        return res
          .status(400)
          .json({ message: "Detail pemesanan wajib diisi" });
      }

      // if (kode_affiliator) {
      //   const affiliator = await prisma.affiliator.findUnique({
      //     where: { kode: kode_affiliator },
      //   });

      //   if (!affiliator) {
      //     return res.status(400).json({ message: "Kode Affiliator tidak tersedia" });
      //   }
      // }

      const lastOrder = await prisma.pemesanan_megakonser.findFirst({
        orderBy: {
          id: "desc", //dibalikasi
        },
        select: {
          id: true,
        },
      });

      const baseId = 686;
      const nextId = lastOrder ? lastOrder.id + 1 : baseId;
      const hurufAwal =
        detail_pemesanan[0].id_tiket === 1
          ? "A"
          : detail_pemesanan[0].id_tiket === 3
          ? "B"
          : "C";
      const kode_pemesanan = `${hurufAwal}${String(nextId).padStart(5, "0")}`;

      const postResult = await prisma.pemesanan_megakonser.create({
        data: {
          nama,
          telepon,
          email,
          gender,
          total_harga: Number(total_harga),
          // kode_affiliator,
          kode_pemesanan: kode_pemesanan,
          metode_pembayaran: "B2B",
          status: "settlement",
          // transaction_time: transaction_time,
          // expiry_time: expiry_time,
        },
      });

      const tiketDetails = detail_pemesanan.map((detail) => ({
        id_tiket: detail.id_tiket,
        id_detail_tiket: detail.id_tiket_detail,
        harga_tiket: detail.harga_tiket,
      }));

      const transformedDetails = detail_pemesanan.map((detail, index) => {
        const kode_tiket = `TK-${Math.floor(100000 + Math.random() * 900000)}`;

        return {
          id_pemesanan: postResult.id,
          id_tiket: detail.id_tiket,
          id_detail_tiket: detail.id_tiket_detail,
          kode_tiket,
        };
      });

      await prisma.detail_pemesanan_megakonser.createMany({
        data: transformedDetails,
      });

      const pemesanan = await prisma.pemesanan_megakonser.findUnique({
        where: {
          kode_pemesanan: kode_pemesanan,
        },
        include: {
          detail_pemesanan_megakonser: {
            include: {
              tiket_konser: true,
              tiket_konser_detail: true,
            },
          },
        },
      });

      try {
        const pdfLink = await generatePdf({ orderDetails: pemesanan });

        const templateEmail = await generateTemplateMegaKonser({
          email,
          password: email,
          tiket: pemesanan,
        });

        const msgId = await sendEmailWithPdf({
          email,
          html: templateEmail,
          subject: "Pembelian Tiket Sound of Freedom",
          pdfPath: pdfLink,
        });
      } catch (error) {
        console.error(
          `Failed to generate PDF for order: ${kode_pemesanan}, error:`,
          error
        );
      }

      res.status(200).json({
        message: "Sukses Kirim Data",
        data: {
          postResult,
          tiketDetails,
        },
      });
    } catch (error) {
      console.error(`Error processing order: ${error.message}`);
      res.status(500).json({
        message: error.message,
      });
    }
  },
};
