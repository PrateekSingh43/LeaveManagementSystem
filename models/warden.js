const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const wardenSchema = new mongoose.Schema({
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
  hostel: {
    type: String,
    required: true
  },
  type: {
    type: String,
    default: 'warden'
  },
  image: {
    type: String,
    default: '/images/default-profile.jpg'
  }
});

wardenSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Update the password verification method
wardenSchema.methods.verifyPassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (err) {
    throw err;
  }
};

// Add static authentication method
wardenSchema.statics.authenticate = async function(username, password) {
  const warden = await this.findOne({ username });
  if (!warden) {
    return { error: 'Warden not found' };
  }

  const isValid = await warden.verifyPassword(password);
  if (!isValid) {
    return { error: 'Invalid password' };
  }

  return { warden };
};

module.exports = mongoose.model('Warden', wardenSchema);
