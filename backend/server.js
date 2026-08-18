const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const { Student, Course } = require('./models/schemas');

const app = express();

const sessions = new Map();

const MAX_CREDITS = 24;
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

const PORT = process.env.PORT || 5000;

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || 'admin@university.edu';

const ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || 'Admin@123';

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  'http://localhost:5173';

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://127.0.0.1:27017/courseRegDB';

/* =========================
   MIDDLEWARE
========================= */

app.use(
  cors({
    origin: [
      FRONTEND_URL,
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
    ],
    credentials: true,
  })
);

app.use(express.json({ limit: '50kb' }));

/* =========================
   HEALTH CHECK
========================= */

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message:
      'B.Tech Course Registration Backend API is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

/* =========================
   COURSE SEED
========================= */

const COURSE_SEED = [
  {
    code: 'CS301',
    title: 'Data Structures & Algorithms',
    instructor: 'Dr. Alan Turing',
    credits: 4,
    department: 'Computer Science & Engg.',
    capacity: 60,
    schedule: 'Mon / Wed 10:00 AM - 11:30 AM',
    room: 'Lab-301',
    prerequisite: 'CS101 (Programming Fundamentals)',
  },
  {
    code: 'CS304',
    title: 'Database Management Systems',
    instructor: 'Prof. Edgar Codd',
    credits: 4,
    department: 'Computer Science & Engg.',
    capacity: 55,
    schedule: 'Tue / Thu 02:00 PM - 03:30 PM',
    room: 'LH-102',
    prerequisite: 'CS201 (Data Structures)',
  },
  {
    code: 'CS402',
    title: 'Operating Systems & System Programming',
    instructor: 'Dr. Linus Torvalds',
    credits: 4,
    department: 'Computer Science & Engg.',
    capacity: 50,
    schedule: 'Mon / Fri 01:00 PM - 02:30 PM',
    room: 'Lab-204',
    prerequisite: 'CS202 (Computer Architecture)',
  },
  {
    code: 'IT302',
    title: 'Web Technologies & Cloud Architecture',
    instructor: 'Dr. Tim Berners-Lee',
    credits: 3,
    department: 'Information Technology',
    capacity: 60,
    schedule: 'Tue / Thu 10:00 AM - 11:30 AM',
    room: 'IT-Lab 2',
    prerequisite: 'CS101 (Programming)',
  },
  {
    code: 'IT405',
    title: 'Cyber Security & Cryptography',
    instructor: 'Prof. Adi Shamir',
    credits: 4,
    department: 'Information Technology',
    capacity: 45,
    schedule: 'Mon / Wed 02:00 PM - 03:30 PM',
    room: 'LH-305',
    prerequisite: 'MA301 (Discrete Math)',
  },
  {
    code: 'EC204',
    title: 'Digital Signal Processing',
    instructor: 'Dr. Claude Shannon',
    credits: 3,
    department: 'Electronics & Comm. Engg.',
    capacity: 45,
    schedule: 'Tue / Fri 09:00 AM - 10:30 AM',
    room: 'EC-LH3',
    prerequisite: 'EC101 (Circuit Analysis)',
  },
  {
    code: 'EE202',
    title: 'Control Systems & Automation',
    instructor: 'Dr. Nikola Tesla',
    credits: 4,
    department: 'Electrical & Electronics Engg.',
    capacity: 50,
    schedule: 'Mon / Thu 11:30 AM - 01:00 PM',
    room: 'EE-LH1',
    prerequisite: 'EE101 (Network Theory)',
  },
  {
    code: 'ME201',
    title: 'Thermodynamics & Heat Transfer',
    instructor: 'Dr. James Watt',
    credits: 4,
    department: 'Mechanical Engineering',
    capacity: 65,
    schedule: 'Mon / Wed 09:00 AM - 10:30 AM',
    room: 'ME-LH2',
    prerequisite: 'PH101 (Engineering Physics)',
  },
  {
    code: 'CE203',
    title: 'Structural Analysis & Mechanics',
    instructor: 'Dr. Gustave Eiffel',
    credits: 4,
    department: 'Civil Engineering',
    capacity: 50,
    schedule: 'Tue / Fri 11:00 AM - 12:30 PM',
    room: 'CE-LH1',
    prerequisite: 'ME101 (Engineering Mechanics)',
  },
  {
    code: 'AI401',
    title: 'Machine Learning & Neural Networks',
    instructor: 'Dr. Geoffrey Hinton',
    credits: 4,
    department: 'AI & Data Science',
    capacity: 40,
    schedule: 'Thu / Sat 10:00 AM - 11:30 AM',
    room: 'AI-Lab',
    prerequisite: 'MA301, CS301',
  },
];

