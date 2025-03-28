const { generate } = require("../helper/auth-jwt");
const { prisma } = require("../../prisma/client");
const { z } = require("zod");
const { nanoid } = require("nanoid");
const argon2 = require("argon2");
const { generateTemplate, sendEmail, generateTemplateForgotEmail } = require("../helper/email");
const crypto = require("node:crypto");
const md5 = require("md5");

module.exports = {
  // LOGIN USER
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
          user_type: { in: [10, 11, 15, 16] },
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
        type: z.string(),
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

      console.log({ password });

      await prisma.user.create({
        data: {
          user_password: hashedPassword,
          username: body.data.email,
          user_nama: body.data.nama,
          user_type: Number(body.data.type),
          user_status: 0,
          user_phone: body.data.phone,
        },
      });

      const templateEmail = generateTemplate({
        email: body.data.email,
        password,
      });
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
      const userId = req.user_id;
      const { nama, phone, bank_name, bank_number, bank_account_name } = req.body;

      if (!nama || !phone) {
        return res.status(400).json({
          message: "Nama, dan Nomor Telepon harus diisi",
        });
      }

      const proposal = await prisma.proposal.findFirst({
        where: {
          user_id: userId,
          OR: [
            { approved: { notIn: [1, 2] } }, // Jika approved bukan 1 atau 2 (masih dalam proses approval)
            { approved: 1, ispaid: { not: 1 } } // Jika sudah approved (1), pastikan ispaid = 1
          ]
        }
      });

      if (proposal) {
        return res.status(400).json({
          message: "Anda masih memiliki proposal yang sedang dalam proses approval",
        });
      }

      const mustahiq = await prisma.user.findUnique({
        where: {
          user_id: userId,
        },
        select: {
          mustahiq_id: true,
        }
      });

      if (!mustahiq || !mustahiq.mustahiq_id) {
        return res.status(400).json({
          message: "Belum melengkapi data diri, coba refresh halaman",
        });
      }

      await prisma.user.update({
        where: {
          user_id: userId,
        },
        data: {
          user_nama: nama,
          user_phone: phone,
        },
      });

      await prisma.mustahiq.update({
        where: {
          id: mustahiq.mustahiq_id,
        },
        data: {
          bank_number,
          bank_name,
          bank_account_name
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

  async updatePasswordWithAuth(req, res) {
    try {
      const userId = req.user_id;
      const { password, newPassword } = req.body;

      if (!password || !newPassword) {
        return res.status(400).json({
          message: "Password, dan Password Baru harus diisi",
        });
      }

      const user = await prisma.user.findUnique({
        where: {
          user_id: userId,
        },
      });

      if (!user) {
        return res.status(400).json({
          message: "User tidak ditemukan",
        });
      }

      const passwordMatch = await argon2.verify(user.user_password, password);
      if (!passwordMatch) {
        return res.status(400).json({
          message: "Password Lama salah",
        });
      }

      const hashedPassword = await argon2.hash(newPassword);

      await prisma.user.update({
        where: {
          user_id: userId,
        },
        data: {
          user_password: hashedPassword,
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Ganti Password",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async forgotPassword(req, res) {
    try {
      const email = req.body.email;

      if (!email) {
        return res.status(400).json({
          message: "Email harus diisi",
        });
      }

      const user = await prisma.user.findUnique({
        where: {
          username: email,
        },
      });

      // if (!user) {
      //   return res.status(400).json({
      //     message: "User tidak ditemukan",
      //   });
      // }

      const randomToken = crypto.randomBytes(32).toString("hex");
      console.log(randomToken);

      await prisma.password_token.upsert({
        where: {
          user_id: user.user_id,
        },
        create: {
          token: randomToken,
          user_id: user.user_id,
        },
        update: {
          token: randomToken,
        },
      });

      const templateEmail = generateTemplateForgotEmail({
        email: user.username,
        token: randomToken,
      });

      const msgId = await sendEmail({
        email: user.username,
        html: templateEmail,
        subject: "Reset Password Ziswaf INDOSAT",
      });

      if (!msgId) {
        return res.status(400).json({
          message: "Gagal mengirim email",
        });
      }

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Kirim Email",
      });
    } catch (error) {
      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Kirim Email",
      });
    }
  },

  async resetPassword(req, res) {
    try {
      const { token, email, password } = req.body;

      if (!token || !email) {
        return res.status(400).json({
          message: "Gagal reset password, token tidak valid",
        });
      }

      const user = await prisma.user.findUnique({
        where: {
          username: email,
        },
      });

      if (!user) {
        return res.status(400).json({
          message: "Gagal reset password, token tidak valid",
        });
      }

      const passwordToken = await prisma.password_token.findUnique({
        where: {
          token,
          user_id: user.user_id,
        },
      });

      if (!passwordToken) {
        return res.status(400).json({
          message: "Gagal reset password, token tidak valid",
        });
      }

      if (!password) {
        return res.status(400).json({
          message: "Password harus diisi",
        });
      }

      const hashedPassword = await argon2.hash(password);

      await prisma.user.update({
        where: {
          username: email,
        },
        data: {
          user_password: hashedPassword,
        },
      });

      await prisma.password_token.delete({
        where: {
          user_id: user.user_id,
          token: passwordToken.token,
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Reset Password",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async resetPasswordErp(req, res) {
    try {
      const { password } = req.body;
      const { user_id } = req.params; // Corrected this line to get user_id directly from req.params

      // Check if password is missing
      if (!password) {
        return res.status(400).json({
          message: "Gagal reset password, password harus diisi",
        });
      }

      // Find user by user_id
      const user = await prisma.user.findUnique({
        where: {
          user_id: Number(user_id), // Ensure the user_id is a number if it's not a string
        },
      });

      // If user not found
      if (!user) {
        return res.status(400).json({
          message: "Gagal reset password, user tidak ditemukan",
        });
      }

      // Hash the new password
      const hashedPassword = await argon2.hash(password);

      // Update the user's password
      await prisma.user.update({
        where: {
          user_id: Number(user_id), // Use user_id in the update query
        },
        data: {
          user_password: hashedPassword,
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Reset Password",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async verifiedUser(req, res) {
    try {
      const email = req.body.email;

      const user = await prisma.user.findUnique({
        where: {
          username: email,
        },
      });

      if (!user) {
        return res.status(400).json({
          message: "User tidak ditemukan",
        });
      }

      await prisma.user.update({
        where: {
          username: email,
        },
        data: {
          user_status: 1,
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Verifikasi",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async detailUser(req, res) {
    try {
      const userId = req.user_id;

      const user = await prisma.user.findUnique({
        where: {
          user_id: userId,
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

      const omit = require("lodash/omit");

      const cleanUser = omit(user, ["user_password", "user_token"]);

      return res.status(200).json({
        message: "Sukses",
        data: cleanUser,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getNotifications(req, res) {
    try {
      const userId = req.user_id;

      const notifications = await prisma.notification.findMany({
        where: {
          user_id: userId,
        },
        include: {
          program: true,
          transaction: true,
        },
      });

      return res.status(200).json({
        message: "Sukses",
        data: notifications,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  //outlet login
  async loginOutlet(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          message: "Username atau Password Salah",
        });
      }

      // Menemukan user outlet berdasarkan username dan password
      const user = await prisma.outlet.findUnique({
        where: {
          username,
          password: md5(password),
        },
      });

      if (!user) {
        return res.status(400).json({
          message: "Username atau Password Salah",
        });
      }

      // Memastikan akun outlet aktif
      if (user.status === 0) {
        return res.status(400).json({
          message: "Akun Anda Tidak Aktif",
        });
      }

      // Menghilangkan data sensitif (seperti password dan token)
      const omit = require("lodash/omit");
      const cleanUser = omit(user, ["password", "token"]);

      // Membuat token menggunakan fungsi generate
      const token = generate(cleanUser);

      // Menyimpan token di database
      await prisma.outlet.update({
        where: {
          username,
        },
        data: {
          token: token,
        },
      });

      // Menghitung total donasi untuk outlet yang login
      const totalDonasi = await prisma.register_donasi.aggregate({
        _sum: {
          nominal: true,
        },
        where: {
          id_outlet: user.id,
          transaction_status: "settlement", // hanya transaksi yang berhasil
        },
      });

      const totalDonasiFormatted = totalDonasi._sum.nominal
        ? `Rp ${totalDonasi._sum.nominal
          .toString()
          .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`
        : "Rp 0";

      // Mengirimkan respons login berhasil dengan data pengguna dan total donasi
      return res.status(200).json({
        message: "Login Berhasil",
        data: {
          ...cleanUser,
          total_donasi: totalDonasiFormatted, // menambahkan total donasi
        },
        token,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
};
