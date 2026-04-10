import multer from 'multer';
import path from 'path';

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

// All multer instances use in-memory storage.
// Files are streamed directly to Cloudinary in each route handler.
const memoryStorage = multer.memoryStorage();

// ── Booking completion photo upload ──────────────────────────────────────────
const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter,
});

// ── Worker registration file upload (profile pic + Aadhaar documents) ────────
export const uploadWorkerFiles = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: docFileFilter,
});

// ── Generic profile picture upload for self-service profile updates ─────────
export const uploadProfilePicture = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: fileFilter,
}).single('profilePicture');

// ── Admin ID document upload ──────────────────────────────────────────────────
export const uploadAdminDoc = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: docFileFilter,
}).single('idDocument');

// ── Expense proof uploads (bills, product photos, receipts) ─────────────────
export const uploadExpenseProofs = multer({
  storage: memoryStorage,
  limits: { fileSize: 7 * 1024 * 1024 },
  fileFilter: docFileFilter,
});

export default upload;
