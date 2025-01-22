const mongoose = require('mongoose');
const Hod = require('../models/hod');

async function cleanup() {
  try {
    await mongoose.connect('mongodb://localhost/LeaveApp');
    
    // Remove all HOD records (be careful with this in production!)
    await Hod.deleteMany({});
    
    console.log('Database cleaned successfully');
    process.exit(0);
  } catch (err) {
    console.error('Cleanup error:', err);
    process.exit(1);
  }
}

cleanup();
