import React, { useState, useMemo, useEffect } from "react";
import { Download, Search, Trash2, Loader } from "lucide-react";
import { CSVLink } from "react-csv";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { getMorbidityWeek } from "../utils/helpers"; // Assuming you have this helper

const DatabankPage = ({ user, programs, facilities, db, onSuperAdminDelete }) => {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [programFilter, setProgramFilter] = useState("all");
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear().toString());
  const [weekFilter, setWeekFilter] = useState("all");
  const [hideZeroCases, setHideZeroCases] = useState(false); // State for the new toggle

  useEffect(() => {
    if (!user || !db) return;

    setLoading(true);
    let submissionsQuery;

    const baseQuery = query(
      collection(db, "submissions"),
      where("status", "==", "approved"), 
      orderBy("timestamp", "desc")
    );

    if (user.role === "Facility User" || user.role === "Facility Admin") {
      submissionsQuery = query(baseQuery, where("facilityId", "==", user.facilityId));
    } else {
      submissionsQuery = baseQuery;
    }

    const unsubscribe = onSnapshot(
      submissionsQuery,
      (snapshot) => {
        const fetchedSubmissions = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSubmissions(fetchedSubmissions);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching databank submissions:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, db]);

  const availableYears = useMemo(() => {
    const years = new Set(
      submissions.map((sub) => sub.timestamp?.toDate().getFullYear()).filter(Boolean)
    );
    if (!years.has(new Date().getFullYear())) {
        years.add(new Date().getFullYear());
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [submissions]);

  const sortedFacilities = useMemo(() => {
    if (!facilities) return [];
    return [...facilities].sort((a, b) => a.name.localeCompare(b.name));
  }, [facilities]);

  const isPidsrSelected = useMemo(() => {
    const selectedProgram = programs.find(p => p.id === programFilter);
    return selectedProgram?.name.toUpperCase().includes('PIDSR');
  }, [programFilter, programs]);

  const filteredSubmissions = useMemo(() => {
    return submissions
      .filter((sub) => {
        if (hideZeroCases && sub.isZeroCase) {
            return false;
        }

        const program = programs.find((p) => p.id === sub.programId);
        const programName = sub.programName || program?.name || "";
        const facility = facilities.find((f) => f.id === sub.facilityId);
        const searchText = searchTerm.toLowerCase();

        const matchesSearch =
          !searchTerm ||
          sub.fileName?.toLowerCase().includes(searchText) ||
          programName.toLowerCase().includes(searchText) ||
          facility?.name.toLowerCase().includes(searchText);

        const selectedProgram = programs.find(p => p.id === programFilter);
        const isPidsrFilter = selectedProgram?.name.toUpperCase().includes('PIDSR');
        
        const matchesProgram = programFilter === "all" || 
                               sub.programId === programFilter ||
                               (isPidsrFilter && sub.programId === 'PIDSR');

        const matchesFacility = facilityFilter === "all" || sub.facilityId === facilityFilter;
        
        const submissionDate = sub.timestamp?.toDate();
        const matchesYear = yearFilter === "all" || (submissionDate && submissionDate.getFullYear() === parseInt(yearFilter));
        
        let matchesPeriod = true;
        if (isPidsrFilter) {
            matchesPeriod = weekFilter === "all" || (sub.morbidityWeek && sub.morbidityWeek === parseInt(weekFilter));
        } else {
            matchesPeriod = monthFilter === "all" || (submissionDate && submissionDate.getMonth() + 1 === parseInt(monthFilter));
        }

        return matchesSearch && matchesProgram && matchesFacility && matchesYear && matchesPeriod;
      })
  }, [submissions, searchTerm, programFilter, facilityFilter, monthFilter, yearFilter, weekFilter, hideZeroCases, programs, facilities]);

  const csvData = useMemo(() => {
    return filteredSubmissions.map((sub) => {
      const programName = sub.programName || programs.find((p) => p.id === sub.programId)?.name || "N/A";
      const facility = facilities.find((f) => f.id === sub.facilityId);
      return {
        Program: programName,
        Facility: facility?.name || "N/A",
        FileName: sub.fileName,
        SubmittedBy: sub.userName,
        SubmissionDate: sub.timestamp?.toDate().toLocaleDateString(),
        MorbidityWeek: sub.morbidityWeek || "N/A",
        SubmissionMonth: sub.submissionMonth || "N/A",
        SubmissionYear: sub.submissionYear || "N/A",
        Status: sub.status === "approved" ? "Approved" : sub.status,
      };
    });
  }, [filteredSubmissions, programs, facilities]);

  const months = [
    { value: 1, name: "January" }, { value: 2, name: "February" }, { value: 3, name: "March" },
    { value: 4, name: "April" }, { value: 5, name: "May" }, { value: 6, name: "June" },
    { value: 7, name: "July" }, { value: 8, name: "August" }, { value: 9, name: "September" },
    { value: 10, name: "October" }, { value: 11, name: "November" }, { value: 12, name: "December" }
  ];
  
  const availableWeeks = useMemo(() => {
      const currentYear = new Date().getFullYear();
      const selectedYearNum = parseInt(yearFilter);

      if (yearFilter === 'all' || selectedYearNum === currentYear) {
          return Array.from({ length: getMorbidityWeek() }, (_, i) => i + 1);
      }
      return Array.from({ length: 52 }, (_, i) => i + 1);
  }, [yearFilter]);

  return (
    <div className="p-4 sm:p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-800">Databank</h1>
          <p className="text-gray-600">Browse and download approved submissions.</p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-center">
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by file, program, or facility..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-primary focus:border-primary"
                />
              </div>
            </div>
            <div>
              <select
                value={programFilter}
                onChange={(e) => setProgramFilter(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white focus:ring-primary focus:border-primary"
              >
                <option value="all">All Programs</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {user.role !== "Facility User" && user.role !== "Facility Admin" && (
              <div>
                <select
                  value={facilityFilter}
                  onChange={(e) => setFacilityFilter(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white focus:ring-primary focus:border-primary"
                >
                  <option value="all">All Facilities</option>
                  {sortedFacilities.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {isPidsrSelected ? (
                <div>
                    <select
                        value={weekFilter}
                        onChange={(e) => setWeekFilter(e.target.value)}
                        className="w-full p-2 border rounded-lg bg-white focus:ring-primary focus:border-primary"
                    >
                        <option value="all">All Weeks</option>
                        {availableWeeks.map((w) => (
                            <option key={w} value={w}>Week {w}</option>
                        ))}
                    </select>
                </div>
            ) : (
                <div>
                    <select
                        value={monthFilter}
                        onChange={(e) => setMonthFilter(e.target.value)}
                        className="w-full p-2 border rounded-lg bg-white focus:ring-primary focus:border-primary"
                    >
                        <option value="all">All Months</option>
                        {months.map((m) => (
                        <option key={m.value} value={m.value}>
                            {m.name}
                        </option>
                        ))}
                    </select>
                </div>
            )}
            <div>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full p-2 border rounded-lg bg-white focus:ring-primary focus:border-primary"
              >
                <option value="all">All Years</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {/* --- FIX: Zero Case Toggle is now always visible --- */}
          <div className="mt-4 flex items-center justify-end">
              <label htmlFor="hide-zero-case" className="flex items-center cursor-pointer">
                  <div className="relative">
                      <input type="checkbox" id="hide-zero-case" className="sr-only" checked={hideZeroCases} onChange={() => setHideZeroCases(!hideZeroCases)} />
                      <div className={`block w-10 h-6 rounded-full transition ${hideZeroCases ? 'bg-primary' : 'bg-gray-200'}`}></div>
                      <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition ${hideZeroCases ? 'translate-x-full' : ''}`}></div>
                  </div>
                  <div className="ml-3 text-gray-700 text-sm font-medium">
                      Hide Zero Case Reports
                  </div>
              </label>
          </div>
        </div>

        <div className="flex justify-end mb-4">
          <CSVLink
            data={csvData}
            filename={"apdms-databank-export.csv"}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-secondary"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </CSVLink>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                <tr>
                  <th scope="col" className="px-6 py-3">Program</th>
                  <th scope="col" className="px-6 py-3">Facility</th>
                  <th scope="col" className="px-6 py-3">File Name</th>
                  <th scope="col" className="px-6 py-3">Submission Date</th>
                  <th scope="col" className="px-6 py-3">Period</th>
                  <th scope="col" className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-10">
                      <div className="flex justify-center items-center">
                        <Loader className="w-6 h-6 animate-spin mr-2" />
                        <span>Loading data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredSubmissions.length > 0 ? (
                  filteredSubmissions.map((sub) => {
                    const programName = sub.programName || programs.find((p) => p.id === sub.programId)?.name || "N/A";
                    const facility = facilities.find((f) => f.id === sub.facilityId);
                    const periodText = sub.morbidityWeek
                      ? `Week ${sub.morbidityWeek}, ${sub.submissionYear}`
                      : `${new Date(sub.submissionYear, sub.submissionMonth - 1).toLocaleString("default", {
                          month: "long",
                        })}, ${sub.submissionYear}`;

                    return (
                      <tr key={sub.id} className="bg-white border-b hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-gray-900">{programName}</td>
                        <td className="px-6 py-4">{facility?.name || "N/A"}</td>
                        <td className="px-6 py-4">
                          {sub.fileURL ? (
                            <a
                              href={sub.fileURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {sub.fileName}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">{sub.fileName}</span>
                          )}
                        </td>
                        <td className="px-6 py-4">{sub.timestamp?.toDate().toLocaleDateString()}</td>
                        <td className="px-6 py-4">{periodText}</td>
                        <td className="px-6 py-4 flex items-center space-x-2">
                          {sub.fileURL && (
                            <a
                              href={sub.fileURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-primary hover:bg-gray-100 rounded-full"
                              title="Download"
                            >
                              <Download className="w-4 h-4" />
                            </a>
                          )}
                          {user.role === "Super Admin" && (
                            <button
                              onClick={() => onSuperAdminDelete(sub.id, "approve")}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                              title="Delete Submission"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-10 text-gray-500">
                      No approved submissions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabankPage;
