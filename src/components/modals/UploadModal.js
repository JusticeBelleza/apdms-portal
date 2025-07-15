// src/components/modals/UploadModal.js
import React, { useState } from 'react';
import { Upload, X, FileText } from 'lucide-react';
import { getMorbidityWeek, generateMorbidityWeeks } from '../../utils/helpers';

const UploadModal = ({ program, onClose, onFileUpload }) => {
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [morbidityWeek, setMorbidityWeek] = useState(getMorbidityWeek());

    const handleFileChange = (e) => { if (e.target.files && e.target.files[0]) { setFile(e.target.files[0]); } };
    const handleDragEvents = (e, isDragging) => { e.preventDefault(); e.stopPropagation(); setDragging(isDragging); };
    const handleDrop = (e) => { handleDragEvents(e, false); if (e.dataTransfer.files && e.dataTransfer.files[0]) { setFile(e.dataTransfer.files[0]); } };
    const handleSubmit = () => { if (file) { onFileUpload(file, morbidityWeek); } };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative"><button onClick={onClose} className="absolute top-3 right-3 p-1 rounded-full hover:bg-gray-200"><X className="w-5 h-5 text-gray-600"/></button><h2 className="text-xl font-bold text-gray-800 mb-2">Upload Report</h2><p className="text-gray-600 mb-4">Submitting for: <span className="font-semibold">{program.name}</span></p>
        <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700">Morbidity Week</label>
            <select value={morbidityWeek} onChange={e => setMorbidityWeek(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                {generateMorbidityWeeks().map(week => (
                    <option key={week} value={week}>{`Week ${week}`}</option>
                ))}
            </select>
        </div>
        <div onDragEnter={(e) => handleDragEvents(e, true)} onDragLeave={(e) => handleDragEvents(e, false)} onDragOver={(e) => handleDragEvents(e, true)} onDrop={handleDrop} className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${dragging ? 'border-primary bg-accent' : 'border-gray-300'}`}><Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" /><input type="file" id="file-upload" className="hidden" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.mdb" /><label htmlFor="file-upload" className="font-medium text-primary hover:text-secondary cursor-pointer">Choose a file</label><p className="text-sm text-gray-500 mt-1">or drag and drop</p><p className="text-xs text-gray-400 mt-2">XLSX, CSV, PDF, PNG, JPG, MDB</p></div>{file && (<div className="mt-4 p-3 bg-gray-100 rounded-lg flex items-center justify-between"><div className="flex items-center"><FileText className="w-5 h-5 text-gray-500 mr-2" /><span className="text-sm text-gray-700">{file.name}</span></div><button onClick={() => setFile(null)} className="p-1 rounded-full hover:bg-gray-200"><X className="w-4 h-4 text-gray-500" /></button></div>)}<div className="mt-6 flex justify-end space-x-3"><button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300">Cancel</button><button onClick={handleSubmit} disabled={!file} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary disabled:bg-gray-400 disabled:cursor-not-allowed">Upload and Submit</button></div></div></div>
    );
};

export default UploadModal;