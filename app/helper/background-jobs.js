const cron = require("node-cron");
const { cekStatus, expirePayment } = require("../helper/midtrans");
const { prisma } = require("../../prisma/client");

const scheduleCekStatus = (order) => {
  const task = cron.schedule("*/15 * * * *", async () => {
    try {
      const stats = await cekStatus({
        order: order,
      });
      if (stats.data.status_code != 200) {
        const stat = await expirePayment({ order });
        try {
          const updateResult = await prisma.pemesanan_megakonser.update({
            where: {
              kode_pemesanan: order, // Pastikan tipe data `order` adalah string atau sesuai dengan tipe di database
            },
            data: {
              status: 'expire', // Pastikan `transaction_status` sesuai dengan tipe di database
            },
          });

          console.log('Update sukses:', updateResult);
        } catch (error) {
          console.error('Error during update:', error.message);
          // Handle error response jika diperlukan
        }
      }
      //   await cekStatus({ order });
      console.log(`Status checked for order: ${order}`);
    } catch (error) {
      console.error("Error checking order status:", error);
    }
    task.stop();
  });
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
  scheduleCekStatusExpire
};
