import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import LandingPage from './components/LandingPage'; // 👈 new component
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Classifier from './components/Classifier';
import NFRClassifier from './components/NFRClassifier';
import AmbiguityAnalysis from './components/AmbiguityAnalysis';
import CompletenessChecker from './components/CompletenessChecker';
import ConflictDetector from './components/ConflictDetector';
import Prioritizer from './components/Prioritizer';
import ImpactAnalyzer from './components/ImpactAnalyzer';
import RiskEstimator from './components/RiskEstimator';
import './App.css';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('reqify_token');
    const savedEmail = localStorage.getItem('reqify_email');
    if (token && savedEmail) {
      setIsLoggedIn(true);
      setUserEmail(savedEmail);
    }
  }, []);

  const handleLogin = (email, token) => {
    setIsLoggedIn(true);
    setUserEmail(email);
    localStorage.setItem('reqify_token', token);
    localStorage.setItem('reqify_email', email);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserEmail('');
    localStorage.removeItem('reqify_token');
    localStorage.removeItem('reqify_email');
  };

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* 👇 Landing page is the first page now */}
          <Route path="/" element={<LandingPage />} />

          {/* 👇 Login/Signup */}
          <Route
            path="/login"
            element={
              isLoggedIn ? (
                <Navigate to="/dashboard" replace />
              ) : (
                <Login onLogin={handleLogin} />
              )
            }
          />

          {/* 👇 Protected routes */}
          <Route
            path="/dashboard"
            element={
              isLoggedIn ? (
                <Dashboard userEmail={userEmail} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/classifier"
            element={
              isLoggedIn ? (
                <Classifier userEmail={userEmail} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/nfr-classifier"
            element={
              isLoggedIn ? (
                <NFRClassifier userEmail={userEmail} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/ambiguity-analysis"
            element={
              isLoggedIn ? (
                <AmbiguityAnalysis userEmail={userEmail} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/completeness-checker"
            element={
              isLoggedIn ? (
                <CompletenessChecker userEmail={userEmail} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/conflict-detector"
            element={
              isLoggedIn ? (
                <ConflictDetector userEmail={userEmail} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/prioritizer"
            element={
              isLoggedIn ? (
                <Prioritizer userEmail={userEmail} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/impact-analyzer"
            element={
              isLoggedIn ? (
                <ImpactAnalyzer userEmail={userEmail} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />

          <Route
            path="/risk-estimator"
            element={
              isLoggedIn ? (
                <RiskEstimator userEmail={userEmail} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
