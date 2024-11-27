const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");

const { customAlphabet } = require("nanoid");
const { z } = require("zod");
const { checkImkas } = require("../helper/imkas");
const QRCode = require("qrcode");
const path = require('path');
const { createCanvas, loadImage, registerFont } = require('canvas');

// Load font


var serverkeys = process.env.SERVER_KEY;
var clientkeys = process.env.CLIENT_KEY;

const {
  handlePayment,
  cekStatus,
  midtransfer,
} = require("../helper/midtrans");
const { error } = require("console");

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

      const province = await prisma.provinces.findMany({});

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
          prov_id: Number(id),
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
          city_id: Number(id),
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
            gl_account_type: true,
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
          contains: "PENERIMAAN",
        },
      };

      const [count, gla] = await prisma.$transaction([
        prisma.gl_account.count({
          where: params,
        }),
        prisma.gl_account.findMany({
          include: {
            gl_account_type: true,
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

  async glaccountManual(req, res) {
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
        // gl_group: {
        //   contains: "PENERIMAAN"
        // }
      };

      const [count, gla] = await prisma.$transaction([
        prisma.gl_account.count({
          where: params,
        }),
        prisma.gl_account.findMany({
          include: {
            gl_account_type: true,
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
        gl_group: {
          notIn: ["PROG", "BANK", "KAS", "PIUTANG", "ASET", "BLANK"],
        },
      };

      const [count, gla] = await prisma.$transaction([
        prisma.gl_account.count({
          where: params,
        }),
        prisma.gl_account.findMany({
          include: {
            gl_account_type: true,
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
        program_status: 1,
      };

      const [count, prog] = await prisma.$transaction([
        prisma.program.count({
          where: params,
        }),
        prisma.program.findMany({
          select: {
            program_id: true,
            program_title: true,
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
            ...item,
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
        user_status: 1,
      };

      const [count, muzaki] = await prisma.$transaction([
        prisma.user.count({
          where: params,
        }),
        prisma.user.findMany({
          select: {
            user_id: true,
            user_nama: true,
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
            ...item,
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
        gl_type,
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
          status,
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
        gl_type,
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
          status,
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
            ...item,
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
      const { bank_name, bank_number } = req.body;

      //console.log(JSON.stringify(req.body))

      const bankResult = await prisma.bank_account.create({
        data: {
          bank_name,
          bank_number,
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

      const { bank_name, bank_number } = req.body;

      //console.log(JSON.stringify(req.body))

      const bankResult = await prisma.bank_account.update({
        where: {
          id: Number(id),
        },
        data: {
          bank_name,
          bank_number,
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
        title: z
          .string({ required_error: "Judul Harus Diisi" })
          .min(3, "Judul Terlalu Pendek")
          .max(255),
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

      const array_of_allowed_files = ["png", "jpg", "jpeg"];
      const file_extension = file.originalname.slice(
        ((file.originalname.lastIndexOf(".") - 1) >>> 0) + 2
      );

      // Check if the uploaded file is allowed
      if (!array_of_allowed_files.includes(file_extension)) {
        return res.status(400).json({
          message: "File Tidak Sesuai Format",
        });
      }

      const { evidence, path } = req.body;

      const userId = req.user_id;
      console.log(userId);
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
        title: z
          .string({ required_error: "Judul Harus Diisi" })
          .min(3, "Judul Terlalu Pendek")
          .max(255),
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
      console.log(userId);
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
        },
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
          institusi_user_id: Number(id),
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

  async getReportGlaccount(req, res) {
    try {
      const start = new Date(req.query.start);
      const end = new Date(req.query.end);

      const validStart = !isNaN(start.getTime()) ? start : new Date();
      const validEnd =
        !isNaN(end.getTime()) && end >= validStart ? end : new Date();

      validStart.setHours(0, 0, 0, 0);
      validEnd.setHours(23, 59, 59, 999);

      if (validStart > validEnd) {
        return res.status(400).json({ message: "Invalid date range" });
      }

      const params = {
        created_date: {
          gte: validStart,
          lte: validEnd,
        },
      };

      const result = await prisma.$queryRawUnsafe(`
      SELECT g.gl_account, g.gl_name, g.gl_type, gt.gla_type, SUM(COALESCE(p.dana_yang_disetujui, 0)) AS nominal,  g.status
FROM 
    gl_account g
LEFT JOIN 
    program_category pc ON g.id = pc.gl_id
LEFT JOIN 
    program pr ON pc.id = pr.program_category_id
LEFT JOIN 
    proposal p ON pr.program_id = p.program_id AND p.ispaid = 1
INNER JOIN 
    gl_account_type gt ON g.gl_type = gt.id
GROUP BY g.id
ORDER BY SUM(COALESCE(p.dana_yang_disetujui, 0)) DESC
      `);

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getReportAsnafType(req, res) {
    try {
      const start = new Date(req.query.start);
      const end = new Date(req.query.end);

      const validStart = !isNaN(start.getTime()) ? start : new Date();
      const validEnd =
        !isNaN(end.getTime()) && end >= validStart ? end : new Date();

      validStart.setHours(0, 0, 0, 0);
      validEnd.setHours(23, 59, 59, 999);

      if (validStart > validEnd) {
        return res.status(400).json({ message: "Invalid date range" });
      }

      const params = {
        created_date: {
          gte: validStart,
          lte: validEnd,
        },
      };

      const result = await prisma.$queryRawUnsafe(`
      SELECT a.type, a.deskripsi, SUM(COALESCE(p.dana_yang_disetujui, 0)) AS nominal
FROM 
    asnaf_type a
LEFT JOIN 
    gl_account g ON a.id = g.asnaf_type_id
LEFT JOIN 
    program_category pc ON g.id = pc.gl_id
LEFT JOIN 
    program pr ON pc.id = pr.program_category_id
LEFT JOIN 
    proposal p ON pr.program_id = p.program_id AND p.ispaid = 1
    WHERE 
    a.id NOT IN (8, 9)
GROUP BY a.id
ORDER BY SUM(COALESCE(p.dana_yang_disetujui, 0)) DESC
      `);

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getReportProgram(req, res) {
    try {
      const start = new Date(req.query.start);
      const end = new Date(req.query.end);
      const isinternal = Number(req.query.isinternal || 0);

      const validStart = !isNaN(start.getTime()) ? start : new Date();
      const validEnd =
        !isNaN(end.getTime()) && end >= validStart ? end : new Date();

      validStart.setHours(0, 0, 0, 0);
      validEnd.setHours(23, 59, 59, 999);

      if (validStart > validEnd) {
        return res.status(400).json({ message: "Invalid date range" });
      }

      const params = {
        created_date: {
          gte: validStart,
          lte: validEnd,
        },
        isinternal,
      };

      const result = await prisma.$queryRawUnsafe(`
      SELECT 
    pr.program_title,
    pr.program_category_id,
    pc.name,
    SUM(COALESCE(p.dana_yang_disetujui, 0)) AS nominal,
    pr.program_status
FROM 
    program pr
LEFT JOIN 
    proposal p ON p.program_id = pr.program_id AND p.ispaid = 1
LEFT JOIN 
    program_category pc ON pr.program_category_id = pc.id
    WHERE pr.isinternal = ${isinternal}
GROUP BY pr.program_id
ORDER BY SUM(COALESCE(p.dana_yang_disetujui, 0)) DESC
      `);

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getReportAktifitas(req, res) {
    try {
      const start = new Date(req.query.start);
      const end = new Date(req.query.end);

      const validStart = !isNaN(start.getTime()) ? start : new Date();
      const validEnd =
        !isNaN(end.getTime()) && end >= validStart ? end : new Date();

      validStart.setHours(0, 0, 0, 0);
      validEnd.setHours(23, 59, 59, 999);

      if (validStart > validEnd) {
        return res.status(400).json({ message: "Invalid date range" });
      }

      const params = {
        created_date: {
          gte: validStart,
          lte: validEnd,
        },
      };

      const result = await prisma.$queryRawUnsafe(`
      SELECT 
    aa.nama, 
	 aa.created_date, 
	 aa.iskomunitas, 
	 r.referentor_nama, 
	 aa.total_biaya,
   pt.midtrans_status_log
FROM 
activity_additional aa
INNER JOIN program_transaction_activity pt 
ON aa.order_id  COLLATE UTF8MB4_GENERAL_CI = pt.order_id  COLLATE UTF8MB4_GENERAL_CI
AND pt.midtrans_status_log = 'settlement'
INNER JOIN referentor r ON aa.referentor_id = r.id
ORDER BY aa.created_date DESC
      `);

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: result,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getReportZis(req, res) {
    try {
      const sortBy = req.query.sortBy || "create_date";
      const sortType = req.query.order || "desc";

      const proposal = await prisma.proposal.findMany({
        orderBy: {
          [sortBy]: sortType,
        },
        select: {
          nama: true,
          nama_pemberi_rekomendasi: true,
          create_date: true,
          dana_yang_diajukan: true,
          tgl_bayar: true,
          status_bayar: true,
          approved: true,
          ispaid: true,
          program: {
            select: {
              program_title: true,
            },
          },
          proposal_approval: true,
        },
      });

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: proposal,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getReportWakaf(req, res) {
    try {
      const sortBy = req.query.sortBy || "created_date";
      const sortType = req.query.order || "desc";

      const mitra = await prisma.mitra.findMany({
        orderBy: {
          [sortBy]: sortType,
        },
        select: {
          mitra_nama: true,
          created_date: true,
          mitra_no_kontrak: true,
          approved: true,
          status_bayar: true,
          mitra_register: {
            select: {
              mitra_reg_nominal: true,
              referentor: {
                select: {
                  referentor_nama: true,
                },
              },
            },
          },
          program: {
            select: {
              program_title: true,
            },
          },
          mitra_approval: true,
        },
      });

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: mitra,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getReportMuzzaki(req, res) {
    try {
      const sortBy = req.query.sortBy || "trans_date";
      const sortType = req.query.order || "desc";

      const muzzaki = await prisma.transactions.findMany({
        orderBy: {
          [sortBy]: sortType,
        },
        select: {
          nama_muzaki: true,
          email_muzaki: true,
          phone_muzaki: true,
          payment_method: true,
          trans_date: true,
          is_nologin: true,
          amount: true,
          status: true,
          program: {
            select: {
              program_title: true,
            },
          },
          user: {
            select: {
              user_nama: true,
              username: true,
              user_phone: true,
            },
          },
        },
      });

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: muzzaki,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getOutlet(req, res) {
    const outlet_id = Number(req.query.outlet_id) || 0;

    try {
      const outlet = await prisma.outlet.findUnique({
        where: {
          id: outlet_id,
        },
        include: {
          cso: {
            include: {
              provinces: true,
              cities: true,
              districts: true,
            },
          },
        },
      });

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: outlet,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getAllCso(req, res) {
    try {
      const keyword = req.query.keyword || "";
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";

      const params = {
        nama_cso: {
          contains: keyword,
        },
      };

      const [count, cso] = await prisma.$transaction([
        prisma.cso.count({
          where: params,
        }),
        prisma.cso.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          include: {
            provinces: true,
            cities: true,
            districts: true,
            user: true,
          },
          skip,
          take: perPage,
        }),
      ]);

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: cso,
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

  async updateCso(req, res) {
    try {
      const csoId = req.params.id;
      const { nama_cso, nohp, alamat, user_id } = req.body;

      if (!nama_cso || !nohp || !alamat) {
        return res.status(400).json({
          message: "Nama, Alamat, dan Nomor Telepon Harus Diisi",
        });
      }

      await prisma.cso.update({
        where: {
          id: Number(csoId),
        },
        data: {
          nama_cso: nama_cso,
          nohp: nohp,
          alamat: alamat,
          user_id: Number(user_id),
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Update Data Cso",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getAllOutlet(req, res) {
    try {
      const userId = req.user.user_id; // Pastikan `userId` diambil dari session login
      const keyword = req.query.keyword || "";
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const sortBy = req.query.sortBy || "id";
      const sortType = req.query.order || "asc";

      // Cari CSO ID berdasarkan user_id yang login
      const cso = await prisma.cso.findFirst({
        where: { user_id: userId },
      });

      if (!cso) {
        return res
          .status(404)
          .json({ message: "CSO tidak ditemukan untuk user ini" });
      }

      const params = {
        nama_outlet: {
          contains: keyword,
        },
        cso_id: cso.id, // Gunakan `cso.id` sebagai filter untuk `id_cso`
      };

      const [count, outlet] = await prisma.$transaction([
        prisma.outlet.count({
          where: params,
        }),
        prisma.outlet.findMany({
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          include: {
            cso: true,
          },
          skip,
          take: perPage,
        }),
      ]);

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: outlet,
        pagination: {
          total: count,
          page,
          hasNext: count > page * perPage,
          totalPage: Math.ceil(count / perPage),
        },
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async createOutlet(req, res) {
    try {
      // Validasi input
      const schema = z.object({
        nama_outlet: z.string(),
        alamat_outlet: z.string(),
        pic_outlet: z.string(),
        telepon: z
          .string()
          .regex(/^\+?[0-9]{10,15}$/, "Nomor telepon tidak valid"), // Validasi nomor telepon
      });

      const { nama_outlet, alamat_outlet, pic_outlet, telepon } = req.body;
      const body = await schema.safeParseAsync({
        nama_outlet,
        alamat_outlet,
        pic_outlet,
        telepon,
      });
      let errorObj = {};

      if (body.error) {
        body.error.issues.forEach((issue) => {
          errorObj[issue.path[0]] = issue.message;
        });
        body.error = errorObj;
      }

      if (!body.success) {
        return res.status(400).json({
          message: "Beberapa Field Harus Diisi",
          error: errorObj,
        });
      }

      const userId = req.user.user_id;
      const cso = await prisma.cso.findFirst({ where: { user_id: userId } });

      if (!cso) {
        return res.status(404).json({
          message: "CSO tidak ditemukan untuk user ini",
        });
      }

      const currentOutlet = await prisma.outlet.findFirst({
        where: { nama_outlet: body.data.nama_outlet },
      });

      if (currentOutlet) {
        return res.status(400).json({
          message: "Outlet Sudah Terdaftar",
        });
      }

      const newOutlet = await prisma.outlet.create({
        data: {
          nama_outlet: body.data.nama_outlet,
          alamat_outlet: body.data.alamat_outlet,
          pic_outlet: body.data.pic_outlet,
          telepon: body.data.telepon, // Tambahkan nomor telepon ke database
          cso_id: cso.id,
          register_date: new Date(),
        },
      });

      const qrCodeUrl = `https://portal.zisindosat.id/salam-donasi?outlet=${newOutlet.id}`;
      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl, { width: 800 });

      const qrCodeImage = await loadImage(qrCodeDataUrl);
      const logoPath = path.resolve(__dirname, "../../uploads/zis.png");
      const logoImage = await loadImage(logoPath);

      const backgroundImagePath = path.resolve(
        __dirname,
        "../../uploads/background.png"
      );
      const backgroundImage = await loadImage(backgroundImagePath);

      // Set up canvas for A4 size at 300 DPI
      const canvasWidth = 2480; // A4 width in pixels at 300 DPI
      const canvasHeight = 3508; // A4 height in pixels at 300 DPI
      const qrSize = 1500; // Adjusted QR code size for A4
      const logoSize = 150; // Adjusted logo size
      const borderSize = 60; // Adjusted border size
      const textMargin = 100; // Adjusted text margin

      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext("2d");

      // Scale the background to fit A4 size
      const backgroundScaleWidth = canvasWidth / backgroundImage.width;
      const backgroundScaleHeight = canvasHeight / backgroundImage.height;
      const backgroundScale = Math.max(
        backgroundScaleWidth,
        backgroundScaleHeight
      );

      const bgX = (canvasWidth - backgroundImage.width * backgroundScale) / 2;
      const bgY = (canvasHeight - backgroundImage.height * backgroundScale) / 2;
      ctx.drawImage(
        backgroundImage,
        bgX,
        bgY,
        backgroundImage.width * backgroundScale,
        backgroundImage.height * backgroundScale
      );

      // Draw white area behind QR code
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(
        (canvasWidth - (qrSize + borderSize)) / 2,
        canvasHeight - qrSize - textMargin - 300,
        qrSize + borderSize,
        qrSize + textMargin
      );

      // Draw QR code centered in white area
      const qrX = (canvasWidth - qrSize) / 2;
      const qrY = canvasHeight - qrSize - textMargin - 300;
      ctx.drawImage(qrCodeImage, qrX, qrY, qrSize, qrSize);

      // Draw logo centered over QR code
      const logoX = qrX + (qrSize - logoSize) / 2;
      const logoY = qrY + (qrSize - logoSize) / 2;
      ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);

      // Draw text below QR code with larger font
      registerFont(
        path.resolve(__dirname, "../../uploads/fonts/Roboto-Black.ttf"),
        { family: "Roboto" }
      );
      const text = `Salam Donasi ${newOutlet.id}`;
      const fontSize = 100; // Adjusted font size for A4
      ctx.fillStyle = "#000000";
      ctx.font = `bold ${fontSize}px Roboto`;
      ctx.textAlign = "center";
      ctx.fillText(text, canvasWidth / 2, canvasHeight - 100);

      const qrCodeWithLogoData = canvas.toDataURL("image/png");

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Menambahkan Outlet dengan QR Code",
        qrCodeUrl,
        qrCodeWithLogoData,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async updateOutlet(req, res) {
    const outletId = req.params.id;
    try {
      // Validation
      const schema = z.object({
        nama_outlet: z.string().optional(),
        alamat_outlet: z.string().optional(),
        pic_outlet: z.string().optional(),
        telepon: z
          .string()
          .regex(/^\+?\d{10,15}$/) // Validate phone number format
          .optional(),
      });

      const { nama_outlet, alamat_outlet, pic_outlet, telepon } = req.body;
      const body = await schema.safeParseAsync({
        nama_outlet,
        alamat_outlet,
        pic_outlet,
        telepon,
      });

      let errorObj = {};

      if (body.error) {
        body.error.issues.forEach((issue) => {
          errorObj[issue.path[0]] = issue.message;
        });
        body.error = errorObj;
      }

      if (!body.success) {
        return res.status(400).json({
          message: "Beberapa Field Harus Diisi",
          error: errorObj,
        });
      }

      const userId = req.user.user_id;
      const cso = await prisma.cso.findFirst({ where: { user_id: userId } });

      if (!cso) {
        return res.status(404).json({
          message: "CSO tidak ditemukan untuk user ini",
        });
      }

      // Check if outlet exists
      const outlet = await prisma.outlet.findFirst({
        where: { id: Number(outletId), cso_id: cso.id },
      });

      if (!outlet) {
        return res.status(404).json({
          message: "Outlet tidak ditemukan",
        });
      }

      // Update outlet details
      const updatedOutlet = await prisma.outlet.update({
        where: {
          id: Number(outletId),
        },
        data: {
          ...(body.data.nama_outlet && { nama_outlet: body.data.nama_outlet }),
          ...(body.data.alamat_outlet && {
            alamat_outlet: body.data.alamat_outlet,
          }),
          ...(body.data.pic_outlet && { pic_outlet: body.data.pic_outlet }),
          ...(body.data.telepon && { telepon: body.data.telepon }),
        },
      });

      // Generate QR code URL
      const qrCodeUrl = `https://portal.zisindosat.id/salam-donasi?outlet=${updatedOutlet.id}`;
      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeUrl);

      const qrCodeImage = await loadImage(qrCodeDataUrl);
      const logoPath = path.resolve(__dirname, "../../uploads/zis.png");
      const logoImage = await loadImage(logoPath);

      // Load background image
      const backgroundImagePath = path.resolve(
        __dirname,
        "../../uploads/background.png"
      );
      const backgroundImage = await loadImage(backgroundImagePath);

      // Set A4 canvas dimensions at 300 DPI (2480x3508 pixels)
      const canvasWidth = 2480;
      const canvasHeight = 3508;
      const qrSize = 1500; // Adjust QR size for A4
      const reducedBorderSize = 100; // Border around the QR
      const textMargin = 200;

      // Create canvas at A4 size
      const canvas = createCanvas(canvasWidth, canvasHeight);
      const ctx = canvas.getContext("2d");

      // Calculate background scale
      const backgroundScaleWidth = canvasWidth / backgroundImage.width;
      const backgroundScaleHeight = canvasHeight / backgroundImage.height;
      const backgroundScale = Math.max(
        backgroundScaleWidth,
        backgroundScaleHeight
      );

      // Draw background image
      const bgX =
        canvasWidth / 2 - (backgroundImage.width * backgroundScale) / 2;
      const bgY =
        canvasHeight / 2 - (backgroundImage.height * backgroundScale) / 2;
      ctx.drawImage(
        backgroundImage,
        bgX,
        bgY,
        backgroundImage.width * backgroundScale,
        backgroundImage.height * backgroundScale
      );

      // Draw white area behind QR code
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(
        (canvasWidth - (qrSize + reducedBorderSize)) / 2,
        canvasHeight - qrSize - textMargin - 200,
        qrSize + reducedBorderSize,
        qrSize + textMargin
      );

      // Draw QR code in center of the white area
      const qrX = (canvasWidth - qrSize) / 2;
      const qrY = canvasHeight - qrSize - textMargin - 160;
      ctx.drawImage(qrCodeImage, qrX, qrY, qrSize, qrSize);

      // Draw logo centered on QR code
      const logoSize = 200;
      const logoX = qrX + qrSize / 2 - logoSize / 2;
      const logoY = qrY + qrSize / 2 - logoSize / 2;
      ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);

      // Draw text with larger font size
      registerFont(
        path.resolve(__dirname, "../../uploads/fonts/Roboto-Black.ttf"),
        { family: "Roboto" }
      );
      const text = `Salam Donasi ${updatedOutlet.id}`;
      const fontSize = 100;
      ctx.fillStyle = "#000000";
      ctx.font = `bold ${fontSize}px Roboto`;

      const textWidth = ctx.measureText(text).width;
      const textX = (canvasWidth - textWidth) / 2;
      const textY = canvasHeight - 100;

      ctx.fillText(text, textX, textY);

      const qrCodeWithLogoData = canvas.toDataURL("image/png");

      return res.status(200).json({
        message: "Sukses",
        data: "Outlet berhasil diperbarui dengan QR Code",
        qrCodeUrl,
        qrCodeWithLogoData,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getTransaksiPerOutlet(req, res) {
    try {
      const userId = req.user.user_id;
      const keyword = req.query.keyword || "";
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const sortBy = req.query.sortBy || "id_outlet";
      const sortType = req.query.order || "asc";

      // Get the CSO ID for the logged-in user
      const cso = await prisma.cso.findFirst({ where: { user_id: userId } });
      if (!cso) {
        return res
          .status(404)
          .json({ message: "CSO tidak ditemukan untuk user ini" });
      }
      const csoId = cso.id;

      // Fetch outlets based on cso_id
      const outlets = await prisma.outlet.findMany({
        where: {
          cso_id: csoId,
          nama_outlet: { contains: keyword },
        },
        select: {
          id: true,
          nama_outlet: true,
          alamat_outlet: true,
        },
        skip,
        take: perPage,
      });

      const outletIds = outlets.map((outlet) => outlet.id);

      // Fetch total count of unique outlets matching the query
      const count = await prisma.outlet.count({
        where: {
          cso_id: csoId,
          pic_outlet: { contains: keyword },
        },
      });

      // Get transactions grouped by outlet, calculating both nominal sum and transaction count
      const transaksi = await prisma.register_donasi.groupBy({
        by: ["id_outlet"],
        _sum: { nominal: true },
        _count: { id_outlet: true },
        where: {
          outlet: { id: { in: outletIds } },
          transaction_status: "settlement",
        },
        orderBy: { [sortBy]: sortType },
      });

      const csoData = await prisma.cso.findUnique({
        where: { id: csoId },
        select: { nama_cso: true },
      });

      const formatCurrency = (value) =>
        `Rp ${value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

      const result = outlets.map((outlet) => {
        const transaksiItem = transaksi.find(
          (item) => item.id_outlet === outlet.id
        );
        return {
          id: outlet.id,
          nama_outlet: outlet.nama_outlet,
          alamat_outlet: outlet.alamat_outlet || "Tidak Diketahui",
          nama_cso: csoData ? csoData.nama_cso : "Tidak Diketahui",
          total: formatCurrency(
            transaksiItem ? transaksiItem._sum.nominal || 0 : 0
          ),
          total_transaksi: transaksiItem ? transaksiItem._count.id_outlet : 0,
        };
      });

      res.status(200).json({
        message: "Sukses Ambil Data Transaksi Per Outlet",
        data: result,
        pagination: {
          total: count,
          page,
          hasNext: count > page * perPage,
          totalPage: Math.ceil(count / perPage),
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async getAllTransaksiOutlet(req, res) {
    try {
      const keyword = req.query.keyword || "";
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const skip = (page - 1) * perPage;
      const sortBy = req.query.sortBy || "id_outlet";
      const sortType = req.query.order || "asc";

      // Fetch outlets with optional keyword filtering
      const outlets = await prisma.outlet.findMany({
        where: {
          nama_outlet: { contains: keyword },
        },
        select: {
          id: true,
          nama_outlet: true,
          alamat_outlet: true,
        },
        skip,
        take: perPage,
      });

      const outletIds = outlets.map((outlet) => outlet.id);

      // Fetch total count of outlets matching the query
      const count = await prisma.outlet.count({
        where: {
          nama_outlet: { contains: keyword },
        },
      });

      // Get transactions grouped by outlet, calculating both nominal sum and transaction count
      const transaksi = await prisma.register_donasi.groupBy({
        by: ["id_outlet"],
        _sum: { nominal: true },
        _count: { id_outlet: true },
        where: {
          outlet: { id: { in: outletIds } },
          transaction_status: "settlement",
        },
        orderBy: { [sortBy]: sortType },
      });

      // Get all outlets data (no filtering by CSO)
      const result = outlets.map((outlet) => {
        const transaksiItem = transaksi.find(
          (item) => item.id_outlet === outlet.id
        );
        // Helper function to format currency values
        const formatCurrency = (value) => {
          return `Rp ${value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
        };
        return {
          id: outlet.id,
          nama_outlet: outlet.nama_outlet,
          alamat_outlet: outlet.alamat_outlet || "Tidak Diketahui",
          total: formatCurrency(
            transaksiItem ? transaksiItem._sum.nominal || 0 : 0
          ),
          total_transaksi: transaksiItem ? transaksiItem._count.id_outlet : 0,
        };
      });

      res.status(200).json({
        message: "Sukses Ambil Data Transaksi Per Outlet",
        data: result,
        pagination: {
          total: count,
          page,
          hasNext: count > page * perPage,
          totalPage: Math.ceil(count / perPage),
        },
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  },

  async registerDonasi(req, res) {
    function generateOrderId(paymentType) {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-:.]/g, "").slice(0, 15); // Format YYYYMMDDHHMMSS
      let prefix;

      // Memberikan prefix berdasarkan paymentType
      switch (paymentType) {
        case "transfer":
          prefix = "TF"; // Prefix untuk QRIS
          break;
        case "cash":
          prefix = "CS"; // Prefix untuk QRIS
          break;
        default:
          throw new Error("Tipe pembayaran tidak dikenali"); // Buat error jika tipe tidak valid
      }

      return `${prefix}${timestamp}`; // Mengembalikan order_id dengan prefix
    }

    try {
      const {
        jenis_donasi,
        nama_donatur,
        nohp_donatur,
        nominal,
        id_outlet,
        metode_pembayaran,
      } = req.body;

      // const response = await handlePayment({
      //   paymentType: metode_pembayaran,
      //   amount: nominal,
      // });
      // console.log("response:", response);

      const isCashPayment = metode_pembayaran === "cash";
      // const isMandiriPayment = metode_pembayaran === 'mandiri';

      // const biller_code = isMandiriPayment ? response?.data?.biller_code : null

      // const va_number = isCashPayment
      //   ? null
      //   : metode_pembayaran === "bca" || metode_pembayaran === "bri" || metode_pembayaran === "bni"
      //     ? response?.data?.va_numbers[0]?.va_number || ''
      //     : metode_pembayaran === "mandiri"
      //       ? response?.data?.bill_key || ''
      //       : metode_pembayaran === "gopay"
      //         ? response?.data?.actions[0]?.url || ''
      //         : "";

      // const transaction_status = isCashPayment ? 'settlement' : response?.data?.transaction_status || '';

      const transaction_code = generateOrderId(metode_pembayaran); // Kosong jika metode pembayaran adalah cash

      const transaction_time = new Date();
      const expiry_time = new Date();
      expiry_time.setMinutes(expiry_time.getMinutes() + 15);

      const postResult = await prisma.register_donasi.create({
        data: {
          jenis_donasi: Number(jenis_donasi),
          nama_donatur,
          nohp_donatur,
          nominal,
          id_outlet,
          metode_pembayaran: isCashPayment ? "cash" : "transfer",
          // bank: isCashPayment ? null : metode_pembayaran,
          // va_number: va_number,
          // biller_code,
          // transaction_status: transaction_status,
          transaction_time: transaction_time,
          // expiry_time: expiry_time,
          transaction_code: transaction_code,
        },
      });

      const midtrans = await midtransfer({
        order: transaction_code,
        price: Number(nominal),
      });

      const header = {
        isProduction: true,
        serverKey: serverkeys,
        clientKey: clientkeys,
      };

      const log = await prisma.log_vendor.create({
        data: {
          vendor_api: "Snap MidTrans",
          url_api: req.originalUrl,
          api_header: JSON.stringify(header),
          api_body: JSON.stringify({
            order: transaction_code,
            price: Number(nominal),
          }),
          api_response: JSON.stringify(midtrans),
          payload: JSON.stringify(req.body),
        },
      });

      res.status(200).json({
        message: "Sukses Kirim Data",
        data: { postResult, midtrans },
      });
    } catch (error) {
      res.status(500).json({
        message: error.message,
      });
    }
  },

  async checkPay(req, res) {
    const order_id = req.body.order_id;
    try {
      // Cek status transaksi dari Midtrans
      const stats = await cekStatus({ order: order_id }); // Pastikan orderId yang dikirimkan valid

      // Log informasi dari Midtrans
      console.log(
        "Response dari Midtrans:",
        JSON.stringify(stats.data, null, 2)
      );

      if (stats.data.status_code === "200") {
        const log = await prisma.log_vendor.create({
          data: {
            vendor_api: stats?.config?.url,
            url_api: req.originalUrl,
            api_header: JSON.stringify(stats.headers),
            api_body: stats?.config?.data,
            api_response: JSON.stringify(stats.data),
            payload: JSON.stringify(req.body),
          },
        });

        // const isCashPayment = 'cash';
        const isMandiriPayment = "mandiri";

        // const biller_code = isMandiriPayment ? stats.data?.biller_code : null

        // const va_number = isCashPayment
        //   ? null
        //   : metode_pembayaran === "bca" || metode_pembayaran === "bri" || metode_pembayaran === "bni"
        //     ? response?.data?.va_numbers[0]?.va_number || ''
        //     : metode_pembayaran === "mandiri"
        //       ? response?.data?.bill_key || ''
        //       : metode_pembayaran === "gopay"
        //         ? response?.data?.actions[0]?.url || ''
        //         : "";

        await prisma.register_donasi.update({
          where: {
            transaction_code: order_id,
          },
          data: {
            transaction_status: stats.data?.transaction_status || "",
            metode_pembayaran: stats.data?.payment_type,
            bank:
              stats.data.bank ||
              stats.data?.va_numbers?.[0]?.bank ||
              stats.data?.issuer ||
              isMandiriPayment,
            va_number:
              stats.data?.bill_key || stats.data?.va_numbers?.[0]?.va_number,
            biller_code: stats.data?.biller_code || null,
            settlement_time: new Date(stats.data.settlement_time).toISOString(),
            expiry_time: new Date(stats.data.expiry_time).toISOString(),
          },
        });

        return res.status(200).json({ message: "Sukses Ambil Data" });
      } else if (stats.data.status_code === "404") {
        return res.status(400).json({
          message: "Transaksi tidak ditemukan. Pastikan ID transaksi benar.",
        });
      } else {
        console.error("Transaksi tidak valid:", stats.data.transaction_status);
        return res.status(400).json({
          message: "Anda Belum Melakukan Pembayaran",
        });
      }
    } catch (error) {
      console.error("Error:", error.message);
      return res.status(500).json({
        message: error.message || "An error occurred",
      });
    }
  },
};