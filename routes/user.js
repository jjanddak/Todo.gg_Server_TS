const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");

//GET user/login
router.get("/login", userController.login);

module.exports = router;