/* =========================
   PASSWORD HELPERS
========================= */

const hashPassword = (
  password,
  salt = crypto.randomBytes(16).toString('hex')
) => ({
  salt,
  hash: crypto
    .scryptSync(password, salt, 64)
    .toString('hex'),
});

const verifyPassword = (
  password,
  salt,
  expectedHash
) => {
  try {
    const actual = crypto
      .scryptSync(password, salt, 64)
      .toString('hex');

    return crypto.timingSafeEqual(
      Buffer.from(actual, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } catch {
    return false;
  }
};

const passwordError = (password) => {
  if (
    typeof password !== 'string' ||
    password.length < 8
  ) {
    return 'Password must contain at least 8 characters.';
  }

  if (
    !/[a-z]/.test(password) ||
    !/[A-Z]/.test(password) ||
    !/\d/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {
    return 'Password must include uppercase, lowercase, a number, and a special character.';
  }

  return null;
};

/* =========================
   SESSION
========================= */

const createSession = (
  role,
  userId = null,
  extra = {}
) => {
  const token = crypto
    .randomBytes(48)
    .toString('hex');

  sessions.set(token, {
    role,
    userId,
    ...extra,
    expiresAt:
      Date.now() + SESSION_DURATION_MS,
  });

  return token;
};

/* =========================
   PUBLIC STUDENT
========================= */

const publicStudent = (student) => ({
  id: student._id,
  rollNo: student.rollNo,
  name: student.name,
  email: student.email,
  department: student.department,
  semester: student.semester,
  loginCount: student.loginCount || 0,
  lastLoginAt: student.lastLoginAt,
  createdAt: student.createdAt,
});

/* =========================
   AUTH MIDDLEWARE
========================= */

const auth = (role) => (req, res, next) => {
  const authHeader =
    req.headers.authorization;

  const token = authHeader?.replace(
    /^Bearer\s+/i,
    ''
  );

  const session =
    token && sessions.get(token);

  if (
    !session ||
    session.expiresAt < Date.now()
  ) {
    return res.status(401).json({
      message:
        'Your session has expired or is invalid. Please sign in again.',
    });
  }

  if (
    role &&
    session.role !== role
  ) {
    return res.status(403).json({
      message:
        'Access denied: You do not have permission for this action.',
    });
  }

  req.session = session;

  next();
};

/* =========================
   COURSE HELPERS
========================= */

const courseWithEnrollment = async (
  course
) => {
  const doc = course.toObject
    ? course.toObject()
    : course;

  const enrolledCount =
    await Student.countDocuments({
      registeredCourses: doc._id,
    });

  return {
    ...doc,
    id: doc._id,
    enrolled: enrolledCount,
  };
};

const getCourses = async () => {
  const courses = await Course.find().sort({
    code: 1,
  });

  return Promise.all(
    courses.map(courseWithEnrollment)
  );
};

/* =========================
   STUDENT REGISTRATION
========================= */

app.post(
  '/api/auth/register',
  async (req, res) => {
    try {
      const {
        rollNo,
        name,
        email,
        password,
        department,
        semester,
      } = req.body;

      const normalizedRollNo =
        String(rollNo || '')
          .trim()
          .toUpperCase();

      const normalizedEmail =
        String(email || '')
          .trim()
          .toLowerCase();

      const cleanName =
        String(name || '').trim();

      if (
        !/^[A-Z0-9]{4,20}$/.test(
          normalizedRollNo
        )
      ) {
        return res.status(400).json({
          message:
            'Please enter a valid roll number (4-20 alphanumeric characters).',
        });
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          normalizedEmail
        )
      ) {
        return res.status(400).json({
          message:
            'Please enter a valid university email address.',
        });
      }

      if (
        !cleanName ||
        cleanName.length < 2
      ) {
        return res.status(400).json({
          message:
            'Please enter a valid full name.',
        });
      }

      const err =
        passwordError(password);

      if (err) {
        return res.status(400).json({
          message: err,
        });
      }

      if (!department || !semester) {
        return res.status(400).json({
          message:
            'Department and Semester selection are required.',
        });
      }

      const { hash, salt } =
        hashPassword(password);

      const student =
        await Student.create({
          rollNo: normalizedRollNo,
          name: cleanName,
          email: normalizedEmail,
          passwordHash: hash,
          passwordSalt: salt,
          department,
          semester,
          loginCount: 1,
          lastLoginAt: new Date(),
        });

      const token = createSession(
        'student',
        student._id.toString()
      );

      res.status(201).json({
        token,
        user: publicStudent(student),
        message:
          'Account successfully registered!',
      });
    } catch (error) {
      if (error?.code === 11000) {
        const field =
          Object.keys(
            error.keyPattern || {}
          )[0] ||
          'Roll number or Email';

        return res.status(409).json({
          message:
            `A student with this ${
              field === 'email'
                ? 'email'
                : 'roll number'
            } is already registered.`,
        });
      }

      console.error(
        'Registration error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to create student account. Please try again.',
      });
    }
  }
);

/* =========================
   STUDENT LOGIN
========================= */

app.post(
  '/api/auth/login',
  async (req, res) => {
    try {
      const identifier =
        String(
          req.body.identifier || ''
        ).trim();

      const password =
        req.body.password;

      if (!identifier || !password) {
        return res.status(400).json({
          message:
            'Please enter both your Roll Number / Email and Password.',
        });
      }

      const student =
        await Student.findOne({
          $or: [
            {
              email:
                identifier.toLowerCase(),
            },
            {
              rollNo:
                identifier.toUpperCase(),
            },
          ],
        }).select(
          '+passwordHash +passwordSalt'
        );

      if (
        !student ||
        !verifyPassword(
          password,
          student.passwordSalt,
          student.passwordHash
        )
      ) {
        return res.status(401).json({
          message:
            'Invalid Roll Number / Email or password.',
        });
      }

      student.loginCount =
        (student.loginCount || 0) + 1;

      student.lastLoginAt =
        new Date();

      await student.save();

      const token = createSession(
        'student',
        student._id.toString()
      );

      res.json({
        token,
        user: publicStudent(student),
        message: 'Welcome back!',
      });
    } catch (error) {
      console.error(
        'Student login error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to sign in. Please try again.',
      });
    }
  }
);

