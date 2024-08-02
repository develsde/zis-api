const { prisma } = require("../../prisma/client");
const fs = require("fs");
const { connect } = require("http2");
const moment = require("moment")
const { sendWhatsapp } = require("../helper/whatsapp");

module.exports = {

  async create(req, res) {
    try {
      const userId = req.user_id;

      const {
        mitra_nama,
        mitra_phone,
        mitra_email,
        mitra_nama_pendiri,
        mitra_nik,
        mitra_npwp,
        mitra_siup_no,
        mitra_siup_date,
        mitra_alamat,
        mitra_prov_id,
        mitra_city_id,
        mitra_kodepos,
        mitra_badan_usaha_category,
        mitra_reg_program_id
      } = req.body;

      //console.log(JSON.stringify(req.body))   

      const program = await prisma.program.findUnique({
        where: {
          program_id: Number(mitra_reg_program_id),
        },
        select: {
          program_title: true,
        },
      });

      const mitraResult = await prisma.mitra.create({
        data: {
          user: {
            connect: {
              user_id: Number(userId),
            },
          },
          mitra_nama,
          mitra_phone,
          mitra_email,
          program: {
            connect: {
              program_id: Number(mitra_reg_program_id)
            }
          },
          mitra_nama_pendiri,
          mitra_nik,
          mitra_npwp,
          mitra_siup_no,
          mitra_siup_date: moment().toISOString(mitra_siup_date),
          mitra_alamat,
          mitra_kodepos,
          mitra_badan_usaha_category: Number(mitra_badan_usaha_category),
          provinces: {
            connect: {
              prov_id: Number(mitra_prov_id),
            }
          },
          cities: {
            connect: {
              city_id: Number(mitra_city_id),
            }
          }
        },
      });

      const program_title = program ? program.program_title : 'Program tidak terdaftar';

      if (mitraResult) {

        let pn = mitra_phone
        pn = pn.replace(/\D/g, '');
        if (pn.substring(0, 1) == '0') {
          pn = "0" + pn.substring(1).trim()
        } else if (pn.substring(0, 3) == '62') {
          pn = "0" + pn.substring(3).trim()
        }

        const msgId = await sendWhatsapp({
          wa_number: pn.replace(/[^0-9\.]+/g, ""),
          text: "Proposal atas nama lembaga " + mitra_nama + " pada program " + program_title + " telah kami terima. Mohon cek secara berkala untuk mengetahui status pengajuan proposal yang telah diajukan. Lakukan konfirmasi kepada kami apabila terjadi duplikasi maupun kesalahan pada proposal. Terima kasih 🙏🏻",
        });
      }

      return res.status(200).json({
        message: "Sukses",
        data: mitraResult,
      });
    } catch (error) {

      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async createErp(req, res) {
    try {
      const userId = req.user_id;

      const {
        mitra_nama,
        mitra_phone,
        mitra_email,
        mitra_nama_pendiri,
        // mitra_nik,
        mitra_npwp,
        // mitra_siup_no,
        // mitra_siup_date,
        mitra_alamat,
        // mitra_prov_id,
        // mitra_city_id,
        // mitra_kodepos,
        mitra_badan_usaha_category,
        mitra_no_kontrak,
        mitra_reg_program_id,
        mitra_bank,
        mitra_no_rekening,
        mitra_nama_rekening
      } = req.body;

      //console.log(JSON.stringify(req.body))      

      const program = await prisma.program.findUnique({
        where: {
          program_id: Number(mitra_reg_program_id),
        },
        select: {
          program_title: true,
        },
      });

      const mitraResult = await prisma.mitra.create({
        data: {
          status_request_penarikan: 1,
          // user: {
          //   connect: {
          //     user_id: Number(userId),
          //   },
          // },
          mitra_nama,
          mitra_phone,
          mitra_email,
          program: {
            connect: {
              program_id: Number(mitra_reg_program_id)
            }
          },
          mitra_nama_pendiri,
          // mitra_nik,
          mitra_npwp,
          // mitra_siup_no,
          // mitra_siup_date: moment().toISOString(mitra_siup_date),
          mitra_alamat,
          // mitra_kodepos,
          mitra_badan_usaha_category: Number(mitra_badan_usaha_category),
          mitra_no_kontrak,
          // provinces: {
          //   connect: {
          //     prov_id: Number(mitra_prov_id),
          //   }
          // },
          // cities: {
          //   connect: {
          //     city_id: Number(mitra_city_id),
          //   }
          // }
          mitra_bank,
          mitra_no_rekening,
          mitra_nama_rekening,
        },
      });

      const program_title = program ? program.program_title : 'Program tidak terdaftar';

      if (mitraResult) {

        let pn = mitra_phone
        pn = pn.replace(/\D/g, '');
        if (pn.substring(0, 1) == '0') {
          pn = "0" + pn.substring(1).trim()
        } else if (pn.substring(0, 3) == '62') {
          pn = "0" + pn.substring(3).trim()
        }

        const msgId = await sendWhatsapp({
          wa_number: pn.replace(/[^0-9\.]+/g, ""),
          text: "Proposal atas nama lembaga " + mitra_nama + " dengan Nomor Kontrak: " + mitra_no_kontrak + " pada program " + program_title + " telah kami terima. Mohon cek secara berkala untuk mengetahui status pengajuan proposal yang telah diajukan. Lakukan konfirmasi kepada kami apabila terjadi duplikasi maupun kesalahan pada proposal. Terima kasih 🙏🏻",
        });
      }

      return res.status(200).json({
        message: "Sukses",
        data: mitraResult,
      });
    } catch (error) {

      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async createMitraReg(req, res) {
    try {


      const file = req.file;

      if (!file) {
        return res.status(400).json({
          message: "Proposal harus diupload",
        });
      }

      const maxSize = 5000000;
      if (file.size > maxSize) {
        await fs.unlink(file.path);

        return res.status(400).json({
          message: "Ukuran Proposal Terlalu Besar",
        });
      }


      const {
        mitra_id,
        mitra_reg_wakaf_category,
        mitra_reg_referentor,
        mitra_reg_nama_wakaf,
        mitra_reg_alamat_wakaf,
        mitra_reg_deskripsi_wakaf,
        mitra_reg_nominal,
        mitra_reg_durasi_value,
        mitra_reg_program_id,
        mitra_reg_durasi_satuan,
        mitra_reg_date_start,
        mitra_reg_date_end
      } = req.body;

      //console.log(JSON.stringify(req.body))      

      const regResult = await prisma.mitra_register.create({
        data: {
          mitra: {
            connect: {
              id: Number(mitra_id),
            }
          },
          mitra_reg_wakaf_category: Number(mitra_reg_wakaf_category),
          referentor: {
            connect: {
              id: Number(mitra_reg_referentor)
            }
          },
          program: {
            connect: {
              program_id: Number(mitra_reg_program_id)
            }
          },
          mitra_reg_nama_wakaf,
          mitra_reg_alamat_wakaf,
          mitra_reg_deskripsi_wakaf,
          mitra_reg_date_start: moment(mitra_reg_date_start).toISOString(),
          mitra_reg_date_end: moment(mitra_reg_date_end).toISOString(),
          mitra_reg_nominal: Number(mitra_reg_nominal),
          mitra_reg_durasi_value: Number(mitra_reg_durasi_value),
          mitra_reg_durasi_satuan: Number(mitra_reg_durasi_satuan),
          mitra_reg_file: `uploads/${file.filename}`
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: regResult,
      });
    } catch (error) {

      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async createMitraRegErp(req, res) {
    try {


      const file = req.file;

      if (!file) {
        return res.status(400).json({
          message: "Proposal harus diupload",
        });
      }

      const maxSize = 5000000;
      if (file.size > maxSize) {
        await fs.unlink(file.path);

        return res.status(400).json({
          message: "Ukuran Proposal Terlalu Besar",
        });
      }


      const {
        mitra_id,
        mitra_reg_nominal,
        mitra_reg_referentor,
        mitra_reg_program_id,
        mitra_reg_date_start,
        mitra_reg_date_end
      } = req.body;

      //console.log(JSON.stringify(req.body))      

      const regResult = await prisma.mitra_register.create({
        data: {
          mitra: {
            connect: {
              id: Number(mitra_id),
            }
          },
          // mitra_reg_wakaf_category: Number(mitra_reg_wakaf_category),
          referentor: {
            connect: {
              id: Number(mitra_reg_referentor)
            }
          },
          program: {
            connect: {
              program_id: Number(mitra_reg_program_id)
            }
          },
          mitra_reg_nominal: Number(mitra_reg_nominal),
          mitra_reg_date_start: moment(mitra_reg_date_start).toISOString(),
          mitra_reg_date_end: moment(mitra_reg_date_end).toISOString(),
          mitra_reg_file: `uploads/${file.filename}`
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: regResult,
      });
    } catch (error) {

      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },


  async getWaqifById(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 1);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";
      const id = req.params.id
      const params = { user_id: Number(id) };

      const [count, detailwaqif] = await prisma.$transaction([
        prisma.waqif.count({
          where: params,
        }),
        prisma.waqif.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          include: {
            user: true,
            provinces: true,
            cities: true
          },
          skip,
          // take: perPage,
        }),
      ]);

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data Detail Waqif",

        data: detailwaqif,
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

  async getMitraById(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 1);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";
      const id = req.params.id
      const params = { mitra_user_id: Number(id) };

      const [count, detailmitra] = await prisma.$transaction([
        prisma.mitra.count({
          where: params,
        }),
        prisma.mitra.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          include: {
            user: true,
            provinces: true,
            cities: true,
            mitra_register: {
              include: {
                program: {
                  select: {
                    program_title: true,
                    program_banner: true,
                    kategori_penyaluran: true
                  },
                }
              }
            },
            mitra_penarikan_dana: true,
          },
          skip,
          // take: perPage,
        }),
      ]);

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data Detail Waqif",

        data: detailmitra,
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

  async penarikanMitra(req, res) {
    try {
      const {
        status_request_penarikan,
        mitra_bank,
        mitra_no_rekening,
        mitra_nama_rekening
      } = req.body;

      const id = req.params.id

      //console.log(JSON.stringify(req.body))      

      const mitraResult = await prisma.mitra.update({
        where: {
          id: Number(id)
        },
        data: {
          status_request_penarikan,
          mitra_bank,
          mitra_no_rekening,
          mitra_nama_rekening
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: mitraResult,
      });
    } catch (error) {

      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async createWakafTransactions(req, res) {
    try {
      const userId = req.user_id;

      const {
        waqif_reg_id,
        waqif_trans_nominal,
        waqif_trans_status,
        waqif_trans_va_tujuan,
        waqif_trans_bank
      } = req.body;

      console.log(JSON.stringify(req.body))

      const transResult = await prisma.waqif_transaction.create({
        data: {
          waqif_register: {
            connect: {
              id: Number(waqif_reg_id),
            },
          },
          waqif_trans_nominal,
          waqif_trans_status,
          waqif_trans_va_tujuan,
          waqif_trans_bank
        },
      });

      return res.status(200).json({
        message: "Sukses Transaksi",
        data: transResult,
      });
    } catch (error) {

      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async getAllDataWakaf(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 1);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";
      const id = req.params.id
      const userId = req.user_id;
      const params = { waqif: { user_id: Number(userId) } };
      //const params = "";

      const [count, detailwaqif] = await prisma.$transaction([
        prisma.waqif_register.count({
          where: params,
        }),
        prisma.waqif_register.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          include: {
            waqif: {
              include: {
                user: true
              }
            },
            waqif_transaction: true
          },
          skip,
          // take: perPage,
        }),
      ]);

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data List Wakaf",

        data: detailwaqif,
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

  async detailWaqif(req, res) {
    try {
      const id = req.params.id;

      const waqifData = await prisma.waqif.findUnique({
        where: {
          id: Number(id),
        },
        include: {
          waqif_register: {
            include: {
              waqif_transaction: true
            }
          },
        },
      });

      if (!waqifData) {
        return res.status(404).json({
          message: "Wa tidak ditemukan",
        });
      }

      //const omit = require("lodash/omit");

      //const cleanUser = omit(user, ["user_password", "user_token"]);

      return res.status(200).json({
        message: "Sukses",
        data: waqifData,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async tarikdana(req, res) {
    try {
      const userId = req.user_id;
      const mitra_id = req.body.mitra_id;
      const nominal_final = req.body.nominal_final;
      const amount = req.body.amount;
      const reminderType = req.body.reminder_type;
      const recurringType = req.body.recurring_type;

      if (!programId) {
        return res.status(400).json({
          message: "Program tidak boleh kosong",
        });
      }

      if (!amount) {
        return res.status(400).json({
          message: "Jumlah donasi tidak boleh kosong",
        });
      }

      const program = await prisma.program.findUnique({
        where: {
          program_id: Number(programId),
        },
      });

      if (!program) {
        return res.status(400).json({
          message: "Program tidak ditemukan",
        });
      }

      const trx = await prisma.recurring_transaction.create({
        data: {
          amount: Number(amount),
          payment_method,
          reminder_type: Number(reminderType),
          recurring_type: Number(recurringType),
          user: {
            connect: {
              user_id: Number(userId),
            },
          },
          program: {
            connect: {
              program_id: Number(programId),
            },
          },
        },
      });

      await prisma.notification.create({
        data: {
          user: {
            connect: {
              user_id: Number(userId),
            },
          },
          description: "Anda Mengaktifkan Reminder Dan Recurring",
          title: "Konfirmasi Reminder dan Recurring",
          type: "transaction",
          transaction: {
            connect: {
              id: trx.id,
            },
          },
        },
      });

      res.status(200).json({
        message: "Sukses recurring",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  //Start Here For ERP
  async getAllProcessMitraProposal(req, res) {
    try {
      const userId = Number(req.user.user_id || 0)
      const userType = Number(req.user.user_type || 0)
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 0);
      const skip = (page - 1) * perPage;
      const keyword = req.query.nama || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "created_date";
      const sortType = req.query.order || "desc";
      let arrId = []


      cekdata = await prisma.$queryRaw`select pa.mitra_id as id from mitra_approval pa JOIN user u on pa.user_id = u.user_id where u.user_type in (14) and pa.mitra_id is not NULL GROUP BY pa.mitra_id`

      //const cekdata = await prisma.$queryRaw`select pa.proposal_id as id from proposal_approval pa JOIN user u on pa.user_id = u.user_id where u.user_type in (14) and pa.proposal_id is not NULL GROUP BY pa.proposal_id` 

      cekdata.map(item => {
        arrId.push(item.id)
      })

      //console.log("LOG TYPESSXX", JSON.stringify(arrId));


      const params = {
        AND: [{
          mitra_nama: { contains: keyword },
          approved: 0,
          status_bayar: 0,
          id: { notIn: arrId }
        }]
      };

      const [count, proposals] = await prisma.$transaction([
        prisma.mitra.count({
          where: params,
        }),
        prisma.mitra.findMany({
          include: {
            user: {
              select: {
                //mustahiq: true,
                user_id: true,
                user_nama: true,
                username: true,
                user_phone: true,
              },
            },
            cities: true,
            provinces: true,
            //program:true,
            // program: {
            //   select: {
            //     pogram_target_amount: false,
            //     kategori_penyaluran: true
            //   },
            //   // include: {

            //   // }
            // },
            mitra_register: {
              include: {
                // mitra_reg_nominal: true,
                // mitra_reg_nama_wakaf: true,
                // mitra_reg_file: true,
                referentor: true,
                program: {
                  select: {
                    pogram_target_amount: false,
                    kategori_penyaluran: false,
                    program_title: true
                  }
                }
              }
            },
            mitra_approval: {
              include: {
                user: {
                  select: {
                    user_id: true,
                    user_nama: true,
                    username: true,
                    user_phone: true,
                    user_type: true
                  },
                },
              },
            },
          },
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      // item.program_target_amount = undefined
      const propResult = await Promise.all(
        proposals.map(async (item) => {
          //item.program_target_amount = undefined
          return {
            ...item,
            //pogram_target_amount: Number(item.program_target_amount),            
            //total_donation: total_donation._sum.amount || 0,
          };
        })
      );

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data Mitra",

        data: propResult,
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

  async getAllProcessMitraProposalRecap(req, res) {
    try {
      const userId = Number(req.user.user_id || 0)
      const userType = Number(req.user.user_type || 0)
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 0);
      const skip = (page - 1) * perPage;
      const keyword = req.query.nama || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "created_date";
      const sortType = req.query.order || "desc";
      let arrId = []


      //cekdata = await prisma.$queryRaw`select pa.mitra_id as id from mitra_approval pa JOIN user u on pa.user_id = u.user_id where u.user_type in (14) and pa.mitra_id is not NULL GROUP BY pa.mitra_id`
      cekdata = await prisma.$queryRaw`SELECT pa.mitra_id AS id FROM mitra_approval pa JOIN user u ON pa.user_id = u.user_id AND pa.mitra_id IS NOT NULL`
      //const cekdata = await prisma.$queryRaw`select pa.proposal_id as id from proposal_approval pa JOIN user u on pa.user_id = u.user_id where u.user_type in (14) and pa.proposal_id is not NULL GROUP BY pa.proposal_id` 

      cekdata.map(item => {
        arrId.push(item.id)
      })

      //console.log("LOG TYPESSXX", JSON.stringify(arrId));


      const params = {
        AND: [{
          mitra_nama: { contains: keyword },
          approved: 0,
          status_bayar: 0,
          // id: { in: arrId }
        }]
      };

      const [count, proposals] = await prisma.$transaction([
        prisma.mitra.count({
          where: params,
        }),
        prisma.mitra.findMany({
          include: {
            user: {
              select: {
                //mustahiq: true,
                user_id: true,
                user_nama: true,
                username: true,
                user_phone: true,
              },
            },
            cities: true,
            provinces: true,
            //program:true,
            // program: {
            //   select: {
            //     pogram_target_amount: false,
            //     kategori_penyaluran: true
            //   },
            //   // include: {

            //   // }
            // },
            mitra_register: {
              include: {
                // mitra_reg_nominal: true,
                // mitra_reg_nama_wakaf: true,
                // mitra_reg_file: true,
                //mitra_reg_date_start: true,
                //mitra_reg_date_end: true,
                referentor: true,
                program: {
                  select: {
                    pogram_target_amount: false,
                    kategori_penyaluran: false,
                    program_title: true
                  }
                }
              }
            },
            mitra_approval: {
              include: {
                user: {
                  select: {
                    user_id: true,
                    user_nama: true,
                    username: true,
                    user_phone: true,
                    user_type: true
                  },
                },
              },
            },
          },
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      // item.program_target_amount = undefined
      const propResult = await Promise.all(
        proposals.map(async (item) => {
          //item.program_target_amount = undefined
          return {
            ...item,
            //pogram_target_amount: Number(item.program_target_amount),            
            //total_donation: total_donation._sum.amount || 0,
          };
        })
      );

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data Mitra",

        data: propResult,
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

  async approvalProposal(req, res) {
    try {
      const userId = req.user_id;

      const { mitra_id, status, amount } = req.body;

      //console.log(JSON.stringify(req.body))

      const appResult = await prisma.mitra_approval.create({
        data: {
          mitra: {
            connect: {
              id: Number(mitra_id),
            },
          },
          user: {
            connect: {
              user_id: Number(userId),
            },
          },
          status,
          amount: Number(amount),
        },
      });

      if (status == 2) {
        const updateStatusAll = await prisma.mitra.update({
          where: {
            id: Number(mitra_id),
          },
          data: {
            approved: 2
          },
        })
      }

      return res.status(200).json({
        message: "Approved",
        data: appResult,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error: Gagal Approved",
        error: error.message,
      });
    }
  },

  async getAllApproverMitraProposal(req, res) {
    try {
      const userId = Number(req.user.user_id || 0)
      const userType = Number(req.user.user_type || 0)
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 0);
      const skip = (page - 1) * perPage;
      const keyword = req.query.nama || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "created_date";
      const sortType = req.query.order || "desc";
      let arrId = []

      //const cekdata = await prisma.$queryRaw`select pa.proposal_id as id from proposal_approval pa where (select count(b.id) from proposal_approval b where pa.proposal_id = b.proposal_id) < 5 and pa.user_id in (${userId}) GROUP BY pa.proposal_id`
      const cekdata = await prisma.$queryRaw`select p.id as id, count(pa.id) as jumlah FROM mitra p
      JOIN  mitra_approval pa ON pa.mitra_id = p.id 
      JOIN user u ON pa.user_id = u.user_id 
      WHERE (u.user_type = 14) 
      GROUP by pa.id HAVING COUNT(p.id) < 4`

      //const cekdata = await prisma.$queryRaw`select p.proposal_id as id, p.user_id  from proposal_approval p where p.proposal_id is not null having p.user_id != ${userId} order by p.proposal_id`

      //console.log("WABARR", JSON.stringify(cekdata));
      cekdata.map(item => {
        arrId.push(item.id)
      })

      const params = {
        AND: [{
          mitra_nama: { contains: keyword },
          approved: 0,
          mitra_status: 1,
          status_bayar: 0,
          id: { in: arrId }
        }]
      };

      const [count, proposals] = await prisma.$transaction([
        prisma.mitra.count({
          where: params,
        }),
        prisma.mitra.findMany({
          include: {
            user: {
              select: {
                //mustahiq: true,
                user_id: true,
                user_nama: true,
                username: true,
                user_phone: true,
              },
            },
            cities: true,
            provinces: true,
            //program:true,
            // program: {
            //   select: {
            //     pogram_target_amount: false,
            //     kategori_penyaluran: true
            //   },
            //   // include: {

            //   // }
            // },
            mitra_register: {
              include: {
                // mitra_reg_nominal: true,
                // mitra_reg_nama_wakaf: true,
                // mitra_reg_file: true,
                //mitra_reg_date_start: true,
                //mitra_reg_date_end: true,
                referentor: true,
                program: {
                  select: {
                    pogram_target_amount: false,
                    kategori_penyaluran: false,
                    program_title: true
                  }
                }
              }
            },
            mitra_approval: {
              include: {
                user: {
                  select: {
                    user_id: true,
                    user_nama: true,
                    username: true,
                    user_phone: true,
                    user_type: true
                  },
                },
              },
            },
          },
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      // item.program_target_amount = undefined
      const propResult = await Promise.all(
        proposals.map(async (item) => {
          //item.program_target_amount = undefined
          return {
            ...item,
            //pogram_target_amount: Number(item.program_target_amount),            
            //total_donation: total_donation._sum.amount || 0,
          };
        })
      );

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data",

        data: propResult,
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


  async updateStatusMitra(req, res) {
    try {
      const id = req.params.id;
      const { mitra_status } = req.body;

      // if (!waqif_status) {
      //   return res.status(400).json({
      //     message: "Status Kosong ",
      //   });
      // }

      await prisma.mitra.update({
        where: {
          id: Number(id),
        },
        data: {
          mitra_status: Number(mitra_status)
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Update Data",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async updateApproved(req, res) {
    try {
      const id = req.params.id;
      const { approved, dana_approval, status_bayar, dana_final_disetujui, all_notes } = req.body;

      const existingMitra = await prisma.mitra.findUnique({
        where: {
          id: Number(id),
        },
        select: {
          all_notes: true,
        },
      });

      if (!existingMitra) {
        return res.status(404).json({
          message: "Proposal not found",
        });
      }

      let updatedNotes = ""
      if (existingMitra.all_notes === null) {
        updatedNotes = all_notes
      } else {
        updatedNotes = `${existingMitra.all_notes}; ${all_notes}`;
      }

      await prisma.mitra.update({
        where: {
          id: Number(id),
        },
        data: {
          approved: Number(approved),
          dana_approval: Number(dana_approval),
          dana_final_disetujui: Number(dana_final_disetujui),
          status_bayar: Number(status_bayar),
          all_notes: updatedNotes
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Update Data",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getMitraTarikDana(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";
      const params = {
        status_request_penarikan: 1,
        approved: 1,
        status_bayar: 0,
      };

      const [count, detailmitra] = await prisma.$transaction([
        prisma.mitra.count({
          where: params,
        }),
        prisma.mitra.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          include: {
            user: true,
            mitra_register: {
              include: {
                program: {
                  select: {
                    program_title: true,
                    program_banner: true,
                    kategori_penyaluran: true
                  },
                }
              }
            },
            // dana_final_disetujui: true,
            // mitra_bank: true,
            // mitra_no_rekening: true,
            // mitra_nama_rekening: true,
            // mitra_penarikan_dana: true,
          },
          skip,
        }),
      ]);

      res.status(200).json({
        message: "Sukses Ambil Data Detail Waqif",

        data: detailmitra,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

};
