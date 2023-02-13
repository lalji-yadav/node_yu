const fs = require('fs');
const passport = require('passport');
const sendMail = require('../middleware/sendMail');
const jwt = require('jsonwebtoken');
const config = require('../config/config.json');
const Joi = require('@hapi/joi');
const nodemailer = require('nodemailer');
var bodyParser = require('body-parser');
var path = require('path');
const bcrypt = require('bcryptjs');
const { func } = require('@hapi/joi');
const mongoose = require('mongoose');
let log4js = require('log4js');
let log = log4js.getLogger("ADMIN CONTROLLER");
let clients = require('../models/Client');
let admin = require('../models/Superadmin');
let logs = require('../models/Logs')
const { resourceLimits } = require('worker_threads');
let db = require('../models/all-models');
const { getMaxListeners } = require('process');
const randomstring = require("randomstring");
var CronJob = require('cron').CronJob;
const axios = require('axios');

module.exports = {
    /*Dashboard API*/
    adminLogin: adminLogin,
    // getAdminProfile: getAdminProfile,
    forgotPassword: forgotPassword,
    resetPassword: resetPassword,

    /*Dashboard API*/
    getClientBulkyDataAndStore: getClientBulkyDataAndStore,
    getClientDataById: getClientDataById,
    updateClientList: updateClientList,
     
    getChannelPartnerList: getChannelPartnerList,
    getChannelPartnerListbyid: getChannelPartnerListbyid,
    updateChannelPartnerList: updateChannelPartnerList,

    getliveBot: getliveBot,
    getliveBotbyid: getliveBotbyid,
    updateliveBot: updateliveBot,

    getAllRegistration: getAllRegistration,
   // getTotalConversationandVisitor: getTotalConversationandVisitor,
    botStatus: botStatus,
    getClientListData:getClientListData,
    getLiveActiveBots : getLiveActiveBots,
    getLiveActiveBotsList : getLiveActiveBotsList,
    createPlan: createPlan,
    getPlan: getPlan,
    deletePlan: deletePlan,
    unsubscribePlan: unsubscribePlan

}

// super admin 

async function adminLogin(req, res) {
  
  var user = await db.__.findOne({ email: req.body.email })
    .lean().exec();

  if (!user) {
    return res.status(200).json({
      status: "failed",
      message: "Invalid username or password.",
    });
  } else {
    let checkPassword = await bcrypt.compareSync(
      req.body.password,
      user.password
    );

   // console.log('user checkPassword', checkPassword);

    if (!checkPassword) {
      return res.status(200).json({
        status: "failed",
        message: "Invalid username or password.",
      });
    } else {
      let authToken = await jwt.sign(
        { email: user.email, id: user._id },
        "YuboSecretKey"
      );
      user.authToken = authToken;
      //Update auth token at the login time in users collection.
      let updateData = await db.__.updateOne(
        { _id: user._id },
        { $set: { authToken: authToken } }
      )
        .lean()
        .exec();
      return res.status(200).json({
        status: "success",
        statusCode: 200,
        message: "User logged-In successfully.",
        data: user,
      });
    }
  }
}

async function forgotPassword(req, res) {
    //fetch the data from User collection by email key.
    const user = await db.__.findOne({ email: req.body.email })
    // console.log('user', user)
        if (!user) {
            let responseObj = {
                statusCode: 400,
                status: "fail",
                message: "Error while getting email id"
            }
            res.status(responseObj.statusCode).send(responseObj)
        } else if (user) {
            let pwd = randomstring.generate({
                length: 6,
                capitalization: 'lowercase',
                charset: 'alphanumeric'
            });
          
            res.render('resetPasswordTemplate', {
                loginEmail: req.body.email,
                loginPassword: pwd,
                user: user.name
            }, function(err, emailHTML) {
                sendMail.sendForgotPassMail(req.body.email, emailHTML);
            });
            //Update password in user collection .
            let updatePassword = await db.__.updateOne({ email: req.body.email }, { $set: { password: bcrypt.hashSync(pwd) } })
                if (!updatePassword) {
                    let responseObj = {
                        statusCode: 400,
                        status: 'fail',
                        message: "Error while reseting password"
                    }
                    res.status(responseObj.statusCode).send(responseObj)
                } else if (updatePassword) {
                    let responseObj = {
                        statusCode: 200,
                        status: 'success',
                        message: "Your request has been accepted. A new password has been sent on your registered email ID."
                    }
                    res.status(responseObj.statusCode).send(responseObj)
                } else {
                    let responseObj = {
                        statusCode: 404,
                        status: "fail",
                        message: "Your email doesnot match. Please try again"
                    }
                    res.status(responseObj.statusCode).send(responseObj)
                }
          

        } else {
            let responseObj = {
                statusCode: 404,
                status: "fail",
                message: "Your email doesnot match. Please try again"
            }
            res.status(responseObj.statusCode).send(responseObj)
        } 
}


