require('dotenv').config();
const  SHA256  = require("./SHA256")
const { user, project, contributer, taskCard } = require("../models");
const Sequelize = require("sequelize");
const jwt = require('jsonwebtoken');
const Op = Sequelize.Op;
const Git_clientID = process.env.GITHUB_CLIENT_ID;
const Git_clientSecret = process.env.GITHUB_CLIENT_SECRET;
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
        id:userInfo.id,
        email:userInfo.email,
        profile:userInfo.profile,
        username:userInfo.username,
        createdAt:userInfo.createdAt,
        updatedAt:userInfo.updatedAt,
        iat:Math.floor(Date.now() / 1000),
        exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
      },process.env.ACCESS_SECRET);
  
      const refreshtoken=jwt.sign({
        id:userInfo.id,
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
          id:userInfo.id,
          profile:userInfo.profile,
          email:userInfo.email,
          username:userInfo.username
        },
        accessToken:accesstoken, 
        message:'login success'
      });
    }
  },

  getProjectList: async (req, res) => {
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
  
    //3. DB 조작
    await user.findOne({
      where:{
        email:userInfo.email
      },
      attributes:["id","username","email","profile"],
      include: [
        {
          model: contributer,
          attributes:["project_id","user_id"],
          where: {
            project_id: {
              [Op.ne]: null
            }
          },
          include:[
            {
              model:project,
              attributes:["id","title","description","manager_id","start_date","end_date"],
              include:[
                {
                  model:taskCard,
                  attributes:["id","project_id","content","state"],
                  // include:[
                  //   {
                  //     model:contributer,
                  //     attributes:["project_id","user_id"],
                  //     include:[{
                  //       model:user,
                  //       attributes:["profile","username"],
                  //     }]
                  //   }
                  // ]
                },
                {
                  model:contributer,
                  attributes:["project_id","user_id"],
                  include:[{
                    model:user,
                    attributes:["id","profile","username"],
                  }]
                },
                {
                  model:user,
                  attributes:["profile"]
                }
              ]
            }
          ]
        },
      ]
    })
    .then((data)=>{
      delete data.dataValues.password;
      let taskCardsArr=[];

      data.contributers.map(ele=>{
        if(ele.project){          
          let countObj={todo:0,inprogress:0,done:0};
          countObj.project_id=ele.project_id;
  
          for(let i=0;i<ele.project.taskCards.length;i++){
            if(ele.project.taskCards[i].dataValues.state=="todo"){
              if(countObj.todo<1){
                countObj.todo=1;
              }else{ 
                countObj.todo++;
              }
            }
            if(ele.project.taskCards[i].dataValues.state=="inprogress"){
              if(countObj.inprogress<1){
                countObj.inprogress=1;
              }else{
                countObj.inprogress++;
              }
            }
            if(ele.project.taskCards[i].dataValues.state=="done"){
              if(countObj.done<1){
                countObj.done=1;
              }else{
                countObj.done++;
              }
            }
          }
          taskCardsArr.push(countObj);
        }
      })
      data.dataValues.taskCardCount=taskCardsArr;
      if(userInfo.newAccessToken){
        res.status(200).send({projectList:data, accessToken: userInfo.newAccessToken});
      }else{
        res.status(200).send({projectList:data});
      }

    })
    .catch((err)=>console.log(err));
  },
  
  SignUp : async (req, res) => {
    const body = req.body;
    await user.create({
      profile:body.profile,
      email: body.email,
      password: body.password,
      username: body.username,
    }).catch(err=>res.status(400).send(err));
    res.status(200).json({message:"signup success"});
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
    const body = req.body.data;
    let userinfo;
    const gitName = body.name ? body.name : "GithubName"+body.id;
    // const userinfo = await user.findOrCreate({
    //   where : {
    //     email : body.id,
    //   },
    //   default : {
    //     email : body.id,
    //     username : gitName,
    //     password : body.login,
    //     profile : body.avatar_url
    //   }
    // })
    let findUser = await user.findOne({
      where:{
        email:body.id
      }
    })

    if(findUser){
      userinfo=findUser;
    }else{ //새로가입해야함

      function SHA256(s){
        var chrsz   = 8;
        var hexcase = 0;
        function safe_add (x, y) {
            var lsw = (x & 0xFFFF) + (y & 0xFFFF);
            var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
            return (msw << 16) | (lsw & 0xFFFF);
        }
        function S (X, n) { return ( X >>> n ) | (X << (32 - n)); }
        function R (X, n) { return ( X >>> n ); }
        function Ch(x, y, z) { return ((x & y) ^ ((~x) & z)); }
        function Maj(x, y, z) { return ((x & y) ^ (x & z) ^ (y & z)); }
        function Sigma0256(x) { return (S(x, 2) ^ S(x, 13) ^ S(x, 22)); }
        function Sigma1256(x) { return (S(x, 6) ^ S(x, 11) ^ S(x, 25)); }
        function Gamma0256(x) { return (S(x, 7) ^ S(x, 18) ^ R(x, 3)); }
        function Gamma1256(x) { return (S(x, 17) ^ S(x, 19) ^ R(x, 10)); }
        function core_sha256 (m, l) {
            var K = new Array(0x428A2F98, 0x71374491, 0xB5C0FBCF, 0xE9B5DBA5, 0x3956C25B, 0x59F111F1, 0x923F82A4, 0xAB1C5ED5, 0xD807AA98, 0x12835B01, 0x243185BE, 0x550C7DC3, 0x72BE5D74, 0x80DEB1FE, 0x9BDC06A7, 0xC19BF174, 0xE49B69C1, 0xEFBE4786, 0xFC19DC6, 0x240CA1CC, 0x2DE92C6F, 0x4A7484AA, 0x5CB0A9DC, 0x76F988DA, 0x983E5152, 0xA831C66D, 0xB00327C8, 0xBF597FC7, 0xC6E00BF3, 0xD5A79147, 0x6CA6351, 0x14292967, 0x27B70A85, 0x2E1B2138, 0x4D2C6DFC, 0x53380D13, 0x650A7354, 0x766A0ABB, 0x81C2C92E, 0x92722C85, 0xA2BFE8A1, 0xA81A664B, 0xC24B8B70, 0xC76C51A3, 0xD192E819, 0xD6990624, 0xF40E3585, 0x106AA070, 0x19A4C116, 0x1E376C08, 0x2748774C, 0x34B0BCB5, 0x391C0CB3, 0x4ED8AA4A, 0x5B9CCA4F, 0x682E6FF3, 0x748F82EE, 0x78A5636F, 0x84C87814, 0x8CC70208, 0x90BEFFFA, 0xA4506CEB, 0xBEF9A3F7, 0xC67178F2);
            var HASH = new Array(0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19);
            var W = new Array(64);
            var a, b, c, d, e, f, g, h, i, j;
            var T1, T2;
            m[l >> 5] |= 0x80 << (24 - l % 32);
            m[((l + 64 >> 9) << 4) + 15] = l;
            for ( var i = 0; i<m.length; i+=16 ) {
                a = HASH[0];
                b = HASH[1];
                c = HASH[2];
                d = HASH[3];
                e = HASH[4];
                f = HASH[5];
                g = HASH[6];
                h = HASH[7];
                for ( var j = 0; j<64; j++) {
                    if (j < 16) W[j] = m[j + i];
                    else W[j] = safe_add(safe_add(safe_add(Gamma1256(W[j - 2]), W[j - 7]), Gamma0256(W[j - 15])), W[j - 16]);
                    T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[j]), W[j]);
                    T2 = safe_add(Sigma0256(a), Maj(a, b, c));
                    h = g;
                    g = f;
                    f = e;
                    e = safe_add(d, T1);
                    d = c;
                    c = b;
                    b = a;
                    a = safe_add(T1, T2);
                }
                HASH[0] = safe_add(a, HASH[0]);
                HASH[1] = safe_add(b, HASH[1]);
                HASH[2] = safe_add(c, HASH[2]);
                HASH[3] = safe_add(d, HASH[3]);
                HASH[4] = safe_add(e, HASH[4]);
                HASH[5] = safe_add(f, HASH[5]);
                HASH[6] = safe_add(g, HASH[6]);
                HASH[7] = safe_add(h, HASH[7]);
            }
            return HASH;
        }
        function str2binb (str) {
            var bin = Array();
            var mask = (1 << chrsz) - 1;
            for(var i = 0; i < str.length * chrsz; i += chrsz) {
                bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (24 - i%32);
            }
            return bin;
        }
        function Utf8Encode(string) {
            string = string.replace(/\r\n/g,"\n");
            var utftext = "";
            for (var n = 0; n < string.length; n++) {
                var c = string.charCodeAt(n);
                if (c < 128) {
                    utftext += String.fromCharCode(c);
                }
                else if((c > 127) && (c < 2048)) {
                    utftext += String.fromCharCode((c >> 6) | 192);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
                else {
                    utftext += String.fromCharCode((c >> 12) | 224);
                    utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                    utftext += String.fromCharCode((c & 63) | 128);
                }
          }
          return utftext;
        }
        function binb2hex (binarray) {
            var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
            var str = "";
            for(var i = 0; i < binarray.length * 4; i++) {
                str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
                hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF);
            }
            return str;
        }
        s = Utf8Encode(s);
        return binb2hex(core_sha256(str2binb(s), s.length * chrsz));
      }

      userinfo=await user.create({
        email : body.id,
        username : gitName,
        password : SHA256(body.login),
        profile : body.avatar_url        
      })
    }
    console.log(body.login)

    const accesstoken=jwt.sign({
      id:userinfo.id,
      email:userinfo.email,
      profile:userinfo.profile,
      username:userinfo.username,
      createdAt:userinfo.createdAt,
      updatedAt:userinfo.updatedAt,
      iat:Math.floor(Date.now() / 1000),
      exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
    },process.env.ACCESS_SECRET);

    const refreshtoken=jwt.sign({
      id:userinfo.id,
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

    if(!userinfo){
      res.status(400).send({message:"signUp or login failed"})
    } else {
      res.status(200).send({userinfo:userinfo, accessToken:accesstoken , message:"github login success"})
    }
  },

  GoogleLogin : async (req,res) => {
     let userinfo
     const body = req.body
     let findUser = await user.findOne({
       where:{
         username:body.username
       }
     })

     if(findUser){
       userinfo=findUser;
     }else{ //새로가입해야함
       userinfo=await user.create({
         username : body.username,
         email : body.email,
         profile : body.profile,
         password : SHA256(body.password)       
       })
     }

    const accesstoken=jwt.sign({
      id:userinfo.id,
      email:userinfo.email,
      profile:userinfo.profile,
      username:userinfo.username,
      createdAt:userinfo.createdAt,
      updatedAt:userinfo.updatedAt,
      iat:Math.floor(Date.now() / 1000),
      exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
    },process.env.ACCESS_SECRET);

    const refreshtoken=jwt.sign({
      id:userinfo.id,
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

    if(!userinfo){
      res.status(400).send({message : "cant login"})
    } else {
      res.status(200).send({userinfo:userinfo, accessToken:accesstoken , message:"google login success"})
    }

  },
  
  DeleteUser : async (req, res) => {
    let authorization = req.headers["authorization"];
    const accessToken=authorization.split(" ")[1]; //0번인덱스는 'Bearer' 1번이 토큰정보
    let userInfo;

    //1. 엑세스토큰이 유효한지 확인
    try{
      userInfo=jwt.verify(accessToken, process.env.ACCESS_SECRET);
    }catch(err){
      console.log(err);
    }

    //1-1. 엑세스 토큰이 만료되었을 때
    if(!userInfo){
      const cookieToken=req.cookies.refreshToken;
      console.log('cookietoken:'+cookieToken)
      if(!cookieToken){
        return res.json({data: null, message: 'refresh token not provided'})
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
    }

    //3. DB 조작
    const deleteUserInfo = await user.destroy({
      where : {
        username : userInfo.username
      }
    }).catch(err => {console.log(err)})

    //4. 응답
    if(!deleteUserInfo){
      res.status(404).send({message : "Not Delete"})
    } else {
      res.status(200).send({message : "Good!"})
    }
  },
  
  logout : async (req, res) => {
    res.clearCookie("refreshToken").send({message:"clear cookie"})
  },
  
  GetUserInfo : async (req, res) => {
    const body = req.body
    const UserInfo = await user.findOne({
      where : {
        username : body.username
      }
    }).catch(err => {console.log(err)})
    if(!UserInfo){
      res.status(404).send({message:"user doesn't exists"})
    } else {
      res.status(200).json({user:{id:UserInfo.id, email:UserInfo.email, username:UserInfo.username, profile:UserInfo.profile}})
    }
  },

  updateUserinfo : async (req, res) => {

    let authorization = req.headers["authorization"];
    const accessToken=authorization.split(" ")[1]; //0번인덱스는 'Bearer' 1번이 토큰정보
    let userInfo;

    //1. 엑세스토큰이 유효한지 확인
    const actokenverify = () => {
    try{
      return jwt.verify(accessToken, process.env.ACCESS_SECRET);
    }catch(err){
      console.log(err);
      return null
    }
  }

  userInfo=actokenverify();

    // 1-1. 엑세스 토큰이 만료되었을 때
    if(!userInfo){
      const cookieToken=req.cookies.refreshToken;
      // console.log('cookietoken:'+cookieToken)
      if(!cookieToken){
        return res.json({data: null, message: 'refresh token not provided'})
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
      userInfo.refreshToken = true
      if(!userInfo){
        return res.json({message:"refresh token invaild"})
      }
      
    }

    const body = req.body
    
      const result = await user.update({
        profile : body.profile,
        username : body.username,
        password : body.password
      },
      {
        where : {
        email:userInfo.email
      }
    }).catch(err => {console.log(err)})
      const userinfo = await user.findOne({
        where : {
          email : userInfo.email
        }
      }).catch(err=>{console.log(err)})
      if(userInfo.refreshToken){
        const accesstoken=jwt.sign({
          id:userInfo.id,
          email:userinfo.email,
          profile:userinfo.profile,
          username:userinfo.username,
          createdAt:userinfo.createdAt,
          updatedAt:userinfo.updatedAt,
          iat:Math.floor(Date.now() / 1000),
          exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
        },process.env.ACCESS_SECRET);
        userinfo.accessToken = accesstoken
      }

      if(result[0]!==1){
        res.status(400).send({message:"update failed"})
      } else {
        body.username = userinfo.username
        if(userInfo.refreshToken === true){
          res.status(200).send({message:"userinfo updated",username:userinfo.username,profile:userinfo.profile,accessToken:userinfo.accessToken})
        }else{
          res.status(200).send({message:"userinfo updated",username:userinfo.username,profile:userinfo.profile})
        }
      }
  },
  
  checkPassWord : async (req, res) => {
    let authorization = req.headers["authorization"];
    const accessToken=authorization.split(" ")[1]; //0번인덱스는 'Bearer' 1번이 토큰정보
    let userInfo;
    //1. 엑세스토큰이 유효한지 확인
    const actokenverify = () => {
    try{
      return jwt.verify(accessToken, process.env.ACCESS_SECRET);
    }catch(err){
      console.log(err);
      return null
    }
  }
  userInfo=actokenverify();
  // 1-1. 엑세스 토큰이 만료되었을 때
  if(!userInfo){
    const cookieToken=req.cookies.refreshToken;
    // console.log('cookietoken:'+cookieToken)
    if(!cookieToken){
      return res.json({data: null, message: 'refresh token not provided'})
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
    userInfo.refreshToken = true
    if(!userInfo){
      return res.json({message:"refresh token invaild"})
    }
  }
  const body = req.body
    const check = await user.findOne({
      where : {
        username : userInfo.username
      }
    }).catch(err=>{console.log(err)})
    if(userInfo.refreshToken){
      const accesstoken=jwt.sign({
        id:userInfo.id,
        email:check.email,
        profile:check.profile,
        username:check.username,
        createdAt:check.createdAt,
        updatedAt:check.updatedAt,
        iat:Math.floor(Date.now() / 1000),
        exp:Math.floor(Date.now() / 1000) + (60 * 60*24)
      },process.env.ACCESS_SECRET);
      check.accessToken = accesstoken
    } else {
      if(body.password===check.password){
        res.status(200).json({accessToken:check.accesstoken,message:"valid"})
      } else {
        res.status(422).send({message:"invalid"})
      }
    }
  }
}