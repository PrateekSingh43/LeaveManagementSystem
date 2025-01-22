const mongoose = require('mongoose');
const Hod = require('../models/hod');

async function verifyHod() {
  try {
    await mongoose.connect('mongodb://localhost/LeaveApp');
    
    const hod = await Hod.findOne({ username: 'testhod' });
    console.log('HOD found:', hod ? 'yes' : 'no');
    
    if (hod) {
      console.log('HOD details:');
      console.log('Name:', hod.name);
      console.log('Username:', hod.username);
      console.log('Department:', hod.department);
      console.log('Password hash:', hod.password);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

verifyHod();
