const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");

const { customAlphabet } = require("nanoid");
const { z } = require("zod");

module.exports = {
    
      async jurnalPerintahBayar(req, res) {
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
            OR : [
              { proposal: {
                nama: {
                    contains: keyword
                }
              }},     
              {
                deskripsi:{
                  contains: keyword
                }
              },
              { program: {
                program_title: {
                    contains: keyword
                }
              }}, 
            ]        
          };
    
          const [count, gla] = await prisma.$transaction([
            prisma.jurnal.count({
              where: params,
            }),
            prisma.jurnal.findMany({
              include:{
                proposal:true,
                program:true,
                jurnal_category: true,
                proposal: true,
                petty_cash: true
              },
              orderBy: {
                [sortBy]: sortType,
              },
              where: params,         
              skip,
              take: perPage,
            }),
          ]);
    
          const glResult = await Promise.all(
            gla.map(async (item) => {
              
    
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
    
            data: glResult,
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
          //const userId = req.user_id;
                    
          const {
            glaccount,
            deskripsi,
            jurnal_category_id,
            iscredit,
            isdebit,
            amount_credit,
            amount_debit,
            transaction_proposal_id,
            transaction_petty_cast_id,
            transaction_muzaki_id,
            transaction_mustahiq_id
          } = req.body;
    
          //console.log(JSON.stringify(req.body))
            
          const glResult = await prisma.jurnal.create({
            data: {
              gl_account: {
                connect: {
                  id: Number(glaccount),
                },
              },              
              deskripsi,
              jurnal_category: {
                connect: {
                  id: Number(jurnal_category_id),
                },
              },
              iscredit,
              isdebit,
              amount_credit,
              amount_debit,
              transaction_proposal_id,
              transaction_petty_cast_id,
              transaction_muzaki_id,
              transaction_mustahiq_id
            },
          });
    
          return res.status(200).json({
            message: "Sukses",
            data: glResult,
          });
        } catch (error) {
              
          return res.status(500).json({
            message: "Internal Server Error",
            error: error.message,
          });
        }
      },
  
}