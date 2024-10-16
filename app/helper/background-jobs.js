const cron = require("node-cron");
const { cekStatus, expirePayment } = require("../helper/midtrans");
const { prisma } = require("../../prisma/client");
const { sendEmail, generateTemplateMegaKonser, generateTemplateExpiredMegaKonser } = require("../helper/email");

const scheduleCekStatus = async (order, email) => {
  const currentStatus = await prisma.pemesanan_megakonser.findFirst({
    where: { kode_pemesanan: order },
  });

  if (currentStatus?.status === "settlement") {
    console.log(`Order ${order} is already settled.`);
    return;
  }

  const task = cron.schedule("*/15 * * * *", async () => {
    try {
      let stats = await cekStatus({ order });

      if (stats.data.status_code !== 200) {
        stats = await expirePayment({ order });
        const templateEmail = await generateTemplateExpiredMegaKonser({ email: email, password: email });
        const msgId = await sendEmail({
          email: email,
          html: templateEmail,
          subject: "Pembelian Tiket Mega Konser Indosat",
        });
      } else {
        const templateEmail = await generateTemplateMegaKonser({ email: email, password: email });
        const msgId = await sendEmail({
          email: email,
          html: templateEmail,
          subject: "Pembelian Tiket Sound of Freedom",
        });
      }

      const updateResult = await prisma.pemesanan_megakonser.update({
        where: { kode_pemesanan: order },
        data: { status: stats.data?.transaction_status || "" },
      });

      console.log("Update sukses:", updateResult);
    } catch (error) {
      console.error("Error checking order status:", error.message);
    } finally {
      task.stop();
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