/* =========================
   ADMIN LOGIN
========================= */

app.post(
  '/api/auth/admin/login',
  (req, res) => {
    try {
      const email =
        String(
          req.body.email || ''
        )
          .trim()
          .toLowerCase();

      const password =
        String(
          req.body.password || ''
        );

      if (!email || !password) {
        return res.status(400).json({
          message:
            'Please provide admin email and password.',
        });
      }

      const validEmail =
        email ===
        ADMIN_EMAIL.toLowerCase();

      const validPassword =
        password === ADMIN_PASSWORD;

      if (
        !validEmail ||
        !validPassword
      ) {
        return res.status(401).json({
          message:
            'Invalid administrator email or password.',
        });
      }

      const token = createSession(
        'admin',
        null,
        {
          email: ADMIN_EMAIL,
        }
      );

      res.json({
        token,
        admin: {
          email: ADMIN_EMAIL,
          name: 'University Administrator',
        },
        message:
          'Admin authentication successful',
      });
    } catch (error) {
      console.error(
        'Admin login error:',
        error
      );

      res.status(500).json({
        message:
          'Admin authentication failed.',
      });
    }
  }
);

/* =========================
   COURSE CATALOG
========================= */

app.get(
  '/api/courses',
  auth(),
  async (req, res) => {
    try {
      const list =
        await getCourses();

      res.json(list);
    } catch (error) {
      console.error(
        'Error fetching courses:',
        error
      );

      res.status(500).json({
        message:
          'Could not load courses.',
      });
    }
  }
);

/* =========================
   CURRENT STUDENT
========================= */

app.get(
  '/api/me',
  auth('student'),
  async (req, res) => {
    try {
      const student =
        await Student.findById(
          req.session.userId
        );

      if (!student) {
        return res.status(404).json({
          message:
            'Student record not found.',
        });
      }

      res.json(
        publicStudent(student)
      );
    } catch (error) {
      res.status(500).json({
        message:
          'Could not fetch student profile.',
      });
    }
  }
);

