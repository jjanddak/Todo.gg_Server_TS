require('dotenv').config();
const { user, project, contributer, taskCard } = require("../models");
const jwt = require('jsonwebtoken');

const axios = require('axios');

module.exports = {
  getOneProject: async (req, res) => {
    let authorization = req.headers["authorization"];
    const accessToken=authorization.split(" ")[1]; //0번인덱스는 'Bearer' 1번이 토큰정보
    
    //1. 엑세스토큰이 유효한지 확인
    let userInfo;
    let verifyAccessToken = () => {
      if(!accessToken){
        return null;
      }
      try{
        return jwt.verify(accessToken, process.env.ACCESS_SECRET);
      }catch(err){
        return null;
      }
    }
    
    userInfo=verifyAccessToken();

    //1-1. 엑세스 토큰이 만료되었을 때
    if(!userInfo){
      const cookieToken=req.cookies.refreshToken;
      if(!cookieToken){
        return res.status(400).json({data: null, message: 'refresh token not provided'})
      }
      //2. refresh token이 유효한지, 서버가 가지고 있는 비밀 키로 생성한 것이 맞는지 확인합니다.
      let verifyToken = (token) => {
        if(!token){
          return null;
        }
        try{
          return jwt.verify(token, process.env.REFRESH_SECRET);
        }catch(err){
          return null;
        }
      }
      userInfo=verifyToken(cookieToken);
      const newAccessToken=jwt.sign({
        username:userInfo.username,
        profile:userInfo.profile,
        email:userInfo.email,
        createdAt:userInfo.createdAt,
        updatedAt:userInfo.updatedAt,
        iat:Math.floor(Date.now() / 1000),
        exp:Math.floor(Date.now() / 1000) + (60 * 60 * 24)
      },process.env.ACCESS_SECRET);
      userInfo.newAccessToken=newAccessToken;
      if(!userInfo){
        return res.status(400).send({message:"invalid refreshToken"});
      }
    }

    const {id} = userInfo;

    //해당 프로젝트에 그 유저가 포함되어있는지 검증
    let isValidUser = await contributer.findOne({
      where:{
        user_id:id,
        project_id:req.params.id
      }
    });
    if(!isValidUser){
      return res.status(400).send({message: "invalid user for get projectInfo"})
    }

    await project.findOne({
      where:{
        id:req.params.id
      },
      include:[
        {
          model:contributer
        },
        {
          model:taskCard,
          include:[{
            model:contributer
          }]
        }
      ]
    })
    .then(result=>{
      let countObj={todo:0,inprogress:0,done:0};
      result.dataValues.taskCards.map(ele=>{
        countObj.project_id=ele.project_id;
        if(ele.dataValues.state=="todo"){
          if(countObj.todo<1){
            countObj.todo=1;
          }else{
            countObj.todo++;
          }
        }
        if(ele.dataValues.state=="inprogress"){
          if(countObj.inprogress<1){
            countObj.inprogress=1;
          }else{
            countObj.inprogress++;
          }
        }
        if(ele.dataValues.state=="done"){
          if(countObj.done<1){
            countObj.done=1;
          }else{
            countObj.done++;
          }
        }
      });
      // result.taskCardCount=countObj;
      return res.status(200).send({projectInfo:result, taskCardCount:countObj});
    }).catch(err=>{
      console.log(err);
    })
  },

    newTask : async (req, res) => {
      let authorization = req.headers["authorization"];
      const accessToken=authorization.split(" ")[1]; //0번인덱스는 'Bearer' 1번이 토큰정보
      let userInfo;
  
      
      const actokenverify = () => {
      try{
        return jwt.verify(accessToken, process.env.ACCESS_SECRET);
      }catch(err){
        console.log(err);
        return null
      }
    }
  
    userInfo=actokenverify();
    
    
      if(!userInfo){
        const cookieToken=req.cookies.refreshToken;
    
        if(!cookieToken){
          return res.json({data: null, message: 'refresh token not provided'})
        }
    
        let verifyToken = (token) => {
          if(!token){
            return null;
          }
          try{
            return jwt.verify(token, process.env.REFRESH_SECRET);
          }catch(err){
            return null;
          }
        }
        userInfo=verifyToken(cookieToken);
        userInfo.refreshToken = true
        if(!userInfo){
          return res.json({message:"refresh token invaild"})
        }
      }
    
      const userdata = await user.findOne({
        where : {
          email : userInfo.email
        } 
      }).catch(err => {console.log(err)})
      console.log(userdata.email)
        if(userInfo.refreshToken){
          const accesstoken=jwt.sign({
            id:userdata.id,
            email:userdata.email,
            profile:userdata.profile,
            username:userdata.username,
            createdAt:userdata.createdAt,
            updatedAt:userdata.updatedAt,
            iat:Math.floor(Date.now() / 1000),
            exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
          },process.env.ACCESS_SECRET);
          userdata.accessToken = accesstoken
        }
        
        const newtaskcard = await taskCard.create({
          content : req.body.content,
          project_id : req.params.id
        })
        await contributer.create({
          taskCard_id : newtaskcard.dataValues.id,
          user_id : userInfo.id
        }).catch(err => {console.log(err)})

        const addContributers = async (member) => {
          await contributer.create({
            taskCard_id:newtaskcard.dataValues.id,
            user_id:member.id
          })
        }
        req.body.member.map(ele=>{
          addContributers(ele);
        })

      
     if(!newtaskcard){
     res.status(400).send({message:"taskCard add failed"})
    } else {
     res.status(200).send({createTaskCard : newtaskcard})
     if(userdata.accessToken){
       res.status(200).send({accessToken:userdata.accessToken})
     }
    }
  }
}