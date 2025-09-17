import React from 'react';

export default function TestPage() {
  console.log('TestPage component rendering');
  
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      backgroundColor: '#f3f4f6',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        textAlign: 'center',
        maxWidth: '400px',
        width: '100%'
      }}>
        <h1 style={{ 
          fontSize: '24px', 
          fontWeight: 'bold',
          marginBottom: '16px',
          color: '#1f2937'
        }}>
          Background Verification System
        </h1>
        <p style={{ 
          color: '#6b7280', 
          marginBottom: '24px' 
        }}>
          Complete background verification task management platform
        </p>
        <button 
          onClick={() => {
            console.log('Button clicked!');
            alert('Button works! Now we can debug the real components.');
            window.location.href = '/login';
          }}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
            width: '100%',
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          Sign In to Continue
        </button>
      </div>
    </div>
  );
}