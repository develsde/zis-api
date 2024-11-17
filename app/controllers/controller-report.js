const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");

const { customAlphabet } = require("nanoid");
const { z } = require("zod");
const readXlsxFile = require('read-excel-file/node')


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
            report_penerimaan_bank_account_ziswaf_id
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
              report_penerimaan_bank_account_ziswaf_id
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
            mutasi_tanggal_transaksi
          } = req.body;
    
          //console.log(JSON.stringify(req.body))
    
          const createMutasi = await prisma.mutasi.create({
            data: {              
                mutasi_bank_code,
                mutasi_deskripsi,
                mutasi_currency : Number(mutasi_currency),
                mutasi_amount : Number(mutasi_amount),
                mutasi_isdebit : Number(mutasi_isdebit),
                mutasi_balance : Number(mutasi_balance),
                mutasi_bank_account_id : Number(mutasi_bank_account_id),
                mutasi_tanggal_transaksi
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
                id: true
              },
              where: {
                mutasi_file_name: { contains: file.originalname }
              },
            })
          ])
    
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
          const array_of_allowed_files = ['xlsx', 'xls'];
    
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
            mutasi_file_name,
            mutasi_file_bank_account_id,
            mutasi_file_bulan            
          } = req.body;
    
          //console.log(JSON.stringify(req.body))
    
          const resultUploaded = await prisma.mt_file.create({
            data: {
              mutasi_file_name: `${file.filename}`,              
              mutasi_file_bank_account_id: Number(mutasi_file_bank_account_id),
              mutasi_file_bulan: Number(mutasi_file_bulan)              
            },
          });
    
          return res.status(200).json({
            message: "Sukses Upload",
            data: resultUploaded
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
    
          const { mutasi_bank_code } = req.body
    
          let dataTrans = [];
          const dataexcel = await readXlsxFile('uploads/' + filename).then((rows) => {
    
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
    
          })
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


}