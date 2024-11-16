const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");

const { customAlphabet } = require("nanoid");
const { z } = require("zod");


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
              report_gl_account: {
                connect: {
                  id: Number(report_gl_account),
                },
              },
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
  
}