/* =========================
   STUDENT COURSES
========================= */

app.get(
  '/api/me/courses',
  auth('student'),
  async (req, res) => {
    try {
      const student =
        await Student.findById(
          req.session.userId
        ).populate(
          'registeredCourses'
        );

      if (!student) {
        return res.status(404).json({
          message:
            'Student not found.',
        });
      }

      const list =
        await Promise.all(
          (
            student.registeredCourses ||
            []
          ).map(courseWithEnrollment)
        );

      res.json(list);
    } catch (error) {
      console.error(
        'Error fetching student registered courses:',
        error
      );

      res.status(500).json({
        message:
          'Could not load your courses.',
      });
    }
  }
);
/* =========================
   REGISTER FOR COURSE
========================= */

app.post(
  '/api/me/courses/:courseId',
  auth('student'),
  async (req, res) => {
    try {
      const student =
        await Student.findById(
          req.session.userId
        ).populate(
          'registeredCourses'
        );

      const course =
        await Course.findById(
          req.params.courseId
        );

      if (!student) {
        return res.status(404).json({
          message: 'Student not found.',
        });
      }

      if (!course) {
        return res.status(404).json({
          message: 'Course not found.',
        });
      }

      if (
        student.registeredCourses.some(
          (c) =>
            c._id.equals(course._id)
        )
      ) {
        return res.status(409).json({
          message:
            `You are already registered for ${course.code} (${course.title}).`,
        });
      }

      const currentCredits =
        student.registeredCourses.reduce(
          (sum, c) =>
            sum + (c.credits || 0),
          0
        );

      if (
        currentCredits +
          course.credits >
        MAX_CREDITS
      ) {
        return res.status(400).json({
          message:
            `Cannot register: Maximum credit limit is ${MAX_CREDITS}. Current: ${currentCredits}, Course: ${course.credits}.`,
        });
      }

      const enrolledCount =
        await Student.countDocuments({
          registeredCourses:
            course._id,
        });

      if (
        enrolledCount >=
        course.capacity
      ) {
        return res.status(400).json({
          message:
            `Registration closed: ${course.code} has reached full capacity.`,
        });
      }

      student.registeredCourses.push(
        course._id
      );

      await student.save();

      const updatedCourse =
        await courseWithEnrollment(
          course
        );

      res.status(201).json({
        message:
          `Successfully registered for ${course.code}: ${course.title}`,
        course: updatedCourse,
      });
    } catch (error) {
      console.error(
        'Course registration error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to register for course.',
      });
    }
  }
);


/* =========================
   DROP COURSE
========================= */

app.delete(
  '/api/me/courses/:courseId',
  auth('student'),
  async (req, res) => {
    try {
      const student =
        await Student.findById(
          req.session.userId
        );

      if (!student) {
        return res.status(404).json({
          message:
            'Student not found.',
        });
      }

      const initialCount =
        student.registeredCourses.length;

      student.registeredCourses =
        student.registeredCourses.filter(
          (id) =>
            !id.equals(
              req.params.courseId
            )
        );

      if (
        student.registeredCourses
          .length === initialCount
      ) {
        return res.status(404).json({
          message:
            'Course was not in your registered list.',
        });
      }

      await student.save();

      res.json({
        message:
          'Course dropped successfully.',
      });
    } catch (error) {
      console.error(
        'Drop course error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to drop course.',
      });
    }
  }
);


/* =========================
   ADMIN DASHBOARD
========================= */

