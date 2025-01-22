const express = require("express");
const mongoose = require("mongoose");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const session = require("express-session");
const flash = require("connect-flash");
const methodOverride = require("method-override");
const bodyparser = require("body-parser");
const moment = require("moment");
const path = require('path'); // Add this line
const { body, validationResult, check } = require('express-validator');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcryptjs'); // Add bcrypt to the top with other imports

// Models
const Student = require("./models/student");
const Warden = require("./models/warden");
const Hod = require("./models/hod");
const Leave = require("./models/leave");

const app = express();

// Basic middleware setup
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, 'public')));

// Session configuration - MUST come before passport
app.use(session({
  secret: "your-secret-key-here",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost/LeaveApp',
    ttl: 24 * 60 * 60 // 1 day
  }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1 day
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  }
}));

// Flash messages - after session, before passport
app.use(flash());

// Passport initialization - after session
app.use(passport.initialize());
app.use(passport.session());

// Global variables middleware - after all auth middleware
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.error = req.flash('error') || null;
  res.locals.success = req.flash('success') || null;
  next();
});

// Database connection - update to remove deprecated options
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/LeaveApp')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Add this error handling middleware before your routes
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.error = req.flash("error");
  res.locals.success = req.flash("success");
  next();
});

// Add proper error handling for async routes
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Add this after your existing middleware setup
app.use((req, res, next) => {
  res.locals.currentUser = req.user || null;
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');
  next();
});

// Authentication middleware
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash("error", "You need to be logged in");
  if (req.path.startsWith('/hod')) {
    return res.redirect("/hod/login");
  } else if (req.path.startsWith('/warden')) {
    return res.redirect("/warden/login");
  }
  res.redirect("/student/login");
}

app.get("/", (req, res) => {
  res.render("home");
});

// Add this near the top of your routes
app.get('/debug/views', (req, res) => {
  const path = require('path');
  const fs = require('fs');
  const viewsPath = path.join(__dirname, 'views');
  
  try {
    const files = fs.readdirSync(viewsPath);
    res.json({
      viewsDirectory: viewsPath,
      files: files,
      partials: fs.readdirSync(path.join(viewsPath, 'partial'))
    });
  } catch (err) {
    res.json({ error: err.message });
  }
});

//login logic for Student

//login logic for Hod

//registration form
app.get("/register", (req, res) => {
  res.render("register");
});

// Update validation middleware
const registerValidation = [
  check('name').notEmpty().withMessage('Name is required'),
  check('username').notEmpty().withMessage('Username is required')
    .custom(async (value) => {
      const existingUser = await Student.findOne({ username: value });
      if (existingUser) {
        throw new Error('Username already exists');
      }
    })
    .custom(async (value, { req }) => {
      if (req.body.type === 'hod') {
        const existingHod = await Hod.findOne({ username: value });
        if (existingHod) {
          throw new Error('An HOD with this username already exists');
        }
      }
    }),
  check('password').notEmpty().withMessage('Password is required')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  check('password2').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),
  check('type').notEmpty().withMessage('Type is required'),
  check('department').custom((value, { req }) => {
    if (req.body.type === 'student' || req.body.type === 'hod') {
      if (!value) throw new Error('Department is required');
    }
    return true;
  }),
  check('hostel').custom((value, { req }) => {
    if (req.body.type === 'student' || req.body.type === 'warden') {
      if (!value) throw new Error('Hostel is required');
    }
    return true;
  })
];

