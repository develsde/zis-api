const axios = require("axios");
const xml2js = require('xml2js');
const fs = require("fs");
const moment = require("moment");
const crypto = require('crypto');

const StatusAJ = async ({ trans_stan, query_stan, query_trans_datetime }) => {
  const pad = (n) => n.toString().padStart(2, '0');

  const date = new Date();

  const transDateTime =
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds());

  const localDateTime = moment(date).format("YYYYMMDDHHmmss");

  const institusiID = "000146";
  const countryCode = "ID";

  const signatureData =
    trans_stan +
    transDateTime +
    institusiID +
    localDateTime +
    query_stan +
    query_trans_datetime

  // 🔐 Generate EMSA-PKCS1-v1_5 signature with MD5 manually
  const md5 = crypto.createHash('md5').update(signatureData, 'utf8').digest();

  // DigestInfo untuk MD5 (DER encoding)
  const digestInfoPrefix = Buffer.from([0x30, 0x20,       // SEQUENCE, length 32
    0x30, 0x0C,       // SEQUENCE, length 12
    0x06, 0x08,       // OID, length 8
    0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x02, 0x05, // 1.2.840.113549.2.5 (MD5)
    0x05, 0x00,       // NULL
    0x04, 0x10        // OCTET STRING, length 16
  ]);

  const digestInfo = Buffer.concat([digestInfoPrefix, md5]); // 18 + 16 = 34 bytes

  // Generate PS = 0xFF repeated, total 128 bytes
  const keySize = 256; // 2048-bit key = 256 bytes
  const psLength = keySize - digestInfo.length - 3;
  const ps = Buffer.alloc(psLength, 0xFF);

  const em = Buffer.concat([
    Buffer.from([0x00, 0x01]),
    ps,
    Buffer.from([0x00]),
    digestInfo
  ]);

  // 🔏 Sign the EM (Encrypted Message) with RSA Private Key
  const privateKey = fs.readFileSync('./app/helper/private.key', 'utf8');
  const encrypted = crypto.privateEncrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_NO_PADDING,
    },
    em
  );

  const signature = encrypted.toString('hex');

  const xml = `<?xml version="1.0"?>
<MethodCall>
  <MethodID>
    <Name>Status.Artajasa.ATMBTransfer</Name>
  </MethodID>
  <TransactionID>
    <STAN>${trans_stan}</STAN>
    <TransDateTime>${transDateTime}</TransDateTime>
    <InstID>${institusiID}</InstID>
  </TransactionID>
  <TransactionInfo>
    <CountryCode>${countryCode}</CountryCode>
    <LocalDateTime>${localDateTime}</LocalDateTime>
  </TransactionInfo>
  <QueryTransactionID>
    <STAN>${query_stan}</STAN>
    <TransDateTime>${query_trans_datetime}</TransDateTime>
  </QueryTransactionID>
  <Signature>
    <Data>${signature}</Data>
  </Signature>
</MethodCall>`;

  const parseXml = (xml) =>
    new Promise((resolve, reject) => {
      xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

  try {
    const response = await axios.post(
      'https://certapi2.artajasa.co.id:9443/Disburssecure/Disbursement/servlet/DisburseZIS',
      xml,
      {
        headers: {
          "Content-Type": "application/xml",
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    const jsonResult = await parseXml(response.data);
    console.log('Response Status from Artajasa:', JSON.stringify(jsonResult, null, 2));

    const errorCode = jsonResult?.MethodResponse.Response.Code
    const errorDesc = jsonResult?.MethodResponse.Response.Description
    if (errorCode != '00') {
      return {
        success: false,
        type: 'status',
        errorCode: errorCode,
        errorDesc: errorDesc,
        data: jsonResult
      };
    }

    const cert = fs.readFileSync('./app/helper/certificate-aj.crt', 'utf8');
    const publicKey = crypto.createPublicKey(cert);

    // 2. Ambil signature dari response XML
    const signatureHex = jsonResult?.MethodResponse?.Signature?.Data;
    if (!signatureHex) {
      throw new Error('Signature tidak ditemukan dalam response');
    }

    const signatureBuffer = Buffer.from(signatureHex, 'hex');

    // 3. Dekripsi signature dengan RSA public key (tanpa padding)
    const decrypted = crypto.publicDecrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_NO_PADDING,
      },
      signatureBuffer
    );

    // 4. Ambil hash dari decrypted data
    const decryptedDigestInfo = decrypted.slice(-16); // MD5 hash selalu 16 byte
    const expectedHash = decryptedDigestInfo.toString('hex');

    // 5. Hitung hash dari data response yang seharusnya disign
    // ⚠️ Anda perlu menyusun ulang `signatureData` dari elemen-elemen response
    const d = jsonResult?.MethodResponse;
    const reconstructedData =
      d.TransactionID.STAN +
      d.TransactionID.TransDateTime +
      d.TransactionID.InstID +
      d.QueryTransactionID.STAN +
      d.QueryTransactionID.TransDateTime +
      d.Response.Code;

    const actualHash = crypto.createHash('md5').update(reconstructedData, 'utf8').digest('hex');

    if (expectedHash === actualHash) {
      console.log('✅ Signature Status Inquiry dari Artajasa VALID');
      return jsonResult;

    } else {
      console.error('❌ Signature Status Inquiry dari Artajasa TIDAK VALID');
      throw new Error('Signature Status Inquiry validation failed!');
    }

  } catch (error) {
    if (error.response) {
      const contentType = error.response.headers['content-type'];
      if (contentType?.includes('application/xml')) {
        try {
          const errorJson = await parseXml(error.response.data);
          return {
            success: false,
            message: errorJson?.MethodResponse?.ErrorDesc || 'Unknown error',
            error: errorJson,
          };
        } catch (parseError) {
          return {
            success: false,
            message: 'Failed to parse server XML error',
          };
        }
      } else {
        return {
          success: false,
          message: error.response.data || error.message,
        };
      }
    } else {
      return {
        success: false,
        message: "Request error",
        error: error.message,
      };
    }
  }
};

const InquiryAJ = async ({ stan, refNumberInquiry, custRefNumber, nama_rekening, amount, beneficiaryInstId, beneficiaryAccountId }) => {
  const pad = (n) => n.toString().padStart(2, '0');

  const date = new Date();

  const transDateTime =
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds());

  const localDateTime = moment(date).format("YYYYMMDDHHmmss");

  const institusiID = "000146";
  const customerID = "1234567890123456";
  const senderAccountID = (institusiID + customerID).padEnd(28, '0');

  const procCode = "390000";
  const channelType = "6014";
  const terminalID = "12345678";
  const countryCode = "ID";

  const senderName = "ZIS INDOSAT";
  const customerName = "JohnDoe";
  let senderNameFull = `${senderName}-${customerName}`;
  if (senderNameFull.length > 30) senderNameFull = senderNameFull.slice(0, 30);

  const amountSender = amount.toFixed(2); // nominal transfer sender
  const currency = "360";  // kode mata uang (360 = IDR)
  const rate = "1.0000";
  const areaCode = "391";

  // const beneficiaryInstId = "425";
  // const beneficiaryAccountId = "001001001";
  const regencyCode = "31";
  const purposeCode = "3";
  const purposeDesc = "Transfer Dana";

  const signatureData =
    stan +                        // 1. TransactionID.STAN
    transDateTime +                // 2. TransactionID.TransDateTime
    institusiID +                  // 3. TransactionID.InstID
    refNumberInquiry +                    // 4. TransactionInfo.RefNumber
    terminalID +                   // 5. TransactionInfo.TerminalID
    localDateTime +                // 6. TransactionInfo.LocalDateTime
    senderAccountID +              // 7. SenderData.AccountID
    amountSender +                          // 8. SenderData.Amount
    beneficiaryInstId +                             // 9. BeneficiaryData.InstID
    beneficiaryAccountId +                       // 10. BeneficiaryData.AccountID
    amount +                          // 11. BeneficiaryData.Amount
    custRefNumber +                      // 12. BeneficiaryData.CustRefNumber
    countryCode;                   // 13. TransactionInfo.CountryCode

  // 🔐 Generate EMSA-PKCS1-v1_5 signature with MD5 manually
  const md5 = crypto.createHash('md5').update(signatureData, 'utf8').digest();

  // DigestInfo untuk MD5 (DER encoding)
  const digestInfoPrefix = Buffer.from([0x30, 0x20,       // SEQUENCE, length 32
    0x30, 0x0C,       // SEQUENCE, length 12
    0x06, 0x08,       // OID, length 8
    0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x02, 0x05, // 1.2.840.113549.2.5 (MD5)
    0x05, 0x00,       // NULL
    0x04, 0x10        // OCTET STRING, length 16
  ]);

  const digestInfo = Buffer.concat([digestInfoPrefix, md5]); // 18 + 16 = 34 bytes

  // Generate PS = 0xFF repeated, total 128 bytes
  const keySize = 256; // 2048-bit key = 256 bytes
  const psLength = keySize - digestInfo.length - 3;
  const ps = Buffer.alloc(psLength, 0xFF);

  const em = Buffer.concat([
    Buffer.from([0x00, 0x01]),
    ps,
    Buffer.from([0x00]),
    digestInfo
  ]);

  // 🔏 Sign the EM (Encrypted Message) with RSA Private Key
  const privateKey = fs.readFileSync('./app/helper/private.key', 'utf8');
  const encrypted = crypto.privateEncrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_NO_PADDING,
    },
    em
  );

  const signature = encrypted.toString('hex');

  const xml = `<?xml version="1.0"?>
<MethodCall>
  <MethodID>
    <Name>Inquiry.Artajasa.ATMBTransfer</Name>
  </MethodID>
  <TransactionID>
    <STAN>${stan}</STAN>
    <TransDateTime>${transDateTime}</TransDateTime>
    <InstID>${institusiID}</InstID>
  </TransactionID>
  <TransactionInfo>
    <ProcCode>${procCode}</ProcCode>
    <ChannelType>${channelType}</ChannelType>
    <RefNumber>${refNumberInquiry}</RefNumber>
    <TerminalID>${terminalID}</TerminalID>
    <CountryCode>${countryCode}</CountryCode>
    <LocalDateTime>${localDateTime}</LocalDateTime>
  </TransactionInfo>
  <SenderData>
    <AccountID>${senderAccountID}</AccountID>
    <Name>${senderNameFull}</Name>
    <CurrCode>${currency}</CurrCode>
    <Amount>${amountSender}</Amount>
    <Rate>${rate}</Rate>
    <AreaCode>${areaCode}</AreaCode>
  </SenderData>
  <BeneficiaryData>
    <InstID>${beneficiaryInstId}</InstID>
    <AccountID>${beneficiaryAccountId}</AccountID>
    <CurrCode>${currency}</CurrCode>
    <Amount>${amount}</Amount>
    <CustRefNumber>${custRefNumber}</CustRefNumber>
    <RegencyCode>${regencyCode}</RegencyCode>
    <PurposeCode>${purposeCode}</PurposeCode>
    <PurposeDesc>${purposeDesc}</PurposeDesc>
  </BeneficiaryData>
  <Signature>
    <Data>${signature}</Data>
  </Signature>
</MethodCall>`;

  const parseXml = (xml) =>
    new Promise((resolve, reject) => {
      xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

  try {
    const response = await axios.post(
      'https://certapi2.artajasa.co.id:9443/Disburssecure/Disbursement/servlet/DisburseZIS',
      xml,
      {
        headers: {
          "Content-Type": "application/xml",
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    const jsonResult = await parseXml(response.data);
    console.log('Response INQUIRY from Artajasa:', JSON.stringify(jsonResult, null, 2));

    const errorCode = jsonResult?.MethodResponse.Response.Code
    const errorDesc = jsonResult?.MethodResponse.Response.Description
    if (errorCode != '00') {
      return {
        success: false,
        type: 'inquiry',
        errorCode: errorCode,
        errorDesc: errorDesc,
        data: jsonResult
      };
    }

    // const nama_rek = jsonResult?.MethodResponse.BeneficiaryData.Name.trim() || '-'
    // if (nama_rekening.toLowerCase() !== nama_rek.toLowerCase()) {
    //   throw new Error('Gagal memverifikasi akun bank, pastikan nomor rekening dan nama pemilik sesuai')
    // }

    const cert = fs.readFileSync('./app/helper/certificate-aj.crt', 'utf8');
    const publicKey = crypto.createPublicKey(cert);

    // 2. Ambil signature dari response XML
    const signatureHex = jsonResult?.MethodResponse?.Signature?.Data;
    if (!signatureHex) {
      throw new Error('Signature tidak ditemukan dalam response');
    }

    const signatureBuffer = Buffer.from(signatureHex, 'hex');

    // 3. Dekripsi signature dengan RSA public key (tanpa padding)
    const decrypted = crypto.publicDecrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_NO_PADDING,
      },
      signatureBuffer
    );

    // 4. Ambil hash dari decrypted data
    const decryptedDigestInfo = decrypted.slice(-16); // MD5 hash selalu 16 byte
    const expectedHash = decryptedDigestInfo.toString('hex');

    // 5. Hitung hash dari data response yang seharusnya disign
    // ⚠️ Anda perlu menyusun ulang `signatureData` dari elemen-elemen response
    const d = jsonResult?.MethodResponse;
    const reconstructedData =
      d.TransactionID.STAN +
      d.TransactionID.TransDateTime +
      d.TransactionID.InstID +
      d.TransactionID.TokenID +
      d.SenderData.AccountID +
      d.SenderData.Amount +
      d.BeneficiaryData.InstID +
      d.BeneficiaryData.AccountID +
      d.BeneficiaryData.Amount +
      d.BeneficiaryData.CustRefNumber +
      d.BeneficiaryData.Name +
      d.Response.Code;

    const actualHash = crypto.createHash('md5').update(reconstructedData, 'utf8').digest('hex');

    // 6. Bandingkan H1 dan H2
    if (expectedHash === actualHash) {
      console.log('✅ Signature INQUIRY dari Artajasa VALID');
      return {
        success: true,
        message: "Inquiry berhasil",
        signature: '✅ Signature Valid',
        data: jsonResult
      };
    } else {
      console.error('❌ Signature INQUIRY dari Artajasa TIDAK VALID');
      throw new Error('Signature INQUIRY validation failed!');
    }

  } catch (error) {
    if (error.response) {
      const contentType = error.response.headers['content-type'];
      if (contentType?.includes('application/xml')) {
        try {
          const errorJson = await parseXml(error.response.data);
          return {
            success: false,
            message: 'Artajasa error',
            error: errorJson?.MethodResponse?.Response.Description,
          };
        } catch (parseError) {
          return {
            success: false,
            message: 'Failed to parse server XML error',
          };
        }
      } else {
        return {
          success: false,
          message: error.response.data || error.message,
        };
      }
    } else {
      return {
        success: false,
        message: "Request error",
        error: error.message,
      };
    }
  }
}

const BalanceAJ = async ({ stan }) => {
  const pad = (n) => n.toString().padStart(2, '0');

  const date = new Date();

  const transDateTime =
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds());

  const localDateTime = moment(date).format("YYYYMMDDHHmmss");

  const institusiID = "000146";

  const signatureData =
    stan +
    transDateTime +
    institusiID +
    localDateTime

  // 🔐 Generate EMSA-PKCS1-v1_5 signature with MD5 manually
  const md5 = crypto.createHash('md5').update(signatureData, 'utf8').digest();

  // DigestInfo untuk MD5 (DER encoding)
  const digestInfoPrefix = Buffer.from([0x30, 0x20,       // SEQUENCE, length 32
    0x30, 0x0C,       // SEQUENCE, length 12
    0x06, 0x08,       // OID, length 8
    0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x02, 0x05, // 1.2.840.113549.2.5 (MD5)
    0x05, 0x00,       // NULL
    0x04, 0x10        // OCTET STRING, length 16
  ]);

  const digestInfo = Buffer.concat([digestInfoPrefix, md5]); // 18 + 16 = 34 bytes

  // Generate PS = 0xFF repeated, total 128 bytes
  const keySize = 256; // 2048-bit key = 256 bytes
  const psLength = keySize - digestInfo.length - 3;
  const ps = Buffer.alloc(psLength, 0xFF);

  const em = Buffer.concat([
    Buffer.from([0x00, 0x01]),
    ps,
    Buffer.from([0x00]),
    digestInfo
  ]);

  // 🔏 Sign the EM (Encrypted Message) with RSA Private Key
  const privateKey = fs.readFileSync('./app/helper/private.key', 'utf8');
  const encrypted = crypto.privateEncrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_NO_PADDING,
    },
    em
  );

  const signature = encrypted.toString('hex');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<MethodCall>
  <MethodID>
    <Name>Information.Artajasa.GetBalance</Name>
  </MethodID>
  <TransactionID>
    <STAN>${stan}</STAN>
    <TransDateTime>${transDateTime}</TransDateTime>
    <InstID>${institusiID}</InstID>
  </TransactionID>
  <TransactionInfo>
    <LocalDateTime>${localDateTime}</LocalDateTime>
  </TransactionInfo>
  <Signature>
    <Data>${signature}</Data>
  </Signature>
