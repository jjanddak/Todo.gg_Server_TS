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

  updateProject: async (req,res) => {
    let authorization = req.headers["authorization"];
    const accessToken=authorization.split(" ")[1]; //0번인덱스는 'Bearer' 1번이 토큰정보
    const body=req.body;

    //1. 엑세스토큰이 유효한지 확인
    let userInfo;
    let newAccessToken;
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
      newAccessToken=jwt.sign({
        id:userInfo.id,
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

    //수정하려는 유저가 매니저가 맞는지 확인
    const projectInfo = await project.findOne({
      where:{
        id:req.params.id
      }
    }).catch(err=>res.status(400).send({message:err}))
    if(projectInfo.dataValues.manager_id != id){
      return res.status(400).send({message:"invalid user tried to update"});
    }

    //start_date, end_date 변경 분기 (둘다, 하나만)
    if(body.start_date && body.end_date){
      await project.update(
        {
          title:body.title,
          description:body.description,
          start_date:body.start_date,
          end_date:body.end_date
        },
        {
          where:{
            id:req.params.id
          }
        }
      ).catch(err=>res.status(400).send({message:err}));
    } else if(body.start_date && !body.end_date){ //start_date 만 변경
      await project.update(
        {
          title:body.title,
          description:body.description,
          start_date:body.start_date,
        },
        {
          where:{
            id:req.params.id
          }
        }
      ).catch(err=>res.status(400).send({message:err}));
    }else if(!body.start_date && body.end_date){ //end_date만 변경
      await project.update(
        {
          title:body.title,
          description:body.description,
          end_date:body.end_date
        },
        {
          where:{
            id:req.params.id
          }
        }
      ).catch(err=>res.status(400).send({message:err}));
    }

    //응답 (accessToken 분기)
    if(newAccessToken){
      return res.status(200).send({message:"project update success", accessToken:newAccessToken })
    }else{
      return res.status(200).send({message:"project update success"})
    }
  },
}