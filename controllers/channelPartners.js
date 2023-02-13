const fs = require('fs');
const passport = require('passport');
//const sendMail = require('../middleware/sendMail');
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


module.exports = {
   
    /*Dashboard API*/

   getChannelPartnerClientList: getChannelPartnerClientList,
   botStatusChannelPartner: botStatusChannelPartner,
   getClientCountChannelPartner : getClientCountChannelPartner,
  // getTotalConversationChannelPartner: getTotalConversationChannelPartner,
  
}

/*****************************DASHBOARD PAGE API*****************************************/

async function botStatusChannelPartner(req, res) {
    let pipelineItem = { "partnerId": req.body.partnerId }
    let clData = await db.__.aggregate([{
            $match: {
                $and: [
                    { 'url': { $not: { $regex: 'helloyubo.com/' + '.*', $options: "i" } } },
                    { 'url': { $not: { $regex: 'localhost:' + '.*', $options: "i" } } },
                ]
            }
        },
        {
            $project: {
                _id: 0,
                clientId: 1
            }
        }
    ])
    let unique = [...new Set(clData.map(item => item.clientId))];
    let data = await db._.aggregate([{
            $lookup: {
                from: "userchats",
                let: { objId: "$_id", clientId: "$clientId" },
                pipeline: [{
                    $match: {
                        $expr: {
                            $or: [
                                { $eq: ["$clientId", "$$objId"] },
                                { $eq: ["$clientId", "$$clientId"] },
                            ],
                        },
                    },
                }, ],
                as: "userdata",
            },
        },
        {
            $unwind: { path: "$userdata", preserveNullAndEmptyArrays: true },
        },
        {
            //$match: pipelineItem
            $match: {
                $and: [pipelineItem, { 'clientId': { $in: unique } }]
            }
        },
        {
            $project: {
                _id: 0,
                clientId: 1,
                name: 1,
                phone: 1,
                email: 1,
                contactPerson: 1,
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
                                branches: [{
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

        // {
        //     $lookup: {
        //         from: "logs",
        //         localField: "_id",
        //         foreignField: "clientId",
        //         as: "clientLogs",
        //     },
        // }, {
        //     $lookup: {
        //         from: "superadminclients",
        //         localField: "_id",
        //         foreignField: "clientId",
        //         as: "clientInfo",
        //     }
        // },
        {
            $project: {
                _id: 1,
                clientDetails: 1,
                //  clientLogs: { $arrayElemAt: ["$clientLogs", -1] },
                //  clientdetails: { $arrayElemAt: ["$clientInfo", 0] },
            },
        },

    ])
    //.cursor().exec().toArray();

    let inactivedata = [],
        activedata = [],
        nostatedata = [];
    for (i = 0; i < data.length; i++) {
        if (data[i].clientDetails.botStatus == 'Inactive') {
            inactivedata.push(data[i])
        } else if (data[i].clientDetails.botStatus == 'Active') {
            activedata.push(data[i])
        } else {
            nostatedata.push(data[i])
        }
    }
    if (data.length > 0) {
        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Bot Data found successfully.",
            //data: data,
            inactiveBotDetails: inactivedata,
            actData: activedata.length,
            inActData: inactivedata.length,
            noActData: nostatedata.length,
        });
    } else {
        return res.status(200).json({
            status: "failed",
            message: "No Bot data found.",

        });
    }

}

async function getClientCountChannelPartner(req, res) {
    let pipelineItem = { "partnerId": req.body.partnerId }
    await clients.aggregate([{
        $facet: {
            totalClients: [
                { $match: pipelineItem }, //{ $match: { $and: [pipelineItem, { isDeleted: false }] } },
                { $count: 'total' }
            ],
        }
    }], async function(error, results) {
        if (error) {
            log.error("Error while fetching clients count", error)
            let responseObj = {
                statusCode: 400,
                status: "fail",
                message: "Error while fetching client count"
            }
            res.status(responseObj.statusCode).send(responseObj)
        } else if (results.length) {
            let clientCount = {
                totalClients: results[0].totalClients.length > 0 ? results[0].totalClients[0].total : 0,
            }
            let responseObj = {
                statusCode: 200,
                status: "success",
                message: "Client count fetched successfully",
                data: clientCount
            }
            res.status(responseObj.statusCode).send(responseObj)
        } else {
            let responseObj = {
                statusCode: 404,
                status: "fail",
                message: "Clients not found"
            }
            res.status(responseObj.statusCode).send(responseObj)
        }
    })
}

// async function getTotalConversationChannelPartner(req, res) {
//     let pipelineItem = { "partnerId": req.body.partnerId }
//     await clients.aggregate([{
//             $lookup: {
//                 from: "userchats",
//                 localField: "_id",
//                 foreignField: "clientId",
//                 as: "chatData"
//             }
//         },
//         { $unwind: "$chatData" },
//         { $match: pipelineItem },
//         {
//             $project: {
//                 conversation: { $cond: { if: { $isArray: "$chatData.chats" }, then: { $size: "$chatData.chats" }, else: "NA" } }
//             }

//         }
//     ], async function(error, result) {
//         if (error) {
//             log.error("Error while getting client list", error);
//             console.log("Error while getting client list", error);
//             let responseObj = {
//                 statusCode: 400,
//                 status: "fail",
//                 message: "Error while getting client list"
//             }
//             res.status(responseObj.statusCode).send(responseObj)
//         } else if (result.length > 0) {
//            // console.log("CONV RESULT", result)
//             log.error("Client list fetched successfully");
//             let totalCon = 0
//             result.forEach(element => {

//                     totalCon = totalCon + element.conversation
//                 })
//                 // let totalCon = result.reduce(function(sum, current) {
//                 //     return sum + current.conversation;
//                 // }, 0);
//             let responseObj = {
//                 statusCode: 200,
//                 status: "success",
//                 message: "Client list fetched successfully",
//                 totalConversations: totalCon //(totalCon / 1000).toFixed(2)
//             }
//             res.status(responseObj.statusCode).send(responseObj)
//         } else {
//             log.error("Client data not found");
//             let responseObj = {
//                 statusCode: 404,
//                 status: "fail",
//                 message: "Client data not found"
//             }
//             res.status(responseObj.statusCode).send(responseObj)
//         }
//     })
// }

async function getChannelPartnerClientList(req, res) {

    let pipelineItem = { "partnerId": req.body.partnerId }
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
        { $match : pipelineItem },        
        {
            $project: {
                _id: 0,
                clientId: 1,
                name: 1,
                phone: 1,
                email: 1,
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
                //          createdAt: 1,
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
                _id: 1,
                totalLeads: 1,
                totalUsers: 1,
                totalConversation: 1,
                clientData: 1,
                clientLogs: 1,
              //  clientLogs: { $arrayElemAt: ["$clientLogs", -1] },
                clientdetails: { $arrayElemAt: ["$clientInfo", 0] },
            },
        }
    ])
    // .cursor().exec().toArray();

    if (data.length > 0) {
        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Data found successfully.",
            data: data,
        });
    } else {
        return res.status(200).json({
            status: "failed",
            message: "No data found.",
        });
    }

}