// Update the registration logic to handle warden registration
app.post("/student/register", registerValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render("register", { errors: errors.array() });
    }

    const { type, name, username, password, department, hostel, image } = req.body;

    if (type === "warden") {
      // Check if warden with same username exists
      const existingWarden = await Warden.findOne({ username });
      if (existingWarden) {
        req.flash("error", "Username already exists");
        return res.redirect("/register");
      }

      const newWarden = new Warden({
        name,
        username,
        password,
        hostel,
        type: 'warden',
        image: image || '/images/default-profile.jpg'
      });

      try {
        await newWarden.save();
        req.flash("success", "Warden registered successfully");
        return res.redirect("/warden/login");
      } catch (err) {
        console.error("Warden registration error:", err);
        req.flash("error", "Registration failed");
        return res.redirect("/register");
      }
    } else if (type === "hod") {
      // ... existing HOD registration code ...
    } else {
      // Handle student registration
      const newStudent = new Student({
        name,
        username,
        password,
        department,
        hostel,
        type: 'student',
        image: image || '/images/default-profile.jpg'
      });

      try {
        await newStudent.save();
        req.flash("success", "Student registered successfully");
        return res.redirect("/student/login");
      } catch (err) {
        console.error("Student registration error:", err);
        req.flash("error", "Registration failed");
        return res.redirect("/register");
      }
    }
  } catch (err) {
    console.error("Registration error:", err);
    req.flash("error", "Registration failed");
    res.redirect("/register");
  }
});

//stratergies
passport.use(
  "student",
  new LocalStrategy(async (username, password, done) => {
    try {
      const student = await Student.getUserByUsername(username);
      if (!student) {
        return done(null, false, { message: "Unknown User" });
      }
      
      const passwordFound = await Student.comparePassword(password, student.password);
      if (passwordFound) {
        return done(null, student);
      } else {
        return done(null, false, { message: "Invalid Password" });
      }
    } catch (err) {
      return done(err);
    }
  })
);

// Fix the HOD strategy implementation
passport.use('hod', new LocalStrategy(async (username, password, done) => {
  try {
    // Find HOD directly using mongoose
    const hod = await Hod.findOne({ username: username });
    
    if (!hod) {
      return done(null, false, { message: 'Unknown HOD username' });
    }

    // Use the instance method to verify password
    const isValid = await hod.verifyPassword(password);
    
    if (!isValid) {
      return done(null, false, { message: 'Invalid password' });
    }

    return done(null, hod);
  } catch (err) {
    console.error('HOD Login Error:', err);
    return done(err);
  }
}));

// Update the warden passport strategy
passport.use('warden', new LocalStrategy(async (username, password, done) => {
  try {
    const result = await Warden.authenticate(username, password);
    
    if (result.error) {
      return done(null, false, { message: result.error });
    }
    
    return done(null, result.warden);
  } catch (err) {
    console.error('Warden Login Error:', err);
    return done(err);
  }
}));

// Update student strategy - remove the duplicate strategy
passport.use('student', new LocalStrategy(async (username, password, done) => {
  try {
    const result = await Student.authenticate(username, password);
    
    if (result.error) {
      return done(null, false, { message: result.error });
    }
    
    return done(null, result.student);
  } catch (err) {
    console.error('Student Login Error:', err);
    return done(err);
  }
}));

// Fix the serialize/deserialize functions - Remove duplicate deserializeUser
passport.serializeUser((user, done) => {
  done(null, { id: user._id, type: user.type });
});

passport.deserializeUser(async function(obj, done) {
  try {
    let user = null;
    switch (obj.type) {
      case "student":
        user = await Student.findById(obj.id);
        break;
      case "hod":
        user = await Hod.findById(obj.id);
        break;
      case "warden":
        user = await Warden.findById(obj.id);
        break;
      default:
        return done(new Error("Invalid user type: " + obj.type), null);
    }
    
    if (!user) {
      return done(null, false);
    }
    
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

app.get("/student/login", (req, res) => {
  res.render("login", { 
    error: req.flash('error'),
    success: req.flash('success')
  });
});

// Update student login route
app.post("/student/login", (req, res, next) => {
  passport.authenticate('student', (err, user, info) => {
    if (err) {
      console.error('Student auth error:', err);
      req.flash('error', 'Authentication error');
      return res.redirect('/student/login');
    }
    
    if (!user) {
      req.flash('error', info ? info.message : 'Invalid credentials');
      return res.redirect('/student/login');
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        req.flash('error', 'Login error');
        return res.redirect('/student/login');
      }
      
      return res.redirect('/student/home');
    });
  })(req, res, next);
});

// Add student home route
app.get("/student/home", ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user || req.user.type !== 'student') {
      req.flash('error', 'Unauthorized access');
      return res.redirect('/student/login');
    }

    const student = await Student.findById(req.user._id).populate('leaves');
    if (!student) {
      req.flash('error', 'Student not found');
      return res.redirect('/student/login');
    }

    res.render("homestud", { 
      student: student,
      moment: moment
    });
  } catch (err) {
    console.error('Student Home Error:', err);
    req.flash('error', 'Error accessing student home');
    res.redirect('/student/login');
  }
});