</MethodCall>
`;

  const parseXml = (xml) =>
    new Promise((resolve, reject) => {
      xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

  try {
    const response = await axios.post(
      'https://certapi2.artajasa.co.id:9443/Disburssecure/ApiGetBalanceDisburse/servlet/DisburseZIS',
      xml,
      {
        headers: {
          "Content-Type": "application/xml",
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    const jsonResult = await parseXml(response.data);
    console.log('Response Check Balance from Artajasa:', JSON.stringify(jsonResult, null, 2));

    const errorCode = jsonResult?.MethodResponse.Response.Code
    const errorDesc = jsonResult?.MethodResponse.Response.Description
    if (errorCode != '00') {
      return {
        success: false,
        type: 'checkBalance',
        errorCode: errorCode,
        errorDesc: errorDesc,
        data: jsonResult
      };
    }

    const cert = fs.readFileSync('./app/helper/certificate-aj.crt', 'utf8');
    const publicKey = crypto.createPublicKey(cert);

    // 2. Ambil signature dari response XML
    const signatureHex = jsonResult?.MethodResponse?.Signature?.Data;
    if (!signatureHex) {
      throw new Error('Signature tidak ditemukan dalam response');
    }

    const signatureBuffer = Buffer.from(signatureHex, 'hex');

    // 3. Dekripsi signature dengan RSA public key (tanpa padding)
    const decrypted = crypto.publicDecrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_NO_PADDING,
      },
      signatureBuffer
    );

    // 4. Ambil hash dari decrypted data
    const decryptedDigestInfo = decrypted.slice(-16); // MD5 hash selalu 16 byte
    const expectedHash = decryptedDigestInfo.toString('hex');

    // 5. Hitung hash dari data response yang seharusnya disign
    // ⚠️ Anda perlu menyusun ulang `signatureData` dari elemen-elemen response
    const d = jsonResult?.MethodResponse;
    const reconstructedData =
      d.TransactionID.STAN +
      d.TransactionID.TransDateTime +
      d.TransactionID.InstID +
      d.TransactionInfo.LocalDateTime +
      d.Response.Code;

    const actualHash = crypto.createHash('md5').update(reconstructedData, 'utf8').digest('hex');

    if (expectedHash === actualHash) {
      console.log('✅ Signature Check Balance dari Artajasa VALID');
      return {
        success: true,
        message: "Check Balance berhasil",
        signature: '✅Check Balance Signature Valid',
        data: jsonResult,
      };

    } else {
      console.error('❌ Signature Check Balance dari Artajasa TIDAK VALID');
      throw new Error('Signature Check Balance validation failed!');
    }

  } catch (error) {
    if (error.response) {
      const contentType = error.response.headers['content-type'];
      if (contentType?.includes('application/xml')) {
        try {
          const errorJson = await parseXml(error.response.data);
          return {
            success: false,
            message: errorJson?.MethodResponse?.ErrorDesc || 'Unknown error',
            error: errorJson,
          };
        } catch (parseError) {
          return {
            success: false,
            message: 'Failed to parse server XML error',
          };
        }
      } else {
        return {
          success: false,
          message: error.response.data || error.message,
        };
      }
    } else {
      return {
        success: false,
        message: "Request error",
        error: error.message,
      };
    }
  }
}

const TransferAJ = async ({ stan, tokenID, refNumberTransfer, beneficiaryName, custRefNumber, amount, beneficiaryInstId, beneficiaryAccountId }) => {
  const pad = (n) => n.toString().padStart(2, '0');

  const institusiID = "000146";
  const customerID = "1234567890123456";
  const senderAccountID = (institusiID + customerID).padEnd(28, '0');

  const channelType = "6014";
  const terminalID = "12345678";
  const countryCode = "ID";

  const senderName = "ZIS INDOSAT";
  const customerName = "JohnDoe";
  let senderNameFull = `${senderName}-${customerName}`;
  if (senderNameFull.length > 30) senderNameFull = senderNameFull.slice(0, 30);

  const amountSender = Number(amount).toFixed(2);

  const currency = "360";  // kode mata uang (360 = IDR)
  const rate = "1.0000";
  const areaCode = "391";

  // const beneficiaryInstId = "425";
  // const beneficiaryAccountId = "001001001";
  const regencyCode = "31";
  const purposeCode = "3";
  const purposeDesc = "Transfer Dana";


  const procCodeFinal = "400000";
  const newDate = new Date();
  const newTransDateTime =
    newDate.getUTCFullYear().toString() +
    pad(newDate.getUTCMonth() + 1) +
    pad(newDate.getUTCDate()) +
    pad(newDate.getUTCHours()) +
    pad(newDate.getUTCMinutes()) +
    pad(newDate.getUTCSeconds());

  const newLocalDateTime = moment(newDate).format("YYYYMMDDHHmmss");

  if (!tokenID) {
    throw new Error("TokenID tidak ditemukan dalam response inquiry");
  } else if (!beneficiaryName) {
    throw new Error("Nama Penerima tidak ditemukan dalam response inquiry");
  }

  const signatureDataFinal =
    stan +                        // 1. TransactionID.STAN
    newTransDateTime +                // 2. TransactionID.TransDateTime
    institusiID +                  // 3. TransactionID.InstID
    tokenID +
    refNumberTransfer +                    // 4. TransactionInfo.RefNumber
    terminalID +                   // 5. TransactionInfo.TerminalID
    newLocalDateTime +                // 6. TransactionInfo.LocalDateTime
    senderAccountID +              // 7. SenderData.AccountID
    amountSender +                          // 8. SenderData.Amount
    beneficiaryInstId +                             // 9. BeneficiaryData.InstID
    beneficiaryAccountId +                       // 10. BeneficiaryData.AccountID
    amount +                          // 11. BeneficiaryData.Amount
    custRefNumber +                      // 12. BeneficiaryData.CustRefNumber
    countryCode;                   // 13. TransactionInfo.CountryCode

  // 🔐 Generate EMSA-PKCS1-v1_5 signature with MD5 manually
  const md5 = crypto.createHash('md5').update(signatureDataFinal, 'utf8').digest();

  // DigestInfo untuk MD5 (DER encoding)
  const digestInfoPrefix = Buffer.from([0x30, 0x20,       // SEQUENCE, length 32
    0x30, 0x0C,       // SEQUENCE, length 12
    0x06, 0x08,       // OID, length 8
    0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x02, 0x05, // 1.2.840.113549.2.5 (MD5)
    0x05, 0x00,       // NULL
    0x04, 0x10        // OCTET STRING, length 16
  ]);

  const digestInfo = Buffer.concat([digestInfoPrefix, md5]); // 18 + 16 = 34 bytes

  // Generate PS = 0xFF repeated, total 128 bytes
  const keySize = 256; // 2048-bit key = 256 bytes
  const psLength = keySize - digestInfo.length - 3;
  const ps = Buffer.alloc(psLength, 0xFF);

  const em = Buffer.concat([
    Buffer.from([0x00, 0x01]),
    ps,
    Buffer.from([0x00]),
    digestInfo
  ]);

  const privateKey = fs.readFileSync('./app/helper/private.key', 'utf8');
  const encrypted = crypto.privateEncrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_NO_PADDING,
    },
    em
  );

  const finalSignature = encrypted.toString('hex');

  // Inject TokenID ke xmlTransfer
  const xmlTransferFinal = `<?xml version="1.0"?>