async function resetPassword(req, res) {
    const user = await db.__.findOne({ _id: req.body.adminId })

        if (!user) {
            let responseObj = {
                statusCode: 400,
                status: "fail",
                message: "Error while getting email"
            }
            res.status(responseObj.statusCode).send(responseObj)
        } else if (user) {
            //password verify.
            const passwordIsValid = await bcrypt.compareSync(req.body.password, user.password);
            if (!passwordIsValid) {
                return res.status(200).json({
                    status: 'failed',
                    message: 'The existing password does not match with the password you have provided. Please type your correct existing password and try again.'
                });
            } else {
                //Update password in user collection .
                let updatePassword = await db.__.updateOne({ _id: req.body.adminId }, { $set: { password: bcrypt.hashSync(req.body.newPassword) } })
                    if (!updatePassword) {
                        let responseObj = {
                            statusCode: 400,
                            status: 'fail',
                            message: "Error while reseting password"
                        }
                        res.status(responseObj.statusCode).send(responseObj)
                    } else if (updatePassword) {
                        let responseObj = {
                            statusCode: 200,
                            status: 'success',
                            message: "Password changed successfully"
                        }
                        res.status(responseObj.statusCode).send(responseObj)
                    } else {
                        let responseObj = {
                            statusCode: 404,
                            status: "fail",
                            message: "Your email doesnot match. Please try again"
                        }
                        res.status(responseObj.statusCode).send(responseObj)
                    }   
            }
        } else {
            let responseObj = {
                statusCode: 404,
                status: "fail",
                message: "Your email doesnot match. Please try again"
            }
            res.status(responseObj.statusCode).send(responseObj)
        }

}

/*****************************All client list api*****************************************/

