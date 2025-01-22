const mongoose = require('mongoose');
const Hod = require('../models/hod');

async function createTestHod() {
  try {
    await mongoose.connect('mongodb://localhost/LeaveApp');
    
    // Clear existing HOD first
    await Hod.deleteMany({});
    
    const testHod = new Hod({
      name: 'Test HOD',
      username: 'testhod',
      password: 'password123',
      department: 'Computer Science',
      type: 'hod'
    });

    await testHod.save();
    console.log('Test HOD created successfully');
    console.log('Username: testhod');
    console.log('Password: password123');
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

createTestHod();