<MethodCall>
  <MethodID>
    <Name>Transfer.Artajasa.ATMBTransfer</Name>
  </MethodID>
  <TransactionID>
    <STAN>${stan}</STAN>
    <TransDateTime>${newTransDateTime}</TransDateTime>
    <InstID>${institusiID}</InstID>
    <TokenID>${tokenID}</TokenID>
  </TransactionID>
  <TransactionInfo>
    <ProcCode>${procCodeFinal}</ProcCode>
    <ChannelType>${channelType}</ChannelType>
    <RefNumber>${refNumberTransfer}</RefNumber>
    <TerminalID>${terminalID}</TerminalID>
    <CountryCode>${countryCode}</CountryCode>
    <LocalDateTime>${newLocalDateTime}</LocalDateTime>
  </TransactionInfo>
  <SenderData>
    <AccountID>${senderAccountID}</AccountID>
    <Name>${senderNameFull}</Name>
    <CurrCode>${currency}</CurrCode>
    <Amount>${amountSender}</Amount>
    <Rate>${rate}</Rate>
    <AreaCode>${areaCode}</AreaCode>
  </SenderData>
  <BeneficiaryData>
    <InstID>${beneficiaryInstId}</InstID>
    <AccountID>${beneficiaryAccountId}</AccountID>
    <CurrCode>${currency}</CurrCode>
    <Amount>${amount}</Amount>
    <CustRefNumber>${custRefNumber}</CustRefNumber>
    <Name>${beneficiaryName}</Name>
    <RegencyCode>${regencyCode}</RegencyCode>
    <PurposeCode>${purposeCode}</PurposeCode>
    <PurposeDesc>${purposeDesc}</PurposeDesc>
  </BeneficiaryData>
  <Signature>
    <Data>${finalSignature}</Data>
  </Signature>
