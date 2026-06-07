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
    <div className="border-b border-white/10 py-8">
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
  

  return (
    <div className="bg-slate-950 text-white min-h-screen font-sans selection:bg-indigo-500 selection:text-white overflow-x-hidden">
      
      {/* Navbar */}
      <nav className="fixed top-0 left-0 w-full z-40 backdrop-blur-md bg-slate-950/40 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <a href="#" className="text-2xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent hover:opacity-90 transition-opacity">
            EduVerse
          </a>

          <div className="text-sm md:text-base font-bold tracking-widest text-indigo-300 uppercase">
           
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center pt-44 pb-44 overflow-hidden">
        
        {/* Dynamic Blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute h-[600px] w-[600px] bg-purple-600/20 rounded-full blur-[140px] top-10 left-[-150px] animate-pulse duration-[6000ms]" />
          <div className="absolute h-[600px] w-[600px] bg-cyan-600/15 rounded-full blur-[140px] bottom-5 right-[-150px] animate-pulse duration-[8000ms]" />
        </div>

        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center text-center">
          <motion.div
            className="w-full flex flex-col items-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <span className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-white/5 border border-white/10 text-sm md:text-base text-gray-300 backdrop-blur-md">
              <Zap size={16} className="text-cyan-400" /> India's Next Generation Learning Platform
            </span>

            <h1 className="text-6xl md:text-9xl font-black mt-16 mb-10 leading-none tracking-tight">
              Learn.
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                {" "}Teach.
              </span>
              {" "}Grow.
            </h1>

            <p className="text-gray-300 mt-10 mb-20 text-xl md:text-2xl max-w-4xl text-center leading-relaxed">
              A comprehensive live stream learning environment. Connect with top educators, practice with interactive testing, and launch your career.
            </p>

            <div className="flex flex-col sm:flex-row gap-10 justify-center items-center">
              
              {/* Student button */}
              <div className="button-container">
                <button 
                  onClick={() => openAuth('login', 'student')}
                  className="real-button"
                />
                <div className="button-border">
                  <div className="button font-extrabold text-lg text-white">
                    Login as Student
                    <div className="backdrop"></div>
                    <div className="spin spin-blur"></div>
                    <div className="spin spin-intense"></div>
                    <div className="spin spin-inside"></div>
                  </div>
                </div>
              </div>

              {/* Teacher button */}
              <div className="button-container">
                <button 
                  onClick={() => openAuth('login', 'teacher')}
                  className="real-button"
                />
                <div className="button-border">
                  <div className="button font-bold text-lg text-white">
                    Login as Teacher
                    <div className="backdrop"></div>
                    <div className="spin spin-blur"></div>
                    <div className="spin spin-intense"></div>
                    <div className="spin spin-inside"></div>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      </section>

      

      {/* Student / Teacher Info Cards */}
      <section className="py-56 px-8 relative flex flex-col items-center">

        {/* Section heading — centred */}
        <div className="w-full max-w-4xl mx-auto text-center mb-20">
          <motion.div
            className="w-full flex flex-col items-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-400 mb-6">
              <GraduationCap size={15} className="text-indigo-400" /> Who is EduVerse for?
            </span>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight">
              Built for{' '}
              <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
                Everyone
              </span>
            </h2>
            <p className="text-gray-400 mt-6 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Whether you're here to learn or to teach, EduVerse gives you everything you need to succeed.
            </p>
          </motion.div>
        </div>

        {/* Cards grid */}
        <div className="w-full max-w-7xl mx-auto grid md:grid-cols-2 gap-10 items-stretch">

          {/* Student Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="group bg-gradient-to-br from-indigo-900/10 via-indigo-950/20 to-slate-900 border border-indigo-500/20 rounded-[32px] py-20 px-14 md:py-28 md:px-20 hover:border-indigo-500/40 transition-all flex flex-col items-start text-left"
          >
            {/* Icon + Title row */}
            <div className="flex items-center gap-6 mb-10">
              <div className="w-28 h-28 rounded-3xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform flex-shrink-0">
                <GraduationCap size={52} />
              </div>
              <h3 className="text-5xl font-extrabold">For Students</h3>
            </div>

            {/* Subtitle */}
            <p className="text-gray-400 mt-8 text-xl leading-relaxed">
              Unleash your potential with conceptual live learning paths and real-time validation.
            </p>

            {/* Divider */}
            <div className="w-20 h-px bg-indigo-500/30 my-10" />

            {/* Feature list */}
            <ul className="space-y-7 w-full">
              {[
                "Interactive Live Classrooms",
                "Comprehensive Practice Mock Tests",
                "AI-driven Learning paths & analytics",
                "Verified Certifications for career milestones",
              ].map((item) => (
                <li key={item} className="flex items-center gap-5 text-gray-300 text-lg">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
                    <Check size={15} className="text-indigo-400" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              onClick={() => openAuth('signup', 'student')}
              className="mt-14 inline-flex items-center justify-center gap-5 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 hover:text-white px-16 py-6 rounded-2xl font-extrabold text-xl tracking-wide transition-all hover:scale-[1.03] active:scale-[0.97] focus:outline-none w-fit self-center"
            >
              Start Learning <ChevronRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
            </button>
          </motion.div>

          {/* Teacher Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="group bg-gradient-to-br from-cyan-900/10 via-cyan-950/20 to-slate-900 border border-cyan-500/20 rounded-[32px] py-20 px-14 md:py-28 md:px-20 hover:border-cyan-500/40 transition-all flex flex-col items-start text-left"
          >
            {/* Icon + Title row */}
            <div className="flex items-center gap-6 mb-10">
              <div className="w-28 h-28 rounded-3xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform flex-shrink-0">
                <Users size={52} />
              </div>
              <h3 className="text-5xl font-extrabold">For Teachers</h3>
            </div>

            {/* Subtitle */}
            <p className="text-gray-400 mt-8 text-xl leading-relaxed">
              Build your digital academy, expand your reach across the nation, and earn doing what you love.
            </p>

            {/* Divider */}
            <div className="w-20 h-px bg-cyan-500/30 my-10" />

            {/* Feature list */}
            <ul className="space-y-7 w-full">
              {[
                "Structured Multi-chapter Course Creator",
                "Broadcast Live to 1000+ students instantly",
                "Fair Revenue Sharing & Instant Payouts",
                "Granular attendance and performance analytics",
              ].map((item) => (
                <li key={item} className="flex items-center gap-5 text-gray-300 text-lg">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                    <Check size={15} className="text-cyan-400" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              onClick={() => openAuth('signup', 'teacher')}
              className="mt-14 inline-flex items-center justify-center gap-5 bg-cyan-600/10 hover:bg-cyan-600/20 border border-cyan-500/30 text-cyan-300 hover:text-white px-16 py-6 rounded-2xl font-extrabold text-xl tracking-wide transition-all hover:scale-[1.03] active:scale-[0.97] focus:outline-none w-fit self-center"
            >
              Start Teaching <ChevronRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
            </button>
          </motion.div>

        </div>
      </section>

      {/* Spacer to guarantee gap */}
      <div className="h-[200px] w-full"></div>


      {/* CTA Section */}
      <section className="mt-[200px] pb-56 relative w-full">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="relative overflow-hidden rounded-[48px] bg-gradient-to-r from-indigo-700 via-purple-700 to-cyan-700 px-16 py-24 md:px-28 md:py-40 min-h-[600px] md:min-h-[800px] flex flex-col items-center justify-center text-center shadow-2xl">
            {/* CTA Background decorative shapes */}
            <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-[-50px] right-[-50px] w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />

            <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-tight mb-8">
              Ready To Start Your Journey?
            </h2>
            
            <p className="text-lg md:text-xl text-white/90 max-w-2xl leading-relaxed mb-14">
              Join thousands of learners mastering complicated topics and experienced educators scaling their classrooms digitally.
            </p>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-8 md:gap-12 w-full">
              
              {/* Student CTA */}
              <div className="button-container">
                <button 
                  onClick={() => openAuth('signup', 'student')}
                  className="real-button"
                />
                <div className="button-border">
                  <div className="button font-extrabold text-lg text-white">
                    Student Sign Up
                    <div className="backdrop"></div>
                    <div className="spin spin-blur"></div>
                    <div className="spin spin-intense"></div>
                    <div className="spin spin-inside"></div>
                  </div>
                </div>
              </div>

              {/* Teacher CTA */}
              <div className="button-container">
                <button 
                  onClick={() => openAuth('signup', 'teacher')}
                  className="real-button"
                />
                <div className="button-border">
                  <div className="button font-bold text-lg text-white">
                    Teacher Sign Up
                    <div className="backdrop"></div>
                    <div className="spin spin-blur"></div>
                    <div className="spin spin-intense"></div>
                    <div className="spin spin-inside"></div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-20 text-center text-sm text-gray-500 bg-slate-950">
        <div className="max-w-7xl mx-auto px-8 flex flex-col md:flex-row justify-between items-center gap-6">
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
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '16px',
              background: 'rgba(0,0,0,0.75)',
              backdropFilter: 'blur(12px)',
            }}
            onClick={() => setIsAuthModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              style={{
                position: 'relative', width: '100%', maxWidth: '480px',
                background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '28px',
                padding: '40px 36px',
                boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Decorative blobs */}
              <div style={{ position:'absolute', top:0, right:0, width:160, height:160, background:'radial-gradient(circle, rgba(99,102,241,0.15), transparent)', borderRadius:'50%', pointerEvents:'none' }} />
              <div style={{ position:'absolute', bottom:0, left:0, width:160, height:160, background:'radial-gradient(circle, rgba(6,182,212,0.12), transparent)', borderRadius:'50%', pointerEvents:'none' }} />

              {/* Close button */}
              <button
                onClick={() => setIsAuthModalOpen(false)}
                style={{ position:'absolute', top:20, right:20, background:'none', border:'none', color:'#9ca3af', cursor:'pointer', padding:6, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center' }}
              >
                <X size={22} />
              </button>

              {/* Header icon */}
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:24 }}>
                <div style={{ width:56, height:56, borderRadius:16, background:'linear-gradient(135deg, #6366f1, #06b6d4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, marginBottom:16, boxShadow:'0 8px 24px rgba(99,102,241,0.35)' }}>
                  🎓
                </div>
                <h2 style={{ margin:0, fontSize:28, fontWeight:900, background:'linear-gradient(90deg, #818cf8, #a78bfa, #67e8f9)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', textAlign:'center' }}>
                  {activeTab === 'login' ? 'Welcome Back' : 'Join EduVerse'}
                </h2>
                <p style={{ margin:'8px 0 0', color:'#94a3b8', fontSize:14, textAlign:'center' }}>
                  {activeTab === 'login' ? 'Sign in to continue your journey' : 'Start learning or teaching today'}
                </p>
              </div>

              {/* Google Buttons */}
              <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:24 }}>
                <button
                  type="button"
                  onClick={() => handleGoogleLoginClick('student')}
                  disabled={submitting || loadingRole !== null}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:12, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'14px 20px', color:'white', fontWeight:700, fontSize:15, cursor:'pointer', transition:'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
                >
                  <span style={{ fontSize:20 }}>👩‍🎓</span>
                  <span>{loadingRole === 'student' ? 'Connecting...' : 'Student Google Login'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleGoogleLoginClick('teacher')}
                  disabled={submitting || loadingRole !== null}
                  style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:12, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, padding:'14px 20px', color:'white', fontWeight:700, fontSize:15, cursor:'pointer', transition:'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
                >
                  <span style={{ fontSize:20 }}>👨‍🏫</span>
                  <span>{loadingRole === 'teacher' ? 'Connecting...' : 'Teacher Google Login'}</span>
                </button>
              </div>

              {/* OR Divider */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
                <span style={{ flex:1, height:1, background:'rgba(255,255,255,0.08)' }} />
                <span style={{ color:'#64748b', fontSize:12, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase' }}>or continue with email</span>
                <span style={{ flex:1, height:1, background:'rgba(255,255,255,0.08)' }} />
              </div>

              {/* Error */}
              {authError && (
                <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171', fontSize:13, borderRadius:10, padding:'12px 16px', marginBottom:20 }}>
                  {authError}
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleCustomSubmit} style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {activeTab === 'signup' && (
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#94a3b8', marginBottom:8 }}>Full Name</label>
                    <input
                      id="modal-name"
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={submitting || loadingRole !== null}
                      required
                      style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:'14px 16px', color:'white', fontSize:15, outline:'none', boxSizing:'border-box' }}
                      onFocus={e => e.target.style.borderColor='#6366f1'}
                      onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'}
                    />
                  </div>
                )}

                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#94a3b8', marginBottom:8 }}>Email Address</label>
                  <input
                    id="modal-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting || loadingRole !== null}
                    required
                    style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:'14px 16px', color:'white', fontSize:15, outline:'none', boxSizing:'border-box' }}
                    onFocus={e => e.target.style.borderColor='#6366f1'}
                    onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'}
                  />
                </div>

                <div>
                  <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#94a3b8', marginBottom:8 }}>Password</label>
                  <input
                    id="modal-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={submitting || loadingRole !== null}
                    required
                    style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:12, padding:'14px 16px', color:'white', fontSize:15, outline:'none', boxSizing:'border-box' }}
                    onFocus={e => e.target.style.borderColor='#6366f1'}
                    onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'}
                  />
                </div>

                {activeTab === 'signup' && (
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#94a3b8', marginBottom:8 }}>Register As</label>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      <button
                        type="button"
                        onClick={() => setRole('student')}
                        disabled={submitting || loadingRole !== null}
                        style={{ padding:'14px', borderRadius:12, border: role==='student' ? '1px solid #6366f1' : '1px solid rgba(255,255,255,0.1)', background: role==='student' ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.03)', color: role==='student' ? 'white' : '#9ca3af', fontWeight:700, fontSize:15, cursor:'pointer' }}
                      >
                        👩‍🎓 Student
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('teacher')}
                        disabled={submitting || loadingRole !== null}
                        style={{ padding:'14px', borderRadius:12, border: role==='teacher' ? '1px solid #06b6d4' : '1px solid rgba(255,255,255,0.1)', background: role==='teacher' ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.03)', color: role==='teacher' ? 'white' : '#9ca3af', fontWeight:700, fontSize:15, cursor:'pointer' }}
                      >
                        👨‍🏫 Teacher
                      </button>
                    </div>
                  </div>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={submitting || loadingRole !== null}
                  style={{ width:'100%', marginTop:8, padding:'16px', borderRadius:14, border:'none', background:'linear-gradient(90deg, #6366f1, #06b6d4)', color:'white', fontWeight:800, fontSize:16, cursor:'pointer', boxShadow:'0 8px 24px rgba(99,102,241,0.3)', opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? 'Please wait...' : activeTab === 'login' ? 'Sign In' : 'Create Account'}
                </button>

                {/* Footer toggle */}
                <p style={{ textAlign:'center', color:'#94a3b8', fontSize:14, margin:0 }}>
                  {activeTab === 'signup' ? "Already have an account? " : "Don't have an account? "}
                  <button
                    type="button"
                    onClick={() => { setActiveTab(activeTab === 'login' ? 'signup' : 'login'); setAuthError(''); }}
                    style={{ background:'none', border:'none', color:'#818cf8', fontWeight:700, fontSize:14, cursor:'pointer', padding:0 }}
                  >
                    {activeTab === 'signup' ? 'Sign In' : 'Sign Up'}
                  </button>
                </p>
              </form>
            </motion.div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* SVG Filters for the spin-glow buttons */}
      <svg style={{ display: 'none' }}>
        <filter id="unopaq">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 3 -1" />
        </filter>
        <filter id="unopaq2">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 4 -1" />
        </filter>
        <filter id="unopaq3">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 5 -1" />
        </filter>
      </svg>

    </div>
  );
}
