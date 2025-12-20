const User = require("../models/userModel");
const { storage } = require("../utils/gcpStorage");
const bucketName = process.env.BUCKET_NAME;
const mongoose = require('mongoose');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find();
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No user found",
      });
    }
    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.log("Server error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      console.error("getUserById: Invalid userId:", id);
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

exports.editUser = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    const updateData = { ...req.body };

    // Prevent emailAddress or phoneNumber from being updated
    delete updateData.emailAddress;
    delete updateData.phoneNumber;

    // Allow alternateNumber if provided
    if (req.body.alternateNumber) {
      updateData.alternateNumber = req.body.alternateNumber;
    }

    // Ensure profile field is not sent as string
    if (typeof updateData.profile === "string") {
      delete updateData.profile;
    }

    // Handle profile image upload
    if (req.files && req.files.profile) {
      const file = req.files.profile;

      const blob = storage.bucket(bucketName).file(Date.now() + "-" + file.name);

      const blobStream = blob.createWriteStream({ resumable: false });

      await new Promise((resolve, reject) => {
        blobStream.on("finish", resolve);
        blobStream.on("error", reject);
        blobStream.end(file.data);
      });

      updateData.profile = {
        imageUrl: `https://storage.googleapis.com/${bucketName}/${blob.name}`,
        fileName: file.name,
        uploadedAt: new Date(),
      };
    }

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

     // ADD NOTIFICATION
    await User.findByIdAndUpdate(userId, {
      $push: {
        notifications: {
          title: "Profile Updated",
          message: "Your profile information has been updated successfully.",
          createdAt: new Date(),
          isRead: false
        }
      }
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (err) {
    console.error("Edit user error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addNotification = async (req, res) => {
  try {
    const { userId } = req.params;

    await User.findByIdAndUpdate(
      userId,
      {
        $push: {
          notifications: {
            title: req.body.title,
            message: req.body.message,
            createdAt: req.body.createdAt,
            isRead: false,
          },
        },
      },
      { new: true }
    );

    res.json({ success: true, message: "Notification added" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.updateNotificationReadStatus = async (req, res) => {
  try {
    const { userId, notificationId } = req.params;
    const { isRead } = req.body;

    if (!userId || !notificationId) {
      return res.status(400).json({
        success: false,
        message: "User ID and Notification ID are required",
      });
    }

    if (typeof isRead === "undefined") {
      return res.status(400).json({
        success: false,
        message: "isRead value is required",
      });
    }

    const readStatus = isRead === true || isRead === "true";

    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        "notifications._id": notificationId,
      },
      {
        $set: {
          "notifications.$.isRead": readStatus,
        },
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Notification read status updated successfully",
      data: user.notifications,
    });
  } catch (error) {
    console.error("Update notification read error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};