app.get("/student/:id", ensureAuthenticated, async (req, res) => {
  try {
    const foundStudent = await Student.findById(req.params.id).populate("leaves");
    if (!foundStudent) {
      req.flash("error", "Student not found");
      return res.redirect("back");
    }
    res.render("profilestud", { student: foundStudent });
  } catch (err) {
    req.flash("error", "Student not found");
    res.redirect("back");
  }
});

app.get("/student/:id/edit", ensureAuthenticated, async (req, res) => {
  try {
    const foundStudent = await Student.findById(req.params.id);
    res.render("editS", { student: foundStudent });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("back");
  }
});

app.put("/student/:id", ensureAuthenticated, async (req, res) => {
  try {
    await Student.findByIdAndUpdate(req.params.id, req.body.student);
    req.flash("success", "Successfully updated");
    res.redirect("/student/" + req.params.id);
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("back");
  }
});

app.get("/student/:id/apply", ensureAuthenticated, async (req, res) => {
  try {
    const foundStud = await Student.findById(req.params.id);
    if (!foundStud) {
      throw new Error("Student not found");
    }
    res.render("leaveApply", { student: foundStud });
  } catch (err) {
    console.log(err);
    res.redirect("back");
  }
});

app.post("/student/:id/apply", async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate("leaves");
    if (!student) {
      return res.redirect("/student/home");
    }

    // Date calculations
    const date = new Date(req.body.leave.from);
    const todate = new Date(req.body.leave.to);
    req.body.leave.days = todate.getDate() - date.getDate();

    const newLeave = await Leave.create(req.body.leave);
    newLeave.stud.id = req.user._id;
    newLeave.stud.username = req.user.username;
    await newLeave.save();

    student.leaves.push(newLeave);
    await student.save();

    req.flash("success", "Successfully applied for leave");
    res.render("homestud", { student: student, moment: moment });
  } catch (err) {
    req.flash("error", "Something went wrong");
    res.redirect("back");
  }
});

app.get("/student/:id/track", async (req, res) => {
  try {
    const foundStud = await Student.findById(req.params.id).populate("leaves");
    if (!foundStud) {
      req.flash("error", "No student with requested id");
      return res.redirect("back");
    }
    res.render("trackLeave", { student: foundStud, moment: moment });
  } catch (err) {
    req.flash("error", "Error finding student");
    res.redirect("back");
  }
});

// Update HOD login routes
app.get("/hod/login", (req, res) => {
  res.render("hodlogin", { 
    error: req.flash('error'),
    success: req.flash('success')
  });
});

app.post("/hod/login", async (req, res, next) => {
  // Clear any existing session first
  req.logout((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    // Continue with login
    passport.authenticate('hod', (err, user, info) => {
      if (err) return next(err);
      
      if (!user) {
        req.flash('error', info.message || 'Invalid credentials');
        return res.redirect('/hod/login');
      }

      req.logIn(user, (err) => {
        if (err) return next(err);
        return res.redirect('/hod/home');
      });
    })(req, res, next);
  });
});

app.get("/hod/home", ensureAuthenticated, (req, res) => {
  console.log('User:', req.user);
  if (!req.user || req.user.type !== 'hod') {
    req.flash('error', 'Unauthorized');
    return res.redirect('/hod/login');
  }
  
  res.render("homehod", { 
    hod: req.user,
    moment: moment
  });
});

app.get("/hod/:id", ensureAuthenticated, async (req, res) => {
  try {
    const foundHod = await Hod.findById(req.params.id);
    if (!foundHod) {
      req.flash("error", "Hod not found");
      return res.redirect("back");
    }
    res.render("profilehod", { hod: foundHod });
  } catch (err) {
    req.flash("error", "Hod not found");
    res.redirect("back");
  }
});