</MethodCall>`;

  const parseXml = (xml) =>
    new Promise((resolve, reject) => {
      xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

  try {
    // 🔁 Lakukan POST Transfer
    const transferResponse = await axios.post(
      'https://certapi2.artajasa.co.id:9443/Disburssecure/Disbursement/servlet/DisburseZIS',
      xmlTransferFinal,
      {
        headers: {
          "Content-Type": "application/xml",
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    const transferResult = await parseXml(transferResponse.data);
    console.log('Response TRANSFER dari Artajasa:', JSON.stringify(transferResult, null, 2));

    const errorCodeFinal = transferResult?.MethodResponse.Response.Code
    const errorDescFinal = transferResult?.MethodResponse.Response.Description
    if (errorCodeFinal !== '00') {
      return {
        success: false,
        type: 'transfer',
        errorCode: errorCodeFinal,
        errorDesc: errorDescFinal,
        data: transferResult
      };
    }

    const cert = fs.readFileSync('./app/helper/certificate-aj.crt', 'utf8');
    const publicKey = crypto.createPublicKey(cert);

    // 2. Ambil signature dari response XML
    const signatureHexFinal = transferResult?.MethodResponse?.Signature?.Data;
    if (!signatureHexFinal) {
      throw new Error('Signature tidak ditemukan dalam response');
    }

    const signatureBufferFinal = Buffer.from(signatureHexFinal, 'hex');

    // 3. Dekripsi signature dengan RSA public key (tanpa padding)
    const decryptedFinal = crypto.publicDecrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_NO_PADDING,
      },
      signatureBufferFinal
    );

    // 4. Ambil hash dari decrypted data
    const decryptedDigestInfoFinal = decryptedFinal.slice(-16); // MD5 hash selalu 16 byte
    const expectedHashFinal = decryptedDigestInfoFinal.toString('hex');

    // 5. Hitung hash dari data response yang seharusnya disign
    // ⚠️ Anda perlu menyusun ulang `signatureData` dari elemen-elemen response
    const dFinal = transferResult?.MethodResponse;
    const reconstructedDataFinal =
      dFinal.TransactionID.STAN +
      dFinal.TransactionID.TransDateTime +
      dFinal.TransactionID.InstID +
      dFinal.TransactionID.TokenID +
      dFinal.SenderData.AccountID +
      dFinal.SenderData.Amount +
      dFinal.BeneficiaryData.InstID +
      dFinal.BeneficiaryData.AccountID +
      dFinal.BeneficiaryData.Amount +
      dFinal.BeneficiaryData.CustRefNumber +
      dFinal.Response.Code;

    const actualHashFinal = crypto.createHash('md5').update(reconstructedDataFinal, 'utf8').digest('hex');

    if (expectedHashFinal === actualHashFinal) {
      console.log('✅ Signature TRANSFER dari Artajasa VALID');
      return {
        success: true,
        message: "Transfer berhasil",
        signature: '✅ Signature Valid',
        data: transferResult
      };
    } else {
      console.error('❌ Signature TRANSFER dari Artajasa TIDAK VALID');
      throw new Error('Signature TRANSFER validation failed!');
    }

  } catch (error) {
    if (error.response) {
      const contentType = error.response.headers['content-type'];
      if (contentType?.includes('application/xml')) {
        try {
          const errorJson = await parseXml(error.response.data);
          return {
            success: false,
            message: 'Artajasa error',
            error: errorJson?.MethodResponse?.Response.Description,
          };
        } catch (parseError) {
          return {
            success: false,
            message: 'Failed to parse server XML error',
          };
        }
      } else {
        return {
          success: false,
          message: error.response.data || error.message,
        };
      }
    } else {
      return {
        success: false,
        message: "Request error",
        error: error.message,
      };
    }
  }
}

const TransferInquiryAJ = async ({ stan, refNumberInquiry, refNumberTransfer, custRefNumber, nama_rekening, amount, beneficiaryInstId, beneficiaryAccountId }) => {
  const pad = (n) => n.toString().padStart(2, '0');

  const date = new Date();

  const transDateTime =
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds());

  const localDateTime = moment(date).format("YYYYMMDDHHmmss");

  const institusiID = "000146";
  const customerID = "1234567890123456";
  const senderAccountID = (institusiID + customerID).padEnd(28, '0');

  const procCode = "390000";
  const channelType = "6010";
  const terminalID = "12345678";
  const countryCode = "ID";

  const senderName = "ZIS INDOSAT";
  const customerName = "JohnDoe";
  let senderNameFull = `${senderName}-${customerName}`;
  if (senderNameFull.length > 30) senderNameFull = senderNameFull.slice(0, 30);

  // const amount = "100000"; // nominal transfer
  const currency = "360";  // kode mata uang (360 = IDR)
  const rate = "1.0000";
  const areaCode = "391";

  // const beneficiaryInstId = "425";
  // const beneficiaryAccountId = "001001001";
  const regencyCode = "31";
  const purposeCode = "3";
  const purposeDesc = "Transfer Dana";

  const signatureData =
    stan +                        // 1. TransactionID.STAN
    transDateTime +                // 2. TransactionID.TransDateTime
    institusiID +                  // 3. TransactionID.InstID
    refNumberInquiry +                    // 4. TransactionInfo.RefNumber
    terminalID +                   // 5. TransactionInfo.TerminalID
    localDateTime +                // 6. TransactionInfo.LocalDateTime
    senderAccountID +              // 7. SenderData.AccountID
    amount +                          // 8. SenderData.Amount
    beneficiaryInstId +                             // 9. BeneficiaryData.InstID
    beneficiaryAccountId +                       // 10. BeneficiaryData.AccountID
    amount +                          // 11. BeneficiaryData.Amount
    custRefNumber +                      // 12. BeneficiaryData.CustRefNumber
    countryCode;                   // 13. TransactionInfo.CountryCode

  // 🔐 Generate EMSA-PKCS1-v1_5 signature with MD5 manually
  const md5 = crypto.createHash('md5').update(signatureData, 'utf8').digest();

  // DigestInfo untuk MD5 (DER encoding)
  const digestInfoPrefix = Buffer.from([0x30, 0x20,       // SEQUENCE, length 32
    0x30, 0x0C,       // SEQUENCE, length 12
    0x06, 0x08,       // OID, length 8
    0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x02, 0x05, // 1.2.840.113549.2.5 (MD5)
    0x05, 0x00,       // NULL
    0x04, 0x10        // OCTET STRING, length 16
  ]);

  const digestInfo = Buffer.concat([digestInfoPrefix, md5]); // 18 + 16 = 34 bytes

  // Generate PS = 0xFF repeated, total 128 bytes
  const keySize = 256; // 2048-bit key = 256 bytes
  const psLength = keySize - digestInfo.length - 3;
  const ps = Buffer.alloc(psLength, 0xFF);

  const em = Buffer.concat([
    Buffer.from([0x00, 0x01]),
    ps,
    Buffer.from([0x00]),
    digestInfo
  ]);

  // 🔏 Sign the EM (Encrypted Message) with RSA Private Key
  const privateKey = fs.readFileSync('./app/helper/private.key', 'utf8');
  const encrypted = crypto.privateEncrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_NO_PADDING,
    },
    em
  );

  const signature = encrypted.toString('hex');
  // console.log('✅ Signature:', signature);

  // const certPem = fs.readFileSync('./app/helper/certificate.crt', 'utf8');

  // // 2. Extract public key dari certificate
  // const publicKey = crypto.createPublicKey(certPem);

  // // 3. Baca signature dari hex → Buffer
  // const signatureHex = signature; // ← masukkan signature hex di sini
  // const signatureBuf = Buffer.from(signatureHex, 'hex');

  // // 4. Decrypt signature (NO_PADDING sesuai EMSA-PKCS1-v1_5)
  // const decrypted = crypto.publicDecrypt(
  //   {
  //     key: publicKey,
  //     padding: crypto.constants.RSA_NO_PADDING,
  //   },
  //   signatureBuf
  // );

  // // 5. Lihat hasil dekripsi
  // console.log('🔓 Decrypted EM:', decrypted.toString('hex'));

  const xml = `<?xml version="1.0"?>
