# B.Tech Course Registration System

A modern, full-stack B.Tech Academic Course Registration Portal built with a pure backend API (Node.js/Express + MongoDB) and an ultra-premium, white-faced collegiate React frontend.

---

## 🏛️ System Overview

- **Backend**: Express REST API, Mongoose models, session management, course seeds, and administrative controls in `backend/`.
- **Frontend**: Premium white collegiate UI in React + Tailwind CSS (Vite) in `frontend/`.
- **Port**:
  - Backend API: `http://localhost:5000`
  - Frontend App: `http://localhost:5173`

---

## 🔑 Default Administrator Credentials

- **Admin Email**: `admin@university.edu`
- **Admin Password**: `Admin@123`

---

## 🚀 Running the Project

### 1. Start the Backend

```bash
cd backend
npm install
node server.js
```

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 📋 Features

### Student Portal
- Student Registration & Authentication with live password requirement validation.
- Live Course Catalog with real-time seat availability meters, prerequisites, department filters, and search.
- One-click Course Registration and Drop with 24-credit maximum rule enforcement.
- Enrolled Courses View with total credit progress bar and timetable breakdown.
- Printable Official University Course Registration Slip with signatures and academic seal.

### Administrator Portal
- Executive KPI Metrics: Enrolled Students, Active Courses, Total Registrations, Seat Occupancy Rate.
- Course Management: Add new course modules, monitor live seats, and delete courses.
- Student Directory: Search students by Roll No / Name, filter by department, review registered modules, credit count, and delete records.