app.get("/hod/:id/edit", ensureAuthenticated, async (req, res) => {
  try {
    const foundHod = await Hod.findById(req.params.id);
    if (!foundHod) {
      req.flash("error", "HOD not found");
      return res.redirect("back");
    }
    res.render("editH", { hod: foundHod });
  } catch (err) {
    if (err.code === 11000) {
      req.flash('error', 'Username already exists');
    } else {
      req.flash('error', err.message || 'An error occurred');
    }
    res.redirect("back");
  }
});

// Update route for HOD
app.put("/hod/:id", ensureAuthenticated, async (req, res) => {
  try {
    const updatedHod = await Hod.findByIdAndUpdate(
      req.params.id, 
      req.body.hod, 
      { new: true, runValidators: true }
    );
    
    if (!updatedHod) {
      req.flash("error", "HOD not found");
      return res.redirect("back");
    }

    req.flash("success", "Profile updated successfully");
    res.redirect(`/hod/${req.params.id}`);
  } catch (err) {
    if (err.code === 11000) {
      req.flash('error', 'Username already exists');
    } else {
      req.flash('error', err.message || 'Error updating profile');
    }
    res.redirect("back");
  }
});

app.get("/hod/:id/edit", ensureAuthenticated, async (req, res) => {
  try {
    const foundHod = await Hod.findById(req.params.id);
    res.render("editH", { hod: foundHod });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("back");
     req.flash('error', Object.values(err.errors).map(e => e.message).join(', '));
    return res.redirect('back');
  }
  
  if (err.code === 11000) {
    req.flash('error', 'Username already exists');
    return res.redirect('back');
  }
  
  req.flash('error', 'Something went wrong');
  res.redirect('/');
});

// HOD Routes
app.get("/hod/home", ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user || req.user.type !== 'hod') {
      req.flash('error', 'Unauthorized access');
      return res.redirect('/hod/login');
    }
    res.render("homehod", { 
      hod: req.user,
      moment: moment 
    });
  } catch (err) {
    console.error('HOD Home Error:', err);
    req.flash('error', 'Error accessing HOD home');
    res.redirect('/hod/login');
  }
});

app.get("/hod/:id/leave", ensureAuthenticated, async (req, res) => {
  try {
    const hod = await Hod.findById(req.params.id);
    if (!hod) {
      req.flash("error", "HOD not found");
      return res.redirect("back");
    }

    const students = await Student.find({ department: hod.department })
      .populate({
        path: 'leaves',
        match: { status: { $in: ['pending', 'approved', 'denied'] } }
      });

    res.render("hodLeaveSign", {
      hod: hod,
      students: students,
      moment: moment
    });
  } catch (err) {
    console.error("Leave list error:", err);
    req.flash("error", "Error loading leave requests");
    res.redirect("/hod/home");
  }
});

// Replace the existing route
app.get("/hod/:id/leave/:stud_id/info", ensureAuthenticated, async (req, res) => {
  try {
    const hod = await Hod.findById(req.params.id);
    const student = await Student.findById(req.params.stud_id)
      .populate({
        path: 'leaves',
        match: { status: 'pending' }
      });
    
    if (!hod || !student) {
      req.flash('error', 'Invalid request');
      return res.redirect('back');
    }

    // Get the most recent pending leave
    const leave = student.leaves[0];
    if (!leave) {
      req.flash('error', 'No pending leave request found');
      return res.redirect('back');
    }

    console.log('Rendering leave review:', { 
      hodId: hod._id, 
      studentId: student._id, 
      leaveId: leave._id 
    });

    res.render('reviewLeave', {
      hod,
      student,
      leave,
      moment
    });
  } catch (err) {
    console.error('Error loading leave details:', err);
    req.flash('error', 'Error loading leave details');
    res.redirect('back');
  }
});