<MethodCall>
  <MethodID>
    <Name>Inquiry.Artajasa.ATMBTransfer</Name>
  </MethodID>
  <TransactionID>
    <STAN>${stan}</STAN>
    <TransDateTime>${transDateTime}</TransDateTime>
    <InstID>${institusiID}</InstID>
  </TransactionID>
  <TransactionInfo>
    <ProcCode>${procCode}</ProcCode>
    <ChannelType>${channelType}</ChannelType>
    <RefNumber>${refNumberInquiry}</RefNumber>
    <TerminalID>${terminalID}</TerminalID>
    <CountryCode>${countryCode}</CountryCode>
    <LocalDateTime>${localDateTime}</LocalDateTime>
  </TransactionInfo>
  <SenderData>
    <AccountID>${senderAccountID}</AccountID>
    <Name>${senderNameFull}</Name>
    <CurrCode>${currency}</CurrCode>
    <Amount>${amount}</Amount>
    <Rate>${rate}</Rate>
    <AreaCode>${areaCode}</AreaCode>
  </SenderData>
  <BeneficiaryData>
    <InstID>${beneficiaryInstId}</InstID>
    <AccountID>${beneficiaryAccountId}</AccountID>
    <CurrCode>${currency}</CurrCode>
    <Amount>${amount}</Amount>
    <CustRefNumber>${custRefNumber}</CustRefNumber>
    <RegencyCode>${regencyCode}</RegencyCode>
    <PurposeCode>${purposeCode}</PurposeCode>
    <PurposeDesc>${purposeDesc}</PurposeDesc>
  </BeneficiaryData>
  <Signature>
    <Data>${signature}</Data>
  </Signature>
