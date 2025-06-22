const cron = require("node-cron");
const { cekStatus, expirePayment } = require("../helper/midtrans");
const { prisma } = require("../../prisma/client");
const moment = require("moment")
// const {
//   sendEmail,
//   generateTemplateMegaKonser,
//   generateTemplateExpiredMegaKonser,
//   sendEmailWithPdf,
// } = require("../helper/email");
const { reqpay, infoPay } = require("../controllers/controller-payment.js");
const fs = require("fs");
const {
  sendEmail,
  generateTemplateMegaKonser,
  generateTemplateCancelMegaKonser,
  generateTemplatePembayaran,
  sendEmailWithPdf,
  generateTemplateQurban,
  generateTemplateQurbanSuccess,
  generateTemplateQurbanExpired,
  generateTemplateExpiredMegaKonser,
  generateTemplateVrfpSuccess,
  generateTemplateExpiredVrfp,
  generateTemplateProposalBayar,
} = require("../helper/email");
const { StatusAJ } = require("./artajasa.js");
const { sendFonnte, sendFonnteMedia } = require("../helper/whatsapp.js");

// const scheduleCekStatusKonser = async ({ order, email, pemesanan, filePath }) => {
//   // Log the start of the process for the order
//   console.log(`Starting schedule for order: ${order}, Email: ${email}`);

//   const currentStatus = await prisma.pemesanan_megakonser.findFirst({
//     where: { kode_pemesanan: order },
//   });

//   if (currentStatus?.status === "settlement") {
//     console.log(`Order ${order} is already settled.`);
//     return;
//   }

//   let elapsedMinutes = 0;

//   const task = cron.schedule("*/2 * * * *", async () => {
//     try {
//       console.log(`Checking status for order: ${order}, Email: ${email}`);

//       let stats = await cekStatus({ order });
//       console.log("status", stats.data);

//       // Log the status response from cekStatus
//       console.log(
//         `Status response for order: ${order} - Status code: ${stats.data?.status_code}, Transaction status: ${stats.data?.transaction_status}`
//       );

//       if (
//         stats.data?.status_code == 200 &&
//         stats.data?.transaction_status === "settlement"
//       ) {
//         // Generate email template
//         const templateEmail = await generateTemplateMegaKonser({
//           email,
//           password: email,
//           tiket: pemesanan,
//         });

//         // Log the template creation
//         console.log(
//           `Generated email template for order: ${order}, Email: ${email}`
//         );

//         const msgId = await sendEmailWithPdf({
//           email,
//           html: templateEmail,
//           subject: "Pembelian Tiket Sound of Freedom",
//           pdfPath: filePath,
//         });

//         // Log the email sent with PDF
//         console.log(
//           `Email with PDF sent for order: ${order}, Email: ${email}, Message ID: ${msgId}`
//         );

//         // Delete the PDF file after sending
//         // fs.unlink(filePath, (err) => {
//         //   if (err) {
//         //     console.error("Error saat menghapus file PDF:", err);
//         //   } else {
//         //     console.log(`Deleted PDF file for order: ${order}, File path: ${filePath}`);
//         //   }
//         // });

//         // Update the order status to 'settlement'
//         await prisma.pemesanan_megakonser.update({
//           where: { kode_pemesanan: order },
//           data: { status: stats.data.transaction_status || "" },
//         });

//         // Log the order settlement
//         console.log(
//           `Order ${order} settled successfully. Email sent: ${msgId}`
//         );
//         task.stop();
//       } else {
//         elapsedMinutes += 1;
//         // Log the elapsed time
//         console.log(
//           `Elapsed time for order: ${order} is now ${elapsedMinutes} minutes`
//         );

//         if (elapsedMinutes >= 5) {
//           // Expire the payment if it takes too long
//           stats = await expirePayment({ order });

//           // Generate expired email template
//           const templateEmailExpired = await generateTemplateExpiredMegaKonser({
//             email,
//             password: email,
//             tiket: pemesanan,
//           });

//           // Send expired email
//           const msgId = await sendEmail({
//             email,
//             html: templateEmailExpired,
//             subject: "Pembelian Tiket Mega Konser Indosat",
//           });

//           // Log the expired status
//           console.log(`Order ${order} expired. Notification sent: ${msgId}`);

//           // Update the order status to 'expired'
//           await prisma.pemesanan_megakonser.update({
//             where: { kode_pemesanan: order },
//             data: { status: "expired" },
//           });

