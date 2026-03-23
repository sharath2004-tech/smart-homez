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
const expenseProofsDir = path.join(__dirname, '..', 'uploads', 'expense-proofs');

[uploadsDir, profilePicsDir, workerDocsDir, adminDocsDir, expenseProofsDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Shared regex patterns for file type validation (anchored for exact matching)
const IMAGE_EXTENSION_REGEX = /\.(jpeg|jpg|png|webp)$/i;
const IMAGE_MIME_REGEX = /^image\/(jpeg|png|webp)$/;
const DOC_EXTENSION_REGEX = /\.(jpeg|jpg|png|webp|pdf)$/i;
const DOC_MIME_REGEX = /^(image\/(jpeg|png|webp)|application\/pdf)$/;

// File filter to only allow images
const fileFilter = (req, file, cb) => {
  const extname = IMAGE_EXTENSION_REGEX.test(path.extname(file.originalname));
  const mimetype = IMAGE_MIME_REGEX.test(file.mimetype);
  if (extname && mimetype) return cb(null, true);
  cb(new Error('Only image files (JPEG, JPG, PNG, WEBP) are allowed!'));
};

// File filter for worker verification documents — allows images AND PDFs
const docFileFilter = (req, file, cb) => {
  if (file.fieldname === 'profilePicture') {
    if (IMAGE_EXTENSION_REGEX.test(path.extname(file.originalname)) && IMAGE_MIME_REGEX.test(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Profile picture must be an image (JPEG, JPG, PNG, WEBP)'));
  }
  // ID documents: images and PDFs accepted
  if (DOC_EXTENSION_REGEX.test(path.extname(file.originalname)) && DOC_MIME_REGEX.test(file.mimetype)) {
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

// ── Expense proof uploads (bills, product photos, receipts) ─────────────────
const expenseProofsStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, expenseProofsDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `expense-proof-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  }
});

export const uploadExpenseProofs = multer({
  storage: expenseProofsStorage,
  limits: { fileSize: 7 * 1024 * 1024 },
  fileFilter: docFileFilter
});

export default upload;
