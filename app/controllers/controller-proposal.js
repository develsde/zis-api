const { prisma } = require("../../prisma/client");
const fs = require("fs");
const { subMonths, subDays, format, endOfMonth } = require('date-fns');
const { some } = require("lodash");
const { sendWhatsapp } = require("../helper/whatsapp");
const phoneFormatter = require('phone-formatter');
const parsenik = require("parsenik");
const { sendImkas, checkImkas } = require("../helper/imkas");
const { generateTemplateProposalBayar, sendEmail } = require("../helper/email");

module.exports = {
  async details(req, res) {
    const userId = req.user_id;

    return res.status(200).json({
      userId,
    });
  },
  async createProposal(req, res) {
    try {
      const userId = req.user_id;
      const program_id = req.body.program_id;
      const proposal_kategori = req.body.proposal_kategori;
      const nik_mustahiq = req.body.nik_mustahiq;
      const nama = req.body.nama;
      const alamat_rumah = req.body.alamat_rumah;
      const kode_pos = req.body.kode_pos;
      const status_domisili = req.body.status_domisili;
      const tgl_lahir = req.body.tgl_lahir;
      const tempat_lahir = req.body.tempat_lahir;
      const jenis_kelamin = req.body.jenis_kelamin;
      const status_rumah = req.body.status_rumah;
      const status_pernikahan = req.body.status_pernikahan;
      const jumlah_anak = req.body.jumlah_anak;
      const penghasilan_bulanan = req.body.penghasilan_bulanan;
      const nama_pasangan = req.body.nama_pasangan;
      const pekerjaan = req.body.pekerjaan;
      const pendidikan_terakhir = req.body.pendidikan_terakhir;
      const nama_sekolah_universitas = req.body.nama_sekolah_universitas;
      const fakultas = req.body.fakultas;
      const jurusan = req.body.jurusan;
      const kelas_semester_saat_ini = req.body.kelas_semester_saat_ini;
      const alamat_sekolah_kampus = req.body.alamat_sekolah_kampus;
      const nomor_telp_sekolah_kampus = req.body.nomor_telp_sekolah_kampus;
      const tempat_mengajar = req.body.tempat_mengajar;
      const alamat_mengajar = req.body.alamat_mengajar;
      const sebagai_guru = req.body.sebagai_guru;
      const biaya_pendidikan_bulanan = req.body.biaya_pendidikan_bulanan;
      const jumlah_tanggungan = req.body.jumlah_tanggungan;
      const organisasi_yang_diikuti = req.body.organisasi_yang_diikuti;
      const nama_ayah = req.body.nama_ayah;
      const pekerjaan_ayah = req.body.pekerjaan_ayah;
      const penghasilan_bulanan_ayah = req.body.penghasilan_bulanan_ayah;
      const nama_ibu = req.body.nama_ibu;
      const pekerjaan_ibu = req.body.pekerjaan_ibu;
      const penghasilan_bulanan_ibu = req.body.penghasilan_bulanan_ibu;
      const jenis_bantuan_kesehatan = req.body.jenis_bantuan_kesehatan;
      const bantuan_pihak_lain = req.body.bantuan_pihak_lain;
      const nominal_bantuan = req.body.nominal_bantuan;
      const biaya_hidup_bulanan = req.body.biaya_hidup_bulanan;
      const nama_pemberi_rekomendasi = req.body.nama_pemberi_rekomendasi;
      const alamat_pemberi_rekomendasi = req.body.alamat_pemberi_rekomendasi;
      const no_telp_pemberi_rekomendasi = req.body.no_telp_pemberi_rekomendasi;
      const dana_yang_diajukan = req.body.dana_yang_diajukan;

      //console.log(JSON.stringify(req.body))
      const niks = Number(nik_mustahiq);
      const validasi = parsenik.parse(niks);
      console.log(validasi);
      if (!nik_mustahiq) {
        return res.status(400).json({ message: "NIK wajib diisi" });
      } else if (!nama) {
        return res.status(400).json({ message: "Nama wajib diisi" });
      } else if (!userId) {
        return res.status(400).json({ message: "User ID wajib diisi" });
      } else if (!program_id) {
        return res.status(400).json({ message: "Program ID wajib diisi" });
      } else if (!proposal_kategori) {
        return res
          .status(400)
          .json({ message: "Kategori Proposal wajib diisi" });
      } else if (!nama_pemberi_rekomendasi) {
        return res
          .status(400)
          .json({ message: "Nama Pemberi Rekomendasi wajib diisi" });
      } else if (!alamat_pemberi_rekomendasi) {
        return res
          .status(400)
          .json({ message: "Alamat Pemberi Rekomendasi wajib diisi" });
      } else if (!no_telp_pemberi_rekomendasi) {
        return res
          .status(400)
          .json({ message: "Nomor Telepon Pemberi Rekomendasi wajib diisi" });
      } else if (validasi.valid === false) {
        return res.status(400).json({ message: "NIK tidak valid" });
      }

      const files = {};
      for (let i = 1; i <= 7; i++) {
        const file = req.files[`lampiran${i}`];
        console.log(file);
        if (file) {
          console.log(file?.[0]);
          files[`lampiran${i}`] = "uploads/" + file?.[0].filename;
        }
      }

      const program = await prisma.program.findUnique({
        where: {
          program_id: Number(program_id),
        },
        select: {
          program_title: true,
        },
      });

      const imkas = await prisma.user.findUnique({
        where: {
          user_id: Number(userId),
        },
        select: {
          mustahiq: true,
        },
      });

      const imkas_number = imkas ? imkas.mustahiq.imkas_number : "";
      const imkas_name = imkas ? imkas.mustahiq.nama_imkas : "";

      const users = await prisma.institusi.findMany();
      const institute = users.filter(
        (data) => data.institusi_user_id === userId
      );

      const currentDate = new Date();
      const formattedDate = currentDate
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      const empatnik = nik_mustahiq.slice(-4);
      const no_proposal = formattedDate + empatnik;
      const sixMonthsAgo = subMonths(new Date(), 6);
      const aDayAgo = subDays(new Date(), 1);

      if (institute < 1) {
        const existingProposal = await prisma.proposal.findFirst({
          where: {
            program_id: Number(program_id),
            program: {
              program_category_id: { in: [1, 2, 4] },
            },
            nik_mustahiq,
            create_date: {
              gte: sixMonthsAgo,
            },
            approved: {
              not: 2,
            },
          },
        });
        if (existingProposal) {
          return res.status(400).json({
            message:
              "Anda telah mengajukan proposal pada program berikut dalam kurun waktu 6 bulan",
          });
        }
      } else {
        const existingProposal = await prisma.proposal.findFirst({
          where: {
            program_id: Number(program_id),
            program: {
              program_category_id: { in: [1, 2, 4] },
            },
            nik_mustahiq,
            create_date: {
              gte: aDayAgo,
            },
            approved: {
              not: 2,
            },
          },
        });
        if (existingProposal) {
          return res.status(400).json({
            message:
              "Anda telah mengajukan proposal pada program berikut dan baru dapat mengajukan kembali setelah 1 hari",
          });
        }
      }

      const program_title = program
        ? program.program_title
        : "Program tidak terdaftar";

      const ProposalResult = await prisma.proposal.create({
        data: {
          user: {
            connect: {
              user_id: Number(userId),
            },
          },
          program: {
            connect: {
              program_id: Number(program_id),
            },
          },
          proposal_kategori: Number(proposal_kategori),
          nik_mustahiq,
          no_proposal,
          nama,
          alamat_rumah,
          kode_pos,
          status_domisili: Number(status_domisili),
          tgl_lahir,
          tempat_lahir,
          jenis_kelamin: Number(jenis_kelamin),
          status_rumah: Number(status_rumah),
          status_pernikahan: Number(status_pernikahan),
          jumlah_anak: Number(jumlah_anak),
          penghasilan_bulanan: Number(penghasilan_bulanan),
          nama_pasangan,
          pekerjaan,
          pendidikan_terakhir: Number(pendidikan_terakhir),
          nama_sekolah_universitas,
          fakultas,
          jurusan,
          kelas_semester_saat_ini,
          alamat_sekolah_kampus,
          nomor_telp_sekolah_kampus,
          tempat_mengajar,
          alamat_mengajar,
          sebagai_guru,
          biaya_pendidikan_bulanan: Number(biaya_pendidikan_bulanan),
          jumlah_tanggungan: Number(jumlah_tanggungan),
          organisasi_yang_diikuti,
          nama_ayah,
          pekerjaan_ayah,
          penghasilan_bulanan_ayah: Number(penghasilan_bulanan_ayah),
          nama_ibu,
          pekerjaan_ibu,
          penghasilan_bulanan_ibu: Number(penghasilan_bulanan_ibu),
          jenis_bantuan_kesehatan,
          bantuan_pihak_lain,
          nominal_bantuan: Number(nominal_bantuan),
          biaya_hidup_bulanan: Number(biaya_hidup_bulanan),
          dana_yang_diajukan: Number(dana_yang_diajukan),
          nama_pemberi_rekomendasi,
          alamat_pemberi_rekomendasi,
          no_telp_pemberi_rekomendasi,
          nomor_imkas: imkas_number,
          nama_imkas: imkas_name,
          ...files,
        },
      });

      if (ProposalResult) {
        let pn = no_telp_pemberi_rekomendasi;
        pn = pn.replace(/\D/g, "");
        if (pn.substring(0, 1) == "0") {
          pn = "0" + pn.substring(1).trim();
        } else if (pn.substring(0, 3) == "62") {
          pn = "0" + pn.substring(3).trim();
        }

        const msgId = await sendWhatsapp({
          wa_number: pn.replace(/[^0-9\.]+/g, ""),
          text:
            "Proposal Atas Nama " +
            nama +
            " dan NIK " +
            nik_mustahiq +
            " pada program " +
            program_title +
            " telah kami terima. Mohon lakukan konfirmasi kepada kami apabila terjadi duplikasi maupun kesalahan pada proposal. Terima kasih",
        });
      }

      return res.status(200).json({
        message: "Sukses",
        data: ProposalResult,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async createProposalErp(req, res) {
    try {
      const userId = req.user_id;
      const program_id = req.body.program_id;
      const proposal_kategori = req.body.proposal_kategori;
      const nik_mustahiq = "1234567812345678";
      const nama = req.body.nama;
      const alamat_rumah = req.body.alamat_rumah;
      const nama_pemberi_rekomendasi = req.body.nama_pemberi_rekomendasi;
      const no_telp_pemberi_rekomendasi = req.body.no_telp_pemberi_rekomendasi;
      const dana_yang_diajukan = req.body.dana_yang_diajukan;
      const nomor_imkas = req.body.nomor_imkas;
      const nama_imkas = req.body.nama_imkas;

      //console.log(JSON.stringify(req.body))
      const niks = Number(nik_mustahiq);
      const validasi = parsenik.parse(niks);
      console.log(validasi);
      if (!nama) {
        return res.status(400).json({ message: "Nama wajib diisi" });
      } else if (!userId) {
        return res.status(400).json({ message: "User ID wajib diisi" });
      } else if (!program_id) {
        return res.status(400).json({ message: "Program ID wajib diisi" });
      } else if (!no_telp_pemberi_rekomendasi) {
        return res
          .status(400)
          .json({ message: "Nomor Telepon Pemberi Rekomendasi wajib diisi" });
      }

      const files = {};
      for (let i = 1; i <= 7; i++) {
        const file = req.files[`lampiran${i}`];
        console.log(file);
        if (file) {
          console.log(file?.[0]);
          files[`lampiran${i}`] = "uploads/" + file?.[0].filename;
        }
      }

      const program = await prisma.program.findUnique({
        where: {
          program_id: Number(program_id),
        },
        select: {
          program_title: true,
        },
      });

      const users = await prisma.institusi.findMany();
      const institute = users.filter(
        (data) => data.institusi_user_id === userId
      );

      const currentDate = new Date();
      const formattedDate = currentDate
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      const empatnik = "0104";
      const no_proposal = formattedDate + empatnik;
      const sixMonthsAgo = subMonths(new Date(), 6);
      const aDayAgo = subDays(new Date(), 1);

      // if (institute < 1) {
      //   const existingProposal = await prisma.proposal.findFirst({
      //     where: {
      //       program_id: Number(program_id),
      //       program: {
      //         program_category_id: { in: [1, 2, 4] },
      //       },
      //       nik_mustahiq,
      //       create_date: {
      //         gte: sixMonthsAgo,
      //       },
      //       approved: {
      //         not: 2,
      //       },
      //     },
      //   });
      //   if (existingProposal) {
      //     return res.status(400).json({
      //       message: "Anda telah mengajukan proposal pada program berikut dalam kurun waktu 6 bulan",
      //     });
      //   }
      // } else {
      //   const existingProposal = await prisma.proposal.findFirst({
      //     where: {
      //       program_id: Number(program_id),
      //       program: {
      //         program_category_id: { in: [1, 2, 4] },
      //       },
      //       nik_mustahiq,
      //       create_date: {
      //         gte: aDayAgo,
      //       },
      //       approved: {
      //         not: 2,
      //       },
      //     },
      //   });
      //   if (existingProposal) {
      //     return res.status(400).json({
      //       message: "Anda telah mengajukan proposal pada program berikut dan baru dapat mengajukan kembali setelah 1 hari",
      //     });
      //   }
      // }

      const program_title = program
        ? program.program_title
        : "Program tidak terdaftar";

      let pn = nomor_imkas;
      if (pn.substring(0, 1) == "0") {
        pn = "0" + pn.substring(1).trim();
      } else if (pn.substring(0, 3) == "+62") {
        pn = "0" + pn.substring(3).trim();
      }
      console.log(pn);
      console.log(pn.replace(/[^0-9\.]+/g, ""));
      const checks = await sendImkas({
        phone: pn.replace(/[^0-9\.]+/g, ""),
        nom: "50",
        id: `10${userId}${Date.now()}`,
        desc: "Pengecekan Nomor",
      });
      const log = await prisma.log_vendor.create({
        data: {
          vendor_api: checks?.config?.url,
          url_api: req.originalUrl,
          api_header: JSON.stringify(checks.headers),
          api_body: checks?.config?.data,
          api_response: JSON.stringify(checks.data),
          payload: JSON.stringify(req.body),
        },
      });
      const check = checks?.data;
      console.log(check);

      if (check.responseCode != "00") {
        return res.status(400).json({ message: check.responseDescription });
      }

      if (check.responseCode == "00") {
        const ProposalResult = await prisma.proposal.create({
          data: {
            user: {
              connect: {
                user_id: Number(userId),
              },
            },
            program: {
              connect: {
                program_id: Number(program_id),
              },
            },
            proposal_kategori: Number(proposal_kategori),
            nik_mustahiq,
            no_proposal,
            nama,
            alamat_rumah,
            dana_yang_diajukan: Number(dana_yang_diajukan),
            nama_pemberi_rekomendasi,
            no_telp_pemberi_rekomendasi,
            nomor_imkas,
            nama_imkas,
            ...files,
          },
        });

        if (ProposalResult) {
          let pn = no_telp_pemberi_rekomendasi;
          pn = pn.replace(/\D/g, "");
          if (pn.substring(0, 1) == "0") {
            pn = "0" + pn.substring(1).trim();
          } else if (pn.substring(0, 3) == "62") {
            pn = "0" + pn.substring(3).trim();
          }

          const msgId = await sendWhatsapp({
            wa_number: pn.replace(/[^0-9\.]+/g, ""),
            text:
              "Proposal Atas Nama " +
              nama +
              " dan NIK " +
              nik_mustahiq +
              " pada program " +
              program_title +
              " telah kami terima. Mohon lakukan konfirmasi kepada kami apabila terjadi duplikasi maupun kesalahan pada proposal. Terima kasih",
          });
        }

        return res.status(200).json({
          message: "Sukses",
          data: ProposalResult,
        });
      }
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async doneProposal(req, res) {
    try {
      const id = req.params.id;
      const ispaid = req.body.ispaid;
      const nama = req.body.nama;
      const ref = req.body.ref;
      const tgl_bayar = new Date();

      const proposalss = await prisma.proposal.findUnique({
        where: {
          id: Number(id),
        },
      });
      const userss = await prisma.user.findUnique({
        where: {
          user_id: proposalss.user_id,
        },
        include: {
          mustahiq: true,
        },
      });

      let imkas = proposalss.nomor_imkas;
      if (imkas.substring(0, 1) == "0") {
        imkas = "0" + imkas.substring(1).trim();
      } else if (imkas.substring(0, 3) == "+62") {
        imkas = "0" + imkas.substring(3).trim();
      }
      // const saldo = await checkImkas();
      // console.log(saldo);
      // const wow = await prisma.log_vendor.create({
      //   data: {
      //     vendor_api: saldo?.config?.url,
      //     url_api: req.originalUrl,
      //     api_header: JSON.stringify(saldo.headers),
      //     api_body: saldo?.config?.data,
      //     api_response: JSON.stringify(saldo.data),
      //     payload: JSON.stringify(req.body),
      //   },
      // });
      // const checks = await sendImkas({
      //   phone: imkas.replace(/[^0-9\.]+/g, ""),
      //   nom: proposalss.dana_yang_disetujui,
      //   id: id,
      //   desc: "Dana telah dikirimkan",
      // });
      // const log = await prisma.log_vendor.create({
      //   data: {
      //     vendor_api: checks?.config?.url,
      //     url_api: req.originalUrl,
      //     api_header: JSON.stringify(checks.headers),
      //     api_body: checks?.config?.data,
      //     api_response: JSON.stringify(checks.data),
      //     payload: JSON.stringify(req.body),
      //   },
      // });
      // const check = checks?.data
      // console.log(check);
      // const saldos = await checkImkas();
      // console.log(saldos);
      // const wows = await prisma.log_vendor.create({
      //   data: {
      //     vendor_api: saldos?.config?.url,
      //     url_api: req.originalUrl,
      //     api_header: JSON.stringify(saldos.headers),
      //     api_body: saldos?.config?.data,
      //     api_response: JSON.stringify(saldos.data),
      //     payload: JSON.stringify(req.body),
      //   },
      // });

      // if (check.responseCode != '00') {
      //   return res.status(400).json({ message: check.responseDescription });
      // }

      // if (check.responseCode == '00') {

      const proposal = await prisma.proposal.update({
        where: {
          id: Number(id),
        },
        data: {
          ispaid,
          tgl_bayar,
        },
        include: {
          user: {
            select: {
              mustahiq: true,
            },
          },
        },
      });

      const currentDate = new Date();
      const formattedDate = currentDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      if (!proposal) {
        return res.status(400).json({
          message: "Proposal tidak ditemukan",
        });
      }

      if (ispaid == 1) {
        let pn = ref;
        if (pn.substring(0, 1) == "0") {
          pn = "0" + pn.substring(1).trim();
        } else if (pn.substring(0, 3) == "+62") {
          pn = "0" + pn.substring(3).trim();
        }

        const formattedDana = proposal.dana_yang_disetujui.toLocaleString(
          "id-ID",
          { style: "currency", currency: "IDR" }
        );

        const msgId = await sendWhatsapp({
          wa_number: pn.replace(/[^0-9\.]+/g, ""),
          text: `Proposal Atas Nama ${nama} telah disetujui dan telah ditransfer pada ${formattedDate} sejumlah ${formattedDana} ke nomor IMKas ${proposal.user.mustahiq.imkas_number} anda. Terima kasih`,
        });
        // }
      }
      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Ubah Data",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async sudahBayar(req, res) {
    try {
      const id = req.params.id;
      const ispaid = req.body.ispaid;
      const nama = req.body.nama;
      const ref = req.body.ref;
      const tgl_bayar = new Date();

      const proposal = await prisma.proposal.update({
        where: {
          id: Number(id),
        },
        data: {
          ispaid,
          tgl_bayar,
        },
        include: {
          user: {
            select: {
              mustahiq: true,
              username: true,
            },
          },
        },
      });

      const currentDate = new Date();
      const formattedDate = currentDate.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      if (!proposal) {
        return res.status(400).json({
          message: "Proposal tidak ditemukan",
        });
      }

      if (ispaid == 1) {
        let pn = ref;
        if (pn.substring(0, 1) == "0") {
          pn = "0" + pn.substring(1).trim();
        } else if (pn.substring(0, 3) == "+62") {
          pn = "0" + pn.substring(3).trim();
        }

        const formattedDana = proposal.dana_yang_disetujui.toLocaleString(
          "id-ID",
          { style: "currency", currency: "IDR" }
        );

        // const msgId = await sendWhatsapp({
        //   wa_number: pn.replace(/[^0-9\.]+/g, ""),
        //   text: `Proposal Atas Nama ${nama} telah disetujui dan telah ditransfer pada ${formattedDate} sejumlah ${formattedDana} ke nomor Rekening atau Rekening ${proposal.user.mustahiq.bank_number} a.n ${proposal.user.mustahiq.bank_account_name} . Terima kasih`,
        // });

        try {
          const templateEmail = await generateTemplateProposalBayar({
            nama,
            formattedDate,
            formattedDana,
            bank_number: proposal.user.mustahiq.bank_number || '-',
            bank_account_name: proposal.user.mustahiq.bank_account_name || '-'
          });

          const msgId = await sendEmail({
            email: proposal.user.username,
            html: templateEmail,
            subject: "Pembayaran Proposal Telah Berhasil Ditransfer"
          });

          console.log(`Email send success`);
          return res.status(200).json({
            success: true,
            message: `Email berhasil dikirim`,
            msgId: msgId,
          });
        } catch (error) {
          console.error(
            `Gagal membuat atau mengirim email, error:`,
            error
          );
          return res.status(500).json({
            success: false,
            message: `Gagal mengirim email`,
            error: error.message,
          });
        }

      }
      return res.status(200).json({
        message: "Sukses",
        data: "Berhasil Ubah Data",
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  //////////////////
  async updateProposal(req, res) {
    try {
      const id = req.params.id;
      //const userId = req.user_id;
      const {
        program_id,
        user_id,
        proposal_kategori,
        nama,
        alamat_rumah,
        kode_pos,
        status_domisili,
        tgl_lahir,
        tempat_lahir,
        jenis_kelamin,
        status_rumah,
        status_pernikahan,
        jumlah_anak,
        penghasilan_bulanan,
        nama_pasangan,
        pekerjaan,
        pendidikan_terakhir,
        nama_sekolah_universitas,
        fakultas,
        jurusan,
        kelas_semester_saat_ini,
        alamat_sekolah_kampus,
        nomor_telp_sekolah_kampus,
        tempat_mengajar,
        alamat_mengajar,
        sebagai_guru,
        biaya_pendidikan_bulanan,
        jumlah_tanggungan,
        organisasi_yang_diikuti,
        nama_ayah,
        pekerjaan_ayah,
        penghasilan_bulanan_ayah,
        nama_ibu,
        pekerjaan_ibu,
        penghasilan_bulanan_ibu,
        jenis_bantuan_kesehatan,
        bantuan_pihak_lain,
        nominal_bantuan,
        biaya_hidup_bulanan,
        nama_pemberi_rekomendasi,
        alamat_pemberi_rekomendasi,
        no_telp_pemberi_rekomendasi,
        dana_yang_diajukan,
        dana_yang_disetujui,
        dana_approval,
        approved,
        status_bayar,
        all_notes,
      } = req.body;

      //console.log(JSON.stringify(req.body))

      if (
        !nama ||
        !id ||
        !user_id ||
        !program_id ||
        // !proposal_kategori ||
        // !nama_pemberi_rekomendasi ||
        // !alamat_pemberi_rekomendasi ||
        !no_telp_pemberi_rekomendasi
      ) {
        return res.status(400).json({
          message:
            "Nama, dan Program Id, Kategori Proposal, nama alamat dan nomor telepon pemberi rekomendasi wajib diisi",
        });
      }

      const existingProposal = await prisma.proposal.findUnique({
        where: {
          id: Number(id),
        },
        select: {
          all_notes: true,
        },
      });

      if (!existingProposal) {
        return res.status(404).json({
          message: "Proposal not found",
        });
      }

      let updatedNotes = "";
      if (existingProposal.all_notes === null) {
        updatedNotes = all_notes;
      } else {
        updatedNotes = `${existingProposal.all_notes}; ${all_notes}`;
      }

      const ProposalResult = await prisma.proposal.update({
        where: {
          id: Number(id),
        },
        data: {
          proposal_kategori: Number(proposal_kategori),
          nama,
          alamat_rumah,
          kode_pos,
          status_domisili: Number(status_domisili),
          tgl_lahir,
          tempat_lahir,
          jenis_kelamin: Number(jenis_kelamin),
          status_rumah: Number(status_rumah),
          status_pernikahan: Number(status_pernikahan),
          jumlah_anak: Number(jumlah_anak),
          penghasilan_bulanan: Number(penghasilan_bulanan),
          nama_pasangan,
          pekerjaan,
          pendidikan_terakhir: Number(pendidikan_terakhir),
          nama_sekolah_universitas,
          fakultas,
          jurusan,
          kelas_semester_saat_ini,
          alamat_sekolah_kampus,
          nomor_telp_sekolah_kampus,
          tempat_mengajar,
          alamat_mengajar,
          sebagai_guru,
          biaya_pendidikan_bulanan: Number(biaya_pendidikan_bulanan),
          jumlah_tanggungan: Number(jumlah_tanggungan),
          organisasi_yang_diikuti,
          nama_ayah,
          pekerjaan_ayah,
          penghasilan_bulanan_ayah: Number(penghasilan_bulanan_ayah),
          nama_ibu,
          pekerjaan_ibu,
          penghasilan_bulanan_ibu: Number(penghasilan_bulanan_ibu),
          jenis_bantuan_kesehatan,
          bantuan_pihak_lain,
          nominal_bantuan: Number(nominal_bantuan),
          biaya_hidup_bulanan: Number(biaya_hidup_bulanan),
          dana_yang_diajukan: Number(dana_yang_diajukan),
          nama_pemberi_rekomendasi,
          alamat_pemberi_rekomendasi,
          no_telp_pemberi_rekomendasi,
          dana_yang_disetujui: dana_yang_disetujui
            ? Number(dana_yang_disetujui)
            : undefined,
          dana_approval: dana_approval ? Number(dana_approval) : undefined,
          approved: approved ? Number(approved) : undefined,
          status_bayar,
          all_notes: updatedNotes,
        },
      });

      return res.status(200).json({
        message: "Sukses Update Proposal",
        data: ProposalResult,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async approvalProposal(req, res) {
    try {
      const userId = req.user_id;

      const { proposal_id, status, amount } = req.body;

      //console.log(JSON.stringify(req.body))

      const appResult = await prisma.proposal_approval.create({
        data: {
          proposal: {
            connect: {
              id: Number(proposal_id),
            },
          },
          user: {
            connect: {
              user_id: Number(userId),
            },
          },
          status,
          amount: Number(amount),
        },
      });

      if (status == 2) {
        const updateStatusAll = await prisma.proposal.update({
          where: {
            id: Number(proposal_id),
          },
          data: {
            approved: 2,
          },
        });
      }

      return res.status(200).json({
        message: "Approva",
        data: appResult,
      });
    } catch (error) {
      return res.status(500).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  async getAllProposal(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 0);
      const skip = (page - 1) * perPage;
      const keyword = req.query.nama || "";
      const bulan = Number(req.query.bulan || 0);
      const tahun = Number(req.query.tahun || new Date().getFullYear()); // Menggunakan tahun saat ini sebagai default
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "create_date";
      const sortType = req.query.order || "desc";

      const params = {
        nama: {
          contains: keyword,
        },
        status_bayar: 0,
        approved: 0,
      };

      const params_waitpayment = {
        nama: {
          contains: keyword,
        },
        status_bayar: 0,
        approved: 1,
      };

      const params_siapbayar = {
        nama: {
          contains: keyword,
        },
        status_bayar: 1,
        approved: 1,
        ispaid: 0,
      };

      const params_paid = {
        nama: {
          contains: keyword,
        },
        status_bayar: 1,
        approved: 1,
        ispaid: 1,
      };

      const params_tolak = {
        nama: {
          contains: keyword,
        },
        status_bayar: 0,
        approved: 2,
      };

      if (bulan === 0 && tahun !== 0) {
        params.create_date = {
          gte: format(new Date(tahun, 0, 1), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"),
          lte: format(
            endOfMonth(new Date(tahun, 11)),
            "yyyy-MM-dd'T'23:59:59.999xxx"
          ),
        };
        params_waitpayment.create_date = params.create_date;
        params_siapbayar.create_date = params.create_date;
        params_paid.create_date = params.create_date;
        params_tolak.create_date = params.create_date;
      }

      if (bulan !== 0) {
        params.create_date = {
          gte: format(
            new Date(tahun, bulan - 1, 1),
            "yyyy-MM-dd'T'HH:mm:ss.SSSxxx"
          ),
          lte: format(
            endOfMonth(new Date(tahun, bulan - 1)),
            "yyyy-MM-dd'T'23:59:59.999xxx"
          ),
        };
        params_waitpayment.create_date = params.create_date;
        params_siapbayar.create_date = params.create_date;
        params_paid.create_date = params.create_date;
        params_tolak.create_date = params.create_date;
      }

      let whereclaus = "";
      if (status === 0) {
        whereclaus = params;
      } else if (status === 1) {
        whereclaus = params;
      } else if (status === 2) {
        whereclaus = params_waitpayment;
      } else if (status === 3) {
        whereclaus = params_tolak;
      } else if (status === 4) {
        whereclaus = params_siapbayar;
      } else if (status === 5) {
        whereclaus = params_paid;
      }

      const [count, proposals] = await prisma.$transaction([
        prisma.proposal.count({
          where: whereclaus,
        }),
        prisma.proposal.findMany({
          include: {
            user: {
              select: {
                mustahiq: true,
                user_id: true,
                user_nama: true,
                username: true,
                user_phone: true,
              },
            },
            program: {
              select: {
                pogram_target_amount: false,
                kategori_penyaluran: true,
              },
            },
            proposal_approval: {
              include: {
                user: {
                  select: {
                    user_id: true,
                    user_nama: true,
                    username: true,
                    user_phone: true,
                    user_type: true,
                  },
                },
              },
            },
          },
          orderBy: {
            [sortBy]: sortType,
          },
          where: whereclaus,
          skip,
          take: perPage,
        }),
      ]);

      const propResult = await Promise.all(
        proposals.map(async (item) => {
          return {
            ...item,
            pogram_target_amount: Number(item.program_target_amount),
          };
        })
      );

      res.status(200).json({
        message: "Sukses Ambil Data",
        data: propResult,
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

  async getAllProcessProposal(req, res) {
    try {
      const userId = Number(req.user.user_id || 0);
      const userType = Number(req.user.user_type || 0);
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 0);
      const skip = (page - 1) * perPage;
      const keyword = req.query.nama || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "create_date";
      const sortType = req.query.order || "desc";
      let arrId = [];

      cekdata =
        await prisma.$queryRaw`select pa.proposal_id as id from proposal_approval pa JOIN user u on pa.user_id = u.user_id where u.user_type in (14) and pa.proposal_id is not NULL GROUP BY pa.proposal_id`;

      //const cekdata = await prisma.$queryRaw`select pa.proposal_id as id from proposal_approval pa JOIN user u on pa.user_id = u.user_id where u.user_type in (14) and pa.proposal_id is not NULL GROUP BY pa.proposal_id`

      cekdata.map((item) => {
        arrId.push(item.id);
      });

      //console.log("LOG TYPESSXX", JSON.stringify(arrId));

      const params = {
        AND: [
          {
            nama: { contains: keyword },
            approved: 0,
            status_bayar: 0,
            id: { notIn: arrId },
          },
        ],
      };

      const [count, proposals] = await prisma.$transaction([
        prisma.proposal.count({
          where: params,
        }),
        prisma.proposal.findMany({
          include: {
            user: {
              select: {
                mustahiq: true,
                user_id: true,
                user_nama: true,
                username: true,
                user_phone: true,
              },
            },
            //program:true,
            program: {
              select: {
                pogram_target_amount: false,
                kategori_penyaluran: true,
              },
              // include: {

              // }
            },
            proposal_approval: {
              include: {
                user: {
                  select: {
                    user_id: true,
                    user_nama: true,
                    username: true,
                    user_phone: true,
                    user_type: true,
                  },
                },
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

      // item.program_target_amount = undefined
      const propResult = await Promise.all(
        proposals.map(async (item) => {
          //item.program_target_amount = undefined
          return {
            ...item,
            //pogram_target_amount: Number(item.program_target_amount),
            //total_donation: total_donation._sum.amount || 0,
          };
        })
      );

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data",

        data: propResult,
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

  async getAllApproverProposal(req, res) {
    try {
      const userId = Number(req.user.user_id || 0);
      const userType = Number(req.user.user_type || 0);
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 0);
      const skip = (page - 1) * perPage;
      const keyword = req.query.nama || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "create_date";
      const sortType = req.query.order || "desc";
      let arrId = [];

      //const cekdata = await prisma.$queryRaw`select pa.proposal_id as id from proposal_approval pa where (select count(b.id) from proposal_approval b where pa.proposal_id = b.proposal_id) < 5 and pa.user_id in (${userId}) GROUP BY pa.proposal_id`
      const cekdata =
        await prisma.$queryRaw`select p.id as id, count(pa.id) as jumlah  FROM proposal p
      JOIN  proposal_approval pa ON pa.proposal_id = p.id 
      JOIN user u ON pa.user_id = u.user_id 
      WHERE (pa.user_id = ${userId} OR u.user_type = 14)  GROUP by pa.id HAVING COUNT(p.id) < 4`;

      //const cekdata = await prisma.$queryRaw`select p.proposal_id as id, p.user_id  from proposal_approval p where p.proposal_id is not null having p.user_id != ${userId} order by p.proposal_id`

      //console.log("WABARR", JSON.stringify(cekdata));
      cekdata.map((item) => {
        arrId.push(item.id);
      });

      const params = {
        AND: [
          {
            nama: { contains: keyword },
            approved: 0,
            status_bayar: 0,
            id: { in: arrId },
          },
        ],
      };

      const [count, proposals] = await prisma.$transaction([
        prisma.proposal.count({
          where: params,
        }),
        prisma.proposal.findMany({
          include: {
            user: {
              select: {
                mustahiq: true,
                user_id: true,
                user_nama: true,
                username: true,
                user_phone: true,
              },
            },
            //program:true,
            program: {
              select: {
                pogram_target_amount: false,
                kategori_penyaluran: true,
              },
              // include: {

              // }
            },
            proposal_approval: {
              include: {
                user: {
                  select: {
                    user_id: true,
                    user_nama: true,
                    username: true,
                    user_phone: true,
                    user_type: true,
                  },
                },
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

      // item.program_target_amount = undefined
      const propResult = await Promise.all(
        proposals.map(async (item) => {
          //item.program_target_amount = undefined
          return {
            ...item,
            //pogram_target_amount: Number(item.program_target_amount),
            //total_donation: total_donation._sum.amount || 0,
          };
        })
      );

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data",

        data: propResult,
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

  async getAllProposalsNoPagination(req, res) {
    try {
      // Mengambil semua data dari tabel proposal tanpa filter
      const proposals = await prisma.proposal.findMany({
        include: {
          user: {
            select: {
              mustahiq: true,
              user_id: true,
              user_nama: true,
              username: true,
              user_phone: true,
            },
          },
          program: {
            select: {
              kategori_penyaluran: true,
            },
          },
          proposal_approval: {
            include: {
              user: {
                select: {
                  user_id: true,
                  user_nama: true,
                  username: true,
                  user_phone: true,
                  user_type: true,
                },
              },
            },
          },
        },
        orderBy: {
          create_date: "desc", // Sorting default berdasarkan create_date secara descending
        },
      });

      // Menyusun data yang diambil
      const propResult = proposals.map((item) => ({
        ...item,
        pogram_target_amount: Number(item.program_target_amount), // Pastikan konversi jika diperlukan
      }));

      res.status(200).json({
        message: "Sukses Ambil Semua Data Proposal",
        data: propResult,
      });
    } catch (error) {
      res.status(500).json({
        message: error?.message,
      });
    }
  },

  async getAllProposalBayar(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 4);
      const skip = (page - 1) * perPage;
      const keyword = req.query.nama || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "create_date";
      const sortType = req.query.order || "desc";

      const params = {
        nama: {
          contains: keyword,
        },
        status_bayar: 1,
        ispaid: 0,
        //approved: 1,
      };

      // const sum = await prisma.proposal.groupBy({
      //   by: ['dana_approval'],
      //   where: params,
      // });

      const [count, summarize, proposals] = await prisma.$transaction([
        prisma.proposal.count({
          where: params,
        }),
        prisma.proposal.groupBy({
          by: ["dana_approval"],
          _sum: {
            dana_approval: true,
          },
          where: params,
        }),
        prisma.proposal.findMany({
          include: {
            user: {
              select: {
                mustahiq: true,
                user_id: true,
                user_nama: true,
                username: true,
                user_phone: true,
              },
            },
            //program:true,
            program: {
              select: {
                program_title: true,
                pogram_target_amount: false,
                kategori_penyaluran: true,
                program_category: true,
              },
              // include: {

              // }
            },
            proposal_approval: {
              include: {
                user: {
                  select: {
                    user_id: true,
                    user_nama: true,
                    username: true,
                    user_phone: true,
                    user_type: true,
                  },
                },
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
      // item.program_target_amount = undefined\
      let danaapp = 0;
      const propResult = await Promise.all(
        proposals.map(async (item) => {
          //item.program_target_amount = undefined
          danaapp = danaapp + Number(item.dana_approval);
          return {
            ...item,
            //pogram_target_amount: Number(item.program_target_amount),
            //total_donation: total_donation._sum.amount || 0,
          };
        })
      );

      // var summarizes =  summarize.length > 0 ?
      //       summarize.map(summarize => summarize.dana_approval).reduce((acc, amount) => Number(summarize.dana_approval) + acc + amount):0

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data",
        summarize: danaapp,
        data: propResult,
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

  async getAllProposalPaid(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 4);
      const skip = (page - 1) * perPage;
      const keyword = req.query.nama || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "tgl_bayar";
      const sortType = req.query.order || "desc";

      const params = {
        nama: {
          contains: keyword,
        },
        ispaid: 1,
        //approved: 1,
      };

      // const sum = await prisma.proposal.groupBy({
      //   by: ['dana_approval'],
      //   where: params,
      // });

      const [count, summarize, proposals] = await prisma.$transaction([
        prisma.proposal.count({
          where: params,
        }),
        prisma.proposal.groupBy({
          by: ["dana_approval"],
          _sum: {
            dana_approval: true,
          },
          where: params,
        }),
        prisma.proposal.findMany({
          include: {
            user: {
              select: {
                mustahiq: true,
                user_id: true,
                user_nama: true,
                username: true,
                user_phone: true,
              },
            },
            //program:true,
            program: {
              select: {
                program_title: true,
                pogram_target_amount: false,
                kategori_penyaluran: true,
                program_category: true,
              },
              // include: {

              // }
            },
            proposal_approval: {
              include: {
                user: {
                  select: {
                    user_id: true,
                    user_nama: true,
                    username: true,
                    user_phone: true,
                    user_type: true,
                  },
                },
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
      // item.program_target_amount = undefined\
      let danaapp = 0;
      const propResult = await Promise.all(
        proposals.map(async (item) => {
          //item.program_target_amount = undefined
          //danaapp = danaapp + Number(item.dana_approval)
          return {
            ...item,
            //pogram_target_amount: Number(item.program_target_amount),
            //total_donation: total_donation._sum.amount || 0,
          };
        })
      );

      // var summarizes =  summarize.length > 0 ?
      //       summarize.map(summarize => summarize.dana_approval).reduce((acc, amount) => Number(summarize.dana_approval) + acc + amount):0

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data",
        summarize: danaapp,
        data: propResult,
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

  async getAllPenyaluranValidation(req, res) {
    try {
      const page = Number(req.query.page || 1);
      const perPage = Number(req.query.perPage || 10);
      const status = Number(req.query.status || 4);
      const skip = (page - 1) * perPage;
      const keyword = req.query.nama || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "tgl_bayar";
      const sortType = req.query.order || "desc";

      const params = {
        nama: {
          contains: keyword,
        },
        ispaid: 1,
        tgl_bayar: {
          lte: new Date("2024-10-31"),
          gte: new Date("2024-10-01"),
        },
      };

      // const sum = await prisma.proposal.groupBy({
      //   by: ['dana_approval'],
      //   where: params,
      // });

      const [count, summarize, proposals] = await prisma.$transaction([
        prisma.proposal.count({
          where: params,
        }),
        prisma.proposal.groupBy({
          by: ["dana_approval"],
          _sum: {
            dana_approval: true,
          },
          where: params,
        }),
        prisma.proposal.findMany({
          include: {
            user: {
              select: {
                mustahiq: true,
                user_id: true,
                user_nama: true,
                username: true,
                user_phone: true,
              },
            },
            //program:true,
            program: {
              select: {
                program_title: true,
                pogram_target_amount: false,
                kategori_penyaluran: true,
                program_category: true,
              },
              // include: {

              // }
            },
            proposal_approval: {
              include: {
                user: {
                  select: {
                    user_id: true,
                    user_nama: true,
                    username: true,
                    user_phone: true,
                    user_type: true,
                  },
                },
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
      // item.program_target_amount = undefined\
      let danaapp = 0;
      const propResult = await Promise.all(
        proposals.map(async (item) => {
          //item.program_target_amount = undefined
          //danaapp = danaapp + Number(item.dana_approval)
          return {
            ...item,
            //pogram_target_amount: Number(item.program_target_amount),
            //total_donation: total_donation._sum.amount || 0,
          };
        })
      );

      // var summarizes =  summarize.length > 0 ?
      //       summarize.map(summarize => summarize.dana_approval).reduce((acc, amount) => Number(summarize.dana_approval) + acc + amount):0

      res.status(200).json({
        // aggregate,
        message: "Sukses Ambil Data",
        summarize: danaapp,
        data: propResult,
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

  async detailProposal(req, res) {
    try {
      const id = req.params.id;

      const proposal = await prisma.proposal.findUnique({
        where: {
          id: Number(id),
        },
        include: {
          user: true,
          program: true,
        },
      });

      if (!proposal) {
        return res.status(404).json({
          message: "Proposal tidak ditemukan",
        });
      }

      //const omit = require("lodash/omit");

      //const cleanUser = omit(user, ["user_password", "user_token"]);

      return res.status(200).json({
        message: "Sukses",
        data: proposal,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async kategoriPenyaluran(req, res) {
    try {
      //const id = req.params.id;

      const proposal = await prisma.kategori_penyaluran.findMany({
        include: {
          asnaf_type: true,
        },
      });

      if (!proposal) {
        return res.status(404).json({
          message: "Proposal tidak ditemukan",
        });
      }

      return res.status(200).json({
        message: "Sukses",
        data: proposal,
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  async updateKategoriPenyaluran(req, res) {
    try {
      const id = req.params.id;

      const { kategori_penyaluran } = req.body;

      //console.log(JSON.stringify(req.body))

      const glResult = await prisma.proposal.update({
        where: {
          id: Number(id),
        },
        data: {
          kategori_penyaluran_id: Number(kategori_penyaluran),
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
  async uploadlampiran(req, res) {
    try {
      const id = req.params.id;

      const { kategori_penyaluran } = req.body;

      //console.log(JSON.stringify(req.body))

      const glResult = await prisma.proposal.update({
        where: {
          id: Number(id),
        },
        data: {
          kategori_penyaluran_id: Number(kategori_penyaluran),
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
