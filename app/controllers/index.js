const user = require("./controller-user");
const home = require("./controller-home");
const bank = require("./controller-bank");
const proposal = require("./controller-proposal");
const jurnal = require("./controller-jurnal");
const pettyCash = require("./controller-pettycash");
const budget = require("./controller-budget");
const refData = require("./controller-reference");
const usererp = require("./controller-user-erp");
const programerp = require("./controller-program-erp");
const waqif = require("./controller-wakif");
const mitra = require("./controller-mitra");
const payment = require("./controller-payment");
const report = require("./controller-report");

//middleware new ERP-dashboard
const dashboard = require("./controller-dashboard");

module.exports = {
  user,
  home,
  bank,
  usererp,
  programerp,
  refData,
  proposal,
  jurnal,
  pettyCash,
  budget,
  waqif,
  mitra,
  dashboard,
  payment,
  report
};
