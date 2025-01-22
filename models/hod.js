const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const hodSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, default: 'hod' },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  department: { type: String, required: true },
  image: { type: String, default: '/images/default-profile.jpg' }
});

// Simplified password verification
hodSchema.methods.verifyPassword = async function(candidatePassword) {
  console.log('Verifying password:');
  console.log('Candidate:', candidatePassword);
  console.log('Stored hash:', this.password);
  const isMatch = await bcrypt.compare(candidatePassword, this.password);
  console.log('Match result:', isMatch);
  return isMatch;
};

// Pre-save middleware
hodSchema.pre('save', function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = bcrypt.genSaltSync(10);
  this.password = bcrypt.hashSync(this.password, salt);
  next();
});

const Hod = mongoose.model("Hod", hodSchema);
module.exports = Hod;
