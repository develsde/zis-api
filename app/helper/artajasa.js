const axios = require("axios");
const xml2js = require('xml2js');

const ReqAJ = async ({ id }) => {
  const date = new Date();
  const dates = new Date().toISOString();
  const formattedDate = dates.replace(/[-:.TZ]/g, "").slice(0, 14);
  const pad = (number) => (number < 10 ? "0" : "") + number;
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  const formattedDates = `${year}${month}${day}${hours}${minutes}${seconds}`;
  const institusiID = "nanti dikasih";
  const token = "nanti dikasih";
  const xml = `
  <?xml version="1.0"?>
  <MethodCall>
    <MethodID>
      <Name>Transfer.Artajasa.ATMBTransfer</Name>
    </MethodID>
    <TransactionID>
      <STAN>${id}</STAN>
      <TransDateTime>${formattedDates}</TransDateTime>
      <InstID>${institusiID}</InstID>
      <TokenID>${token}</TokenID>
    </TransactionID>
    <TransactionInfo>
      <ProcCode>40</ProcCode>
      <ChannelType>ChannelType</ChannelType>
      <RefNumber>RefNumber</RefNumber>
      <TerminalID>TerminalID</TerminalID>
      <CountryCode>ID</CountryCode>
      <LocalDateTime>${formattedDate}</LocalDateTime>
    </TransactionInfo>
    <SenderData>
      <AccountID>AccountID</AccountID>
      <Name>Name</Name>
      <CurrCode>CurrCode</CurrCode>
      <Amount>Amount</Amount>
      <Rate>Rate</Rate>
      <AreaCode>AreaCode</AreaCode>
    </SenderData>
    <BeneficiaryData>
      <InstID>InstID</InstID>
      <AccountID>AccountID</AccountID>
      <CurrCode>CurrCode</CurrCode>
      <Amount>Amount</Amount>
      <CustRefNumber>CustRefNumber</CustRefNumber>
      <Name>Name</Name>
      <RegencyCode>TNA</RegencyCode>
      <PurposeCode>3</PurposeCode>
      <PurposeDesc>Qurban</PurposeDesc>
    </BeneficiaryData>
    <Signature>
      <Data>Data</Data>
    </Signature>
  </MethodCall>
  `;
  const parseXml = (xml) => {
    return new Promise((resolve, reject) => {
      xml2js.parseString(xml, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };

  try {
    const response = await axios.post(
      'API',
      xml,
      {
        headers: {
          "Content-Type": "application/xml",
        },
      }
    );

    const jsonResult = await parseXml(response.data);
    console.log('JSON result:', JSON.stringify(jsonResult, null, 2));

    return jsonResult;
  } catch (error) {
    console.error("Error:", error.response ? error.response.data : error.message);
    throw error;
  }
};

const InquiryAJ = async ({id}) => {
  const date = new Date();
  const dates = new Date().toISOString();
  const formattedDate = dates.replace(/[-:.TZ]/g, "").slice(0, 14);
  const pad = (number) => (number < 10 ? "0" : "") + number;
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  const formattedDates = `${year}${month}${day}${hours}${minutes}${seconds}`;
  const institusiID = "nanti dikasih";
  const xml = `
  <?xml version="1.0" ?>
  <MethodCall>
    <MethodID>
      <Name>Transfer.Artajasa.ATMBTransfer</Name>
    </MethodID>
    <TransactionID>
      <STAN>${id}</STAN>
      <TransDateTime>${formattedDates}</TransDateTime>
      <InstID>${institusiID}</InstID>
    </TransactionID>
    <TransactionInfo>
      <CountryCode>ID</CountryCode>
      <LocalDateTime>${formattedDate}</LocalDateTime>
    </TransactionInfo>
    <QueryTransactionID>
      <STAN>${id}</STAN>
      <TransDateTime>${formattedDates}</TransDateTime>
    </QueryTransactionID>
    <Signature>
      <Data>Data</Data>
    </Signature>
  </MethodCall>
  `
  const parseXml = (xml) => {
    return new Promise((resolve, reject) => {
      xml2js.parseString(xml, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };

  try {
    const response = await axios.post(
      'API',
      xml,
      {
        headers: {
          "Content-Type": "application/xml",
        },
      }
    );
    const jsonResult = await parseXml(response.data);
    console.log('JSON result:', JSON.stringify(jsonResult, null, 2));

    return jsonResult;
  } catch (error) {
    console.error("Error:", error.response ? error.response.data : error.message);
    throw error;
  }
}

const BalanceAJ = async ({id}) => {
  const date = new Date();
  const dates = new Date().toISOString();
  const formattedDate = dates.replace(/[-:.TZ]/g, "").slice(0, 14);
  const pad = (number) => (number < 10 ? "0" : "") + number;
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const minutes = pad(date.getUTCMinutes());
  const seconds = pad(date.getUTCSeconds());
  const formattedDates = `${year}${month}${day}${hours}${minutes}${seconds}`;
  const institusiID = "000146";
  const xml = `
  <?xml version="1.0" ?>
  <MethodCall>
    <MethodID>
      <Name>Transfer.Artajasa.ATMBTransfer</Name>
    </MethodID>
    <TransactionID>
      <STAN>STAN</STAN>
      <TransDateTime>${formattedDates}</TransDateTime>
      <InstID>${institusiID}</InstID>
    </TransactionID>
    <TransactionInfo>
      <LocalDateTime>${formattedDate}</LocalDateTime>
    </TransactionInfo>
    <Signature>
      <Data>Data</Data>
    </Signature>
  </MethodCall>
  `
  const parseXml = (xml) => {
    return new Promise((resolve, reject) => {
      xml2js.parseString(xml, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  };

  try {
    const response = await axios.post(
      'https://certapi2.artajasa.co.id:9443/Disburssecure/ApiGetBalanceDisburse/servlet/DisburseZIS ',
      xml,
      {
        headers: {
          "Content-Type": "application/xml",
        },
      }
    );
    const jsonResult = await parseXml(response.data);
    console.log('JSON result:', JSON.stringify(jsonResult, null, 2));

    return jsonResult;
  } catch (error) {
    console.error("Error:", error.response ? error.response.data : error.message);
    throw error;
  }
}

module.exports = {
  ReqAJ,
  BalanceAJ,
  InquiryAJ
};