app.get(
  '/api/admin/dashboard',
  auth('admin'),
  async (req, res) => {
    try {
      const [
        students,
        courses,
      ] = await Promise.all([
        Student.find()
          .populate(
            'registeredCourses'
          )
          .sort({
            createdAt: -1,
          }),

        getCourses(),
      ]);

      const formattedStudents =
        students.map((s) => ({
          ...publicStudent(s),

          registeredCourses: (
            s.registeredCourses ||
            []
          ).map((c) => ({
            id: c._id,
            code: c.code,
            title: c.title,
            credits: c.credits,
            department:
              c.department,
            instructor:
              c.instructor,
            schedule:
              c.schedule,
            room: c.room,
            prerequisite:
              c.prerequisite,
          })),

          totalCredits: (
            s.registeredCourses ||
            []
          ).reduce(
            (sum, c) =>
              sum + (c.credits || 0),
            0
          ),
        }));

      const totalRegistrations =
        formattedStudents.reduce(
          (sum, s) =>
            sum +
            s.registeredCourses.length,
          0
        );

      const totalLogins =
        formattedStudents.reduce(
          (sum, s) =>
            sum + (s.loginCount || 0),
          0
        );

      const totalCapacity =
        courses.reduce(
          (sum, c) =>
            sum + (c.capacity || 0),
          0
        );

      const totalEnrolledSeats =
        courses.reduce(
          (sum, c) =>
            sum + (c.enrolled || 0),
          0
        );

      res.json({
        stats: {
          students:
            formattedStudents.length,

          courses:
            courses.length,

          registrations:
            totalRegistrations,

          totalLogins,

          totalCapacity,

          totalEnrolledSeats,

          occupancyRate:
            totalCapacity > 0
              ? Math.round(
                  (totalEnrolledSeats /
                    totalCapacity) *
                    100
                )
              : 0,
        },

        students:
          formattedStudents,

        courses,
      });
    } catch (error) {
      console.error(
        'Admin dashboard error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to load admin dashboard data.',
      });
    }
  }
);


/* =========================
   ADMIN DROP STUDENT COURSE
========================= */

app.delete(
  '/api/admin/students/:studentId/courses/:courseId',
  auth('admin'),
  async (req, res) => {
    try {
      const student =
        await Student.findById(
          req.params.studentId
        );

      if (!student) {
        return res.status(404).json({
          message:
            'Student record not found.',
        });
      }

      student.registeredCourses =
        student.registeredCourses.filter(
          (id) =>
            !id.equals(
              req.params.courseId
            )
        );

      await student.save();

      res.json({
        message:
          'Course registration removed for this student.',
      });
    } catch (error) {
      console.error(
        'Admin unregister student error:',
        error
      );

      res.status(500).json({
        message:
          'Failed to remove course registration.',
      });
    }
  }
);


/* =========================
   ADMIN ADD COURSE
========================= */

app.post(
  '/api/admin/courses',
  auth('admin'),
  async (req, res) => {
    try {
      const {
        code,
        title,
        instructor,
        credits,
        department,
        capacity,
        schedule,
        room,
        prerequisite,
      } = req.body;

      if (
        !code ||
        !title ||
        !instructor ||
        !credits ||
        !department ||
        !capacity ||
        !schedule ||
        !room
      ) {
        return res.status(400).json({
          message:
            'All course fields are required.',
        });
      }

      const normalizedCode =
        String(code)
          .trim()
          .toUpperCase();

      const existing =
        await Course.findOne({
          code: normalizedCode,
        });

      if (existing) {
        return res.status(409).json({
          message:
            `A course with code "${normalizedCode}" already exists.`,
        });
      }

      const newCourse =
        await Course.create({
          code: normalizedCode,
          title: String(title).trim(),
          instructor:
            String(instructor).trim(),
          credits: Number(credits),
          department:
            String(department).trim(),
          capacity: Number(capacity),
          schedule:
            String(schedule).trim(),
          room: String(room).trim(),
          prerequisite:
            String(
              prerequisite || 'None'
            ).trim(),
        });

      res.status(201).json({
        message:
          `Course ${newCourse.code} created successfully!`,

        course:
          await courseWithEnrollment(
            newCourse
          ),
      });
    } catch (error) {
      console.error(
        'Error creating course:',
        error
      );

      res.status(500).json({
        message:
          'Failed to create course.',
      });
    }
  }
);


/* =========================
   ADMIN EDIT COURSE
========================= */

