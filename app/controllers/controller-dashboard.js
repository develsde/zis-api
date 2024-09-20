const { prisma } = require("../../prisma/client");
const fs = require("fs/promises");

const { customAlphabet } = require("nanoid");
const { z, date } = require("zod");
const { checkImkas } = require("../helper/imkas");
const { equal } = require("assert");

const numberWithCommas = (num) => {
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

module.exports = {
  
  async checkTotalMustahiq(req, res) {
    try {      
      const totalMustahiq = await prisma.user.count({
        where: {
          NOT:{
            mustahiq_id: null
          }          
        },
      });
      if (!totalMustahiq) {
        return res.status(404).json({
          message: "Ambil Total Mustahiq Gagal Dilakukan",
        });
      }
      let arrIdProposal = []
      let arrIdProposalPrev = []
      let arrIdMitra = []
      let arrIdMitraPrev = []
      let arrId = []
      let arrIdPrev = []
      let arrCurrentId = []      
      const dates = new Date();
      const datesPrev = new Date();
      const bulan = dates.getMonth()+1;
      const bulanprev = datesPrev.getMonth();
      const tahun = dates.getFullYear();
      const namaBulan = dates.toLocaleString('default', { month: 'long' });
      const getAllProposal  = 
        await prisma.$queryRaw`select p.id as id, count(p.id) as jumlah
                                from proposal p 
                                join user u on u.user_id = p.user_id 
                                where u.mustahiq_id is not null and  
                                YEAR(p.create_date) = ${tahun} and
                                 MONTH(p.create_date) = ${bulan} GROUP by p.id;`
      const getAllProposalPrev  = 
        await prisma.$queryRaw`select p.id as id, count(p.id) as jumlah
                                from proposal p 
                                join user u on u.user_id = p.user_id 
                                where  u.mustahiq_id is not null and  
                                YEAR(p.create_date) = ${tahun} and
                                 MONTH(p.create_date) = ${bulanprev} GROUP by p.id;`   
                                 
      const getCurrentId  = 
      await prisma.$queryRaw`select p.id as id
                              from proposal p 
                              join user u on u.user_id = p.user_id 
                              where p.approved  = 1  and
                              u.mustahiq_id is not null and  
                              YEAR(p.create_date) = ${tahun} and
                              MONTH(p.create_date) = ${bulan} GROUP by p.id;`                           

      const getAllId  = 
      await prisma.$queryRaw`select p.id as id
                              from proposal p 
                              join user u on u.user_id = p.user_id 
                              where p.approved  = 1  and
                              u.mustahiq_id is not null and  
                              YEAR(p.create_date) = ${tahun} GROUP by p.id;`
    const getAllIdPrev  = 
      await prisma.$queryRaw`select p.id as id
                              from proposal p 
                              join user u on u.user_id = p.user_id 
                              where p.approved  = 1  and
                              u.mustahiq_id is not null and  
                              YEAR(p.create_date) = ${tahun} and
                              MONTH(p.create_date) = ${bulanprev} GROUP by p.id;`      
      
        getAllProposal.map(item => {
          //console.log("QUERY FETCH",item);          
          arrIdProposal.push(item.id)
        })

        getAllProposalPrev.map(item => {
          //console.log("QUERY FETCH",item);          
          arrIdProposalPrev.push(item.id)
        })

        getAllId.map(item => {
          //console.log("QUERY FETCH",item);          
          arrId.push(item.id)
        })

        getCurrentId.map(item => {
          //console.log("QUERY FETCH",item);          
          arrCurrentId.push(item.id)
        })        

        getAllIdPrev.map(item => {
          //console.log("QUERY FETCH",item);          
          arrIdPrev.push(item.id)
        })

        //get data muzaki
        const totalMuzaki = await prisma.user.count({
          where: {
            user_type: {
                equals: 11
            }
          },
        });
        if (!totalMuzaki) {
          return res.status(404).json({
            message: "Ambil Total MUZAKI Gagal Dilakukan",
          });
        }

        //ambil data muwakif
        const totalMuwakif = await prisma.user.count({
          where: {
            user_type: {
                equals: 15
            }
          },
        });
        if (!totalMuwakif) {
          return res.status(404).json({
            message: "Ambil Total Muwakif Gagal Dilakukan",
          });
        }
        

        //jumlah proposal mitra
        const getAllMitraProp  = 
        await prisma.$queryRaw`select p.id as id, count(p.id) as jumlah
                                from mitra p 
                                join user u on u.user_id = p.mitra_user_id 
                                where u.mustahiq_id is not null and  
                                YEAR(p.created_date) = ${tahun} and
                                 MONTH(p.created_date) = ${bulan} GROUP by p.id;`
      const getAllMitraPrev  = 
        await prisma.$queryRaw`select p.id as id, count(p.id) as jumlah
                                from mitra p 
                                join user u on u.user_id = p.mitra_user_id 
                                where  u.mustahiq_id is not null and  
                                YEAR(p.created_date) = ${tahun} and
                                 MONTH(p.created_date) = ${bulanprev} GROUP by p.id;`   


          getAllMitraProp.map(item => {
            //console.log("QUERY FETCH",item);          
            arrIdMitra.push(item.id)
          })

          getAllMitraPrev.map(item => {
            //console.log("QUERY FETCH",item);          
            arrIdMitraPrev.push(item.id)
          })                           


      const totalProposalPenyaluran = await prisma.proposal.findMany({                  
          where:{
            id: { in: arrIdProposal }                                    
          },      
      });  
      
      
        if (!totalProposalPenyaluran) {
        return res.status(404).json({
          message: "Ambil Total Proposal Gagal Dilakukan"          
        });
      }      

      const totalProposalPenyaluranPrev = await prisma.proposal.findMany({                  
        where:{
          id: { in: arrIdProposalPrev }                                         
        },      
      });          
      if (!totalProposalPenyaluranPrev) {
        return res.status(404).json({
          message: "Ambil Total Proposal Gagal Dilakukan"          
        });
      }      
      
      ////WAKAF - MITRA
      const totalMitraPenyaluran = await prisma.mitra.findMany({                  
          where:{
            id: { in: arrIdMitra }                                    
          },      
      });  
      
      
        if (!totalMitraPenyaluran) {
        return res.status(404).json({
          message: "Ambil Total Mitra Gagal Dilakukan"          
        });
      }      

      const totalMitraPenyaluranPrev = await prisma.mitra.findMany({                  
        where:{
          id: { in: arrIdMitraPrev }                                         
        },      
      });          
      if (!totalMitraPenyaluranPrev) {
        return res.status(404).json({
          message: "Ambil Total Mitra Prev Gagal Dilakukan"          
        });
      }  

      ////END OF WAKAF - MITRA

      const totalNominalPenyaluran = await prisma.proposal.aggregate({            
        _sum:{
            dana_approval: true
        },     
        where:{
          id: { in: arrId }                                         
        },      
      });
        if (!totalNominalPenyaluran) {
          return res.status(404).json({
            message: "Ambil Total Penyaluran Gagal Dilakukan",
        });
      }

      const totalNominalPenyaluranBulanIni = await prisma.proposal.aggregate({            
        _sum:{
            dana_approval: true
        },     
        where:{
          id: { in: arrCurrentId }                                
        },      
      });
        if (!totalNominalPenyaluranBulanIni) {
          return res.status(404).json({
            message: "Ambil Total Penyaluran Bulan Ini Gagal Dilakukan",
        });
      }  

    const totalNominalPenyaluranPrev = await prisma.proposal.aggregate({            
        _sum:{
            dana_approval: true
        },     
        where:{
          id: { in: arrIdPrev }                                
        },      
    });
    if (!totalNominalPenyaluranPrev) {
      return res.status(404).json({
        message: "Ambil Total Penyaluran Gagal Dilakukan",
      });
    }
          

      return res.status(200).json({
        message: "Sukses",
        data: [{
          icon: "bx bxs-user-rectangle",
          title: "MUSTAHIQ TERDAFTAR",
          value: Number(totalMustahiq)+" Orang",
          badgeValue: "Dari Portal",
          color: "success",
          desc: "Bulan "+namaBulan,
        },
        {
          icon: "bx bx-purchase-tag-alt",
          title: "TOTAL PROPOSAL ZIS",
          value: numberWithCommas(String(totalProposalPenyaluran.length))+ " Proposal",
          badgeValue: (Number(totalProposalPenyaluran.length)/Number(totalProposalPenyaluranPrev.length)).toFixed(2) + "%",
          color: "warning",
          desc: "Bulan "+namaBulan,
        },
        {
          icon: "bx bx-purchase-tag-alt",
          title: "TOTAL PENYALURAN ZIS",
          value: "Rp."+ numberWithCommas(String(totalNominalPenyaluran._sum.dana_approval)),          
          badgeValue: "Tahun 2024 Hingga Bulan "+namaBulan,
          color: "warning",
          desc: "",
        },
        {
          icon: "bx bxs-user-rectangle",
          title: "MUZAKI TERDAFTAR",
          value: Number(totalMuzaki)+" Orang",       
          badgeValue: "Dari Portal",
          color: "success",
          desc: "Bulan "+namaBulan,
        },{
          icon: "bx bxs-user-rectangle",
          title: "MUWAKIF TERDAFTAR",
          value: Number(totalMuwakif)+" Orang",       
          badgeValue: "Dari Portal",
          color: "success",
          desc: "Bulan "+namaBulan,
        },{
          icon: "bx bx-purchase-tag-alt",
          title: "TOTAL MITRA WAKAF",
          value: numberWithCommas(String(totalMitraPenyaluran.length))+ " Proposal",
          badgeValue: (Number(totalMitraPenyaluran.length)/Number(totalMitraPenyaluranPrev.length)).toFixed(2) + "%",
          color: "warning",
          desc: "Bulan "+namaBulan,
        }],       
        dataPenyaluran: "Rp."+ numberWithCommas(String(totalNominalPenyaluranBulanIni._sum.dana_approval)),
        dataBulanLalu: (Number(totalNominalPenyaluranBulanIni._sum.dana_approval)/Number(totalNominalPenyaluranPrev._sum.dana_approval)).toFixed(2) + "%",
        //dataBulanLalu: 0
      });
    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  async graphPenyaluran(req, res) {
    try {      

      let arrIsApproved = []
      let arrIsPaid = []
      let arrAllPenyaluran = []

      const getPenyaluranIsApproved  = 
      await prisma.$queryRaw`select SUM(p.dana_approval) as dana_approval 
                        from proposal p join user u on u.user_id = p.user_id 
                        where p.approved = 1 and u.mustahiq_id is not null group by MONTH(p.create_date)`

      getPenyaluranIsApproved.map(item => {        
        arrIsApproved.push(Number(item.dana_approval))
      })     
      
      const getPenyaluranIspaid  = 
      await prisma.$queryRaw`select SUM(p.dana_approval) as dana_approval 
                        from proposal p join user u on u.user_id = p.user_id 
                        where p.ispaid = 1 and u.mustahiq_id is not null group by MONTH(p.create_date)`

      getPenyaluranIspaid.map(item => {        
        arrIsPaid.push(Number(item.dana_approval))
      })   

      const getAllPenyaluran  = 
      await prisma.$queryRaw`select (Case when SUM(p.dana_yang_diajukan) is null then 0 else SUM(p.dana_yang_diajukan) end) as dana_approval 
                              from proposal p group by MONTH(p.create_date)`

      getAllPenyaluran.map(item => {        
        arrAllPenyaluran.push(Number(item.dana_approval))
      })              

    
      return res.status(200).json({
        message: "Sukses",
        data: [{
                    name: "Total Pengajuan",
                    data: arrAllPenyaluran          
              },{
                    name: "Yang Disetujui",  
                    data: arrIsApproved,
              },{
                    name: "Telah Disalurkan",  
                    data: arrIsPaid,
              }]
      })

    } catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },


  async graphPerprogram(req, res) {
    try {      

      const arrValue = [];
      const arrProgramName = [];
      const arrGabungan = [];

      const getPenyaluranIspaid  = 
      await prisma.$queryRaw`select COUNT(id) as jumlah, p.program_title as title
                            FROM proposal pr LEFT JOIN program p on p.program_id = pr.program_id 
                            GROUP BY pr.program_id
                            ORDER BY jumlah DESC LIMIT 10`

      getPenyaluranIspaid.map(item => {        
        arrProgramName.push(item.title)
        arrValue.push(Number(item.jumlah))
        arrGabungan.push({"namaprogram": item.title, "total": Number(item.jumlah)});
      })   

      return res.status(200).json({
        message: "Sukses",
        data: {
                dataNamaProgram: arrProgramName,
                dataValue: arrValue,
                dataGabungan:arrGabungan
              }
      })

    }catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },

  async dataRekapReferentor(req, res) {
    try {      

      const arrValue = [];
      const arrName = [];
     
      const getAllRef  = 
      await prisma.$queryRaw`select count(p.id) as jml, p.nama_pemberi_rekomendasi as name, "Referentor Indosat" as description
      from proposal p 
      join user u on u.user_id = p.user_id 
      where p.nama_pemberi_rekomendasi is not NULL and 
      u.user_type = 10 and 
      u.mustahiq_id is not NULL group by p.nama_pemberi_rekomendasi ORDER BY jml DESC LIMIT 5`

      getAllRef.map(item => {                
        //arrValue.push({"name": item.name, "desc": item.description, "value": Number(item.jml)});
        arrName.push(item.name);
        arrValue.push(Number(item.jml));
      })   

      return res.status(200).json({
        message: "Sukses",
        data: {                
                dataAllReferentor: arrName,
                dataValue: arrValue
        }
      })

    }catch (error) {
      return res.status(500).json({
        message: error?.message,
      });
    }
  },
  
}