//           task.stop();
//         }
//       }
//     } catch (error) {
//       // Log any errors during the process
//       console.error(`Error checking order status for order: ${order}, Error: ${error.message}`);
//     }
//   });
// };
const scheduleCekStatusKonser = async ({
  order,
  email,
  pemesanan,
  filePath,
}) => {
  console.log(`Starting schedule for order: ${order}, Email: ${email}`);

  const currentStatus = await prisma.pemesanan_megakonser.findFirst({
    where: { kode_pemesanan: order },
  });

  if (currentStatus?.status === "settlement") {
    console.log(`Order ${order} is already settled.`);
    return;
  }

  let elapsedMinutes = 0;

  const task = cron.schedule("*/2 * * * *", async () => {
    try {
      console.log(`Checking status for order: ${order}, Email: ${email}`);

      let stats = await cekStatus({ order });
      console.log("status", stats.data);

      if (
        stats.data?.status_code == 200 &&
        stats.data?.transaction_status === "settlement"
      ) {
        await prisma.pemesanan_megakonser.update({
          where: { kode_pemesanan: order },
          data: { status: stats.data.transaction_status || "" },
        });

        // Kirim WA QR saat sukses
        if (pemesanan?.telepon && filePath) {
          const wa_number = pemesanan.telepon
            .replace(/\D/g, "")
            .replace(/^62/, "0");

          const totalHargaFinal =
            Number(pemesanan.total_harga || 0) + Number(pemesanan.infaq || 0);

          const caption = `🟢 *Pembayaran Berhasil*

Halo ${pemesanan.nama || "Customer"}, pembayaran Anda telah *berhasil*.

Kode Pemesanan: ${pemesanan.kode_pemesanan || order}
Status: *settlement*
Total Pembayaran: Rp${totalHargaFinal.toLocaleString("id-ID")}

📎 Berikut adalah QR Code tiket Anda.

Terima kasih telah melakukan pembelian. Wassalamu'alaikum Wr Wb.`;

          await sendFonnteMedia({
            wa_number,
            filePath,
            caption,
          });

          console.log(`✅ WA with QR sent to ${wa_number}`);
        } else {
          console.error(
            `❌ Missing phone number or filePath for order ${order}, skipping WA`
          );
        }

        console.log(`✅ Order ${order} settled and WA sent.`);
        task.stop();
      } else {
        elapsedMinutes += 2;
        console.log(
          `⏱️ Elapsed time for order: ${order} is now ${elapsedMinutes} minutes`
        );

        if (elapsedMinutes >= 20) {
          await prisma.pemesanan_megakonser.update({
            where: { kode_pemesanan: order },
            data: { status: "expired" },
          });

          const wa_number = pemesanan?.telepon
            ?.replace(/\D/g, "")
            ?.replace(/^62/, "0");

          if (wa_number) {
            const text = `🔴 *Pembayaran Expired*
        
        Halo ${
          pemesanan.nama || "Customer"
        }, pembayaran Anda telah *gagal / expired* karena melebihi batas waktu.
        
        Kode Pemesanan: ${order}
        Status: *expired*
        
        Silakan lakukan pemesanan ulang jika masih berminat.
        
        Wassalamu'alaikum Wr Wb.`;

            await sendFonnte({ wa_number, text });
            console.log(`⚠️ Expired notice sent to ${wa_number}`);
          } else {
            console.warn(
              `⚠️ No phone number found for expired order: ${order}`
            );
          }

          console.log(`⏹️ Order ${order} marked as expired and notified.`);
          task.stop();
        }
      }
    } catch (error) {
      console.error(
        `🔥 Error checking order status for order: ${order}, Error: ${error.message}`
      );
    }
  });
};

