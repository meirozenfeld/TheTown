// 4. settings.js (New API route file)
const express = require('express');
const { saveSettings, getSettings } = require('../controllers/settingsController');

const router = express.Router();

router.post('/api/settings', saveSettings);
router.get('/api/settings', getSettings);

module.exports = router;
