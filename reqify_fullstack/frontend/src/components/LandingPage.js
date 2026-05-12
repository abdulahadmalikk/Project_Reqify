import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandingPage.css';

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      <nav>
        <h1 className="brand-text">REQIFY</h1>
      </nav>

      <section className="hero">
        <div className="container">
          <div className="hero-logo-wrapper fade-up">
            <img src="/logo.png" alt="Reqify Logo" className="hero-logo-img" />
          </div>
          <h1 className="fade-up delay-1">
            Intelligent Requirements Assurance and Impact Analysis Platform
          </h1>
          <p className="fade-up delay-2">
            Analyze, classify, and ensure the quality of your software requirements with
            precision and automation.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="cta-button fade-up delay-3"
          >
            Get Started →
          </button>
        </div>
      </section>

      <footer>
        © 2025 REQIFY — Intelligent Requirement Assurance Platform
      </footer>
    </div>
  );
}

export default LandingPage;
