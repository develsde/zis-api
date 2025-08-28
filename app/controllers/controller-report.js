const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");

const { customAlphabet } = require("nanoid");
const { z, number } = require("zod");
const readXlsxFile = require("read-excel-file/node");
const { id, tr } = require("date-fns/locale");
const { includes, gt, values } = require("lodash");
const moment = require("moment");
const { glaccount } = require("./controller-reference");

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
          // page,
          // hasNext: count > page * perPage,
          // totalPage: Math.ceil(count / perPage),
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
        com_code,
      } = req.body;

      // Konversi jurnal_tanggal ke format Date
      const tanggalJurnal = new Date(jurnal_tanggal);
      const bulanJurnal = String(tanggalJurnal.getMonth() + 1).padStart(2, "0"); // Ubah ke format dua digit
      const tahunJurnal = String(tanggalJurnal.getFullYear()); // Pastikan tahun tetap dalam format string

      // Ambil data periode yang sesuai (harus dibandingkan sebagai string)
      // const period = await prisma.period.findFirst({
      //   where: {
      //     from_period: { lte: bulanJurnal.toString() }, // VARCHAR → tetap string
      //     to_period: { gte: bulanJurnal.toString() }, // VARCHAR → tetap string
      //     from_year: { lte: Number(tahunJurnal) }, // YEAR → harus Integer
      //     to_year: { gte: Number(tahunJurnal) }, // YEAR → harus Integer
      //   },
      // });

      // // Validasi apakah jurnal_tanggal masuk dalam periode yang tersedia
      // if (!period) {
      //   return res.status(400).json({
      //     message: "Jurnal tanggal di luar periode yang diperbolehkan.",
      //   });
      // }

      // Validasi dan konversi nilai numerik untuk menghindari error
      const isDebit = isNaN(Number(jurnal_isdebit))
        ? 0
        : Number(jurnal_isdebit);
      const nominal = isNaN(Number(jurnal_nominal))
        ? 0
        : Number(jurnal_nominal);
      const glAccountId = isNaN(Number(jurnal_gl_account))
        ? null
        : Number(jurnal_gl_account);
      const kategoriId = isNaN(Number(jurnal_kategori))
        ? null
        : Number(jurnal_kategori);
      const headId = isNaN(Number(jurnal_head_id))
        ? null
        : Number(jurnal_head_id);

      if (glAccountId === null || kategoriId === null || headId === null) {
        return res.status(400).json({ message: "ID tidak valid" });
      }

      // Proses pembuatan jurnal jika validasi lolos
      const createJurnal = await prisma.jurnal_lk.create({
        data: {
          jurnal_tanggal,
          jurnal_deskripsi,
          jurnal_isdebit: isDebit,
          gl_account: { connect: { id: glAccountId } },
          jurnal_nominal: nominal,
          jurnal_status,
          jurnal_category: { connect: { id: kategoriId } },
          jurnal_lk_header: { connect: { id: headId } },
          com_code,
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

  async updatePeriod(req, res) {
    try {
      const id = 1; // Pastikan ID ini sesuai
      const userId = req.user_id;
      console.log("userId", userId);

      let { from_period, to_period, from_year, to_year } = req.body;

      // Konversi from_year dan to_year ke integer
      from_year = parseInt(from_year, 10);
      to_year = parseInt(to_year, 10);

      if (isNaN(from_year) || isNaN(to_year)) {
        return res.status(400).json({
          message: "Invalid from_year or to_year. Must be a number.",
        });
      }

      // Cek apakah period dengan ID yang dimaksud ada
      const prd = await prisma.period.findUnique({
        where: { id },
      });

      if (!prd) {
        return res.status(404).json({
          message: "Period not found",
        });
      }

      // Ambil tanggal dan waktu sekarang (WIB / UTC+7)
      const now = new Date();
      const localTime = new Date(now.getTime() + 7 * 60 * 60 * 1000); // UTC+7 (WIB)

      // Simpan `aedat` sebagai full DateTime (tanggal sekarang)
      const formattedDateTime = localTime;

      // Simpan `aetim` dengan tanggal yang sama tetapi hanya jamnya
      const aetim = new Date(localTime);
      aetim.setMilliseconds(0); // Hapus milidetik biar bersih

      // Update period dengan aedat (YYYY-MM-DD HH:mm:ss) dan aetim (HH:mm:ss di DateTime)
      const prdResult = await prisma.period.update({
        where: { id },
        data: {
          from_period,
          to_period,
          from_year,
          to_year,
          aenam: Number(userId),
          aedat: formattedDateTime, // Simpan tanggal dan waktu penuh
          aetim: aetim, // Simpan hanya jam dari waktu sekarang
        },
      });

      return res.status(200).json({
        message: "Sukses update period",
        data: prdResult,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async getPeriod(req, res) {
    try {
      const id = 1; // Pastikan ID ini sesuai

      // Cari period berdasarkan ID
      const prd = await prisma.period.findUnique({
        where: { id },
        select: {
          from_period: true,
          to_period: true,
          from_year: true,
          to_year: true,
        },
      });

      if (!prd) {
        return res.status(404).json({
          message: "Period not found",
        });
      }

      return res.status(200).json({
        message: "Successfully fetched period",
        data: prd,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async allDataJurnalDetail(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const sortBy = req.query.sortBy || "jurnal_head_id";
      const sortType = req.query.order || "desc";
      const docNumberFilter = req.query.docNumber || null; // Filter untuk doc_number
      const indicatorFilter = req.query.indicator || null; // Filter untuk indicator

      // Pagination options
      const take = 20; // Jumlah data per halaman
      const skip = (page - 1) * take;

      // Kondisi filtering dinamis
      const params = {};

      // Filter berdasarkan doc_number
      if (docNumberFilter) {
        params.jurnal_lk_header = {
          doc_number: {
            contains: docNumberFilter, // Filter doc_number dengan LIKE
          },
        };
      }

      // Filter berdasarkan indicator
      if (indicatorFilter) {
        params.jurnal_lk_header = {
          ...params.jurnal_lk_header, // Tambahkan ke filter jurnal_lk_header jika sudah ada
          document_type: {
            indicator: {
              contains: indicatorFilter, // Filter indicator dengan LIKE
            },
          },
        };
      }

      // Menjalankan query ke database
      const [count, dataJurnalDetail] = await prisma.$transaction([
        prisma.jurnal_lk.count({
          where: params, // Kondisi where berdasarkan filter
        }),
        prisma.jurnal_lk.findMany({
          include: {
            jurnal_lk_header: {
              select: {
                doc_number: true, // Ambil doc_number dari jurnal_lk_header
                currency: true, //
                document_type: {
                  select: {
                    indicator: true, // Ambil indicator dari document_type
                  },
                },
              },
            },
            gl_account: {
              select: {
                gl_account: true,
                gl_name: true, // Ambil gl_name dari tabel gl_account
              },
            },
          },
          orderBy: [
            {
              [sortBy]: sortType, // Urutkan berdasarkan jurnal_head_id
            },
            {
              jurnal_isdebit: "desc", // Pastikan debit muncul lebih dulu dalam grup
            },
          ],
          where: params, // Kondisi where berdasarkan filter
          skip, // Data yang dilewati
          take, // Jumlah data yang diambil
        }),
      ]);

      // Format hasil data untuk response
      const AllResult = dataJurnalDetail.map((item) => ({
        id: item.id,
        tanggal: item.jurnal_tanggal,
        deskripsi: item.jurnal_deskripsi,
        is_debit: item.jurnal_isdebit,
        nominal: item.jurnal_nominal,
        status: item.jurnal_status,
        gl_account: item.gl_account
          ? `${item.gl_account.gl_account} - ${item.gl_account.gl_name}` // Gabungkan gl_account dan gl_name
          : null,
        jurnal_head: item.jurnal_lk_header
          ? {
              doc_number: item.jurnal_lk_header.doc_number,
              currency: item.jurnal_lk_header.currency,
              indicator: item.jurnal_lk_header.document_type
                ? item.jurnal_lk_header.document_type.indicator
                : null,
            }
          : null,
      }));

      // Mengirim response ke client
      res.status(200).json({
        message: "Sukses Ambil Data Jurnal Detail",
        data: AllResult,
        pagination: {
          total: count,
          page,
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message || "Terjadi kesalahan pada server.",
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

  async getHeaderAndUpdateItems(req, res) {
    try {
      const { document_number, updates } = req.body; // `updates` akan berisi data yang ingin diupdate
      console.log("request body: ", req.body);

      // Validasi jika document_number tidak ada
      if (!document_number) {
        return res.status(400).json({
          message: "Doc Number harus diisi",
        });
      }

      // Mencari header berdasarkan document_number
      const header = await prisma.jurnal_lk_header.findFirst({
        where: {
          doc_number: document_number,
        },
      });

      console.log("header", header);

      // Jika header tidak ditemukan
      if (!header) {
        return res.status(404).json({
          message: "Header tidak ditemukan",
        });
      }

      // Mencari data jurnal_lk berdasarkan jurnal_head_id
      const jurnalLkData = await prisma.jurnal_lk.findMany({
        where: {
          jurnal_head_id: header.id,
        },
      });

      if (!jurnalLkData || jurnalLkData.length === 0) {
        return res.status(404).json({
          message: "Data jurnal tidak ditemukan",
        });
      }

      // Jika ada data untuk diupdate
      if (updates && Array.isArray(updates)) {
        for (const update of updates) {
          // Validasi update harus memiliki ID yang valid
          if (!update.id) {
            return res.status(400).json({
              message: "Setiap item update harus memiliki ID",
            });
          }

          // Hanya update field yang diperbolehkan
          const allowedFields = [
            "jurnal_deskripsi",
            "jurnal_isdebit",
            "jurnal_gl_account",
            "jurnal_nominal",
            "jurnal_kategori",
          ];
          const dataToUpdate = Object.fromEntries(
            Object.entries(update).filter(([key]) =>
              allowedFields.includes(key)
            )
          );

          if (Object.keys(dataToUpdate).length === 0) {
            return res.status(400).json({
              message: `Tidak ada field yang valid untuk diupdate pada item dengan ID ${update.id}`,
            });
          }

          // Update data jurnal_lk berdasarkan ID
          await prisma.jurnal_lk.update({
            where: { id: update.id },
            data: dataToUpdate, // Data yang ingin diupdate
          });
        }
      }

      // Mengambil data terbaru setelah update
      const updatedJurnalLkData = await prisma.jurnal_lk.findMany({
        where: {
          jurnal_head_id: header.id,
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: {
          header,
          jurnalLkData: updatedJurnalLkData, // Menyertakan data jurnal_lk yang diperbarui
        },
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message || "Terjadi kesalahan pada server.",
      });
    }
  },

  async createJurnalHeader(req, res) {
    try {
      const {
        period,
        currency,
        doc_type,
        proposal_id,
        iswakaf,
        istransformed,
        com_code,
      } = req.body;

      // Ambil nilai doc_number terakhir dari database
      const lastJurnalHeader = await prisma.jurnal_lk_header.findFirst({
        orderBy: {
          doc_number: "desc", // Mengurutkan dari terbesar ke terkecil
        },
      });

      // Tentukan nilai doc_number yang baru
      const lastDocNumber = lastJurnalHeader
        ? lastJurnalHeader.doc_number
        : "10000000";

      // Pastikan doc_number adalah angka yang valid
      let newDocNumber = isNaN(parseInt(lastDocNumber))
        ? 10000000 // Nilai default jika parseInt menghasilkan NaN
        : parseInt(lastDocNumber) + 1; // Increment dari nilai terakhir

      // Reset doc_number ke 10000000 jika melebihi 19999999
      if (newDocNumber > 19999999) {
        newDocNumber = 10000000;
      }

      // Validasi apakah doc_type adalah id yang valid
      const documentType = await prisma.document_type.findUnique({
        where: { id: doc_type },
      });

      if (!documentType) {
        return res.status(400).json({
          message: "Invalid doc_type id",
        });
      }

      // Buat jurnal header baru
      const createJurnalHeader = await prisma.jurnal_lk_header.create({
        data: {
          doc_number: String(newDocNumber), // Simpan sebagai string jika dibutuhkan
          period: Number(period), // Pastikan period adalah angka
          currency: currency, // Simpan currency sebagai varchar
          iswakaf: Number(iswakaf), // Pastikan iswakaf adalah angka (0 atau 1)
          description: String(proposal_id), // Pastikan proposal_id adalah angka
          // Gunakan relasi untuk document_type
          document_type: {
            connect: { id: doc_type }, // Menghubungkan dengan document_type yang memiliki id
          },
          istransformed: istransformed,
          com_code: com_code,
        },
      });
      console.log("quer create", createJurnalHeader);

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

  async alldocType(req, res) {
    try {
      const docTypes = await prisma.document_type.findMany();
      return res.status(200).json({
        message: "Sukses mendapatkan semua data doc_type",
        data: docTypes,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error saat mendapatkan semua data doc_type",
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
                gl_account_type: true, // Mengambil relasi dengan gl_account_type
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
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "desc";

      // Ambil parameter filter dari query
      const indicatorFilter = req.query.indicator || null; // Filter untuk doc_type (indicator)
      const periodFilter = req.query.period
        ? parseInt(req.query.period, 10)
        : null; // Konversi period ke Int
      const startDate = req.query.startDate || null; // Tanggal awal
      const endDate = req.query.endDate || null; // Tanggal akhir

      // Jika tidak ada filter sama sekali, kembalikan data kosong
      if (!indicatorFilter && !periodFilter && !startDate && !endDate) {
        return res.status(200).json({
          message:
            "Silakan lakukan filtering dengan indicator, period, startDate, atau endDate.",
          data: [],
          pagination: {
            total: 0,
            page,
          },
        });
      }

      // Kondisi filtering dinamis
      const params = {};

      // Filter berdasarkan period
      if (periodFilter) {
        params.period = {
          equals: periodFilter, // Filter dengan tipe Int
        };
      }

      // Filter berdasarkan indicator (doc_type)
      if (indicatorFilter) {
        params.document_type = {
          indicator: {
            contains: indicatorFilter, // Filter menggunakan LIKE pada indicator (doc_type)
          },
        };
      }

      // Filter berdasarkan rentang tanggal
      if (startDate || endDate) {
        params.create_date = {};

        if (startDate) {
          // Mengonversi startDate menjadi objek Date
          const parsedStartDate = new Date(startDate);
          if (!isNaN(parsedStartDate)) {
            params.create_date.gte = parsedStartDate; // Tanggal awal (lebih besar atau sama dengan)
          } else {
            return res.status(400).json({
              message: "Invalid startDate format.",
            });
          }
        }
        if (endDate) {
          // Mengonversi endDate menjadi objek Date
          const parsedEndDate = new Date(endDate);
          if (!isNaN(parsedEndDate)) {
            params.create_date.lte = parsedEndDate; // Tanggal akhir (lebih kecil atau sama dengan)
          } else {
            return res.status(400).json({
              message: "Invalid endDate format.",
            });
          }
        }
      }

      // Menjalankan query dengan filtering
      const [count, dataJurnalHead] = await prisma.$transaction([
        prisma.jurnal_lk_header.count({
          where: params, // Kondisi where berdasarkan filter
        }),
        prisma.jurnal_lk_header.findMany({
          include: {
            document_type: {
              select: {
                id: true,
                indicator: true, // Ambil data terkait dari tabel document_type
              },
            },
            jurnal_lk: {
              select: {
                id: true,
                jurnal_tanggal: true,
                jurnal_deskripsi: true,
                jurnal_isdebit: true,
                jurnal_gl_account: true,
                jurnal_nominal: true,
                jurnal_status: true,
                jurnal_category: {
                  select: {
                    category: true,
                  },
                },
                gl_account: {
                  select: {
                    gl_account: true,
                    gl_name: true, // Ambil kolom gl_name dari gl_account
                  },
                },
              },
            },
          },
          orderBy: {
            [sortBy]: sortType,
          },
          where: params, // Kondisi where berdasarkan filter
        }),
      ]);

      // Format hasil data untuk response
      const AllResult = dataJurnalHead.map((item) => ({
        id: item.id,
        doc_number: item.doc_number, // Menggunakan kolom langsung dari tabel
        create_date: item.create_date,
        period: item.period,
        currency: item.currency,
        doc_type: item.doc_type,
        iswakaf: item.iswakaf,
        proposal_id: item.proposal_id,
        document_type: item.document_type
          ? {
              id: item.document_type.id,
              indicator: item.document_type.indicator,
            }
          : null,
        jurnal_lk: item.jurnal_lk.map((jurnal) => ({
          id: jurnal.id,
          tanggal: jurnal.jurnal_tanggal,
          deskripsi: jurnal.jurnal_deskripsi,
          is_debit: jurnal.jurnal_isdebit,
          gl_account: jurnal.gl_account
            ? {
                gl_account: jurnal.gl_account.gl_account,
                gl_name: jurnal.gl_account.gl_name, // Menambahkan gl_name dari gl_account
              }
            : null,
          nominal: jurnal.jurnal_nominal,
          status: jurnal.jurnal_status,
          kategori: jurnal.jurnal_category
            ? {
                category: jurnal.jurnal_category.category,
              }
            : null,
        })),
      }));

      // Mengirim response ke client
      res.status(200).json({
        message: "Sukses Ambil Data Jurnal Header",
        data: AllResult,
        pagination: {
          total: count,
          page,
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message || "Terjadi kesalahan pada server.",
      });
    }
  },

  async getDataJurnalHeaderById(req, res) {
    try {
      const { id } = req.params; // Ambil ID dari parameter URL

      // Validasi ID (opsional, jika diperlukan)
      if (!id) {
        return res.status(400).json({ message: "ID tidak boleh kosong." });
      }

      // Ambil data berdasarkan ID
      const dataJurnalHead = await prisma.jurnal_lk_header.findUnique({
        where: { id: Number(id) }, // Mencari berdasarkan ID yang diberikan
        include: {
          document_type: {
            select: {
              id: true,
              indicator: true, // Ambil data terkait dari tabel document_type
            },
          },
          jurnal_lk: {
            select: {
              id: true,
              jurnal_tanggal: true,
              jurnal_deskripsi: true,
              jurnal_isdebit: true,
              jurnal_gl_account: true,
              jurnal_nominal: true,
              jurnal_status: true,
              jurnal_kategori: true,
              gl_account: {
                // Menambahkan relasi ke gl_account
                select: {
                  gl_account: true,
                  gl_name: true, // Ambil kolom gl_name dari gl_account
                },
              },
            },
          },
        },
      });

      // Jika data tidak ditemukan
      if (!dataJurnalHead) {
        return res.status(404).json({ message: "Data tidak ditemukan." });
      }

      // Transformasi data seperti pada fungsi sebelumnya
      const result = {
        id: dataJurnalHead.id,
        doc_number: dataJurnalHead.doc_number,
        create_date: dataJurnalHead.create_date,
        period: dataJurnalHead.period,
        currency: dataJurnalHead.currency,
        doc_type: dataJurnalHead.doc_type,
        iswakaf: dataJurnalHead.iswakaf,
        proposal_id: dataJurnalHead.proposal_id,
        document_type: dataJurnalHead.document_type
          ? {
              id: dataJurnalHead.document_type.id,
              indicator: dataJurnalHead.document_type.indicator,
            }
          : null,
        jurnal_lk: dataJurnalHead.jurnal_lk.map((jurnal) => ({
          id: jurnal.id,
          tanggal: jurnal.jurnal_tanggal,
          deskripsi: jurnal.jurnal_deskripsi,
          is_debit: jurnal.jurnal_isdebit,
          gl_account: jurnal.gl_account
            ? {
                gl_account: jurnal.gl_account.gl_account,
                gl_name: jurnal.gl_account.gl_name,
              }
            : null,
          nominal: jurnal.jurnal_nominal,
          status: jurnal.jurnal_status,
          kategori: jurnal.jurnal_kategori,
        })),
      };

      res.status(200).json({
        message: "Sukses Ambil Data Jurnal Header Berdasarkan ID",
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message || "Terjadi kesalahan server.",
      });
    }
  },

  async updateJurnal(req, res) {
    try {
      const { ids, gl_account_id } = req.body; // Ambil array ID dan gl_account_id dari body request
      console.log(req.body);

      // Validasi input
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          message: "Array ID harus disediakan untuk memperbarui data jurnal",
        });
      }

      if (
        !gl_account_id ||
        !Array.isArray(gl_account_id) ||
        gl_account_id.length !== ids.length
      ) {
        return res.status(400).json({
          message: "Jumlah GL Account ID harus sesuai dengan jumlah ID jurnal",
        });
      }

      // Periksa apakah gl_account_id valid untuk setiap ID
      const glAccountIds = gl_account_id.map(Number); // Convert semua gl_account_id menjadi angka
      const glAccountDataPromises = glAccountIds.map((id) =>
        prisma.gl_account.findFirst({
          where: { id },
        })
      );

      const glAccountDataResults = await Promise.all(glAccountDataPromises);

      // Pastikan semua GL Account ID valid
      const invalidGlAccount = glAccountDataResults.find(
        (glAccountData) => !glAccountData
      );
      if (invalidGlAccount) {
        return res.status(404).json({
          message: "Salah satu GL Account tidak ditemukan",
        });
      }

      // Update jurnal_lk untuk semua ID yang diberikan dan GL Account masing-masing
      const updatePromises = ids.map((id, index) =>
        prisma.jurnal_lk.updateMany({
          where: { id: Number(id) }, // Pastikan ID dalam format angka
          data: {
            jurnal_gl_account: glAccountIds[index], // Update dengan GL Account ID masing-masing
          },
        })
      );

      const updatedJournals = await Promise.all(updatePromises);

      // Kirim respons berhasil
      const updatedCount = updatedJournals.reduce(
        (count, result) => count + result.count,
        0
      );

      res.status(200).json({
        message: `${updatedCount} data jurnal berhasil diperbarui`,
        data: updatedJournals,
      });
    } catch (error) {
      // Tangani error
      res.status(500).json({
        message:
          error?.message || "Terjadi kesalahan saat memperbarui data jurnal",
      });
    }
  },

  async deleteJurnalHeader(req, res) {
    try {
      const id = req.body.id;

      await prisma.jurnal_lk_header.delete({
        where: {
          id: Number(id),
        },
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
        },
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
          jurnal_category_id: Number(6),
          amount_debit: { gt: 25 },
          datetime: {
            lte: new Date("2024-10-31"),
            gte: new Date("2024-10-01"),
          },
        },
        // skip: 0,
        // take: 10
      });

      //doc.map((items) => {

      for (let sdata of doc) {
        const lastJurnalHeader = await prisma.jurnal_lk_header.findFirst({
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

        const createJurnalHeader = await prisma.jurnal_lk_header.create({
          data: {
            doc_number: String(newDocNumber),
            doc_type: 1,
            currency: "IDR",
            period: Number(period),
            proposal_id: Number(sdata.transaction_proposal_id),
            istransformed: 1,
          },
        });

        //console.log(createJurnalHeader)
        const jurnalKategori = 1;
        const createJurnalItem = await prisma.jurnal_lk.create({
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
                id: Number(createJurnalHeader.id),
              },
            },
          },
        });

        const glaccountkredit = 363;
        const createJurnalItem2 = await prisma.jurnal_lk.create({
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
                id: Number(createJurnalHeader.id),
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

      for (let sdata of mutasi) {
        const lastJurnalHeader = await prisma.jurnal_lk_header.findFirst({
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

        const createJurnalHeader = await prisma.jurnal_lk_header.create({
          data: {
            doc_number: String(newDocNumber),
            doc_type: 1,
            currency: String(sdata.mutasi_currency),
            period: Number(period),
            istransformed: 1,
          },
        });

        //console.log(createJurnalHeader)
        const glaccountkredit = 363;
        const jurnalKategori = 1;
        const createJurnalItem = await prisma.jurnal_lk.create({
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
                id: Number(createJurnalHeader.id),
              },
            },
          },
        });

        const glaccountbank = 179; //tandain
        const createJurnalItem2 = await prisma.jurnal_lk.create({
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
                id: Number(createJurnalHeader.id),
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

  async getAllCalkData(req, res) {
    try {
      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;

      const santunanSembakoCurrentYear = await prisma.jurnal_lk.groupBy({
        by: ["jurnal_gl_account"],
        _sum: {
          jurnal_nominal: true,
        },
        where: {
          jurnal_gl_account: {
            in: [
              25, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
              40, 41, 42, 56, 240, 241, 242, 243, 244, 196, 197, 198, 199, 200,
              201, 202, 203, 204, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
              54, 205, 207, 208, 209, 210, 211, 212, 213, 214, 215, 217, 218,
              62, 222, 223, 224, 55, 58, 59, 60, 228, 229, 219, 220, 221, 63,
              66, 230, 231, 64, 67, 232, 233, 235, 234, 189, 190, 191, 192, 193,
              364, 365, 194, 195,
            ],
          },
          jurnal_tanggal: {
            gte: new Date(`${currentYear}-01-01T00:00:00.000Z`),
            lt: new Date(`${currentYear + 1}-01-01T00:00:00.000Z`),
          },
        },
      });

      const santunanSembakoPreviousYear = await prisma.jurnal_lk.groupBy({
        by: ["jurnal_gl_account"],
        _sum: {
          jurnal_nominal: true,
        },
        where: {
          jurnal_gl_account: {
            in: [
              25, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
              40, 41, 42, 56, 240, 241, 242, 243, 244, 196, 197, 198, 199, 200,
              201, 202, 203, 204, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
              54, 205, 207, 208, 209, 210, 211, 212, 213, 214, 215, 217, 218,
              62, 222, 223, 224, 55, 58, 59, 60, 228, 229, 219, 220, 221, 63,
              66, 230, 231, 64, 67, 232, 233, 235, 234, 189, 190, 191, 192, 193,
              364, 365, 194, 195,
            ],
          },
          jurnal_tanggal: {
            gte: new Date(`${previousYear}-01-01T00:00:00.000Z`),
            lt: new Date(`${currentYear}-01-01T00:00:00.000Z`),
          },
        },
      });

      const piutangData = [189, 190, 191, 192, 193];
      const penerimaanDanaZakat = [196, 197, 198, 199, 200];
      const penerimaanNonDonatur = [201, 202, 203, 204];
      const totalFakirMiskin = [
        24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41,
      ];
      const totalGharimin = [42, 43];
      const totalMualaf = [44, 45];
      const totalFisabilillah = [46, 47, 48, 49, 50, 51, 52];
      const totalIbnu = [53, 54];
      const totalInfakDonatur = [205, 207];
      const infakTidakDonatur = [208, 209, 210, 211, 212, 213, 214, 215];
      const penerimaanTidakDonatur = [201, 217, 203];
      const penyaluranInfakTerikat = [62, 222, 223, 224];
      const penyaluranInfakTidakTerikat = [55, 58, 59, 60, 228, 229];
      const penerimaanDanaAmil = [219, 220, 221];
      const penggunaanDanaAmil = [
        63, 66, 230, 231, 64, 67, 232, 233, 234, 235, 364,
      ];

      const calkData = [
        {
          name: `Santunan Sembako ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 24
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Yatim Piatu Dhuafa ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 25
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Biaya Hidup ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 26
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Zakat Fitrah ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 27
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Bea-Guru ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 28
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Beasiswa Rutin ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 29
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Beasiswa Putus ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 30
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Buku ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 31
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Prasarana Pendidikan ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 32
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pengobatan Individu ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 33
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Baksos Kesehatan ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 34
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Klinik ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 35
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pembinaan Ekonomi Lemah ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 36
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Modal Usaha ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 37
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Recovery ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 38
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Rescue ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 39
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bencana ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 40
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Dana Non Halal ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 56
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Titipan Dana Infak Masjid ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 240
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Titipan Dana Zakat ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 241
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Titipan Dana Infak Dan Sedekah ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 242
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Titipan Dana Wakaf ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 243
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Titipan Dana Wakaf Produktif ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 244
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Zakat Potong Gaji ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 196
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Zakat Profesi Tunai ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 197
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Zakat Hadiah ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 198
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Zakat Maal ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 199
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Zakat Fitrah ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 200
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Bagi Hasil Bank Syariah ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 201
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pengembalian Dana Begulir Zakat ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 202
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pengembalian Dana Program ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 203
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Lainnya ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 204
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Gharimin ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 42
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Zakat Gharimin Regional ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 43
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Muallaf ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 44
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Zakat Muallaf Regional ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 45
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Kafalah Da'i ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 46
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pelatihan Da'i ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 47
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pembinaan Umat ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 48
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Prasarana Dakwah ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 49
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Sarpras Pendidikan ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 50
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Untuk Palestina ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 51
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Zakat Fisabilillah Regional ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 52
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Ibnu Sabil ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 53
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Zakat Ibnu Sabil Regional ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 54
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak Untuk Palestina ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 205
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak Program Khusus ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 207
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak Jumat ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 208
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak Potong Gaji ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 209
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Kotak Infak ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 210
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak Ceramah Umum ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 211
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak Ramadhan ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 212
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak/Sedekah Umum ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 213
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak 1000 Qurban ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 214
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Fidyah ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 215
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pengembalian Dana Bergulir ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 217
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pengembalian Dana Program ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 218
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Dana Kemanusiaan Palestina ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 62
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penyaluran Dana Qurban ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 222
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Program Khusus ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 223
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Rescue ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 224
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Infaq Pendidikan ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 55
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Infaq Dakwah ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 58
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Infaq Kesehatan ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 59
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Infaq Sosial ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 60
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penyaluran Amil ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 228
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Alokasi Pemanfaatan Aset Kelolaan ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 25
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bagian Amil Atas Dana Zakat ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 219
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bagian Amil Atas Dana Infak ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 220
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Amil Lainnya ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 221
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Gaji Amil ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 63
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pengembangan SDM ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 66
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Beban Amil Cabang ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 230
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Biaya Bank ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 231
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Biaya Alat Tulis Kantor ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 64
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Biaya Prasarana Sekertariat ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 67
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pengembangan Aplikasi ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 232
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Biaya Pelayanan Muzaki ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 233
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Biaya Penyusutan Aktiva Tetap ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 234
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Biaya Sosialisasi ZIS ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 235
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Biaya Lain-Lain ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 364
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Piutang Penyaluran Zakat Regional ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 189
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Piutang Qardhul Hasan ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 190
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Piutang Lain-Lain ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 191
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Dana Kerjasama Rumah Zakat ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 192
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Piutang Penyaluran Imkas ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 193
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Zakat Fakir Miskin Regional ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 41
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Titipan Dana Infak SMS ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 365
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Perolehan Alat Elektronik ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 194
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Akumulasi Penyusutan Alat Elektronik ${previousYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 195
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Santunan Sembako ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 24
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Yatim Piatu Dhuafa ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 25
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Biaya Hidup ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 26
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Zakat Fitrah ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 27
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Bea-Guru ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 28
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Beasiswa Rutin ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 29
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Beasiswa Putus ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 30
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Buku ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 31
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Prasarana Pendidikan ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 32
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pengobatan Individu ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 33
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Baksos Kesehatan ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 34
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Klinik ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 35
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pembinaan Ekonomi Lemah ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 36
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Modal Usaha ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 37
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Recovery ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 38
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Rescue ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 39
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bencana ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 40
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Dana Non Halal ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 56
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Titipan Dana Infak Masjid ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 240
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Titipan Dana Zakat ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 241
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Titipan Dana Infak Dan Sedekah ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 242
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Titipan Dana Wakaf ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 243
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Titipan Dana Wakaf Produktif ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 244
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Zakat Potong Gaji ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 196
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Zakat Profesi Tunai ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 197
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Zakat Hadiah ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 198
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Zakat Maal ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 199
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Zakat Fitrah ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 200
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Bagi Hasil Bank Syariah ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 201
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pengembalian Dana Begulir Zakat ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 202
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pengembalian Dana Program ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 203
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Lainnya ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 204
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Gharimin ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 42
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Zakat Gharimin Regional ${currentYear}`,
          value: Number(
            santunanSembakoPreviousYear.find(
              (val) => val.jurnal_gl_account == 43
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Muallaf ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 44
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Zakat Muallaf Regional ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 45
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Kafalah Da'i ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 46
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pelatihan Da'i ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 47
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pembinaan Umat ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 48
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Prasarana Dakwah ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 49
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Sarpras Pendidikan ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 50
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Untuk Palestina ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 51
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Zakat Fisabilillah Regional ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 52
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Ibnu Sabil ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 53
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Zakat Ibnu Sabil Regional ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 54
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak Untuk Palestina ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 205
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak Program Khusus ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 207
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak Jumat ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 208
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak Potong Gaji ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 209
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Kotak Infak ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 210
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak Ceramah Umum ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 211
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak Ramadhan ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 212
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak/Sedekah Umum ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 213
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Infak 1000 Qurban ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 214
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Fidyah ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 215
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pengembalian Dana Bergulir ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 217
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pengembalian Dana Program ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 218
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Dana Kemanusiaan Palestina ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 62
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penyaluran Dana Qurban ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 222
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Program Khusus ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 223
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bantuan Rescue ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 224
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Infaq Pendidikan ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 55
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Infaq Dakwah ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 58
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Infaq Kesehatan ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 59
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Infaq Sosial ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 60
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penyaluran Amil ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 228
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Alokasi Pemanfaatan Aset Kelolaan ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 25
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bagian Amil Atas Dana Zakat ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 219
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Bagian Amil Atas Dana Infak ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 220
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Penerimaan Amil Lainnya ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 221
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Gaji Amil ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 63
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pengembangan SDM ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 66
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Beban Amil Cabang ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 230
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Biaya Bank ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 231
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Biaya Alat Tulis Kantor ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 64
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Biaya Prasarana Sekertariat ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 67
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Pengembangan Aplikasi ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 232
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Biaya Pelayanan Muzaki ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 233
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Biaya Penyusutan Aktiva Tetap ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 234
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Biaya Sosialisasi ZIS ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 235
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Biaya Lain-Lain ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 364
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Piutang Penyaluran Zakat Regional ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 189
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Piutang Qardhul Hasan ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 190
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Piutang Lain-Lain ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 191
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Dana Kerjasama Rumah Zakat ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 192
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Piutang Penyaluran Imkas ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 193
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Zakat Fakir Miskin Regional ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 41
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Titipan Dana Infak SMS ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 365
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Perolehan Alat Elektronik ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 194
            )?._sum.jurnal_nominal || 0
          ),
        },
        {
          name: `Akumulasi Penyusutan Alat Elektronik ${currentYear}`,
          value: Number(
            santunanSembakoCurrentYear.find(
              (val) => val.jurnal_gl_account == 194
            )?._sum.jurnal_nominal || 0
          ),
        },
      ];

      const totalPiutang2024 = santunanSembakoPreviousYear
        .filter((item) => piutangData.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenerimaanDanaZakat2024 = santunanSembakoPreviousYear
        .filter((item) => penerimaanDanaZakat.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenerimaanZakatNonDonatur2024 = santunanSembakoPreviousYear
        .filter((item) => penerimaanNonDonatur.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenyaluranFakir2024 = santunanSembakoPreviousYear
        .filter((item) => totalFakirMiskin.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalZakatGharimin2024 = santunanSembakoPreviousYear
        .filter((item) => totalGharimin.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalZakatMualaf2024 = santunanSembakoPreviousYear
        .filter((item) => totalMualaf.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalZakatFisabilillah2024 = santunanSembakoPreviousYear
        .filter((item) => totalFisabilillah.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalZakatIbnu2024 = santunanSembakoPreviousYear
        .filter((item) => totalIbnu.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalInfakTerikatDonatur2024 = santunanSembakoPreviousYear
        .filter((item) => totalInfakDonatur.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalInfakTidakDonatur2024 = santunanSembakoPreviousYear
        .filter((item) => infakTidakDonatur.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenerimaanInfakNonDonatur2024 = santunanSembakoPreviousYear
        .filter((item) =>
          penerimaanTidakDonatur.includes(item.jurnal_gl_account)
        )
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenyaluranInfakTerikat2024 = santunanSembakoPreviousYear
        .filter((item) =>
          penyaluranInfakTerikat.includes(item.jurnal_gl_account)
        )
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenyaluranInfakTidakTerikat2024 = santunanSembakoPreviousYear
        .filter((item) =>
          penyaluranInfakTidakTerikat.includes(item.jurnal_gl_account)
        )
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenerimaanDanaAmil2024 = santunanSembakoPreviousYear
        .filter((item) => penerimaanDanaAmil.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenggunaanDanaAmil2024 = santunanSembakoPreviousYear
        .filter((item) => penggunaanDanaAmil.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const bagianamilzakat2024 = Number(
        santunanSembakoPreviousYear.filter(
          (val) => val.jurnal_gl_account == 219
        ).length > 0
          ? santunanSembakoPreviousYear.filter(
              (val) => val.jurnal_gl_account == 219
            )[0]._sum.jurnal_nominal
          : 0
      );

      const biayaPerolehanElektronik2024 = Number(
        santunanSembakoPreviousYear.filter(
          (val) => val.jurnal_gl_account == 194
        ).length > 0
          ? santunanSembakoPreviousYear.filter(
              (val) => val.jurnal_gl_account == 194
            )[0]._sum.jurnal_nominal
          : 0
      );
      const biayaPenyusutanElektronik2024 = Number(
        santunanSembakoPreviousYear.filter(
          (val) => val.jurnal_gl_account == 195
        ).length > 0
          ? santunanSembakoPreviousYear.filter(
              (val) => val.jurnal_gl_account == 195
            )[0]._sum.jurnal_nominal
          : 0
      );

      const totalPiutang2025 = santunanSembakoCurrentYear
        .filter((item) => piutangData.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenerimaanDanaZakat2025 = santunanSembakoCurrentYear
        .filter((item) => penerimaanDanaZakat.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenerimaanZakatNonDonatur2025 = santunanSembakoCurrentYear
        .filter((item) => penerimaanNonDonatur.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenyaluranFakir2025 = santunanSembakoCurrentYear
        .filter((item) => totalFakirMiskin.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalZakatGharimin2025 = santunanSembakoCurrentYear
        .filter((item) => totalGharimin.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalZakatMualaf2025 = santunanSembakoCurrentYear
        .filter((item) => totalMualaf.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalZakatFisabilillah2025 = santunanSembakoCurrentYear
        .filter((item) => totalFisabilillah.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalZakatIbnu2025 = santunanSembakoCurrentYear
        .filter((item) => totalIbnu.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalInfakTerikatDonatur2025 = santunanSembakoCurrentYear
        .filter((item) => totalInfakDonatur.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalInfakTidakDonatur2025 = santunanSembakoCurrentYear
        .filter((item) => infakTidakDonatur.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenerimaanInfakNonDonatur2025 = santunanSembakoCurrentYear
        .filter((item) =>
          penerimaanTidakDonatur.includes(item.jurnal_gl_account)
        )
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenyaluranInfakTerikat2025 = santunanSembakoCurrentYear
        .filter((item) =>
          penyaluranInfakTerikat.includes(item.jurnal_gl_account)
        )
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenyaluranInfakTidakTerikat2025 = santunanSembakoCurrentYear
        .filter((item) =>
          penyaluranInfakTidakTerikat.includes(item.jurnal_gl_account)
        )
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenerimaanDanaAmil2025 = santunanSembakoCurrentYear
        .filter((item) => penerimaanDanaAmil.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const totalPenggunaanDanaAmil2025 = santunanSembakoCurrentYear
        .filter((item) => penggunaanDanaAmil.includes(item.jurnal_gl_account))
        .reduce((acc, item) => acc + (item._sum.jurnal_nominal || 0), 0);

      const bagianamilzakat2025 = Number(
        santunanSembakoCurrentYear.filter((val) => val.jurnal_gl_account == 219)
          .length > 0
          ? santunanSembakoCurrentYear.filter(
              (val) => val.jurnal_gl_account == 219
            )[0]._sum.jurnal_nominal
          : 0
      );
      const biayaPerolehanElektronik2025 = Number(
        santunanSembakoCurrentYear.filter((val) => val.jurnal_gl_account == 194)
          .length > 0
          ? santunanSembakoCurrentYear.filter(
              (val) => val.jurnal_gl_account == 194
            )[0]._sum.jurnal_nominal
          : 0
      );
      const biayaPenyusutanElektronik2025 = Number(
        santunanSembakoCurrentYear.filter((val) => val.jurnal_gl_account == 195)
          .length > 0
          ? santunanSembakoCurrentYear.filter(
              (val) => val.jurnal_gl_account == 195
            )[0]._sum.jurnal_nominal
          : 0
      );

      calkData.push({
        name: "Total Piutang 2024",
        value: totalPiutang2024,
      });

      calkData.push({
        name: "Total Piutang 2025",
        value: totalPiutang2025,
      });

      calkData.push({
        name: "Total Penerimaan Dana Zakat 2024",
        value: totalPenerimaanDanaZakat2024,
      });

      calkData.push({
        name: "Total Penerimaan Dana Zakat 2025",
        value: totalPenerimaanDanaZakat2025,
      });

      calkData.push({
        name: "Total Penerimaan Dana Zakat NonDonatur 2024",
        value: totalPenerimaanZakatNonDonatur2024,
      });

      calkData.push({
        name: "Total Penerimaan Dana Zakat NonDonatur 2025",
        value: totalPenerimaanZakatNonDonatur2025,
      });

      calkData.push({
        name: "Total Fakir 2024",
        value: totalPenyaluranFakir2024,
      });

      calkData.push({
        name: "Total Fakir 2025",
        value: totalPenyaluranFakir2025,
      });

      calkData.push({
        name: "Total Gharimin 2024",
        value: totalZakatGharimin2024,
      });

      calkData.push({
        name: "Total Gharimin 2025",
        value: totalZakatGharimin2025,
      });

      calkData.push({
        name: "Total Mualaf 2024",
        value: totalZakatMualaf2024,
      });

      calkData.push({
        name: "Total Mualaf 2025",
        value: totalZakatMualaf2025,
      });

      calkData.push({
        name: "Total Fisabilillah 2024",
        value: totalZakatFisabilillah2024,
      });

      calkData.push({
        name: "Total Fisabilillah 2025",
        value: totalZakatFisabilillah2025,
      });

      calkData.push({
        name: "Total Ibnu Sabil 2024",
        value: totalZakatIbnu2024,
      });

      calkData.push({
        name: "Total Ibnu Sabil 2025",
        value: totalZakatIbnu2025,
      });

      calkData.push({
        name: "Total Infak Terikat Donatur 2024",
        value: totalInfakTerikatDonatur2024,
      });

      calkData.push({
        name: "Total Infak Terikat Donatur 2025",
        value: totalInfakTerikatDonatur2025,
      });

      calkData.push({
        name: "Total Infak Tidak Donatur 2024",
        value: totalInfakTidakDonatur2024,
      });

      calkData.push({
        name: "Total Infak Tidak Donatur 2025",
        value: totalInfakTidakDonatur2025,
      });

      calkData.push({
        name: "Total Penerimaan Infak Non Donatur 2024",
        value: totalPenerimaanInfakNonDonatur2024,
      });

      calkData.push({
        name: "Total Penerimaan Infak Non Donatur 2025",
        value: totalPenerimaanInfakNonDonatur2025,
      });

      calkData.push({
        name: "Total Penyaluran Infak Terikat 2024",
        value: totalPenyaluranInfakTerikat2024,
      });

      calkData.push({
        name: "Total Penyaluran Infak Terikat 2025",
        value: totalPenyaluranInfakTerikat2025,
      });

      calkData.push({
        name: "Total Penyaluran Infak Tidak Terikat 2024",
        value: totalPenyaluranInfakTidakTerikat2024,
      });

      calkData.push({
        name: "Total Penyaluran Infak Tidak Terikat 2025",
        value: totalPenyaluranInfakTidakTerikat2025,
      });

      calkData.push({
        name: "Total Penerimaan Amil 2024",
        value: totalPenerimaanDanaAmil2024,
      });

      calkData.push({
        name: "Total Penerimaan Amil 2025",
        value: totalPenerimaanDanaAmil2025,
      });

      calkData.push({
        name: "Total Penggunaan Dana Amil 2024",
        value: totalPenggunaanDanaAmil2024,
      });

      calkData.push({
        name: "Total Penggunaan Dana Amil 2025",
        value: totalPenggunaanDanaAmil2025,
      });

      const totalPenerimaanZakat2024 =
        totalPenerimaanDanaZakat2024 + totalPenerimaanZakatNonDonatur2024;

      const totalPenerimaanZakat2025 =
        totalPenerimaanDanaZakat2025 + totalPenerimaanZakatNonDonatur2025;

      const totalPenerimaanInfak2024 =
        totalInfakTerikatDonatur2024 +
        totalInfakTidakDonatur2024 +
        totalPenerimaanInfakNonDonatur2024;

      const totalPenerimaanInfak2025 =
        totalInfakTerikatDonatur2025 +
        totalInfakTidakDonatur2025 +
        totalPenerimaanInfakNonDonatur2025;

      const totalPenyaluranInfak2024 =
        totalPenyaluranInfakTerikat2024 + totalPenyaluranInfakTidakTerikat2024;

      const totalPenyaluranInfak2025 =
        totalPenyaluranInfakTerikat2025 + totalPenyaluranInfakTidakTerikat2025;

      const totalZakat2024 =
        totalPenyaluranFakir2024 +
        totalZakatGharimin2024 +
        totalZakatMualaf2024 +
        totalZakatFisabilillah2024 +
        bagianamilzakat2024 +
        totalZakatIbnu2024;

      const nilaiBuku2024 =
        biayaPerolehanElektronik2024 - biayaPenyusutanElektronik2024;

      const nilaiBuku2025 =
        biayaPerolehanElektronik2025 - biayaPenyusutanElektronik2025;

      const totalZakat2025 =
        totalPenyaluranFakir2025 +
        totalZakatGharimin2025 +
        totalZakatMualaf2025 +
        totalZakatFisabilillah2025 +
        bagianamilzakat2025 +
        totalZakatIbnu2025;

      calkData.push({
        name: "Total Keseluruhan 2024",
        value: totalZakat2024,
      });

      calkData.push({
        name: "Total Keseluruhan 2025",
        value: totalZakat2025,
      });

      calkData.push({
        name: "Total Penerimaan Zakat 2024",
        value: totalPenerimaanZakat2024,
      });

      calkData.push({
        name: "Total Penerimaan Zakat 2025",
        value: totalPenerimaanZakat2025,
      });

      calkData.push({
        name: "Total Penerimaan Infak 2024",
        value: totalPenerimaanInfak2024,
      });

      calkData.push({
        name: "Total Penerimaan Infak 2025",
        value: totalPenerimaanInfak2025,
      });

      calkData.push({
        name: "Total Penyaluran Infak 2024",
        value: totalPenyaluranInfak2024,
      });

      calkData.push({
        name: "Total Penyaluran Infak 2025",
        value: totalPenyaluranInfak2025,
      });
      calkData.push({
        name: "Nilai Buku 2024",
        value: nilaiBuku2024,
      });
      calkData.push({
        name: "Nilai Buku 2025",
        value: nilaiBuku2025,
      });

      console.log(JSON.stringify(calkData));
      res.json(calkData);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
  async getEndBalance(req, res) {
    try {
      let accountNumbers = [
        "103-00-9526589-4",
        "103-00-9526546-4",
        "103-00-0500055-5",
        "7015.734.188",
        "7015.738.876",
        "7015.740.307",
        "7015.742.644",
        "8001516176",
        "99999.1111.8",
        "99999.3333.2",
        "7100922503",
        "9999987874",
        "7771110171",
        "7112454009",
        "5551002006",
        "3331002002",
        "1111002009",
      ];

      accountNumbers = accountNumbers.map((acc) => acc.replace(/\D/g, ""));

      // Default bulan = Januari (1), tahun = tahun sekarang - 1 jika tidak ada query
      const selectedMonth = parseInt(req.query.month) || 2;
      const currentYear = new Date().getFullYear();
      const selectedYear =
        req.query.year !== undefined
          ? parseInt(req.query.year) // Jika ada query, gunakan tahun dari query
          : currentYear; // Jika tidak ada query, gunakan tahun sekarang

      const years = [selectedYear, selectedYear - 1]; // Tahun utama & tahun sebelumnya

      console.log("Current Year:", currentYear);
      console.log("Selected Year:", selectedYear);
      console.log("Years:", years);

      const endDate = new Date(selectedYear, selectedMonth, 0); // Akhir bulan yang dipilih

      // --- Query untuk saldo berdasarkan tahun ---
      const pettyCashInitial = 3000000;
      const saldoByYear = {};

      for (const year of years) {
        const journalBeforeCutoff = await prisma.jurnal.findMany({
          where: { glaccount: 283, datetime: new Date(year, 0, 1) },
          select: { amount_debit: true },
        });

        let saldoAwal =
          pettyCashInitial -
          journalBeforeCutoff.reduce((acc, item) => acc + item.amount_debit, 0);

        const journalEntriesJurnal = await prisma.jurnal.findMany({
          where: {
            glaccount: 283,
            isdebit: 1,
            datetime: { gte: new Date(year, 0, 1), lte: endDate },
          },
          select: { amount_debit: true },
        });

        const journalEntriesJurnalLK = await prisma.jurnal_lk.findMany({
          where: {
            jurnal_gl_account: 283,
            jurnal_isdebit: 1,
            jurnal_tanggal: { gte: new Date(year, 0, 1), lte: endDate },
          },
          select: { jurnal_nominal: true },
        });

        let saldoBerjalan =
          saldoAwal +
          journalEntriesJurnal.reduce(
            (acc, item) => acc + item.amount_debit,
            0
          ) +
          journalEntriesJurnalLK.reduce(
            (acc, item) => acc + item.jurnal_nominal,
            0
          );

        const pettyCashRequests = await prisma.pettycash_request.findMany({
          where: {
            request_date: { gte: new Date(year, 0, 1), lte: endDate },
          },
          select: { amount: true },
        });

        let saldoAkhir =
          saldoBerjalan -
          pettyCashRequests.reduce((acc, item) => acc + item.amount, 0);

        saldoByYear[year] = {
          saldo_awal: saldoAwal.toFixed(2).toString(),
          saldo_berjalan: saldoBerjalan.toFixed(2).toString(),
          saldo_akhir: saldoAkhir.toFixed(2).toString(),
        };
      }

      res.status(200).json({
        message: `Sukses Ambil Data End Balance untuk bulan ${selectedMonth} (tahun ${years.join(
          " & "
        )})`,
        [`saldo_${years[0]}`]: saldoByYear[years[0]],
        [`saldo_${years[1]}`]: saldoByYear[years[1]],
      });
    } catch (error) {
      console.error("🔴 Error:", error.message);
      res.status(500).json({ message: error.message });
    }
  },

  async getEbBank(req, res) {
    try {
      let accountNumbers = [
        "103-00-9526589-4",
        "103-00-9526546-4",
        "103-00-0500055-5",
        "7015.734.188",
        "7015.738.876",
        "7015.740.307",
        "7015.742.644",
        "8001516176",
        "99999.1111.8",
        "99999.3333.2",
        "7100922503",
        "9999987874",
        "7771110171",
        "7112454009",
        "5551002006",
        "3331002002",
        "1111002009",
      ];

      accountNumbers = accountNumbers.map((acc) => acc.replace(/\D/g, ""));

      const selectedYear = parseInt(req.query.year) || new Date().getFullYear();
      const selectedMonth = parseInt(req.query.month) || 1;
      const years = [selectedYear - 1, selectedYear];
      const endDate = new Date(selectedYear, selectedMonth, 0); // Akhir bulan yang dipilih

      const allData = await prisma.ebs_staging.findMany({
        where: {
          account_number: { in: accountNumbers },
          bank_date: {
            gte: new Date(years[0], selectedMonth - 1, 1),
            lte: endDate,
          },
        },
        select: { account_number: true, eb_amount: true, bank_date: true },
        orderBy: { bank_date: "asc" },
      });

      const filteredData = allData.filter(
        (item) => new Date(item.bank_date).getMonth() + 1 === selectedMonth
      );

      const dataByYear = { [years[0]]: {}, [years[1]]: {} };
      let totalBankPrevYear = 0;
      let totalBankSelectedYear = 0;

      filteredData.forEach((item) => {
        const year = new Date(item.bank_date).getFullYear();
        const accountNum = item.account_number.replace(/\D/g, "");
        if (
          !dataByYear[year][accountNum] ||
          new Date(item.bank_date) >
            new Date(dataByYear[year][accountNum].bank_date)
        ) {
          dataByYear[year][accountNum] = {
            account_number: accountNum,
            year,
            eb_amount: item.eb_amount.toString(),
            bank_date: item.bank_date,
          };
        }
      });

      accountNumbers.forEach((accNum) => {
        years.forEach((year) => {
          if (!dataByYear[year][accNum]) {
            dataByYear[year][accNum] = {
              account_number: accNum,
              year,
              eb_amount: "0",
              bank_date: null,
            };
          }
        });
      });

      Object.values(dataByYear[years[0]]).forEach((item) => {
        totalBankPrevYear += parseFloat(item.eb_amount) || 0;
      });
      Object.values(dataByYear[years[1]]).forEach((item) => {
        totalBankSelectedYear += parseFloat(item.eb_amount) || 0;
      });

      const formattedTotalBankPrevYear = totalBankPrevYear
        .toFixed(2)
        .toString();
      const formattedTotalBankSelectedYear = totalBankSelectedYear
        .toFixed(2)
        .toString();

      const resultPrevYear = Object.values(dataByYear[years[0]]).sort(
        (a, b) =>
          accountNumbers.indexOf(a.account_number) -
          accountNumbers.indexOf(b.account_number)
      );

      const resultSelectedYear = Object.values(dataByYear[years[1]]).sort(
        (a, b) =>
          accountNumbers.indexOf(a.account_number) -
          accountNumbers.indexOf(b.account_number)
      );

      const result = [
        ...resultPrevYear,
        ...resultSelectedYear,
        {
          [`total_bank_${years[0]}`]: formattedTotalBankPrevYear,
          [`total_bank_${years[1]}`]: formattedTotalBankSelectedYear,
        },
      ];

      res.status(200).json({
        message: `Sukses Ambil Data End Balance untuk bulan ${selectedMonth} (tahun ${years.join(
          " & "
        )})`,
        data: result,
      });
    } catch (error) {
      console.error("🔴 Error:", error.message);
      res.status(500).json({ message: error.message });
    }
  },

  async getEbBankWithPagination(req, res) {
    try {
      let accountNumbers = [
        "103-00-9526589-4",
        "103-00-9526546-4",
        "103-00-0500055-5",
        "7015.734.188",
        "7015.738.876",
        "7015.740.307",
        "7015.742.644",
        "8001516176",
        "99999.1111.8",
        "99999.3333.2",
        "7100922503",
        "9999987874",
        "7771110171",
        "7112454009",
        "5551002006",
        "3331002002",
        "1111002009",
      ];
      accountNumbers = accountNumbers.map((acc) => acc.replace(/\D/g, ""));

      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

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

      const selectedYear = validStart.getFullYear();

      const allData = await prisma.ebs_staging.findMany({
        where: {
          account_number: { in: accountNumbers },
          bank_date: {
            gte: validStart,
            lte: validEnd,
          },
        },
        select: {
          account_number: true,
          eb_amount: true,
          ob_amount: true,
          bank_date: true,
          trans_amount: true,
          trans_id: true,
        },
        orderBy: { bank_date: "asc" },
      });

      const dataByAccount = {};
      const debitCredit = {};
      let totalBank = 0;
      let totalOB = 0;

      allData.forEach((item) => {
        const accountNum = item.account_number.replace(/\D/g, "");
        const amount = Math.abs(parseFloat(item.trans_amount)) || 0; // <--- perbedaan disini

        if (!debitCredit[accountNum]) {
          debitCredit[accountNum] = {
            total_debit: 0,
            total_credit: 0,
          };
        }

        if (item.trans_id === "D") {
          debitCredit[accountNum].total_debit += amount;
        } else if (item.trans_id === "C") {
          debitCredit[accountNum].total_credit += amount;
        }

        if (
          !dataByAccount[accountNum] ||
          new Date(item.bank_date) >
            new Date(dataByAccount[accountNum].bank_date)
        ) {
          dataByAccount[accountNum] = {
            account_number: accountNum,
            year: selectedYear,
            eb_amount: item.eb_amount?.toString() || "0",
            ob_amount: item.ob_amount?.toString() || "0",
            bank_date: item.bank_date,
          };
        }
      });

      accountNumbers.forEach((accNum) => {
        if (!dataByAccount[accNum]) {
          dataByAccount[accNum] = {
            account_number: accNum,
            year: selectedYear,
            eb_amount: "0",
            ob_amount: "0",
            bank_date: null,
          };
        }

        const debit = debitCredit[accNum]?.total_debit || 0;
        const credit = debitCredit[accNum]?.total_credit || 0;

        dataByAccount[accNum].total_debit = debit.toFixed(2);
        dataByAccount[accNum].total_credit = credit.toFixed(2);

        totalBank += parseFloat(dataByAccount[accNum].eb_amount) || 0;
        totalOB += parseFloat(dataByAccount[accNum].ob_amount) || 0;
      });

      const result = Object.values(dataByAccount).sort(
        (a, b) =>
          accountNumbers.indexOf(a.account_number) -
          accountNumbers.indexOf(b.account_number)
      );

      const paginated = result.slice(skip, skip + limit);

      res.status(200).json({
        message: `Sukses Ambil Data End Balance dan Opening Balance`,
        data: {
          items: paginated,
          total: result.length,
          total_bank: totalBank.toFixed(2),
          total_ob: totalOB.toFixed(2),
          page,
          limit,
          totalPages: Math.ceil(result.length / limit),
        },
      });
    } catch (error) {
      console.error("🔴 Error:", error.message);
      res.status(500).json({ message: error.message });
    }
  },

  async createPosting(req, res) {
    try {
      let { month, year } = req.body;
      const userId = req.user_id;

      // Pastikan month dan year diubah menjadi integer
      month = parseInt(month, 10);
      year = parseInt(year, 10);

      if (!month || !year) {
        return res.status(400).json({ message: "Month and year are required" });
      }

      // 🔹 Ambil period terakhir (anggap ini periode aktif)
      const activePeriod = await prisma.period.findFirst({
        orderBy: { id: "desc" },
      });

      if (!activePeriod) {
        return res.status(400).json({
          message: "Data period tidak ditemukan, posting tidak bisa dilakukan",
        });
      }

      const { from_period, to_period, from_year, to_year } = activePeriod;

      // 🔹 Validasi apakah bulan & tahun request ada dalam range periode aktif
      const isValidPeriod =
        (year > from_year ||
          (year === from_year && month >= parseInt(from_period))) &&
        (year < to_year || (year === to_year && month <= parseInt(to_period)));

      if (!isValidPeriod) {
        return res.status(400).json({
          message: `Posting hanya diperbolehkan antara periode ${from_period}/${from_year} sampai ${to_period}/${to_year}`,
        });
      }

      const accountMapping = {
        25: "5022100020",
        28: "5022100050",
        24: "5022100010",
        26: "5022100030",
        27: "5022100040",
        29: "5022200010",
        30: "5022200020",
        31: "5022200030",
        32: "5022200040",
        33: "5022300010",
        34: "5022300020",
        35: "5022300030",
        36: "5022400010",
        37: "5022400020",
        38: "5022500010",
        39: "5022500020",
        40: "5022500030",
        41: "5022500040",
        42: "5023100010",
        56: "5060000010",
        240: "1071000010",
        241: "1072000010",
        242: "1073000010",
        243: "1074000010",
        244: "1075000010",
        196: "4011000010",
        197: "4011000020",
        198: "4011000030",
        199: "4011000040",
        200: "4011000050",
        201: "4012000010",
        202: "4012000020",
        203: "4012000030",
        204: "4012000040",
        43: "5023100010",
        44: "5024000010",
        45: "5024000020",
        46: "5025000010",
        47: "5025000020",
        48: "5025000030",
        49: "5025000040",
        50: "5025000050",
        51: "5025000060",
        52: "5025000070",
        53: "5026000010",
        54: "5026000020",
        205: "4021000010",
        207: "4021000030",
        208: "4022000010",
        209: "4022000020",
        210: "4022000030",
        211: "4022000040",
        212: "4022000050",
        213: "4022000060",
        214: "4022000070",
        215: "4022000080",
        217: "4023000020",
        218: "4023000030",
        62: "5031000010",
        222: "5031000020",
        223: "5031000030",
        224: "5031000040",
        55: "5032000090",
        58: "5032000010",
        59: "5032000020",
        60: "5032000030",
        228: "5032000070",
        229: "5032000080",
        219: "4030000010",
        220: "4030000020",
        221: "4030000030",
        63: "5010000010",
        66: "5010000020",
        230: "5010000030",
        231: "5010000040",
        64: "5010000050",
        67: "5010000060",
        232: "5010000070",
        233: "5010000080",
        235: "5010000100",
        234: "5010000090",
        189: "1020000010",
        190: "1020000020",
        191: "1020000030",
        192: "1020000040",
        193: "1020000050",
        364: "5010000110",
        365: "1050000000",
        194: "1031000010",
        195: "1032000010",
      };

      // 🔹 Ambil transaksi bulan yg diminta
      const transactions = await prisma.jurnal_lk.groupBy({
        by: ["jurnal_gl_account"],
        where: {
          jurnal_tanggal: {
            gte: new Date(`${year}-${String(month).padStart(2, "0")}-01`),
            lt: new Date(`${year}-${String(month).padStart(2, "0")}-31`),
          },
        },
        _sum: { jurnal_nominal: true },
      });

      let insertData = [];

      for (let [accountKey, accountNumber] of Object.entries(accountMapping)) {
        const transaction = transactions.find(
          (txn) => txn.jurnal_gl_account === parseInt(accountKey)
        );

        const totalTransaction = transaction
          ? transaction._sum.jurnal_nominal || 0
          : 0;

        // 🔹 Ambil saldo bulan sebelumnya
        const prevMonth = month - 1 === 0 ? 12 : month - 1;
        const prevYear = month - 1 === 0 ? year - 1 : year;

        const previousData = await prisma.posting.findFirst({
          where: {
            account: accountNumber,
            year: prevYear,
            period: String(prevMonth).padStart(2, "0"),
          },
          orderBy: { last_change: "desc" },
        });

        const beginningBalance = previousData ? previousData.ending_balance : 0;
        const endingBalance = beginningBalance + totalTransaction;

        insertData.push({
          account: accountNumber,
          year,
          period: String(month).padStart(2, "0"),
          currency: "IDR",
          beginning_balance: beginningBalance,
          total_transaction: totalTransaction,
          ending_balance: endingBalance,
          last_change: new Date(),
          changes_by: userId,
          gla_id: parseInt(accountKey),
        });
      }

      if (insertData.length > 0) {
        await prisma.posting.createMany({ data: insertData });
      }

      return res.status(200).json({
        message: "Sukses menyimpan data posting",
        data: insertData,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async getPosting(req, res) {
    try {
      // Ambil query parameters
      const { month, year } = req.query;

      // Tahun sekarang dan tahun sebelumnya
      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;

      // Default nilai jika tidak ada filter
      const parsedYear = year ? parseInt(year) : currentYear;
      const parsedMonth = month ? month.toString() : "02";

      // Construct where clause
      const whereClause = {
        year: { in: [parsedYear - 1, parsedYear] }, // Tahun sekarang dan sebelumnya
        period: parsedMonth, // Default bulan Januari jika tidak ada filter
      };

      // Ambil data berdasarkan query
      const periodData = await prisma.posting.findMany({
        where: whereClause,
      });

      if (periodData.length === 0) {
        return res.status(404).json({
          message: "No data found in the posting table",
        });
      }

      // Kelompokkan data berdasarkan year dan period
      const groupedData = periodData.reduce((acc, item) => {
        const key = `${item.year}-${item.period}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(item);
        return acc;
      }, {});

      // Hitung summary ending_balance per periode
      const summaryPerPeriod = Object.keys(groupedData).map((key) => {
        const [year, period] = key.split("-");
        const items = groupedData[key];

        // Perhitungan kategori gla_id
        const calculateTotal = (glaIds) =>
          items
            .filter((item) => glaIds.includes(item.gla_id))
            .reduce((sum, item) => sum + item.ending_balance, 0);

        const totalEndingBalancePiutang = calculateTotal([
          189, 190, 191, 192, 193,
        ]);
        const totalPenerimaanDanaZakat = calculateTotal([
          196, 197, 198, 199, 200,
        ]);
        const totalPenerimaanDanaZakatNonDonatur = calculateTotal([
          201, 202, 203, 204,
        ]);
        const totalPenyaluranFakir = calculateTotal([
          24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
          41,
        ]);
        const totalGharimin = calculateTotal([42, 43]);
        const totalZakatMualaf = calculateTotal([44, 45]);
        const totalZakatFisabilillah = calculateTotal([
          46, 47, 48, 49, 50, 51, 52,
        ]);
        const totalZakatIbnu = calculateTotal([53, 53]);
        const totalInfakTerikatDonatur = calculateTotal([205, 207]);
        const totalInfakTidakTerikatDonatur = calculateTotal([
          208, 209, 210, 211, 212, 213, 214, 215,
        ]);
        const totalPenerimaanInfakNonDonatur = calculateTotal([201, 217, 203]);
        const totalPenyaluranInfakTerikat = calculateTotal([62, 222, 223, 224]);
        const totalPenyaluranInfakTidakTerikat = calculateTotal([
          55, 58, 59, 60, 228, 229,
        ]);
        const totalPenerimaanDanaAmil = calculateTotal([219, 220, 221]);
        const totalPenggunaanDanaAmil = calculateTotal([
          63, 66, 230, 231, 64, 67, 232, 233, 234, 235, 364,
        ]);
        const bagianAmilZakat = calculateTotal([219]);
        const biayaPerolehanElektronik = calculateTotal([194]);
        const biayaPenyusutanElektronik = calculateTotal([195]);

        // Perhitungan tambahan
        const nilaiBuku = biayaPerolehanElektronik - biayaPenyusutanElektronik;
        const totalPenerimaanZakat =
          totalPenerimaanDanaZakat + totalPenerimaanDanaZakatNonDonatur;
        const totalPenerimaanInfak =
          totalInfakTerikatDonatur +
          totalInfakTidakTerikatDonatur +
          totalPenerimaanInfakNonDonatur;
        const totalPenyaluranInfak =
          totalPenyaluranInfakTerikat + totalPenyaluranInfakTidakTerikat;
        const totalZakat =
          totalPenyaluranFakir +
          totalGharimin +
          totalZakatMualaf +
          totalZakatFisabilillah +
          bagianAmilZakat +
          totalZakatIbnu;

        return {
          year: parseInt(year),
          period: period,
          totalEndingBalancePiutang,
          totalPenerimaanDanaZakat,
          totalPenerimaanDanaZakatNonDonatur,
          totalPenyaluranFakir,
          totalGharimin,
          totalZakatMualaf,
          totalZakatFisabilillah,
          totalZakatIbnu,
          totalInfakTerikatDonatur,
          totalInfakTidakTerikatDonatur,
          totalPenerimaanInfakNonDonatur,
          totalPenyaluranInfakTerikat,
          totalPenyaluranInfakTidakTerikat,
          totalPenerimaanDanaAmil,
          totalPenggunaanDanaAmil,
          totalPenerimaanZakat,
          totalPenerimaanInfak,
          totalPenyaluranInfak,
          totalZakat,
          nilaiBuku,
        };
      });

      return res.status(200).json({
        message: "Data found in the posting table",
        data: periodData,
        summaryPerPeriod,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },
};