async function getClientBulkyDataAndStore() {
  try{
    let bulkDAta = await db.__.find();
    if(bulkDAta.length > 0){
     let deletedata =  await db._.remove({});
     console.log('all document deleted of clientBulkyInfo table...storing lates data in few minutes',deletedata);
    }
   
      let data = await db.__.aggregate([{
          $lookup: {
              from: "userchats",
              let: { objId: "$_id", clientId: "$clientId" },
              pipeline: [{
                  $match: {
                      $expr: {
                          $or: [
                              { $eq: ["$clientId", "$$objId"] },
                              { $eq: ["$clientId", "$$clientId"] }
                          ]
                      }
                  }
              }],
              as: "userdata",
          },
      },
      {
          $unwind: { path: "$userdata", preserveNullAndEmptyArrays: true },
      },
      //  { $match : { clientId : "btrack_chatbot" } },
      //  { $match : { partnerId : "CP0001" } },        
      {
          $project: {
              _id: 0,
              clientId: 1,
              name: 1,
              phone: 1,
              email: 1,
              isHumanAgentEnabled: 1,
              isCampaigningEnabled : 1,
              locales:1,
              contactPerson: 1,
              partnerId: 1,
              users: { $cond: { if: "$userdata.userId", then: 1, else: 0 } },
              leadcount: {
                  $cond: {
                      if: {
                          $or: [
                              "$userdata.session.email",
                              "$userdata.session.phone",
                              "$userdata.email",
                              "$userdata.phone",
                          ],
                      },
                      then: 1,
                      else: 0,
                  },
              },
              chatSize: {
                  $cond: {
                      if: "$userdata.chats",
                      then: { $size: "$userdata.chats" },
                      else: 0,
                  },
              },
          },
      },
      {
          $group: {
              _id: "$clientId",
              totalLeads: { $sum: "$leadcount" },
              totalUsers: { $sum: "$users" },
              totalConversation: { $sum: "$chatSize" },
              clientData: { $first: "$$ROOT" },
          },
      },
      {
          $lookup: {
              from: "logs", 
              localField: "_id",
              foreignField: "clientId",
              // pipeline: [ {
              //    $project: {
              //          url: 1,
              //         }
              //  } ],
              as: "clientLogs",
          },
      },
      {
          $lookup: {
              from: "superadminclients",
              localField: "_id",
              foreignField: "clientId",
              as: "clientInfo",
          }
      },
      {
          $project: {
              _id: 0,
              totalLeads: 1,
              totalUsers: 1,
              totalConversation: 1,
              clientData: 1,
              // clientLogs: 1,
              clientLogs: { $arrayElemAt: ["$clientLogs", 0] },
              clientdetails: { $arrayElemAt: ["$clientInfo", 0] },
          },
      }
      ])

    // .cursor().exec().toArray();

    let addData = await db._.insertMany(data);
    
    if (data.length > 0) {
      console.log('Data calculated and added to clientbulkydata db successfully')
      return data;
    } else {
      console.log('calculated data is an empty array')
      return data;
    }
  }catch(err){
    console.log('err 2222222222222222',err);
  }
  
}
async function getClientListData(req,res){
  let  data = await db._.find({});

      return res.status(200).json({
        statusCode: 200,
        status: "success",
        message: "Data found successfully.",
        data: data,
    });
}
async function getLiveActiveBots(req,res){
    let data = await db._.aggregate( [
      {
        $group: {
          _id: "$clientId",
          url: { "$first": "$url"},
          count:  {$sum : 1 } 
        }
      }
    ] )

    let finalData = data.filter(ele=>{
      if (ele.url && 
          ele.url.indexOf('helloyubo') == -1 && 
          ele.url.indexOf('localhost') == -1 && 
          ele.url.indexOf('192.46.209') == -1 &&
          ele.url.indexOf('127.0.0.1') == -1 )
        return ele ;
    })
    res.status(200).json({
        statusCode: 200,
        status: true,
        message: "Active live bot list ",
        activeLiveBots: finalData.length ,
        data : finalData
    }); 
}
async function getLiveActiveBotsList(req,res){
  try{
      let data = await db.__.aggregate([
        {
          $group: {
            _id: "$clientId",
            url: { "$first": "$url"},
            count:  {$sum : 1 } 
          }
        }
      ]);

      let finalData = await data.filter(ele=>{
        if (ele.url && 
            ele.url.indexOf('helloyubo') == -1 && 
            ele.url.indexOf('localhost') == -1 && 
            ele.url.indexOf('192.46.209') == -1 &&
            ele.url.indexOf('127.0.0.1') == -1 )
          return ele ;
      })

      let clientIdArray = await finalData.map(ele=>ele._id);

      let  liveChatbotData = await db._.find({'clientData.clientId' : { $in : clientIdArray }});
      
      res.status(200).json({
          statusCode: 200,
          status: true,
          message: "Data found successfully.",
          activeLiveBots: liveChatbotData.length ,
          data : liveChatbotData
      });
      
  }catch(err){
       console.log('err',err);
  }
    
}
async function getClientDataById(req, res) {
     try {
       const data = await db._.findOne({_id : req.body._id},{clientData:1,locales:1});
        if(!data) {
          res.status(404).send('Not found')
        }
        res.status(200).json({
                statusCode: 200,
                status: true,
                message: "Client list data fetched successfully",
                data : data
            }); 
    } catch (error) {  
        res.status(500).json({
            statusCode: 201,
            status: false,
            message: "Error on catch block",
            error : error
        });
    }

}

async function updateClientList(req, res) {
   
    try {
       let clientData = await db._.findOne({ _id : req.body.selected_id })

       const updateData = await db._.updateOne(
         {clientId : clientData.clientData.clientId }, 
         {
           $set  : {
            "clientId" : req.body.clientId,
            "name" : req.body.name,
            "phone" : req.body.phone,
            "email" : req.body.email,
           }
         })
          
       const updateData2 = await db._.updateOne(
          {"clientData.clientId" : clientData.clientData.clientId },
          {
            $set:{
                 "clientData.clientId" : req.body.clientId,
                 "clientData.name" : req.body.name,
                 "clientData.phone" : req.body.phone,
                 "clientData.email" : req.body.email
            }
          })

       if(!updateData && !updateData2) {
            return res.status(404).json({
            statusCode: 404,
            status: "failed",
            message: "Not found data",
        });
       }

        res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Update successfully.",
            data: updateData,
        });
    } catch (error) {
        res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "No data Updated.",
        });
    }

 }

/***************************** Channel partners list **************************************** */