// Update the HOD profile route
app.get("/hod/:id", ensureAuthenticated, async (req, res) => {
  try {
    const hod = await Hod.findById(req.params.id);
    if (!hod) {
      req.flash("error", "HOD not found");
      return res.redirect("/hod/home");
    }
    res.render("profilehod", { 
      hod: hod,
      moment: moment
    });
  } catch (err) {
    console.error("Profile error:", err);
    req.flash("error", "Error loading profile");
    res.redirect("/hod/home");
  }
});

// Add review route for HOD leave approvals
app.post("/hod/:id/leave/:stud_id/review", ensureAuthenticated, async (req, res) => {
  try {
    const { action } = req.body;
    const leave = await Leave.findById(req.body.leaveId);
    
    if (!leave) {
      req.flash('error', 'Leave request not found');
      return res.redirect('back');
    }

    leave.status = action === 'approve' ? 'approved' : 'denied';
    leave.reviewedBy = req.user._id;
    leave.reviewedAt = Date.now();
    await leave.save();

    req.flash('success', `Leave request ${leave.status}`);
    res.redirect(`/hod/${req.params.id}/leave`);
  } catch (err) {
    console.error('Review error:', err);
    req.flash('error', 'Error processing leave review');
    res.redirect('back');
  }
});

// Warden Routes
app.get("/warden/login", (req, res) => {
  res.render("wardenlogin", {
    error: req.flash('error'),
    success: req.flash('success')
  });
});

// Update the warden login route
app.post("/warden/login", (req, res, next) => {
  passport.authenticate('warden', (err, user, info) => {
    if (err) {
      console.error('Warden auth error:', err);
      req.flash('error', 'Authentication error');
      return res.redirect('/warden/login');
    }
    
    if (!user) {
      req.flash('error', info.message || 'Invalid credentials');
      return res.redirect('/warden/login');
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        req.flash('error', 'Login error');
        return res.redirect('/warden/login');
      }
      
      return res.redirect('/warden/home');
    });
  })(req, res, next);
});

// Fix warden home route
app.get("/warden/home", ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user) {
      req.flash('error', 'Please login first');
      return res.redirect('/warden/login');
    }

    if (req.user.type !== 'warden') {
      req.flash('error', 'Unauthorized access');
      return res.redirect('/warden/login');
    }

    const warden = await Warden.findById(req.user._id);
    if (!warden) {
      req.flash('error', 'Warden not found');
      return res.redirect('/warden/login');
    }

    res.render("homewarden", { 
      warden: warden,
      moment: moment
    });
  } catch (err) {
    console.error('Warden Home Error:', err);
    req.flash('error', 'Error accessing warden home');
    res.redirect('/warden/login');
  }
});

app.get("/warden/:id", ensureAuthenticated, async (req, res) => {
  try {
    const warden = await Warden.findById(req.params.id);
    if (!warden) {
      req.flash("error", "Warden not found");
      return res.redirect("/warden/home");
    }
    res.render("profilewarden", { warden: warden });
  } catch (err) {
    req.flash("error", "Error loading profile");
    res.redirect("/warden/home");
  }
});

app.get("/warden/:id/leave", ensureAuthenticated, async (req, res) => {
  try {
    const warden = await Warden.findById(req.params.id);
    if (!warden) {
      req.flash("error", "Warden not found");
      return res.redirect("/warden/home");
    }

    const students = await Student.find({ hostel: warden.hostel })
      .populate({
        path: 'leaves',
        match: { 
          $or: [
            { wardenstatus: 'pending' },
            { 
              wardenstatus: { $in: ['approved', 'denied'] },
              reviewedAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
            }
          ]
        }
      });

    res.render("wardenLeaveSign", {
      warden: warden,
      students: students,
      moment: moment
    });
  } catch (err) {
    console.error("Leave list error:", err);
    req.flash("error", "Error loading leave applications");
    res.redirect("/warden/home");
  }
});

app.get("/warden/home", ensureAuthenticated, async (req, res) => {
  try {
    if (!req.user || req.user.type !== 'warden') {
      req.flash('error', 'Unauthorized access');
      return res.redirect('/warden/login');
    }
    res.render("homewarden", { 
      warden: req.user,
      moment: moment
    });
  } catch (err) {
    console.error('Warden Home Error:', err);
    req.flash('error', 'Error accessing warden home');
    res.redirect('/warden/login');
  }
});