</MethodCall>`;

  const parseXml = (xml) =>
    new Promise((resolve, reject) => {
      xml2js.parseString(xml, { explicitArray: false }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });

  try {
    const response = await axios.post(
      'https://certapi2.artajasa.co.id:9443/Disburssecure/Disbursement/servlet/DisburseZIS',
      xml,
      {
        headers: {
          "Content-Type": "application/xml",
          "User-Agent": "Mozilla/5.0"
        }
      }
    );

    const jsonResult = await parseXml(response.data);
    console.log('Response INQUIRY from Artajasa:', JSON.stringify(jsonResult, null, 2));

    const errorCode = jsonResult?.MethodResponse.Response.Code
    const errorDesc = jsonResult?.MethodResponse.Response.Description
    if (errorCode != '00') {
      return {
        success: false,
        type: 'inquiry',
        errorCode: errorCode,
        errorDesc: errorDesc,
        data: jsonResult
      };
    }

    const nama_rek = jsonResult?.MethodResponse.BeneficiaryData.Name.trim()
    if (nama_rekening !== nama_rek) {
      throw new Error('Gagal memverifikasi akun bank, pastikan nomor rekening dan nama pemilik sesuai')
    }

    const cert = fs.readFileSync('./app/helper/certificate-aj.crt', 'utf8');
    const publicKey = crypto.createPublicKey(cert);

    // 2. Ambil signature dari response XML
    const signatureHex = jsonResult?.MethodResponse?.Signature?.Data;
    if (!signatureHex) {
      throw new Error('Signature tidak ditemukan dalam response');
    }

    const signatureBuffer = Buffer.from(signatureHex, 'hex');

    // 3. Dekripsi signature dengan RSA public key (tanpa padding)
    const decrypted = crypto.publicDecrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_NO_PADDING,
      },
      signatureBuffer
    );

    // 4. Ambil hash dari decrypted data
    const decryptedDigestInfo = decrypted.slice(-16); // MD5 hash selalu 16 byte
    const expectedHash = decryptedDigestInfo.toString('hex');

    // 5. Hitung hash dari data response yang seharusnya disign
    // ⚠️ Anda perlu menyusun ulang `signatureData` dari elemen-elemen response
    const d = jsonResult?.MethodResponse;
    const reconstructedData =
      d.TransactionID.STAN +
      d.TransactionID.TransDateTime +
      d.TransactionID.InstID +
      d.TransactionID.TokenID +
      d.SenderData.AccountID +
      d.SenderData.Amount +
      d.BeneficiaryData.InstID +
      d.BeneficiaryData.AccountID +
      d.BeneficiaryData.Amount +
      d.BeneficiaryData.CustRefNumber +
      d.BeneficiaryData.Name +
      d.Response.Code;

    const actualHash = crypto.createHash('md5').update(reconstructedData, 'utf8').digest('hex');

    // 6. Bandingkan H1 dan H2
    if (expectedHash === actualHash) {
      console.log('✅ Signature INQUIRY dari Artajasa VALID');

      const procCodeFinal = "400000";
      const newDate = new Date();
      const newTransDateTime =
        newDate.getUTCFullYear().toString() +
        pad(newDate.getUTCMonth() + 1) +
        pad(newDate.getUTCDate()) +
        pad(newDate.getUTCHours()) +
        pad(newDate.getUTCMinutes()) +
        pad(newDate.getUTCSeconds());

      const newLocalDateTime = moment(newDate).format("YYYYMMDDHHmmss");

      const tokenID = d.TransactionID.TokenID;
      const beneficiaryName = d.BeneficiaryData.Name;

      if (!tokenID) {
        throw new Error("TokenID tidak ditemukan dalam response inquiry");
      } else if (!beneficiaryName) {
        throw new Error("Nama Penerima tidak ditemukan dalam response inquiry");
      }

      const signatureDataFinal =
        stan +                        // 1. TransactionID.STAN
        newTransDateTime +                // 2. TransactionID.TransDateTime
        institusiID +                  // 3. TransactionID.InstID
        tokenID +
        refNumberTransfer +                    // 4. TransactionInfo.RefNumber
        terminalID +                   // 5. TransactionInfo.TerminalID
        newLocalDateTime +                // 6. TransactionInfo.LocalDateTime
        senderAccountID +              // 7. SenderData.AccountID
        amount +                          // 8. SenderData.Amount
        beneficiaryInstId +                             // 9. BeneficiaryData.InstID
        beneficiaryAccountId +                       // 10. BeneficiaryData.AccountID
        amount +                          // 11. BeneficiaryData.Amount
        custRefNumber +                      // 12. BeneficiaryData.CustRefNumber
        countryCode;                   // 13. TransactionInfo.CountryCode

      // 🔐 Generate EMSA-PKCS1-v1_5 signature with MD5 manually
      const md5 = crypto.createHash('md5').update(signatureDataFinal, 'utf8').digest();

      // DigestInfo untuk MD5 (DER encoding)
      const digestInfoPrefix = Buffer.from([0x30, 0x20,       // SEQUENCE, length 32
        0x30, 0x0C,       // SEQUENCE, length 12
        0x06, 0x08,       // OID, length 8
        0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x02, 0x05, // 1.2.840.113549.2.5 (MD5)
        0x05, 0x00,       // NULL
        0x04, 0x10        // OCTET STRING, length 16
      ]);

      const digestInfo = Buffer.concat([digestInfoPrefix, md5]); // 18 + 16 = 34 bytes

      // Generate PS = 0xFF repeated, total 128 bytes
      const keySize = 256; // 2048-bit key = 256 bytes
      const psLength = keySize - digestInfo.length - 3;
      const ps = Buffer.alloc(psLength, 0xFF);

      const em = Buffer.concat([
        Buffer.from([0x00, 0x01]),
        ps,
        Buffer.from([0x00]),
        digestInfo
      ]);

      const privateKey = fs.readFileSync('./app/helper/private.key', 'utf8');
      const encrypted = crypto.privateEncrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_NO_PADDING,
        },
        em
      );

      const finalSignature = encrypted.toString('hex');

      // Inject TokenID ke xmlTransfer
      const xmlTransferFinal = `<?xml version="1.0"?>
