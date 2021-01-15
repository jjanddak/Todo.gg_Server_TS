require('dotenv').config();
const { user } = require("../models");
// const sequelize = require("sequelize");
const jwt = require('jsonwebtoken');

// const GithubStrategy = require("passport-github");
// const GoogleStrategy = require("passport-google");
const Git_clientID = process.env.GITHUB_CLIENT_ID;
const Git_clientSecret = process.env.GITHUB_CLIENT_SECRET;
const Google_clientID = process.env.GOOGLE_CLIENT_ID;
const Google_clientSecret = process.env.GOOGLE_CLIENT_SECRET
const axios = require('axios');


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
      res.status(200).send({accessToken:accesstoken, message:'login success'});
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
	GitHub_SocialLogin : (req, res) => {
    axios({
      method: 'post',
      url: `https://github.com/login/oauth/access_token`,
      headers: {
        accept: 'application/json',
      },
      data: {
        client_id: Git_clientID,
        client_secret: Git_clientSecret,
        code: req.body.authorizationCode
      }
    }).then((response) => {
      accessToken = response.data.access_token;
      res.status(200).json({ accessToken: accessToken })
  
    }).catch(e => {
      res.status(404).send({message:"not access"})
    })    
  },

  GitHub_SignUpNLogin : async (req,res) => {
    const userinfo = await user.findOrCreate({
      where : {
        email : req.body.id,
      },
      default : {
        email : req.body.id,
        username : req.body.name
      }
    }).catch(err => {console.log(err)})

    const accesstoken=jwt.sign({
      email:userinfo.email,
      profile:userinfo.profile,
      username:userinfo.username,
      createdAt:userinfo.createdAt,
      updatedAt:userinfo.updatedAt,
      iat:Math.floor(Date.now() / 1000),
      exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
    },process.env.ACCESS_SECRET);

    const refreshtoken=jwt.sign({
      email:userinfo.email,
      profile:userinfo.profile,
      username:userinfo.username,
      createdAt:userinfo.createdAt,
      updatedAt:userinfo.updatedAt,
      iat:Math.floor(Date.now() / 1000),
      exp:Math.floor(Date.now() / 1000) + (60 * 60*24*30)
    },process.env.REFRESH_SECRET);

    res.cookie('refreshToken', refreshtoken, {
      secure: true,
      httpOnly: true,
      sameSite:'none',
    });

    // if(!userinfo){
    //   res.status(400).send({message:"no"})
    // } else {
    //   res.status(200).send({accessToken:accesstoken , message:"good!"})
    // }

  },

  Google_SocialLogin : (req, res) => {
    axios.post("https://accounts.google.com/o/oauth2/v2/auth", {
      client_id : Google_clientID,
      client_secret : Google_clientSecret,
      code : req.body.authorizationCode,
      callbackURL : "https://localhost:4001/auth/google/callback"
    })
  }
}