const fs = require('fs');
const path = require('path');
const https = require('https');

const MODELS_DIR = path.join(__dirname, '../public/models');
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

const GITHUB_REPO = 'https://raw.githubusercontent.com/vladmandic/face-api/master/model/';

const models = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
];

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`Exists: ${path.basename(dest)}`);
      return resolve();
    }
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(`Failed to download ${url}: ${response.statusCode}`);
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log(`Downloaded: ${path.basename(dest)}`);
          resolve();
        });
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err.message);
    });
  });
};

const main = async () => {
  for (const model of models) {
    try {
      await downloadFile(GITHUB_REPO + model, path.join(MODELS_DIR, model));
    } catch (e) {
      console.error(e);
    }
  }
  console.log('Done downloading models.');
};

main();
