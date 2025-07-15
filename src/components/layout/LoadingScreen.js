// src/components/layout/LoadingScreen.js
import React from 'react';

const LoadingScreen = () => (
    <div className="flex items-center justify-center h-screen bg-gray-900 text-white"><div className="text-center"><div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-primary mx-auto"></div><h1 className="text-3xl font-bold mt-4">APDMS</h1><p className="text-lg text-gray-300">Abra PHO Disease Data Management System</p><p className="mt-2 text-primary">Loading Application...</p></div></div>
);

export default LoadingScreen;