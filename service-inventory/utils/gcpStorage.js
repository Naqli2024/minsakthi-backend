// gcpStorage.js
const { Storage } = require('@google-cloud/storage');
const path = require('path');

const keyPath = path.join(__dirname, '../config/serviceAccountKey.json');

const storage = new Storage({
  keyFilename: keyPath,
  projectId: 'minsakthi',
});

const bucketName = process.env.BUCKET_NAME || 'minsakthi_bucket-1';

// Get actual bucket instance
const bucket = storage.bucket(bucketName);

module.exports = { storage, bucket };