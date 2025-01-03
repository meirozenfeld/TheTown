// 3. settingsController.js (New controller for handling API logic)
let gameSettings = {};

const saveSettings = (req, res) => {
  const settings = req.body;
  if (!settings) {
    return res.status(400).json({ error: 'Missing settings' });
  }

  gameSettings = settings; // שמירת ההגדרות בזיכרון
  console.log('Settings saved:', gameSettings);

  res.status(200).json({ message: 'Settings saved successfully' });
};

const getSettings = () => gameSettings;

module.exports = { saveSettings, getSettings };
