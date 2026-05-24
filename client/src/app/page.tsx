'use client';
import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setUser } from '../store/slices/authSlice';
import { api } from '../services/api';
import { useRouter } from 'next/navigation';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [otpMode, setOtpMode] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [userRegion, setUserRegion] = useState('Locating...');
  const [istTimeDisplay, setIstTimeDisplay] = useState('...');
  const dispatch = useDispatch();
  const router = useRouter();

  useEffect(() => {
    const checkThemeAndLocation = async () => {
      try {
        let region = '';
        try {
          const geo = await fetch('https://ipapi.co/json/').then(r => r.json());
          region = geo.region || geo.city || '';
        } catch(e) {
          // Fallback if adblocker blocks ipapi
          const geo2 = await fetch('https://ipinfo.io/json').then(r => r.json());
          region = geo2.region || geo2.city || 'Unknown Region';
        }
        
        // You can uncomment the line below to hardcode a test location!
        // region = 'Maharashtra'; 
        
        setUserRegion(region || 'Unknown Region');
        const southStates = ['Tamil Nadu', 'Kerala', 'Karnataka', 'Andhra Pradesh', 'Telangana'];
        const isSouth = southStates.includes(region);
        
        // Check IST time
        const d = new Date();
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const istTime = new Date(utc + (3600000 * 5.5));
        const hour = istTime.getHours();
        
        const formattedTime = istTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        setIstTimeDisplay(`${formattedTime} IST`);
        
        if (isSouth && hour >= 10 && hour < 12) {
          document.documentElement.classList.add('light-theme');
        } else {
          document.documentElement.classList.remove('light-theme');
        }
      } catch (e) {}
    };
    checkThemeAndLocation();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (otpMode) {
        const res = await api.post('/auth/login-verify', { email: formData.email, otp });
        dispatch(setUser(res.data));
        router.push('/dashboard');
      } else {
        const endpoint = isLogin ? '/auth/login' : '/auth/register';
        const payload = isLogin ? { ...formData, region: userRegion } : formData;
        const res = await api.post(endpoint, payload);
        
        if (res.data.requireOtp) {
          setOtpMode(true);
          setOtpMessage(res.data.message);
          
          // FOR EVALUATION/TESTING ONLY: 
          // Automatically display the mocked OTP in an alert box since we don't have real Twilio/SendGrid keys!
          if (res.data.otp) {
            setTimeout(() => {
              alert(`[Simulation Mode]\nYou received a new ${res.data.via === 'sms' ? 'SMS Message' : 'Email'}!\n\nYour VibeCall OTP is: ${res.data.otp}`);
            }, 600);
          }
        } else {
          dispatch(setUser(res.data));
          router.push('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-[#1e1e1e] p-8 rounded-2xl shadow-2xl border border-white/5">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Vibe<span className="text-red-600">Call</span></h1>
          <p className="text-gray-400">{isLogin ? 'Sign in to your account' : 'Create a new account'}</p>
          <div className="mt-4 flex flex-wrap justify-center items-center gap-3">
            <div className="inline-flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full text-xs font-bold text-gray-400 border border-white/5">
              <span className={userRegion === 'Locating...' ? 'animate-pulse' : ''}>📍</span> Region: {userRegion}
            </div>
            <div className="inline-flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full text-xs font-bold text-gray-400 border border-white/5">
              <span className={istTimeDisplay === '...' ? 'animate-pulse' : ''}>⏱️</span> Time: {istTimeDisplay}
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {otpMessage && !error && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-500 p-3 rounded-lg mb-6 text-sm text-center">
            {otpMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {otpMode ? (
            <input
              type="text"
              placeholder="Enter OTP"
              className="w-full bg-[#2a2a2a] border border-white/5 p-3 rounded-lg text-white focus:outline-none focus:border-red-600 transition-colors text-center text-2xl tracking-widest"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              required
            />
          ) : (
            <>
              {!isLogin && (
                <>
                  <input
                    type="text"
                    placeholder="Full Name"
                    className="w-full bg-[#2a2a2a] border border-white/5 p-3 rounded-lg text-white focus:outline-none focus:border-red-600 transition-colors"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                  <input
                    type="tel"
                    placeholder="Mobile Number"
                    className="w-full bg-[#2a2a2a] border border-white/5 p-3 rounded-lg text-white focus:outline-none focus:border-red-600 transition-colors"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </>
              )}
              <input
                type="email"
                placeholder="Email Address"
                className="w-full bg-[#2a2a2a] border border-white/5 p-3 rounded-lg text-white focus:outline-none focus:border-red-600 transition-colors"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full bg-[#2a2a2a] border border-white/5 p-3 rounded-lg text-white focus:outline-none focus:border-red-600 transition-colors"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-all transform active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Processing...' : otpMode ? 'Verify & Login' : isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
