const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");

const { customAlphabet } = require("nanoid");
const { z } = require("zod");
const { checkImkas } = require("../helper/imkas");

module.exports = {
  async checkImkas(req, res) {
    try {
      const check = await checkImkas();
      console.log(check);
      const log = await prisma.log_vendor.create({
        data: {
          vendor_api: check?.config?.url,
          url_api: req.originalUrl,
          api_header: JSON.stringify(check.headers),
          api_body: check?.config?.data,
          api_response: JSON.stringify(check.data),
          payload: JSON.stringify(req.body),
        },
      });
      return res.status(200).json({
        message: "Sukses",
        data: check.data,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async provinces(req, res) {
    try {
      //const userId = req.user_id;

      const province = await prisma.provinces.findMany({

      });

      if (!province) {
        return res.status(404).json({
          message: "Province tidak ditemukan",
        });
      }



      return res.status(200).json({
        message: "Sukses",
        data: province,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async cities(req, res) {
    try {
      const id = req.params.id;

      const cities = await prisma.cities.findMany({
        where: {
          prov_id: Number(id)
        },
      });

      if (!cities) {
        return res.status(404).json({
          message: "City tidak ditemukan",
        });
      }



      return res.status(200).json({
        message: "Sukses",
        data: cities,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async districts(req, res) {
    try {
      const id = req.params.id;

      const district = await prisma.districts.findMany({
        where: {
          city_id: Number(id)
        },
      });

      if (!district) {
        return res.status(404).json({
          message: "Kecematan tidak ditemukan",
        });
      }



      return res.status(200).json({
        message: "Sukses",
        data: district,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async gltype(req, res) {
    try {
      //const id = req.params.id;

      const gltype = await prisma.gl_account_type.findMany({
        // where: {
        //     id: Number(id)               
        //   },
      });

      if (!gltype) {
        return res.status(404).json({
          message: "Data GL Type tidak ditemukan",
        });
      }



      return res.status(200).json({
        message: "Sukses",
        data: gltype,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  async glaccount(req, res) {
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
        gl_name: {
          contains: keyword,
        },
      };

      const [count, gla] = await prisma.$transaction([
        prisma.gl_account.count({
          where: params,
        }),
        prisma.gl_account.findMany({
          include: {
            gl_account_type: true
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

  async glaccountMt940(req, res) {
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
        gl_name: {
          contains: keyword,
        },
        gl_group: {
          contains: "PENERIMAAN"
        }
      };

      const [count, gla] = await prisma.$transaction([
        prisma.gl_account.count({
          where: params,
        }),
        prisma.gl_account.findMany({
          include: {
            gl_account_type: true
          },
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          //take: perPage,
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

  async glaccountPerBayar(req, res) {
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
        gl_name: {
          contains: keyword,
        },
        gl_group: { notIn: ["PROG", "BANK", "KAS", "PIUTANG", "ASET", "BLANK"] }
      };

      const [count, gla] = await prisma.$transaction([
        prisma.gl_account.count({
          where: params,
        }),
        prisma.gl_account.findMany({
          include: {
            gl_account_type: true
          },
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          //take: perPage,
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

  async getDataProgram(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 4);

      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "program_id";
      const sortType = req.query.order || "asc";

      const params = {
        program_title: {
          contains: keyword,
        },
        program_status: 1

      };

      const [count, prog] = await prisma.$transaction([
        prisma.program.count({
          where: params,
        }),
        prisma.program.findMany({
          select: {
            program_id: true,
            program_title: true
          },
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          //take: perPage,
        }),
      ]);

      const progResult = await Promise.all(
        prog.map(async (item) => {


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

        data: progResult,
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


  async getAllMuzaki(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 4);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "user_id";
      const sortType = req.query.order || "asc";

      const params = {
        user_nama: {
          contains: keyword,
        },
        user_type: 11,
        user_status: 1
      };

      const [count, muzaki] = await prisma.$transaction([
        prisma.user.count({
          where: params,
        }),
        prisma.user.findMany({
          select: {
            user_id: true,
            user_nama: true
          },
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      const muzResult = await Promise.all(
        muzaki.map(async (item) => {


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

        data: muzResult,
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
  async getAllArticle(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 1);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";

      const params = {
        // program_status: status,
        title: {
          contains: keyword,
        },
      };

      const [count, article] = await prisma.$transaction([
        prisma.article.count({
          where: params,
        }),
        prisma.article.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          include: {
            user: true,
          },
          skip,
          take: perPage,
        }),
      ]);

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data",

        data: article,
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

  async getByIdArticle(req, res) {
    try {
      const articleId = req.params.id; // Ambil ID dari parameter URL

      const article = await prisma.article.findUnique({
        where: {
          id: Number(articleId),
        },
        include: {
          user: true,
        },
      });

      if (!article) {
        return res.status(404).json({
          message: "Artikel tidak ditemukan",
        });
      }

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: article,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message || "Terjadi kesalahan",
      });
    }
  },

  async registerArticle(req, res) {
    try {
      const schema = z.object({
        title: z.string({ required_error: "Judul Harus Diisi" }).min(3, "Judul Terlalu Pendek").max(255),
        content: z.string({ required_error: "Deskripsi Harus Diis" }).min(3),
      });

      const title = req.body.title;
      const content = req.body.content;

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

      const array_of_allowed_files = ['png', 'jpg', 'jpeg'];
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

      const userId = req.user_id;
      console.log(userId)
      const article = await prisma.article.create({
        data: {
          title,
          content,
          banner: `${file.filename}`,
          user_id: Number(userId),
        },
      });

      if (!article) {
        return res.status(400).json({
          message: "Gagal Tambah Article",
        });
      }

      res.status(200).json({
        message: "Sukses Tambah Article",
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },


  async updateArticle(req, res) {
    try {
      const schema = z.object({
        title: z.string({ required_error: "Judul Harus Diisi" }).min(3, "Judul Terlalu Pendek").max(255),
        content: z.string({ required_error: "Deskripsi Harus Diis" }).min(3),
      });

      const { id } = req.params;

      const title = req.body.title;
      const content = req.body.content;

      const file = req.file;

      const maxSize = 5000000;

      // Check if a file is provided and validate its size
      if (file && file.size > maxSize) {
        await fs.unlink(file.path);

        return res.status(400).json({
          message: "Ukuran Banner Terlalu Besar",
        });
      }

      const { evidence, path } = req.body;

      const userId = req.user_id;
      console.log(userId)
      const articleUpdateData = {
        title,
        content,
        user_id: Number(userId),
      };

      // Update banner only if file is provided
      if (file) {
        articleUpdateData.banner = `${file.filename}`;
      }

      const article = await prisma.article.update({
        where: {
          id: Number(id),
        },
        data: articleUpdateData,
      });

      if (!article) {
        return res.status(404).json({
          message: "Article not found",
        });
      }

      res.status(200).json({
        message: "Sukses Update Article",
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },
  async deleteArticle(req, res) {
    try {
      const { id } = req.params;

      await prisma.article.delete({
        where: {
          id: Number(id),
        }
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Hapus Data",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async institusi(req, res) {
    try {
      const id = req.params.id;

      const institusi = await prisma.institusi.findMany({
        where: {
          institusi_user_id: Number(id)
        },
      });

      if (!institusi) {
        return res.status(404).json({
          message: "City tidak ditemukan",
        });
      }

      return res.status(200).json({
        message: "Sukses",
        data: institusi,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async paket(req, res) {
    try {
      const id_program = req.params.id;
      const paket = await prisma.activity_paket.findMany({
        where: {
          program_id: Number(id_program),
        },
      });

      if (!paket) {
        return res.status(404).json({
          message: "Paket tidak ditemukan",
        });
      }
      return res.status(200).json({
        message: "Sukses",
        data: paket,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
}