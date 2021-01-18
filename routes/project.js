const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");

//GET /project/id
router.get("/:id", projectController.getOneProject);

//POST/project/id/newTask
router.post("/:id/newTask", projectController.newTask)

module.exports = router;