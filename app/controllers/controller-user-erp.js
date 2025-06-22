const { generate } = require("../helper/auth-jwt");
const { prisma } = require("../../prisma/client");
const { z, number } = require("zod");
const { nanoid } = require("nanoid");
const argon2 = require("argon2");
const { generateTemplate, sendEmail, generateTemplateForgotEmail } = require("../helper/email");
const crypto = require("node:crypto");

module.exports = {
  // LOGIN USER ERP
  async loginUser(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          message: "Username atau Password Salah",
        });
      }

      const user = await prisma.user.findUnique({
        include: {
          type: true,
        },
        where: {
          username,
          user_type: {
            in: [1, 7, 8, 9, 12, 13, 14, 17, 18, 20, 21, 22, 23, 24, 25],
          },
        },
      });

      if (!user) {
        return res.status(400).json({
          message: "Username atau Password Salah",
        });
      }

      const passwordMatch = await argon2.verify(user.user_password, password);
      if (!passwordMatch) {
        return res.status(400).json({
          message: "Username atau Password Salah",
        });
      }

      if (user.user_status === 0) {
        return res.status(400).json({
          message: "Akun belum diverifikasi",
        });
      }

      const omit = require("lodash/omit");

      const cleanUser = omit(user, ["user_password", "user_token"]);

      const token = generate(cleanUser);

      await prisma.user.update({
        where: {
          username,
        },
        data: {
          user_token: token,
        },
      });

      return res.status(200).json({
        message: "Login Berhasil",
        data: cleanUser,
        token,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  async loginMgt(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          message: "Username atau Password Salah",
        });
      }

      const user = await prisma.user. findUnique({
        include: {
          type: true,
        },
        where: {
          username,
          user_type: { in: [18,14,20,8] },
        },
      });

      if (!user) {
        return res.status(400).json({
          message: "Username atau Password Salah",
        });
      }

      const passwordMatch = await argon2.verify(user.user_password, password);
      if (!passwordMatch) {
        return res.status(400).json({
          message: "Username atau Password Salah",
        });
      }

      if (user.user_status === 0) {
        return res.status(400).json({
          message: "Akun belum diverifikasi",
        });
      }

      const omit = require("lodash/omit");

      const cleanUser = omit(user, ["user_password", "user_token"]);

      const token = generate(cleanUser);

      await prisma.user.update({
        where: {
          username,
        },
        data: {
          user_token: token,
        },
      });

      return res.status(200).json({
        message: "Login Berhasil",
        data: cleanUser,
        token,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  async registerUser(req, res) {
    try {
      const schema = z.object({
        email: z.string().email(),
        nama: z.string(),
        phone: z.string().min(10),
        type: z.number(),
      });

      const { email, nama, phone, type } = req.body;

      const body = await schema.safeParseAsync({
        email,
        nama,
        phone,
        type,
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

      const currentUser = await prisma.user.findFirst({
        where: {
          OR: [{ username: body.data.email }, { user_phone: body.data.phone }],
        },
      });

      if (currentUser) {
        return res.status(400).json({
          message: "User sudah terdaftar",
        });
      }

      const password = nanoid(10);
      const hashedPassword = await argon2.hash(password);

      //console.log({ password });

      await prisma.user.create({
        data: {
          user_password: hashedPassword,
          username: body.data.email,
          user_nama: body.data.nama,
          user_type: Number(body.data.type),
          user_status: 1,
          user_phone: body.data.phone,
        },
      });

      const templateEmail = generateTemplate({ email: body.data.email, password });
      const msgId = await sendEmail({
        email: body.data.email,
        html: templateEmail,
        subject: "Pendaftaran Ziswaf INDOSAT",
      });

      if (!msgId) {
        return res.status(400).json({
          message: "Gagal mengirim email",
        });
      }

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Daftar, silahkan cek email",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async updateUser(req, res) {
    try {
      const id = req.params.id;
      const { user_nama, user_phone, user_type } = req.body;

      if (!user_nama || !user_phone) {
        return res.status(400).json({
          message: "Nama, dan No.Hanphone harus diisi",
        });
      }

      await prisma.user.update({
        where: {
          user_id: Number(id),
        },
        data: {
          user_nama: user_nama,
          user_phone: user_phone,
          user_type: Number(user_type),
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

  async deleteUser(req, res) {
    try {
      const user_id = req.body.user_id;

      await prisma.user.delete({
        where: {
          user_id: Number(user_id),
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

  async detailUser(req, res) {
    try {
      const id = req.params.id;

      const user = await prisma.user.findUnique({
        where: {
          user_id: Number(id),
        },
        include: {
          institusi: true,
          mustahiq: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          message: "User tidak ditemukan",
        });
      }

      //const omit = require("lodash/omit");

      //const cleanUser = omit(user, ["user_password", "user_token"]);

      return res.status(200).json({
        message: "Sukses",
        data: user,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  async AllUser(req, res) {
    try {
      const userId = req.user_id;

      const user = await prisma.user.findMany({
        // where: {
        //   user_id: userId,
        // },
        include: {
          institusi: true,
          mustahiq: true,
          type: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          message: "User tidak ditemukan",
        });
      }

      //const omit = require("lodash/omit");

      //const cleanUser = omit(user, ["user_password", "user_token"]);

      return res.status(200).json({
        message: "Sukses",
        data: user,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  async getAllUser(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 4);
      const skip = (page - 1) * perPage;
      const keyword = req.query.keyword || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "user_id";
      const sortType = req.query.order || "desc";

      const params = {
        user_nama: {
          contains: keyword,
        },
        ...(user_type ? { user_type: Number(user_type) } : {}),
      };

      const [count, user] = await prisma.$transaction([
        prisma.user.count({
          where: params,
        }),
        prisma.user.findMany({
          include: {
            type: true,
          },
          orderBy: {
            [sortBy]: sortType,
          },
          where: params,
          skip,
          take: perPage,
        }),
      ]);

      const userResult = await Promise.all(
        user.map(async (item) => {
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

        data: userResult,
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
  async verifiedUser(req, res) {
    try {
      const id = req.params.id;
      const { status } = req.body;

      if (!id) {
        return res.status(400).json({
          message: "User Id Tidak Ada",
        });
      }
      if (!status) {
        return res.status(400).json({
          message: "Data Status Tidak Ada",
        });
      }

      await prisma.user.update({
        where: {
          user_id: Number(id),
        },
        data: {
          user_status: status,
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Verified User",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  async updateRoles(req, res) {
    try {
      const id = req.params.id;
      const { role } = req.body;

      if (!id) {
        return res.status(400).json({
          message: "User Id Tidak Ada",
        });
      }

      if (!role) {
        return res.status(400).json({
          message: "Role Id Tidak Ada",
        });
      }

      await prisma.user.update({
        where: {
          user_id: Number(id),
        },
        data: {
          user_type: role,
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
  async getDataType(req, res) {
    try {
      const userId = req.user_id;

      const type = await prisma.UserType.findMany({
        // where: {
        //   user_id: userId,
        // },
        // include: {
        //   institusi: true,
        //   mustahiq: true,
        //   type:true
        // },
      });

      //   if (!user) {
      //     return res.status(404).json({
      //       message: "User tidak ditemukan",
      //     });
      //   }

      //const omit = require("lodash/omit");

      //const cleanUser = omit(user, ["user_password", "user_token"]);

      return res.status(200).json({
        message: "Sukses",
        data: type,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  async getDataKategory(req, res) {
    try {
      
      const type = await prisma.program_category.findMany({
      
      });

      return res.status(200).json({
        message: "Sukses",
        data: type,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  async deleteToken(req, res) {
    try {
      const userId = req.body.user_id;

      await prisma.user.update({
        where: {
          user_id: Number(userId),
        },        
        data: {
          user_token: null,
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Update Token",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  //register user outlet
  // async registerUserOutlet(req, res) {
  //   try {
  //     const schema = z.object({        
  //       username: z.string()
  //     });

      
  //     const { username, password } = req.body;

  //     const body = await schema.safeParseAsync({
  //       username
  //     });

  //     let errorObj = {};

  //     if (body.error) {
  //       body.error.issues.forEach((issue) => {
  //         errorObj[issue.path[0]] = issue.message;
  //       });
  //       body.error = errorObj;
  //     }

  //     if (!body.success) {
  //       return res.status(400).json({
  //         message: "Beberapa Field Harus Diisi",
  //         error: errorObj,
  //       });
  //     }

  //     const currentUser = await prisma.outlet.findFirst({
  //       where: {
  //         username: body.data.username
  //       },
  //     });

  //     if (currentUser) {
  //       return res.status(400).json({
  //         message: "User sudah terdaftar",
  //       });
  //     }

  //     // const password = nanoid(10);
  //     // const hashedPassword = await argon2.hash(password);

  //     //console.log({ password });

  //     await prisma.user.create({
  //       data: {
  //         password: 
  //         username: body.data.email,
  //         user_nama: body.data.nama,
  //         user_type: Number(body.data.type),
  //         user_status: 1,
  //         user_phone: body.data.phone,
  //       },
  //     });

  //     const templateEmail = generateTemplate({ email: body.data.email, password });
  //     const msgId = await sendEmail({
  //       email: body.data.email,
  //       html: templateEmail,
  //       subject: "Pendaftaran Ziswaf INDOSAT",
  //     });

  //     if (!msgId) {
  //       return res.status(400).json({
  //         message: "Gagal mengirim email",
  //       });
  //     }

  //     return res.status(200).json({
  //       message: "Sukses",
  //       data: "Berhasil Daftar, silahkan cek email",
  //     });
  //   } catch (error) {
  //     return res.status(500).json({
  //       message: error?.message,
  //     });
  //   }
  // },

};