async function getChannelPartnerList(req, res) {

     let channelPartner  = await db.__.aggregate([

        {
              $lookup:
                {
                    from: "clients",
                    localField: "partnerId",
                    foreignField: "partnerId",
                    as: "totalIns",
                }
          },
        {
            $project: {
                name: 1,
                email: 1,
                phone: 1,
                partnerId: 1,
                company: 1,
                createdAt: 1,
                updatedAt: 1,
                totalIns: 1,
            }
        }
    
      //   {
      //     $lookup: {
      //       from: "clients",
      //       localField: "partnerId",   
      //       foreignField: "partnerId",  
      //       as: "totalIns"
      //     }
      // },
      
      // {
      //     $lookup:
      //       {
      //         from: "clients",
      //         let: { clients_partnerId: "$partnerId", clients_phone: "$phone" },
      //         pipeline: [
      //             { $match:
      //               { $expr:
      //                   { $and:
      //                     [
      //                       { $eq: [ "$partnerId",  "$$clients_partnerId" ] },
      //                       { $eq: [ "$phone", "$$clients_phone" ] }
      //                     ]
      //                   }
      //               }
      //             },
      //             { $project: {partnerId: 1, name: 1, email: 1, phone: 1 } }
      //         ],
      //         as: "channelpartnersData"
      //       }
      //     },
      //     { $unwind: "$channelpartnersData" },
          
      //     {
      //         $project: {
      //             partnerId: 1,
      //             name: 1,
      //             email: 1,
      //             phone: 1,
      //             createdAt: 1,
      //             channelpartnersData: 1,
      //             totalIns: 1,
                  
      //             }
      //     }
        
      ])


    if (channelPartner.length > 0) {
        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Data found successfully.",
            data: channelPartner,
        });
    } else {
        return res.status(404).json({
            status: "failed",
            statusCode: 404,
            message: "No data found.",
        });
    }
    
}

async function getChannelPartnerListbyid(req, res) {

   let _id = { "_id": req.body._id }

  // console.log('getChannelPartnerListbyid id', _id, req.body)
     try {
        const data = await db.__.findById(_id)
        if(!data) {
          res.status(404).send('Not found')
        }
        res.status(200).json({
                statusCode: 200,
                status: true,
                message: "Channel Partner data fetched successfully",
                data : data
            }); 
    } catch (error) {
        res.status(500).json({
            statusCode: 201,
            status: false,
            message: "Error on catch block",
            error : error
        });
    }
    
    // try {
    //    const deleteData = await db.ChannelPartner.findByIdAndDelete(id)

    //     res.status(200).json({
    //         statusCode: 200,
    //         status: "success",
    //         message: "Deleted successfully.",
    //         data: deleteData,
    //     });
    // } catch (error) {
    //     res.status(500).json({
    //         statusCode: 500,
    //         status: "failed",
    //         message: "No data Deleted.",
    //     });
    // }

}

async function updateChannelPartnerList(req, res) {

    const id = req.body._id
   // console.log('update id', id)
    try {
       const updateData = await db.__.findByIdAndUpdate(id, req.body, { new: true })

       if(!updateData) {
            return res.status(404).json({
            statusCode: 404,
            status: "failed",
            message: "Not found data",
        });
       }

        res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Update successfully.",
            data: updateData,
        });
    } catch (error) {
        res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "No data Updated.",
        });
    }

}

async function getWhatsappTempById(req,res){
    try{
            let tempData = await db.__.findOne({
                _id : ObjectID(req.body.tempId) ,
                clientId : req.body.clientId 
            },
            {
                clientId:1,
                name:1,
                approved:1,
                text:1
            });
            
            return res.json({
                statusCode: 200,
                status: true,
                message: "Template data fetched successfully",
                data : tempData
            }); 
    }catch(err){
        return res.json({
            statusCode: 201,
            status: false,
            message: "Error on catch block",
            error : err
        });
    }
}

/***************************** All Client graphical data **************************************** */

// total registration 

async function getAllRegistration(req, res) {
   // console.log('data ')
    try {
        var userChats = await db.__.find({}, {"clientId":1, "_id":0}).count()

        let responseObj = {
            statusCode: 200,
            data: userChats,
            status:'success',
            message: 'Total registration find'
        }
        res.status(responseObj.statusCode).send(responseObj)
        
    } catch (error) {

        let responseObj = {
            statusCode: 400,
            status:'fail',
            message: 'Total registration not found'
        }
        res.status(responseObj.statusCode).send(responseObj)
    }

} 

// Inactive bot Status