<MethodCall>
  <MethodID>
    <Name>Transfer.Artajasa.ATMBTransfer</Name>
  </MethodID>
  <TransactionID>
    <STAN>${stan}</STAN>
    <TransDateTime>${newTransDateTime}</TransDateTime>
    <InstID>${institusiID}</InstID>
    <TokenID>${tokenID}</TokenID>
  </TransactionID>
  <TransactionInfo>
    <ProcCode>${procCodeFinal}</ProcCode>
    <ChannelType>${channelType}</ChannelType>
    <RefNumber>${refNumberTransfer}</RefNumber>
    <TerminalID>${terminalID}</TerminalID>
    <CountryCode>${countryCode}</CountryCode>
    <LocalDateTime>${newLocalDateTime}</LocalDateTime>
  </TransactionInfo>
  <SenderData>
    <AccountID>${senderAccountID}</AccountID>
    <Name>${senderNameFull}</Name>
    <CurrCode>${currency}</CurrCode>
    <Amount>${amount}</Amount>
    <Rate>${rate}</Rate>
    <AreaCode>${areaCode}</AreaCode>
  </SenderData>
  <BeneficiaryData>
    <InstID>${beneficiaryInstId}</InstID>
    <AccountID>${beneficiaryAccountId}</AccountID>
    <CurrCode>${currency}</CurrCode>
    <Amount>${amount}</Amount>
    <CustRefNumber>${custRefNumber}</CustRefNumber>
    <Name>${beneficiaryName}</Name>
    <RegencyCode>${regencyCode}</RegencyCode>
    <PurposeCode>${purposeCode}</PurposeCode>
    <PurposeDesc>${purposeDesc}</PurposeDesc>
  </BeneficiaryData>
  <Signature>
    <Data>${finalSignature}</Data>
  </Signature>
