const ax = require("axios");
var apikey = process.env.API_KEY;
const OngkirJNE = async ({ froms, to, kg }) => {
  let uname = "BERMARTABAT";
  const datas = {
    username: uname,
    api_key: apikey,
    from: froms,
    thru: to,
    weight: kg
  };
  try {
    const response = await ax.post(
      `https://apiv2.jne.co.id:10205/tracing/api/pricedev`,
      datas,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
      }
    );
    return response;
  } catch (error) {
    console.error("Error:", error.response.data);
    throw error;
  }
};
module.exports = {
  OngkirJNE,
};
