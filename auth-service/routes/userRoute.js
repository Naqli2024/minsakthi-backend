const express = require("express");
const router = express.Router();
const {
  getUserById,
  getAllUsers,
  editUser,
  addNotification,
  updateNotificationReadStatus,
} = require("../controller/userController");
const userAuthMiddleware = require("../middleware/authMiddleware");

router.get("/getUserById/:id", getUserById);
router.get("/getAllUsers", getAllUsers);
router.put("/edit-user/:id", userAuthMiddleware, editUser);
router.put("/users/:userId/notifications", addNotification);
router.patch(
  "/users/:userId/notifications/:notificationId",
  updateNotificationReadStatus
);

module.exports = router;
