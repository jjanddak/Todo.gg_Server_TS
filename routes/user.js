const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

//POST user/SignUp
router.post("/signup", userController.SignUp);

//POST user/CheckEmail
router.post("/checkEmail", userController.CheckEmail);

//POST user/CheckUsername
router.post("/checkUsername", userController.CheckUsername);

module.exports = router;