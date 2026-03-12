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
const adminDocsDir = path.join(__dirname, '..', 'uploads', 'admin-docs');

[uploadsDir, profilePicsDir, workerDocsDir, adminDocsDir].forEach(dir => {
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

// File filter for worker verification documents — allows images AND PDFs
const docFileFilter = (req, file, cb) => {
  if (file.fieldname === 'profilePicture') {
    const allowed = /jpeg|jpg|png|webp/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Profile picture must be an image (JPEG, JPG, PNG, WEBP)'));
  }
  // ID documents: images and PDFs accepted
  const allowedExt = /jpeg|jpg|png|webp|pdf/;
  const allowedMime = /image\/(jpeg|jpg|png|webp)|application\/pdf/;
  if (allowedExt.test(path.extname(file.originalname).toLowerCase()) && allowedMime.test(file.mimetype)) {
    return cb(null, true);
  }
  cb(new Error('Documents must be images (JPEG, PNG, WEBP) or PDF files'));
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
  fileFilter: docFileFilter
});

// ── Admin ID document upload ──────────────────────────────────────────────────
const adminDocsStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, adminDocsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `admin-doc-${Date.now()}${ext}`);
  }
});

export const uploadAdminDoc = multer({
  storage: adminDocsStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: docFileFilter
}).single('idDocument');

export default upload;