app.get("/warden/:id", ensureAuthenticated, async (req, res) => {
  try {
    const warden = await Warden.findById(req.params.id);
    if (!warden) {
      req.flash("error", "Warden not found");
      return res.redirect("/warden/home");
    }
    res.render("profilewarden", { warden: warden });
  } catch (err) {
    req.flash("error", "Error loading profile");
    res.redirect("/warden/home");
  }
});

app.get("/warden/:id/leave", ensureAuthenticated, async (req, res) => {
  try {
    const warden = await Warden.findById(req.params.id);
    if (!warden) {
      req.flash("error", "Warden not found");
      return res.redirect("back");
    }

    const students = await Student.find({ hostel: warden.hostel })
      .populate({
        path: 'leaves',
        match: { wardenstatus: { $in: ['pending', 'approved', 'denied'] } }
      });

    res.render("wardenLeaveSign", {
      warden: warden,
      students: students,
      moment: moment
    });
  } catch (err) {
    console.error("Leave list error:", err);
    req.flash("error", "Error loading leave requests");
    res.redirect("/warden/home");
  }
});

app.get("/warden/:id/leave/:stud_id/info", ensureAuthenticated, async (req, res) => {
  try {
    const warden = await Warden.findById(req.params.id);
    const student = await Student.findById(req.params.stud_id)
      .populate({
        path: 'leaves',
        match: { wardenstatus: 'pending' }
      });
    
    if (!warden || !student) {
      req.flash('error', 'Invalid request');
      return res.redirect('back');
    }

    res.render('Wardenmoreinfostud', {
      warden,
      student,
      moment
    });
  } catch (err) {
    console.error('Error loading leave details:', err);
    req.flash('error', 'Error loading leave details');
    res.redirect('back');
  }
});

app.post("/warden/:id/leave/:stud_id/info", ensureAuthenticated, async (req, res) => {
  try {
    const warden = await Warden.findById(req.params.id);
    const student = await Student.findById(req.params.stud_id);
    const leave = await Leave.findOne({
      'stud.id': student._id,
      wardenstatus: 'pending'
    });
    
    if (!warden || !student || !leave) {
      req.flash('error', 'Invalid request or no pending leave found');
      return res.redirect('back');
    }

    // Update leave status
    leave.wardenstatus = req.body.action === 'Approve' ? 'approved' : 'denied';
    leave.wardenReviewedBy = warden._id;
    leave.wardenReviewedAt = Date.now();
    
    await leave.save();

    req.flash('success', `Leave request ${leave.wardenstatus}`);
    res.redirect(`/warden/${warden._id}/leave`);
  } catch (err) {
    console.error('Review error:', err);
    req.flash('error', 'Error processing leave review');
    res.redirect('back');
  }
});

// Fix logout route
app.get("/logout", (req, res) => {
  if (req.isAuthenticated()) {
    req.logout((err) => {
      if (err) {
        console.error('Logout error:', err);
        req.flash('error', 'Error during logout');
        return res.redirect('back');
      }
      req.flash('success', 'Successfully logged out');
      req.session.destroy((err) => {
        if (err) {
          console.error('Session destroy error:', err);
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
      });
    });
  } else {
    res.redirect('/');
  }
});

// Error handlers
app.use((req, res) => {
  res.status(404).render('404', {
    message: 'Page not found',
    user: req.user || null,
    error: null,
    success: null
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || 500;
  const message = err.message || 'Something went wrong';

  if (req.session) {
    req.flash('error', message);
  }

  if (statusCode === 404) {
    return res.status(404).render('404', {
      message: 'Page not found',
      user: req.user || null,
      error: message,
      success: null
    });
  }

  res.status(statusCode).redirect(req.get('Referrer') || '/');
});

// Server startup
const port = process.env.PORT || 3005;
app.listen(port, () => {
  console.log(`Server started at port ${port}`);
});