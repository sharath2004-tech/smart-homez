import fs from 'fs';
import multer from 'multer';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create uploads directories if they don't exist
const uploadsDir = path.join(__dirname, '..', 'uploads', 'completion-photos');
const profilePicsDir = path.join(__dirname, '..', 'uploads', 'profile-pics');
const workerDocsDir = path.join(__dirname, '..', 'uploads', 'worker-docs');

[uploadsDir, profilePicsDir, workerDocsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// File filter to only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error('Only image files (JPEG, JPG, PNG, WEBP) are allowed!'));
};

// ── Booking completion photo upload ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const bookingId = req.params.id || 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `booking-${bookingId}-${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter
});

// ── Worker registration file upload (profile pic + Aadhaar documents) ────────
const workerFilesStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, file.fieldname === 'profilePicture' ? profilePicsDir : workerDocsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${Date.now()}${ext}`);
  }
});

export const uploadWorkerFiles = multer({
  storage: workerFilesStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter
});

export default upload;
