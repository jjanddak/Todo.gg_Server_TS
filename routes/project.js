const express = require("express");
const router = express.Router();
const projectController = require("../controllers/projectController");

//GET /project/id
router.get("/:id", projectController.getOneProject);

//POST /project/id/update
router.post("/:id/update", projectController.updateProject);

module.exports = router;