const scheduleCekStatusVrfp = async ({
  order,
  nama,
  formattedDate,
  formattedDana,
  no_wa,
  zak,
  wak,
  jasa_kirim,
  alamat,
  kategori,
  biaya_paket,
  email,
}) => {
  // Log the start of the process for the order
  console.log(`Starting schedule for order: ${order}`);

  const currentStatus = await prisma.activity_additional.findFirst({
    where: { order_id: order },
  });

  if (currentStatus?.status_transaksi === "settlement") {
    console.log(`Order ${order} is already settled.`);
    return;
  }

  let elapsedMinutes = 0;

  const startTime = new Date();

  const task = cron.schedule("*/2 * * * *", async () => {
    try {
      console.log(`Checking status for order: ${order}`);

      let stats = await cekStatus({ order });

      console.log(
        `Status response for order: ${order} - Status code: ${stats.data?.status_code}, Transaction status: ${stats.data?.transaction_status}`
      );

      if (
        stats.data?.status_code == 200 &&
        stats.data?.transaction_status === "settlement"
      ) {
        const templateEmail = await generateTemplateVrfpSuccess({
          nama,
          formattedDate,
          formattedDana,
          no_wa,
          zak,
          wak,
          jasa_kirim,
          alamat,
          kategori,
          biaya_paket,
        });

        const msgId = await sendEmail({
          email,
          html: templateEmail,
          subject: "Pembelian Paket Virtual Run",
        });

        await prisma.activity_additional.updateMany({
          where: { order_id: order },
          data: { status_transaksi: stats.data.transaction_status || "" },
        });

        console.log(
          `Order ${order} settled successfully. Email sent: ${msgId}`
        );
        task.stop();
      } else {
        const now = new Date();
        const elapsedMs = now - startTime;
        const elapsedHours = elapsedMs / (1000 * 60 * 60);

        console.log(
          `Elapsed hours for order: ${order} is now ${elapsedHours.toFixed(
            2
          )} hours`
        );

        if (elapsedHours >= 24) {
          stats = await expirePayment({ order });

          const templateEmailExpired = await generateTemplateExpiredVrfp({
            email,
            nama,
            formattedDate,
            formattedDana,
            no_wa,
            zak,
            wak,
            jasa_kirim,
            alamat,
            kategori,
            biaya_paket,
            password: email,
          });

          const msgId = await sendEmail({
            email,
            html: templateEmailExpired,
            subject: "Pembelian Paket Virtual Run",
          });

          console.log(`Order ${order} expired. Notification sent: ${msgId}`);

          await prisma.activity_additional.updateMany({
            where: { order_id: order },
            data: { status_transaksi: "expired" },
          });

          task.stop();
        }
      }
    } catch (error) {
      console.error(
        `Error checking order status for order: ${order}, Error: ${error.message}`
      );
    }
  });
};

