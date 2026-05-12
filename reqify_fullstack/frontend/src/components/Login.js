import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import axios from 'axios';
import './Login.css';

function Login({ onLogin }) {
  const { isDark, toggleTheme } = useTheme();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState('');
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const recaptchaRef = useRef(null);
  const recaptchaWidgetId = useRef(null);
  const scriptLoadedRef = useRef(false);

  // v2 Checkbox Site Key - copied exactly from Google reCAPTCHA console
  const RECAPTCHA_SITE_KEY = '6LdHAPwrAAAAAFCw-_aHpl3004DgTf65NEQqiECF';

  // Load reCAPTCHA script
  useEffect(() => {
    if (scriptLoadedRef.current) return;
    
    const existingScript = document.querySelector('script[src*="recaptcha/api.js"]');
    if (existingScript) {
      if (window.grecaptcha && window.grecaptcha.render) {
        setScriptLoaded(true);
        scriptLoadedRef.current = true;
      }
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    script.async = true;
    script.defer = true;

    script.onload = () => {
      const checkReady = setInterval(() => {
        if (window.grecaptcha && window.grecaptcha.render) {
          clearInterval(checkReady);
          setScriptLoaded(true);
          scriptLoadedRef.current = true;
        }
      }, 100);
    };

    script.onerror = () => {
      setError('Failed to load reCAPTCHA. Please refresh the page.');
    };

    document.body.appendChild(script);
  }, []);

  // Render reCAPTCHA widget
  useEffect(() => {
    if (!scriptLoaded || !recaptchaRef.current || recaptchaWidgetId.current !== null) {
      return;
    }

    try {
      recaptchaWidgetId.current = window.grecaptcha.render(recaptchaRef.current, {
        sitekey: RECAPTCHA_SITE_KEY,
        theme: isDark ? 'dark' : 'light',
        callback: (token) => {
          setCaptchaToken(token);
          setError('');
        },
        'expired-callback': () => {
          setCaptchaToken('');
          setError('reCAPTCHA expired. Please verify again.');
        },
        'error-callback': () => {
          setCaptchaToken('');
          setError('reCAPTCHA error. Please try again.');
        }
      });
    } catch (error) {
      console.error('Error rendering reCAPTCHA:', error);
      setError('Failed to initialize reCAPTCHA. Please refresh the page.');
    }
  }, [scriptLoaded, isDark]);

  // Reset reCAPTCHA when switching between sign in/up
  useEffect(() => {
    setCaptchaToken('');
    if (window.grecaptcha && recaptchaWidgetId.current !== null) {
      try {
        window.grecaptcha.reset(recaptchaWidgetId.current);
      } catch (error) {
        console.error('Error resetting reCAPTCHA:', error);
      }
    }
  }, [isSignUp]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!captchaToken) {
      setError('Please complete the reCAPTCHA verification');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const endpoint = isSignUp ? '/api/register' : '/api/login';
      const response = await axios.post(`http://localhost:5000${endpoint}`, {
        email,
        password,
        captchaToken
      });

      if (isSignUp) {
        setSuccess(response.data.message || 'Registration successful! Please login.');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setCaptchaToken('');
        if (window.grecaptcha && recaptchaWidgetId.current !== null) {
          window.grecaptcha.reset(recaptchaWidgetId.current);
        }
        setTimeout(() => {
          setIsSignUp(false);
          setSuccess('');
        }, 2000);
      } else {
        if (response.data.token) {
          onLogin(response.data.email || email, response.data.token);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Authentication failed. Please try again.');
      setCaptchaToken('');
      if (window.grecaptcha && recaptchaWidgetId.current !== null) {
        window.grecaptcha.reset(recaptchaWidgetId.current);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <button onClick={toggleTheme} className="theme-toggle-login" title="Toggle theme">
        {isDark ? '☀️' : '🌙'}
      </button>

      <div className="login-content">
        <div className="login-header">
          <div className="logo">
            <h1>REQIFY</h1>
          </div>
          <p className="tagline">AI-Powered Requirements Analysis & Classification</p>
        </div>

        <div className="login-card">
          <div className="card-tabs">
            <button
              className={!isSignUp ? 'card-tab active' : 'card-tab'}
              onClick={() => {
                setIsSignUp(false);
                setError('');
                setSuccess('');
              }}
            >
              Sign In
            </button>
            <button
              className={isSignUp ? 'card-tab active' : 'card-tab'}
              onClick={() => {
                setIsSignUp(true);
                setError('');
                setSuccess('');
              }}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="login-form">
            {error && (
              <div className="error-message">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {error}
              </div>
            )}

            {success && (
              <div className="success-message">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                {success}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength="6"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                disabled={isLoading}
              />
            </div>

            {isSignUp && (
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength="6"
                  autoComplete="new-password"
                  disabled={isLoading}
                />
              </div>
            )}

            <div className="recaptcha-container">
              {!scriptLoaded ? (
                <div style={{ color: '#9ca3af', fontSize: '14px' }}>
                  Loading reCAPTCHA...
                </div>
              ) : (
                <div ref={recaptchaRef}></div>
              )}
            </div>

            <button type="submit" className="login-button" disabled={isLoading}>
              {isLoading ? (
                <>
                  <span className="spinner"></span>
                  {isSignUp ? 'Creating Account...' : 'Signing In...'}
                </>
              ) : (
                <>
                  <span>{isSignUp ? '🚀' : '🔐'}</span>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </>
              )}
            </button>
          </form>

          <div className="login-footer">
            <p>
              {isSignUp ? 'Already have an account?' : "Don't have an account?"}
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError('');
                  setSuccess('');
                }}
                className="toggle-link"
                disabled={isLoading}
              >
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;