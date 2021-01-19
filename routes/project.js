const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");

//GET /project/id
router.get("/:id", projectController.getOneProject);

//POST /project/id/delete
router.post("/:id/delete", projectController.deleteProject);

module.exports = router;