async function botStatus(req, res) {

  let data = await db.__.aggregate([
    {
      $lookup: {
        from: "userchats",
        let: { objId: "$_id", clientId: "$clientId" },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ["$clientId", "$$objId"] },
                  { $eq: ["$clientId", "$$clientId"] },
                ],
              },
            },
          },
        ],
        as: "userdata",
      },
    },
    {
      $unwind: { path: "$userdata", preserveNullAndEmptyArrays: true },
    },
    {
      $project: {
        _id: 0,
        clientId: 1,
        name: 1,
        phone: 1,
        email: 1,
        botStatus: {
          $let: {
            vars: {
              diff: {
                $divide: [
                  { $subtract: [new Date(), "$userdata.date"] },
                  1000 * 60 * 60 * 24,
                ],
              },
            },
            in: {
              $switch: {
                branches: [
                  {
                    case: { $and: [{ $lte: ["$$diff", 15] }, "$$diff"] },
                    then: "Active",
                  },
                  {
                    case: { $and: [{ $gt: ["$$diff", 15] }, "$$diff"] },
                    then: "Inactive",
                  },
                ],
                default: "No states",
              },
            },
          },
          // in: {$multiply: ["$$diff", 1]}}
        },
        diff: {
          $divide: [
            { $subtract: [new Date(), "$userdata.date"] },
            1000 * 60 * 60 * 24,
          ],
        },
        // userData: "$userdata"
      },
    },
    {
      $group: {
        _id: "$clientId",
        clientDetails: { $last: "$$ROOT" },
      },
    },
  
    {
      $lookup: {
        from: "logs",
        localField: "_id",
        foreignField: "clientId",
        as: "clientLogs",
      },
    },{
      $lookup: {
        from: "superadminclients",
        localField: "_id",
        foreignField: "clientId",
        as: "clientInfo",
      }
    },
    {
      $project: {
        _id: 1,
        clientDetails: 1,
        clientLogs: { $arrayElemAt: ["$clientLogs", -1] },
        clientdetails: { $arrayElemAt: ["$clientInfo", 0] },
      },
    },
  ])
  // .cursor().exec().toArray();

    let inactivedata=[],activedata=[],nostatedata =[];
  for (i=0;i<data.length;i++) {
  if(data[i].clientDetails.botStatus =='Inactive'){
  inactivedata.push(data[i])
  } else if(data[i].clientDetails.botStatus =='Active') {
  activedata.push(data[i])
  } else{
  nostatedata.push(data[i])
  }
  }

  if(data.length>0){
    return res.status(200).json({
      status: "success",
      statusCode: 200,
      message: "Bot Data found successfully.",
      //data: data,
      actData: activedata.length,
      inActData: inactivedata.length,
      noActData: nostatedata.length,
    });
  } else{
    return res.status(200).json({
      status: "failed",
      message: "No Bot data found.",
      
    });
  }
  
}

//------------------- total live boat list-----------------------------------