const scheduleCekStatus = async ({ uniqueTransactionCode }) => {
  console.log(`Starting schedule for order: ${uniqueTransactionCode}`);

  // Cek apakah uniqueTransactionCode sudah memiliki status di tabel log_aj menggunakan Prisma
  // const existingLog = await prisma.log_aj.findFirst({
  //   where: {
  //     uniqueCode: uniqueTransactionCode,
  //     status: {
  //       not: null, // Hanya cek jika status tidak null
  //     },
  //   },
  // });

  // if (existingLog) {
  //   console.log(
  //     `Order ${uniqueTransactionCode} already has status: ${existingLog.status}, job will not be started.`
  //   );
  //   return; // Jika sudah ada status, hentikan eksekusi fungsi
  // }

  let elapsedMinutes = 0;

  // Tunda eksekusi pertama selama 2 menit
  setTimeout(() => {
    const task = cron.schedule("*/2 * * * *", async () => {
      try {
        console.log(`Checking status for order: ${uniqueTransactionCode}`);

        // Panggil infoPay untuk mendapatkan status transaksi
        const uniqueID = uniqueTransactionCode;
        console.log("uniqueID", uniqueID);
        const response = await infoPay(
          {
            body: {
              uniqueID: uniqueTransactionCode,
            },
          },
          {
            status: (code) => ({
              json: (data) => {
                console.log(`Response status: ${code}, data:`, data);
                return data;
              },
            }),
          }
        );

        if (response.success && response.data) {
          const { statusTransaction, statusTransConclusion } =
            response.data.checkStatusResp;

          console.log(
            `Status response for order: ${uniqueTransactionCode} - Status: ${statusTransaction}, Conclusion: ${statusTransConclusion}`
          );

          // Periksa apakah statusTransaction mengandung "success"
          if (statusTransaction.toLowerCase().includes("success")) {
            console.log(
              `Transaction successful for order: ${uniqueTransactionCode}, sending email and stopping job.`
            );

            // Ambil data transaksi qurban dari DB
            const qurban = await prisma.activity_qurban.findFirst({
              where: {
                UTC: uniqueTransactionCode, // pastikan kolom ini memang ada ya!
              },
              include: {
                detail_qurban: {
                  include: {
                    activity_paket: true,
                  },
                },
                program: true,
              },
            });



            if (qurban) {
              const totalDana = qurban.detail_qurban.reduce((sum, item) => {
                return sum + Number(item.total || 0);
              }, 0);

              const formattedDana = new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
              }).format(totalDana);

              const formattedDate = new Date().toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });

              const templateEmail = await generateTemplateQurbanSuccess({
                nama: qurban.nama,
                formattedDate,
                formattedDana,
                program_nama: qurban.program?.nama || "-",
                detail_qurban: qurban.detail_qurban.map((dq) => ({
                  nama_mudohi: dq.nama_mudohi,
                  paket_hewan: dq.activity_paket?.kategori || "-",
                  qty: dq.qty,
                  total: new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                  }).format(dq.total),
                })),
              });

              // Kirim email
              await sendEmail({
                email: qurban.email,
                subject: "Pembayaran Qurban Anda Berhasil - ZISWAF Indosat",
                html: templateEmail,
              });

              console.log(`Success email sent to: ${qurban.email}`);
            } else {
              console.warn(
                `Qurban record not found for code: ${uniqueTransactionCode}`
              );
            }

            task.stop();
            return;
          }

          // Periksa apakah statusTransConclusion tidak null
          if (statusTransConclusion !== null) {
            console.log(
              `Status conclusion for order: ${uniqueTransactionCode} is not null, stopping job.`
            );
             // Ambil data qurban dari DB untuk kirim email expired
               const qurban = await prisma.activity_qurban.findFirst({
                 where: {
                   UTC: uniqueTransactionCode, // pastikan kolom ini memang ada ya!
                 },
                 include: {
                   detail_qurban: {
                     include: {
                       activity_paket: true,
                     },
                   },
                   program: true,
                 },
               });
               console.log("lihat qurban", qurban);
               

            if (qurban) {
              const totalDana = qurban.detail_qurban.reduce((sum, item) => {
                return sum + Number(item.total || 0);
              }, 0);

              const formattedDana = new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
              }).format(totalDana);

              const formattedDate = new Date().toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });

              const templateEmail = generateTemplateQurbanExpired({
                nama: qurban.nama,
                formattedDate,
                formattedDana,
                program_nama: qurban.program?.nama || "-",
                detail_qurban: qurban.detail_qurban.map((dq) => ({
                  nama_mudohi: dq.nama_mudohi,
                  paket_hewan: dq.activity_paket?.kategori || "-",
                  qty: dq.qty,
                  total: new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                  }).format(dq.total),
                })),
              });

              // Kirim email expired
              await sendEmail({
                email: qurban.email,
                subject:
                  "Pembayaran Qurban Anda Belum Selesai - ZISWAF Indosat",
                html: templateEmail,
              });

              console.log(`Expired email sent to: ${qurban.email}`);
            } else {
              console.warn(
                `Qurban record not found for expired status on code: ${uniqueTransactionCode}`
              );
            }

            task.stop(); // Menghentikan eksekusi lebih lanjut
          }

          elapsedMinutes += 1;
          if (elapsedMinutes >= 181) {
            console.log(
              `Stopping job after 10 minutes for order: ${uniqueTransactionCode}`
            );

            // Ambil data qurban dari DB untuk kirim email expired
            const qurban = await prisma.activity_qurban.findFirst({
              where: {
                UTC: uniqueTransactionCode, // pastikan kolom ini memang ada ya!
              },
              include: {
                detail_qurban: {
                  include: {
                    activity_paket: true,
                  },
                },
                program: true,
              },
            });
            if (qurban) {
              const totalDana = qurban.detail_qurban.reduce((sum, item) => {
                return sum + Number(item.total || 0);
              }, 0);

              const formattedDana = new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
              }).format(totalDana);

              const formattedDate = new Date().toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              });

              const templateEmail = generateTemplateQurbanExpired({
                nama: qurban.nama,
                formattedDate,
                formattedDana,
                program_nama: qurban.program?.nama || "-",
                detail_qurban: qurban.detail_qurban.map((dq) => ({
                  nama_mudohi: dq.nama_mudohi,
                  paket_hewan: dq.activity_paket?.kategori || "-",
                  qty: dq.qty,
                  total: new Intl.NumberFormat("id-ID", {
                    style: "currency",
                    currency: "IDR",
                  }).format(dq.total),
                })),
              });

              // Kirim email expired
              await sendEmail({
                email: qurban.email,
                subject:
                  "Pembayaran Qurban Anda Belum Selesai - ZISWAF Indosat",
                html: templateEmail,
              });

              console.log(`Expired email sent to: ${qurban.email}`);
            } else {
              console.warn(
                `Qurban record not found for expired status on code: ${uniqueTransactionCode}`
              );
            }

            task.stop();
          }
        } else {
          console.error(
            `Failed to get a valid response for order: ${uniqueTransactionCode}`
          );
        }
      } catch (error) {
        console.error(
          `Error checking order status for order: ${uniqueTransactionCode}, Error: ${error.message}`
        );
      }
    });
  }, 1 * 60 * 1000); // Tunda eksekusi pertama selama 2 menit (2 menit x 60 detik x 1000 ms)
};

