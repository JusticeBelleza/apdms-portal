import React from 'react';
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { FileText, FileSpreadsheet, Database, Clock, Ban, HelpCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

export const getStatusForProgram = (facilityName, program, submissions) => {
    const lastSubmission = submissions
        .filter(s => s.facilityName === facilityName && s.programName === program.name)
        .sort((a, b) => new Date(b.submissionDate) - new Date(a.submissionDate))[0];

    if (!lastSubmission) return { text: 'Pending', style: 'bg-yellow-100 text-yellow-800 border border-yellow-300', icon: <Clock className="w-4 h-4" />, isActionable: false };

    if (lastSubmission.status === 'Rejected') {
        return { text: 'Rejected', style: 'bg-red-100 text-red-800 border border-red-300', icon: <Ban className="w-4 h-4" />, isActionable: false };
    }

    if (!lastSubmission.confirmed) {
        return { text: 'Pending Confirmation', style: 'bg-orange-100 text-orange-800 border border-orange-300', icon: <HelpCircle className="w-4 h-4" />, isActionable: true, submissionId: lastSubmission.id, fileURL: lastSubmission.fileURL, fileName: lastSubmission.fileName };
    }

    const today = new Date();
    const submissionDate = new Date(lastSubmission.submissionDate);
    let daysDiff = (today - submissionDate) / (1000 * 60 * 60 * 24);

    let deadlineDays;
    switch (program.frequency) {
        case 'Weekly': deadlineDays = 7; break;
        case 'Monthly': deadlineDays = 30; break;
        case 'Quarterly': deadlineDays = 90; break;
        default: deadlineDays = 30;
    }

    if (daysDiff <= deadlineDays) {
        return { text: 'Submitted', style: 'bg-green-100 text-green-800 border border-green-300', icon: <CheckCircle2 className="w-4 h-4" />, isActionable: false };
    } else {
        return { text: 'Overdue', style: 'bg-red-100 text-red-800 border border-red-300', icon: <AlertTriangle className="w-4 h-4" />, isActionable: false };
    }
};

export const getOverallFacilityStatus = (facilityName, programs, submissions, users) => {
    const facilityUser = users.find(u => u.facilityName === facilityName);
    if (!facilityUser) return { text: 'No User', style: 'bg-gray-100 text-gray-800' };

    const assignedPrograms = programs.filter(p => facilityUser.assignedPrograms?.includes(p.id));
    if (assignedPrograms.length === 0) return { text: 'N/A', style: 'bg-gray-100 text-gray-800' };

    const statuses = assignedPrograms.map(p => getStatusForProgram(facilityName, p, submissions).text);

    if (statuses.includes('Overdue')) return { text: 'Overdue', style: 'bg-red-100 text-red-800' };
    if (statuses.includes('Pending') || statuses.includes('Pending Confirmation')) return { text: 'Pending', style: 'bg-yellow-100 text-yellow-800' };
    if (statuses.every(s => s === 'Submitted')) return { text: 'Submitted', style: 'bg-green-100 text-green-800' };

    return { text: 'Pending', style: 'bg-yellow-100 text-yellow-800' };
};

export const getMorbidityWeek = (d = new Date()) => {
    const date = new Date(d.valueOf());
    date.setHours(0, 0, 0, 0);
    // Sunday is the first day of the week
    const day = date.getDay();
    const diff = date.getDate() - day;
    const startOfWeek = new Date(date.setDate(diff));

    const year = startOfWeek.getFullYear();
    // The first week is the one with Jan 4th in it
    const jan4 = new Date(year, 0, 4);
    jan4.setHours(0, 0, 0, 0);
    const firstDayOfWeek1 = new Date(jan4.setDate(jan4.getDate() - jan4.getDay()));

    const diffMillis = startOfWeek - firstDayOfWeek1;
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    const week = Math.round(diffMillis / oneWeek) + 1;
    
    if (week > 52) {
        const nextYearJan4 = new Date(year + 1, 0, 4);
        nextYearJan4.setHours(0, 0, 0, 0);
        const nextYearFirstDayOfWeek1 = new Date(nextYearJan4.setDate(nextYearJan4.getDate() - nextYearJan4.getDay()));
        if (startOfWeek >= nextYearFirstDayOfWeek1) {
            return 1;
        }
    }
    
    if (week < 1) {
         const prevYearJan4 = new Date(year - 1, 0, 4);
         prevYearJan4.setHours(0, 0, 0, 0);
         const prevYearFirstDayOfWeek1 = new Date(prevYearJan4.setDate(prevYearJan4.getDate() - prevYearJan4.getDay()));
         const prevYearDiffMillis = startOfWeek - prevYearFirstDayOfWeek1;
         return Math.round(prevYearDiffMillis / oneWeek) + 1;
    }
    
    return week;
};

export const getDatesForMorbidityWeek = (week, year) => {
    const jan4 = new Date(year, 0, 4);
    jan4.setHours(0, 0, 0, 0);
    const firstDayOfWeek1 = new Date(jan4.setDate(jan4.getDate() - jan4.getDay()));
    
    const startDate = new Date(firstDayOfWeek1);
    startDate.setDate(startDate.getDate() + (week - 1) * 7);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);

    return { startDate, endDate };
}

export const generateMorbidityWeeks = () => {
    const weeks = [];
    const currentWeek = getMorbidityWeek();
    for (let i = 0; i < 52; i++) {
        const week = currentWeek - i;
        if (week > 0) {
            weeks.push(week);
        }
    }
    return weeks;
};

// This is the updated logAudit function that includes facilityId
export const logAudit = async (db, user, action, details = {}) => {
  if (!user) {
    console.error("Audit log failed: User object is missing.");
    return;
  }
  try {
    await addDoc(collection(db, 'audit_logs'), {
      timestamp: serverTimestamp(),
      performedBy: user.uid,
      userName: user.name,
      userRole: user.role,
      facilityId: user.facilityId || null, // Add the facilityId to the log
      action,
      details,
    });
  } catch (error) {
    console.error("Error writing to audit log:", error);
  }
};

export const exportToCSV = (data, filename) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = "data:text/csv;charset=utf-8,"
        + [headers.join(","), ...data.map(row => headers.map(header => JSON.stringify(row[header])).join(","))].join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const getFileIcon = (fileName) => {
    if (!fileName) return <FileText className="w-5 h-5 text-gray-500" />;
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
        case 'pdf':
            return <FileText className="w-5 h-5 text-red-500" />;
        case 'csv':
            return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
        case 'xlsx':
        case 'xls':
            return <FileSpreadsheet className="w-5 h-5 text-green-700" />;
        case 'mdb':
            return <Database className="w-5 h-5 text-blue-500" />;
        default:
            return <FileText className="w-5 h-5 text-gray-500" />;
    }
};