async function getliveBot(req, res) {
    try{
      let data = await db.__.aggregate([
        {
          $group: {
            _id: "$clientId",
            url: { "$first": "$url"},
            count:  {$sum : 1 } 
          }
        }
      ]);

      let finalData = await data.filter(ele=>{
        if (ele.url && 
            ele.url.indexOf('helloyubo') == -1 && 
            ele.url.indexOf('localhost') == -1 && 
            ele.url.indexOf('192.46.209') == -1 &&
            ele.url.indexOf('127.0.0.1') == -1 )
          return ele ;
      })

      let clientIdArray = await finalData.map(ele=>ele._id);
      console.log('clientIdArray ',clientIdArray);

      // let  liveChatbotData = await db.clientBulkyInfo.find({'clientData.clientId' : { $in : clientIdArray }});
      var date = new Date();
      date.setDate(date.getDate() - 15);

      console.log('123========================== date',date);
       // let data2 = await db.Userchat.aggregate([
       //  { 
       //    $match: {
       //         $and: [ 
       //             {clientId: {$in: clientIdArray }}
       //         ]
       //    }
       //  },{
       //    "$group": {
       //      "_id": "$clientId",
       //      "data": {
       //        "$push": "$$ROOT"
       //      }
       //    }
       //  }, {
       //    "$unwind": "$data"
       //  }
       // ])
       // console.log('data2',data2);
       
      return res.status(200).json({
      status: "success",
      statusCode: 200,
      message: "Bot Data found successfully.",
      data: {},
      // actData: activedata,
     // inActData: inactivedata,
     // noActData: nostatedata,
    });
      // res.status(200).json({
      //     statusCode: 200,
      //     status: true,
      //     message: "Data found successfully.",
      //     activeLiveBots: liveChatbotData.length ,
      //     data : liveChatbotData
      // });
      
      // let data2 = await db.Client.aggregate([
      //   {
      //     $lookup: {
      //       from: "userchats",
      //       let: { objId: "$_id", clientId: "$clientId" },
      //       pipeline: [
      //         {
      //           $match: {
      //             $expr: {
      //               $or: [
      //                 { $eq: ["$clientId", "$$objId"] },
      //                 { $eq: ["$clientId", "$$clientId"] },
      //               ],
      //             },
      //           },
      //         },
      //       ],
      //       as: "userdata",
      //     },
      //   },
      //   {
      //     $unwind: { path: "$userdata", preserveNullAndEmptyArrays: true },
      //   },
      //   {
      //     $project: {
      //       _id: 0,
      //       clientId: 1,
      //       name: 1,
      //       phone: 1,
      //       email: 1,
      //       partnerId: 1,
      //       botStatus: {
      //         $let: {
      //           vars: {
      //             diff: {
      //               $divide: [
      //                 { $subtract: [new Date(), "$userdata.date"] },
      //                 1000 * 60 * 60 * 24,
      //               ],
      //             },
      //           },
      //           in: {
      //             $switch: {
      //               branches: [
      //                 {
      //                   case: { $and: [{ $lte: ["$$diff", 15] }, "$$diff"] },
      //                   then: "Active",
      //                 },
      //                 {
      //                   case: { $and: [{ $gt: ["$$diff", 15] }, "$$diff"] },
      //                   then: "Inactive",
      //                 },
      //               ],
      //               default: "No states",
      //             },
      //           },
      //         },
      //         // in: {$multiply: ["$$diff", 1]}}
      //       },
      //       diff: {
      //         $divide: [
      //           { $subtract: [new Date(), "$userdata.date"] },
      //           1000 * 60 * 60 * 24,
      //         ],
      //       },
      //       // userData: "$userdata"
      //     },
      //   }
      // ])
  }catch(err){
      console.log('err',err);
  }



  // let inactivedata=[],activedata=[],nostatedata =[];
  // for (i=0;i<data.length;i++) {
  // if(data[i].clientDetails.botStatus =='Inactive'){
  // inactivedata.push(data[i])
  // } else if(data[i].clientDetails.botStatus =='Active') {
  // activedata.push(data[i])
  // } else{
  // nostatedata.push(data[i])
  // }
  // }


  // if(data.length>0){
  //   return res.status(200).json({
  //     status: "success",
  //     statusCode: 200,
  //     message: "Bot Data found successfully.",
  //     //data: data,
  //     actData: activedata,
  //    // inActData: inactivedata,
  //    // noActData: nostatedata,
  //   });
  // } else{
  //   return res.status(200).json({
  //     status: "failed",
  //     message: "No Bot data found.",
      
  //   });
  // }
  
}

async function getliveBotbyid(req, res) {

  let clientId = { "clientId": req.body.clientId }

// console.log('get All livebot byid id', req.body)
     try {

       const data = await db.__.aggregate([
  
          //  { $match : { clientId : "btrack_chatbot" } },
            { $match : clientId },
            {
                    $project: {
                        clientId: 1,
                        name: 1,
                        email: 1,
                        phone: 1,
                    },
                } 

        ])

        if(!data) {
          res.status(404).send('Not found')
        }
        res.status(200).json({
                statusCode: 200,
                status: true,
                message: "Live bot data fetched successfully",
                data : data
            }); 
    } catch (error) {
        res.status(500).json({
            statusCode: 201,
            status: false,
            message: "Error on catch block",
            error : error
        });
    }


}

async function updateliveBot(req, res) {

  const id = req.body._id
  //  console.log('update live bot id', id)
    try {
       const updateData = await db.__.findByIdAndUpdate(id, req.body, { new: true })

       if(!updateData) {
            return res.status(404).json({
            statusCode: 404,
            status: "failed",
            message: "Not found data",
        });
       }

        res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Update successfully.",
            data: updateData,
        });
    } catch (error) {
        res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "No data Updated.",
        });
    }

}

/**********************************************************************
  // schedule a calling function at midnight 12:40 AM 
  // const job = new CronJob('00 40 00 * * *', function() {
  //                          ss mm hh d m day of weel(0-7) , d = Day of Month: 1-31
 **********************************************************************/
const job = new CronJob('58 */23 * * *', function() {
	const d = new Date();
  let callFun = getClientBulkyDataAndStore();
	console.log('onTick : getClientBulkyDataAndStore calls ', d);
});
job.start();

