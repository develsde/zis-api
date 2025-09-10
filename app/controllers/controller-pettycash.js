const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");

const { customAlphabet } = require("nanoid");
const { z } = require("zod");

let dateData = new Date();

module.exports = {
  async HeadPettyCash(req, res) {
    try {
      //const userId = req.user_id;

      const ptc = await prisma.pettycash.findMany({

      });

      if (!ptc) {
        return res.status(404).json({
          message: "Province tidak ditemukan",
        });
      }



      return res.status(200).json({
        message: "Sukses",
        data: ptc,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  async allPettyCash(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 4);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "request_date";
      const sortType = req.query.order || "desc";

      const params = {
        deskripsi: {
          contains: keyword,
        },
        status: {
          not: 2
        }
      };

      const [count, gla] = await prisma.$transaction([
        prisma.pettycash_request.count({
          where: params,
        }),
        prisma.pettycash_request.findMany({
          // include:{
          //   gl_account_type:true
          // },
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

  async createGlAccount(req, res) {
    try {
      const userId = req.user_id;

      const {
        coa,
        description,
        gl_account,
        gl_group,
        gl_name,
        status,
        gl_type
      } = req.body;

      //console.log(JSON.stringify(req.body))

      const glResult = await prisma.gl_account.create({
        data: {
          gl_account_type: {
            connect: {
              id: Number(gl_type),
            },
          },
          coa,
          description,
          gl_account,
          gl_group,
          gl_name,
          status
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
  async topUpPettyCash(req, res) {
    try {
      const id = 1;

      const {
        amount
      } = req.body;


      if (!amount) {
        return res.status(404).json({
          message: "Amount Harus Diisi"
        });
      }

      const ptsh = await prisma.pettycash.findUnique({
        where: {
          id: 1
        }
      });

      if (Number(ptsh.amount) + Number(amount) > 3000000) {
        return res.status(404).json({
          message: "Melebihi Batas Top Up"
        });
      }

      const glResult = await prisma.pettycash.update({
        where: {
          id: Number(id),
        },
        data: {
          amount: Number(amount) + Number(ptsh.amount),
          updatetime: dateData.toISOString()
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
  async requestPtCash(req, res) {
    try {
      const userId = req.user_id;

      const {
        amount,
        description
      } = req.body;

      //console.log(JSON.stringify(req.body))



      const ptsh = await prisma.pettycash.findUnique({
        where: {
          id: 1
        }
      });

      if (Number(ptsh.amount) - Number(amount) < 0) {
        return res.status(404).json({
          message: "Nominal Tidak Cukup "
        });
      } else {

        const glResult = await prisma.pettycash_request.create({
          data: {
            user: {
              connect: {
                user_id: Number(userId),
              },
            },
            amount: Number(amount),
            deskripsi: description
          },
        });

        const updatePtC = await prisma.pettycash.update({
          where: {
            id: 1,
          },
          data: {
            amount: Number(ptsh.amount) - Number(amount),
            updatetime: dateData.toISOString()
          },
        });

        return res.status(200).json({
          message: "Sukses",
          data: glResult,
        });

      }


    } catch (error) {

      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },
  async allPettyCashRequest(req, res) {
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
        deskripsi: {
          contains: keyword,
        },
      };

      const [count, ptcr] = await prisma.$transaction([
        prisma.pettycash_request.count({
          where: params,
        }),
        prisma.pettycash_request.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      const ptcResult = await Promise.all(
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

        data: ptcResult,
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

  async deletePettyCashRequest(req, res) {
    try {
      const id = req.body.id;
      const amount = req.body.amount;

      const ptsh = await prisma.pettycash.findUnique({
        where: {
          id: 1
        }
      });

      await prisma.pettycash_request.update({
        where: {
          id: Number(id),
        },
        data: {
          status: 2
        }
      });

      const updatePtC = await prisma.pettycash.update({
        where: {
          id: 1,
        },
        data: {
          amount: Number(ptsh.amount) + Number(amount),
          updatetime: dateData.toISOString()
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Delete Data",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async updateGlAccount(req, res) {
    try {
      const id = req.params.id;

      const {
        coa,
        description,
        gl_account,
        gl_group,
        gl_name,
        status,
        gl_type
      } = req.body;

      //console.log(JSON.stringify(req.body))

      const glResult = await prisma.gl_account.update({
        where: {
          id: Number(id),
        },
        data: {
          gl_account_type: {
            connect: {
              id: Number(gl_type),
            },
          },
          coa,
          description,
          gl_account,
          gl_group,
          gl_name,
          status
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
  async settlementCreate(req, res) {
    try {

      const userId = req.user_id;
      const id = req.body.id;


      const file = req.file;
      if (!file) {
        return res.status(400).json({
          message: "File Bukti Transfer Tidak Boleh Kosong",
        });
      }

      const maxSize = 5000000;
      if (file.size > maxSize) {
        await fs.unlink(file.path);

        return res.status(400).json({
          message: "Ukuran File terlalu Besar",
        });
      }

      const array_of_allowed_files = ['png', 'jpg', 'jpeg', 'pdf'];
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
        evidence,
        path,
      } = req.body;

      //console.log(JSON.stringify(req.body))

      const glResult = await prisma.pettycash_request.update({
        where: {
          id: Number(id)
        },
        data: {
          evidence: `${file.filename}`,
          //path: `uploads/${file.filename}`,             
          status: 1
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
  async deleteGL(req, res) {
    try {
      const id = req.body.id;

      await prisma.gl_account.delete({
        where: {
          id: Number(id),
        }
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



  async masterbank(req, res) {
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
        bank_name: {
          contains: keyword,
        },
      };

      const [count, bank] = await prisma.$transaction([
        prisma.bank_account.count({
          where: params,
        }),
        prisma.bank_account.findMany({
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

  async createMasterBank(req, res) {
    try {

      const {
        bank_name,
        bank_number
      } = req.body;

      //console.log(JSON.stringify(req.body))

      const bankResult = await prisma.bank_account.create({
        data: {
          bank_name,
          bank_number
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: bankResult,
      });
    } catch (error) {

      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },
  async updateBank(req, res) {
    try {
      const id = req.params.id;

      const {
        bank_name,
        bank_number
      } = req.body;

      //console.log(JSON.stringify(req.body))

      const bankResult = await prisma.bank_account.update({
        where: {
          id: Number(id),
        },
        data: {
          bank_name,
          bank_number
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: bankResult,
      });
    } catch (error) {

      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },
  async deleteBank(req, res) {
    try {
      const id = req.body.id;

      await prisma.bank_account.delete({
        where: {
          id: Number(id),
        }
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
}