const formatPhoneNumber = (phone) => {
  let pn = phone.replace(/\D/g, "");
  if (pn.startsWith("0")) {
    return "0" + pn.substring(1).trim();
  } else if (pn.startsWith("62")) {
    return "0" + pn.substring(2).trim();
  }
  return pn.trim();
};

// const scheduleCekStatusExpire = (order, scheduledTime) => {
//   const dateTime = new Date(scheduledTime);
//   const minute = dateTime.getMinutes();
//   const hour = dateTime.getHours();
//   const dayOfMonth = dateTime.getDate();
//   const month = dateTime.getMonth() + 1;

//   const cronExpression = `${minute} ${hour} ${dayOfMonth} ${month} *`;

//   console.log(`Scheduled for: ${cronExpression}`);
//   const task = cron.schedule(cronExpression, async () => {
//     try {
//       //   await cekStatus({ order });
//       const stats = await cekStatus({
//         order: order,
//       });
//       if (stats.data.status_code != 200) {
//         await expirePayment({ order });
//       }
//       console.log(`Status checked for order: ${order}`);
//     } catch (error) {
//       console.error("Error checking order status:", error);
//     }
//     task.stop();
//   });

//   return task;
// };
const scheduleCekStatusExpire = (
  order,
  scheduledTime,
  uniqueTransactionCode
) => {
  const dateTime = new Date(scheduledTime);
  const minute = dateTime.getMinutes();
  const hour = dateTime.getHours();
  const dayOfMonth = dateTime.getDate();
  const month = dateTime.getMonth() + 1;

  const cronExpression = `${minute} ${hour} ${dayOfMonth} ${month} *`;

  console.log(`Scheduled for: ${cronExpression}`);
  const task = cron.schedule(cronExpression, async () => {
    try {
      const response = await infopay({ uniqueTransactionCode });

      if (response.success && response.data) {
        const { statusTransaction } = response.data.checkStatusResp;

        console.log(`Status for order: ${order} - ${statusTransaction}`);
      } else {
        console.error(`Failed to get a valid response for order: ${order}`);
      }
    } catch (error) {
      console.error(
        `Error checking order status for order: ${order}, Error: ${error.message}`
      );
    }
    task.stop();
  });

  return task;
};

