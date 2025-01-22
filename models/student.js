const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  username: {
    type: String,
    unique: true,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  hostel: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'student'
  },
  image: {
    type: String,
    default: '/images/default-profile.jpg'
  },
  leaves: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Leave"
    }
  ]
});

// Password hashing middleware
studentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Instance method to verify password
studentSchema.methods.verifyPassword = async function(password) {
  try {
    return await bcrypt.compare(password, this.password);
  } catch (err) {
    throw err;
  }
};

// Static method for authentication
studentSchema.statics.authenticate = async function(username, password) {
  try {
    const student = await this.findOne({ username });
    if (!student) {
      return { error: 'Student not found' };
    }

    const isValid = await student.verifyPassword(password);
    if (!isValid) {
      return { error: 'Invalid password' };
    }

    return { student };
  } catch (err) {
    return { error: err.message };
  }
};

// Add these static methods
studentSchema.statics.getUserByUsername = async function(username) {
  try {
    return await this.findOne({ username: username });
  } catch (err) {
    throw err;
  }
};

studentSchema.statics.getUserById = async function(id) {
  try {
    return await this.findById(id);
  } catch (err) {
    throw err;
  }
};

studentSchema.statics.comparePassword = async function(candidatePassword, hash) {
  try {
    return await bcrypt.compare(candidatePassword, hash);
  } catch (err) {
    throw err;
  }
};

module.exports = mongoose.model('Student', studentSchema);
