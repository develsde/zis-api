const config = require('../../config/config.db');
//const mysql = require('mysql2');
const { password } = require('../../config/config.db');
//const pool = mysql.createPool(config);
const { prisma } = require("../../prisma/client");
const { generate, generateDelete, verify } = require("../helper/auth-jwt");
const mt940js = require('mt940js');
//const parser = require('swiftmessageparser');
const parser = new mt940js.Parser();
const fs = require('fs');
const { z } = require("zod");
const moment = require('moment')
const readXlsxFile = require('read-excel-file/node')

// pool.on('error',(err)=> {
//     console.error(err); 
// });

const gendate = () => {
  const now = new Date();
  const isoDate = now.toISOString();
  return isoDate
}

module.exports = {
  // Get All Mustahiq Information

  async getDataMt940(req, res) {

    const {
      id, filename
    } = req.body


    const statements = parser.parse(fs.readFileSync('uploads/' + filename, 'utf8'));

    let dataTrans = [];

    for (let s of statements) {
      //console.log(s.number.statement, s.statementDate, parseInt((s.accountIdentification).replace(/\s/g, '')), s.closingBalance);
      const [duplicate] = await prisma.$transaction([
        prisma.ebs_staging.findFirst({
          select: {
            id: true
          },
          where: {
            trans_date: new Date(moment(s.statementDate).format("YYYY-MM-DD")),
            ob_amount: { contains: (s.openingBalance).toString() }
          },
        })
      ])

      if (duplicate === null) {

        for (let t of s.transactions) {
          console.log(t.date, "DETAIL : ", t.amount, "Ref", t.details, "TYPE: ", t.transactionType, "FUNDSCODE: ", t.fundsCode);

          dataTrans.push({
            account_number: (s.accountIdentification).replace(/\s/g, ''),
            trans_ref: s.transactionReference,
            bank_date: new Date(moment(s.statementDate).format("YYYY-MM-DD")),
            state_num: s.number.statement,
            currency: s.currency,
            ob_amount: (s.openingBalance).toString(),
            ob_ind: Number(s.openingBalance) < 0 ? "D" : "C",
            eb_amount: (s.closingBalance).toString(),
            eb_ind: Number(s.closingBalance) < 0 ? "D" : "C",
            trans_date: new Date(moment(t.date).format("YYYY-MM-DD")),
            trans_type: t.transactionType,
            trans_amount: (t.amount).toString(),
            trans_id: Number(t.amount) < 0 ? "D" : "C",
            text_info: (t.details).toString(),
            ebs_filename: filename,
            mt_file_id: Number(id),
            //isduplicate: duplicate??0
          })

          //console.log(JSON.stringify(dataTrans))

        }

        await prisma.ebs_staging.createMany({
          data: dataTrans,
        });

        res.status(200).json({
          message: "Sukses Generate Data MT940",
        });

        // res.send({
        //   success: true,
        //   code: 200,
        //   data: dataTrans,
        //   gen: duplicate,
        //   message: "GET DATA SUCCESS",
        // });
      } else {
        res.status(500).json({
          message: "Ada Duplikasi File"
        });
      }
      // } catch (error) {
      //   return res.status(500).json({
      //     message: error?.message,
      //   });
      // }

      //}
    }

    // res.send({ 
    //     success: true,
    //     code: 200,  
    //     message: "GET DATA SUCCESS",
    // });

  },

  async getDataImkas(req, res) {
    try {

      const { id, filename } = req.body

      let dataTrans = [];
      const dataexcel = await readXlsxFile('uploads/' + filename).then((rows) => {

        rows.map((items, i) =>
          dataTrans.push({
            file_id: Number(id),
            nama: rows[i][1],
            no_imkas: (rows[i][2]).toString(),
            nominal: Number(rows[i][3]),
            rekening: String(rows[i][6]),
            nama_imkas: rows[i][7],
            keterangan: rows[i][4],
            saldo_awal: Number(rows[i][10]),
            saldo_akhir: Number(rows[i][11]),
            status: Number(rows[i][13])
          })
        )
        console.log("SEMUA DATA GAP", JSON.stringify(dataTrans));
        dataTrans.splice(0, 1)

        return dataTrans;

      })
      //console.log("SEMUA DATA GAPSss",JSON.stringify(dataexcel));    

      await prisma.imkas_payment_statement.createMany({
        data: dataexcel,
      });

      res.status(200).json({
        message: "Sukses Generate Data MT940",
      });

    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }

  },

  async parsemt940(req, res) {

    const statements = parser.parse({
      type: 'mt940',
      data: fs.readFileSync('uploads/mt940/MT940_Siswaf.txt', 'utf8'),
    });

    for (let s of statements) {
      console.log(s.forwardAvailableBalance);
    }

    res.send({
      success: true,
      code: 200,
      message: "GET DATA SUCCESS",
    });

  },

  async updateStatusMT(req, res) {
    try {
      const userId = req.user_id;
      const { idmt } = req.body;


      if (!idmt) {
        return res.status(400).json({
          message: "Jurnal ID Kosong",
        });
      }

      await prisma.ebs_staging.update({
        where: {
          id: Number(idmt),
        },
        data: {
          identified: 1,
          identified_user_id: userId,
          identified_date: gendate()
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Update Mt940",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async dataMt940(req, res) {
    const id = req.params.id
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 4);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";
      //const identified = Number(req.query.identified || 0);

      const params = {
        AND: [
          { mt_file_id: Number(id) },
          //{identified: Number(identified)},
          {
            text_info: {
              contains: keyword,
            },
          }
        ]
      };

      const [count, bank] = await prisma.$transaction([
        prisma.ebs_staging.count({
          where: params,
        }),
        prisma.ebs_staging.findMany({
          // select: {
          //   //id: true,
          //   //account_number: true,
          //   //trans_date: true,
          //   //bank_date: true,
          //   //trans_amount: true,
          //   //text_info: true
          // },        
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      const bankResult = await Promise.all(
        bank.map(async (item) => {


          return {
            ...item,
            //bank_date: moment(item.bank_date).format("DD-MM-YYYY")
            //program_target_amount: Number(item.program_target_amount),
            //total_donation: total_donation._sum.amount || 0,
          };
        })
      );

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data",

        data: bankResult,
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
  async dataImkasDetail(req, res) {
    const id = req.params.id
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 4);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";

      const params = {
        AND: [
          { file_id: Number(id) },
          {
            keterangan: {
              contains: keyword,
            },
          }
        ]
      };

      const [count, bank] = await prisma.$transaction([
        prisma.imkas_payment_statement.count({
          where: params,
        }),
        prisma.imkas_payment_statement.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          select: {
            id: true,
            create_date: true,
            file_id: true,
            nama: true,
            no_imkas: true,
            nominal: true,
            rekening: true,
            nama_imkas: true,
            keterangan: true,
            status: true
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      const bankResult = await Promise.all(
        bank.map(async (item) => {


          return {
            ...item,
            nominal: Number(item.nominal),
            //total_donation: total_donation._sum.amount || 0,
          };
        })
      );

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data",

        data: bankResult,
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

  async dataFileMt940(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 4);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";

      const params = {
        OR: [
          {
            bank_account: {
              bank_name: {
                contains: keyword
              }
            }
          },
          {
            filename: {
              contains: keyword
            }
          }
        ]
      };

      const [count, mt] = await prisma.$transaction([
        prisma.mt_file.count({
          where: params,
        }),
        prisma.mt_file.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          include: {
            bank_account: true,
            _count: {
              select: { ebs_staging: true }
            }
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      const mtResult = await Promise.all(
        mt.map(async (item) => {


          return {
            ...item
            //program_target_amount: Number(item.program_target_amount),
            //total_donation: total_donation._sum.amount || 0,
          };
        })
      );

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data",

        data: mtResult,
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

  async dataVerified(req, res) {
    const id = req.params.id
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 4);
      const identified = Number(req.query.identified || 1);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";

      const params = {
        AND: [
          { identified: Number(identified) },
          {
            text_info: {
              contains: keyword,
            },
          }
        ]
      };

      const [count, bank] = await prisma.$transaction([
        prisma.ebs_staging.count({
          where: params,
        }),
        prisma.ebs_staging.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      const bankResult = await Promise.all(
        bank.map(async (item) => {


          return {
            ...item
            //program_target_amount: Number(item.program_target_amount),
            //total_donation: total_donation._sum.amount || 0,
          };
        })
      );

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data",

        data: bankResult,
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

  async listbank(req, res) {
    try {
      //const userId = req.user_id;

      const bank = await prisma.bank_account.findMany({

      });

      if (!bank) {
        return res.status(404).json({
          message: "Bank tidak ditemukan",
        });
      }



      return res.status(200).json({
        message: "Sukses",
        data: bank,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },


  async listGla(req, res) {
    try {
      //const userId = req.user_id;

      const glacc = await prisma.gl_account.findMany({

      });

      if (!glacc) {
        return res.status(404).json({
          message: "Bank tidak ditemukan",
        });
      }



      return res.status(200).json({
        message: "Sukses",
        data: glacc,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async listProposal(req, res) {
    try {
      //const userId = req.user_id;

      const glacc = await prisma.program.findMany({
        include: {
          proposal: true
        }
      });

      if (!glacc) {
        return res.status(404).json({
          message: "Bank tidak ditemukan",
        });
      }



      return res.status(200).json({
        message: "Sukses",
        data: glacc,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },


  async statementCreate(req, res) {
    try {
      const file = req.file;

      const [duplicateFile] = await prisma.$transaction([
        prisma.mt_file.findFirst({
          select: {
            id: true
          },
          where: {
            filename: { contains: file.originalname }
          },
        })
      ])

      const userId = req.user_id;

      const schema = z.object({
        no_rekening: z.string({ required_error: "No Rekening Harus Diis" }).min(5),
        bank: z.number().optional()
      });

      if (!file) {
        return res.status(400).json({
          message: "File MT940 Tidak Boleh Kosong",
        });
      }

      if (duplicateFile !== null) {
        return res.status(400).json({
          message: "File MT940 Pernah Diupload Sebelumnya,",
        });
      }

      const maxSize = 5000000;
      if (file.size > maxSize) {
        await fs.unlink(file.path);

        return res.status(400).json({
          message: "Ukuran File terlalu Besar",
        });
      }

      // Array of allowed files
      const array_of_allowed_files = ['txt', 'xlsx', 'xls'];

      // Get the extension of the uploaded file
      const file_extension = file.originalname.slice(
        ((file.originalname.lastIndexOf('.') - 1) >>> 0) + 2
      );

      // Check if the uploaded file is allowed
      if (!array_of_allowed_files.includes(file_extension)) {
        return res.status(400).json({
          message: "File Tidak Sesuai Format",
        });
      }


      const {
        filename,
        path,
        bank,
        no_rekening
      } = req.body;

      //console.log(JSON.stringify(req.body))

      const glResult = await prisma.mt_file.create({
        data: {
          filename: `${file.filename}`,
          path: `uploads/${file.filename}`,
          bank: Number(bank),
          no_rekening,
          user_id: userId
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: glResult
      });
    } catch (error) {

      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async deleteMt940(req, res) {
    try {
      const id = req.body.id;

      await prisma.mt_file.delete({
        where: {
          id: Number(id),
        }
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Update Data MT940",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

}
