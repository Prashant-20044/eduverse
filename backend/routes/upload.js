const express = require('express');
const router = express.Router();
const multer = require('multer');
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
    let resource_type = 'auto'; // automatically detect if image or video/raw
    
    // For PPTs/PDFs, they might be handled as raw or image (if PDF)
    if (file.mimetype === 'application/pdf') {
      resource_type = 'image'; // Cloudinary can convert PDF pages to images
    }

    return {
      folder: folder,
      resource_type: resource_type,
      public_id: `${Date.now()}-${file.originalname.split('.')[0]}`,
    };
  },
});

const upload = multer({ storage: storage });

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

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const newMaterial = {
      url: req.file.path,
      publicId: req.file.filename,
      filename: req.file.originalname,
      type: req.file.mimetype.includes('pdf') ? 'pdf' : (req.file.mimetype.includes('image') ? 'image' : 'raw')
    };

    classObj.materials.push(newMaterial);
    await classObj.save();

    res.json({ success: true, material: newMaterial, class: classObj });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

module.exports = router;
