import React, { useState, useEffect } from 'react';
import { getMorbidityWeek, generateMorbidityWeeks, getDatesForMorbidityWeek } from '../utils/helpers';
import { Printer, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { CSVLink } from 'react-csv';

// --- FIX: Added default empty arrays to props to prevent crash on initial render ---
const ReportsPage = ({ programs = [], users = [], submissions = [] }) => {
    const [reportType, setReportType] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [quarter, setQuarter] = useState(1);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [week, setWeek] = useState(getMorbidityWeek());
    const [selectedProgramId, setSelectedProgramId] = useState('');
    const [generatedReport, setGeneratedReport] = useState(null);

    // Find the selected program from the programs prop
    const selectedProgram = programs.find(p => p.id === selectedProgramId);
    
    // Set the initial selected program
    useEffect(() => {
        if (programs.length > 0 && !selectedProgramId) {
            setSelectedProgramId(programs[0].id);
        }
    }, [programs, selectedProgramId]);

    // Set the initial report type based on the selected program
    useEffect(() => {
        if (selectedProgram && selectedProgram.reportTypes) {
            setReportType(selectedProgram.reportTypes[0]);
        }
    }, [selectedProgram]);

    const handleGenerateReport = () => {
        if (!selectedProgram) {
            toast.error("Please select a program to generate a report.");
            return;
        }

        const programName = selectedProgram.name;
        const programId = selectedProgram.id;
        
        // Get a unique list of all facilities that are assigned to the selected program
        const allProgramFacilities = [...new Set(users
            .filter(u => (u.assignedPrograms || []).includes(programId) && u.facilityName !== 'Provincial Health Office')
            .map(u => u.facilityName)
        )];

        let startDate, endDate;
        let title = '';
        
        // Determine the date range based on the selected report type
        switch(reportType) {
            case 'Morbidity Week':
                const dates = getDatesForMorbidityWeek(week, year);
                startDate = dates.startDate;
                startDate.setHours(0, 0, 0, 0);
                endDate = dates.endDate;
                endDate.setHours(23, 59, 59, 999);
                title = `${programName} Report - Morbidity Week ${week}, ${year}`;
                break;
            case 'Morbidity Month':
                startDate = new Date(year, month - 1, 1);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(year, month, 0);
                endDate.setHours(23, 59, 59, 999);
                title = `${programName} Report - ${startDate.toLocaleString('default', { month: 'long' })} ${year}`;
                break;
            case 'Morbidity Year':
                startDate = new Date(year, 0, 1);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(year, 11, 31);
                endDate.setHours(23, 59, 59, 999);
                title = `${programName} Report - ${year}`;
                break;
            case 'Quarterly':
                const startMonth = (quarter - 1) * 3;
                startDate = new Date(year, startMonth, 1);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(year, startMonth + 3, 0);
                endDate.setHours(23, 59, 59, 999);
                title = `Quarterly ${programName} Report - Q${quarter} ${year}`;
                break;
            case 'Annual':
                startDate = new Date(year, 0, 1);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(year, 11, 31);
                endDate.setHours(23, 59, 59, 999);
                title = `Annual ${programName} Report - ${year}`;
                break;
            default:
                toast.error("Invalid report type selected.");
                return;
        }
        
        // Filter the submissions passed via props
        const relevantSubmissions = submissions.filter(s => {
            const isApproved = s.status === 'approved';
            if (!isApproved) return false;

            const subDate = s.timestamp?.toDate();
            if (!subDate) return false;

            const programMatch = (s.programId === programId) || (s.programName === programName);
            const dateMatch = subDate >= startDate && subDate <= endDate;
            
            return programMatch && dateMatch;
        });

        // Create a map to hold the consolidated data for each facility.
        const consolidatedData = {};

        // Initialize the map with all facilities that *should* report, setting their initial values to 0.
        allProgramFacilities.forEach(facilityName => {
            consolidatedData[facilityName] = {
                facilityName: facilityName,
                totalCases: 0,
                submissionsCount: 0,
            };
        });

        // Now, iterate over the *actual* submissions and update the map.
        relevantSubmissions.forEach(submission => {
            const facilityName = submission.facilityName;
            if (!consolidatedData[facilityName]) {
                 consolidatedData[facilityName] = {
                    facilityName: facilityName,
                    totalCases: 0,
                    submissionsCount: 0,
                };
            }
            consolidatedData[facilityName].submissionsCount += 1;
            consolidatedData[facilityName].totalCases += (typeof submission.data?.cases === 'number' ? submission.data.cases : 0);
        });
        
        // Convert the map object back to an array for rendering.
        const reportData = Object.values(consolidatedData);

        const totalCases = reportData.reduce((acc, curr) => acc + curr.totalCases, 0);
        const reportingFacilities = reportData.filter(r => r.submissionsCount > 0).length;
        
        if (relevantSubmissions.length === 0) {
            toast.error("No approved submissions found for the selected program and period.");
        }

        setGeneratedReport({ 
            title, 
            period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, 
            totalCases, 
            reportingFacilities, 
            totalFacilities: allProgramFacilities.length, 
            breakdown: reportData.sort((a, b) => b.totalCases - a.totalCases) 
        });
    };

    // CSV Headers for the export button
    const csvHeaders = [
        { label: "Facility Name", key: "facilityName" },
        { label: "Submissions Made", key: "submissionsCount" },
        { label: "Total Cases Reported", key: "totalCases" }
    ];

    return (
        <div className="space-y-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Report Generation</h1>
            <div className="bg-white p-6 rounded-lg shadow-md print:hidden">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Consolidated Program Report</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Health Program</label>
                        <select value={selectedProgramId} onChange={e => setSelectedProgramId(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                            <option value="">Select a Program</option>
                            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    {selectedProgram && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Report Type</label>
                                <select value={reportType} onChange={e => setReportType(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                                    {(selectedProgram.reportTypes || []).map(type => <option key={type} value={type}>{type}</option>)}
                                </select>
                            </div>
                            {(reportType?.includes('Year') || reportType?.includes('Quarterly') || reportType === 'Annual') && <div><label className="block text-sm font-medium text-gray-700">Year</label><select value={year} onChange={e => setYear(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"><option>{new Date().getFullYear()}</option><option>{new Date().getFullYear() - 1}</option></select></div>}
                            {reportType === 'Morbidity Month' && <div><label className="block text-sm font-medium text-gray-700">Month</label><select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">{[...Array(12).keys()].map(m => <option key={m} value={m+1}>{new Date(0, m).toLocaleString('default', { month: 'long' })}</option>)}</select></div>}
                            {reportType === 'Morbidity Week' && <div><label className="block text-sm font-medium text-gray-700">Week</label><select value={week} onChange={e => setWeek(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">{generateMorbidityWeeks().map(w => <option key={w} value={w}>{w}</option>)}</select></div>}
                            {reportType === 'Quarterly' && (<div><label className="block text-sm font-medium text-gray-700">Quarter</label><select value={quarter} onChange={e => setQuarter(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"><option value={1}>Q1 (Jan-Mar)</option><option value={2}>Q2 (Apr-Jun)</option><option value={3}>Q3 (Jul-Sep)</option><option value={4}>Q4 (Oct-Dec)</option></select></div>)}
                        </>
                    )}
                    <button onClick={handleGenerateReport} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition duration-300 h-10">
                        Generate
                    </button>
                </div>
            </div>
            {generatedReport && (
                <div id="report-view" className="bg-white p-8 rounded-lg shadow-md">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900">{generatedReport.title}</h2>
                            <p className="text-sm text-gray-500">Reporting Period: {generatedReport.period}</p>
                            <p className="text-sm text-gray-500">Generated on: {new Date().toLocaleDateString()}</p>
                        </div>
                        <div className="flex space-x-2 print:hidden">
                           <button onClick={() => window.print()} className="flex items-center justify-center bg-gray-700 hover:bg-gray-800 text-white font-bold py-2 px-2 sm:px-4 rounded-lg transition duration-300">
                                <Printer className="w-4 h-4" />
                                <span className="hidden sm:inline sm:ml-2">Print</span>
                            </button>
                            {generatedReport.breakdown && generatedReport.breakdown.length > 0 && (
                                <CSVLink
                                    data={generatedReport.breakdown}
                                    headers={csvHeaders}
                                    filename={`${generatedReport.title.replace(/ /g, "_")}.csv`}
                                    className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-2 sm:px-4 rounded-lg transition duration-300"
                                    target="_blank"
                                >
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline sm:ml-2">Export to CSV</span>
                                </CSVLink>
                            )}
                        </div>
                    </div>
                    <hr className="my-6" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <p className="text-sm text-gray-600">Total Cases</p>
                            <p className="text-3xl font-bold text-primary">{generatedReport.totalCases}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <p className="text-sm text-gray-600">Reporting Facilities</p>
                            <p className="text-3xl font-bold text-primary">{generatedReport.reportingFacilities}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <p className="text-sm text-gray-600">Compliance Rate</p>
                            <p className="text-3xl font-bold text-primary">{generatedReport.totalFacilities > 0 ? ((generatedReport.reportingFacilities / generatedReport.totalFacilities) * 100).toFixed(1) : 0}%</p>
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-4 text-gray-700">Breakdown by Facility</h3>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 border">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Facility Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submissions Made</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Cases Reported</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {generatedReport.breakdown.map(item => (
                                    <tr key={item.facilityName}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.facilityName}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.submissionsCount}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-bold">{item.totalCases}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
export default ReportsPage;
