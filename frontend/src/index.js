// index.js - Entry Point for React Application

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Optional: Import reportWebVitals for performance monitoring
// import reportWebVitals from './reportWebVitals';

// Get the root DOM element
const rootElement = document.getElementById('root');

// Create React root
const root = ReactDOM.createRoot(rootElement);

// Render the application
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Optional: Measure performance in your app
// Pass a function to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();

// If you want to start measuring performance in your app, you can use reportWebVitals
// You can also pass a function to log results or send to an analytics endpoint
// Example:
// reportWebVitals(console.log);
// or send to an analytics service:
// reportWebVitals(sendToAnalytics);

// Optional: Service Worker registration for PWA
// Uncomment the code below if you want to enable offline functionality and faster loads

/*
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}
*/
