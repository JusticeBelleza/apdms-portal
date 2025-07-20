import React, { useState, useEffect, useMemo } from 'react';
import { getMorbidityWeek, generateMorbidityWeeks, getDatesForMorbidityWeek } from '../utils/helpers';
import { Printer, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { CSVLink } from 'react-csv';

const ReportsPage = ({ programs = [], users = [], submissions = [] }) => {
    const [reportType, setReportType] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [quarter, setQuarter] = useState(1);
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [week, setWeek] = useState(getMorbidityWeek());
    const [selectedProgramId, setSelectedProgramId] = useState('');
    const [generatedReport, setGeneratedReport] = useState(null);

    const selectedProgram = programs.find(p => p.id === selectedProgramId);
    
    useEffect(() => {
        if (programs.length > 0 && !selectedProgramId) {
            setSelectedProgramId(programs[0].id);
        }
    }, [programs, selectedProgramId]);

    useEffect(() => {
        if (selectedProgram && selectedProgram.reportTypes) {
            setReportType(selectedProgram.reportTypes[0]);
        }
    }, [selectedProgram]);

    const availableWeeks = useMemo(() => {
        const currentYear = new Date().getFullYear();
        if (year === currentYear) {
            return generateMorbidityWeeks(); 
        } else {
            return Array.from({ length: 52 }, (_, i) => 52 - i);
        }
    }, [year]);

    const availableMonths = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const currentMonthIndex = new Date().getMonth(); // 0-indexed
        const allMonths = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, name: new Date(0, i).toLocaleString('default', { month: 'long' }) }));

        if (year === currentYear) {
            return allMonths.slice(0, currentMonthIndex + 1);
        } else {
            return allMonths;
        }
    }, [year]);

    useEffect(() => {
        if (reportType === 'Weekly Summary') {
            setWeek(availableWeeks[0]);
        } else if (reportType === 'Monthly Summary') {
            setMonth(availableMonths[availableMonths.length - 1].value);
        }
    }, [year, reportType, availableWeeks, availableMonths]);


    const handleGenerateReport = () => {
        if (!selectedProgram) {
            toast.error("Please select a program to generate a report.");
            return;
        }

        const programName = selectedProgram.name;
        const programId = selectedProgram.id;
        
        const allProgramFacilities = [...new Set(users
            .filter(u => (u.assignedPrograms || []).includes(programId) && u.facilityName !== 'Provincial Health Office')
            .map(u => u.facilityName)
        )];

        let startDate, endDate;
        let title = '';
        
        switch(reportType) {
            case 'Weekly Summary':
                const dates = getDatesForMorbidityWeek(week, year);
                startDate = dates.startDate;
                startDate.setHours(0, 0, 0, 0);
                endDate = dates.endDate;
                endDate.setHours(23, 59, 59, 999);
                title = `${programName} Report - Morbidity Week ${week}, ${year}`;
                break;
            case 'Monthly Summary':
                startDate = new Date(year, month - 1, 1);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(year, month, 0);
                endDate.setHours(23, 59, 59, 999);
                title = `${programName} Report - ${startDate.toLocaleString('default', { month: 'long' })} ${year}`;
                break;
            case 'Quarterly Summary':
                const startMonth = (quarter - 1) * 3;
                startDate = new Date(year, startMonth, 1);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(year, startMonth + 3, 0);
                endDate.setHours(23, 59, 59, 999);
                title = `Quarterly ${programName} Report - Q${quarter} ${year}`;
                break;
            case 'Annual Summary':
                startDate = new Date(year, 0, 1);
                startDate.setHours(0, 0, 0, 0);
                endDate = new Date(year, 11, 31);
                endDate.setHours(23, 59, 59, 999);
                title = `Annual ${programName} Report - ${year}`;
                break;
            default:
                if(!reportType) {
                    toast.error("This program has no report types configured.");
                } else {
                    toast.error("Invalid report type selected.");
                }
                return;
        }
        
        const relevantSubmissions = submissions.filter(s => {
            const isApproved = s.status === 'approved';
            if (!isApproved) return false;

            const subDate = s.timestamp?.toDate();
            if (!subDate) return false;

            const programMatch = (s.programId === programId) || (s.programName === programName);
            const dateMatch = subDate >= startDate && subDate <= endDate;
            
            return programMatch && dateMatch;
        });

        const consolidatedData = {};

        allProgramFacilities.forEach(facilityName => {
            consolidatedData[facilityName] = {
                facilityName: facilityName,
                submissionsCount: 0,
            };
        });

        relevantSubmissions.forEach(submission => {
            const facilityName = submission.facilityName;
            if (!consolidatedData[facilityName]) {
                 consolidatedData[facilityName] = {
                    facilityName: facilityName,
                    submissionsCount: 0,
                };
            }
            consolidatedData[facilityName].submissionsCount += 1;
        });
        
        const reportData = Object.values(consolidatedData);
        const reportingFacilities = reportData.filter(r => r.submissionsCount > 0).length;
        
        if (reportData.length === 0) {
            toast.error("No approved submissions found for the selected program and period.");
        }

        setGeneratedReport({ 
            title, 
            period: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`, 
            reportingFacilities, 
            totalFacilities: allProgramFacilities.length, 
            breakdown: reportData.sort((a, b) => a.facilityName.localeCompare(b.facilityName)) 
        });
    };

    const csvHeaders = [
        { label: "Facility Name", key: "facilityName" },
        { label: "Submissions Made", key: "submissionsCount" },
    ];

    const YearSelector = () => (
        <div>
            <label className="block text-sm font-medium text-gray-700">Year</label>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                <option>{new Date().getFullYear()}</option>
                <option>{new Date().getFullYear() - 1}</option>
            </select>
        </div>
    );

    return (
        <div className="space-y-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-800">Report Generation</h1>
            <div className="bg-white p-6 rounded-lg shadow-md print:hidden">
                <h2 className="text-xl font-semibold mb-4 text-gray-700">Consolidated Program Report</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Health Program</label>
                        <select value={selectedProgramId} onChange={e => setSelectedProgramId(e.target.value)} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                            <option value="">Select a Program</option>
                            {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Report Type</label>
                        <select value={reportType} onChange={e => setReportType(e.target.value)} disabled={!selectedProgram} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm disabled:bg-gray-50">
                            {(selectedProgram?.reportTypes || []).map(type => <option key={type} value={type}>{type}</option>)}
                        </select>
                    </div>
                    
                    {reportType === 'Weekly Summary' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Week</label>
                                <select value={week} onChange={e => setWeek(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                                    {availableWeeks.map(w => <option key={w} value={w}>{w}</option>)}
                                </select>
                            </div>
                            <YearSelector />
                        </>
                    )}
                    {reportType === 'Monthly Summary' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Month</label>
                                <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                                    {availableMonths.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
                                </select>
                            </div>
                            <YearSelector />
                        </>
                    )}
                    {reportType === 'Quarterly Summary' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Quarter</label>
                                <select value={quarter} onChange={e => setQuarter(parseInt(e.target.value))} className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm">
                                    <option value={1}>Q1 (Jan-Mar)</option>
                                    <option value={2}>Q2 (Apr-Jun)</option>
                                    <option value={3}>Q3 (Jul-Sep)</option>
                                    <option value={4}>Q4 (Oct-Dec)</option>
                                </select>
                            </div>
                            <YearSelector />
                        </>
                    )}
                    {reportType === 'Annual Summary' && (
                        <>
                            <YearSelector />
                            <div></div> 
                        </>
                    )}
                </div>
                <div className="flex justify-end">
                    <button onClick={handleGenerateReport} className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded-lg transition duration-300 h-10">
                        Generate Report
                    </button>
                </div>
            </div>

            {generatedReport && (
                <div id="report-view" className="bg-white p-4 sm:p-8 rounded-lg shadow-md">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div>
                            <h2 className="text-xl md:text-2xl font-bold text-gray-900">{generatedReport.title}</h2>
                            <p className="text-xs sm:text-sm text-gray-500">Reporting Period: {generatedReport.period}</p>
                            <p className="text-xs sm:text-sm text-gray-500">Generated on: {new Date().toLocaleDateString()}</p>
                        </div>
                        <div className="flex space-x-2 print:hidden self-start sm:self-center">
                           <button onClick={() => window.print()} className="flex items-center justify-center bg-gray-700 hover:bg-gray-800 text-white font-bold py-2 px-3 rounded-lg transition duration-300">
                                <Printer className="w-4 h-4" />
                                <span className="hidden sm:inline sm:ml-2 text-sm">Print</span>
                            </button>
                            {generatedReport.breakdown && generatedReport.breakdown.length > 0 && (
                                <CSVLink
                                    data={generatedReport.breakdown}
                                    headers={csvHeaders}
                                    filename={`${generatedReport.title.replace(/ /g, "_")}.csv`}
                                    className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg transition duration-300"
                                    target="_blank"
                                >
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline sm:ml-2 text-sm">Export</span>
                                </CSVLink>
                            )}
                        </div>
                    </div>
                    <hr className="my-6" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-6">
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <p className="text-sm text-gray-600">Reporting Facilities</p>
                            <p className="text-2xl md:text-3xl font-bold text-primary">{generatedReport.reportingFacilities}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <p className="text-sm text-gray-600">Compliance Rate</p>
                            <p className="text-2xl md:text-3xl font-bold text-primary">{generatedReport.totalFacilities > 0 ? ((generatedReport.reportingFacilities / generatedReport.totalFacilities) * 100).toFixed(1) : 0}%</p>
                        </div>
                    </div>
                    <h3 className="text-lg font-semibold mb-4 text-gray-700">Breakdown by Facility</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-500">
                            <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                                <tr>
                                    <th scope="col" className="px-2 sm:px-6 py-3">Facility Name</th>
                                    <th scope="col" className="px-2 sm:px-6 py-3">Submissions Made</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {generatedReport.breakdown.map(item => (
                                    <tr key={item.facilityName}>
                                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">{item.facilityName}</td>
                                        <td className="px-2 sm:px-6 py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">{item.submissionsCount}</td>
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
