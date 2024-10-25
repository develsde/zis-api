const cron = require("node-cron");
const { cekStatus, expirePayment } = require("../helper/midtrans");
const { prisma } = require("../../prisma/client");
const {
  sendEmail,
  generateTemplateMegaKonser,
  generateTemplateExpiredMegaKonser,
  sendEmailWithPdf,
} = require("../helper/email");
const fs = require('fs');

const scheduleCekStatus = async ({ order, email, pemesanan, filePath }) => {
  // Log the start of the process for the order
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

      // Log the status response from cekStatus
      console.log(`Status response for order: ${order} - Status code: ${stats.data?.status_code}, Transaction status: ${stats.data?.transaction_status}`);

      if (stats.data?.status_code == 200) {
        // Generate email template
        const templateEmail = await generateTemplateMegaKonser({
          email,
          password: email,
          tiket: pemesanan,
        });

        // Log the template creation
        console.log(`Generated email template for order: ${order}, Email: ${email}`);

        const msgId = await sendEmailWithPdf({
          email,
          html: templateEmail,
          subject: "Pembelian Tiket Sound of Freedom",
          pdfPath: filePath,
        });

        // Log the email sent with PDF
        console.log(`Email with PDF sent for order: ${order}, Email: ${email}, Message ID: ${msgId}`);

        // Delete the PDF file after sending
        // fs.unlink(filePath, (err) => {
        //   if (err) {
        //     console.error("Error saat menghapus file PDF:", err);
        //   } else {
        //     console.log(`Deleted PDF file for order: ${order}, File path: ${filePath}`);
        //   }
        // });

        // Update the order status to 'settlement'
        await prisma.pemesanan_megakonser.update({
          where: { kode_pemesanan: order },
          data: { status: stats.data.transaction_status || "" },
        });

        // Log the order settlement
        console.log(`Order ${order} settled successfully. Email sent: ${msgId}`);
        task.stop();
      } else {
        elapsedMinutes += 2;
        // Log the elapsed time
        console.log(`Elapsed time for order: ${order} is now ${elapsedMinutes} minutes`);

        if (elapsedMinutes >= 15) {
          // Expire the payment if it takes too long
          stats = await expirePayment({ order });

          // Generate expired email template
          const templateEmailExpired = await generateTemplateExpiredMegaKonser({
            email,
            password: email,
            tiket: pemesanan,
          });

          // Send expired email
          const msgId = await sendEmail({
            email,
            html: templateEmailExpired,
            subject: "Pembelian Tiket Mega Konser Indosat",
          });

          // Log the expired status
          console.log(`Order ${order} expired. Notification sent: ${msgId}`);

          // Update the order status to 'expired'
          await prisma.pemesanan_megakonser.update({
            where: { kode_pemesanan: order },
            data: { status: "expired" },
          });

          task.stop();
        }
      }
    } catch (error) {
      // Log any errors during the process
      console.error(`Error checking order status for order: ${order}, Error: ${error.message}`);
    }
  });
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

const scheduleCekStatusExpire = (order, scheduledTime) => {
  const dateTime = new Date(scheduledTime);
  const minute = dateTime.getMinutes();
  const hour = dateTime.getHours();
  const dayOfMonth = dateTime.getDate();
  const month = dateTime.getMonth() + 1;

  const cronExpression = `${minute} ${hour} ${dayOfMonth} ${month} *`;

  console.log(`Scheduled for: ${cronExpression}`);
  const task = cron.schedule(cronExpression, async () => {
    try {
      //   await cekStatus({ order });
      const stats = await cekStatus({
        order: order,
      });
      if (stats.data.status_code != 200) {
        await expirePayment({ order });
      }
      console.log(`Status checked for order: ${order}`);
    } catch (error) {
      console.error("Error checking order status:", error);
    }
    task.stop();
  });

  return task;
};

module.exports = {
  scheduleCekStatus,
  scheduleCekStatusExpire,
};
