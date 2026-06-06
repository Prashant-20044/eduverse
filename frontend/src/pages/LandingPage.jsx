import React, { useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
  BookOpen,
  Users,
  Award,
  ChevronRight,
  PlayCircle,
  X,
  Check,
  Calendar,
  Star,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import './LandingPage.css';

// FAQ Accordion Item Component
function FAQItem({ question, answer }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-white/10 py-5">
      <button
        className="w-full flex justify-between items-center text-left text-lg md:text-xl font-semibold hover:text-indigo-400 transition-colors focus:outline-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
          className="text-gray-400 ml-4 flex-shrink-0"
        >
          <ChevronDown size={20} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 12 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden text-gray-400 text-sm md:text-base leading-relaxed"
          >
            {answer}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LandingPage() {
  const { loginWithOAuth, loginWithCredentials, signupWithCredentials, user } = useContext(AuthContext);
  const navigate = useNavigate();

  // Modal & Auth State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('login'); // 'login' or 'signup'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student'); // 'student' or 'teacher'

  const [loadingRole, setLoadingRole] = useState(null); // for Google login buttons
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');

  // If already logged in, redirect
  useEffect(() => {
    if (user) {
      navigate(user.role === 'teacher' ? '/teacher' : '/student');
    }
  }, [user, navigate]);

  const handleGoogleSuccess = async (tokenResponse, role) => {
    try {
      setAuthError('');
      // Get user info from Google using the access token
      const userInfo = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
      });

      const success = await loginWithOAuth(userInfo.data, role);
      if (success) {
        setIsAuthModalOpen(false);
        navigate(role === 'teacher' ? '/teacher' : '/student');
      }
    } catch (err) {
      console.error('Google login failed', err);
      setAuthError('Google login failed. Please try again.');
    } finally {
      setLoadingRole(null);
    }
  };

  const loginTeacher = useGoogleLogin({
    onSuccess: (codeResponse) => handleGoogleSuccess(codeResponse, 'teacher'),
    onError: (error) => { console.error('Login Failed:', error); setLoadingRole(null); }
  });

  const loginStudent = useGoogleLogin({
    onSuccess: (codeResponse) => handleGoogleSuccess(codeResponse, 'student'),
    onError: (error) => { console.error('Login Failed:', error); setLoadingRole(null); }
  });

  const handleGoogleLoginClick = (role) => {
    setLoadingRole(role);
    setAuthError('');
    if (role === 'teacher') loginTeacher();
    else loginStudent();
  };

  const handleCustomSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setSubmitting(true);

    if (!email.trim() || !password.trim()) {
      setAuthError('Please fill in all fields.');
      setSubmitting(false);
      return;
    }

    if (activeTab === 'signup' && !name.trim()) {
      setAuthError('Please enter your name.');
      setSubmitting(false);
      return;
    }

    try {
      if (activeTab === 'login') {
        const res = await loginWithCredentials(email, password);
        if (res.success) {
          setIsAuthModalOpen(false);
        } else {
          setAuthError(res.message);
        }
      } else {
        const res = await signupWithCredentials(name, email, password, role);
        if (res.success) {
          setIsAuthModalOpen(false);
        } else {
          setAuthError(res.message);
        }
      }
    } catch (err) {
      setAuthError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const openAuth = (tab = 'login', initialRole = 'student') => {
    setActiveTab(tab);
    setRole(initialRole);
    setAuthError('');
    setIsAuthModalOpen(true);
  };

  // Mock Data
  const courses = [
    {
      title: "JEE Advanced Physics Complete",
      mentor: "H.C. Verma (Mock)",
      duration: "6 Months",
      students: "1.2K+ Enrolled",
      category: "Physics",
      color: "from-purple-500/20 to-indigo-500/20 border-indigo-500/30",
      badge: "Live Class",
    },
    {
      title: "Organic Chemistry Masterclass",
      mentor: "Dr. Amit Sharma",
      duration: "4 Months",
      students: "850+ Enrolled",
      category: "Chemistry",
      color: "from-pink-500/20 to-rose-500/20 border-rose-500/30",
      badge: "Interactive",
    },
    {
      title: "Calculus & Linear Algebra",
      mentor: "Prof. Rohan Sen",
      duration: "5 Months",
      students: "1.5K+ Enrolled",
      category: "Maths",
      color: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30",
      badge: "Trending",
    }
  ];

  const teachers = [
    {
      name: "Dr. Amit Sharma",
      subject: "Chemistry Specialist",
      bio: "Ex-IIT Faculty with 15+ years mentoring top rankers in JEE & NEET exams.",
      rating: "4.9",
      exp: "15+ Yrs Exp",
      avatar: "🧪",
    },
    {
      name: "H.C. Verma (Mock)",
      subject: "Physics Legend",
      bio: "Renowned author and professor, passionate about building deep conceptual foundations.",
      rating: "5.0",
      exp: "25+ Yrs Exp",
      avatar: "🍎",
    },
    {
      name: "Prof. Rohan Sen",
      subject: "Mathematics Coach",
      bio: "Olympic Math trainer, specialized in Calculus, Algebra, and Logical reasoning.",
      rating: "4.8",
      exp: "12+ Yrs Exp",
      avatar: "📐",
    }
  ];

  return (
    <div className="bg-slate-950 text-white min-h-screen font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full z-40 backdrop-blur-md bg-slate-950/40 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="#" className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent hover:opacity-90 transition-opacity">
            EduVerse
          </a>

          <div className="hidden md:flex gap-8 text-sm font-medium text-gray-300">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#courses" className="hover:text-white transition-colors">Courses</a>
            <a href="#teachers" className="hover:text-white transition-colors">Teachers</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          </div>

          <button 
            onClick={() => openAuth('login')}
            className="bg-white hover:bg-gray-100 text-black px-5 py-2 rounded-xl font-semibold text-sm transition-all hover:scale-[1.03] active:scale-[0.97]"
          >
            Login
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
        
        {/* Dynamic Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute h-[500px] w-[500px] bg-purple-600/15 rounded-full blur-[120px] top-20 left-[-100px] animate-pulse duration-[6000ms]" />
          <div className="absolute h-[500px] w-[500px] bg-cyan-600/10 rounded-full blur-[120px] bottom-10 right-[-100px] animate-pulse duration-[8000ms]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs md:text-sm text-gray-300 backdrop-blur-md">
              <Zap size={14} className="text-cyan-400" /> India's Next Generation Learning Platform
            </span>

            <h1 className="text-5xl md:text-8xl font-black mt-8 leading-tight tracking-tight">
              Learn.
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                {" "}Teach.
              </span>
              {" "}Grow.
            </h1>

            <p className="text-gray-300 mt-6 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">
              A comprehensive live stream learning environment. Connect with top educators, practice with interactive testing, and launch your career.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={() => openAuth('login', 'student')}
                className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 px-8 py-4 rounded-2xl font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Login as Student
              </button>

              <button 
                onClick={() => openAuth('login', 'teacher')}
                className="w-full sm:w-auto border border-white/20 hover:bg-white/5 px-8 py-4 rounded-2xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Login as Teacher
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-slate-950 border-y border-white/5">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 px-6">
          {[
            ["50K+", "Students"],
            ["2K+", "Teachers"],
            ["10K+", "Courses"],
            ["1M+", "Hours Learned"],
          ].map(([value, label], index) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.5 }}
              className="bg-white/5 backdrop-blur-xl rounded-3xl p-6 md:p-8 text-center border border-white/10 hover:border-white/20 transition-colors"
            >
              <h2 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{value}</h2>
              <p className="text-gray-400 mt-2 font-medium text-sm md:text-base">{label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Student / Teacher Info Cards */}
      <section className="py-32 px-6 relative">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-10">
          
          {/* Student Card */}
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="group bg-gradient-to-br from-indigo-900/10 via-indigo-950/20 to-slate-900 border border-indigo-500/20 rounded-3xl p-8 md:p-12 hover:border-indigo-500/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                <GraduationCap size={32} />
              </div>
              <h3 className="text-3xl font-bold mt-8">For Students</h3>
              <p className="text-gray-400 mt-3 text-base">Unleash your potential with conceptual live learning paths and real-time validation.</p>
              
              <ul className="mt-8 space-y-4">
                {[
                  "Interactive Live Classrooms",
                  "Comprehensive Practice Mock Tests",
                  "AI-driven Learning paths & analytics",
                  "Verified Certifications for career milestones"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-300 text-sm md:text-base">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                      <Check size={12} className="text-indigo-400" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button 
              onClick={() => openAuth('signup', 'student')}
              className="mt-10 inline-flex items-center gap-2 text-indigo-400 font-semibold group-hover:text-indigo-300 transition-colors w-fit focus:outline-none"
            >
              Start Learning <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>

          {/* Teacher Card */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="group bg-gradient-to-br from-cyan-900/10 via-cyan-950/20 to-slate-900 border border-cyan-500/20 rounded-3xl p-8 md:p-12 hover:border-cyan-500/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <Users size={32} />
              </div>
              <h3 className="text-3xl font-bold mt-8">For Teachers</h3>
              <p className="text-gray-400 mt-3 text-base">Build your digital academy, expand your reach across the nation, and earn doing what you love.</p>
              
              <ul className="mt-8 space-y-4">
                {[
                  "Structured Multi-chapter Course Creator",
                  "Broadcast Live to 1000+ students instantly",
                  "Fair Revenue Sharing & Instant Payouts",
                  "Granular attendance and performance analytics"
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-300 text-sm md:text-base">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                      <Check size={12} className="text-cyan-400" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button 
              onClick={() => openAuth('signup', 'teacher')}
              className="mt-10 inline-flex items-center gap-2 text-cyan-400 font-semibold group-hover:text-cyan-300 transition-colors w-fit focus:outline-none"
            >
              Start Teaching <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </motion.div>

        </div>
      </section>

      {/* Courses Section */}
      <section className="py-32 bg-slate-950/50" id="courses">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Explore Popular Live Courses</h2>
            <p className="text-gray-400 mt-4 text-base md:text-lg">Gain top conceptual knowledge in physics, chemistry, and mathematics with leading coaches.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-20">
            {courses.map((course, index) => (
              <motion.div
                key={course.title}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                className={`group bg-gradient-to-b ${course.color} border rounded-3xl p-6 hover:scale-[1.02] hover:border-white/20 transition-all duration-300 flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="bg-white/10 px-3 py-1 rounded-full text-xs font-semibold text-white tracking-wide">{course.category}</span>
                    <span className="flex items-center gap-1.5 text-xs text-green-400 font-bold bg-green-500/10 border border-green-500/20 px-2.5 py-1 rounded-full">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      {course.badge}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold mt-2 group-hover:text-indigo-400 transition-colors">{course.title}</h3>
                  <p className="text-gray-400 mt-2 text-sm">Instructor: <span className="text-white font-medium">{course.mentor}</span></p>
                </div>

                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span className="flex items-center gap-1"><Calendar size={13} /> {course.duration}</span>
                    <span className="flex items-center gap-1"><Users size={13} /> {course.students}</span>
                  </div>
                  <button 
                    onClick={() => openAuth('signup', 'student')}
                    className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:bg-indigo-400 hover:text-white transition-colors focus:outline-none"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-32" id="features">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Why Choose EduVerse?</h2>
            <p className="text-gray-400 mt-4 text-base md:text-lg">Unleashing digital tools configured specifically to help learners and teachers succeed together.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-20">
            {[
              {
                icon: <BookOpen className="text-indigo-400" size={28} />,
                title: "Interactive Learning",
                desc: "Equipped with live chat, query raise features, collaborative whiteboards, and class polls to make lectures engaging.",
              },
              {
                icon: <Award className="text-pink-400" size={28} />,
                title: "Industry Certifications",
                desc: "Pass mock examinations, finish lecture paths, and download industry-recognized credentials signed by top coaches.",
              },
              {
                icon: <PlayCircle className="text-cyan-400" size={28} />,
                title: "Live Classes",
                desc: "Experience ultra low latency video stream, clear audio, screen sharing capabilities, and instant class recording archives.",
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="bg-white/5 hover:bg-white/10 rounded-3xl p-8 border border-white/10 hover:border-white/20 transition-all group duration-300"
              >
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <h3 className="text-2xl font-bold mt-6 group-hover:text-white transition-colors">{item.title}</h3>
                <p className="text-gray-400 mt-3 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Teachers Showcase Section */}
      <section className="py-32 bg-slate-950/50" id="teachers">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Meet Our Master Instructors</h2>
            <p className="text-gray-400 mt-4 text-base md:text-lg">Learn directly from legends who have helped thousands of students clear the toughest entrance exams.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-20">
            {teachers.map((teacher, index) => (
              <motion.div
                key={teacher.name}
                initial={{ opacity: 0, y: 25 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.5 }}
                className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 hover:border-white/15 hover:bg-slate-900/60 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-4xl">{teacher.avatar}</span>
                    <div className="flex items-center gap-1 text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full text-xs font-bold">
                      <Star size={12} fill="currentColor" />
                      {teacher.rating}
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mt-6">{teacher.name}</h3>
                  <p className="text-indigo-400 text-sm font-semibold mt-1">{teacher.subject}</p>
                  <p className="text-gray-400 text-sm mt-4 leading-relaxed">{teacher.bio}</p>
                </div>
                
                <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">{teacher.exp}</span>
                  <button 
                    onClick={() => openAuth('signup', 'student')}
                    className="text-xs font-semibold text-white bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl border border-white/10 transition-all focus:outline-none"
                  >
                    View Courses
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-32" id="faq">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Frequently Asked Questions</h2>
            <p className="text-gray-400 mt-4 text-base md:text-lg">Find answers to basic questions regarding how virtual classrooms function.</p>
          </div>

          <div className="bg-slate-900/30 border border-white/5 rounded-[32px] p-6 md:p-10 backdrop-blur-md">
            <FAQItem 
              question="What is EduVerse?" 
              answer="EduVerse is India's next-generation learning platform built on a low-latency live streaming network. We connect passionate teachers with eager students to facilitate high-quality real-time lectures, tests, and conceptual growth."
            />
            <FAQItem 
              question="How do live classes work?" 
              answer="Once you enroll in a course and the coach starts the session, you join a real-time stream. You can interact via chat, participate in polls, look at the collaborative whiteboard, and ask questions directly. A recorded video of the lecture becomes instantly archived in your dashboard."
            />
            <FAQItem 
              question="Can I teach on EduVerse?" 
              answer="Yes! By signing up as a teacher, you can build your profile, structure courses, set your price, go live instantly, host mock tests, and keep track of your analytics and earnings via our customizable dashboard."
            />
            <FAQItem 
              question="Are the mock tests customizable?" 
              answer="Absolutely. Teachers can generate multi-choice questions (MCQs), schedule time limits, and students can join rooms to submit their answers. Scoring is instant and detailed solutions are unlocked once the test is finished."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative">
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative overflow-hidden rounded-[40px] bg-gradient-to-r from-indigo-700 via-purple-700 to-cyan-700 p-10 md:p-20 text-center shadow-2xl">
            {/* CTA Background decorative shapes */}
            <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-[-50px] right-[-50px] w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />

            <h2 className="text-4xl md:text-6xl font-black tracking-tight leading-tight">Ready To Start Your Journey?</h2>
            <p className="mt-6 text-base md:text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
              Join thousands of learners mastering complicated topics and experienced educators scaling their classrooms digitally.
            </p>

            <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-4">
              <button 
                onClick={() => openAuth('signup', 'student')}
                className="w-full sm:w-auto bg-white hover:bg-gray-100 text-black px-8 py-4 rounded-2xl font-bold shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Student Sign Up
              </button>

              <button 
                onClick={() => openAuth('signup', 'teacher')}
                className="w-full sm:w-auto border border-white hover:bg-white/10 text-white px-8 py-4 rounded-2xl font-semibold hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Teacher Sign Up
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 text-center text-sm text-gray-500 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="font-bold text-lg text-white">EduVerse</span>
          <span>© 2026 EduVerse. All rights reserved.</span>
          <div className="flex gap-6 text-xs text-gray-400">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>

      {/* Auth Modal overlay */}
      {isAuthModalOpen && (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
            onClick={() => setIsAuthModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-md overflow-hidden bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Blobs in modal */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors focus:outline-none"
              >
                <X size={20} />
              </button>

              <h2 className="text-3xl font-extrabold bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent text-center mb-1">
                {activeTab === 'login' ? 'Welcome Back' : 'Join EduVerse'}
              </h2>
              <p className="text-gray-400 text-center text-xs mb-6">
                {activeTab === 'login' 
                  ? 'Access your lessons and custom workspaces' 
                  : 'Start learning or build your custom class brand'}
              </p>

              {/* Tab Toggles */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 mb-6">
                <button
                  className={`flex-1 py-2 text-center text-sm font-semibold rounded-lg transition-all focus:outline-none ${
                    activeTab === 'login' 
                      ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => { setActiveTab('login'); setAuthError(''); }}
                  disabled={submitting || loadingRole !== null}
                >
                  Login
                </button>
                <button
                  className={`flex-1 py-2 text-center text-sm font-semibold rounded-lg transition-all focus:outline-none ${
                    activeTab === 'signup' 
                      ? 'bg-gradient-to-r from-indigo-600 to-cyan-600 text-white shadow-md' 
                      : 'text-gray-400 hover:text-white'
                  }`}
                  onClick={() => { setActiveTab('signup'); setAuthError(''); }}
                  disabled={submitting || loadingRole !== null}
                >
                  Sign Up
                </button>
              </div>

              {authError && (
                <div className="bg-red-500/15 border border-red-500/30 text-red-400 text-xs rounded-xl p-3 mb-4 text-left">
                  {authError}
                </div>
              )}

              {/* Credentials Form */}
              <form onSubmit={handleCustomSubmit} className="space-y-4 text-left">
                {activeTab === 'signup' && (
                  <div>
                    <label htmlFor="modal-name" className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                      Full Name
                    </label>
                    <input
                      id="modal-name"
                      type="text"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={submitting || loadingRole !== null}
                      required
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="modal-email" className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                    Email Address
                  </label>
                  <input
                    id="modal-email"
                    type="email"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting || loadingRole !== null}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="modal-password" className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                    Password
                  </label>
                  <input
                    id="modal-password"
                    type="password"
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting || loadingRole !== null}
                    required
                  />
                </div>

                {activeTab === 'signup' && (
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                      Register As
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        className={`py-3 rounded-xl border text-sm font-semibold transition-all focus:outline-none ${
                          role === 'student'
                            ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                            : 'bg-slate-950 border-white/10 text-gray-400 hover:border-white/20'
                        }`}
                        onClick={() => setRole('student')}
                        disabled={submitting || loadingRole !== null}
                      >
                        👩‍🎓 Student
                      </button>
                      <button
                        type="button"
                        className={`py-3 rounded-xl border text-sm font-semibold transition-all focus:outline-none ${
                          role === 'teacher'
                            ? 'bg-cyan-600/20 border-cyan-500 text-white shadow-md'
                            : 'bg-slate-950 border-white/10 text-gray-400 hover:border-white/20'
                        }`}
                        onClick={() => setRole('teacher')}
                        disabled={submitting || loadingRole !== null}
                      >
                        👨‍🏫 Teacher
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-600 to-cyan-600 text-white font-semibold py-3.5 rounded-xl shadow-lg hover:shadow-indigo-500/20 hover:scale-[1.01] active:scale-[0.99] transition-all mt-4 disabled:opacity-50 disabled:scale-100 focus:outline-none"
                  disabled={submitting || loadingRole !== null}
                >
                  {submitting ? 'Please wait...' : activeTab === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </form>

              {activeTab === 'login' && (
                <>
                  <div className="flex items-center my-6 text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                    <span className="flex-1 border-b border-white/5" />
                    <span className="px-3">or continue with</span>
                    <span className="flex-1 border-b border-white/5" />
                  </div>

                  <div className="space-y-3">
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-semibold py-3 rounded-xl transition-all focus:outline-none"
                      onClick={() => handleGoogleLoginClick('student')}
                      disabled={submitting || loadingRole !== null}
                    >
                      {loadingRole === 'student' ? (
                        'Connecting...'
                      ) : (
                        <>
                          <span>👩‍🎓</span>
                          <span>Student Google Login</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-semibold py-3 rounded-xl transition-all focus:outline-none"
                      onClick={() => handleGoogleLoginClick('teacher')}
                      disabled={submitting || loadingRole !== null}
                    >
                      {loadingRole === 'teacher' ? (
                        'Connecting...'
                      ) : (
                        <>
                          <span>👨‍🏫</span>
                          <span>Teacher Google Login</span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}

    </div>
  );
}
