const multer = require('multer');
const { bucket } = require('../utils/gcpStorage');
const path = require('path');

const storage = multer.memoryStorage();

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  } 
});

const uploadFileToGCS = async (file, orderId) => {
  if (!file) return null;

  const folderPath = `orders/${orderId}/`;
  const fileName = folderPath + Date.now() + path.extname(file.originalname);
  const fileUpload = bucket.file(fileName);

  return new Promise((resolve, reject) => {
    const stream = fileUpload.createWriteStream({
      resumable: false,
      contentType: file.mimetype,
    });

    stream.on("error", (err) => reject(err));

    stream.on("finish", async () => {
      try {
        const [url] = await fileUpload.getSignedUrl({
          action: "read",
          expires: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year
        });
        resolve(url);
      } catch (err) {
        reject(err);
      }
    });

    stream.end(file.buffer);
  });
};

module.exports = { upload, uploadFileToGCS };