const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");

//GET /project/id
router.get("/:id", projectController.getOneProject);

//POST /project/id/update
router.post("/:id/update", projectController.updateProject);

//POST /project/newProject
router.post("/new", projectController.newProject);

//POST /project/id/newTask
router.post("/:id/newTask", projectController.newTask);

//POST /project/:id/updateTask
router.post("/:id/updateTask", projectController.updateTask); 

//POST /project/:id/deleteContributer
router.post("/:id/deleteContributer", projectController.deleteContributer);

//POST /project/:id/deleteTask
router.post("/:id/deleteTask", projectController.deleteTaskCard);

module.exports = router;