const { user } = require("../models");
// const sequelize = require("sequelize");
const jwt = require('jsonwebtoken');

module.exports = {
  login : async (req,res) =>{
    const body=req.body;
    let userInfo = await user.findOne({
      where: { 
        email: body.email,
        password: body.password 
      }
    });
    if(!userInfo){
      res.status(400).send({data:null,message:'login failed'});
    }else{
      //JWT(access, refresh)토큰 생성후 응답
      const accesstoken=jwt.sign({
        email:userInfo.email,
        profile:userInfo.profile,
        username:userInfo.username,
        createdAt:userInfo.createdAt,
        updatedAt:userInfo.updatedAt,
        iat:Math.floor(Date.now() / 1000),
        exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
      },process.env.ACCESS_SECRET);
  
      const refreshtoken=jwt.sign({
        email:userInfo.email,
        profile:userInfo.profile,
        username:userInfo.username,
        createdAt:userInfo.createdAt,
        updatedAt:userInfo.updatedAt,
        iat:Math.floor(Date.now() / 1000),
        exp:Math.floor(Date.now() / 1000) + (60 * 60*24*30)
      },process.env.REFRESH_SECRET);
  
      res.cookie('refreshToken', refreshtoken, {
        secure: true,
        httpOnly: true,
        sameSite:'none',
      });
      res.status(200).send({
        userinfo:{
          email:userInfo.email,
          username:userInfo.username
        },
        accessToken:accesstoken, 
        message:'login success'
      });
    }
  },
  
  SignUp : async (req, res) => {
		const body = req.body;
		if (!body.email || !body.password || !body.username) {
			res.status(422).send("insufficient parameters supplied");
		} else if (body.password.length < 6 || body.password.length > 12) {
			res.status(400).send("resize password length");
		} else {
			const createuserinfo = await user.create({
        profile:body.profile,
				email: body.email,
				password: body.password,
				username: body.username,
			}).catch(err=>console.log(err));
			if (createuserinfo) {
				res.status(200).json(createuserinfo);
			}
		}
	},
	CheckEmail: async (req, res) => {
		const body = req.body;
		const email = await user.findOne({
			where: {
				email: body.email,
			},
		}).catch(err=>console.log(err));
		if (email) {
			res.status(400).send({message : "invaild"});
		} else {
			res.status(200).send({message : "vaild" });
		}
	},
	CheckUsername: async (req, res) => {
		const body = req.body;
		const username = await user.findOne({
			where: {
				username: body.username,
			},
		}).catch(err=>console.log(err));
		if (username) {
			res.status(400).send({message:"invalid"});
		} else {
			res.status(200).send({message:"valid"});
		}
  },
  DeleteUser : async (req, res) => {
    const sess = req.session
    const deleteUserInfo = await user.destroy({
      where : {
        username : sess.username
      }
    }).catch(err => {console.log(err)})
    if(!deleteUserInfo){
      res.status(404).send({message : "Not Delete"})
    } else {
      res.status(200).send({message : "Good!"})
    }
  }
}