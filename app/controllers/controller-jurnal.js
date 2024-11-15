const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");

const { customAlphabet } = require("nanoid");
const { z } = require("zod");

module.exports = {
  async jurnalAll(req, res) {
    try {
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";

      const id = req.params.id;
  
      const params = {
        transaction_mustahiq_id: Number(id)
      };

      console.log(params)
  
      const [count, gla] = await prisma.$transaction([
        prisma.jurnal.count({
          where: params,
        }),
        prisma.jurnal.findMany({
          include: {
            proposal: {
              include: {
                user: {
                  include: {
                    mustahiq: true,
                  },
                },
              },
            },
            gl_account: true,
            jurnal_category: true,
            pettycash_request: true,
          },
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
        }),
      ]);
  
      const glResult = await Promise.all(
        gla.map(async (item) => {
          return {
            ...item,
            //program_target_amount: Number(item.program_target_amount),
            //total_donation: total_donation._sum.amount || 0,
          };
        })
      );
  
      res.status(200).json({
        message: "Sukses Ambil Data",
        data: glResult,
        pagination: {
          total: count,
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },
  
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
        OR: [
          {
            proposal: {
              nama: {
                contains: keyword,
              },
            },
          },
        ],
      };

      const [count, gla] = await prisma.$transaction([
        prisma.jurnal.count({
          where: params,
        }),
        prisma.jurnal.findMany({
          include: {
            // proposal:true,
            // program:true,
            // jurnal_category: true,
            // proposal: true,
            // petty_cash: true
            proposal: {
              include: {
                user: {
                  include: {
                    mustahiq: true,
                  },
                },
              },
            },
            gl_account: true,
            jurnal_category: true,
            pettycash_request: true,
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
            ...item,
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

  async jurnalListAll(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 4);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "desc";

      const params = {
        // OR: [
        //   {
        //     proposal: {
        //       nama: {
        //         contains: keyword,
        //       },
        //     },
        //   },
        // ],
      };

      const [count, gla] = await prisma.$transaction([
        prisma.jurnal.count({
          where: params,
        }),
        prisma.jurnal.findMany({
          include: {
            // proposal:true,
            // program:true,
            // jurnal_category: true,
            // proposal: true,
            // petty_cash: true
            // proposal: {
            //   include: {
            //     user: {
            //       include: {
            //         mustahiq: true,
            //       },
            //     },
            //   },
            // },
            gl_account: true,
            jurnal_category: true,
            pettycash_request: true,
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
            ...item,
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

  async jurnalCategory(req, res) {
    try {
      const result = await prisma.jurnal_category.findMany();

      return res.status(200).json({
        message: "Sukses",
        data: result,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
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
        transaction_mustahiq_id,
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
          proposal: {
            connect: {
              id: Number(transaction_proposal_id),
            },
          },

          // transaction_proposal_id,
          transaction_petty_cast_id,
          transaction_muzaki_id,
          transaction_mustahiq_id,
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

  async createJurnalPenerimaan(req, res) {
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
        transaction_mustahiq_id,
        transaction_program_id,
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
          // proposal: {
          //   connect: {
          //     id: Number(transaction_proposal_id),
          //   },
          // },

          // transaction_proposal_id,
          proposal: {
            connect: {
              id: Number(transaction_proposal_id),
            },
          },
          transaction_petty_cast_id,
          transaction_muzaki_id,
          transaction_mustahiq_id,
          transaction_program_id
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

  async createJurnalManual(req, res) {
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
        transaction_mustahiq_id,
        transaction_program_id,
      } = req.body;

      console.log(JSON.stringify(req.body))

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
          // proposal: {
          //   connect: {
          //     id: Number(transaction_proposal_id),
          //   },
          // },

          //transaction_proposal_id?,
          // proposal: {
          //   connect: {
          //     id: Number(transaction_proposal_id) == 0 || transaction_proposal_id == undefined?'':Number(transaction_proposal_id),
          //   },
          // },
          transaction_petty_cast_id,
          transaction_muzaki_id,
          transaction_mustahiq_id,
          transaction_program_id
        },
      });

      const glpeers = await prisma.jurnal.create({
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
          iscredit: Number(isdebit),
          isdebit: Number(iscredit),
          amount_credit: Number(amount_debit),
          amount_debit: Number(amount_credit),          
          transaction_petty_cast_id,
          transaction_muzaki_id,
          transaction_mustahiq_id,
          transaction_program_id
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


  async createJurnalPettyCash(req, res) {
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
        transaction_petty_cast_id,        
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
          amount_credit:Number(amount_credit),
          amount_debit:Number(amount_debit),         
          // transaction_proposal_id,
          transaction_petty_cast_id,          
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
};
