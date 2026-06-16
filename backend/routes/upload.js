const express = require('express');
const router = express.Router();
const multer = require('multer');
const http = require('http');
const https = require('https');
const PDFDocument = require('pdfkit');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const { protect } = require('./auth');
const Class = require('../models/Class');

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Setup Multer Storage for Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: async (req, file) => {
    let folder = 'coaching_materials';
    let resource_type = 'auto'; // automatically detect if image or video

    // PDFs and PPTs must be uploaded as 'raw' to get a real download URL
    const isDocument = [
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ].includes(file.mimetype);

    if (isDocument) {
      resource_type = 'raw';
    }

    return {
      folder: folder,
      resource_type: resource_type,
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    };
  },
});

const upload = multer({ storage: storage });

const fetchBuffer = (url) => new Promise((resolve, reject) => {
  const client = url.startsWith('https') ? https : http;

  client.get(url, (response) => {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      reject(new Error(`Could not fetch image. Status: ${response.statusCode}`));
      response.resume();
      return;
    }

    const chunks = [];
    response.on('data', (chunk) => chunks.push(chunk));
    response.on('end', () => resolve(Buffer.concat(chunks)));
  }).on('error', reject);
});

const createNotesPdf = async (snapshots, title) => new Promise(async (resolve, reject) => {
  try {
    const document = new PDFDocument({
      autoFirstPage: false,
      compress: true,
      margin: 36,
      size: 'A4',
    });
    const chunks = [];

    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    document.info.Title = `${title} - Whiteboard Notes`;

    for (const [index, snapshot] of snapshots.entries()) {
      const imageBuffer = await fetchBuffer(snapshot.url);

      document.addPage();
      document
        .fontSize(11)
        .fillColor('#475569')
        .text(`${title} - Page ${index + 1}`, 36, 22, { align: 'center' });

      document.image(imageBuffer, 36, 52, {
        fit: [
          document.page.width - 72,
          document.page.height - 88,
        ],
        align: 'center',
        valign: 'top',
      });
    }

    document.end();
  } catch (err) {
    reject(err);
  }
});

const createWhiteboardPdf = (imageData, title) => new Promise((resolve, reject) => {
  try {
    const matches = imageData.match(/^data:image\/png;base64,(.+)$/);
    if (!matches) {
      reject(new Error('Invalid PNG image data'));
      return;
    }

    const imageBuffer = Buffer.from(matches[1], 'base64');
    const document = new PDFDocument({
      autoFirstPage: false,
      compress: true,
      margin: 36,
      size: 'A4',
    });
    const chunks = [];

    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);

    document.info.Title = `${title} - Whiteboard PDF`;
    document.addPage();
    document
      .fontSize(11)
      .fillColor('#475569')
      .text(`${title} - Whiteboard`, 36, 22, { align: 'center' });

    document.image(imageBuffer, 36, 52, {
      fit: [
        document.page.width - 72,
        document.page.height - 88,
      ],
      align: 'center',
      valign: 'top',
    });

    document.end();
  } catch (err) {
    reject(err);
  }
});

const getCloudinaryResourceType = (fileType = '') => {
  if (fileType === 'whiteboard-snapshot' || fileType === 'image') return 'image';
  if (fileType === 'pdf' || fileType === 'ppt' || fileType === 'whiteboard-notes-pdf' || fileType === 'raw') return 'raw';
  return 'auto';
};

// @route POST /api/upload/material/:classId
// @desc Upload a material (PPT/PDF/Image) for a specific class
router.post('/material/:classId', protect, upload.single('file'), async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Only teachers can upload materials' });
    }

    const classObj = await Class.findById(req.params.classId);
    if (!classObj) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (classObj.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only upload materials for your own classes' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Normalize file properties coming from multer-storage-cloudinary
    const publicId = req.file.publicId || req.file.filename || req.file.public_id || req.file.publicname || '';
    const mimetype = req.file.mimetype || '';
    const filename = req.file.originalname || req.file.originalName || req.file.filename || '';
    const newMaterial = {
      url: req.file.path,
      publicId: publicId,
      filename: filename,
      fileType: mimetype.includes('pdf')
        ? 'pdf'
        : (mimetype.includes('image')
          ? 'image'
          : (mimetype.includes('presentation') || mimetype.includes('powerpoint')
            ? 'ppt'
            : 'raw'
          )
        )
    };

    classObj.materials.push(newMaterial);
    await classObj.save();

    res.json({ success: true, material: newMaterial, class: classObj });
  } catch (err) {
    console.error('Upload error:', err && err.stack ? err.stack : err);
    // Return error message for easier debugging during development
    res.status(500).json({ success: false, message: 'Upload failed', error: err && err.message ? err.message : String(err) });
  }
});

