const { prisma } = require("../../prisma/client");
const fs = require("fs");
const { subMonths, subDays, format, endOfMonth } = require('date-fns');
const { some } = require("lodash");
const { sendWhatsapp } = require("../helper/whatsapp");
const phoneFormatter = require('phone-formatter');
const parsenik = require("parsenik");
const { sendImkas, checkImkas } = require("../helper/imkas");
const { generateTemplateProposalBayar, sendEmail, generateTemplateProposalCreate } = require("../helper/email");
const moment = require("moment");
const { TransferAJ, BalanceAJ } = require("../helper/artajasa");
const { checkStatusDisbursement } = require("../helper/background-jobs");

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
      const {
        program_id,
        proposal_kategori,
        nik_mustahiq,
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
        email_pemberi_rekomendasi,
        dana_yang_diajukan,
      } = req.body;

      const niks = Number(nik_mustahiq);
      const validasi = parsenik.parse(niks);

      if (!nik_mustahiq)
        return res.status(400).json({ message: "NIK wajib diisi" });
      if (!nama) return res.status(400).json({ message: "Nama wajib diisi" });
      if (!userId)
        return res.status(400).json({ message: "User ID wajib diisi" });
      if (!program_id)
        return res.status(400).json({ message: "Program ID wajib diisi" });
      if (!proposal_kategori)
        return res
          .status(400)
          .json({ message: "Kategori Proposal wajib diisi" });
      if (!nama_pemberi_rekomendasi)
        return res
          .status(400)
          .json({ message: "Nama Pemberi Rekomendasi wajib diisi" });
      if (!email_pemberi_rekomendasi)
        return res
          .status(400)
          .json({ message: "Email Pemberi Rekomendasi wajib diisi" });
      if (!no_telp_pemberi_rekomendasi)
        return res
          .status(400)
          .json({ message: "Nomor Telepon Pemberi Rekomendasi wajib diisi" });
      if (!validasi.valid)
        return res.status(400).json({ message: "NIK tidak valid" });

      // Validasi file upload & ekstensi
      const allowedExtensions = ["pdf", "jpg", "jpeg"];
      const files = {};
      let uploadedLampiranCount = 0;

      for (let i = 1; i <= 7; i++) {
        const fileArray = req.files[`lampiran${i}`];

        if (fileArray && fileArray.length > 0) {
          const file = fileArray[0];
          const extension = file.originalname.split(".").pop().toLowerCase();

          if (!allowedExtensions.includes(extension)) {
            return res.status(400).json({
              message: `Lampiran ${i} harus berformat PDF, JPG, atau JPEG.`,
            });
          }

          files[`lampiran${i}`] = "uploads/" + file.filename;
          uploadedLampiranCount++;
        }
      }

      if (uploadedLampiranCount === 0) {
        return res.status(400).json({
          message: "Minimal 1 lampiran harus diunggah.",
        });
      }
      

      const program = await prisma.program.findUnique({
        where: { program_id: Number(program_id) },
        select: { program_title: true },
      });

      const imkas = await prisma.user.findUnique({
        where: { user_id: Number(userId) },
        select: { mustahiq: true },
      });

      const imkas_number = imkas?.mustahiq?.imkas_number || "";
      const imkas_name = imkas?.mustahiq?.nama_imkas || "";

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

      if (institute.length < 1) {
        const existingProposal = await prisma.proposal.findFirst({
          where: {
            program_id: Number(program_id),
            program: { program_category_id: { in: [1, 2, 4] } },
            nik_mustahiq,
            create_date: { gte: sixMonthsAgo },
            approved: { not: 2 },
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
            program: { program_category_id: { in: [1, 2, 4] } },
            nik_mustahiq,
            create_date: { gte: aDayAgo },
            approved: { not: 2 },
          },
        });
        if (existingProposal) {
          return res.status(400).json({
            message:
              "Anda telah mengajukan proposal dan baru dapat mengajukan kembali setelah 1 hari",
          });
        }
      }

      const ProposalResult = await prisma.proposal.create({
        data: {
          user: { connect: { user_id: Number(userId) } },
          program: { connect: { program_id: Number(program_id) } },
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
          email_pemberi_rekomendasi,
          no_telp_pemberi_rekomendasi,
          nomor_imkas: imkas_number,
          nama_imkas: imkas_name,
          ...files,
        },
      });

      if (ProposalResult) {
        let pn = no_telp_pemberi_rekomendasi.replace(/\D/g, "");
        if (pn.startsWith("62")) pn = "0" + pn.substring(2);
        if (!pn.startsWith("0")) pn = "0" + pn;

        try {
          const templateEmail = await generateTemplateProposalCreate({
            nama,
            nik_mustahiq,
            program_title: program?.program_title || "-",
          });

          const msgId = await sendEmail({
            email: email_pemberi_rekomendasi,
            html: templateEmail,
            subject: "Proposal Telah Berhasil Dikirim",
          });

          return res.status(200).json({
            success: true,
            message: `Email berhasil dikirim`,
            msgId,
          });
        } catch (error) {
          return res.status(500).json({
            success: false,
            message: `Gagal mengirim email`,
            error: error.message,
          });
        }
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
      const nomor_rekening = req.body.nomor_rekening;
      const nama_bank = req.body.nama_bank;
      const nama_rekening = req.body.nama_rekening;

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
      } else if (!nama_bank) {
        return res.status(400).json({ message: "Bank wajib diisi" });
      } else if (!nama_rekening) {
        return res
          .status(400)
          .json({ message: "Nama pemilik rekening wajib diisi" });
      } else if (!nomor_rekening) {
        return res.status(400).json({ message: "Nomor rekening wajib diisi" });
      }

      const files = {};
      for (let i = 1; i <= 7; i++) {
        const file = req.files[`lampiran${i}`];
        if (file) {
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

      const currentDate = new Date();
      const formattedDate = currentDate
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      const empatnik = "0104";
      const no_proposal = formattedDate + empatnik;

      const program_title = program
        ? program.program_title
        : "Program tidak terdaftar";

      // Menghapus pengecekan nomor Imkas
      // let pn = nomor_imkas;
      // if (pn.substring(0, 1) == "0") {
      //   pn = "0" + pn.substring(1).trim();
      // } else if (pn.substring(0, 3) == "+62") {
      //   pn = "0" + pn.substring(3).trim();
      // }
      // const checks = await sendImkas({
      //   phone: pn.replace(/[^0-9\.]+/g, ""),
      //   nom: "50",
      //   id: `10${userId}${Date.now()}`,
      //   desc: "Pengecekan Nomor",
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
      // const check = checks?.data;
      // if (check.responseCode != "00") {
      //   return res.status(400).json({ message: check.responseDescription });
      // }

      // Langsung membuat proposal tanpa menunggu response dari checks
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
          nomor_rekening,
          nama_bank,
          nama_rekening,
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
    async function generateRRN() {
      const now = new Date();

      // ambil format YYMMDDhhmmss
      const year = now.getFullYear().toString().slice(-2); // 2 digit tahun
      const month = (now.getMonth() + 1).toString().padStart(2, "0"); // 2 digit bulan
      const day = now.getDate().toString().padStart(2, "0"); // 2 digit tanggal
      const hour = now.getHours().toString().padStart(2, "0"); // 2 digit jam
      const minute = now.getMinutes().toString().padStart(2, "0"); // 2 digit menit
      const second = now.getSeconds().toString().padStart(2, "0"); // 2 digit detik

      return year + month + day + hour + minute + second; // 12 digit
    }
    async function generateCustRefNumber(length = 16) {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let result = "";
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    }
    async function generateUniqueCustRefNumber() {
      let unique = false;
      let ref;
      while (!unique) {
        ref = await generateCustRefNumber();
        const existing = await prisma.disbursement.findFirst({
          where: { beneficiary_cust_ref_number: ref },
        });
        if (!existing) unique = true;
      }
      return ref;
    }
    try {
      const id = req.params.id;
      const ispaid = req.body.ispaid;
      const nama = req.body.nama;
      const ref = req.body.ref;
      const tgl_bayar = new Date();
      const nowWIB = moment().utc().add(7, "hours").toDate();

      const lastRecord = await prisma.disbursement.findFirst({
        where: {
          type: "transfer",
        },
        orderBy: {
          id: "desc",
        },
        select: { stan: true },
      });
      const lastStan = lastRecord?.stan || "0";
      const newStan = parseInt(lastStan, 10) + 1;
      const stan = newStan.toString().padStart(6, "0");

      const lastRecordBalance = await prisma.disbursement.findFirst({
        where: {
          type: "checkBalance",
        },
        orderBy: {
          id: "desc",
        },
        select: { stan: true },
      });
      const lastStanBalance = lastRecordBalance?.stan || "0";
      const newStanBalance = parseInt(lastStanBalance, 10) + 1;
      const stanBalance = newStanBalance.toString().padStart(6, "0");

      const refNumberTransfer = await generateRRN();
      const custRefNumber = await generateUniqueCustRefNumber();

      const saveToDbBalance = async (data, type) => {
        const m = data?.MethodResponse;
        await prisma.disbursement.create({
          data: {
            proposal_id: Number(id),
            type: type,
            stan: m.TransactionID?.STAN,
            trans_datetime: m.TransactionID?.TransDateTime,
            inst_id: m.TransactionID?.InstID,

            response_code: m.Response?.Code,
            response_description: m.Response?.Description,
            signature_data: m.Signature?.Data,

            account_balance: m.Account.Balance || null,

            created_at: nowWIB,
          },
        });
      };

      const saveToDb = async (data, type, refNumber) => {
        const m = data?.MethodResponse;
        await prisma.disbursement.create({
          data: {
            proposal_id: Number(id),
            type: type,
            stan: m.TransactionID?.STAN,
            ref_number: refNumber,
            trans_datetime: m.TransactionID?.TransDateTime,
            inst_id: m.TransactionID?.InstID,
            token_id: m.TransactionID?.TokenID,

            sender_account_id: m.SenderData?.AccountID,
            sender_name: m.SenderData?.Name,
            sender_curr_code: m.SenderData?.CurrCode,
            sender_amount: m.SenderData?.Amount,
            sender_rate: m.SenderData?.Rate,
            sender_area_code: m.SenderData?.AreaCode,

            beneficiary_purpose_code: m.BeneficiaryData?.PurposeCode,
            beneficiary_purpose_desc: m.BeneficiaryData?.PurposeDesc,
            beneficiary_inst_id: m.BeneficiaryData?.InstID,
            beneficiary_account_id: m.BeneficiaryData?.AccountID,
            beneficiary_curr_code: m.BeneficiaryData?.CurrCode,
            beneficiary_amount: m.BeneficiaryData?.Amount,
            beneficiary_cust_ref_number: m.BeneficiaryData?.CustRefNumber,
            beneficiary_name: m.BeneficiaryData?.Name?.trim(),
            beneficiary_regency_code: m.BeneficiaryData?.RegencyCode,

            response_code: m.Response?.Code,
            response_description: m.Response?.Description,
            signature_data: m.Signature?.Data,

            created_at: nowWIB,
          },
        });
      };

      const handleTransferResult = async (
        transfer,
        refNumberTransfer,
        statusEmail
      ) => {
        const bankCodeNormalized = parseInt(
          transfer.MethodResponse.BeneficiaryData.InstID,
          10
        ).toString();
        const bank = await prisma.bank.findFirst({
          where: { bank_code: bankCodeNormalized },
          select: { bank_name: true },
        });
        const bank_name = bank?.bank_name || "Bank tidak ditemukan";

        const formattedDana = Number(
          transfer.MethodResponse.BeneficiaryData.Amount
        ).toLocaleString("id-ID", {
          style: "currency",
          currency: "IDR",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });

        const proposal = await prisma.proposal.update({
          where: { id: Number(id) },
          data: {
            ispaid, // 0 untuk pending, 1 untuk berhasil
            tgl_bayar,
          },
          include: {
            user: { select: { mustahiq: true, username: true } },
            program: {
              select: { program_title: true, program_category: true },
            },
          },
        });

        const formattedDate = `${new Date().toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })} ${new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })} WIB`;

        const templateEmail = await generateTemplateProposalBayar({
          nama,
          formattedDate,
          formattedDana,
          program: proposal.program?.program_title || "-",
          bank_name,
          programCategory: proposal.program.program_category?.name || "-",
          refNumber: refNumberTransfer,
          bank_number: transfer.MethodResponse.BeneficiaryData.AccountID || "-",
          bank_account_name:
            transfer.MethodResponse.BeneficiaryData.Name?.trim() || "-",
          namaPengirim: transfer.MethodResponse.SenderData.Name?.trim() || "-",
          rekPengirim: transfer.MethodResponse.SenderData.AccountID || "-",
          status: statusEmail,
        });

        await sendEmail({
          email: proposal.user.username,
          html: templateEmail,
          subject:
            statusEmail === "Pending"
              ? "Pembayaran Proposal Dalam Proses Transfer"
              : "Pembayaran Proposal Telah Berhasil Ditransfer",
        });
      };

      const inquiry = await prisma.disbursement.findFirst({
        where: {
          response_code: "00",
          type: "inquiry",
          proposal_id: Number(id),
        },
        orderBy: {
          id: "desc",
        },
      });

      if (!inquiry) {
        return res.status(404).json({ error: "Data inquiry tidak ditemukan." });
      }

      const nama_rekening = inquiry.beneficiary_name || "-";
      const amount = inquiry.beneficiary_amount || "-";
      const beneficiaryInstId = inquiry.beneficiary_inst_id || "-";
      const beneficiaryAccountId = inquiry.beneficiary_account_id || "-";
      const beneficiaryName = inquiry.beneficiary_name || "-";
      const tokenID = inquiry.token_id || "-";

      const result = await TransferAJ({
        stan,
        refNumberTransfer,
        custRefNumber,
        nama_rekening,
        amount,
        beneficiaryInstId,
        beneficiaryAccountId,
        beneficiaryName,
        tokenID,
      });

      if (result.error && result.success === false) {
        return res.status(500).json(result);
      }

      if (result?.data && result?.success === false) {
        await saveToDb(result.data, result.type, refNumberTransfer);
        if (result.errorCode === "TO" || result.errorCode === "68") {
          const resultBalance = await BalanceAJ({
            stan,
          });
          await saveToDbBalance(resultBalance.data, "checkBalance");
          await handleTransferResult(result.data, refNumberTransfer, "Pending");
          // checkStatusDisbursement({
          //   proposal_id: Number(id),
          //   query_stan: result.data?.MethodResponse?.TransactionID?.STAN,
          //   query_trans_datetime: result.data?.MethodResponse?.TransactionID?.TransDateTime,
          //   refNumber: refNumberTransfer,
          //   nama
          // });
          await prisma.disbursement_cron_log.create({
            data: {
              proposal_id: Number(id),
              ref_number: refNumberTransfer,
              query_stan:
                result.data?.MethodResponse?.TransactionID?.STAN || null,
              query_trans_datetime:
                result.data?.MethodResponse?.TransactionID?.TransDateTime ||
                null,
              nama: nama || "-",
              status: "waiting",
              created_at: nowWIB,
              updated_at: nowWIB,
            },
          });
          return res.status(202).json(result);
        }
        return res.status(500).json(result);
      }

      const transfer = result?.data;

      await saveToDb(transfer, "transfer", refNumberTransfer);
      const resultBalance = await BalanceAJ({
        stanBalance,
      });
      await saveToDbBalance(resultBalance.data, "checkBalance");
      await handleTransferResult(
        transfer,
        refNumberTransfer,
        result.data.MethodResponse.Response.Description
      );

      // let pn = ref;
      // if (pn.substring(0, 1) == "0") {
      //   pn = "0" + pn.substring(1).trim();
      // } else if (pn.substring(0, 3) == "+62") {
      //   pn = "0" + pn.substring(3).trim();
      // }

      // const formattedDana = proposal.dana_yang_disetujui.toLocaleString(
      //   "id-ID",
      //   { style: "currency", currency: "IDR" }
      // );

      // const msgId = await sendWhatsapp({
      //   wa_number: pn.replace(/[^0-9\.]+/g, ""),
      //   text: `Proposal Atas Nama ${nama} telah disetujui dan telah ditransfer pada ${formattedDate} sejumlah ${formattedDana} ke nomor Rekening atau Rekening ${proposal.user.mustahiq.bank_number} a.n ${proposal.user.mustahiq.bank_account_name} . Terima kasih`,
      // });

      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({
        error:
          error.message || "Terjadi kesalahan saat memproses inquiry transfer.",
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

      // Cek apakah user sudah pernah approve proposal ini
      const existingApproval = await prisma.proposal_approval.findFirst({
        where: {
          proposal_id: Number(proposal_id),
          user_id: Number(userId),
        },
      });

      if (existingApproval) {
        return res.status(400).json({
          message:
            "User sudah pernah memberikan persetujuan untuk proposal ini.",
        });
      }

      // Insert approval baru
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

      // Jika status 2 (disetujui), update status proposal
      if (status == 2) {
        await prisma.proposal.update({
          where: {
            id: Number(proposal_id),
          },
          data: {
            approved: 2,
          },
        });
      }

      return res.status(200).json({
        message: "Approval berhasil",
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
      // const perPage = Number(req.query.perPage || 10);
      const perPage = req.query.perPage === '-1' ? undefined : Number(req.query.perPage || 10);
      const status = Number(req.query.status || 4);
      // const skip = (page - 1) * perPage;
      const skip = perPage ? (page - 1) * perPage : undefined;
      const keyword = req.query.nama || "";
      const user_type = req.query.user_type || "";
      const category = req.query.category || "";
      const sortBy = req.query.sortBy || "tgl_bayar";
      const sortType = req.query.order || "desc";
      const tanggal_dari = req.query.tanggal_dari;
      const tanggal_sampai = req.query.tanggal_sampai;


      const params = {
        nama: {
          contains: keyword,
        },
        ispaid: 1,
        //approved: 1,
      };

      if (tanggal_dari || tanggal_sampai) {
        params.tgl_bayar = {
          ...(tanggal_dari && { gte: new Date(tanggal_dari) }),
          ...(tanggal_sampai && { lte: new Date(new Date(tanggal_sampai).setHours(23, 59, 59, 999)) }),
        };
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
            // include:
            disbursement: {
              where: {
                type: {
                  in: ["checkBalance", "transfer"],
                },
              },
              orderBy: {
                id: "desc",
              },
              select: {
                type: true,
                account_balance: true,
                beneficiary_amount: true
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
          const checkBalance = item.disbursement.find((d) => d.type === "checkBalance");
          const transfer = item.disbursement.find((d) => d.type === "transfer");

          return {
            ...item,
            disbursement_checkBalance: checkBalance
              ? {
                type: checkBalance.type,
                account_balance: checkBalance.account_balance ?? 0,
              }
              : {
                type: "checkBalance",
                account_balance: 0,
              },
            disbursement_transfer: transfer
              ? {
                type: transfer.type,
                beneficiary_amount: transfer.beneficiary_amount ?? 0,
              }
              : {
                type: "transfer",
                beneficiary_amount: 0,
              },
            disbursement: undefined, // hapus array mentah
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
  async getProposalJktTesting(req, res) {
    try {
      const { start_date, end_date, city_id } = req.query;

      const startDate = start_date
        ? new Date(start_date)
        : new Date("2025-05-01");
      const endDate = end_date
        ? new Date(end_date)
        : new Date("2025-05-31T23:59:59");

      const jakartaIds = [152, 153, 154, 155, 156, 157];
      const bogorId = 171;
      const tangerangId = 476;

      // === Parse city filter from query ===
      let filterCityIds = null;
      if (city_id) {
        filterCityIds = city_id
          .split(",")
          .map((id) => parseInt(id.trim()))
          .filter(Boolean);
      }

      const mustahiqs = await prisma.mustahiq.findMany({
        select: { id: true, kota: true },
      });

      const allMustahiqIds = mustahiqs.map((m) => m.id);
      const userIdToCityMap = new Map(
        mustahiqs.map((m) => [m.id, parseInt(m.kota || "0")])
      );
      const uniqueCityIds = [
        ...new Set(mustahiqs.map((m) => parseInt(m.kota || "0"))),
      ].filter((id) => id > 0);

      const proposals = await prisma.proposal.findMany({
        where: {
          ispaid: 1,
          user_id: { in: allMustahiqIds },
          tgl_bayar: { gte: startDate, lte: endDate },
        },
        select: {
          user_id: true,
          dana_yang_diajukan: true,
          dana_yang_disetujui: true,
          tgl_bayar: true,
        },
      });

      const resultMap = {};
      for (const proposal of proposals) {
        const cityId = userIdToCityMap.get(proposal.user_id);
        if (!resultMap[cityId]) {
          resultMap[cityId] = {
            total_proposal: 0,
            total_dana_diajukan: 0,
            total_dana_disetujui: 0,
          };
        }

        resultMap[cityId].total_proposal += 1;
        resultMap[cityId].total_dana_diajukan +=
          proposal.dana_yang_diajukan || 0;
        resultMap[cityId].total_dana_disetujui +=
          proposal.dana_yang_disetujui || 0;
      }

      const cities = await prisma.cities.findMany({
        where: {
          city_id: { in: uniqueCityIds },
        },
        select: {
          city_id: true,
          city_name: true,
        },
      });
      const cityMap = new Map(cities.map((c) => [c.city_id, c.city_name]));

      const result = [];

      // === Jakarta Raya ===
      let totalJakartaProposal = 0;
      let totalJakartaDiajukan = 0;
      let totalJakartaDisetujui = 0;
      for (const cityId of jakartaIds) {
        const data = resultMap[cityId] || {
          total_proposal: 0,
          total_dana_diajukan: 0,
          total_dana_disetujui: 0,
        };
        totalJakartaProposal += data.total_proposal;
        totalJakartaDiajukan += data.total_dana_diajukan;
        totalJakartaDisetujui += data.total_dana_disetujui;
      }

      if (!filterCityIds || filterCityIds.includes(null)) {
        result.push({
          city_id: null,
          city_name: "Jakarta Raya",
          total_proposal: totalJakartaProposal,
          total_dana_diajukan: totalJakartaDiajukan,
          total_dana_disetujui: totalJakartaDisetujui,
        });
      }

      const excludedIds = new Set([...jakartaIds]);
      const specialCities = [bogorId, tangerangId];

      // === Bogor & Tangerang ===
      for (const id of specialCities) {
        if (filterCityIds && !filterCityIds.includes(id)) continue;

        const data = resultMap[id] || {
          total_proposal: 0,
          total_dana_diajukan: 0,
          total_dana_disetujui: 0,
        };

        result.push({
          city_id: id,
          city_name: cityMap.get(id) || `Kota ID ${id}`,
          ...data,
        });

        excludedIds.add(id);
      }

      // === Kota lain ===
      for (const cityId of uniqueCityIds) {
        if (excludedIds.has(cityId)) continue;
        if (filterCityIds && !filterCityIds.includes(cityId)) continue;

        const data = resultMap[cityId] || {
          total_proposal: 0,
          total_dana_diajukan: 0,
          total_dana_disetujui: 0,
        };

        result.push({
          city_id: cityId,
          city_name: cityMap.get(cityId) || `Kota ID ${cityId}`,
          ...data,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Data proposal berhasil diambil",
        data: result,
      });
    } catch (error) {
      console.error("Error in getProposalJktTesting:", error);
      return res.status(500).json({
        success: false,
        message: "Gagal mengambil data proposal",
        error: error.message,
      });
    }
  },
};  