//Disbursment
const checkStatusDisbursement = async ({
  proposal_id,
  query_stan,
  query_trans_datetime,
  refNumber,
  nama,
  cronLogId
}) => {
  const nowWIB = moment().utc().add(7, 'hours').toDate();

  try {
    console.log(`🔍 [${refNumber}] Checking status disbursement...`);

    const saveToDb = async (data, type) => {
      const m = data?.MethodResponse;
      await prisma.disbursement.create({
        data: {
          proposal_id,
          type,
          stan: m.TransactionID?.STAN,
          trans_datetime: m.TransactionID?.TransDateTime,
          inst_id: m.TransactionID?.InstID,

          sender_account_id: m.TransferData?.SenderData?.AccountID,
          sender_name: m.TransferData?.SenderData?.Name,
          sender_curr_code: m.TransferData?.SenderData?.CurrCode,
          sender_amount: m.TransferData?.SenderData?.Amount,
          sender_rate: m.TransferData?.SenderData?.Rate,

          beneficiary_inst_id: m.TransferData?.BeneficiaryData?.InstID,
          beneficiary_account_id: m.TransferData?.BeneficiaryData?.AccountID,
          beneficiary_curr_code: m.TransferData?.BeneficiaryData?.CurrCode,
          beneficiary_amount: m.TransferData?.BeneficiaryData?.Amount,
          beneficiary_cust_ref_number: m.TransferData?.BeneficiaryData?.CustRefNumber,
          beneficiary_name: m.TransferData?.BeneficiaryData?.Name?.trim(),
          beneficiary_regency_code: m.TransferData?.BeneficiaryData?.RegencyCode,

          response_code: m.TransferData?.Response?.Code ?? m.Response?.Code,
          response_description:
            m.TransferData?.Response?.Description ??
            (m.Response?.Description ? `${m.Response.Description} - Error Cek Status` : 'Error Cek Status'),

          signature_data: m.Signature?.Data,
          created_at: nowWIB,
        },
      });
    };

    const handleTransferResult = async (transfer, refNumberTransfer, statusEmail) => {
      const m = transfer.MethodResponse;

      const bankCodeNormalized = parseInt(m.TransferData.BeneficiaryData.InstID, 10).toString();
      const bank = await prisma.bank.findFirst({
        where: { bank_code: bankCodeNormalized },
        select: { bank_name: true },
      });
      const bank_name = bank?.bank_name || 'Bank tidak ditemukan';

      const formattedDana = Number(m.TransferData.BeneficiaryData.Amount).toLocaleString("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      });

      const formattedDate = `${new Date().toLocaleDateString("id-ID", {
        day: "numeric", month: "long", year: "numeric",
      })} ${new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit", minute: "2-digit", hour12: false,
      })} WIB`;

      const proposal = await prisma.proposal.findUnique({
        where: { id: proposal_id },
        include: {
          user: { select: { mustahiq: true, username: true } },
          program: { select: { program_title: true, program_category: true } },
        },
      });

      const templateEmail = await generateTemplateProposalBayar({
        nama,
        formattedDate,
        formattedDana,
        program: proposal.program?.program_title || '-',
        bank_name,
        programCategory: proposal.program?.program_category?.name || '-',
        refNumber: refNumberTransfer,
        bank_number: m.TransferData.BeneficiaryData.AccountID || "-",
        bank_account_name: m.TransferData.BeneficiaryData.Name?.trim() || "-",
        namaPengirim: m.TransferData.SenderData.Name?.trim() || "-",
        rekPengirim: m.TransferData.SenderData.AccountID || "-",
        status: statusEmail,
      });

      await sendEmail({
        email: proposal.user.username,
        html: templateEmail,
        subject: statusEmail === 'Success'
          ? "Pembayaran Proposal Telah Berhasil Ditransfer"
          : "Pembayaran Proposal Gagal",
      });
    };

    const lastRecord = await prisma.disbursement.findFirst({
      where: { type: 'status' },
      orderBy: { id: 'desc' },
      select: { stan: true },
    });

    const lastStan = lastRecord?.stan || '0';
    const newStan = parseInt(lastStan, 10) + 1;
    const stan = newStan.toString().padStart(6, '0');

    const result = await StatusAJ({
      trans_stan: stan,
      query_stan,
      query_trans_datetime,
    });

    if (result?.success === false) {
      await saveToDb(result.data, result.type);
      console.log('❌ Gagal cek status, akan dicoba lagi besok.');
      await prisma.disbursement_cron_log.update({
        where: { id: cronLogId },
        data: { status: 'waiting', updated_at: nowWIB },
      });
      return;
    }

    console.log('✅ Cek Status Berhasil.');
    await saveToDb(result, 'status');

    const responseCode = result?.MethodResponse?.TransferData?.Response?.Code;

    if (responseCode === '00') {
      console.log('✅ Transaksi berhasil, mengirim email...');
      await handleTransferResult(result, refNumber, 'Success');
      await prisma.disbursement_cron_log.update({
        where: { id: cronLogId },
        data: { status: 'success', updated_at: nowWIB },
      });
    } else if (responseCode === 'TO' || responseCode === '68') {
      console.log(`⚠️ Timeout/repeat (${responseCode}), akan dicoba lagi besok.`);
      await prisma.disbursement_cron_log.update({
        where: { id: cronLogId },
        data: { status: 'waiting', updated_at: nowWIB },
      });
    } else {
      console.log(`❌ Transaksi gagal (${responseCode}).`);
      await handleTransferResult(result, refNumber, 'Gagal');
      await prisma.disbursement_cron_log.update({
        where: { id: cronLogId },
        data: { status: 'failed', updated_at: nowWIB },
      });
    }

  } catch (error) {
    console.error(`🔥 Gagal cek status: ${error.message}`);
    if (cronLogId) {
      await prisma.disbursement_cron_log.update({
        where: { id: cronLogId },
        data: { status: 'failed', updated_at: nowWIB },
      });
    }
  }
};

module.exports = {
  scheduleCekStatus,
  scheduleCekStatusExpire,
  scheduleCekStatusKonser,
  scheduleCekStatusVrfp,
  checkStatusDisbursement
};
