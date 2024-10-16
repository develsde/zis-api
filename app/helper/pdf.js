// import {nextApiRequest, nextApiResponse} from 'next';
// import PDFDocument from 'pdfkit';
// import QRCode from 'qrcode';

// export default async function handler(req,res){
//     const{order_number, ticket_details} = req.body;

//     //membuat dokumen pdf
//     const doc = new PDFDocument();
//     let buffers = [];

//     doc.on('data', buffer.push.bind(buffers));
//     doc.on('end', () => {
// let pdfData = Buffer.concat(buffers);
// res.setHeader('Content-Type', 'application/pdf');
// res.setHeader('Content-Disposition', 'attachment: filename-ticket.pdf');
// res.send(pdfData);
//     });

//     doc.text(`Order Number: ${order_number}`);
//     doc.text(`Ticket Detail: ${ticket_details}`);

//     //generate qrcode
//     const QRCode = await QRCode.toDataURL(order_number);
//     doc.image(qrcode,{
//         fit: [100,100],
//         align: 'center',
//         valign: 'center'
//     })
// }