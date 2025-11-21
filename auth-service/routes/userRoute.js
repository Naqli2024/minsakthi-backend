const express = require("express");
const router = express.Router();
const { getUserById, getAllUsers, editUser } = require("../controller/userController");
const userAuthMiddleware = require('../middleware/authMiddleware');

router.get("/getUserById/:id", getUserById);
router.get("/getAllUsers", getAllUsers);
router.put("/edit-user/:id", userAuthMiddleware, editUser);

module.exports = router;