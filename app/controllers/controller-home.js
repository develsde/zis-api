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
const { reqPay, cancelPay } = require("../controllers/controller-payment");
const {
  scheduleCekStatus,
  scheduleCekStatusKonser,
  scheduleCekStatusVrfp,
} = require("../helper/background-jobs");
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
  generateTemplateQurban,
  generateTemplateVRFP,
  generateTemplateVrfpSuccess,
  generateTemplatePemotonganQurban,
  generateTemplateQurbanSuccess,
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
const { connect } = require("http2");
const { sendFonnte } = require("../helper/whatsapp");

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
      console.log("📦 Incoming req.body:", req.body);

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
        ukuran,
        gender,
        kode_affiliator,
      } = req.body;

      console.log("📧 Email extracted from req.body:", email);

      let affiliatorId = null;
      if (kode_affiliator) {
        const affiliator = await prisma.affiliator_vrfp.findFirst({
          where: { kode_affiliator: kode_affiliator },
        });
        if (!affiliator) {
          return res
            .status(400)
            .json({ message: "Kode Affiliator Tidak Tersedia" });
        }
        affiliatorId = affiliator.id;
      }

      const paket = await prisma.activity_paket.findUnique({
        where: { id: Number(paket_id) },
        select: {
          biaya: true,
          kategori: true,
        },
      });

      let biaya_paket = paket?.biaya || 0;
      let zak = zakat || 0;
      let wak = wakaf || 0;
      let ong = ongkir || 0;
      let jml = jumlah_peserta || 1;

      let total =
        Number(biaya_paket) * Number(jml) +
        Number(zak) +
        Number(wak) +
        Number(ong);

      // Buat data activity_additional terlebih dahulu
      const actResult = await prisma.activity_additional.create({
        data: {
          nama,
          program: {
            connect: { program_id: Number(program_id) },
          },
          no_wa,
          activity_paket: {
            connect: { id: Number(paket_id) },
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
          status_transaksi: "Belum Dibayar",
          etd,
          ongkir: Number(ong),
          total_biaya: Number(total),
          iskomunitas: Number(iskomunitas),
          nama_komunitas,
          referentor: {
            connect: { id: Number(referentor) },
          },
          affiliator_vrfp: {
            connect: { id: affiliatorId },
          },
        },
      });

      // Buat final order_id menggunakan ID dari actResult
      const timesg = String(+new Date());
      const final_order_id = `${timesg}P${program_id}A${actResult.id}`;

      // Update order_id di database
      await prisma.activity_additional.update({
        where: { id: actResult.id },
        data: { order_id: final_order_id },
      });

      // Kirim ke Midtrans dengan order_id final
      const midtrans = await midtransfer({
        order: final_order_id,
        price: Number(total),
      });

      const statusId = midtrans.data.transaction_status;
      const displayStatus = statusId === "200" ? "Berhasil" : "Gagal";

      // Update status transaksi sesuai respons Midtrans
      await prisma.activity_additional.update({
        where: { id: actResult.id },
        data: { status_transaksi: displayStatus },
      });

      // Simpan data user
      const accUser = await prisma.activity_user.create({
        data: {
          program: {
            connect: { program_id: Number(program_id) },
          },
          activity_additional: {
            connect: { id: actResult.id },
          },
          nama,
          no_wa,
          ukuran,
          gender,
        },
      });

      // Simpan log request ke Midtrans
      const header = {
        isProduction: true,
        serverKey: serverkeys,
        clientKey: clientkeys,
      };

      await prisma.log_vendor.create({
        data: {
          vendor_api: "Snap MidTrans",
          url_api: req.originalUrl,
          api_header: JSON.stringify(header),
          api_body: JSON.stringify({
            order: final_order_id,
            price: Number(total),
          }),
          api_response: JSON.stringify(midtrans),
          payload: JSON.stringify(req.body),
        },
      });

      // Kirim email & jadwalkan pengecekan status
      if (accUser) {
        let pn = no_wa.replace(/\D/g, "");
        if (pn.startsWith("0")) {
          pn = "0" + pn.substring(1).trim();
        } else if (pn.startsWith("62")) {
          pn = "0" + pn.substring(2).trim();
        }

        const date = new Date(actResult.created_date);
        const formattedDate = date.toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });

        const formattedDana = total.toLocaleString("id-ID", {
          style: "currency",
          currency: "IDR",
        });

        const templateEmail = await generateTemplateVRFP({
          formattedDate,
          formattedDana,
          nama,
          no_wa,
          zak,
          wak,
          jasa_kirim,
          alamat,
          kategori: paket?.kategori || "",
          biaya_paket: paket?.biaya || "",
        });

        const msgId = await sendEmail({
          email,
          html: templateEmail,
          subject: "Pembayaran Virtual Run",
        });

        scheduleCekStatusVrfp({
          order: final_order_id,
          formattedDate,
          email,
          formattedDana,
          nama,
          no_wa,
          zak,
          wak,
          jasa_kirim,
          alamat,
          kategori: paket?.kategori || "",
          biaya_paket: paket?.biaya || "",
        });
      }

      res.status(200).json({
        message: "Sukses Kirim Data",
        data: {
          accUser,
          actResult,
          midtrans,
        },
      });
    } catch (error) {
      console.error("🔥 ERROR UTAMA:", error.message);
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async resendEmailVrfp(req, res) {
    try {
      const { order_id } = req.params;

      // Ambil data pemesanan berdasarkan order_id
      const pemesanan = await prisma.activity_additional.findFirst({
        where: {
          order_id: order_id,
        },
        include: {
          activity_paket: {
            select: {
              kategori: true,
              biaya: true,
            },
          },
        },
      });

      // Jika data pemesanan tidak ditemukan
      if (!pemesanan) {
        return res.status(404).json({
          success: false,
          message: `Pemesanan dengan kode ${order_id} tidak ditemukan.`,
        });
      }

      const {
        nama,
        no_wa,
        email,
        zakat,
        wakaf,
        jasa_kirim,
        alamat,
        created_date,
        activity_paket,
      } = pemesanan;

      const kategori = activity_paket?.kategori || "";
      const biaya_paket = activity_paket?.biaya || "";
      const total = pemesanan.total_biaya;

      // Format tanggal dan total dana
      const date = new Date(created_date);
      const formattedDate = date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const formattedDana = total.toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
      });

      // Format nomor WA
      let pn = no_wa.replace(/\D/g, "");
      if (pn.startsWith("0")) {
        pn = "0" + pn.substring(1).trim();
      } else if (pn.startsWith("62")) {
        pn = "0" + pn.substring(2).trim();
      }

      // Generate template email
      const templateEmail = await generateTemplateVrfpSuccess({
        formattedDate,
        formattedDana,
        nama,
        no_wa: pn,
        zak: zakat,
        wak: wakaf,
        jasa_kirim,
        alamat,
        kategori,
        biaya_paket,
      });

      // Kirim email
      const msgId = await sendEmail({
        email,
        html: templateEmail,
        subject: "Pembayaran Virtual Run",
      });

      return res.status(200).json({
        success: true,
        message: `Email berhasil dikirim ulang untuk order ${order_id}`,
        msgId,
      });
    } catch (error) {
      console.error("Error dalam resend email:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengirim ulang email",
        error: error.message,
      });
    }
  },

  async cancelPayQurban(req, res) {
    try {
      const { UTC } = req.params;

      const pemesanan = await prisma.activity_qurban.findFirst({
        where: { UTC },
      });

      if (!pemesanan) {
        return res.status(404).json({
          success: false,
          message: `Pemesanan dengan kode ${UTC} tidak ditemukan.`,
        });
      }

      const uniqueID = pemesanan.UTC;

      if (!uniqueID) {
        return res.status(400).json({
          success: false,
          message: `Kode transaksi (uniqueTransactionCode) tidak ditemukan.`,
          data: pemesanan,
        });
      }

      try {
        const resultData = await cancelPay(uniqueID);

        return res.status(200).json({
          success: true,
          message: `Pembayaran untuk transaksi ${UTC} berhasil dibatalkan.`,
          data: resultData,
        });
      } catch (error) {
        // Periksa apakah error.response ada, jika tidak gunakan error.message saja
        const statusCode = error.response?.status || 500;
        const errorData = error.response?.data || error.message;

        console.error("🔴 Gagal membatalkan di Artajasa:", errorData);

        return res.status(statusCode).json({
          success: false,
          message: `Gagal membatalkan pembayaran untuk transaksi ${UTC}.`,
          error: errorData,
        });
      }
    } catch (error) {
      console.error("🔴 Error umum:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan internal.",
        error: error.message,
      });
    }
  },

  async sendEmailQurban(req, res) {
    try {
      const { UTC } = req.params;

      // Ambil data pemesanan berdasarkan UTC dan relasinya
      const pemesanan = await prisma.activity_qurban.findFirst({
        where: { UTC },
        include: {
          lokasi_qurban: true, // Lokasi penyembelihan
          detail_qurban: {
            include: {
              activity_paket: true, // Info paket qurban
            },
          },
        },
      });

      // Jika data pemesanan tidak ditemukan
      if (!pemesanan) {
        return res.status(404).json({
          success: false,
          message: `Pemesanan dengan kode ${UTC} tidak ditemukan.`,
        });
      }

      const {
        nama,
        no_wa,
        email,
        lokasi_qurban,
        detail_qurban,
        created_date,
        total,
      } = pemesanan;
      console.log("detail qurban", detail_qurban);

      const lokasi = lokasi_qurban?.lokasi_penyembelihan || "-";

      // Format tanggal dan total dana
      const date = new Date(created_date);
      const formattedDate = date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const formattedDana =
        total?.toLocaleString("id-ID", {
          style: "currency",
          currency: "IDR",
        }) || "Rp0";

      // Format nomor WA
      let pn = no_wa.replace(/\D/g, "");
      if (pn.startsWith("0")) {
        pn = "0" + pn.substring(1).trim();
      } else if (pn.startsWith("62")) {
        pn = "0" + pn.substring(2).trim();
      }

      // 👇 Contoh penggunaan data detail_qurban (opsional)
      const listMudohi = detail_qurban.map((d) => d.nama_mudohi).join(", ");
      const listKategori = detail_qurban
        .map((d) => d.activity_paket?.kategori || "-")
        .join(", ");

      // Generate template email (pastikan fungsinya bisa terima data tambahan)
      const templateEmail = await generateTemplatePemotonganQurban({
        formattedDate,
        formattedDana,
        nama,
        no_wa: pn,
        lokasi,
        detail_qurban,
      });

      // Kirim email
      const msgId = await sendEmail({
        email,
        html: templateEmail,
        subject: "Pemberitahuan Penyembelihan Hewan Qurban",
      });

      return res.status(200).json({
        success: true,
        message: `Email berhasil dikirim ulang untuk order ${UTC}`,
        msgId,
      });
    } catch (error) {
      console.error("Error dalam resend email:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengirim ulang email",
        error: error.message,
      });
    }
  },
  async sendEmailQurbanSuccess(req, res) {
    try {
      const { UTC } = req.params;

      // Ambil data pemesanan berdasarkan UTC dan relasinya
      const pemesanan = await prisma.activity_qurban.findFirst({
        where: { UTC },
        include: {
          lokasi_qurban: true,
          program: true,
          detail_qurban: {
            include: {
              activity_paket: true,
            },
          },
        },
      });

      if (!pemesanan) {
        return res.status(404).json({
          success: false,
          message: `Pemesanan dengan kode ${UTC} tidak ditemukan.`,
        });
      }

      const { nama, email, detail_qurban, program } = pemesanan;

      // Hitung total dari seluruh detail_qurban
      const totalDana = detail_qurban.reduce((sum, item) => {
        return sum + Number(item.total || 0);
      }, 0);

      const formattedDana = new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
      }).format(totalDana);

      const formattedDate = new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const formattedDetail = detail_qurban.map((dq) => ({
        nama_mudohi: dq.nama_mudohi,
        paket_hewan: dq.activity_paket?.kategori || "-",
        qty: dq.qty,
        total: new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
        }).format(dq.total),
      }));

      const templateEmail = await generateTemplateQurbanSuccess({
        nama,
        formattedDate,
        formattedDana,
        program_nama: program?.nama || "-",
        detail_qurban: formattedDetail,
      });

      const msgId = await sendEmail({
        email,
        html: templateEmail,
        subject: "Pembayaran Qurban Anda Berhasil - ZISWAF Indosat",
      });

      return res.status(200).json({
        success: true,
        message: `Email berhasil dikirim ulang untuk order ${UTC}`,
        msgId,
      });
    } catch (error) {
      console.error("Error dalam resend email:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengirim ulang email",
        error: error.message,
      });
    }
  },

  async getPaket(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.sortType || "asc";

      const params = {
        program: {
          program_title: {
            contains: keyword,
            // biar gak case sensitive
          },
        },
      };

      const [count, paket] = await prisma.$transaction([
        prisma.activity_paket.count({
          where: params,
        }),
        prisma.activity_paket.findMany({
          include: {
            program: true,
          },
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      // Konversi BigInt ke String jika ada
      const paketResult = paket.map((item) => {
        return JSON.parse(
          JSON.stringify(item, (_, value) =>
            typeof value === "bigint" ? value.toString() : value
          )
        );
      });

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: paketResult,
        pagination: {
          total: count,
          page,
          hasNext: count > page * perPage,
          totalPage: Math.ceil(count / perPage),
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },
  async getLokasiQurban(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.sortType || "asc";

      const params = {
        lokasi_penyembelihan: {
          contains: keyword,
        },
      };

      const [count, lokasi] = await prisma.$transaction([
        prisma.lokasi_qurban.count({
          where: params,
        }),
        prisma.lokasi_qurban.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      res.status(200).json({
        message: "Sukses Ambil Data Lokasi Qurban",
        data: lokasi,
        pagination: {
          total: count,
          page,
          hasNext: count > page * perPage,
          totalPage: Math.ceil(count / perPage),
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },
  async getLokasiQurbanPortal(req, res) {
    try {
      const lokasiList = await prisma.lokasi_qurban.findMany({
        select: {
          id: true,
          wilayah: true,
          lokasi_penyembelihan: true,
        },
        orderBy: {
          lokasi_penyembelihan: "asc", // Urutkan ASC berdasarkan lokasi_penyembelihan
        },
      });

      // Group by wilayah secara manual
      const groupedLokasi = lokasiList.reduce((acc, lokasi) => {
        const { wilayah } = lokasi;
        if (!acc[wilayah]) {
          acc[wilayah] = [];
        }
        acc[wilayah].push(lokasi);
        return acc;
      }, {});

      res.status(200).json({
        message: "Sukses Ambil Data Lokasi Qurban",
        data: groupedLokasi,
      });
    } catch (error) {
      console.error("Error getLokasiQurbanPortal:", error);
      res.status(500).json({
        message: "Terjadi kesalahan saat mengambil data",
        error: error.message,
      });
    }
  },
  async createLokasiQurban(req, res) {
    try {
      const { lokasi_penyembelihan, wilayah } = req.body;

      if (!lokasi_penyembelihan) {
        return res
          .status(400)
          .json({ message: "Lokasi penyembelihan harus diisi" });
      }

      const lokasi = await prisma.lokasi_qurban.create({
        data: {
          lokasi_penyembelihan,
          wilayah,
        },
      });

      res.status(201).json({
        message: "Lokasi qurban berhasil ditambahkan",
        data: lokasi,
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },
  async updateLokasiQurban(req, res) {
    try {
      const { id } = req.params; // Ambil ID dari parameter URL
      const { lokasi_penyembelihan, wilayah } = req.body; // Ambil data dari request body

      // Cek apakah lokasi dengan ID tersebut ada
      const existingLokasi = await prisma.lokasi_qurban.findUnique({
        where: { id: Number(id) },
      });

      if (!existingLokasi) {
        return res.status(404).json({
          message: "Lokasi qurban tidak ditemukan",
        });
      }

      // Update data lokasi qurban
      const updatedLokasi = await prisma.lokasi_qurban.update({
        where: { id: Number(id) },
        data: {
          lokasi_penyembelihan,
          wilayah,
        },
      });

      res.status(200).json({
        message: "Lokasi qurban berhasil diperbarui",
        data: updatedLokasi,
      });
    } catch (error) {
      res.status(500).json({
        message: "Terjadi kesalahan saat memperbarui lokasi qurban",
        error: error.message,
      });
    }
  },
  async deleteLokasiQurban(req, res) {
    try {
      const { id } = req.params; // Ambil ID dari parameter URL

      // Cek apakah lokasi dengan ID tersebut ada
      const existingLokasi = await prisma.lokasi_qurban.findUnique({
        where: { id: Number(id) },
      });

      if (!existingLokasi) {
        return res.status(404).json({
          message: "Lokasi qurban tidak ditemukan",
        });
      }

      // Hapus lokasi qurban
      await prisma.lokasi_qurban.delete({
        where: { id: Number(id) },
      });

      res.status(200).json({
        message: "Lokasi qurban berhasil dihapus",
      });
    } catch (error) {
      res.status(500).json({
        message: "Terjadi kesalahan saat menghapus lokasi qurban",
        error: error.message,
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
      const { kategori, biaya, keterangan, program_id } = req.body;
      const id = req.params.id;

      const putResult = await prisma.activity_paket.update({
        where: {
          id: Number(id),
        },
        data: {
          kategori,
          biaya: Number(biaya),
          keterangan,
          program_id,
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
      // Ambil semua activity_additional yang sudah settlement
      const ActAdditional = await prisma.activity_additional.findMany({
        where: {
          status_transaksi: "settlement",
        },
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

      // Ambil semua ID untuk digunakan dalam query raw
      const additionalIds = ActAdditional.map((item) => item.id).filter(
        (id) => id !== undefined && id !== null
      );

      const additionalIdsString = additionalIds.join(",");
      if (additionalIds.length === 0) {
        return res.status(200).json({
          message: "Tidak ada transaksi settlement",
          dataPenjualan: [],
          totalZakat: 0,
          totalWakaf: 0,
          ongkir: 0,
          totalPendapatan: 0,
        });
      }

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

      // Filter based on status or include exception ID
      const filteredActAdditional = ActAdditional.filter((item, index) => {
        const isSettlement =
          statuses[index]?.data?.transaction_status === "settlement";
        const isExceptionId = item.id === 1577;
        return isSettlement || isExceptionId;
      });

      // Extract subdistrict IDs from filteredActAdditional
      const subdistrictIds = filteredActAdditional
        .map((item) => item.district_id)
        .filter((id) => id !== undefined && id !== null);

      console.log("Subdistrict IDs:", subdistrictIds);

      // Fetch subdistrict data from RajaOngkir
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
          orderBy: {
            // false (bukan 'Lainnya') akan muncul lebih dulu, true (=='Lainnya') di akhir
            referentor_nama: {
              sort: "asc",
            },
          },
        }),
      ]);

      // Sort manual jika Prisma tidak mendukung kondisi
      const sortedRef = Ref.sort((a, b) => {
        if (a.referentor_nama === "Lainnya") return 1;
        if (b.referentor_nama === "Lainnya") return -1;
        return 0;
      });

      res.status(200).json({
        message: "Sukses Ubah Data",
        data: sortedRef,
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
        affiliator_id,
      } = req.body;

      const totals = Number(harga) + Number(ongkir);

      if (detail_qurban.length < 1) {
        return res
          .status(400)
          .json({ message: "Masukkan detail qurban wajib diisi" });
      }
      let affiliatorId = null;
      if (affiliator_id) {
        const affiliator = await prisma.affiliator_qurban.findFirst({
          where: { kode_affiliator: affiliator_id },
        });
        if (!affiliator) {
          return res
            .status(400)
            .json({ message: "Kode Affiliator Tidak Tersedia" });
        }
        affiliatorId = affiliator.id;
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

      let phoneNumber;
      if (Number(bank) === 20) {
        phoneNumber = "081411010204";
      } else if (Number(bank) === 2) {
        phoneNumber = "08975947480 "; // Jika berhasil
      } else if (Number(bank) === 14) {
        phoneNumber = "0817345545";
      } else {
        phoneNumber = no_wa;
      }

      // Mengirim request ke payment gateway menggunakan reqPay
      const response = await reqPay({
        body: {
          phone_number: phoneNumber,
          id_SOF: bank,
          price: totalPrice,
        },
      });

      const UTC = response.data.SendPaymentResp.uniqueTransactionCode || "0";
      const actionData = response.data.SendPaymentResp.actionData;

      // Memproses actionData jika bank adalah 20
      const actionMatches = actionData?.match(/\[([^\]]+)\]/g);

      const bankName =
        Number(bank) === 20
          ? "BlueBCA"
          : Number(bank) === 2
          ? "OVO"
          : Number(bank) === 16
          ? "Qris"
          : Number(bank) === 14
          ? "Dana"
          : actionMatches && actionMatches[0]
          ? actionMatches[0]
          : "Unknown Bank";

      const vaNumber =
        Number(bank) === 20 || Number(bank) === 2
          ? actionData
          : actionMatches && actionMatches[2]
          ? actionMatches[2]
          : "Unknown VA";

      // Insert ke tabel activity_qurban
      const postResult = await prisma.activity_qurban.create({
        data: {
          program: {
            connect: { program_id: Number(program_id) },
          },
          nama,
          affiliator_qurban: {
            connect: { id: affiliatorId },
          },
          no_wa,
          email,
          province_id: Number(province_id) || 0,
          city_id: Number(city_id) || 0,
          district_id: Number(district_id) || 0,
          alamat: alamat || "",
          ukuran: ukuran || "",
          nik: nik || "",
          type: Number(type) || 0,
          alokasi_hak: isNaN(Number(alokasi_hak)) ? 0 : Number(alokasi_hak),
          total: isNaN(Number(totals)) ? 0 : Number(totals),
          harga: isNaN(Number(harga)) ? 0 : Number(harga),
          ongkir: isNaN(Number(ongkir)) ? 0 : Number(ongkir),
          gender,
          lokasi_qurban: lokasi_penyaluran
            ? {
                connect: { id: Number(lokasi_penyaluran) }, // Sesuaikan field `id` dengan struktur di DB
              }
            : undefined,
          log_aj: UTC
            ? {
                connect: { uniqueCode: UTC }, // Sesuaikan field `UTC` dengan struktur di DB
              }
            : undefined,
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

      let lokasi;
      if (lokasi_penyaluran) {
        const lok = await prisma.lokasi_qurban.findUnique({
          where: {
            id: lokasi_penyaluran,
          },
        });
        lokasi = lok;
      }

      const wilayah = await prisma.districts.findUnique({
        where: {
          dis_id: Number(district_id),
        },
        include: {
          cities: {
            where: {
              city_id: Number(city_id),
            },
            include: {
              provinces: {
                where: {
                  prov_id: Number(province_id),
                },
              },
            },
          },
        },
      });

      const detailQurban = await prisma.detail_qurban.findMany({
        where: { qurban_id: postResult?.id },
        include: {
          activity_paket: {
            select: { kategori: true }, // Ambil nama kategori, bukan ID
          },
        },
      });

      const templateEmail = await generateTemplateQurban({
        program_id,
        nama,
        formattedDate,
        no_wa,
        formattedDana,
        bankName,
        vaNumber,
        detail_qurban: detailQurban.map((dq) => ({
          nama_mudohi: dq.nama_mudohi,
          paket_hewan: dq.activity_paket?.kategori || "Tidak diketahui",
          qty: dq.qty,
          total: new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
          }).format(dq.total),
        })),
        lokasi: lokasi?.lokasi_penyembelihan || "-",
        alokasi_hak,
        type,
        province: wilayah?.cities?.provinces?.prov_name || "Tidak Diketahui",
        city: wilayah?.cities?.city_name || "Tidak Diketahui",
        kecamatan: wilayah?.dis_name || "Tidak Diketahui",
        alamat,
        nik_karyawan: nik,
      });

      const msgId = await sendEmail({
        email,
        html: templateEmail,
        subject: "Pembayaran Qurban Zis Indosat",
      });

      // await sendWhatsapp({
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
      //     "\nBank : " +
      //     bankName +
      //     "\nVA Number : " +
      //     vaNumber +
      //     "\n\nJika ada informasi yang tidak sesuai harap hubungi admin kami.\n" +
      //     "\nSalam zisindosat\n" +
      //     "\nAdmin\n" +
      //     "\nPanitia Qurban Raya\n" +
      //     "0899-8387-090",
      // });

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

  // async postPemesananMegaKonser(req, res) {
  //   try {
  //     const {
  //       nama,
  //       telepon,
  //       email,
  //       gender,
  //       total_harga,
  //       kode_affiliator,
  //       bank,
  //       detail_pemesanan,
  //     } = req.body;

  //     if (!Array.isArray(detail_pemesanan) || detail_pemesanan.length < 1) {
  //       return res
  //         .status(400)
  //         .json({ message: "Detail pemesanan wajib diisi" });
  //     }

  //     if (kode_affiliator) {
  //       const affiliator = await prisma.affiliator.findUnique({
  //         where: { kode: kode_affiliator },
  //       });

  //       if (!affiliator) {
  //         return res
  //           .status(400)
  //           .json({ message: "Kode Affiliator tidak tersedia" });
  //       }
  //     }

  //     // Generate kode_pemesanan A00001 dst
  //     const lastOrder = await prisma.pemesanan_megakonser.findFirst({
  //       orderBy: { id: "desc" },
  //       select: { id: true },
  //     });

  //     const baseId = 686; // Nilai dasar jika data kosong
  //     const nextId = lastOrder ? lastOrder.id + 1 : baseId;
  //     const hurufAwal =
  //       detail_pemesanan[0].id_tiket === 1
  //         ? "A"
  //         : detail_pemesanan[0].id_tiket === 3
  //         ? "B"
  //         : "C";
  //     const kode_pemesanan = `${hurufAwal}${String(nextId).padStart(5, "0")}`;

  //     console.log(
  //       `Processing new order: ${kode_pemesanan} for email: ${email}`
  //     );

  //     // Menggunakan midtransfer untuk pembayaran Snap
  //     const response = await midtransfer({
  //       order: kode_pemesanan,
  //       price: total_harga,
  //     });

  //     console.log(`Midtrans response for order: ${kode_pemesanan}`, response);

  //     if (!response.success) {
  //       return res.status(500).json({
  //         message: response.message,
  //       });
  //     }

  //     const transaction_time = new Date();
  //     const expiry_time = new Date();
  //     expiry_time.setMinutes(expiry_time.getMinutes() + 15);

  //     const statusId = response.data.transaction_status;
  //     const displayStatus = statusId === "200" ? "Berhasil" : "gagal";

  //     const postResult = await prisma.pemesanan_megakonser.create({
  //       data: {
  //         nama,
  //         telepon,
  //         email,
  //         gender,
  //         total_harga: Number(total_harga),
  //         kode_affiliator,
  //         kode_pemesanan: kode_pemesanan,
  //         metode_pembayaran: "snap", // Indikasikan menggunakan Snap
  //         status: displayStatus,
  //         transaction_time: transaction_time,
  //         expiry_time: expiry_time,
  //       },
  //     });

  //     console.log(
  //       `Order created in DB: ${kode_pemesanan}, ID: ${postResult.id}`
  //     );

  //     const transformedDetails = detail_pemesanan.map((detail) => {
  //       const kode_tiket = `TK-${Math.floor(100000 + Math.random() * 900000)}`;

  //       return {
  //         id_pemesanan: postResult.id,
  //         id_tiket: detail.id_tiket,
  //         id_detail_tiket: detail.id_tiket_detail,
  //         kode_tiket,
  //       };
  //     });

  //     await prisma.detail_pemesanan_megakonser.createMany({
  //       data: transformedDetails,
  //     });

  //     console.log(`Details inserted for order: ${kode_pemesanan}`);

  //     res.status(200).json({
  //       message: "Sukses Kirim Data",
  //       data: {
  //         postResult,
  //         transformedDetails,
  //         transactionToken: response.data.transaction_token,
  //         redirectUrl: response.data.redirect_url,
  //       },
  //     });
  //   } catch (error) {
  //     console.error(`Error processing order: ${error.message}`);
  //     res.status(500).json({
  //       message: error.message,
  //     });
  //   }
  // },
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
        infaq,
        detail_pemesanan,
      } = req.body;

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

      const baseId = 686;
      const nextId = lastOrder ? lastOrder.id + 1 : baseId;
      const kode_pemesanan = `SOF${String(nextId).padStart(5, "0")}`;

      console.log(
        `Processing new order: ${kode_pemesanan} for email: ${email}`
      );

      const totalHargaFinal = Number(total_harga) + Number(infaq || 0);

      const response = await midtransfer({
        order: kode_pemesanan,
        price: totalHargaFinal,
      });

      if (!response.success) {
        return res.status(500).json({ message: response.message });
      }

      const transaction_time = new Date();
      const expiry_time = new Date();
      expiry_time.setMinutes(expiry_time.getMinutes() + 15);

      const statusId = response.data.transaction_status;
      const displayStatus = statusId === "200" ? "Berhasil" : "gagal";

      const postResult = await prisma.pemesanan_megakonser.create({
        data: {
          nama,
          telepon,
          email,
          gender,
          total_harga: Number(total_harga),
          kode_affiliator,
          kode_pemesanan,
          metode_pembayaran: "snap",
          status: displayStatus,
          transaction_time,
          expiry_time,
          infaq,
        },
      });

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

      const pemesanan = await prisma.pemesanan_megakonser.findUnique({
        where: { kode_pemesanan },
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
        scheduleCekStatusKonser({
          order: kode_pemesanan,
          email,
          pemesanan,
          filePath: pdfLink,
        });
      } catch (error) {
        console.error(
          `Failed to generate PDF for order: ${kode_pemesanan}`,
          error
        );
      }

      const templateEmail = await generateTemplatePembayaran({
        email,
        postResult,
        totalHargaFinal,
        detail: transformedDetails,
        tiket: pemesanan,
      });

      const cleanNumber = telepon.replace(/\D/g, "").replace(/^62/, "0");
      const wa_number = cleanNumber.startsWith("0")
        ? cleanNumber
        : `0${cleanNumber}`;

      const tiketText = pemesanan.detail_pemesanan_megakonser
        .map((item, index) => {
          const harga = Number(
            item.tiket_konser?.tiket_harga || 0
          ).toLocaleString("id-ID");
          const jenis =
            item.tiket_konser_detail?.tiket_konser_detail_nama || "N/A";
          return (
            `Tiket #${index + 1}\n` +
            `Kode Tiket : ${item.kode_tiket}\n` +
            `Jenis Tiket: ${jenis}\n` +
            `Harga      : Rp${harga}`
          );
        })
        .join(`\n-----------------------\n`);

      const totalPembayaran = totalHargaFinal.toLocaleString("id-ID");
      const infaqStr = Number(infaq || 0).toLocaleString("id-ID");

      const waText = `
  Assalamu'alaikum Wr Wb.
  
  Mohon melakukan pembayaran tiket Anda.
  
  Berikut ini adalah detail transaksi Anda:
  
  Nama               : ${nama}
  Kode Pemesanan     : ${kode_pemesanan}
  Metode Pembayaran  : Snap
  
  =======================
  TIKET YANG ANDA PESAN:
  =======================
  
  ${tiketText}
  
  Infaq             : Rp${infaqStr}
  Total Pembayaran  : Rp${totalPembayaran}
  
  Silakan segera melakukan pembayaran melalui link berikut:
  ${response.data.redirect_url}
  
  Wassalamu'alaikum Wr Wb.
  `.trim();

      await sendFonnte({
        wa_number,
        text: waText,
      });

      res.status(200).json({
        message: "Sukses Kirim Data",
        data: {
          postResult,
          tiketDetails: transformedDetails,
          transactionToken: response.data.transaction_token,
          redirectUrl: response.data.redirect_url,
        },
      });
    } catch (error) {
      console.error(`Error processing order: ${error.message}`);
      res.status(500).json({ message: error.message });
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
      // const filePath = path.join(
      //   __dirname,
      //   `../../uploads/output${order_id}.pdf`
      // );
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
  async checkPayVrfp(req, res, idOrder) {
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

      const pemesanan = await prisma.activity_additional.findUnique({
        where: {
          order_id: order_id,
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
      });

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
        const msgId = await sendEmail({
          email,
          html: templateEmail,
          subject: "Pembelian Paket Virtual Run",
          // pdfPath: filePath,
        });

        // fs.unlink(filePath, (err) => {
        //   if (err) {
        //     console.error("Error saat menghapus file PDF:", err);
        //   }
        // });

        // await prisma.pemesanan_megakonser.update({
        //   where: { kode_pemesanan: order_id },
        //   data: { status: stats.data.transaction_status || "" },
        // });

        // console.log(
        //   `Order ${order_id} settled successfully. Email sent: ${msgId}`
        // );

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

  // async getPemesananMegakonser(req, res) {
  //   try {
  //     const keyword = req.query.keyword || "";
  //     const kode_affiliator = req.query.kode_affiliator || "";
  //     const page = Number(req.query.page || 1);
  //     const perPage = Number(req.query.perPage || 10);
  //     const skip = (page - 1) * perPage;
  //     const sortBy = req.query.sortBy || "transaction_time";
  //     const sortType = req.query.order || "desc";

  //     const filterParams = {
  //       OR: [
  //         { nama: { contains: keyword } },
  //         { telepon: { contains: keyword } },
  //         { email: { contains: keyword } },
  //         { kode_pemesanan: { contains: keyword } },
  //       ],
  //       ...(kode_affiliator && { kode_affiliator }),
  //     };

  //     // Ambil semua pemesanan dulu
  //     const allPemesanan = await prisma.pemesanan_megakonser.findMany({
  //       where: filterParams,
  //       orderBy: {
  //         [sortBy]: sortType,
  //       },
  //       include: {
  //         detail_pemesanan_megakonser: {
  //           include: {
  //             tiket_konser: true,
  //             tiket_konser_detail: true,
  //           },
  //         },
  //         affiliator: true,
  //       },
  //     });

  //     // Ambil semua order_id
  //     const orderIds = allPemesanan.map((p) => p.kode_pemesanan);

  //     // Panggil cekStatus untuk masing-masing order_id
  //     const statusResults = await Promise.all(
  //       orderIds.map((order) => cekStatus({ order }))
  //     );

  //     // Filter hanya yang status settlement
  //     const filtered = allPemesanan.filter((p, index) => {
  //       return statusResults[index].data.transaction_status === "settlement";
  //     });

  //     const count = filtered.length;

  //     // Pagination manual
  //     const paginatedData = filtered.slice(skip, skip + perPage);

  //     const formatted = paginatedData.map((pesan) => ({
  //       ...pesan,
  //       detail_pemesanan: pesan.detail_pemesanan_megakonser.map((detail) => ({
  //         ...detail,
  //         tiket_konser_detail: detail.tiket_konser_detail,
  //       })),
  //     }));

  //     res.status(200).json({
  //       message: "Sukses Ambil Data",
  //       data: formatted,
  //       pagination: {
  //         total: count,
  //         page,
  //         hasNext: count > page * perPage,
  //         totalPage: Math.ceil(count / perPage),
  //       },
  //     });
  //   } catch (error) {
  //     console.error("Error getPemesananMegakonser:", error);
  //     res.status(500).json({
  //       message: error.message || "Internal Server Error",
  //     });
  //   }
  // },

  async getPemesananMegakonserLama(req, res) {
    try {
      const keyword = req.query.keyword || "";
      const kode_affiliator = req.query.kode_affiliator || "";
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const sortBy = req.query.sortBy || "transaction_time";
      const sortType = req.query.order || "desc";

      const filterParams = {
        OR: [
          { nama: { contains: keyword } },
          { telepon: { contains: keyword } },
          { email: { contains: keyword } },
          { kode_pemesanan: { contains: keyword } },
        ],
        ...(kode_affiliator && { kode_affiliator }),
        status: "settlement", // ✅ filter status langsung
        detail_pemesanan_megakonser: {
          none: {
            id_tiket: 8, // ✅ exclude jika ada yang pakai tiket id 8
          },
        },
      };

      const allPemesanan = await prisma.pemesanan_megakonser.findMany({
        where: filterParams,
        orderBy: {
          [sortBy]: sortType,
        },
        include: {
          detail_pemesanan_megakonser: {
            include: {
              tiket_konser: true,
              tiket_konser_detail: true,
            },
          },
          affiliator: true,
        },
      });

      const count = allPemesanan.length;
      const paginatedData = allPemesanan.slice(skip, skip + perPage);

      const formatted = paginatedData.map((pesan) => ({
        ...pesan,
        detail_pemesanan: pesan.detail_pemesanan_megakonser.map((detail) => ({
          ...detail,
          tiket_konser_detail: detail.tiket_konser_detail,
        })),
      }));

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: formatted,
        pagination: {
          total: count,
          page,
          hasNext: count > page * perPage,
          totalPage: Math.ceil(count / perPage),
        },
      });
    } catch (error) {
      console.error("Error getPemesananMegakonser:", error);
      res.status(500).json({
        message: error.message || "Internal Server Error",
      });
    }
  },

  async getPemesananMegakonser(req, res) {
    try {
      const keyword = req.query.keyword || "";
      const kode_affiliator = req.query.kode_affiliator || "";
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const sortBy = req.query.sortBy || "transaction_time";
      const sortType = req.query.order || "desc";

      const start = new Date(req.query.start);
      const end = new Date(req.query.end);

      const validStart = !isNaN(start.getTime()) ? start : new Date();
      const validEnd =
        !isNaN(end.getTime()) && end >= validStart ? end : new Date();

      validStart.setHours(0, 0, 0, 0);
      validEnd.setHours(23, 59, 59, 999);

      if (validStart > validEnd) {
        return res.status(400).json({ message: "Invalid Date Range" });
      }

      console.log("start", validStart);
      console.log("end", validEnd);

      const filterParams = {
        OR: [
          { nama: { contains: keyword } },
          { telepon: { contains: keyword } },
          { email: { contains: keyword } },
          { kode_pemesanan: { contains: keyword } },
        ],
        transaction_time: {
          gte: validStart,
          lte: validEnd,
        },

        ...(kode_affiliator && { kode_affiliator }),
      };

      const allPemesanan = await prisma.pemesanan_megakonser.findMany({
        where: filterParams,
        orderBy: {
          [sortBy]: sortType,
        },
        include: {
          detail_pemesanan_megakonser: {
            include: {
              tiket_konser: true,
              tiket_konser_detail: true,
            },
          },
          affiliator: true,
        },
      });

      // Filter hanya yang memiliki id_tiket = 8
      const withSpecificTiket = allPemesanan.filter((p) =>
        p.detail_pemesanan_megakonser.some((d) => d.id_tiket === 8)
      );

      const orderIds = withSpecificTiket.map((p) => p.kode_pemesanan);

      const statusResults = await Promise.all(
        orderIds.map((order) => cekStatus({ order }))
      );

      const filtered = withSpecificTiket.filter((p, index) => {
        const isSettlement =
          statusResults[index].data.transaction_status === "settlement";
        const isForceIncluded = p.id === 4787;
        return isSettlement || isForceIncluded;
      });

      const count = filtered.length;
      const paginatedData = filtered.slice(skip, skip + perPage);

      const formatted = paginatedData.map((pesan) => ({
        ...pesan,
        detail_pemesanan: pesan.detail_pemesanan_megakonser.map((detail) => ({
          ...detail,
          tiket_konser_detail: detail.tiket_konser_detail,
        })),
      }));

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: formatted,
        pagination: {
          total: count,
          page,
          hasNext: count > page * perPage,
          totalPage: Math.ceil(count / perPage),
        },
      });
    } catch (error) {
      console.error("Error getPemesananMegakonser:", error);
      res.status(500).json({
        message: error.message || "Internal Server Error",
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
      // Ambil semua data pemesanan yang statusnya "settlement"
      const allPemesanan = await prisma.pemesanan_megakonser.findMany({
        where: {
          status: "settlement",
        },
        include: {
          detail_pemesanan_megakonser: {
            include: {
              tiket_konser_detail: {
                include: {
                  tiket_konser: true,
                },
              },
            },
          },
        },
      });

      // Filter hanya yang memiliki id_tiket = 8
      const withSpecificTiket = allPemesanan.filter((p) =>
        p.detail_pemesanan_megakonser.some(
          (d) => d.tiket_konser_detail.tiket_konser.tiket_id === 8
        )
      );

      // Hitung total pendapatan hanya dari tiket id 8
      let totalPendapatan = 0;

      const pemesananDetail = [];

      withSpecificTiket.forEach((p) => {
        p.detail_pemesanan_megakonser.forEach((d) => {
          if (d.tiket_konser_detail.tiket_konser.tiket_id === 8) {
            pemesananDetail.push(d);
            totalPendapatan += d.tiket_konser_detail.tiket_konser.tiket_harga;
          }
        });
      });

      // Grouping berdasarkan tiket_konser_id dan tiket_konser_detail.id
      const groupedData = pemesananDetail.reduce((acc, item) => {
        const tiket = item.tiket_konser_detail.tiket_konser;
        const tiketKey = tiket.tiket_id;

        if (!acc[tiketKey]) {
          acc[tiketKey] = {
            tiket_id: tiket.tiket_id,
            tiket_nama: tiket.tiket_nama,
            tiket_harga: tiket.tiket_harga,
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
        totalPendapatan,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },
  async getPenjualanMegakonserLama(req, res) {
    try {
      // Ambil semua data pemesanan yang statusnya "settlement"
      const allPemesanan = await prisma.pemesanan_megakonser.findMany({
        where: {
          status: "settlement",
        },
        include: {
          detail_pemesanan_megakonser: {
            include: {
              tiket_konser_detail: {
                include: {
                  tiket_konser: true,
                },
              },
            },
          },
        },
      });

      // Filter hanya yang memiliki tiket_id selain 8
      const withOtherTiket = allPemesanan.filter((p) =>
        p.detail_pemesanan_megakonser.some(
          (d) => d.tiket_konser_detail.tiket_konser.tiket_id !== 8
        )
      );

      // Hitung total pendapatan dari tiket selain id 8
      let totalPendapatan = 0;

      const pemesananDetail = [];

      withOtherTiket.forEach((p) => {
        p.detail_pemesanan_megakonser.forEach((d) => {
          if (d.tiket_konser_detail.tiket_konser.tiket_id !== 8) {
            pemesananDetail.push(d);
            totalPendapatan += d.tiket_konser_detail.tiket_konser.tiket_harga;
          }
        });
      });

      // Grouping berdasarkan tiket_konser_id dan tiket_konser_detail.id
      const groupedData = pemesananDetail.reduce((acc, item) => {
        const tiket = item.tiket_konser_detail.tiket_konser;
        const tiketKey = tiket.tiket_id;

        if (!acc[tiketKey]) {
          acc[tiketKey] = {
            tiket_id: tiket.tiket_id,
            tiket_nama: tiket.tiket_nama,
            tiket_harga: tiket.tiket_harga,
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
        totalPendapatan,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async testSendFonnte(req, res) {
    try {
      const wa_number = req.query.wa || "6281234567890"; // default nomor WA jika tidak dikirim
      const text = "Ini adalah pesan test dari API Fonnte ✅";

      const payload = {
        target: "082235400787",
        message: "halo testing",
      };

      const headers = {
        Authorization: "V41xrmX2cTcfMWZ49FbS", // Ganti dengan API Key asli kamu atau pakai env
        "Content-Type": "application/json",
      };

      const response = await axios.post(
        "https://api.fonnte.com/send",
        payload,
        {
          headers,
        }
      );

      res.status(200).json({
        success: true,
        message: "Berhasil mengirim pesan WA test via Fonnte",
        data: response.data,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Gagal mengirim pesan via Fonnte",
        error: error?.response?.data || error.message,
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

  async getReportQutab(req, res) {
    try {
      const keyword = req.query.keyword || "";
      const lokasi = req.query.lokasi || "";
      const kode_affiliator = req.query.kode_affiliator || "";
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const sortBy = req.query.sortBy || "id"; // default
      const sortType = req.query.order || "desc";

      // Base filter untuk activity_qurban
      const baseWhere = {
        program_id: 98,
        log_aj: {
          status_transaction: "Success",
        },
        ...(lokasi && {
          lokasi_qurban: {
            lokasi_penyembelihan: {
              contains: lokasi,
              mode: "insensitive",
            },
          },
        }),
        ...(keyword && {
          detail_qurban: {
            some: {
              nama: {
                contains: keyword,
                mode: "insensitive",
              },
            },
          },
        }),
      };

      const [count, qurbanList] = await prisma.$transaction([
        prisma.activity_qurban.count({
          where: baseWhere,
        }),
        prisma.activity_qurban.findMany({
          where: baseWhere,
          include: {
            lokasi_qurban: true,
            program: {
              select: {
                program_id: true,
                program_title: true,
              },
            },
            log_aj: true,
            detail_qurban: {
              include: {
                activity_paket: true,
              },
            },
          },
          skip,
          take: perPage,
          orderBy: {
            id: sortType, // <- hanya berdasarkan id
          },
        }),
      ]);

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: {
          tabel: qurbanList,
        },
        pagination: {
          total: count,
          page,
          hasNext: count > page * perPage,
          totalPage: Math.ceil(count / perPage),
        },
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getReportQuray(req, res) {
    try {
      const keyword = req.query.keyword || "";
      const status = req.query.status || "";
      const kode_affiliator = req.query.kode_affiliator || "";
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const sortBy = req.query.sortBy || "transaction_time";
      const sortType = req.query.order || "desc";

      // const params = {
      //   OR: [
      //     {
      //       nama: {
      //         contains: keyword,
      //       },
      //     },
      //     {
      //       telepon: {
      //         contains: keyword,
      //       },
      //     },
      //     {
      //       email: {
      //         contains: keyword,
      //       },
      //     },
      //     {
      //       kode_pemesanan: {
      //         contains: keyword,
      //       },
      //     },
      //   ],
      //   ...(status && { status }),
      //   ...(kode_affiliator && { kode_affiliator }),
      // };

      const [count, quray] = await prisma.$transaction([
        prisma.detail_qurban.count({
          where: {
            activity_qurban: {
              program_id: 97,
              log_aj: {
                status_transaction: "Success",
              },
            },
          },
        }),
        prisma.detail_qurban.findMany({
          where: {
            activity_qurban: {
              program_id: 97,
              log_aj: {
                status_transaction: "Success",
              },
            },
          },
          include: {
            activity_paket: true,
            activity_qurban: {
              include: {
                program: {
                  select: {
                    program_id: true,
                    program_title: true,
                  },
                },
                lokasi_qurban: true,
                log_aj: true,
              },
            },
          },
          skip,
          take: perPage,
        }),
      ]);

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: {
          tabel: quray,
        },
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
  async getPenjualanQutab(req, res) {
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

      const filterCondition = {
        // created_date: {
        //   gte: validStart,
        //   lte: validEnd,
        // },
        activity_qurban: {
          program_id: 98,
          log_aj: {
            status_transaction: "Success",
          },
        },
      };

      // ✅ Ambil semua data dan jumlahkan total manual
      const detailList = await prisma.detail_qurban.findMany({
        where: {
          OR: [
            {
              qurban_id: { in: [275, 276] },
            },
            {
              activity_qurban: {
                program_id: 98,
                log_aj: {
                  status_transaction: "Success",
                },
              },
            },
          ],
        },
        select: {
          total: true,
        },
      });

      const totalPendapatan = detailList.reduce((sum, item) => {
        const cleaned = (item.total || "").replace(/[^0-9]/g, "");
        const parsed = parseInt(cleaned);
        return sum + (isNaN(parsed) ? 0 : parsed);
      }, 0);

      // ✅ Ambil semua data pemesanan paket
      const pemesanan = await prisma.detail_qurban.findMany({
        where: filterCondition,
        select: {
          activity_paket: {
            select: {
              id: true,
              kategori: true,
              biaya: true,
            },
          },
          activity_qurban: {
            select: {
              program: {
                select: {
                  program_id: true,
                  program_title: true,
                },
              },
              lokasi_qurban: true,
              log_aj: true,
            },
          },
        },
      });

      const groupedData = pemesanan.reduce((acc, item) => {
        const paket = item.activity_paket;
        const paketKey = paket.id;

        if (!acc[paketKey]) {
          acc[paketKey] = {
            paket_id: paket.id,
            paket_nama: paket.kategori,
            paket_harga: paket.biaya,
            total_pembelian: 0,
          };
        }

        acc[paketKey].total_pembelian += 1;

        return acc;
      }, {});

      const penjualan = Object.values(groupedData);

      res.status(200).json({
        message: "Sukses Ambil Data",
        dataPenjualan: penjualan,
        totalPendapatan,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },
  async getAffiliatorQurban(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.sortType || "asc";

      const params = {
        nama: {
          contains: keyword,
        },
      };

      const [count, affQurban] = await prisma.$transaction([
        prisma.affiliator_qurban.count({
          where: params,
        }),
        prisma.affiliator_qurban.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      res.status(200).json({
        message: "Sukses Ambil Data Affiliator Qurban",
        data: affQurban,
        pagination: {
          total: count,
          page,
          hasNext: count > page * perPage,
          totalPage: Math.ceil(count / perPage),
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },
  async createAffiliatorQurban(req, res) {
    try {
      const { nama, telepon, kode_affiliator } = req.body;

      if (!kode_affiliator || kode_affiliator.trim() === "") {
        return res.status(400).json({
          message: "Kode affiliator harus diisi",
        });
      }

      const existingAff = await prisma.affiliator_qurban.findFirst({
        where: { kode_affiliator: kode_affiliator.trim() },
      });

      if (existingAff) {
        return res.status(409).json({
          message: "Kode affiliator sudah terdaftar",
        });
      }

      const afQurban = await prisma.affiliator_qurban.create({
        data: {
          nama: nama?.trim() || null,
          no_hp: telepon?.trim() || null,
          kode_affiliator: kode_affiliator.trim(),
        },
      });

      res.status(201).json({
        message: "Affiliator qurban berhasil ditambahkan",
        data: afQurban,
      });
    } catch (error) {
      res.status(500).json({
        message: error.message || "Terjadi kesalahan pada server",
      });
    }
  },
  async updateAffiliatorQurban(req, res) {
    try {
      const { id } = req.params; // Ambil ID dari parameter URL
      const { nama, telepon, kode_affiliator } = req.body; // Ambil data dari request body

      // Cek apakah lokasi dengan ID tersebut ada
      const existingLokasi = await prisma.affiliator_qurban.findUnique({
        where: { id: Number(id) },
      });

      if (!existingLokasi) {
        return res.status(404).json({
          message: "Affiliator qurban tidak ditemukan",
        });
      }

      // Update data lokasi qurban
      const updatedLokasi = await prisma.affiliator_qurban.update({
        where: { id: Number(id) },
        data: {
          nama,
          no_hp: telepon,
          kode_affiliator,
        },
      });

      res.status(200).json({
        message: "Affiliator qurban berhasil diperbarui",
        data: updatedLokasi,
      });
    } catch (error) {
      res.status(500).json({
        message: "Terjadi kesalahan saat memperbarui affiliator qurban",
        error: error.message,
      });
    }
  },
  async getAffiliatorKonser(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.sortType || "asc";

      const params = {
        nama: {
          contains: keyword,
        },
      };

      const [count, affiliator] = await prisma.$transaction([
        prisma.affiliator.count({
          where: params,
        }),
        prisma.affiliator.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      res.status(200).json({
        message: "Sukses Ambil Data Affiliator Konser",
        data: affiliator,
        pagination: {
          total: count,
          page,
          hasNext: count > page * perPage,
          totalPage: Math.ceil(count / perPage),
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async createAffiliatorKonser(req, res) {
    try {
      const { nama, kode, pic } = req.body;

      if (!kode || kode.trim() === "") {
        return res.status(400).json({
          message: "Kode affiliator harus diisi",
        });
      }

      const existingAff = await prisma.affiliator.findFirst({
        where: { kode: kode.trim() },
      });

      if (existingAff) {
        return res.status(409).json({
          message: "Kode affiliator sudah terdaftar",
        });
      }

      const afQurban = await prisma.affiliator.create({
        data: {
          nama: nama?.trim() || null,
          kode: kode?.trim() || null,
          pic: pic.trim(),
          status: 1,
        },
      });

      res.status(201).json({
        message: "Affiliator konser berhasil ditambahkan",
        data: afQurban,
      });
    } catch (error) {
      res.status(500).json({
        message: error.message || "Terjadi kesalahan pada server",
      });
    }
  },
  async updateAffiliatorKonser(req, res) {
    try {
      const { id } = req.params; // Ambil ID dari parameter URL
      const { nama, kode, pic } = req.body; // Ambil data dari request body

      // Cek apakah lokasi dengan ID tersebut ada
      const existingLokasi = await prisma.affiliator.findUnique({
        where: { id: Number(id) },
      });

      if (!existingLokasi) {
        return res.status(404).json({
          message: "Affiliator konser tidak ditemukan",
        });
      }

      // Update data lokasi qurban
      const updatedLokasi = await prisma.affiliator.update({
        where: { id: Number(id) },
        data: {
          nama,
          kode: kode,
          pic,
        },
      });

      res.status(200).json({
        message: "Affiliator konser berhasil diperbarui",
        data: updatedLokasi,
      });
    } catch (error) {
      res.status(500).json({
        message: "Terjadi kesalahan saat memperbarui affiliator konser",
        error: error.message,
      });
    }
  },
  async getAffiliatorVrfp(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.sortType || "asc";

      const params = {
        nama: {
          contains: keyword,
        },
      };

      const [count, affiliator] = await prisma.$transaction([
        prisma.affiliator_vrfp.count({
          where: params,
        }),
        prisma.affiliator_vrfp.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      res.status(200).json({
        message: "Sukses Ambil Data Affiliator VRFP",
        data: affiliator,
        pagination: {
          total: count,
          page,
          hasNext: count > page * perPage,
          totalPage: Math.ceil(count / perPage),
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },
  async createAffiliatorVrfpr(req, res) {
    try {
      const { nama, telepon, kode_affiliator } = req.body;

      if (!kode_affiliator || kode_affiliator.trim() === "") {
        return res.status(400).json({
          message: "Kode affiliator harus diisi",
        });
      }

      const existingAff = await prisma.affiliator_vrfp.findFirst({
        where: { kode_affiliator: kode_affiliator.trim() },
      });

      if (existingAff) {
        return res.status(409).json({
          message: "Kode affiliator sudah terdaftar",
        });
      }

      const afQurban = await prisma.affiliator_vrfp.create({
        data: {
          nama: nama?.trim() || null,
          no_hp: telepon?.trim() || null,
          kode_affiliator: kode_affiliator.trim(),
        },
      });

      res.status(201).json({
        message: "Affiliator VRFP berhasil ditambahkan",
        data: afQurban,
      });
    } catch (error) {
      res.status(500).json({
        message: error.message || "Terjadi kesalahan pada server",
      });
    }
  },
  async updateAffiliatorVRFP(req, res) {
    try {
      const { id } = req.params; // Ambil ID dari parameter URL
      const { nama, telepon, kode_affiliator } = req.body; // Ambil data dari request body

      // Cek apakah lokasi dengan ID tersebut ada
      const existingLokasi = await prisma.affiliator_vrfp.findUnique({
        where: { id: Number(id) },
      });

      if (!existingLokasi) {
        return res.status(404).json({
          message: "Affiliator VRFP tidak ditemukan",
        });
      }

      // Update data lokasi qurban
      const updatedLokasi = await prisma.affiliator_vrfp.update({
        where: { id: Number(id) },
        data: {
          nama,
          no_hp: telepon,
          kode_affiliator,
        },
      });

      res.status(200).json({
        message: "Affiliator VRFP berhasil diperbarui",
        data: updatedLokasi,
      });
    } catch (error) {
      res.status(500).json({
        message: "Terjadi kesalahan saat memperbarui affiliator VRFP",
        error: error.message,
      });
    }
  },
  async getAllProposalErp(req, res) {
    try {
      // Ambil semua proposal yang berelasi dengan mustahiq yang province-nya 11
      const proposals = await prisma.proposal.findMany({
        where: {
          user: {
            mustahiq: {
              province: "11", // Ganti dengan "11" atau angka sesuai format datanya
            },
          },
        },
        select: {
          id: true,
          nama: true,
          alamat_rumah: true,
          dana_yang_diajukan: true,
          status_approval: true,
          create_date: true,
          user: {
            select: {
              user_id: true,
              mustahiq: {
                select: {
                  province: true,
                  kota: true,
                  kecamatan: true,
                  address: true,
                },
              },
            },
          },
        },
      });

      if (proposals.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Tidak ada proposal ditemukan untuk province = 11",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data proposal berhasil diambil",
        data: proposals,
      });
    } catch (error) {
      console.error("Gagal mengambil data proposal:", error);
      return res.status(500).json({
        success: false,
        message: "Terjadi kesalahan saat mengambil data proposal",
        error: error.message,
      });
    }
  },
};