// @route DELETE /api/upload/material/:classId/:materialId
// @desc Delete an uploaded material/notes file from a teacher-owned class
router.delete('/material/:classId/:materialId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Only teachers can delete materials' });
    }

    const classObj = await Class.findById(req.params.classId);
    if (!classObj) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (classObj.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only delete materials from your own classes' });
    }

    const material = classObj.materials.id(req.params.materialId);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material not found' });
    }

    const deletedMaterial = material.toObject();
    material.deleteOne();
    await classObj.save();

    if (deletedMaterial.publicId) {
      try {
        await cloudinary.uploader.destroy(deletedMaterial.publicId, {
          resource_type: getCloudinaryResourceType(deletedMaterial.fileType),
        });
      } catch (cloudinaryErr) {
        console.warn('Cloudinary material delete warning:', cloudinaryErr.message || cloudinaryErr);
      }
    }

    res.json({ success: true, material: deletedMaterial, class: classObj });
  } catch (err) {
    console.error('Delete material error:', err);
    res.status(500).json({ success: false, message: 'Could not delete material' });
  }
});

// @route POST /api/upload/whiteboard/:classId
// @desc Save the current whiteboard as an image material for students
router.post('/whiteboard/:classId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Only teachers can save whiteboard snapshots' });
    }

    const { imageData, filename } = req.body;
    if (!imageData || !imageData.startsWith('data:image/png;base64,')) {
      return res.status(400).json({ success: false, message: 'A PNG whiteboard image is required' });
    }

    const classObj = await Class.findById(req.params.classId);
    if (!classObj) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (classObj.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only save snapshots for your own classes' });
    }

    const safeFilename = filename?.trim() || `whiteboard-${Date.now()}.png`;
    const uploadResult = await cloudinary.uploader.upload(imageData, {
      folder: 'coaching_whiteboards',
      resource_type: 'image',
      public_id: `${req.params.classId}-${Date.now()}`,
    });

    const newMaterial = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      filename: safeFilename,
      fileType: 'whiteboard-snapshot'
    };

    classObj.materials.push(newMaterial);
    await classObj.save();

    res.json({ success: true, material: newMaterial, class: classObj });
  } catch (err) {
    console.error('Whiteboard snapshot upload error:', err);
    res.status(500).json({ success: false, message: 'Could not save whiteboard snapshot' });
  }
});

// @route POST /api/upload/whiteboard-pdf/:classId
// @desc Save the current whiteboard canvas directly as a PDF material
router.post('/whiteboard-pdf/:classId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Only teachers can save whiteboard PDFs' });
    }

    const { imageData, filename } = req.body;
    if (!imageData || !imageData.startsWith('data:image/png;base64,')) {
      return res.status(400).json({ success: false, message: 'A PNG whiteboard image is required' });
    }

    const classObj = await Class.findById(req.params.classId);
    if (!classObj) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (classObj.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only save PDFs for your own classes' });
    }

    const pdfBuffer = await createWhiteboardPdf(imageData, classObj.topic || 'Class');
    const base64Pdf = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
    const timestamp = Date.now();
    const safeFilename = filename?.trim() || `${classObj.topic || 'class'}-whiteboard-${timestamp}.pdf`;
    const uploadResult = await cloudinary.uploader.upload(base64Pdf, {
      folder: 'coaching_whiteboard_notes',
      resource_type: 'raw',
      public_id: `${req.params.classId}-whiteboard-${timestamp}`,
      format: 'pdf',
    });

    const newMaterial = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      filename: safeFilename,
      fileType: 'whiteboard-notes-pdf'
    };

    classObj.materials.push(newMaterial);
    await classObj.save();

    res.json({ success: true, material: newMaterial, class: classObj });
  } catch (err) {
    console.error('Whiteboard PDF upload error:', err);
    res.status(500).json({ success: false, message: 'Could not save whiteboard PDF' });
  }
});

// @route POST /api/upload/whiteboard-notes/:classId
// @desc Generate one PDF notes file from saved whiteboard snapshots
router.post('/whiteboard-notes/:classId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Only teachers can generate class notes' });
    }

    const classObj = await Class.findById(req.params.classId);
    if (!classObj) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    if (classObj.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'You can only generate notes for your own classes' });
    }

    const snapshots = classObj.materials.filter((material) => material.fileType === 'whiteboard-snapshot');
    if (!snapshots.length) {
      return res.status(400).json({ success: false, message: 'Save at least one whiteboard snapshot before generating PDF notes' });
    }

    const pdfBuffer = await createNotesPdf(snapshots, classObj.topic);
    const base64Pdf = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`;
    const timestamp = Date.now();
    const uploadResult = await cloudinary.uploader.upload(base64Pdf, {
      folder: 'coaching_whiteboard_notes',
      resource_type: 'raw',
      public_id: `${req.params.classId}-notes-${timestamp}`,
      format: 'pdf',
    });

    const newMaterial = {
      url: uploadResult.secure_url,
      publicId: uploadResult.public_id,
      filename: `${classObj.topic || 'class'}-whiteboard-notes.pdf`,
      fileType: 'whiteboard-notes-pdf'
    };

    classObj.materials.push(newMaterial);
    await classObj.save();

    res.json({ success: true, material: newMaterial, class: classObj });
  } catch (err) {
    console.error('Whiteboard notes PDF error:', err);
    res.status(500).json({ success: false, message: 'Could not generate whiteboard notes PDF' });
  }
});

module.exports = router;