</MethodCall>`;

      // 🔁 Lakukan POST Transfer
      const transferResponse = await axios.post(
        'https://certapi2.artajasa.co.id:9443/Disburssecure/Disbursement/servlet/DisburseZIS',
        xmlTransferFinal,
        {
          headers: {
            "Content-Type": "application/xml",
            "User-Agent": "Mozilla/5.0"
          }
        }
      );

      const transferResult = await parseXml(transferResponse.data);
      console.log('Response TRANSFER dari Artajasa:', JSON.stringify(transferResult, null, 2));

      const errorCodeFinal = transferResult?.MethodResponse.Response.Code
      const errorDescFinal = transferResult?.MethodResponse.Response.Description
      if (errorCodeFinal !== '00') {
        return {
          success: false,
          type: 'transfer',
          errorCode: errorCodeFinal,
          errorDesc: errorDescFinal,
          data: transferResult
        };
      }


      // 2. Ambil signature dari response XML
      const signatureHexFinal = transferResult?.MethodResponse?.Signature?.Data;
      if (!signatureHexFinal) {
        throw new Error('Signature tidak ditemukan dalam response');
      }

      const signatureBufferFinal = Buffer.from(signatureHexFinal, 'hex');

      // 3. Dekripsi signature dengan RSA public key (tanpa padding)
      const decryptedFinal = crypto.publicDecrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_NO_PADDING,
        },
        signatureBufferFinal
      );

      // 4. Ambil hash dari decrypted data
      const decryptedDigestInfoFinal = decryptedFinal.slice(-16); // MD5 hash selalu 16 byte
      const expectedHashFinal = decryptedDigestInfoFinal.toString('hex');

      // 5. Hitung hash dari data response yang seharusnya disign
      // ⚠️ Anda perlu menyusun ulang `signatureData` dari elemen-elemen response
      const dFinal = transferResult?.MethodResponse;
      const reconstructedDataFinal =
        dFinal.TransactionID.STAN +
        dFinal.TransactionID.TransDateTime +
        dFinal.TransactionID.InstID +
        dFinal.TransactionID.TokenID +
        dFinal.SenderData.AccountID +
        dFinal.SenderData.Amount +
        dFinal.BeneficiaryData.InstID +
        dFinal.BeneficiaryData.AccountID +
        dFinal.BeneficiaryData.Amount +
        dFinal.BeneficiaryData.CustRefNumber +
        dFinal.Response.Code;

      const actualHashFinal = crypto.createHash('md5').update(reconstructedDataFinal, 'utf8').digest('hex');

      if (expectedHashFinal === actualHashFinal) {
        console.log('✅ Signature TRANSFER dari Artajasa VALID');
        return {
          success: true,
          message: "Inquiry dan transfer berhasil",
          signature: '✅ALL Signature Valid',
          data: {
            inquiry: jsonResult,
            transfer: transferResult,
          }
        };
      } else {
        console.error('❌ Signature TRANSFER dari Artajasa TIDAK VALID');
        throw new Error('Signature TRANSFER validation failed!');
      }
    } else {
      console.error('❌ Signature INQUIRY dari Artajasa TIDAK VALID');
      throw new Error('Signature INQUIRY validation failed!');
    }

  } catch (error) {
    if (error.response) {
      const contentType = error.response.headers['content-type'];
      if (contentType?.includes('application/xml')) {
        try {
          const errorJson = await parseXml(error.response.data);
          return {
            success: false,
            message: 'Artajasa error',
            error: errorJson?.MethodResponse?.Response.Description,
          };
        } catch (parseError) {
          return {
            success: false,
            message: 'Failed to parse server XML error',
          };
        }
      } else {
        return {
          success: false,
          message: error.response.data || error.message,
        };
      }
    } else {
      return {
        success: false,
        message: "Request error",
        error: error.message,
      };
    }
  }
}

module.exports = {
  StatusAJ,
  BalanceAJ,
  InquiryAJ,
  TransferAJ,
  TransferInquiryAJ
};
