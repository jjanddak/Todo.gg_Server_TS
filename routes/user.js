const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

//POST user/login
router.post("/login", userController.login);

//POST user/signUp
router.post("/signup", userController.SignUp);

//POST user/checkEmail
router.post("/checkEmail", userController.CheckEmail);

//POST user/checkUsername
router.post("/checkUsername", userController.CheckUsername);

//POST user/callback
router.post("/callback", userController.GitHub_SocialLogin);

//POST user/githubLogin
router.post("/githubLogin", userController.GitHub_SignUpNLogin);

module.exports = router;