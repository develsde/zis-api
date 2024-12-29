const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");

const { customAlphabet } = require("nanoid");
const { z, number } = require("zod");
const readXlsxFile = require('read-excel-file/node');
const { id, tr } = require("date-fns/locale");
const { includes, gt } = require("lodash");
const moment = require ('moment');


module.exports = {
  async createReport(req, res) {
    try {
      const {
        report_type,
        report_gl_account,
        report_proposal_id,
        report_nominal,
        report_description,
        report_isdebit,
        report_date,
        report_mutasi_id,
        report_penyaluran_rek_tujuan,
        report_penyaluran_rek_nama,
        report_penyaluran_bank_account_ziswaf_id,
        report_penerimaan_rek_asal,
        report_penerimaan_rek_nama,
        report_penerimaan_bank_account_ziswaf_id,
      } = req.body;

      //console.log(JSON.stringify(req.body))

      const createReport = await prisma.report.create({
        data: {
          report_gl_account: Number(report_gl_account),
          report_type: Number(report_type),
          report_proposal_id: Number(report_proposal_id),
          report_nominal: Number(report_nominal),
          report_description,
          report_isdebit,
          report_date,
          report_mutasi_id: Number(report_mutasi_id),
          report_penyaluran_rek_tujuan,
          report_penyaluran_rek_nama,
          report_penyaluran_bank_account_ziswaf_id,
          report_penerimaan_rek_asal,
          report_penerimaan_rek_nama,
          report_penerimaan_bank_account_ziswaf_id,
        },
      });

      return res.status(200).json({
        message: "Sukses membuat report",
        data: createReport,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async createMutasi(req, res) {
    try {
      const {
        mutasi_bank_code,
        mutasi_deskripsi,
        mutasi_currency,
        mutasi_amount,
        mutasi_isdebit,
        mutasi_balance,
        mutasi_bank_account_id,
        mutasi_tanggal_transaksi,
      } = req.body;

      //console.log(JSON.stringify(req.body))

      const createMutasi = await prisma.mutasi.create({
        data: {
          mutasi_bank_code,
          mutasi_deskripsi,
          mutasi_currency: Number(mutasi_currency),
          mutasi_amount: Number(mutasi_amount),
          mutasi_isdebit: Number(mutasi_isdebit),
          mutasi_balance: Number(mutasi_balance),
          mutasi_bank_account_id: Number(mutasi_bank_account_id),
          mutasi_tanggal_transaksi,
        },
      });

      return res.status(200).json({
        message: "Sukses membuat Data Mutasi",
        data: createMutasi,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async uploadMutasi(req, res) {
    try {
      const file = req.file;

      const [duplicateFile] = await prisma.$transaction([
        prisma.mutasi_file.findFirst({
          select: {
            id: true,
          },
          where: {
            mutasi_file_name: { contains: file.originalname },
          },
        }),
      ]);

      const userId = req.user_id;

      //   const schema = z.object({
      //     no_rekening: z.string({ required_error: "No Rekening Harus Diis" }).min(5),
      //     bank: z.number().optional()
      //   });

      if (!file) {
        return res.status(400).json({
          message: "File Mutasi Tidak Boleh Kosong",
        });
      }

      if (duplicateFile !== null) {
        return res.status(400).json({
          message: "File Mutasi Bank Pernah Diupload Sebelumnya,",
        });
      }

      const maxSize = 512000;
      if (file.size > maxSize) {
        await fs.unlink(file.path);

        return res.status(400).json({
          message: "Ukuran File terlalu Besar",
        });
      }

      // Array of allowed files
      const array_of_allowed_files = ["xlsx", "xls"];

      // Get the extension of the uploaded file
      const file_extension = file.originalname.slice(
        ((file.originalname.lastIndexOf(".") - 1) >>> 0) + 2
      );

      // Check if the uploaded file is allowed
      if (!array_of_allowed_files.includes(file_extension)) {
        return res.status(400).json({
          message: "File Tidak Sesuai Format",
        });
      }

      const { mutasi_file_name, bank, mutasi_file_bulan } = req.body;

      //console.log(JSON.stringify(req.body))

      const resultUploaded = await prisma.mutasi_file.create({
        data: {
          mutasi_file_name: `${file.filename}`,
          mutasi_file_bank_account_id: Number(bank),
          mutasi_file_bulan: Number(mutasi_file_bulan),
        },
      });

      if (resultUploaded) {
        //pembuatan fungsi membaca file excel kemudian push many data nya
      }

      return res.status(200).json({
        message: "Sukses Upload",
        data: resultUploaded,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async createMutasiFromBank(req, res) {
    try {
      const { mutasi_bank_code } = req.body;

      let dataTrans = [];
      const dataexcel = await readXlsxFile("uploads/" + filename).then(
        (rows) => {
          // rows.map((items, i) =>
          //   dataTrans.push({
          //     mutasi_bank_code,
          //     mutasi_deskripsi: rows[i][1],
          //     mutasi_currency: Number(i)[2],
          //     mutasi_amount: Number(rows[i][3]),
          //     mutasi_isdebit: String(rows[i][6]),
          //     mutasi_balance: rows[i][7],
          //     mutasi_bank_account_id: Number(rows[i][8]),
          //     mutasi_tanggal_transaksi: Number(rows[i][10])
          //   })
          // )
          console.log("SEMUA DATA DARI EXCEL", JSON.stringify(rows));
          //dataTrans.splice(0, 1)

          return dataTrans;
        }
      );
      //console.log("SEMUA DATA GAPSss",JSON.stringify(dataexcel));

      await prisma.mutasi.createMany({
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

  async allDataMutasi(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const deskripsi = req.query.mutasi_deskripsi || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";

      const params = {
        mutasi_deskripsi: {
          contains: keyword,
        },
      };

      const [count, datamutasi] = await prisma.$transaction([
        prisma.mutasi.count({
          where: params,
        }),
        prisma.mutasi.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      const AllMutasiResult = await Promise.all(
        datamutasi.map(async (item) => {
          return {
            ...item,
          };
        })
      );

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data Mutasi",

        data: AllMutasiResult,
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

  async allDataMutasiFile(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const deskripsi = req.query.mutasi_file_name || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";

      const params = {
        mutasi_file_name: {
          contains: keyword,
        },
      };

      const [count, dataMutasiFile] = await prisma.$transaction([
        prisma.mutasi_file.count({
          where: params,
        }),
        prisma.mutasi_file.findMany({
          include: {
            bank_account: {
              select: {
                bank_name: true,
                bank_number: true,
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

      const AllResult = await Promise.all(
        dataMutasiFile.map(async (item) => {
          return {
            ...item,
          };
        })
      );

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data Mutasi File",

        data: AllResult,
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

  async createJurnal(req, res) {
    try {
      const {
        jurnal_tanggal,
        jurnal_deskripsi,
        jurnal_isdebit,
        jurnal_gl_account,
        jurnal_nominal,
        jurnal_status,
        jurnal_kategori,
        jurnal_head_id,
      } = req.body;

      //console.log(JSON.stringify(req.body))

      const createJurnal = await prisma.jurnal_lk.create({
        data: {
          jurnal_tanggal,
          jurnal_deskripsi,
          jurnal_isdebit: Number(jurnal_isdebit),
          //jurnal_gl_account : Number(jurnal_gl_account),
          gl_account: {
            connect: {
              id: Number(jurnal_gl_account),
            },
          },
          jurnal_nominal: Number(jurnal_nominal),
          jurnal_status,
          //jurnal_kategori : Number(jurnal_kategori)
          jurnal_category: {
            connect: {
              id: Number(jurnal_kategori),
            },
          },
          jurnal_lk_header: {
            connect: {
              id: Number(jurnal_head_id),
            },
          },
        },
      });

      return res.status(200).json({
        message: "Sukses membuat report",
        data: createJurnal,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async allDataJurnal(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const keyword = req.query.jurnal_deskripsi || "";
      const deskripsi = req.query.mutasi_deskripsi || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";

      const params = {
        jurnal_deskripsi: {
          contains: keyword,
        },
      };

      const [count, dataJurnalLk] = await prisma.$transaction([
        prisma.jurnal_lk.count({
          where: params,
        }),
        prisma.jurnal_lk.findMany({
          include: {
            gl_account: {
              select: {
                gl_name: true,
                gl_account: true,
              },
            },
            jurnal_category: {
              select: {
                category: true,
              },
            },
            jurnal_lk_header: {
              select: {
                document_number: true,
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

      const AllResult = await Promise.all(
        dataJurnalLk.map(async (item) => {
          return {
            ...item,
          };
        })
      );

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data Mutasi",

        data: AllResult,
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

  async listDocumentNumber(req, res) {
    try {
      //const userId = req.user_id;

      const doc = await prisma.document_number.findMany({});

      if (!doc) {
        return res.status(404).json({
          message: "Document tidak ditemukan",
        });
      }

      return res.status(200).json({
        message: "Sukses",
        data: doc,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async createJurnalHeader(req, res) {
    try {
      const { doc_number, doc_number_id, period } = req.body;

      //console.log(JSON.stringify(req.body))

      const createJurnalHeader = await prisma.jurnal_lk_header.create({
        data: {
          doc_number,
          doc_number_id: Number(doc_number_id),
          period: Number(period),
        },
      });

      return res.status(200).json({
        message: "Sukses membuat jurnal header",
        data: createJurnalHeader,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error saat create jurnal header",
        error: error.message,
      });
    }
  },

  async allItemPerHeader(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const keyword = req.query.jurnal_deskripsi || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";
      const header_id = req.params.id;

      if (!header_id) {
        return res.status(400).json({ message: "Header ID is required" });
      }

      // Step 1: Ambil jurnal_lk_header berdasarkan ID
      const jurnalHeader = await prisma.jurnal_lk_header.findUnique({
        where: { id: Number(header_id) },
        select: {
          id: true,
          document_number: true,
          // deskripsi: true,
          // document_type: true,
        },
      });

      if (!jurnalHeader) {
        return res.status(404).json({ message: "Jurnal Header not found" });
      }

      // Step 2: Ambil data jurnal_lk berdasarkan jurnal_head_id
      const [count, dataJurnalLk] = await prisma.$transaction([
        prisma.jurnal_lk.count({
          where: {
            jurnal_head_id: Number(header_id),
            jurnal_deskripsi: {
              contains: keyword,
            },
          },
        }),
        prisma.jurnal_lk.findMany({
          where: {
            jurnal_head_id: Number(header_id),
            jurnal_deskripsi: {
              contains: keyword,
            },
          },
          include: {
            gl_account: {
              select: {
                gl_name: true,
                gl_account: true,
              },
            },
            jurnal_category: {
              select: {
                category: true,
              },
            },
            jurnal_lk_header: {
              select: {
                document_number: {
                  select: {
                    id: true,
                    number: true,
                    deskripsi: true,
                    document_type: true,
                  },
                },
              },
            },
          },
          orderBy: {
            [sortBy]: sortType,
          },
          skip,
          take: perPage,
        }),
      ]);

      // Step 3: Mapping data jika ada transformasi tambahan
      const AllResult = dataJurnalLk.map((item) => ({
        ...item,
      }));

      // Step 4: Response JSON
      res.status(200).json({
        message: "Sukses Ambil Data Mutasi",
        header: jurnalHeader, // Data jurnal_lk_header
        data: AllResult, // Data jurnal_lk
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

  async allDataJurnalHeader(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      //const keyword = req.query.jurnal_deskripsi || "";
      //const deskripsi = req.query.mutasi_deskripsi || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";

      const params = {
        // jurnal_deskripsi: {
        //   contains: keyword,
        // },
      };

      const [count, dataJurnaHead] = await prisma.$transaction([
        prisma.jurnal_lk_header.count({
          //where: params,
        }),
        prisma.jurnal_lk_header.findMany({          
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      const AllResult = await Promise.all(
        dataJurnaHead.map(async (item) => {
          return {
            ...item,
          };
        })
      );

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data Jurnal Header",

        data: AllResult,
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
  async deleteJurnalHeader(req, res) {
    try {
      const id = req.body.id;

      await prisma.jurnal_lk_header.delete({
        where: {
          id: Number(id),
        }        
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Delete Data Jurnal Header",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },   
  async deleteJurnalItem(req, res) {
    try {
      const id = req.body.id;

      await prisma.jurnal_lk.delete({
        where: {
          id: Number(id),
        }        
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Delete Data Jurnal Item",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },   

  async getAllJurnalProposal(req, res) {
    try {
      
      const doc = await prisma.jurnal.findMany({
          where: {
              jurnal_category_id : Number(6),
              amount_debit : { gt : 25 },
              datetime : {
                lte: new Date('2024-10-31'),
                gte: new Date('2024-10-01')
              } 
          },
          // skip: 0,
          // take: 10
      });

      //doc.map((items) => {
       
      for(let sdata of doc) {  

        const lastJurnalHeader =  await prisma.jurnal_lk_header.findFirst({
          orderBy: {
            doc_number: "desc", // Mengurutkan dari terbesar ke terkecil
          },
        });
  
        // Tentukan nilai doc_number yang baru
        const lastDocNumber = lastJurnalHeader
          ? lastJurnalHeader.doc_number
          : "10000000";
  
        // Pastikan doc_number adalah angka yang valid
        const newDocNumber = isNaN(parseInt(lastDocNumber))
          ? 10000001 // Nilai default jika parseInt menghasilkan NaN
          : parseInt(lastDocNumber) + 1; // Increment dari nilai terakhir
  
        const period = 2024;
  
        const createJurnalHeader =  await prisma.jurnal_lk_header.create({
          data: {
            doc_number : String(newDocNumber),            
            doc_type: 1,
            currency: "IDR",
            period: Number(period),
            proposal_id: Number(sdata.transaction_proposal_id),
            istransformed: 1
          },
        });

        //console.log(createJurnalHeader)
        const jurnalKategori = 1;
        const createJurnalItem =  await prisma.jurnal_lk.create({
          data: {
              jurnal_tanggal: sdata.datetime,
              jurnal_deskripsi: String(sdata.deskripsi),
              jurnal_isdebit: 1,
              //jurnal_gl_account: Number(sdata.glaccount),
              gl_account: {
                connect: {
                  id: Number(sdata.glaccount),
                },
              },
              jurnal_nominal: Number(sdata.amount_debit),
              jurnal_status: 1,
              jurnal_category: {
                connect: {
                  id: Number(jurnalKategori),
                },
              },              
              jurnal_lk_header: {
                connect: {
                  id: Number(createJurnalHeader.id)
                },
              },
          },
        });

        const glaccountkredit = 363
        const createJurnalItem2 =  await prisma.jurnal_lk.create({
          data: {
              jurnal_tanggal: sdata.datetime,
              jurnal_deskripsi: "Bank Transfer",
              jurnal_isdebit: 0,
              gl_account: {
                connect: {
                  id: Number(glaccountkredit),
                },
              },
              jurnal_nominal: -Number(sdata.amount_debit),
              jurnal_status: 1,
              jurnal_category: {
                connect: {
                  id: Number(jurnalKategori),
                },
              },       
              jurnal_lk_header: {
                connect: {
                  id: Number(createJurnalHeader.id)
                },
              },
          },
        });

      }

      if (!doc) {
        return res.status(404).json({
          message: "Document tidak ditemukan",
        });
      }

      return res.status(200).json({
        message: "Sukses",
        data: doc,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },


  async getAllMutasi(req, res) {
    try {
      
      const mutasi = await prisma.mutasi.findMany({          
          // skip: 0,
          // take: 10
      });

      //doc.map((items) => {
       
      for(let sdata of mutasi) {  

        const lastJurnalHeader =  await prisma.jurnal_lk_header.findFirst({
          orderBy: {
            doc_number: "desc", // Mengurutkan dari terbesar ke terkecil
          },
        });
  
        // Tentukan nilai doc_number yang baru
        const lastDocNumber = lastJurnalHeader
          ? lastJurnalHeader.doc_number
          : "10000000";
  
        // Pastikan doc_number adalah angka yang valid
        const newDocNumber = isNaN(parseInt(lastDocNumber))
          ? 10000001 // Nilai default jika parseInt menghasilkan NaN
          : parseInt(lastDocNumber) + 1; // Increment dari nilai terakhir
  
        const period = 2024;
  
        const createJurnalHeader =  await prisma.jurnal_lk_header.create({
          data: {
            doc_number : String(newDocNumber),            
            doc_type: 1,
            currency: String(sdata.mutasi_currency),
            period: Number(period),            
            istransformed: 1
          },
        });

        //console.log(createJurnalHeader)
        const glaccountkredit = 363
        const jurnalKategori = 1;
        const createJurnalItem =  await prisma.jurnal_lk.create({
          data: {
              jurnal_tanggal: sdata.mutasi_tanggal_transaksi,
              jurnal_deskripsi: String(sdata.mutasi_deskripsi),
              jurnal_isdebit: sdata.mutasi_isdebit != null ? 1 : 0,
              //jurnal_gl_account: Number(sdata.glaccount),
              gl_account: {
                connect: {
                  id: Number(glaccountkredit),
                },
              },
              jurnal_nominal: Number(sdata.mutasi_amount),
              jurnal_status: 1,
              jurnal_category: {
                connect: {
                  id: Number(jurnalKategori),
                },
              },              
              jurnal_lk_header: {
                connect: {
                  id: Number(createJurnalHeader.id)
                },
              },
          },
        });

        const glaccountbank = 179 //tandain
        const createJurnalItem2 =  await prisma.jurnal_lk.create({
          data: {
              jurnal_tanggal: sdata.mutasi_tanggal_transaksi,
              jurnal_deskripsi: "Bank",
              jurnal_isdebit: sdata.mutasi_iscredit != null ? 1 : 0,
              gl_account: {
                connect: {
                  id: Number(glaccountbank),
                },
              },
              jurnal_nominal: -Number(sdata.mutasi_amount),
              jurnal_status: 1,
              jurnal_category: {
                connect: {
                  id: Number(jurnalKategori),
                },
              },       
              jurnal_lk_header: {
                connect: {
                  id: Number(createJurnalHeader.id)
                },
              },
          },
        });

      }

      if (!mutasi) {
        return res.status(404).json({
          message: "Document tidak ditemukan",
        });
      }

      return res.status(200).json({
        message: "Sukses",
        data: mutasi,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  
};