// total conversation and unique visitors

// async function getTotalConversationandVisitor(req, res) {
//   let data = await db.Client.aggregate([
//     {
//       $lookup: {
//         from: "userchats",
//         // localField: "_id",
//         // foreignField: "clientId",
//         let: { objId: "$_id", clientId: "$clientId" },
//         pipeline: [
//                {
//                    $match: {
//                        $expr: {
//                            $or: [
//                                { $eq: [ "$clientId", "$$objId" ] },
//                                { $eq: [ "$clientId", "$$clientId" ] }
//                            ]
//                        }
//                    }
//                }
//            ],
//         as: "userdata",
//       },
//     },
//     {
//       $unwind: { path: "$userdata", preserveNullAndEmptyArrays: true },
//     },
//     {
//       $project: {
//         _id: 0,
//         clientId: 1,
//         name: 1,
//         phone: 1,
//         email: 1,

//         users: { $cond: { if: "$userdata.userId", then: 1, else: 0 } },
//         leadcount: {
//           $cond: {
//             if: {
//               $or: [
//                 "$userdata.session.email",
//                 "$userdata.session.phone",
//                 "$userdata.email",
//                 "$userdata.phone",
//               ],
//             },
//             then: 1,
//             else: 0,
//           },
//         },
//         chatSize: {
//           $cond: {
//             if: "$userdata.chats",
//             then: { $size: "$userdata.chats" },
//             else: 0,
//           },
//         },
//       },
//     },
//     {
//       $group: {
//         _id: "$clientId",
//         totalLeads: { $sum: "$leadcount" },
//         totalUsers: { $sum: "$users" },
//         totalConversation: { $sum: "$chatSize" },
//         clientData: { $first: "$$ROOT" },
//       },
//     }, {
//       $lookup: {
//         from: "logs",
//         localField: "_id",
//         foreignField: "clientId",
//         as: "clientLogs",
//       },
//     },{
//       $lookup: {
//         from: "superadminclients",
//         localField: "_id",
//         foreignField: "clientId",
//         as: "clientInfo",
//       }
//     },
//     {
//       $project: {
//         _id: 1,
//        // totalLeads:1,
//         totalUsers:1,
//         totalConversation:1,
//        // clientData:1,
//        // clientLogs: { $arrayElemAt: ["$clientLogs", -1] },
//       //  clientdetails: { $arrayElemAt: ["$clientInfo", 0] },
//       },
//     }
//   ])
//   //.cursor().exec().toArray();

//   if(data.length>0){
//     return res.status(200).json({
//       status: "success",
//       message: "Data found successfully.",
//       data: data,
//     });
//   } else{
//     return res.status(200).json({
//       status: "failed",
//       message: "No data found.",
//     });
//   }
 
// }

async function createPlan(req,res) {

   const planData = await db.__.find({clientId:req.body.clientId});
   const availablePlan = await db.__.findOne({clientId:req.body.clientId,deletePlan : false})

   if(availablePlan) {

    return res.status(500).json({
      statusCode: 500,
      status: "failed",
      message: "Payment plan already available.",
    });

   } else {
     
    var planId = req.body.clientId;
    let planDetail = req.body;
    planDetail['planId'] = planId+"_"+((planData.length)+1);

    if((planDetail.planId).length>=35){
      var newPlanId = planId.slice(0, ((planId.length)-5))
      planDetail['planId'] = newPlanId+"_"+((planData.length)+1);
    }

    const newPlanDetail = {
      "planId": planDetail.planId,
      "planName": planDetail.planName,
      "type": planDetail.type,
      "maxCycles":parseInt(planDetail.maxCycles),
      "amount": parseInt(planDetail.amount),
      "intervalType": planDetail.intervalType,
      "intervals": parseInt(planDetail.intervals),
      "description": planDetail.description
    }

    const paymentPlan = await db.AA(planDetail);

    const headers = {
      "X-Client-Id":'',
      "X-Client-Secret":'',
      "Content-Type":'application/json'
    }

   await axios.post('',newPlanDetail, {headers: headers})
   .then(function (response) {
        
          if(response.data.status=='OK') {
             
            AA.save();
            return res.status(200).json({
              statusCode: 200,
              status: "success",
              data: response.data,
              message: response.data.message,
            });
      
          } else {

          return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: response.data.message,
          });
        }

      }).catch(function (error) {
      
        return res.status(500).json({
          statusCode: 500,
          status: "failed",
          error:error,
          message: "Invalid payment plan details.",
        });
    });
    }
}

