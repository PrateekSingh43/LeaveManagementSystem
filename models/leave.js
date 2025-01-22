const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    subject: String,
    from: Date,
    to: Date,
    days: Number,
    status: {
      type: String,
      enum: ["pending", "approved", "denied"],
      default: "pending"
    },
    wardenstatus: {
      type: String,
      enum: ["pending", "approved", "denied"],
      default: "pending"
    },
    stud: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student"
      },
      username: String
    },
    wardenReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warden"
    },
    wardenReviewedAt: Date
  },
  { timestamps: {} }
);

module.exports = mongoose.model("Leave", leaveSchema);