app.put(
  '/api/admin/courses/:courseId',
  auth('admin'),
  async (req, res) => {
    try {
      const {
        title,
        instructor,
        credits,
        department,
        capacity,
        schedule,
        room,
        prerequisite,
      } = req.body;

      const course =
        await Course.findById(
          req.params.courseId
        );

      if (!course) {
        return res.status(404).json({
          message:
            'Course not found.',
        });
      }

      if (title)
        course.title =
          String(title).trim();

      if (instructor)
        course.instructor =
          String(instructor).trim();

      if (credits)
        course.credits =
          Number(credits);

      if (department)
        course.department =
          String(department).trim();

      if (capacity)
        course.capacity =
          Number(capacity);

      if (schedule)
        course.schedule =
          String(schedule).trim();

      if (room)
        course.room =
          String(room).trim();

      if (
        prerequisite !== undefined
      ) {
        course.prerequisite =
          String(
            prerequisite
          ).trim();
      }

      await course.save();

      res.json({
        message:
          `Course ${course.code} updated successfully.`,

        course:
          await courseWithEnrollment(
            course
          ),
      });
    } catch (error) {
      console.error(
        'Error updating course:',
        error
      );

      res.status(500).json({
        message:
          'Failed to update course.',
      });
    }
  }
);


/* =========================
   ADMIN DELETE STUDENT
========================= */

app.delete(
  '/api/admin/students/:studentId',
  auth('admin'),
  async (req, res) => {
    try {
      const student =
        await Student.findByIdAndDelete(
          req.params.studentId
        );

      if (!student) {
        return res.status(404).json({
          message:
            'Student record not found.',
        });
      }

      res.json({
        message:
          `Student ${student.name} (${student.rollNo}) deleted successfully.`,
      });
    } catch (error) {
      console.error(
        'Error deleting student:',
        error
      );

      res.status(500).json({
        message:
          'Failed to delete student record.',
      });
    }
  }
);


/* =========================
   ADMIN DELETE COURSE
========================= */

app.delete(
  '/api/admin/courses/:courseId',
  auth('admin'),
  async (req, res) => {
    try {
      const course =
        await Course.findByIdAndDelete(
          req.params.courseId
        );

      if (!course) {
        return res.status(404).json({
          message:
            'Course not found.',
        });
      }

      await Student.updateMany(
        {},
        {
          $pull: {
            registeredCourses:
              course._id,
          },
        }
      );

      res.json({
        message:
          `Course ${course.code} and its student registrations were deleted successfully.`,
      });
    } catch (error) {
      console.error(
        'Error deleting course:',
        error
      );

      res.status(500).json({
        message:
          'Failed to delete course.',
      });
    }
  }
);


/* =========================
   MONGODB CONNECTION
========================= */

let mongoPromise = null;

async function connectDB() {
  if (
    mongoose.connection.readyState === 1
  ) {
    return;
  }

  if (!mongoPromise) {
    console.log(
      'Connecting to MongoDB...'
    );

    mongoPromise =
      mongoose.connect(MONGO_URI)
        .then(async () => {
          console.log(
            'MongoDB connected successfully.'
          );

          for (
            const item of COURSE_SEED
          ) {
            await Course.updateOne(
              { code: item.code },
              {
                $setOnInsert: item,
              },
              {
                upsert: true,
              }
            );
          }

          console.log(
            'Course catalog seeded/verified.'
          );
        })
        .catch((error) => {
          mongoPromise = null;

          console.error(
            'Database connection failed:',
            error
          );

          throw error;
        });
  }

  await mongoPromise;
}


/* =========================
   VERCEL HANDLER
========================= */

module.exports = async (
  req,
  res
) => {
  try {
    await connectDB();

    return app(req, res);
  } catch (error) {
    console.error(
      'Backend initialization error:',
      error
    );

    return res.status(500).json({
      message:
        'Backend could not connect to MongoDB.',
      error:
        process.env.NODE_ENV ===
        'development'
          ? error.message
          : undefined,
    });
  }
};


/* =========================
   LOCAL DEVELOPMENT
========================= */

if (
  process.env.NODE_ENV !==
    'production' &&
  !process.env.VERCEL
) {
  connectDB()
    .then(() => {
      app.listen(
        PORT,
        () => {
          console.log(
            '============================================'
          );

          console.log(
            '🎓 B.Tech Course Registration Backend API'
          );

          console.log(
            `📡 http://localhost:${PORT}`
          );

          console.log(
            `🔑 Admin: ${ADMIN_EMAIL}`
          );

          console.log(
            '============================================'
          );
        }
      );
    })
    .catch((error) => {
      console.error(
        'Failed to start local server:',
        error
      );

      process.exit(1);
    });
}