async function getPlan(req, res) {
    try {

      const clientId = req.body.clientId;
      const paymentPlan = await db.__.findOne({clientId:clientId,deletePlan : false})
      
      return res.status(200).json({
        statusCode: 200,
        status: "success",
        data: paymentPlan,
        message: "Payment plan find successfully.",
      });
    
    
    } catch (error) {
     return res.status(500).json({
        statusCode: 500,
        status: "failed",
        error:error,
        message: "Payment plan is not find.",
      });
    }

}

async function deletePlan(req, res) {
  const planId = req.body.planId;

  if(!planId) {
    return res.status(500).json({
      statusCode: 500,
      status: "failed",
      message: "Payment plan is not available.",
    });
  } else {
     
    try {
      
      const paymentPlan = await db.__.findOne({planId:planId, deletePlan: false});  
      if(paymentPlan.paymentLink=='' || paymentPlan.paymentLink==undefined) {

         const paymentPlan = await db.__.findOneAndUpdate({planId:planId},
          {deletePlan:true},{returnOriginal: false});           

          return res.status(200).json({
            statusCode: 200,
            status: "success",
            data: paymentPlan,
            message: "Payment plan delete successfully.",
          });


      } else {
        const subReferenceId = paymentPlan.paymentLink.paymentLink.subReferenceId
        
        const headers = {
          "X-Client-Id":'',
          "X-Client-Secret":'',
          "Content-Type":'application/json'
        }

        await axios.post(``+ subReferenceId +`/cancel`,{subReferenceId}, {headers: headers})
            .then( async function(response) {

              if(response.data.status=='OK') {    
                deletePaymentLink(subReferenceId)

                const paymentPlan = await db.__.findOneAndUpdate({planId:planId},
                  {deletePlan:true},{returnOriginal: false});           
  
                  return res.status(200).json({
                    statusCode: 200,
                    status: "success",
                    data: paymentPlan,
                    message: "Payment plan delete successfully.",
                  });
          
              } else {

              return res.status(500).json({
                statusCode: 500,
                status: "failed",
                message: response.data.message,
              });
            }

          }).catch(function (error) {
            return res.status(500).json({
              statusCode: 500,
              status: "failed",
              error:error,
              message: "Payment Plan is not available.",
            });
          });
      }
      
     } catch (error) {
      return res.status(500).json({
         statusCode: 500,
         status: "failed",
         error:error,
         message: "Payment plan is not find.",
       });
   
     }

  }

}

async function unsubscribePlan(req,res) {
  
  const planId = req.body.planId;
  if(!planId) {
    return res.status(500).json({
      statusCode: 500,
      status: "failed",
      message: "Payment plan is not available.",
    });
  } else {

      const paymentPlan = await db.__.findOne({planId:planId, deletePlan: false});  
      if(paymentPlan.paymentLink=='' || paymentPlan.paymentLink==undefined) {
          return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Payment plan is not subscribed.",
          });
      } else {
        const subReferenceId = paymentPlan.paymentLink.paymentLink.subReferenceId
        
        const headers = {
          "X-Client-Id":'',
          "X-Client-Secret":'',
          "Content-Type":'application/json'
        }

        await axios.post(``+ subReferenceId +`/cancel`,{subReferenceId}, {headers: headers})
            .then(function (response) {
              if(response.data.status=='OK') {    
                deletePaymentLink(subReferenceId)
            
                return res.status(200).json({
                  statusCode: 200,
                  status: "success",
                  data: response.data,
                  message: response.data.message,
                });
          
              } else {

              return res.status(500).json({
                statusCode: 500,
                status: "failed",
                message: response.data.message,
              });
            }

          }).catch(function (error) {
            return res.status(500).json({
              statusCode: 500,
              status: "failed",
              error:error,
              message: "Payment plan is not available.",
            });
          });
    }

  }

}

async function deletePaymentLink(obj) {
   const subReferenceId = obj;
   const deletePaymentLink = await db.__.findOneAndUpdate({"paymentLink.paymentLink.subReferenceId":subReferenceId},
        {"paymentLink":''},{returnOriginal: false});

   if(deletePaymentLink) {
    console.log('payment link delete successfully')
    // return res.status(200).json({
    //   statusCode: 200,
    //   status: "success",
    //   message: 'payment link delete successfully',
    // });
   } else {
    console.log('payment link not deleted')
    // return res.status(500).json({
    //   statusCode: 500,
    //   status: "failed",
    //   message: "payment link not deleted",
    // });

   }

}
