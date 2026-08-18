import { useEffect, useMemo, useState } from 'react';
import { Award, BookOpen, Building2, Check, CheckCircle2, ChevronRight, Clock, Eye, EyeOff, Filter, GraduationCap, Info, Layers, LogOut, MapPin, Plus, PlusCircle, Printer, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, User, UserCheck, Users, X, XCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const MAX_CREDITS = 24;

const DEPARTMENTS = ['Computer Science & Engg.', 'Information Technology', 'Electronics & Comm. Engg.', 'Electrical & Electronics Engg.', 'Mechanical Engineering', 'Civil Engineering', 'AI & Data Science'];
const SEMESTERS = ['1st Semester', '2nd Semester', '3rd Semester', '4th Semester', '5th Semester', '6th Semester', '7th Semester', '8th Semester'];

async function request(path, options = {}, token) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new Error('Cannot connect to backend server. Please verify it is running on port 5000.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Server returned error (${response.status})`);
  }
  return data;
}

const passwordRules = [
  { label: 'At least 8 characters', test: (pwd) => pwd.length >= 8 },
  { label: 'Uppercase letter (A-Z)', test: (pwd) => /[A-Z]/.test(pwd) },
  { label: 'Lowercase letter (a-z)', test: (pwd) => /[a-z]/.test(pwd) },
  { label: 'Number (0-9)', test: (pwd) => /\d/.test(pwd) },
  { label: 'Special character (!@#$...)', test: (pwd) => /[^A-Za-z0-9]/.test(pwd) }
];

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('course-session') || 'null');
    } catch {
      return null;
    }
  });

  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'enrolled' | 'slip'
  const [courses, setCourses] = useState([]);
  const [myCourses, setMyCourses] = useState([]);
  const [adminData, setAdminData] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showAddCourseModal, setShowAddCourseModal] = useState(false);
  const [selectedStudentForModal, setSelectedStudentForModal] = useState(null);

  const notify = (message, type = 'success') => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 4500);
  };

  const logout = () => {
    localStorage.removeItem('course-session');
    setSession(null);
    setCourses([]);
    setMyCourses([]);
    setAdminData(null);
    setSelectedStudentForModal(null);
    notify('You have been signed out.', 'info');
  };

  const loadStudentData = async () => {
    if (!session?.token) return;
    try {
      const [allCourses, enrolledList] = await Promise.all([
        request('/courses', {}, session.token),
        request('/me/courses', {}, session.token)
      ]);
      setCourses(allCourses);
      setMyCourses(enrolledList);
    } catch (err) {
      notify(err.message, 'error');
      if (/session|invalid|expired|token/i.test(err.message)) logout();
    }
  };

  const loadAdminData = async () => {
    if (!session?.token) return;
    try {
      const data = await request('/admin/dashboard', {}, session.token);
      setAdminData(data);
      if (selectedStudentForModal) {
        const updated = data.students.find((s) => s.id === selectedStudentForModal.id || s._id === selectedStudentForModal.id);
        if (updated) setSelectedStudentForModal(updated);
      }
    } catch (err) {
      notify(err.message, 'error');
      if (/session|invalid|expired|token/i.test(err.message)) logout();
    }
  };

  useEffect(() => {
    if (!session) return;
    if (session.role === 'admin') {
      loadAdminData();
    } else {
      loadStudentData();
    }
  }, [session]);

  const enrolledIds = useMemo(() => new Set(myCourses.map((c) => c.id || c._id)), [myCourses]);
  const totalCredits = useMemo(() => myCourses.reduce((sum, c) => sum + (c.credits || 0), 0), [myCourses]);

  const executeAction = async (asyncFn) => {
    setLoading(true);
    try {
      await asyncFn();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = (course) => {
    executeAction(async () => {
      const res = await request(`/me/courses/${course.id || course._id}`, { method: 'POST' }, session.token);
      await loadStudentData();
      notify(res.message || `Registered for ${course.code}!`, 'success');
    });
  };

  const handleDrop = (course) => {
    if (!window.confirm(`Are you sure you want to drop ${course.code} (${course.title})?`)) return;
    executeAction(async () => {
      const res = await request(`/me/courses/${course.id || course._id}`, { method: 'DELETE' }, session.token);
      await loadStudentData();
      notify(res.message || `Dropped ${course.code}.`, 'info');
    });
  };

  if (!session) {
    return <AuthScreen onAuthenticated={setSession} notify={notify} notice={notice} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <NoticeToast notice={notice} />
      <TopNavbar
        session={session}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        enrolledCount={myCourses.length}
        logout={logout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {session.role === 'admin' ? (
          <AdminDashboardView
            data={adminData}
            loading={loading}
            reload={loadAdminData}
            notify={notify}
            executeAction={executeAction}
            token={session.token}
            showAddModal={showAddCourseModal}
            setShowAddModal={setShowAddCourseModal}
            selectedStudent={selectedStudentForModal}
            setSelectedStudent={setSelectedStudentForModal}
          />
        ) : (
          <>
            {activeTab === 'catalog' && (
              <CourseCatalogView
                courses={courses}
                enrolledIds={enrolledIds}
                totalCredits={totalCredits}
                loading={loading}
                onRegister={handleRegister}
                onDrop={handleDrop}
                user={session.user}
                onGoToEnrolled={() => setActiveTab('enrolled')}
              />
            )}
            {activeTab === 'enrolled' && (
              <EnrolledCoursesView
                user={session.user}
                courses={myCourses}
                totalCredits={totalCredits}
                loading={loading}
                onDrop={handleDrop}
                onGoToCatalog={() => setActiveTab('catalog')}
                onPrintSlip={() => setActiveTab('slip')}
              />
            )}
            {activeTab === 'slip' && (
              <RegistrationSlipView
                user={session.user}
                courses={myCourses}
                totalCredits={totalCredits}
                onBack={() => setActiveTab('enrolled')}
              />
            )}
          </>
        )}
      </main>

      <footer className="bg-white border-t border-purple-100 py-6 text-center text-xs text-slate-500 no-print">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-purple-700" />
            <span className="font-bold text-purple-950">B.TECH Portal</span>
            <span className="text-slate-400">| Academic Course Registration System</span>
          </div>
          <div>B.Tech Academic Portal • Semester 2025-2026</div>
        </div>
      </footer>
    </div>
  );
}

// ==================== AUTHENTICATION SCREEN (ROYAL PURPLE) ====================

function AuthScreen({ onAuthenticated, notify, notice }) {
  const [mode, setMode] = useState('student-login');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    identifier: '',
    rollNo: '',
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    department: DEPARTMENTS[0],
    semester: SEMESTERS[4]
  });

  const updateField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const isRegister = mode === 'register';
  const isAdmin = mode === 'admin';
  const allRulesPassed = passwordRules.every((r) => r.test(form.password));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isRegister) {
      if (!allRulesPassed) {
        return notify('Please fulfill all password security rules.', 'error');
      }
      if (form.password !== form.confirmPassword) {
        return notify('Passwords do not match.', 'error');
      }
    }

    setBusy(true);
    try {
      const endpoint = isAdmin ? '/auth/admin/login' : isRegister ? '/auth/register' : '/auth/login';
      const payload = isAdmin
        ? { email: form.email, password: form.password }
        : isRegister
        ? form
        : { identifier: form.identifier, password: form.password };

      const data = await request(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      const sessionObj = isAdmin
        ? { role: 'admin', token: data.token, user: { name: 'Portal Administrator', email: data.admin.email } }
        : { role: 'student', token: data.token, user: data.user };

      localStorage.setItem('course-session', JSON.stringify(sessionObj));
      notify(data.message || (isAdmin ? 'Admin login successful!' : 'Welcome!'), 'success');
      onAuthenticated(sessionObj);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const fillAdminDemo = () => {
    setMode('admin');
    setForm((prev) => ({ ...prev, email: 'admin@university.edu', password: 'Admin@123' }));
    notify('Filled administrator credentials.', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      <NoticeToast notice={notice} />
      <div className="absolute top-0 left-0 right-0 h-72 bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-950 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 pt-8 flex items-center justify-between text-white/90">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2.5 rounded-2xl backdrop-blur border border-white/20 shadow-inner">
              <GraduationCap className="h-7 w-7 text-amber-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">B.TECH Portal</h1>
              <p className="text-xs text-purple-200">Official Course Registration System</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs bg-white/10 px-3.5 py-1.5 rounded-full border border-white/20 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>Academic Year 2025 - 2026</span>
          </div>
        </div>
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-xl px-4 mt-16 sm:mt-8">
        <div className="bg-white rounded-3xl shadow-xl border border-purple-100 overflow-hidden">
          <div className="border-b border-purple-100 bg-purple-50/50 p-2 flex gap-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setMode('student-login')}
              className={`flex-1 py-2.5 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all text-xs sm:text-sm ${
                mode === 'student-login'
                  ? 'bg-white text-purple-900 font-bold shadow-xs border border-purple-200'
                  : 'text-slate-600 hover:text-purple-900 hover:bg-purple-100/50'
              }`}
            >
              <User className="h-4 w-4 text-purple-700" />
              Student Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all text-xs sm:text-sm ${
                mode === 'register'
                  ? 'bg-white text-purple-900 font-bold shadow-xs border border-purple-200'
                  : 'text-slate-600 hover:text-purple-900 hover:bg-purple-100/50'
              }`}
            >
              <PlusCircle className="h-4 w-4 text-purple-700" />
              Register
            </button>
            <button
              type="button"
              onClick={() => setMode('admin')}
              className={`flex-1 py-2.5 px-3 rounded-2xl flex items-center justify-center gap-1.5 transition-all text-xs sm:text-sm ${
                mode === 'admin'
                  ? 'bg-white text-purple-900 font-bold shadow-xs border border-purple-200'
                  : 'text-slate-600 hover:text-purple-900 hover:bg-purple-100/50'
              }`}
            >
              <ShieldCheck className="h-4 w-4 text-purple-700" />
              Admin
            </button>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-800 border border-purple-200 mb-2">
                {isAdmin ? <ShieldCheck className="h-3.5 w-3.5 text-purple-700" /> : <BookOpen className="h-3.5 w-3.5 text-purple-700" />}
                {isAdmin ? 'Portal Administration' : isRegister ? 'Student Registration' : 'Student Access'}
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                {isAdmin ? 'Administrator Access' : isRegister ? 'Create Student Account' : 'Sign in to Course Registration'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                {isAdmin
                  ? 'Sign in with admin credentials to manage courses, student registrations, and seat capacities.'
                  : isRegister
                  ? 'Enter your academic details to register for your B.Tech semester courses.'
                  : 'Enter your Roll Number or University Email to access your catalog.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={form.name}
                        onChange={updateField('name')}
                        placeholder="e.g. Madhuri Patsa"
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Roll Number</label>
                      <input
                        type="text"
                        required
                        value={form.rollNo}
                        onChange={updateField('rollNo')}
                        placeholder="e.g. 24A81A0641"
                        className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none transition uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">University Email</label>
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={updateField('email')}
                      placeholder="student@university.edu"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                      <select
                        value={form.department}
                        onChange={updateField('department')}
                        className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none transition"
                      >
                        {DEPARTMENTS.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Semester</label>
                      <select
                        value={form.semester}
                        onChange={updateField('semester')}
                        className="w-full px-3 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none transition"
                      >
                        {SEMESTERS.map((sem) => (
                          <option key={sem} value={sem}>
                            {sem}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {!isRegister && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {isAdmin ? 'Administrator Email' : 'Roll Number or University Email'}
                  </label>
                  <input
                    type={isAdmin ? 'email' : 'text'}
                    required
                    value={isAdmin ? form.email : form.identifier}
                    onChange={updateField(isAdmin ? 'email' : 'identifier')}
                    placeholder={isAdmin ? 'admin@university.edu' : 'e.g. 24A81A0641 or email@university.edu'}
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none transition"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={form.password}
                    onChange={updateField('password')}
                    placeholder="Enter secure password"
                    className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none pr-10 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {isRegister && (
                <>
                  <div className="bg-purple-50/50 p-3.5 rounded-2xl border border-purple-100 text-xs space-y-1.5">
                    <p className="font-semibold text-purple-950">Password Requirements:</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {passwordRules.map((rule) => {
                        const passed = rule.test(form.password);
                        return (
                          <div
                            key={rule.label}
                            className={`flex items-center gap-1.5 ${
                              passed ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                            }`}
                          >
                            {passed ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-300 ml-1" />}
                            <span>{rule.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.confirmPassword}
                      onChange={updateField('confirmPassword')}
                      placeholder="Re-enter password"
                      className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none transition"
                    />
                    {form.confirmPassword && form.confirmPassword !== form.password && (
                      <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Passwords do not match
                      </p>
                    )}
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-purple-800 hover:bg-purple-900 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-purple-900/15 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {busy ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {isAdmin ? <ShieldCheck className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                    <span>{isAdmin ? 'Access Admin Console' : isRegister ? 'Complete Registration' : 'Sign In'}</span>
                  </>
                )}
              </button>
            </form>

            {isAdmin && (
              <div className="mt-4 pt-4 border-t border-purple-100 flex items-center justify-between text-xs text-slate-500 bg-purple-50/40 p-3 rounded-xl border border-purple-100">
                <div>
                  <span className="font-semibold text-purple-950">Admin Credentials:</span>
                  <p className="font-mono text-purple-900">admin@university.edu / Admin@123</p>
                </div>
                <button
                  type="button"
                  onClick={fillAdminDemo}
                  className="px-3 py-1 bg-white border border-purple-200 hover:bg-purple-50 text-purple-900 font-semibold rounded-lg shadow-2xs transition"
                >
                  Quick Fill
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== TOP NAVIGATION BAR ====================

function TopNavbar({ session, activeTab, setActiveTab, enrolledCount, logout }) {
  const isStudent = session.role === 'student';

  return (
    <header className="bg-white border-b border-purple-100 sticky top-0 z-30 shadow-xs no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-purple-800 flex items-center justify-center text-white shadow-sm shadow-purple-800/20">
              <GraduationCap className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-purple-950 tracking-tight text-base sm:text-lg">B.TECH Portal</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                  {session.role === 'admin' ? 'Administrator' : 'Student'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">Academic Course Registration System</p>
            </div>
          </div>

          {isStudent && (
            <div className="flex items-center gap-1.5 bg-purple-50/70 p-1 rounded-2xl border border-purple-100">
              <button
                type="button"
                onClick={() => setActiveTab('catalog')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'catalog'
                    ? 'bg-white text-purple-900 shadow-xs border border-purple-200'
                    : 'text-slate-600 hover:text-purple-900'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 text-purple-700" />
                <span>Course Catalog</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('enrolled')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  activeTab === 'enrolled'
                    ? 'bg-white text-purple-900 shadow-xs border border-purple-200'
                    : 'text-slate-600 hover:text-purple-900'
                }`}
              >
                <Layers className="h-3.5 w-3.5 text-purple-700" />
                <span>Enrolled Courses</span>
                {enrolledCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-800 text-white font-bold">
                    {enrolledCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('slip')}
                className={`hidden md:flex px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all items-center gap-1.5 ${
                  activeTab === 'slip'
                    ? 'bg-white text-purple-900 shadow-xs border border-purple-200'
                    : 'text-slate-600 hover:text-purple-900'
                }`}
              >
                <Printer className="h-3.5 w-3.5 text-purple-700" />
                <span>Registration Slip</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 text-right">
              <div>
                <p className="text-xs font-bold text-slate-900 leading-none">{session.user?.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {session.role === 'admin' ? session.user?.email : `${session.user?.rollNo} • ${session.user?.department}`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              title="Sign out of portal"
              className="p-2 rounded-xl text-slate-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 transition-all flex items-center gap-1 text-xs font-semibold"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

// ==================== STUDENT: COURSE CATALOG VIEW ====================

function CourseCatalogView({ courses, enrolledIds, totalCredits, loading, onRegister, onDrop, user, onGoToEnrolled }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [filterAvailability, setFilterAvailability] = useState('all');

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      const matchDept = selectedDept === 'All' || c.department === selectedDept;
      const matchSearch =
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.instructor && c.instructor.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (c.prerequisite && c.prerequisite.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchAvail = filterAvailability === 'all' || (c.enrolled || 0) < c.capacity;
      return matchDept && matchSearch && matchAvail;
    });
  }, [courses, searchQuery, selectedDept, filterAvailability]);

  const creditPercentage = Math.min(100, Math.round((totalCredits / MAX_CREDITS) * 100));

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-purple-100 shadow-sm p-6 relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
                {user.department}
              </span>
              <span className="text-xs text-slate-500">• {user.semester}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome back, {user.name}
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-xl">
              Browse available course modules, check prerequisites, and register for your semester curriculum below.
            </p>
          </div>

          <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-4 sm:p-5 w-full lg:w-80 shadow-xs">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-purple-950 flex items-center gap-1.5">
                <Award className="h-4 w-4 text-purple-700" />
                Enrolled Credits
              </span>
              <span className="font-extrabold text-purple-950">
                {totalCredits} <span className="text-slate-500 font-normal">/ {MAX_CREDITS} Max</span>
              </span>
            </div>

            <div className="w-full bg-purple-200/80 h-2.5 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  totalCredits >= MAX_CREDITS
                    ? 'bg-rose-500'
                    : totalCredits >= 18
                    ? 'bg-amber-500'
                    : 'bg-purple-700'
                }`}
                style={{ width: `${creditPercentage}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
              <span>{MAX_CREDITS - totalCredits} credits remaining</span>
              <button
                onClick={onGoToEnrolled}
                className="text-purple-700 hover:text-purple-900 font-bold hover:underline"
              >
                View Enrolled ({enrolledIds.size}) &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:flex-1">
          <Search className="h-4 w-4 absolute left-3.5 top-3 text-purple-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by course code, title, faculty instructor, or prerequisite..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-purple-50/30 border border-purple-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-600 focus:border-purple-600 outline-none transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-purple-50/50 px-3 py-2 border border-purple-100 rounded-xl">
            <Filter className="h-3.5 w-3.5 text-purple-600" />
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-transparent font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="All">All Departments ({courses.length})</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setFilterAvailability(filterAvailability === 'all' ? 'open' : 'all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 whitespace-nowrap ${
              filterAvailability === 'open'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-white text-slate-700 border-purple-100 hover:bg-purple-50/50'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            <span>{filterAvailability === 'open' ? 'Open Seats Only' : 'All Availability'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCourses.map((course) => {
          const isEnrolled = enrolledIds.has(course.id || course._id);
          return (
            <CourseCard
              key={course.id || course._id}
              course={course}
              isEnrolled={isEnrolled}
              loading={loading}
              onRegister={() => onRegister(course)}
              onDrop={() => onDrop(course)}
              canAddCredit={totalCredits + course.credits <= MAX_CREDITS}
            />
          );
        })}
      </div>

      {filteredCourses.length === 0 && (
        <div className="bg-white rounded-3xl border border-purple-100 p-12 text-center shadow-sm">
          <BookOpen className="h-12 w-12 text-purple-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No courses match your criteria</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search terms, changing the department filter, or resetting availability.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedDept('All');
              setFilterAvailability('all');
            }}
            className="mt-4 px-4 py-2 text-xs font-bold text-purple-800 bg-purple-50 border border-purple-200 rounded-xl hover:bg-purple-100 transition"
          >
            Reset All Filters
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== COURSE CARD COMPONENT ====================

function CourseCard({ course, isEnrolled, loading, onRegister, onDrop, canAddCredit }) {
  const enrolledCount = course.enrolled || 0;
  const isFull = enrolledCount >= course.capacity;
  const seatsRemaining = Math.max(0, course.capacity - enrolledCount);
  const occupancyPercent = Math.round((enrolledCount / course.capacity) * 100);

  return (
    <div
      className={`bg-white rounded-3xl border transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
        isEnrolled
          ? 'border-purple-500 ring-1 ring-purple-500/30'
          : isFull
          ? 'border-slate-200 opacity-90'
          : 'border-purple-100 hover:border-purple-300'
      }`}
    >
      <div className="p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs bg-purple-50 text-purple-950 px-2.5 py-1 rounded-lg border border-purple-200">
              {course.code}
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
              {course.credits} Credits
            </span>
          </div>

          {isEnrolled && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
              <Check className="h-3 w-3 text-purple-700" /> Registered
            </span>
          )}
        </div>

        <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-2">{course.title}</h3>
        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
          <Building2 className="h-3.5 w-3.5 text-purple-600" />
          {course.department}
        </p>

        <div className="mt-4 pt-3 border-t border-purple-50 space-y-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-purple-700 shrink-0" />
            <span className="font-semibold text-slate-900">{course.instructor || 'Faculty TBA'}</span>
          </div>

          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>{course.schedule}</span>
          </div>

          <div className="flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>Venue: {course.room}</span>
          </div>

          {course.prerequisite && course.prerequisite !== 'None' && (
            <div className="flex items-start gap-2 bg-purple-50/50 p-2 rounded-xl border border-purple-100 text-[11px]">
              <Info className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span className="text-slate-600">
                <strong className="text-slate-700">Prereq:</strong> {course.prerequisite}
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 bg-purple-50/40 p-3 rounded-2xl border border-purple-100">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-600 font-medium">Seat Capacity</span>
            <span className="font-bold text-slate-800">
              {enrolledCount} / {course.capacity}{' '}
              <span className={`text-[11px] font-normal ${isFull ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                ({isFull ? 'Full' : `${seatsRemaining} left`})
              </span>
            </span>
          </div>

          <div className="w-full bg-purple-200/60 h-2 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                isFull ? 'bg-rose-500' : occupancyPercent > 80 ? 'bg-amber-500' : 'bg-purple-700'
              }`}
              style={{ width: `${occupancyPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-4 bg-purple-50/30 border-t border-purple-50">
        {isEnrolled ? (
          <button
            type="button"
            disabled={loading}
            onClick={onDrop}
            className="w-full py-2 px-3 rounded-xl bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-2xs"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Drop Course</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={loading || isFull || !canAddCredit}
            onClick={onRegister}
            className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-sm ${
              isFull
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                : !canAddCredit
                ? 'bg-amber-100 text-amber-800 border border-amber-300 cursor-not-allowed'
                : 'bg-purple-800 hover:bg-purple-900 text-white active:scale-[0.98]'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>
              {isFull ? 'Course Full' : !canAddCredit ? 'Credit Limit Exceeded' : 'Register Course'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}

// ==================== STUDENT: ENROLLED COURSES VIEW ====================

function EnrolledCoursesView({ user, courses, totalCredits, loading, onDrop, onGoToCatalog, onPrintSlip }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-purple-100 p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
              Student Registration Summary
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{user.name}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Roll No: <span className="font-semibold text-slate-700">{user.rollNo}</span> • Email:{' '}
            <span className="font-semibold text-slate-700">{user.email}</span> • {user.department} ({user.semester})
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onPrintSlip}
            className="px-4 py-2 bg-white border border-purple-200 hover:bg-purple-50 text-purple-900 font-bold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Printer className="h-4 w-4 text-purple-700" />
            <span>Print Registration Slip</span>
          </button>

          <button
            type="button"
            onClick={onGoToCatalog}
            className="px-4 py-2 bg-purple-800 hover:bg-purple-900 text-white font-bold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Add More Courses</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl border border-purple-100 p-5 shadow-xs">
          <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">Registered Courses</span>
          <p className="text-3xl font-extrabold text-purple-950 mt-1">{courses.length}</p>
          <p className="text-xs text-slate-500 mt-1">Modules selected for this term</p>
        </div>

        <div className="bg-white rounded-3xl border border-purple-100 p-5 shadow-xs">
          <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">Total Enrolled Credits</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl font-extrabold text-purple-950">{totalCredits}</span>
            <span className="text-sm font-semibold text-slate-500">/ {MAX_CREDITS} Max</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{MAX_CREDITS - totalCredits} available credits</p>
        </div>

        <div className="bg-white rounded-3xl border border-purple-100 p-5 shadow-xs">
          <span className="text-xs font-bold text-purple-900 uppercase tracking-wider">Status</span>
          <p className="text-lg font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Confirmed
          </p>
          <p className="text-xs text-slate-500 mt-1">Official B.Tech Course Registration</p>
        </div>
      </div>

      {courses.length > 0 ? (
        <div className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-purple-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-base">Registered Course Schedule</h3>
            <span className="text-xs text-slate-500">{courses.length} course(s) enrolled</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-purple-50/60 text-purple-950 font-bold border-b border-purple-100">
                <tr>
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Course Title</th>
                  <th className="py-3.5 px-4">Faculty Name</th>
                  <th className="py-3.5 px-4">Schedule & Venue</th>
                  <th className="py-3.5 px-4 text-center">Credits</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-50">
                {courses.map((course) => (
                  <tr key={course.id || course._id} className="hover:bg-purple-50/40 transition">
                    <td className="py-4 px-4 font-mono font-bold text-purple-900">{course.code}</td>
                    <td className="py-4 px-4 font-semibold text-slate-800">
                      {course.title}
                      <p className="text-xs text-slate-400 font-normal">{course.department}</p>
                    </td>
                    <td className="py-4 px-4 text-slate-700 font-medium">
                      <div className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-purple-700 shrink-0" />
                        <span>{course.instructor || 'Faculty TBA'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-600">
                      <div>{course.schedule}</div>
                      <span className="text-xs text-slate-400">Room: {course.room}</span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                        {course.credits} Cr
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => onDrop(course)}
                        className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs transition"
                      >
                        Drop
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-purple-100 p-12 text-center shadow-sm">
          <BookOpen className="h-12 w-12 text-purple-300 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800">You have not registered for any courses yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Browse the live course catalog to select your mandatory and elective modules for the current semester.
          </p>
          <button
            onClick={onGoToCatalog}
            className="mt-5 px-5 py-2.5 bg-purple-800 hover:bg-purple-900 text-white font-bold text-xs rounded-xl shadow-sm transition inline-flex items-center gap-1.5"
          >
            <BookOpen className="h-4 w-4" />
            <span>Browse Course Catalog</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== STUDENT: PRINTABLE REGISTRATION SLIP ====================

function RegistrationSlipView({ user, courses, totalCredits, onBack }) {
  const printDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-white border border-purple-200 hover:bg-purple-50 text-purple-900 text-xs font-bold rounded-xl transition"
        >
          &larr; Back to Enrolled Courses
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="px-5 py-2 bg-purple-800 hover:bg-purple-900 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-2"
        >
          <Printer className="h-4 w-4" />
          <span>Print Official Slip</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-300 p-8 sm:p-10 shadow-md print-card print:border print:p-4 text-slate-900">
        <div className="border-b-2 border-purple-950 pb-6 mb-6 text-center">
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-2xl bg-purple-900 text-amber-300 flex items-center justify-center">
              <GraduationCap className="h-7 w-7" />
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-purple-950">
            B.Tech Academic Course Portal
          </h2>
          <p className="text-xs font-bold text-purple-800 uppercase tracking-widest mt-0.5">
            Office of Academic Affairs & Course Registrations
          </p>
          <p className="text-xs text-slate-500">Official Semester Course Registration Acknowledgment</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-purple-50/40 p-4 rounded-2xl border border-purple-100 text-xs mb-6">
          <div>
            <span className="text-slate-500 font-bold uppercase text-[10px]">Student Name</span>
            <p className="font-bold text-slate-900 text-sm">{user.name}</p>
          </div>
          <div>
            <span className="text-slate-500 font-bold uppercase text-[10px]">Roll Number</span>
            <p className="font-bold font-mono text-purple-900 text-sm">{user.rollNo}</p>
          </div>
          <div>
            <span className="text-slate-500 font-bold uppercase text-[10px]">Department</span>
            <p className="font-bold text-slate-900">{user.department}</p>
          </div>
          <div>
            <span className="text-slate-500 font-bold uppercase text-[10px]">Semester</span>
            <p className="font-bold text-slate-900">{user.semester}</p>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-bold text-xs uppercase tracking-wider text-purple-950 mb-2">
            Registered Modules & Schedule ({courses.length} Courses)
          </h4>
          <table className="w-full text-left text-xs border border-slate-300 border-collapse">
            <thead className="bg-purple-50 text-purple-950">
              <tr>
                <th className="border border-slate-300 p-2.5">Course Code</th>
                <th className="border border-slate-300 p-2.5">Course Title</th>
                <th className="border border-slate-300 p-2.5">Faculty Name</th>
                <th className="border border-slate-300 p-2.5">Schedule</th>
                <th className="border border-slate-300 p-2.5">Room</th>
                <th className="border border-slate-300 p-2.5 text-center">Credits</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id || c._id}>
                  <td className="border border-slate-300 p-2.5 font-mono font-bold">{c.code}</td>
                  <td className="border border-slate-300 p-2.5 font-medium">{c.title}</td>
                  <td className="border border-slate-300 p-2.5">{c.instructor || 'Faculty TBA'}</td>
                  <td className="border border-slate-300 p-2.5">{c.schedule}</td>
                  <td className="border border-slate-300 p-2.5">{c.room}</td>
                  <td className="border border-slate-300 p-2.5 text-center font-bold">{c.credits}</td>
                </tr>
              ))}
              <tr className="bg-purple-50/50 font-bold">
                <td colSpan="5" className="border border-slate-300 p-2.5 text-right uppercase text-purple-950">
                  Total Registered Academic Credits:
                </td>
                <td className="border border-slate-300 p-2.5 text-center text-purple-950 font-extrabold text-sm">
                  {totalCredits} / {MAX_CREDITS}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-8 text-center text-xs">
          <div>
            <div className="border-b border-slate-400 h-10 w-36 mx-auto mb-2" />
            <p className="font-bold text-slate-800">Student Signature</p>
            <p className="text-[10px] text-slate-400">{printDate}</p>
          </div>
          <div>
            <div className="border-b border-slate-400 h-10 w-36 mx-auto mb-2" />
            <p className="font-bold text-slate-800">Faculty Advisor / HOD</p>
            <p className="text-[10px] text-slate-400">Department Approval</p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="border-b border-slate-400 h-10 w-36 mx-auto mb-2" />
            <p className="font-bold text-slate-800">Dean of Academics</p>
            <p className="text-[10px] text-slate-400">Official Seal</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== ADMIN: DASHBOARD VIEW (ROYAL PURPLE) ====================

function AdminDashboardView({
  data,
  loading,
  reload,
  notify,
  executeAction,
  token,
  showAddModal,
  setShowAddModal,
  selectedStudent,
  setSelectedStudent
}) {
  const [adminTab, setAdminTab] = useState('students');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDeptFilter, setStudentDeptFilter] = useState('All');

  const removeStudent = (student, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Delete student record for "${student.name}" (${student.rollNo}) and remove all their registrations?`)) return;
    executeAction(async () => {
      const res = await request(`/admin/students/${student.id || student._id}`, { method: 'DELETE' }, token);
      if (selectedStudent && (selectedStudent.id === student.id || selectedStudent.id === student._id)) {
        setSelectedStudent(null);
      }
      await reload();
      notify(res.message || 'Student record removed.', 'info');
    });
  };

  const removeCourse = (course) => {
    if (!window.confirm(`Delete course "${course.code}: ${course.title}" and unregister all enrolled students?`)) return;
    executeAction(async () => {
      const res = await request(`/admin/courses/${course.id || course._id}`, { method: 'DELETE' }, token);
      await reload();
      notify(res.message || `${course.code} deleted.`, 'info');
    });
  };

  const filteredStudents = useMemo(() => {
    if (!data?.students) return [];
    return data.students.filter((s) => {
      const matchDept = studentDeptFilter === 'All' || s.department === studentDeptFilter;
      const matchSearch =
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.rollNo.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.email.toLowerCase().includes(studentSearch.toLowerCase());
      return matchDept && matchSearch;
    });
  }, [data?.students, studentSearch, studentDeptFilter]);

  if (!data) {
    return (
      <div className="bg-white rounded-3xl border border-purple-100 p-12 text-center shadow-sm">
        <RefreshCw className="h-8 w-8 text-purple-700 animate-spin mx-auto mb-3" />
        <p className="text-sm font-bold text-purple-950">Loading Academic Administration Console...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-purple-100 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-purple-700" /> B.Tech Admin Console
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            Academic Course Administration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor real-time course registrations, inspect student profiles, and manage curriculum offerings.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => reload()}
            className="p-2.5 bg-white border border-purple-200 hover:bg-purple-50 text-purple-900 rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5"
            title="Refresh Data"
          >
            <RefreshCw className={`h-4 w-4 text-purple-700 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 bg-purple-800 hover:bg-purple-900 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Course</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl border border-purple-100 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-purple-900">
            <span>Enrolled Students</span>
            <Users className="h-4 w-4 text-purple-700" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">{data.stats.students}</p>
          <p className="text-[11px] text-slate-400 mt-1">{data.stats.totalLogins} total portal sign-ins</p>
        </div>

        <div className="bg-white rounded-3xl border border-purple-100 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-purple-900">
            <span>Active Courses</span>
            <BookOpen className="h-4 w-4 text-purple-700" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">{data.stats.courses}</p>
          <p className="text-[11px] text-slate-400 mt-1">{data.stats.totalCapacity} total seat capacity</p>
        </div>

        <div className="bg-white rounded-3xl border border-purple-100 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-purple-900">
            <span>Course Registrations</span>
            <Layers className="h-4 w-4 text-amber-600" />
          </div>
          <p className="text-3xl font-extrabold text-slate-900 mt-2">{data.stats.registrations}</p>
          <p className="text-[11px] text-slate-400 mt-1">Confirmed student seats</p>
        </div>

        <div className="bg-white rounded-3xl border border-purple-100 p-5 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-purple-900">
            <span>Seat Occupancy Rate</span>
            <Award className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-3xl font-extrabold text-emerald-700 mt-2">{data.stats.occupancyRate}%</p>
          <p className="text-[11px] text-slate-400 mt-1">
            {data.stats.totalEnrolledSeats} of {data.stats.totalCapacity} seats filled
          </p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-purple-100 pb-2">
        <button
          type="button"
          onClick={() => setAdminTab('students')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            adminTab === 'students'
              ? 'bg-purple-800 text-white shadow-xs'
              : 'bg-white border border-purple-100 text-slate-600 hover:bg-purple-50/50'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Student Directory ({data.students?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setAdminTab('courses')}
          className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-1.5 ${
            adminTab === 'courses'
              ? 'bg-purple-800 text-white shadow-xs'
              : 'bg-white border border-purple-100 text-slate-600 hover:bg-purple-50/50'
          }`}
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Course Directory ({data.courses?.length || 0})</span>
        </button>
      </div>

      {adminTab === 'students' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-purple-100 p-4 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 absolute left-3.5 top-3 text-purple-400" />
              <input
                type="text"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search students by roll no, name, email..."
                className="w-full pl-10 pr-4 py-2 text-xs bg-purple-50/30 border border-purple-100 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-600 outline-none"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-slate-500 font-bold">Department:</span>
              <select
                value={studentDeptFilter}
                onChange={(e) => setStudentDeptFilter(e.target.value)}
                className="text-xs bg-purple-50/30 border border-purple-100 rounded-xl px-3 py-2 text-slate-700 outline-none cursor-pointer font-semibold"
              >
                <option value="All">All Departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-purple-50/60 text-purple-950 font-bold border-b border-purple-100">
                  <tr>
                    <th className="py-3.5 px-4">Student</th>
                    <th className="py-3.5 px-4">Department & Sem</th>
                    <th className="py-3.5 px-4">Registered Modules (Click to view)</th>
                    <th className="py-3.5 px-4 text-center">Total Credits</th>
                    <th className="py-3.5 px-4 text-center">Logins</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-50">
                  {filteredStudents.map((s) => (
                    <tr
                      key={s.id || s._id}
                      onClick={() => setSelectedStudent(s)}
                      className="hover:bg-purple-50/50 transition cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-purple-950 flex items-center gap-1.5">
                          {s.name}
                          <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-purple-700 transition" />
                        </div>
                        <div className="font-mono text-xs text-purple-900 font-bold">{s.rollNo}</div>
                        <div className="text-[11px] text-slate-400">{s.email}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="font-semibold">{s.department}</div>
                        <div className="text-xs text-slate-500">{s.semester}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {s.registeredCourses?.length > 0 ? (
                            s.registeredCourses.map((c) => (
                              <span
                                key={c.id || c.code}
                                className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-50 text-purple-900 border border-purple-200/90 shadow-2xs hover:bg-purple-100"
                              >
                                {c.code}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400 italic">No registrations</span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-bold text-slate-800">
                        <span className="px-2.5 py-1 rounded-full text-xs bg-purple-50 text-purple-900 border border-purple-200">
                          {s.totalCredits || 0} / {MAX_CREDITS}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs text-slate-600">
                        <span className="font-bold text-slate-800">{s.loginCount || 0}</span>
                        <div className="text-[10px] text-slate-400">
                          {s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString() : 'Never'}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedStudent(s)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 transition"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={(e) => removeStudent(s, e)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition"
                            title="Delete Student Record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredStudents.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                No student records found matching your filters.
              </div>
            )}
          </div>
        </div>
      )}

      {adminTab === 'courses' && (
        <div className="bg-white rounded-3xl border border-purple-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-purple-50/60 text-purple-950 font-bold border-b border-purple-100">
                <tr>
                  <th className="py-3.5 px-4">Code</th>
                  <th className="py-3.5 px-4">Course Title & Department</th>
                  <th className="py-3.5 px-4">Faculty Name & Schedule</th>
                  <th className="py-3.5 px-4 text-center">Credits</th>
                  <th className="py-3.5 px-4 text-center">Live Seats</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-50">
                {data.courses?.map((c) => {
                  const percent = Math.round(((c.enrolled || 0) / c.capacity) * 100);
                  return (
                    <tr key={c.id || c._id} className="hover:bg-purple-50/40 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-900">{c.code}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{c.title}</div>
                        <div className="text-xs text-slate-500">{c.department}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="font-semibold text-purple-950 flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-purple-700" />
                          <span>{c.instructor}</span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {c.schedule} • {c.room}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          {c.credits} Cr
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-block w-28 text-left">
                          <div className="flex justify-between text-[11px] font-bold mb-1">
                            <span>{c.enrolled || 0} / {c.capacity}</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="w-full bg-purple-200/60 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                percent >= 100 ? 'bg-rose-500' : percent > 75 ? 'bg-amber-500' : 'bg-purple-700'
                              }`}
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => removeCourse(c)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition"
                          title="Delete Course"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <AddCourseModal
          onClose={() => setShowAddModal(false)}
          token={token}
          reload={reload}
          notify={notify}
        />
      )}

      {selectedStudent && (
        <StudentDetailsModal
          student={selectedStudent}
          coursesCatalog={data.courses || []}
          onClose={() => setSelectedStudent(null)}
          token={token}
          reload={reload}
          notify={notify}
          executeAction={executeAction}
        />
      )}
    </div>
  );
}

// ==================== ADMIN: STUDENT DETAILS MODAL ====================

function StudentDetailsModal({ student, coursesCatalog, onClose, token, reload, notify, executeAction }) {
  const [busy, setBusy] = useState(false);

  const handleAdminRemoveCourse = (courseId, courseCode) => {
    if (!window.confirm(`Remove registered course "${courseCode}" for student ${student.name}?`)) return;
    executeAction(async () => {
      setBusy(true);
      try {
        const res = await request(`/admin/students/${student.id || student._id}/courses/${courseId}`, { method: 'DELETE' }, token);
        await reload();
        notify(res.message || `Removed ${courseCode} from student's registration.`, 'info');
      } finally {
        setBusy(false);
      }
    });
  };

  const totalCredits = (student.registeredCourses || []).reduce((sum, c) => sum + (c.credits || 0), 0);

  const studentCourses = useMemo(() => {
    return (student.registeredCourses || []).map((c) => {
      const match = coursesCatalog.find((cat) => cat.code === c.code || cat.id === c.id || cat._id === c.id);
      return {
        ...c,
        instructor: c.instructor || match?.instructor || 'Faculty TBA',
        schedule: c.schedule || match?.schedule || 'TBA',
        room: c.room || match?.room || 'TBA'
      };
    });
  }, [student.registeredCourses, coursesCatalog]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-purple-100 relative animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-purple-100 pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-purple-800 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {student.name ? student.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-900 text-lg leading-tight">{student.name}</h3>
                <span className="font-mono text-xs font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                  {student.rollNo}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {student.department} • {student.semester}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto space-y-4 pr-1 flex-1 text-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-purple-50/40 p-3.5 rounded-2xl border border-purple-100">
            <div>
              <span className="text-purple-900 uppercase text-[10px] font-bold block">Email</span>
              <p className="font-semibold text-slate-800 truncate" title={student.email}>
                {student.email}
              </p>
            </div>
            <div>
              <span className="text-purple-900 uppercase text-[10px] font-bold block">Total Credits</span>
              <p className="font-bold text-purple-950 text-sm">
                {totalCredits} <span className="text-slate-400 text-xs font-normal">/ {MAX_CREDITS}</span>
              </p>
            </div>
            <div>
              <span className="text-purple-900 uppercase text-[10px] font-bold block">Portal Sign-ins</span>
              <p className="font-semibold text-slate-800">{student.loginCount || 0} times</p>
            </div>
            <div>
              <span className="text-purple-900 uppercase text-[10px] font-bold block">Last Login</span>
              <p className="font-semibold text-slate-800">
                {student.lastLoginAt ? new Date(student.lastLoginAt).toLocaleDateString() : 'Never'}
              </p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-purple-950 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-purple-700" />
                Registered Modules ({studentCourses.length})
              </h4>
              <span className="text-[11px] font-bold text-purple-800">
                {totalCredits} of {MAX_CREDITS} Credits
              </span>
            </div>

            {studentCourses.length > 0 ? (
              <div className="border border-purple-100 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-purple-50/80 text-purple-950 font-bold border-b border-purple-100">
                    <tr>
                      <th className="p-2.5">Code</th>
                      <th className="p-2.5">Course Title</th>
                      <th className="p-2.5">Faculty Name</th>
                      <th className="p-2.5 text-center">Credits</th>
                      <th className="p-2.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-50">
                    {studentCourses.map((c) => (
                      <tr key={c.id || c.code} className="hover:bg-purple-50/40">
                        <td className="p-2.5 font-mono font-bold text-purple-900">{c.code}</td>
                        <td className="p-2.5 font-semibold text-slate-800">
                          {c.title}
                          <p className="text-[10px] text-slate-400 font-normal">{c.department}</p>
                        </td>
                        <td className="p-2.5 text-slate-700 font-medium">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-purple-700 shrink-0" />
                            <span className="font-semibold text-slate-900">{c.instructor}</span>
                          </div>
                          <span className="text-[10px] text-slate-400">
                            {c.schedule} • {c.room}
                          </span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            {c.credits} Cr
                          </span>
                        </td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => handleAdminRemoveCourse(c.id, c.code)}
                            className="px-2.5 py-1 text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg text-[11px] font-bold transition shadow-2xs"
                            title="Remove this course for student"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-purple-50/30 border border-purple-100 rounded-2xl p-6 text-center text-slate-500">
                <BookOpen className="h-8 w-8 text-purple-300 mx-auto mb-2" />
                <p className="font-bold text-slate-800">No courses registered yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">This student has not selected any courses for the current semester.</p>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 mt-4 border-t border-purple-50 flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs transition border border-purple-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== ADMIN: ADD COURSE MODAL ====================

function AddCourseModal({ onClose, token, reload, notify }) {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    code: '',
    title: '',
    instructor: '',
    credits: 4,
    department: DEPARTMENTS[0],
    capacity: 50,
    schedule: 'Mon / Wed 10:00 AM - 11:30 AM',
    room: 'LH-101',
    prerequisite: 'None'
  });

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await request(
        '/admin/courses',
        {
          method: 'POST',
          body: JSON.stringify(form)
        },
        token
      );
      await reload();
      notify(res.message || `Course ${form.code} added successfully!`, 'success');
      onClose();
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-purple-100 relative animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b border-purple-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-2xl bg-purple-50 text-purple-800">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-lg">Add New Course Module</h3>
              <p className="text-xs text-slate-500">Add course offering to the university curriculum</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Course Code</label>
              <input
                type="text"
                required
                value={form.code}
                onChange={update('code')}
                placeholder="e.g. CS405"
                className="w-full px-3 py-2 bg-purple-50/30 border border-purple-200 rounded-xl uppercase font-mono font-bold"
              />
            </div>
            <div className="col-span-2">
              <label className="block font-bold text-slate-700 mb-1">Course Title</label>
              <input
                type="text"
                required
                value={form.title}
                onChange={update('title')}
                placeholder="e.g. Cloud Computing & DevOps"
                className="w-full px-3 py-2 bg-purple-50/30 border border-purple-200 rounded-xl font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Faculty Instructor</label>
              <input
                type="text"
                required
                value={form.instructor}
                onChange={update('instructor')}
                placeholder="e.g. Dr. Alan Turing"
                className="w-full px-3 py-2 bg-purple-50/30 border border-purple-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Department</label>
              <select
                value={form.department}
                onChange={update('department')}
                className="w-full px-3 py-2 bg-purple-50/30 border border-purple-200 rounded-xl font-medium"
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Credits</label>
              <input
                type="number"
                min="1"
                max="8"
                required
                value={form.credits}
                onChange={update('credits')}
                className="w-full px-3 py-2 bg-purple-50/30 border border-purple-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Max Capacity</label>
              <input
                type="number"
                min="5"
                max="300"
                required
                value={form.capacity}
                onChange={update('capacity')}
                className="w-full px-3 py-2 bg-purple-50/30 border border-purple-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Room / Venue</label>
              <input
                type="text"
                required
                value={form.room}
                onChange={update('room')}
                placeholder="LH-101"
                className="w-full px-3 py-2 bg-purple-50/30 border border-purple-200 rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Schedule Timing</label>
              <input
                type="text"
                required
                value={form.schedule}
                onChange={update('schedule')}
                placeholder="Mon / Wed 10:00 AM - 11:30 AM"
                className="w-full px-3 py-2 bg-purple-50/30 border border-purple-200 rounded-xl"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Prerequisite</label>
              <input
                type="text"
                value={form.prerequisite}
                onChange={update('prerequisite')}
                placeholder="e.g. CS101 or None"
                className="w-full px-3 py-2 bg-purple-50/30 border border-purple-200 rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-purple-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-purple-800 hover:bg-purple-900 text-white font-bold transition flex items-center gap-1.5"
            >
              {submitting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              <span>Save Course</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== TOAST NOTIFICATION COMPONENT ====================

function NoticeToast({ notice }) {
  if (!notice) return null;

  const isError = notice.type === 'error';
  const isInfo = notice.type === 'info';

  return (
    <div className="fixed top-5 right-5 z-50 animate-in slide-in-from-top duration-200">
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border text-xs sm:text-sm font-bold max-w-md ${
          isError
            ? 'bg-rose-50 text-rose-900 border-rose-200'
            : isInfo
            ? 'bg-purple-50 text-purple-900 border-purple-200'
            : 'bg-emerald-50 text-emerald-900 border-emerald-200'
        }`}
      >
        {isError ? (
          <XCircle className="h-5 w-5 text-rose-600 shrink-0" />
        ) : isInfo ? (
          <Info className="h-5 w-5 text-purple-600 shrink-0" />
        ) : (
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
        )}
        <span>{notice.message}</span>
      </div>
    </div>
  );
}
