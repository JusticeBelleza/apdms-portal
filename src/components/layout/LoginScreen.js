// src/components/layout/LoginScreen.js
import React, { useState } from 'react';

const LoginScreen = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); onLogin(email, password); };
    return (
        <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4"><div className="max-w-md w-full bg-gray-800 rounded-xl shadow-2xl p-8"><div className="text-center mb-8"><img src="https://placehold.co/100x100/1a202c/76e2d9?text=APDMS" alt="APDMS Logo" className="w-24 h-24 mx-auto rounded-full mb-4 border-4 border-primary" /><h1 className="text-3xl font-bold text-white">APDMS Portal</h1><p className="text-gray-400">Abra PHO Disease Data Management System</p></div><form onSubmit={handleSubmit} className="space-y-6"><div><label className="block text-sm font-medium text-gray-300 mb-1">Email Address</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary" placeholder="e.g., admin@pho.gov.ph" required /></div><div><label className="block text-sm font-medium text-gray-300 mb-1">Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary" placeholder="************" required /></div><button type="submit" className="w-full bg-primary hover:bg-secondary text-white font-bold py-3 px-4 rounded-lg transition duration-300 ease-in-out transform hover:scale-105">Secure Login</button></form><div className="text-center mt-4 text-xs text-gray-500"><p>Use a valid email and 'password' to log in.</p></div></div><p className="text-center text-gray-500 text-xs mt-8">&copy;2025 Justice P. Belleza | Abra Provincial Health Office. All rights reserved.</p></div>
    );
};

export default LoginScreen;