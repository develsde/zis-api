const cron = require("node-cron");
const { cekStatus, expirePayment } = require("../helper/midtrans");
const { prisma } = require("../../prisma/client");
const {
  sendEmail,
  generateTemplateMegaKonser,
  generateTemplateExpiredMegaKonser,
  sendEmailWithPdf,
} = require("../helper/email");
const { reqpay, infoPay } = require("../controllers/controller-payment.js");
const fs = require("fs");

// const scheduleCekStatus = async ({ order, email, pemesanan, filePath }) => {
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

//       // Log the status response from cekStatus
//       console.log(`Status response for order: ${order} - Status code: ${stats.data?.status_code}, Transaction status: ${stats.data?.transaction_status}`);

//       if (stats.data?.status_code == 200) {
//         // Generate email template
//         const templateEmail = await generateTemplateMegaKonser({
//           email,
//           password: email,
//           tiket: pemesanan,
//         });

//         // Log the template creation
//         console.log(`Generated email template for order: ${order}, Email: ${email}`);

//         const msgId = await sendEmailWithPdf({
//           email,
//           html: templateEmail,
//           subject: "Pembelian Tiket Sound of Freedom",
//           pdfPath: filePath,
//         });

//         // Log the email sent with PDF
//         console.log(`Email with PDF sent for order: ${order}, Email: ${email}, Message ID: ${msgId}`);

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
//         console.log(`Order ${order} settled successfully. Email sent: ${msgId}`);
//         task.stop();
//       } else {
//         elapsedMinutes += 2;
//         // Log the elapsed time
//         console.log(`Elapsed time for order: ${order} is now ${elapsedMinutes} minutes`);

//         if (elapsedMinutes >= 15) {
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
//
const scheduleCekStatus = async ({ uniqueTransactionCode }) => {
  console.log(`Starting schedule for order: ${uniqueTransactionCode}`);

  // Cek apakah uniqueTransactionCode sudah memiliki status di tabel log_aj menggunakan Prisma
  const existingLog = await prisma.log_aj.findFirst({
    where: {
      uniqueCode: uniqueTransactionCode,
      status: {
        not: null, // Hanya cek jika status tidak null
      },
    },
  });

  if (existingLog) {
    console.log(
      `Order ${uniqueTransactionCode} already has status: ${existingLog.status}, job will not be started.`
    );
    return; // Jika sudah ada status, hentikan eksekusi fungsi
  }

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
              `Transaction successful for order: ${uniqueTransactionCode}, stopping job.`
            );
            task.stop();
            return; // Menghentikan eksekusi lebih lanjut
          }

          // Periksa apakah statusTransConclusion tidak null
          if (statusTransConclusion !== null) {
            console.log(
              `Status conclusion for order: ${uniqueTransactionCode} is not null, stopping job.`
            );
            task.stop();
            return; // Menghentikan eksekusi lebih lanjut
          }

          elapsedMinutes += 2;
          if (elapsedMinutes >= 20) {
            console.log(
              `Stopping job after 10 minutes for order: ${uniqueTransactionCode}`
            );
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

module.exports = {
  scheduleCekStatus,
  scheduleCekStatusExpire,
};
