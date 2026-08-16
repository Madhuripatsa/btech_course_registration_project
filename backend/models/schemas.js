const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  rollNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  passwordSalt: { type: String, required: true, select: false },
  department: { type: String, required: true },
  semester: { type: String, required: true },
  registeredCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  loginCount: { type: Number, default: 0 },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true });

const CourseSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  title: { type: String, required: true, trim: true },
  instructor: { type: String, required: true, trim: true },
  credits: { type: Number, required: true, min: 1, max: 8 },
  department: { type: String, required: true },
  capacity: { type: Number, required: true, min: 1 },
  schedule: { type: String, required: true },
  room: { type: String, required: true },
  prerequisite: { type: String, default: '' }
}, { timestamps: true });

module.exports = {
  Student: mongoose.model('Student', StudentSchema),
  Course: mongoose.model('Course', CourseSchema)
};
