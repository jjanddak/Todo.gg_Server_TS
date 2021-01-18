const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");

//GET /project/id
router.get("/:id", projectController.getOneProject);

//POST /project/newProject
router.post("/new", projectController.newProject);

module.exports = router;